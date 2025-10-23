# Hướng Dẫn Sử Dụng Chức Năng Gia Hạn Hợp Đồng

## Tổng Quan

Chaincode đã được nâng cấp lên **version 2.4.0** với tính năng ghi nhận gia hạn hợp đồng. Backend xử lý logic approve/reject, blockchain chỉ lưu trữ thông tin gia hạn đã được chấp thuận.

## Cấu Trúc Dữ Liệu

### Contract Object - Thêm Fields Mới

```javascript
{
  ...existingFields,
  
  // Fields mới cho extension
  currentExtensionNumber: 0,     // Số lần gia hạn hiện tại
  extensions: [                   // Mảng lưu lịch sử gia hạn
    {
      extensionNumber: 1,
      previousEndDate: "2025-12-31T00:00:00.000Z",
      newEndDate: "2026-12-31T00:00:00.000Z",
      previousRentAmount: 10000000,
      newRentAmount: 12000000,
      extensionAgreementHash: "hash_of_extension_document",
      notes: "Gia hạn 1 năm với giá mới",
      recordedBy: "landlord123",
      recordedByRole: "landlord",
      recordedAt: "2025-10-23T10:00:00.000Z",
      status: "ACTIVE"
    }
  ]
}
```

### Payment Schedule - Thêm Field Mới

```javascript
{
  ...existingFields,
  extensionNumber: 1  // Đánh dấu payment thuộc extension nào (null nếu là kỳ gốc)
}
```

---

## Các Function Mới

### 1. RecordContractExtension

**Mục đích:** Ghi nhận thông tin gia hạn hợp đồng đã được BE chấp thuận

**Tham số:**
- `contractId` (string, required): ID hợp đồng
- `newEndDate` (string, required): Ngày kết thúc mới (ISO 8601 format)
- `newRentAmount` (string/number, required): Giá thuê mới
- `extensionAgreementHash` (string, optional): Hash của văn bản gia hạn
- `extensionNotes` (string, optional): Ghi chú về gia hạn

**Điều kiện:**
- Contract phải tồn tại
- Contract phải ở trạng thái `ACTIVE`
- Caller phải là landlord hoặc tenant của contract
- `newEndDate` phải sau `currentEndDate`
- `newRentAmount` phải > 0

**Cập nhật:**
- Thêm record vào mảng `extensions[]`
- Tăng `currentExtensionNumber`
- Cập nhật `contract.endDate` = newEndDate
- Cập nhật `contract.rentAmount` = newRentAmount
- Emit event `ContractExtended`

**Ví dụ gọi từ Backend:**

```javascript
// Peer CLI
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C rentalchannel \
  -n real-estate-cc \
  --peerAddresses peer0.orglandlord.example.com:7051 \
  --tlsRootCertPaths /path/to/tls/ca.crt \
  -c '{"function":"RecordContractExtension","Args":["CONTRACT001","2026-12-31T23:59:59.000Z","12000000","hash_of_extension_doc","Gia han 1 nam"]}'

// Node.js SDK
await contract.submitTransaction(
  'RecordContractExtension',
  'CONTRACT001',
  '2026-12-31T23:59:59.000Z',
  '12000000',
  'hash_of_extension_doc',
  'Gia han 1 nam voi gia moi'
);
```

**Response:**
```json
{
  "contractId": "CONTRACT001",
  "landlordId": "landlord123",
  "tenantId": "tenant456",
  "endDate": "2026-12-31T23:59:59.000Z",
  "rentAmount": 12000000,
  "currentExtensionNumber": 1,
  "extensions": [
    {
      "extensionNumber": 1,
      "previousEndDate": "2025-12-31T23:59:59.000Z",
      "newEndDate": "2026-12-31T23:59:59.000Z",
      "previousRentAmount": 10000000,
      "newRentAmount": 12000000,
      "extensionAgreementHash": "hash_of_extension_doc",
      "notes": "Gia han 1 nam voi gia moi",
      "recordedBy": "landlord123",
      "recordedByRole": "landlord",
      "recordedAt": "2025-10-23T10:15:30.123Z",
      "status": "ACTIVE"
    }
  ]
}
```

---

### 2. CreateExtensionPaymentSchedule

**Mục đích:** Tạo lịch thanh toán cho phần gia hạn (từ old endDate → new endDate)

**Tham số:**
- `contractId` (string, required): ID hợp đồng
- `extensionNumber` (string/number, required): Số thứ tự gia hạn cần tạo schedule

**Điều kiện:**
- Contract phải tồn tại và ACTIVE
- Extension với số thứ tự đó phải tồn tại
- Tự động tìm period cuối cùng và tiếp tục từ đó

**Ví dụ:**

```javascript
// Peer CLI
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C rentalchannel \
  -n real-estate-cc \
  --peerAddresses peer0.orglandlord.example.com:7051 \
  --tlsRootCertPaths /path/to/tls/ca.crt \
  -c '{"function":"CreateExtensionPaymentSchedule","Args":["CONTRACT001","1"]}'

// Node.js SDK
const schedules = await contract.submitTransaction(
  'CreateExtensionPaymentSchedule',
  'CONTRACT001',
  '1'
);
```

**Response:**
```json
[
  {
    "objectType": "payment",
    "paymentId": "CONTRACT001-payment-013",
    "contractId": "CONTRACT001",
    "period": 13,
    "amount": 12000000,
    "status": "SCHEDULED",
    "dueDate": "2026-01-05T05:00:00.000Z",
    "extensionNumber": 1,
    "createdAt": "2025-10-23T10:20:00.000Z",
    "updatedAt": "2025-10-23T10:20:00.000Z"
  },
  // ... more payment schedules
]
```

**Event Emitted:**
```json
{
  "contractId": "CONTRACT001",
  "extensionNumber": 1,
  "totalSchedules": 12,
  "startPeriod": 13,
  "endPeriod": 24,
  "timestamp": "2025-10-23T10:20:00.000Z"
}
```

---

### 3. QueryContractExtensions

**Mục đích:** Xem toàn bộ lịch sử gia hạn của một hợp đồng

**Tham số:**
- `contractId` (string, required): ID hợp đồng

**Điều kiện:**
- Caller phải là landlord hoặc tenant của contract

**Ví dụ:**

```javascript
// Peer CLI
peer chaincode query \
  -C rentalchannel \
  -n real-estate-cc \
  -c '{"function":"QueryContractExtensions","Args":["CONTRACT001"]}'

// Node.js SDK
const history = await contract.evaluateTransaction(
  'QueryContractExtensions',
  'CONTRACT001'
);
```

**Response:**
```json
{
  "contractId": "CONTRACT001",
  "currentExtensionNumber": 2,
  "extensions": [
    {
      "extensionNumber": 1,
      "previousEndDate": "2025-12-31T23:59:59.000Z",
      "newEndDate": "2026-12-31T23:59:59.000Z",
      "previousRentAmount": 10000000,
      "newRentAmount": 12000000,
      "recordedAt": "2025-10-23T10:15:30.123Z"
    },
    {
      "extensionNumber": 2,
      "previousEndDate": "2026-12-31T23:59:59.000Z",
      "newEndDate": "2027-12-31T23:59:59.000Z",
      "previousRentAmount": 12000000,
      "newRentAmount": 13000000,
      "recordedAt": "2026-10-20T08:00:00.000Z"
    }
  ]
}
```

---

### 4. GetActiveExtension

**Mục đích:** Lấy thông tin gia hạn hiện tại (nếu có)

**Tham số:**
- `contractId` (string, required): ID hợp đồng

**Ví dụ:**

```javascript
// Node.js SDK
const activeExt = await contract.evaluateTransaction(
  'GetActiveExtension',
  'CONTRACT001'
);
```

**Response (có extension):**
```json
{
  "contractId": "CONTRACT001",
  "hasActiveExtension": true,
  "extension": {
    "extensionNumber": 2,
    "previousEndDate": "2026-12-31T23:59:59.000Z",
    "newEndDate": "2027-12-31T23:59:59.000Z",
    "previousRentAmount": 12000000,
    "newRentAmount": 13000000,
    "recordedAt": "2026-10-20T08:00:00.000Z"
  }
}
```

**Response (không có extension):**
```json
{
  "contractId": "CONTRACT001",
  "hasActiveExtension": false,
  "extension": null
}
```

---

### 5. QueryContractsWithExtensions

**Mục đích:** Tìm tất cả các hợp đồng đã từng gia hạn

**Tham số:** Không có

**Ví dụ:**

```javascript
// Peer CLI
peer chaincode query \
  -C rentalchannel \
  -n real-estate-cc \
  -c '{"function":"QueryContractsWithExtensions","Args":[]}'

// Node.js SDK
const contracts = await contract.evaluateTransaction(
  'QueryContractsWithExtensions'
);
```

**Response:**
```json
[
  {
    "contractId": "CONTRACT001",
    "landlordId": "landlord123",
    "tenantId": "tenant456",
    "status": "ACTIVE",
    "currentExtensionNumber": 2,
    "originalEndDate": "2025-12-31T23:59:59.000Z",
    "currentEndDate": "2027-12-31T23:59:59.000Z",
    "currentRentAmount": 13000000,
    "totalExtensions": 2
  },
  {
    "contractId": "CONTRACT002",
    "landlordId": "landlord789",
    "tenantId": "tenant012",
    "status": "ACTIVE",
    "currentExtensionNumber": 1,
    "originalEndDate": "2025-06-30T23:59:59.000Z",
    "currentEndDate": "2026-06-30T23:59:59.000Z",
    "currentRentAmount": 15000000,
    "totalExtensions": 1
  }
]
```

---

## Workflow Hoàn Chỉnh

### Kịch Bản: Gia Hạn Hợp Đồng Lần 1

#### Bước 1: Backend xử lý logic approve
- User request gia hạn
- Backend validate business rules
- Landlord approve
- Tenant approve
- Backend cập nhật trạng thái = "ACTIVE_EXTENSION"

#### Bước 2: Ghi nhận lên Blockchain
```javascript
// 1. Record extension
const result = await contract.submitTransaction(
  'RecordContractExtension',
  'CONTRACT001',
  '2026-12-31T23:59:59.000Z',  // new end date
  '12000000',                   // new rent amount
  'ipfs://Qm...',              // hash of extension agreement
  'Gia han 1 nam'              // notes
);

console.log('Extension recorded:', result);
```

#### Bước 3: Tạo payment schedule cho kỳ gia hạn
```javascript
// 2. Create payment schedules for extension period
const schedules = await contract.submitTransaction(
  'CreateExtensionPaymentSchedule',
  'CONTRACT001',
  '1'  // extension number
);

console.log(`Created ${schedules.length} payment schedules`);
```

#### Bước 4: Query để verify
```javascript
// 3. Verify extension was recorded
const extensions = await contract.evaluateTransaction(
  'QueryContractExtensions',
  'CONTRACT001'
);

console.log('Extension history:', extensions);
```

---

## Events Được Emit

### ContractExtended
```json
{
  "contractId": "CONTRACT001",
  "extensionNumber": 1,
  "previousEndDate": "2025-12-31T23:59:59.000Z",
  "newEndDate": "2026-12-31T23:59:59.000Z",
  "previousRentAmount": 10000000,
  "newRentAmount": 12000000,
  "timestamp": "2025-10-23T10:15:30.123Z"
}
```

### ExtensionPaymentScheduleCreated
```json
{
  "contractId": "CONTRACT001",
  "extensionNumber": 1,
  "totalSchedules": 12,
  "startPeriod": 13,
  "endPeriod": 24,
  "timestamp": "2025-10-23T10:20:00.000Z"
}
```

---

## Lưu Ý Quan Trọng

### 1. Identity Validation
- Chỉ landlord hoặc tenant của contract mới có thể gọi `RecordContractExtension`
- System validate cả MSP và user ID

### 2. Contract Status
- Contract phải ở trạng thái `ACTIVE` mới có thể gia hạn
- Không thể gia hạn contract `TERMINATED` hoặc `PENDING_SIGNATURE`

### 3. Date Validation
- `newEndDate` phải lớn hơn `currentEndDate`
- Nếu vi phạm sẽ throw error

### 4. Payment Schedule
- Payment schedule cho extension tự động bắt đầu từ period cuối cùng + 1
- Mỗi payment record có field `extensionNumber` để tracking
- Rent amount sử dụng `newRentAmount` từ extension

### 5. Immutable History
- Tất cả gia hạn được lưu trong mảng `extensions[]`
- Không thể xóa hoặc sửa history (immutable)
- Sử dụng `GetContractHistory` để xem full audit trail

### 6. Multiple Extensions
- Có thể gia hạn nhiều lần
- Mỗi lần gia hạn tạo 1 record mới trong `extensions[]`
- `currentExtensionNumber` luôn trỏ đến extension mới nhất

---

## Ví Dụ Backend Integration

### Node.js với Fabric SDK

```javascript
const { Gateway, Wallets } = require('fabric-network');

async function recordContractExtension(contractId, newEndDate, newRentAmount, agreementHash, notes) {
  try {
    // Connect to network
    const gateway = new Gateway();
    await gateway.connect(connectionProfile, {
      wallet,
      identity: 'landlord123',
      discovery: { enabled: true, asLocalhost: false }
    });

    const network = await gateway.getNetwork('rentalchannel');
    const contract = network.getContract('real-estate-cc');

    // Record extension
    const result = await contract.submitTransaction(
      'RecordContractExtension',
      contractId,
      newEndDate,
      newRentAmount.toString(),
      agreementHash,
      notes
    );

    const extensionData = JSON.parse(result.toString());
    console.log('Extension recorded:', extensionData);

    // Get extension number from response
    const extensionNumber = extensionData.currentExtensionNumber;

    // Create payment schedules
    const schedules = await contract.submitTransaction(
      'CreateExtensionPaymentSchedule',
      contractId,
      extensionNumber.toString()
    );

    const scheduleData = JSON.parse(schedules.toString());
    console.log(`Created ${scheduleData.length} payment schedules`);

    await gateway.disconnect();

    return {
      success: true,
      contract: extensionData,
      schedules: scheduleData
    };

  } catch (error) {
    console.error('Error recording extension:', error);
    throw error;
  }
}

// Usage
await recordContractExtension(
  'CONTRACT001',
  '2026-12-31T23:59:59.000Z',
  12000000,
  'ipfs://Qm...',
  'Gia han 1 nam voi gia moi'
);
```

---

## Troubleshooting

### Error: "Contract must be ACTIVE to record extension"
- **Nguyên nhân:** Contract không ở trạng thái ACTIVE
- **Giải pháp:** Check status bằng `GetContract`, đảm bảo contract đã được activate

### Error: "New end date must be after current end date"
- **Nguyên nhân:** newEndDate <= currentEndDate
- **Giải pháp:** Đảm bảo newEndDate lớn hơn endDate hiện tại

### Error: "Extension number X not found"
- **Nguyên nhân:** Gọi `CreateExtensionPaymentSchedule` với số extension không tồn tại
- **Giải pháp:** Dùng `QueryContractExtensions` để check extension numbers

### Error: "Caller is not authorized for this contract"
- **Nguyên nhân:** Identity không phải landlord hoặc tenant
- **Giải pháp:** Đảm bảo gọi với đúng identity (landlordId hoặc tenantId)

---

## Changelog

### Version 2.4.0 (2025-10-23)
- ✅ Thêm `RecordContractExtension` function
- ✅ Thêm `CreateExtensionPaymentSchedule` function
- ✅ Thêm `QueryContractExtensions` function
- ✅ Thêm `GetActiveExtension` function
- ✅ Thêm `QueryContractsWithExtensions` function
- ✅ Thêm fields `currentExtensionNumber` và `extensions[]` vào contract
- ✅ Thêm field `extensionNumber` vào payment schedule
- ✅ Emit events: `ContractExtended`, `ExtensionPaymentScheduleCreated`

---

## Testing Script

```bash
#!/bin/bash

# Test 1: Record Extension
echo "=== Test 1: Record Contract Extension ==="
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C rentalchannel \
  -n real-estate-cc \
  --peerAddresses peer0.orglandlord.example.com:7051 \
  --tlsRootCertPaths /path/to/tls/ca.crt \
  -c '{"function":"RecordContractExtension","Args":["CONTRACT001","2026-12-31T23:59:59.000Z","12000000","hash123","First extension"]}'

sleep 5

# Test 2: Create Payment Schedule for Extension
echo "=== Test 2: Create Extension Payment Schedule ==="
peer chaincode invoke \
  -o orderer.example.com:7050 \
  -C rentalchannel \
  -n real-estate-cc \
  --peerAddresses peer0.orglandlord.example.com:7051 \
  --tlsRootCertPaths /path/to/tls/ca.crt \
  -c '{"function":"CreateExtensionPaymentSchedule","Args":["CONTRACT001","1"]}'

sleep 5

# Test 3: Query Extensions
echo "=== Test 3: Query Contract Extensions ==="
peer chaincode query \
  -C rentalchannel \
  -n real-estate-cc \
  -c '{"function":"QueryContractExtensions","Args":["CONTRACT001"]}'

# Test 4: Get Active Extension
echo "=== Test 4: Get Active Extension ==="
peer chaincode query \
  -C rentalchannel \
  -n real-estate-cc \
  -c '{"function":"GetActiveExtension","Args":["CONTRACT001"]}'

# Test 5: Query All Contracts with Extensions
echo "=== Test 5: Query Contracts With Extensions ==="
peer chaincode query \
  -C rentalchannel \
  -n real-estate-cc \
  -c '{"function":"QueryContractsWithExtensions","Args":[]}'
```

---

## Contact & Support

Nếu có vấn đề hoặc câu hỏi về chức năng gia hạn hợp đồng, vui lòng liên hệ team phát triển.
