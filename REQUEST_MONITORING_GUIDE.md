# 📊 Request Monitoring & Statistics Guide

## Tổng quan

Hệ thống đã được tích hợp công cụ theo dõi và đo đếm số lượng request tự động.

---

## 🎯 Các tính năng

### 1. **Tự động đếm request**

- ✅ Đếm tổng số request
- ✅ Đếm theo HTTP method (GET, POST, PUT, DELETE, ...)
- ✅ Đếm theo endpoint cụ thể
- ✅ Theo dõi số request mỗi phút
- ✅ Tính trung bình request/phút
- ✅ Lưu lịch sử 60 phút gần nhất

### 2. **Logging tự động**

- ✅ Log mỗi phút với số lượng request
- ✅ Log chi tiết mỗi 5 phút
- ✅ Hiển thị response time cho mỗi request
- ✅ Hiển thị status code với emoji trực quan
- ✅ Top endpoints được sử dụng nhiều nhất

### 3. **REST API để xem thống kê**

- ✅ Endpoint để lấy thống kê real-time
- ✅ Endpoint để reset thống kê
- ✅ Public API (không cần authentication)

---

## 📡 API Endpoints

### 1. Lấy thống kê request

```http
GET /api/stats/requests
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "SUCCESS",
  "data": {
    "total": 15234,
    "currentMinute": 42,
    "averagePerMinute": 127,
    "byMethod": {
      "GET": 8932,
      "POST": 4521,
      "PUT": 1234,
      "DELETE": 547
    },
    "topEndpoints": [
      { "endpoint": "/api/properties/filter-with-url", "count": 2341 },
      { "endpoint": "/api/users/profile", "count": 1823 },
      { "endpoint": "/api/contracts", "count": 1456 },
      { "endpoint": "/api/payments", "count": 987 },
      { "endpoint": "/api/bookings", "count": 765 }
    ],
    "lastResetTime": "2025-11-10T10:30:00.000Z",
    "minuteHistory": [125, 130, 128, 135, 142, ...]
  }
}
```

### 2. Reset thống kê

```http
POST /api/stats/requests/reset
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Request statistics have been reset"
}
```

---

## 🔍 Xem logs trong Console

### Log mỗi phút:

```
[RequestCounterService] 📊 Requests in last minute: 142 | Total: 15234
```

### Log chi tiết mỗi 5 phút:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REQUEST STATISTICS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests: 15234
Average per minute: 127
Current minute: 42

📈 By Method:
  GET: 8932
  POST: 4521
  PUT: 1234
  DELETE: 547

🔥 Top 5 Endpoints:
  1. /api/properties/filter-with-url: 2341
  2. /api/users/profile: 1823
  3. /api/contracts: 1456
  4. /api/payments: 987
  5. /api/bookings: 765
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Log mỗi request:

```
[GET] /api/properties/filter-with-url
✅ [GET] /api/properties/filter-with-url - 200 - 45ms

[POST] /api/auth/login
✅ [POST] /api/auth/login - 200 - 123ms

[GET] /api/contracts/invalid-id
⚠️ [GET] /api/contracts/invalid-id - 404 - 12ms

[POST] /api/payments/process
❌ [POST] /api/payments/process - 500 - 234ms
```

---

## 🔥 Các use case thực tế

### 1. **Kiểm tra load hệ thống**

```bash
curl http://localhost:3000/api/stats/requests
```

### 2. **Monitor trong Postman**

- Import endpoint vào Postman
- Set interval để auto-refresh mỗi 30 giây
- Xem real-time stats

### 3. **Debug performance**

- Xem endpoint nào nhận nhiều request nhất
- Xem average response time
- Phát hiện bottleneck

### 4. **Test rate limiting**

- Reset stats trước khi test
- Gửi nhiều request
- Xem số lượng request trước khi bị block

### 5. **Monitor production**

- Xem logs trong terminal/PM2
- Track số lượng request theo thời gian
- Phát hiện traffic spike

---

## 🛠️ Tùy chỉnh

### Thay đổi interval log:

File: `src/common/middleware/request-counter.service.ts`

```typescript
// Thay đổi interval log mỗi phút (hiện tại: 60000ms)
setInterval(() => {
  // ...
}, 60000);

// Thay đổi interval log chi tiết (hiện tại: 5 phút)
setInterval(() => {
  this.logDetailedStats();
}, 300000); // 5 minutes -> có thể đổi thành 600000 (10 phút)
```

### Thay đổi số endpoint hiển thị:

```typescript
// Trong logDetailedStats()
const topEndpoints = this.getTopEndpoints(10); // Đổi 5 -> 10 để xem nhiều hơn
```

### Thay đổi thời gian lưu history:

```typescript
// Giữ lại 60 phút -> có thể đổi thành 120 phút (2 giờ)
if (this.stats.perMinute.length > 120) {
  this.stats.perMinute.shift();
}
```

---

## 📊 Kết hợp với monitoring tools

### 1. **Prometheus + Grafana** (Professional)

- Export metrics từ `RequestCounterService`
- Tạo dashboard trong Grafana
- Alert khi vượt threshold

### 2. **PM2 Monitoring**

```bash
pm2 start npm --name "renthome-be" -- run start:prod
pm2 monit
```

### 3. **New Relic / DataDog**

- Tích hợp APM
- Auto-detect performance issues

---

## ⚡ Performance Impact

- **Memory**: ~5-10MB để lưu stats
- **CPU**: Minimal (~0.1%)
- **Overhead per request**: < 1ms

---

## 🎯 Next Steps

### Nâng cao hơn:

1. ✅ Export to Prometheus format
2. ✅ Add WebSocket để push real-time stats
3. ✅ Tạo admin dashboard để visualize
4. ✅ Alert khi vượt threshold
5. ✅ Track response time distribution
6. ✅ Track error rate

---

## 🚀 Testing

### Test đếm request:

```bash
# Gửi 100 requests
for i in {1..100}; do curl http://localhost:3000/api/properties; done

# Xem stats
curl http://localhost:3000/api/stats/requests
```

### Test với Apache Bench:

```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/api/properties

# Xem stats sau
curl http://localhost:3000/api/stats/requests
```

---

## 📝 Notes

- Stats được lưu trong memory, sẽ reset khi restart server
- Nếu muốn persistent, cần lưu vào database
- Public endpoint - cân nhắc bảo mật nếu production
