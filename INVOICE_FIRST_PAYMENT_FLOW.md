# 📋 Invoice-First Payment Flow Implementation

## 🎯 **Thay đổi luồng thanh toán**

### 🔄 **Luồng cũ:**
```
Tenant tạo payment trực tiếp → Tạo invoice sau khi thanh toán thành công
```

### 🔄 **Luồng mới:**
```
Dual escrow funded → Auto tạo invoice → Tenant thấy invoice → Thanh toán invoice
```

## ✅ **Triển khai chi tiết:**

### 1. **📅 Tự động tạo invoice khi dual escrow funded**
**File:** `src/modules/booking/booking.service.ts`
- **Method:** `createFirstMonthRentInvoice()`
- **Trigger:** `maybeMarkDualEscrowFunded()` 
- **Logic:** 
  - Kiểm tra contract có property và monthly rent
  - Tạo invoice với due date = firstRentDueAt
  - Item description = "First month rent payment"
  - Status = PENDING (chờ thanh toán)

### 2. **🔍 API lấy invoice chưa thanh toán**
**File:** `src/modules/invoice/invoice.controller.ts` & `invoice.service.ts`
- **Endpoint:** `GET /invoices/pending/user/:userId`
- **Purpose:** FE lấy danh sách invoice cần thanh toán
- **Response:** Invoice[] có status PENDING của user

### 3. **💰 API thanh toán từ invoice**
**File:** `src/modules/payment/payment.controller.ts` & `payment.service.ts`
- **Endpoint:** `POST /payments/invoice/:invoiceId`
- **Method:** `createPaymentFromInvoice()`
- **Logic:**
  - Load invoice và validate (PENDING, authorized user)
  - Detect payment purpose từ invoice description
  - Tạo payment với existing logic
  - Auto link payment với invoice khi thành công

### 4. **🔗 Cập nhật payment linking**
**File:** `src/modules/payment/payment.service.ts`
- **Method:** `linkPaymentWithInvoice()`  
- **Support:** Cả FIRST_MONTH_RENT và MONTHLY_RENT
- **Logic:** Match invoice theo description keywords

## 🔄 **Flow hoạt động mới:**

### **Phase 1: Invoice Creation**
```
Tenant deposit funded ✅
        ↓
Landlord deposit funded ✅  
        ↓
maybeMarkDualEscrowFunded()
        ↓
createFirstMonthRentInvoice()
        ↓
Invoice PENDING created 📋
```

### **Phase 2: Frontend Display**
```
GET /invoices/pending/user/:userId
        ↓
Display pending invoices to tenant 📱
        ↓
Tenant selects invoice to pay 👆
```

### **Phase 3: Payment Process**
```
POST /payments/invoice/:invoiceId { method: "VNPAY" }
        ↓
createPaymentFromInvoice()
        ↓
createPayment() [existing logic]
        ↓
Payment PAID → linkPaymentWithInvoice()
        ↓
Invoice status = PAID ✅
```

## 📁 **Files Modified:**

### **🏠 Booking Module:**
- `booking.service.ts` - Added invoice creation logic
- `booking.module.ts` - Added InvoiceModule import

### **📋 Invoice Module:**
- `invoice.service.ts` - Added `findPendingByUser()`
- `invoice.controller.ts` - Added pending invoices endpoint

### **💰 Payment Module:**
- `payment.service.ts` - Added `createPaymentFromInvoice()`, updated linking logic
- `payment.controller.ts` - Added invoice payment endpoint

## 🎉 **Benefits:**

### **✅ For Frontend:**
- Clear invoice list before payment
- Invoice-driven payment flow
- Better UX with payment context

### **✅ For Backend:**
- Proper audit trail (Invoice → Payment)
- Consistent data flow
- Separation of concerns

### **✅ For Business:**
- Invoice-first approach matches accounting practices
- Clear payment obligations
- Better financial tracking

## 🧪 **Testing Flow:**

1. **Setup:** Create booking, both parties deposit
2. **Verify:** Invoice auto-created with PENDING status
3. **API Test:** GET pending invoices returns the invoice
4. **Payment:** POST payment with invoice ID creates payment
5. **Verify:** Invoice status updates to PAID, payment linked

## 🔄 **Backwards Compatibility:**
- Existing direct payment creation still works
- Existing payments won't be affected  
- Migration path: existing invoices can be paid via new flow