# Hướng Dẫn Sử Dụng API Điền Thông Tin PDF

## Tổng Quan

Đã tạo 2 API endpoint mới trong module Contract để test chức năng điền thông tin vào file PDF template (`hopdongthue-template.pdf`):

### 1. **Lấy danh sách fields trong template**

**GET** `/contracts/test/template-fields`

API này giúp bạn kiểm tra xem file PDF template có những field nào.

**Response:**

```json
{
  "statusCode": 200,
  "message": "SUCCESS",
  "data": {
    "fields": [
      "landlord_name",
      "tenant_name",
      "landlord_cccd",
      "tenant_cccd",
      "property_address",
      "rent_amount",
      "start_date",
      "end_date"
    ]
  }
}
```

### 2. **Test điền thông tin vào PDF**

**POST** `/contracts/test/fill-pdf`

API này nhận thông tin và trả về file PDF đã được điền thông tin.

**Request Body:**

```json
{
  "landlord_name": "Nguyễn Văn A",
  "tenant_name": "Trần Thị B",
  "landlord_cccd": "001234567890",
  "tenant_cccd": "009876543210",
  "property_address": "123 Đường ABC, Quận 1, TP.HCM",
  "rent_amount": "5.000.000 VNĐ",
  "start_date": "01/01/2025",
  "end_date": "31/12/2025"
}
```

**Required Fields:**

- `landlord_name`: Tên chủ nhà
- `tenant_name`: Tên người thuê
- `landlord_cccd`: CCCD chủ nhà
- `tenant_cccd`: CCCD người thuê

**Optional Fields:**

- `property_address`: Địa chỉ bất động sản
- `rent_amount`: Giá thuê hàng tháng
- `start_date`: Ngày bắt đầu
- `end_date`: Ngày kết thúc

**Response:**

- Content-Type: `application/pdf`
- File PDF được download với tên `contract-filled.pdf`

## Cách Test

### Sử dụng Swagger UI:

1. Khởi động server: `npm run start:dev`
2. Truy cập Swagger UI: `http://localhost:3000/api`
3. Tìm section **contracts**
4. Thử nghiệm 2 endpoint:
   - `GET /contracts/test/template-fields` - Xem danh sách fields
   - `POST /contracts/test/fill-pdf` - Điền và download PDF

### Sử dụng cURL:

**1. Lấy danh sách fields:**

```bash
curl -X GET http://localhost:3000/contracts/test/template-fields
```

**2. Điền thông tin vào PDF:**

```bash
curl -X POST http://localhost:3000/contracts/test/fill-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "landlord_name": "Nguyễn Văn A",
    "tenant_name": "Trần Thị B",
    "landlord_cccd": "001234567890",
    "tenant_cccd": "009876543210",
    "property_address": "123 Đường ABC, Quận 1, TP.HCM",
    "rent_amount": "5.000.000 VNĐ",
    "start_date": "01/01/2025",
    "end_date": "31/12/2025"
  }' \
  --output contract-filled.pdf
```

### Sử dụng Postman:

1. **GET request** đến `http://localhost:3000/contracts/test/template-fields`

2. **POST request** đến `http://localhost:3000/contracts/test/fill-pdf`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "landlord_name": "Nguyễn Văn A",
     "tenant_name": "Trần Thị B",
     "landlord_cccd": "001234567890",
     "tenant_cccd": "009876543210",
     "property_address": "123 Đường ABC, Quận 1, TP.HCM",
     "rent_amount": "5.000.000 VNĐ",
     "start_date": "01/01/2025",
     "end_date": "31/12/2025"
   }
   ```

   - Click "Send and Download" để lưu file PDF

## Kỹ Thuật Sử Dụng

### 1. Chuẩn bị PDF Template

File PDF template (`hopdongthue-template.pdf`) cần có các **form fields** được định nghĩa trước. Bạn có thể tạo bằng:

- **Adobe Acrobat Pro**: Tools → Prepare Form
- **PDF-XChange Editor**: Forms → Add Text Field
- **LibreOffice Writer**: Export as PDF with form fields

Tên các field trong PDF phải khớp với tên trong request body.

### 2. Code Implementation

**Service (`pdf-fill.service.ts`):**

- Sử dụng thư viện `pdf-lib` để đọc và điền form
- Load PDF template từ `src/assets/contracts/hopdongthue-template.pdf`
- Điền giá trị vào các `PDFTextField`
- Trả về Buffer của PDF đã điền

**Controller (`contract.controller.ts`):**

- Nhận request với thông tin cần điền
- Gọi service để xử lý PDF
- Trả về file PDF dưới dạng download

**DTO (`test-fill-pdf.dto.ts`):**

- Validation cho input data
- Swagger documentation cho API

## Files Đã Tạo/Sửa

### Files Mới:

1. `src/modules/contract/dto/test-fill-pdf.dto.ts` - DTO cho test API
2. `src/modules/contract/pdf-fill.service.ts` - Service xử lý PDF

### Files Đã Sửa:

1. `src/modules/contract/contract.module.ts` - Thêm PdfFillService vào providers
2. `src/modules/contract/contract.controller.ts` - Thêm 2 endpoint test

## Lưu Ý Quan Trọng

### 1. Field Names

Tên field trong PDF template **PHẢI KHỚP CHÍNH XÁC** với tên trong request. Ví dụ:

- PDF field: `landlord_name`
- Request: `"landlord_name": "Nguyễn Văn A"` ✅

### 2. Field Types

Hiện tại chỉ hỗ trợ **Text Fields**. Các loại field khác (checkbox, radio, dropdown) cần xử lý riêng.

### 3. Font Support

- Nếu sử dụng tiếng Việt có dấu, PDF template cần embed font hỗ trợ Unicode
- Hoặc có thể dùng `pdf-lib` để embed custom font

### 4. Production Use

Đây là **test API**, không có authentication. Khi deploy production:

- Thêm `@UseGuards(JwtAuthGuard, RolesGuard)`
- Thêm validation và security checks
- Upload file lên S3 thay vì trả trực tiếp
- Rate limiting để tránh abuse

## Mở Rộng Trong Tương Lai

### 1. Tích hợp với Contract thực

```typescript
// Trong contract.service.ts
async generateContractPdf(contractId: string): Promise<Buffer> {
  const contract = await this.findRawById(contractId);

  const fieldValues = {
    landlord_name: contract.landlord.fullName,
    tenant_name: contract.tenant.fullName,
    landlord_cccd: contract.landlord.cccd,
    tenant_cccd: contract.tenant.cccd,
    property_address: contract.property.address,
    rent_amount: contract.room?.roomType?.price || contract.property.price,
    start_date: formatVN(contract.startDate, 'dd/MM/yyyy'),
    end_date: formatVN(contract.endDate, 'dd/MM/yyyy'),
  };

  return this.pdfFillService.fillPdfTemplate(fieldValues);
}
```

### 2. Thêm Custom Font

```typescript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Load custom font
pdfDoc.registerFontkit(fontkit);
const fontBytes = fs.readFileSync('path/to/unicode-font.ttf');
const customFont = await pdfDoc.embedFont(fontBytes);

// Sử dụng font cho field
field.setFont(customFont);
```

### 3. Flatten PDF (không cho edit sau khi điền)

```typescript
// Trong pdf-fill.service.ts
form.flatten(); // Thêm dòng này trước khi save
const pdfBytes = await pdfDoc.save();
```

## Troubleshooting

### Lỗi "Field not found"

- Kiểm tra tên field trong PDF có khớp với request không
- Dùng endpoint `/test/template-fields` để xem danh sách field thực tế

### Không điền được tiếng Việt

- Kiểm tra font trong PDF template
- Thử embed custom font hỗ trợ Unicode

### File PDF trả về bị lỗi

- Kiểm tra log để xem error message
- Verify file template còn nguyên vẹn
- Test với Adobe Reader, không phải browser viewer

## Tài Liệu Tham Khảo

- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [pdf-lib GitHub](https://github.com/Hopding/pdf-lib)
- [PDF Form Fields Specification](https://www.adobe.com/devnet/pdf/pdf_reference.html)
