# SmartCA VNPT Integration

Tích hợp dịch vụ chữ ký số SmartCA của VNPT vào hệ thống NestJS.

## Cài đặt

### 1. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và cấu hình các biến môi trường:

```bash
cp .env.example .env
```

### 2. Cấu hình SmartCA

Trong file `.env`, cấu hình các thông tin SmartCA:

```env
# SmartCA Configuration
SMARTCA_SP_ID=your_service_provider_id_from_vnpt
SMARTCA_SP_PASSWORD=your_service_provider_password_from_vnpt
SMARTCA_ENVIRONMENT=uat  # hoặc 'production'
```

**Lưu ý:** Để lấy `SMARTCA_SP_ID` và `SMARTCA_SP_PASSWORD` (tương ứng với `client_id` và `client_secret` trong tài liệu VNPT), bạn cần:

1. Liên hệ VNPT để đăng ký dịch vụ SmartCA
2. Cung cấp thông tin doanh nghiệp theo mẫu của VNPT
3. Nhận thông tin `Client ID` và `Client Secret` qua email

## API Endpoints

### 1. Lấy danh sách chứng thư số

```http
POST /smartca/certificates
Content-Type: application/json

{
  "sp_id": "your_sp_id",
  "sp_password": "your_sp_password",
  "user_id": "cccd_or_cmnd_number"
}
```

### 2. Ký file PDF (Cần xác nhận qua app)

```http
POST /smartca/sign-pdf
Content-Type: multipart/form-data

- file: PDF file
- sp_id: Service Provider ID
- sp_password: Service Provider Password  
- user_id: CCCD/CMND của người ký
- options: JSON string (optional)
```

Ví dụ options:
```json
{
  "docId": "contract-001",
  "page": 1,
  "rectangle": "10,10,250,100",
  "visibleType": 3,
  "fullName": "Nguyen Van A",
  "fontSize": 10
}
```

### 3. Ký nội dung XML (Cần xác nhận qua app)

```http
POST /smartca/sign-xml
Content-Type: application/json

{
  "config": {
    "sp_id": "your_sp_id",
    "sp_password": "your_sp_password", 
    "user_id": "cccd_number"
  },
  "xmlContent": "<xml>...</xml>",
  "options": {
    "docId": "xml-doc-001",
    "hashAlgorithm": "SHA256",
    "signatureId": "signature-id"
  }
}
```

### 4. Ký PDF với SmartCA TH (Không cần xác nhận qua app)

```http
POST /smartca/sign-smartca-th-pdf
Content-Type: multipart/form-data

- file: PDF file
- sp_id: Service Provider ID
- sp_password: Service Provider Password
- user_id: CCCD/CMND
- password: Mật khẩu đăng nhập SmartCA
- otp: Mã OTP của người dùng
- options: JSON string (optional)
```

### 5. Ký XML với SmartCA TH (Không cần xác nhận qua app)

```http
POST /smartca/sign-smartca-th-xml
Content-Type: application/json

{
  "config": {
    "sp_id": "your_sp_id",
    "sp_password": "your_sp_password",
    "user_id": "cccd_number",
    "password": "user_password",
    "otp": "123456"
  },
  "xmlContent": "<xml>...</xml>",
  "options": {
    "docId": "smartca-th-xml-001"
  }
}
```

### 6. Kiểm tra trạng thái giao dịch

```http
GET /smartca/transaction/{transactionId}/status
```

### 7. Tạo mã giao dịch

```http
POST /smartca/generate-transaction-id
```

### 8. Tạo hash từ file

```http
POST /smartca/create-hash
Content-Type: multipart/form-data

- file: File cần tạo hash
```

## Luồng xử lý

### Luồng ký thông thường (SmartCA):
1. Upload file và cấu hình → API ký
2. Hệ thống tạo giao dịch ký
3. Người dùng xác nhận qua app SmartCA
4. Hệ thống nhận chữ ký và trả về file đã ký

### Luồng ký tích hợp (SmartCA TH):
1. Upload file, cấu hình + mật khẩu + OTP → API ký TH
2. Hệ thống tự động ký và trả về file đã ký (không cần xác nhận qua app)

## Lưu ý quan trọng

1. **Môi trường test (UAT):**
   - Sử dụng `SMARTCA_ENVIRONMENT=uat`
   - URL: `https://rmgateway.vnptit.vn/sca/sp769`

2. **Môi trường production:**
   - Sử dụng `SMARTCA_ENVIRONMENT=production`
   - URL: `https://gwsca.vnpt.vn/sca/sp769`

3. **Bảo mật:**
   - Không để lộ `sp_id` và `sp_password` trong code
   - Sử dụng HTTPS trong production
   - Validate input từ client

4. **File size:**
   - Giới hạn file upload: 10MB
   - Chỉ chấp nhận PDF, XML, JSON, text files

5. **Timeout:**
   - HTTP timeout: 30 giây
   - Polling timeout: 4 phút (24 lần x 10 giây)

## Ví dụ sử dụng trong code

```typescript
import { SmartCAService } from './modules/smartca/services/smartca.service';

@Injectable()
export class ContractService {
  constructor(private readonly smartcaService: SmartCAService) {}

  async signContract(contractPdf: Buffer, userId: string) {
    const config = {
      sp_id: process.env.SMARTCA_SP_ID,
      sp_password: process.env.SMARTCA_SP_PASSWORD,
      user_id: userId
    };

    const signedPdf = await this.smartcaService.signPDF(
      config,
      contractPdf,
      { docId: 'contract-' + Date.now() }
    );

    return signedPdf;
  }
}
```

## Troubleshooting

1. **Lỗi 401 SP_CREDENTIAL_INVALID:**
   - Kiểm tra `sp_id` và `sp_password`
   - Kiểm tra `user_id` có đúng định dạng

2. **Lỗi 403 CREDENTIAL_STATUS_INVALID:**
   - Chứng thư số không hợp lệ hoặc hết hạn
   - Liên hệ VNPT để kiểm tra tài khoản

3. **Timeout khi poll transaction:**
   - Người dùng chưa xác nhận qua app
   - Tăng `SMARTCA_MAX_POLL_ATTEMPTS` hoặc `SMARTCA_POLL_INTERVAL_MS`

4. **File upload failed:**
   - Kiểm tra file type và size
   - Kiểm tra multipart/form-data header
