# Contract Extension - Blockchain Integration Guide

## 📋 Tổng Quan

Tài liệu này mô tả việc tích hợp blockchain vào luồng gia hạn hợp đồng (Contract Extension) của hệ thống. Khi một extension được ACTIVE thành công, hệ thống sẽ tự động ghi nhận thông tin lên blockchain và tạo payment schedule.

---

## 🔄 Luồng Hoạt Động

### Workflow Gia Hạn Hợp Đồng

```
1. Tenant Request Extension (PENDING)
         ↓
2. Landlord Respond (LANDLORD_RESPONDED)
         ↓
3. Tenant Accept (AWAITING_SIGNATURES)
         ↓
4. Landlord Sign Extension Contract (LANDLORD_SIGNED)
         ↓
5. Tenant Sign Extension Contract (TENANT_SIGNED)
         ↓
6. Check Escrow Balance
         ↓
   ┌─────────────────────────────┐
   │                             │
   ├─ Both Funded → ACTIVE       │
   │   └─► Apply Extension       │ ◄── BLOCKCHAIN INTEGRATION HERE
   │       └─► Record to Blockchain
   │           └─► Create Payment Schedule
   │                             │
   ├─ Only Tenant → ESCROW_FUNDED_T
   │                             │
   ├─ Only Landlord → ESCROW_FUNDED_L
   │                             │
   └─ None → AWAITING_ESCROW
```

---

## 🔧 Implementation Details

### 1. Service Layer Update

**File:** `src/modules/contract/contract-extension.service.ts`

#### Thêm Dependency

```typescript
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class ContractExtensionService {
  constructor(
    // ... existing dependencies
    private blockchainService: BlockchainService,
  ) {}
}
```

#### Method: `applyExtension()`

Method này được gọi khi extension chuyển sang status ACTIVE:

```typescript
private async applyExtension(extension: ContractExtension): Promise<void> {
  const contract = extension.contract;

  // 1. Cập nhật contract end date trong database
  const newEndDate = addMonths(contract.endDate, extension.extensionMonths);
  contract.endDate = newEndDate;
  await this.contractRepository.save(contract);

  // 2. Ghi nhận extension lên blockchain
  await this.recordExtensionToBlockchain(extension, contract);
}
```

#### Method: `recordExtensionToBlockchain()`

Method mới để xử lý tích hợp blockchain:

```typescript
private async recordExtensionToBlockchain(
  extension: ContractExtension,
  contract: Contract,
): Promise<void> {
  try {
    // 1. Xác định giá thuê hiện tại
    let currentRentAmount = 0;
    if (contract.property.type === PropertyTypeEnum.BOARDING && contract.room?.roomType) {
      currentRentAmount = contract.room.roomType.price;
    } else if (contract.property.price) {
      currentRentAmount = contract.property.price;
    }

    // 2. Lấy giá thuê mới (nếu có thay đổi)
    const newRentAmount = extension.newMonthlyRent || currentRentAmount;

    // 3. Tạo blockchain user (landlord)
    const blockchainUser = {
      userId: contract.landlord.id,
      orgName: 'OrgLandlord',
      mspId: 'OrgLandlordMSP',
    };

    // 4. Ghi nhận extension lên blockchain
    const recordResult = await this.blockchainService.recordContractExtension(
      contract.id,
      contract.endDate.toISOString(),
      newRentAmount.toString(),
      extension.extensionContractFileUrl || '',
      extension.requestNote || 'Contract extension',
      blockchainUser,
    );

    if (!recordResult.success) {
      throw new Error(`Failed to record extension: ${recordResult.error}`);
    }

    // 5. Lấy extension number từ blockchain
    const extensionNumber = recordResult.data?.currentExtensionNumber;

    if (!extensionNumber) {
      throw new Error('Extension number not returned from blockchain');
    }

    // 6. Tạo payment schedule cho extension
    const scheduleResult = await this.blockchainService.createExtensionPaymentSchedule(
      contract.id,
      extensionNumber.toString(),
      blockchainUser,
    );

    if (!scheduleResult.success) {
      throw new Error(`Failed to create payment schedule: ${scheduleResult.error}`);
    }

    // 7. Log success
    console.log('[BlockchainExtension] ✅ Integration completed:', {
      contractId: contract.id,
      extensionId: extension.id,
      extensionNumber: extensionNumber,
      paymentPeriodsCreated: scheduleResult.data?.length || 0,
    });

  } catch (error) {
    // Log error nhưng không fail transaction
    console.error('[BlockchainExtension] ❌ Failed:', error);
    console.warn('[BlockchainExtension] ⚠️ Extension applied but blockchain record failed');

    // Extension vẫn ACTIVE trong database
    // Có thể retry hoặc xử lý manual sau
  }
}
```

---

## 📊 Data Flow

### Extension Data → Blockchain

| Database Field                       | Blockchain Field         | Description                                |
| ------------------------------------ | ------------------------ | ------------------------------------------ |
| `contract.id`                        | `contractId`             | Contract identifier                        |
| `contract.endDate` (after extension) | `newEndDate`             | New contract end date                      |
| `extension.newMonthlyRent`           | `newRentAmount`          | New monthly rent (or current if unchanged) |
| `extension.extensionContractFileUrl` | `extensionAgreementHash` | Signed extension contract URL              |
| `extension.requestNote`              | `extensionNotes`         | Extension notes/reason                     |

### Blockchain Response → Database

| Blockchain Response      | Usage                                      |
| ------------------------ | ------------------------------------------ |
| `currentExtensionNumber` | Used to create payment schedule            |
| `extensions[]`           | Extension history on blockchain            |
| Payment schedules        | Created automatically for extension period |

---

## 🎯 Blockchain Operations

### Operation 1: Record Extension

**Chaincode Function:** `RecordContractExtension`

**Parameters:**

- `contractId`: Contract ID
- `newEndDate`: New end date (ISO 8601)
- `newRentAmount`: New rent amount (as string)
- `extensionAgreementHash`: Extension contract file URL
- `extensionNotes`: Notes about extension

**Response:**

```json
{
  "success": true,
  "data": {
    "contractId": "CONTRACT001",
    "currentExtensionNumber": 1,
    "endDate": "2026-12-31T23:59:59.000Z",
    "rentAmount": 12000000,
    "extensions": [...]
  }
}
```

### Operation 2: Create Payment Schedule

**Chaincode Function:** `CreateExtensionPaymentSchedule`

**Parameters:**

- `contractId`: Contract ID
- `extensionNumber`: Extension number from step 1

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "CONTRACT001-payment-013",
      "period": 13,
      "amount": 12000000,
      "status": "SCHEDULED",
      "extensionNumber": 1,
      "dueDate": "2026-01-05T00:00:00.000Z"
    }
    // ... more payment periods
  ]
}
```

---

## 🔒 Error Handling

### Strategy: Graceful Degradation

Extension vẫn được apply trong database ngay cả khi blockchain fail:

```typescript
try {
  // Blockchain operations
  await this.recordExtensionToBlockchain(extension, contract);
} catch (error) {
  // Log error
  console.error('[BlockchainExtension] ❌ Failed:', error);

  // Extension vẫn ACTIVE trong database
  // Không throw error để không rollback transaction

  // Admin có thể retry manual hoặc check logs
}
```

### Possible Errors

| Error                            | Cause                              | Solution                        |
| -------------------------------- | ---------------------------------- | ------------------------------- |
| Blockchain user not enrolled     | User chưa enroll blockchain        | Enroll user trước khi extension |
| Connection timeout               | Blockchain network không available | Retry hoặc check network        |
| Extension number not returned    | Chaincode response invalid         | Check chaincode version         |
| Payment schedule creation failed | Extension not recorded             | Retry từ đầu                    |

---

## 📝 Logging

### Log Format

```typescript
// Success logs
[BlockchainExtension] 📝 Recording extension to blockchain...
[BlockchainExtension] ✅ Extension recorded successfully
[BlockchainExtension] 📅 Creating payment schedule for extension 1...
[BlockchainExtension] ✅ Payment schedule created: 12 periods
[BlockchainExtension] 🎉 Blockchain integration completed

// Error logs
[BlockchainExtension] ❌ Failed to record to blockchain: {error}
[BlockchainExtension] ⚠️ Extension applied but blockchain record failed
```

### Monitoring Points

- Extension activation success rate
- Blockchain integration success rate
- Average time for blockchain operations
- Failed blockchain records (need retry)

---

## 🧪 Testing

### Test Scenarios

#### 1. Happy Path - Extension ACTIVE với Blockchain Success

```typescript
// Setup
- Contract với status ACTIVE
- Extension đã được signed bởi cả landlord và tenant
- Cả hai bên đã fund escrow đủ

// Expected
- Extension status → ACTIVE
- Contract endDate được update
- Blockchain record success
- Payment schedule created
- Logs show success
```

#### 2. Extension ACTIVE nhưng Blockchain Failed

```typescript
// Setup
- Contract với status ACTIVE
- Extension signed
- Escrow funded
- Blockchain network DOWN

// Expected
- Extension status → ACTIVE (vẫn thành công)
- Contract endDate được update
- Blockchain record FAILED
- Error logged
- Extension vẫn apply trong database
```

#### 3. Multiple Extensions

```typescript
// Setup
- Contract đã có extension 1 (ACTIVE)
- Request extension 2

// Expected
- Extension 2 recorded với extensionNumber = 2
- Payment schedule created từ period cuối extension 1 + 1
- Contract endDate tiếp tục extend
```

### Manual Testing

```bash
# 1. Check extension status
curl -X GET http://localhost:3000/api/contracts/{contractId}/extensions \
  -H "Authorization: Bearer TOKEN"

# 2. Monitor logs khi extension active
# Xem console logs để verify blockchain integration

# 3. Query blockchain để verify
curl -X GET http://localhost:3000/api/blockchain/contracts/{contractId}/extensions \
  -H "Authorization: Bearer TOKEN" \
  -H "orgName: OrgLandlord"
```

---

## 🔐 Security Considerations

### 1. User Identity

- Sử dụng landlord identity để ghi blockchain
- Landlord phải enrolled trước khi extension
- Check enrollment status trong user profile

### 2. Data Integrity

- Extension URL được hash và lưu trên blockchain
- Payment schedules immutable sau khi tạo
- Full audit trail available

### 3. Access Control

- Chỉ landlord/tenant của contract mới query được extensions
- MSP validation tự động bởi blockchain

---

## 📈 Performance

### Expected Metrics

| Operation               | Expected Time | Notes                         |
| ----------------------- | ------------- | ----------------------------- |
| Record Extension        | 2-5 seconds   | Depends on blockchain network |
| Create Payment Schedule | 1-3 seconds   | Depends on extension months   |
| Total Integration       | 3-8 seconds   | Sequential operations         |

### Optimization Tips

1. **Async Processing**: Có thể move blockchain operations sang background job
2. **Retry Mechanism**: Implement retry cho failed blockchain operations
3. **Caching**: Cache blockchain user identity
4. **Monitoring**: Track success rate và performance

---

## 🚀 Deployment Checklist

### Pre-deployment

- [ ] Verify blockchain network availability
- [ ] Check all users đã enrolled blockchain
- [ ] Test with sample extensions
- [ ] Verify chaincode version 2.4.0 deployed
- [ ] Check logs configuration

### Post-deployment

- [ ] Monitor extension activation logs
- [ ] Check blockchain integration success rate
- [ ] Verify payment schedules created correctly
- [ ] Test rollback scenarios
- [ ] Document any issues

---

## 📚 Related Documentation

- `CONTRACT_EXTENSION_GUIDE.md` - Chaincode documentation
- `BLOCKCHAIN_EXTENSION_API_GUIDE.md` - API documentation
- `CONTRACT_EXTENSION_IMPLEMENTATION_SUMMARY.md` - Implementation details

---

## 🆘 Troubleshooting

### Issue: Extension ACTIVE nhưng không thấy blockchain record

**Check:**

1. Xem logs: `[BlockchainExtension]` entries
2. Check blockchain network status
3. Verify user enrollment
4. Check chaincode version

**Solution:**

- Retry manual bằng cách gọi API blockchain trực tiếp
- Hoặc wait for automatic retry (nếu implemented)

### Issue: Payment schedule không được tạo

**Check:**

1. Extension number có được return không
2. Blockchain record có success không
3. Check logs cho error details

**Solution:**

- Gọi lại `createExtensionPaymentSchedule` với extension number

---

## 📞 Support

Nếu có vấn đề:

1. Check logs với keyword `[BlockchainExtension]`
2. Verify blockchain network status
3. Check user enrollment status
4. Contact development team

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Status:** ✅ Implemented and Ready for Testing
