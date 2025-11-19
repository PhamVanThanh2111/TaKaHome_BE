# Hướng dẫn API Xác thực Gương mặt với CCCD

## Tổng quan

API này cho phép xác thực danh tính người dùng bằng cách so sánh gương mặt trong ảnh chân dung với ảnh trong CCCD/CMND. Hệ thống sử dụng FPT.AI để:

1. Trích xuất thông tin từ ảnh CCCD
2. So sánh gương mặt giữa 2 ảnh
3. Tự động cập nhật trạng thái xác thực nếu thành công

## Endpoints

### 1. Xác thực gương mặt với CCCD (Recommended)

**POST** `/users/verify-face-with-cccd`

#### Mô tả

API kết hợp xác thực CCCD và so sánh gương mặt trong một lần gọi. Đây là cách được khuyến nghị để xác thực người dùng.

#### Luồng xử lý

1. Frontend upload 2 ảnh: `faceImage` (ảnh gương mặt) và `cccdImage` (ảnh CCCD)
2. Backend trích xuất thông tin từ ảnh CCCD
3. Backend gọi API FPT.AI để so sánh 2 gương mặt
4. Nếu độ giống >= 80%: Cập nhật CCCD và `isVerified = true` cho user
5. Trả về kết quả chi tiết

#### Headers

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

#### Request Body (multipart/form-data)

| Field     | Type | Required | Description                                   |
| --------- | ---- | -------- | --------------------------------------------- |
| faceImage | File | Yes      | Ảnh gương mặt người dùng (JPEG/PNG, max 10MB) |
| cccdImage | File | Yes      | Ảnh CCCD/CMND (JPEG/PNG, max 10MB)            |

#### Response Success (200)

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
      "address": "Số 123, Đường ABC, Phường XYZ, Quận DEF, Hà Nội",
      "doe": "15/01/2020",
      "poi": "Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư"
    }
  }
}
```

#### Response Error (400)

```json
{
  "statusCode": 400,
  "message": "Khuôn mặt không khớp với ảnh CCCD. Độ giống nhau: 65.25% (yêu cầu >= 80%)"
}
```

#### Mã lỗi FPT.AI

| Code | Description                                              |
| ---- | -------------------------------------------------------- |
| 200  | Thành công                                               |
| 407  | Không nhận dạng được khuôn mặt trong một hoặc cả hai ảnh |
| 408  | Ảnh đầu vào không đúng định dạng                         |
| 409  | Có nhiều hoặc ít hơn 2 khuôn mặt cần xác thực            |

### 2. Chỉ nhận dạng CCCD (Legacy)

**POST** `/users/recognize-cccd`

Endpoint này chỉ trích xuất thông tin từ ảnh CCCD mà không so sánh gương mặt.

## Độ chính xác

- **Độ chính xác trung bình**: > 95.4% (với ảnh đạt chuẩn đầu vào)
- **Ngưỡng xác thực**: 80% (isMatch = true khi similarity >= 80%)

## Yêu cầu ảnh đầu vào

### Ảnh gương mặt (faceImage)

- Định dạng: JPEG, PNG
- Kích thước: Tối đa 10MB
- Nội dung:
  - Phải có 1 khuôn mặt rõ ràng
  - Khuôn mặt nhìn thẳng
  - Ánh sáng tốt, không bị mờ
  - Không đeo khẩu trang hoặc kính đen

### Ảnh CCCD (cccdImage)

- Định dạng: JPEG, PNG
- Kích thước: Tối đa 10MB
- Nội dung:
  - Ảnh CCCD/CMND rõ ràng
  - Không bị mờ, không bị che khuất
  - Có đầy đủ thông tin trên thẻ

## Rate Limiting

- Endpoint sử dụng `@Throttle({ verification: {} })`
- Giới hạn số lượng request để tránh spam

## Ví dụ sử dụng

### cURL

```bash
curl -X POST https://your-api.com/users/verify-face-with-cccd \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "faceImage=@/path/to/face.jpg" \
  -F "cccdImage=@/path/to/cccd.jpg"
```

### JavaScript (Axios)

```javascript
const formData = new FormData();
formData.append('faceImage', faceImageFile);
formData.append('cccdImage', cccdImageFile);

const response = await axios.post(
  'https://your-api.com/users/verify-face-with-cccd',
  formData,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  },
);

console.log('Verification result:', response.data);
```

### React Example

```javascript
import React, { useState } from 'react';
import axios from 'axios';

function FaceVerification() {
  const [faceImage, setFaceImage] = useState(null);
  const [cccdImage, setCccdImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!faceImage || !cccdImage) {
      alert('Vui lòng chọn cả 2 ảnh');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('faceImage', faceImage);
    formData.append('cccdImage', cccdImage);

    try {
      const response = await axios.post(
        '/users/verify-face-with-cccd',
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setResult(response.data);

      if (response.data.data.isMatch) {
        alert('Xác thực thành công!');
      } else {
        alert(`Xác thực thất bại. Độ giống: ${response.data.data.similarity}%`);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Xác thực gương mặt với CCCD</h2>

      <div>
        <label>Ảnh gương mặt:</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setFaceImage(e.target.files[0])}
        />
      </div>

      <div>
        <label>Ảnh CCCD:</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setCccdImage(e.target.files[0])}
        />
      </div>

      <button onClick={handleVerify} disabled={loading}>
        {loading ? 'Đang xác thực...' : 'Xác thực'}
      </button>

      {result && (
        <div>
          <h3>Kết quả:</h3>
          <p>Khớp: {result.data.isMatch ? 'Có' : 'Không'}</p>
          <p>Độ giống: {result.data.similarity.toFixed(2)}%</p>
          <p>CCCD: {result.data.cccdInfo.id}</p>
          <p>Họ tên: {result.data.cccdInfo.name}</p>
        </div>
      )}
    </div>
  );
}

export default FaceVerification;
```

## Xử lý lỗi

### Client-side validation

```javascript
function validateImages(faceImage, cccdImage) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png'];

  // Check face image
  if (!faceImage) {
    throw new Error('Vui lòng chọn ảnh gương mặt');
  }
  if (faceImage.size > maxSize) {
    throw new Error('Ảnh gương mặt quá lớn (max 10MB)');
  }
  if (!allowedTypes.includes(faceImage.type)) {
    throw new Error('Ảnh gương mặt phải là JPEG hoặc PNG');
  }

  // Check CCCD image
  if (!cccdImage) {
    throw new Error('Vui lòng chọn ảnh CCCD');
  }
  if (cccdImage.size > maxSize) {
    throw new Error('Ảnh CCCD quá lớn (max 10MB)');
  }
  if (!allowedTypes.includes(cccdImage.type)) {
    throw new Error('Ảnh CCCD phải là JPEG hoặc PNG');
  }

  return true;
}
```

### Error handling

```javascript
try {
  const response = await verifyFace(faceImage, cccdImage);
  // Handle success
} catch (error) {
  if (error.response?.status === 400) {
    const message = error.response.data.message;

    if (message.includes('không khớp')) {
      // Face doesn't match
      showError('Gương mặt không khớp với CCCD');
    } else if (message.includes('407')) {
      // Face not detected
      showError('Không phát hiện được khuôn mặt trong ảnh');
    } else if (message.includes('408')) {
      // Invalid format
      showError('Định dạng ảnh không hợp lệ');
    } else if (message.includes('409')) {
      // Wrong number of faces
      showError('Ảnh phải chứa đúng 1 khuôn mặt');
    }
  } else if (error.response?.status === 429) {
    showError('Quá nhiều yêu cầu. Vui lòng thử lại sau');
  } else {
    showError('Có lỗi xảy ra. Vui lòng thử lại');
  }
}
```

## Lưu ý bảo mật

1. **JWT Token**: Luôn gửi JWT token trong header `Authorization`
2. **HTTPS**: API nên được gọi qua HTTPS để bảo vệ dữ liệu ảnh
3. **Rate Limiting**: Có giới hạn số lượng request để tránh abuse
4. **File Size**: Giới hạn kích thước file để tránh DoS
5. **API Key**: FPT.AI API key được bảo vệ trong environment variables

## Môi trường

Cần cấu hình trong `.env`:

```
FPT_AI_API_KEY=your_api_key_here
FPT_AI_ENDPOINT=https://api.fpt.ai/dmp/id-card/v2
```

## Luồng xác thực trong ứng dụng

```
┌─────────────┐
│   Frontend  │
│   (User)    │
└──────┬──────┘
       │
       │ 1. Upload faceImage + cccdImage
       │
       v
┌──────────────────┐
│   POST /verify   │
│  -face-with-cccd │
└─────┬────────────┘
      │
      │ 2. Recognize CCCD
      v
┌──────────────────┐
│   FPT.AI CCCD    │
│   Recognition    │
└─────┬────────────┘
      │ CCCD Info
      │
      │ 3. Verify Face
      v
┌──────────────────┐
│   FPT.AI Face    │
│   Verification   │
└─────┬────────────┘
      │ Similarity: 87%
      │
      │ 4. isMatch >= 80%?
      v
┌──────────────────┐
│  Update User     │
│  isVerified=true │
└─────┬────────────┘
      │
      │ 5. Return Result
      v
┌──────────────────┐
│   Frontend       │
│   Show Success   │
└──────────────────┘
```

## Testing

### Postman Collection

Import collection từ file `postman/` để test API nhanh chóng.

### Unit Tests

```bash
npm run test -- user.controller.spec.ts
npm run test -- face-verification.service.spec.ts
```

## Troubleshooting

### Lỗi: "Không nhận dạng được khuôn mặt"

- Kiểm tra chất lượng ảnh
- Đảm bảo khuôn mặt rõ ràng, không bị che khuất
- Thử với ảnh khác có ánh sáng tốt hơn

### Lỗi: "Khuôn mặt không khớp"

- Kiểm tra xem đúng người chưa
- Đảm bảo ảnh CCCD là của chính người đó
- Similarity < 80% nghĩa là 2 ảnh không đủ giống

### Lỗi: "FPT.AI Authentication failed"

- Kiểm tra API key trong `.env`
- Đảm bảo API key còn hạn sử dụng
- Kiểm tra quota của API key

## Support

Nếu có vấn đề, vui lòng:

1. Kiểm tra logs trong console
2. Xem lại format ảnh đầu vào
3. Contact: support@yourcompany.com
