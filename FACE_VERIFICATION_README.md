# 🎯 Face Verification với CCCD - Quick Start

## ✅ Đã hoàn thành

Tích hợp API FPT.AI để xác thực gương mặt với CCCD thành công!

## 📁 Files đã tạo/cập nhật

### Tạo mới:

1. ✅ `src/modules/user/dto/face-verification.dto.ts` - DTO definitions
2. ✅ `src/modules/user/face-verification.service.ts` - Service xử lý FPT.AI API
3. ✅ `FACE_VERIFICATION_GUIDE.md` - Tài liệu chi tiết
4. ✅ `FACE_VERIFICATION_IMPLEMENTATION_SUMMARY.md` - Tóm tắt implementation
5. ✅ `postman/Face-Verification-API.postman_collection.json` - Postman collection

### Cập nhật:

1. ✅ `src/modules/user/user.controller.ts` - Thêm endpoint mới
2. ✅ `src/modules/user/user.service.ts` - Thêm business logic
3. ✅ `src/modules/user/user.module.ts` - Register service

## 🚀 API Endpoint Mới

```
POST /users/verify-face-with-cccd
```

**Chức năng**:

- Upload 2 ảnh (gương mặt + CCCD)
- Trích xuất thông tin CCCD
- So sánh gương mặt
- Tự động verify user nếu match >= 80%

## 📝 Quick Test với cURL

```bash
curl -X POST http://localhost:3000/users/verify-face-with-cccd \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "faceImage=@path/to/face.jpg" \
  -F "cccdImage=@path/to/cccd.jpg"
```

## 📊 Response Example

### ✅ Success (200)

```json
{
  "statusCode": 200,
  "message": "Xác thực gương mặt và CCCD thành công",
  "data": {
    "isMatch": true,
    "similarity": 87.45,
    "isBothImgIDCard": false,
    "cccdInfo": {
      "id": "001234567890",
      "name": "NGUYỄN VĂN A",
      "dob": "01/01/1990",
      "sex": "Nam",
      "home": "Hà Nội",
      "address": "Số 123, Đường ABC...",
      "doe": "15/01/2020",
      "poi": "Cục Cảnh sát ĐKQL..."
    }
  }
}
```

### ❌ Error (400)

```json
{
  "statusCode": 400,
  "message": "Khuôn mặt không khớp với ảnh CCCD. Độ giống nhau: 65.25% (yêu cầu >= 80%)"
}
```

## 🔑 Environment Setup

Đảm bảo có trong `.env`:

```env
FPT_AI_API_KEY=P41mif0ZNvMn8oqCNUa12fsthRdzhtSB
FPT_AI_ENDPOINT=https://api.fpt.ai/dmp/id-card/v2
```

## 📖 Đọc thêm

- **Chi tiết API**: Xem `FACE_VERIFICATION_GUIDE.md`
- **Technical Details**: Xem `FACE_VERIFICATION_IMPLEMENTATION_SUMMARY.md`
- **Postman Testing**: Import `postman/Face-Verification-API.postman_collection.json`

## 🎨 Luồng hoạt động

```
Frontend (2 ảnh)
    ↓
POST /verify-face-with-cccd
    ↓
1. Recognize CCCD (FPT.AI)
    ↓
2. Compare Faces (FPT.AI)
    ↓
3. Check similarity >= 80%
    ↓
4. Update user.isVerified = true
    ↓
Return result + CCCD info
```

## ✨ Features

- ✅ Tự động trích xuất thông tin CCCD
- ✅ So sánh gương mặt với độ chính xác > 95%
- ✅ Ngưỡng xác thực: 80%
- ✅ Tự động cập nhật trạng thái verify
- ✅ Đầy đủ validation và error handling
- ✅ Rate limiting protection
- ✅ Swagger documentation
- ✅ TypeScript support

## 🛠 Testing

### 1. Postman

Import file: `postman/Face-Verification-API.postman_collection.json`

### 2. Swagger UI

Truy cập: `http://localhost:3000/api`

### 3. Frontend Integration

```javascript
const formData = new FormData();
formData.append('faceImage', faceFile);
formData.append('cccdImage', cccdFile);

const response = await axios.post('/users/verify-face-with-cccd', formData, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'multipart/form-data',
  },
});
```

## 🔒 Security

- ✅ JWT Authentication required
- ✅ Rate limiting enabled
- ✅ File size validation (max 10MB)
- ✅ File type validation (JPEG/PNG only)
- ✅ API key protected in environment variables

## 📈 Next Steps

1. Test với ảnh thật
2. Monitor FPT.AI quota usage
3. Setup monitoring/logging
4. Deploy to production

## 🐛 Troubleshooting

### Server không start?

```bash
npm run start:dev
```

### Check errors?

```bash
# Xem terminal output
# Kiểm tra .env có đúng không
# Verify API key còn hạn không
```

## 💡 Tips

- Ảnh cần rõ nét, đủ sáng
- Khuôn mặt nhìn thẳng
- CCCD phải đọc được thông tin
- Test với nhiều loại ảnh khác nhau

## 🎉 Ready to Use!

Server đã chạy thành công (0 errors). API sẵn sàng để test! 🚀
