# 🧪 Request Monitoring - Quick Test Examples

## Test nhanh sau khi khởi động server

### 1. Xem thống kê hiện tại

```bash
curl http://localhost:3000/api/stats/requests
```

Hoặc mở browser: `http://localhost:3000/api/stats/requests`

---

### 2. Gửi vài requests để test

```bash
# Gửi 10 requests
for i in {1..10}; do
  curl http://localhost:3000/api/properties
  echo "Request $i sent"
done
```

---

### 3. Xem stats sau khi gửi requests

```bash
curl http://localhost:3000/api/stats/requests | jq
```

Expected output:

```json
{
  "statusCode": 200,
  "message": "SUCCESS",
  "data": {
    "total": 10,
    "currentMinute": 10,
    "averagePerMinute": 10,
    "byMethod": {
      "GET": 10
    },
    "topEndpoints": [
      {
        "endpoint": "/api/properties",
        "count": 10
      }
    ],
    "lastResetTime": "2025-11-10T...",
    "minuteHistory": [10]
  }
}
```

---

### 4. Test với nhiều endpoints khác nhau

```bash
# Mix requests
curl http://localhost:3000/api/properties
curl http://localhost:3000/api/users/profile
curl http://localhost:3000/api/contracts
curl http://localhost:3000/api/bookings

# Xem stats
curl http://localhost:3000/api/stats/requests
```

---

### 5. Reset statistics

```bash
curl -X POST http://localhost:3000/api/stats/requests/reset
```

---

### 6. Test rate limiting với chatbot

```bash
# Gửi 20 requests liên tiếp (limit là 5/phút cho chatbot)
for i in {1..20}; do
  curl -X POST http://localhost:3000/chatbot/message \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello"}'
done

# Xem stats
curl http://localhost:3000/api/stats/requests
```

---

### 7. Load test với Apache Bench (nếu có cài)

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/api/properties

# Xem kết quả
curl http://localhost:3000/api/stats/requests | jq '.data.total'
```

---

### 8. Continuous monitoring (mỗi 5 giây)

```bash
# Linux/Mac
watch -n 5 'curl -s http://localhost:3000/api/stats/requests | jq ".data.currentMinute"'

# Windows PowerShell
while($true) {
  $response = Invoke-RestMethod -Uri "http://localhost:3000/api/stats/requests"
  Write-Host "Current minute: $($response.data.currentMinute) | Total: $($response.data.total)"
  Start-Sleep -Seconds 5
}
```

---

### 9. Xem logs trong terminal

Chỉ cần nhìn vào console khi server đang chạy:

```
[RequestCounterService] 📊 Requests in last minute: 42 | Total: 156
✅ [GET] /api/properties - 200 - 45ms
✅ [POST] /api/auth/login - 200 - 123ms
⚠️ [GET] /api/contracts/invalid - 404 - 12ms
```

---

### 10. Test với Postman

1. Import endpoint: `GET http://localhost:3000/api/stats/requests`
2. Click **Send**
3. Xem response
4. Set **Tests** để auto-refresh:

```javascript
setTimeout(() => {
  postman.setNextRequest(request.name);
}, 5000); // Refresh every 5 seconds
```

---

## 🎯 Expected Behavior

### Sau 1 phút đầu tiên:

- Console sẽ log: `📊 Requests in last minute: X | Total: X`
- API `/api/stats/requests` sẽ show `currentMinute` reset về 0

### Sau 5 phút:

- Console sẽ log chi tiết:
  - Total requests
  - Average per minute
  - By method
  - Top 5 endpoints

### Khi vượt rate limit:

- Console sẽ log: `🤖 Chatbot rate limit exceeded - IP: ...`
- Response: `429 Too Many Requests`

---

## 🐛 Troubleshooting

### Nếu API không hoạt động:

```bash
# Check server đang chạy
curl http://localhost:3000

# Check endpoint stats
curl http://localhost:3000/api/stats/requests
```

### Nếu stats không tăng:

- Kiểm tra middleware đã được apply: `LoggerMiddleware`
- Check logs: có log request không?
- Restart server

### Reset nếu cần:

```bash
curl -X POST http://localhost:3000/api/stats/requests/reset
```
