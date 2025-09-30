# Hệ Thống Tự Động Hóa RentHome

## Tổng Quan

Hệ thống tự động hóa của RentHome được thiết kế để tăng tính minh bạch và độ tin cậy trong quản lý thuê nhà. Hệ thống bao gồm:

- **Tự động thông báo** trước 7, 3, 1 ngày
- **Tự động áp dụng phạt** sau 3 ngày quá hạn 
- **Tích hợp blockchain** cho tính minh bạch
- **Dashboard monitoring** để theo dõi

## Kiến Trúc

```
/src/cron/              # Cron jobs (định nghĩa lịch chạy)
├── payment-reminder.cron.ts
├── contract-management.cron.ts
├── system-maintenance.cron.ts
└── cron.module.ts

/src/modules/penalty/   # Business logic xử lý phạt
├── automated-penalty.service.ts
└── penalty.module.ts

/src/modules/automation/ # Monitoring & logging
├── automation-event-logging.service.ts
├── automation-monitoring.controller.ts
└── automation-monitoring.module.ts
```

## Các Tính Năng Tự Động

### 1. Payment Reminders 📨

**Lịch chạy:** Mỗi giờ
**Chức năng:**
- Gửi thông báo trước 7 ngày về hạn thanh toán
- Gửi thông báo trước 3 ngày
- Gửi thông báo trước 1 ngày
- Nhắc nhở nộp tiền cọc (12 giờ trước hạn)

**API Endpoint:**
```bash
GET /automation/events?eventType=PAYMENT_REMINDER_SENT
```

### 2. Penalty System ⚠️

**Lịch chạy:** Mỗi 6 giờ
**Chức năng:**
- Kiểm tra thanh toán quá hạn >= 3 ngày
- Tự động áp dụng phạt theo quy định
- Tích hợp blockchain ghi nhận minh bạch
- Thông báo cho tenant và landlord

**Cách tính phạt:**
- Tuần 1: 1%/ngày
- Tuần 2: 2%/ngày  
- Tuần 3-4: 3%/ngày
- Sau 1 tháng: 5%/ngày

### 3. Contract Management 📋

**Lịch chạy:** Hàng ngày lúc 9h sáng
**Chức năng:**
- Nhắc nhở hết hạn hợp đồng (30, 14, 7, 1 ngày trước)
- Lịch bảo trì định kỳ (cuối tháng)
- Tự động cập nhật trạng thái hợp đồng hết hạn

### 4. System Maintenance 🧹

**Lịch chạy:** Hàng ngày lúc 2h sáng
**Chức năng:**
- Cleanup thông báo cũ (>30 ngày)
- Archive booking đã hoàn thành (>90 ngày)
- Cập nhật trạng thái hợp đồng
- Health check hệ thống

## API Endpoints

### Dashboard & Monitoring

```bash
# Dashboard tổng quan
GET /automation/dashboard?days=7

# Lịch sử events với filter
GET /automation/events?eventType=PENALTY_APPLIED&status=SUCCESS&limit=50

# Thống kê automation
GET /automation/stats?days=30

# Báo cáo minh bạch
GET /automation/transparency-report?days=30

# Health check hệ thống
GET /automation/health

# Visualization flow
GET /automation/flow?days=7
```

### Response Examples

**Dashboard Response:**
```json
{
  "period": "7 days",
  "stats": {
    "totalEvents": 145,
    "successRate": 97.24,
    "eventsByType": {
      "PAYMENT_REMINDER_SENT": 45,
      "PENALTY_APPLIED": 3,
      "CONTRACT_EXPIRY_REMINDER": 12
    },
    "averageExecutionTime": 234.5
  },
  "transparencyReport": {
    "systemReliability": "Excellent",
    "recommendations": []
  }
}
```

**Health Check Response:**
```json
{
  "status": "healthy",
  "successRate": 97.24,
  "recentFailures": 0,
  "details": {
    "automationActive": true,
    "cronJobsRunning": true,
    "databaseConnected": true,
    "blockchainConnected": true
  }
}
```

## Tính Năng Minh Bạch

### 1. Event Logging
- Mọi hành động tự động đều được ghi log
- Thời gian thực thi, kết quả, lỗi (nếu có)
- Metadata chi tiết cho audit trail

### 2. Transparency Report
- Tỷ lệ thành công của hệ thống
- Thống kê các loại event
- Khuyến nghị cải thiện
- Timeline visualization

### 3. Blockchain Integration
- Ghi nhận penalty lên blockchain
- Smart contract validation
- Immutable audit trail

## Cấu Hình Cron Jobs

### Payment Reminder
```typescript
@Cron(CronExpression.EVERY_HOUR)
async sendPaymentReminders(): Promise<void>
```

### Overdue Check  
```typescript
@Cron('0 */6 * * *') // Mỗi 6 tiếng
async processOverduePayments(): Promise<void>
```

### Daily Cleanup
```typescript
@Cron('0 2 * * *') // 2:00 AM hàng ngày
async dailyCleanup(): Promise<void>
```

### Contract Expiry
```typescript
@Cron('0 9 * * *') // 9:00 AM hàng ngày  
async checkContractExpiry(): Promise<void>
```

## Cách Sử Dụng

### 1. Khởi động hệ thống
Cron jobs sẽ tự động chạy khi start server:

```bash
npm run start:dev
```

### 2. Monitoring Dashboard
Truy cập dashboard để theo dõi:
```
http://localhost:3000/automation/dashboard
```

### 3. Kiểm tra logs
```bash
# Xem logs automation
GET /automation/events

# Xem events thất bại
GET /automation/events?status=FAILED
```

### 4. Health Check
```bash
GET /automation/health
```

## Lợi Ích

### 1. Tự Động Hóa 🤖
- Giảm thiểu can thiệp thủ công
- Xử lý nhất quán theo quy trình
- Tiết kiệm thời gian vận hành

### 2. Minh Bạch 🔍  
- Mọi hành động đều có audit trail
- Dashboard realtime monitoring
- Báo cáo định kỳ chi tiết

### 3. Độ Tin Cậy 💯
- Không bỏ sót thông báo quan trọng
- Áp dụng phạt công bằng, nhất quán
- Tích hợp blockchain immutable

### 4. Khả Năng Mở Rộng 📈
- Dễ dàng thêm automation rules mới
- Flexible scheduling với cron
- Modular architecture

## Troubleshooting

### Lỗi thường gặp:

1. **Cron jobs không chạy**
   - Kiểm tra ScheduleModule có được import
   - Xem logs để debug

2. **Blockchain integration lỗi**  
   - Kiểm tra connection blockchain
   - Verify smart contract address

3. **Performance issues**
   - Monitor execution time qua dashboard
   - Optimize database queries
   - Add pagination cho large datasets

### Debug commands:
```bash
# Check health
curl http://localhost:3000/automation/health

# View recent failures  
curl http://localhost:3000/automation/events?status=FAILED&limit=10

# Get system stats
curl http://localhost:3000/automation/stats?days=1
```

---

Hệ thống được thiết kế để đảm bảo tính minh bạch tối đa và độ tin cậy cao trong quản lý thuê nhà tự động.