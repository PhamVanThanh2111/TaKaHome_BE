# Blockchain User Enrollment Implementation

## Tổng quan

Hệ thống đã được triển khai để tự động enroll blockchain identity cho user khi đăng ký mới. Điều này cho phép mỗi user có blockchain identity riêng thay vì dùng chung admin account.

## Luồng hoạt động

### 1. User Registration
Khi user đăng ký mới qua `/api/auth/register`, hệ thống sẽ:
- Tạo User và Account trong database
- Tự động enroll blockchain identity dựa trên role
- Role mapping:
  - `TENANT` → `OrgTenant` 
  - `LANDLORD` → `OrgLandlord`
  - `ADMIN` → `OrgProp`

### 2. Blockchain API Authentication
Khi gọi blockchain API, hệ thống ưu tiên user identity theo thứ tự:
1. **Explicit userId** từ header `userid`
2. **JWT user ID** (nếu đã authenticate)  
3. **Default admin user** cho organization

## API Endpoints

### 1. Register User (với blockchain enrollment)
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "New User",
  "phone": "0123456789"
}
```

### 2. Manual User Enrollment
```bash
POST /api/blockchain/enroll-user
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "userId": "123",
  "orgName": "OrgTenant", 
  "role": "TENANT"
}
```

### 3. Check Enrollment Status
```bash
GET /api/blockchain/check-enrollment?userId=123&orgName=OrgTenant
Authorization: Bearer <jwt-token>
```

### 4. Blockchain API với User Identity
```bash
GET /api/blockchain/contracts
Authorization: Bearer <jwt-token>
orgName: OrgTenant
# userId sẽ được tự động lấy từ JWT token
```

## Migration Script

Để enroll existing users, chạy migration script:

```bash
npm run ts-node scripts/enroll-existing-users.ts
```

Script này sẽ:
- Lấy tất cả verified accounts
- Enroll blockchain identity cho từng user
- Hiển thị progress và summary

## Testing Scenarios

### Test 1: New User Registration
```bash
# 1. Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'

# 2. Login to get JWT
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com", 
    "password": "password123"
  }'

# 3. Test blockchain API
curl -X GET http://localhost:3000/api/blockchain/contracts \
  -H "Authorization: Bearer <jwt-token>" \
  -H "orgName: OrgTenant"
```

### Test 2: Check Enrollment
```bash
curl -X GET "http://localhost:3000/api/blockchain/check-enrollment?userId=123&orgName=OrgTenant" \
  -H "Authorization: Bearer <jwt-token>"
```

### Test 3: Manual Enrollment
```bash
curl -X POST http://localhost:3000/api/blockchain/enroll-user \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "orgName": "OrgTenant",
    "role": "TENANT"
  }'
```

## Wallet Structure

Blockchain identities được lưu trong wallet theo format:
```
./assets/blockchain/wallet/
├── admin-OrgProp.id
├── admin-OrgTenant.id  
├── admin-OrgLandlord.id
├── 123.id              # User-specific identity
├── 456.id
└── ...
```

## Error Handling

- **Registration:** Nếu blockchain enrollment thất bại, registration vẫn thành công
- **API calls:** Nếu user identity không tồn tại, fallback về admin user
- **CA errors:** Log error và trả về false cho enrollment

## Monitoring Logs

```bash
# Theo dõi enrollment logs
tail -f server.log | grep "enrolled\|enrollment"

# Check blockchain connections  
tail -f server.log | grep "Blockchain\|Fabric"
```

## Configuration

Các environment variables liên quan:
```env
# CA URLs for each organization
CA_PROP_URL=https://localhost:7054
CA_TENANT_URL=https://localhost:8054  
CA_LANDLORD_URL=https://localhost:9054

# Blockchain network
CHANNEL_NAME=rentalchannel
CHAINCODE_NAME=real-estate-cc
```

## Troubleshooting

### 1. User enrollment fails
- Kiểm tra CA server đang chạy
- Verify admin user tồn tại trong wallet
- Check TLS certificates

### 2. API authentication fails  
- Verify JWT token valid
- Check orgName header
- Ensure user enrolled hoặc fallback admin tồn tại

### 3. Identity not found
- Run migration script cho existing users
- Manual enroll qua API endpoint
- Check wallet permissions

## Security Notes

- User private keys được mã hóa trong wallet
- Mỗi user có certificate riêng với attributes
- Admin users chỉ dùng khi fallback
- CA communication sử dụng TLS

## Next Steps

1. **Role-based Access Control:** Implement chaincode-level authorization
2. **Identity Revocation:** Add endpoint để revoke user certificates  
3. **Batch Operations:** Optimize multiple user enrollment
4. **Monitoring:** Add metrics cho enrollment success rate
