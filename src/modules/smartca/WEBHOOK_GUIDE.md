# SmartCA Webhook Integration Guide

## Tổng quan

Tính năng webhook cho phép hệ thống nhận file đã ký từ SmartCA VNPT một cách bất đồng bộ. Thay vì phải polling để kiểm tra trạng thái, SmartCA sẽ gửi callback về hệ thống khi quá trình ký hoàn tất.

## Kiến trúc

```
[Client] → [Upload File] → [SmartCA API] → [Signing Process] → [Webhook] → [Your System]
```

### Luồng hoạt động:

1. **Upload & Sign Request**: Client upload file và gửi yêu cầu ký
2. **Store Temporary File**: Hệ thống lưu file gốc tạm thời
3. **SmartCA Processing**: SmartCA xử lý ký số
4. **Webhook Callback**: SmartCA gửi callback với signature về hệ thống
5. **File Reconstruction**: Hệ thống tái tạo file đã ký từ signature
6. **Storage & Notification**: Lưu file đã ký và thông báo người dùng

## API Endpoints

### 1. Webhook Endpoint (Cho SmartCA gọi)

```http
POST /smartca/webhook
Content-Type: application/json

{
  "sp_id": "your_sp_id",
  "status_code": 200,
  "message": "Success",
  "transaction_id": "SP_CA_123456",
  "signed_files": [
    {
      "doc_id": "document-id-123",
      "signature_value": "base64_signature_data...",
      "timestamp_signature": "2025-09-30T10:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 1 signed files",
  "data": {
    "processed_files": ["document-id-123"],
    "transaction_id": "SP_CA_123456",
    "timestamp": "2025-09-30T10:00:00.000Z"
  }
}
```

### 2. Lấy file đã ký

```http
GET /smartca/signed-file/:docId
```

### 3. Lấy thông tin file đã ký

```http
GET /smartca/signed-file/:docId/info
```

**Response:**
```json
{
  "success": true,
  "message": "Signed file info retrieved successfully",
  "data": {
    "doc_id": "document-id-123",
    "transaction_id": "SP_CA_123456",
    "original_filename": "contract.pdf",
    "file_type": "pdf",
    "status": "signed",
    "signed_file_path": "/path/to/signed/file.pdf",
    "signature_value": "base64_signature...",
    "timestamp_signature": "2025-09-30T10:00:00Z",
    "user_id": "123456789",
    "signed_at": "2025-09-30T10:00:00.000Z",
    "file_size": 256000
  }
}
```

## Configuration

### Environment Variables

```bash
# SmartCA Base Configuration
SMARTCA_SP_ID=your_sp_id
SMARTCA_SP_PASSWORD=your_sp_password
SMARTCA_ENVIRONMENT=production # or 'uat'

# File Storage Paths
SMARTCA_SIGNED_FILES_PATH=/path/to/signed/files
SMARTCA_TEMP_FILES_PATH=/path/to/temp/files
```

### Cấu hình Webhook URL tại SmartCA

Bạn cần đăng ký webhook URL với SmartCA VNPT:

```
https://yourdomain.com/smartca/webhook
```

## Cách sử dụng

### 1. Ký file PDF với webhook

```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('sp_id', 'your_sp_id');
formData.append('sp_password', 'your_sp_password');
formData.append('user_id', '123456789');
formData.append('options', JSON.stringify({
  docId: 'unique-document-id',
  originalFileName: 'contract.pdf'
}));

const response = await fetch('/smartca/sign-pdf', {
  method: 'POST',
  body: formData
});
```

### 2. Theo dõi trạng thái ký

```javascript
// Polling cách cũ (vẫn có thể dùng)
const status = await fetch(`/smartca/transaction/${transactionId}/status`);

// Hoặc đợi webhook callback và check file đã ký
const signedFileInfo = await fetch(`/smartca/signed-file/${docId}/info`);
```

### 3. Tải file đã ký

```javascript
const signedFile = await fetch(`/smartca/signed-file/${docId}`);
const blob = await signedFile.blob();
```

## Temporary File Management

### Cache Statistics

```http
GET /smartca/temp-files/stats
```

```json
{
  "totalFiles": 25,
  "expiredFiles": 3,
  "activeFiles": 22
}
```

### File Expiry

- File tạm thời sẽ tự động xóa sau **24 giờ**
- Cleanup tự động chạy mỗi **1 giờ**
- File được lưu cả trong memory cache và filesystem

## Error Handling

### Webhook Validation Errors

```json
{
  "success": false,
  "message": "Invalid webhook data",
  "error": "Invalid sp_id: received_sp_id"
}
```

### File Not Found Errors

```json
{
  "success": false,
  "message": "Signed file not found",
  "error": "No signed file found for doc_id: document-123"
}
```

## Security

### Webhook Security

1. **SP ID Validation**: Webhook chỉ chấp nhận request từ SP ID được cấu hình
2. **Status Code Validation**: Chỉ chấp nhận status_code 200/201
3. **HTTPS Only**: Chỉ chấp nhận webhook qua HTTPS trong production

### File Security

1. **Temporary File Cleanup**: File tạm thời tự động xóa sau 24h
2. **Access Control**: File đã ký chỉ truy cập được qua API endpoint
3. **Path Validation**: Validate đường dẫn file để tránh path traversal

## Monitoring & Logging

### Log Levels

- **INFO**: Webhook received, file processed successfully
- **ERROR**: Webhook validation failed, file processing failed
- **WARN**: File not found, expired file access

### Metrics to Monitor

- Webhook processing time
- File storage usage
- Temporary file cleanup frequency
- Notification delivery rate

## Production Deployment

### 1. Cấu hình URL

Đảm bảo webhook URL accessible từ SmartCA:
```
https://yourdomain.com/smartca/webhook
```

### 2. Storage Setup

```bash
mkdir -p /var/smartca/signed-files
mkdir -p /var/smartca/temp-files
chown -R app:app /var/smartca/
```

### 3. Process Manager

Đảm bảo service chạy liên tục để nhận webhook:
```bash
pm2 start dist/main.js --name smartca-webhook
```

### 4. Load Balancer

Nếu dùng multiple instances, đảm bảo webhook sticky session hoặc shared storage.

## Troubleshooting

### Common Issues

1. **Webhook không nhận được**
   - Kiểm tra firewall/network
   - Verify URL đăng ký tại SmartCA
   - Check logs cho validation errors

2. **File không tái tạo được**
   - Kiểm tra temporary file có tồn tại không
   - Verify signature format
   - Check file permissions

3. **Notification không gửi**
   - Check notification service logs
   - Verify user ID mapping
   - Test notification endpoints

### Debug Commands

```bash
# Check temporary files
ls -la /path/to/temp/files/

# Check signed files
ls -la /path/to/signed/files/

# Check service logs
tail -f logs/smartca-webhook.log
```

## Migration từ Polling sang Webhook

### Bước 1: Deploy webhook code

Deploy version mới với webhook support.

### Bước 2: Test webhook

Test với UAT environment trước.

### Bước 3: Đăng ký webhook URL

Đăng ký URL với SmartCA VNPT.

### Bước 4: Monitor & Verify

Monitor logs và verify file được xử lý đúng.

### Bước 5: Cleanup polling code

Sau khi webhook stable, có thể remove polling logic.

---

## Support

Nếu có vấn đề với webhook integration, check:
1. Server logs
2. SmartCA documentation
3. Network connectivity
4. File permissions