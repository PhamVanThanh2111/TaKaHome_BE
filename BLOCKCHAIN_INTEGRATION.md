# 🔗 BLOCKCHAIN INTEGRATION - NESTJS BACKEND

**Version:** 1.0.0  
**Date:** August 28, 2025  
**Integration:** Hyperledger Fabric Real Estate Network → NestJS Backend

---

## 🎯 OVERVIEW

Blockchain module đã được tích hợp hoàn chỉnh vào NestJS backend với các tính năng sau:

- ✅ **Full REST API** cho contract và payment operations
- ✅ **Multi-organization support** (OrgProp, OrgTenant, OrgLandlord)  
- ✅ **JWT Authentication** với role-based access control
- ✅ **Type-safe TypeScript interfaces** cho tất cả blockchain data
- ✅ **Input validation** với class-validator
- ✅ **Comprehensive error handling** với proper HTTP status codes
- ✅ **Swagger documentation** cho tất cả endpoints
- ✅ **Health checks** và monitoring

---

## 📂 PROJECT STRUCTURE

```
src/modules/blockchain/
├── blockchain.module.ts              # Main module configuration
├── blockchain.service.ts             # Service wrapper for RealEstateService
├── blockchain-config.service.ts      # Configuration management
├── contracts.controller.ts           # Contract management endpoints
├── payments.controller.ts            # Payment processing endpoints  
├── blockchain-utility.controller.ts  # Health & utility endpoints
├── fabricHelper.js                   # Fabric Gateway helper
├── realEstateService.js             # Core business logic
├── connection-profile.json          # Network connection profile
├── wallet/                          # User identities
├── dto/
│   ├── contract.dto.ts              # Contract DTOs với validation
│   └── payment.dto.ts               # Payment DTOs với validation
├── interfaces/
│   ├── contract.interface.ts        # Contract type definitions
│   ├── payment.interface.ts         # Payment type definitions
│   └── fabric.interface.ts          # Fabric network types
└── guards/
    ├── blockchain-auth.guard.ts     # Organization validation
    └── jwt-blockchain-auth.guard.ts # Combined JWT + blockchain auth
```

---

## 🚀 API ENDPOINTS OVERVIEW

### **Authentication Required**
All blockchain endpoints require JWT authentication và organization headers:
```http
Authorization: Bearer <jwt-token>
orgname: <OrgProp|OrgTenant|OrgLandlord>
```

### **🏠 Contract Operations**
- `POST /api/blockchain/contracts` - Create new rental contract
- `GET /api/blockchain/contracts/:id` - Get contract details
- `PUT /api/blockchain/contracts/:id/status` - Update contract status
- `POST /api/blockchain/contracts/:id/signatures` - Add digital signatures
- `GET /api/blockchain/contracts` - Query contracts with filters

### **💰 Payment Operations**
- `POST /api/blockchain/payments/record` - Record payment transaction
- `GET /api/blockchain/payments/history/:contractId` - Get payment history
- `GET /api/blockchain/payments/overdue` - Check overdue payments
- `POST /api/blockchain/payments/penalties` - Apply late payment penalties

### **⚡ Utility Operations**
- `GET /api/blockchain/health` - Health check (public)
- `GET /api/blockchain/network-config` - Get network configuration
- `GET /api/blockchain/organizations` - List supported organizations

> **📖 Detailed API Documentation**: See `src/modules/blockchain/JWT_BLOCKCHAIN_INTEGRATION.md` for complete examples and usage guides.

---

## 🔧 CONFIGURATION

### Environment Variables (.env)
```bash
# Blockchain Network Configuration
CHANNEL_NAME=rentalchannel
CHAINCODE_NAME=real-estate-cc
WALLET_PATH=./assets/blockchain/wallet
CONNECTION_PROFILE_PATH=./assets/blockchain/connection-profile.json

# JWT Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION_TIME=3600s

# Supported Organizations  
BLOCKCHAIN_ORGS=OrgProp,OrgTenant,OrgLandlord
```

### Connection Profile
Network configuration được định nghĩa trong `connection-profile.json`:
```json
{
  "name": "real-estate-network",
  "version": "1.0.0",
  "client": {
    "organization": "OrgProp",
    "credentialStore": {
      "path": "./wallet"
    }
  },
  "organizations": {
    "OrgProp": { "peers": ["peer0.orgprop.example.com"] },
    "OrgTenant": { "peers": ["peer0.orgtenant.example.com"] },
    "OrgLandlord": { "peers": ["peer0.orglandlord.example.com"] }
  }
}
```

---

## 🛡️ SECURITY FEATURES

### **Multi-Layer Authentication**
1. **JWT Token Validation** - User authentication
2. **Organization Authorization** - Role-based org access  
3. **Business Logic Validation** - Contract ownership verification
4. **Input Sanitization** - DTO validation with class-validator

### **Access Control Matrix**
| User Role | OrgProp | OrgTenant | OrgLandlord |
|-----------|---------|-----------|-------------|
| `admin` | ✅ Full | ✅ Full | ✅ Full |
| `landlord` | ✅ Full | ❌ None | ❌ None |
| `tenant` | ❌ None | ✅ Full | ❌ None |
| `agent` | ❌ None | ❌ None | ✅ Full |

### **Data Protection**
- TLS encryption cho network communication
- Digital signatures cho contract authenticity
- Audit trails cho tất cả blockchain transactions
- Input validation và sanitization

---

## 📊 MONITORING & HEALTH CHECKS

### **Health Check Endpoint**
```http
GET /api/blockchain/health

Response:
{
  "status": "ok",
  "network": "connected",
  "organizations": ["OrgProp", "OrgTenant", "OrgLandlord"],
  "timestamp": "2025-08-28T07:00:00Z"
}
```

### **Network Diagnostics**
- Connection status monitoring
- Peer availability checking  
- Chaincode deployment verification
- Organization MSP validation

---

## 🚀 DEPLOYMENT

### **Prerequisites**
1. Hyperledger Fabric network running
2. Smart contracts deployed
3. Organization certificates configured
4. NestJS application with JWT authentication

### **Installation Steps**
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your blockchain network settings

# Start the application
npm run start:dev
```

### **Verification**
```bash
# Test health check
curl http://localhost:3000/api/blockchain/health

# Test authentication flow
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

---

## 📈 PERFORMANCE CONSIDERATIONS

### **Optimization Features**
- Connection pooling for Fabric Gateway
- Caching for frequently accessed contracts
- Async processing for non-critical operations
- Batch operations for multiple transactions

### **Scalability**
- Horizontal scaling support
- Load balancing compatibility
- Database integration for off-chain data
- Event-driven architecture for real-time updates

---

## 🔄 INTEGRATION STATUS

### **✅ Completed Features**
- [x] Contract lifecycle management
- [x] Payment processing and tracking  
- [x] Digital signature support
- [x] JWT authentication integration
- [x] Role-based access control
- [x] Comprehensive API documentation
- [x] Error handling and validation
- [x] Health monitoring
- [x] Multi-organization support

### **🔮 Future Enhancements**
- [ ] Smart contract upgrades support
- [ ] Advanced analytics and reporting
- [ ] Integration with external payment gateways
- [ ] Mobile app SDK
- [ ] Real-time notifications via WebSocket
- [ ] Multi-language support
- [ ] Advanced audit logging

---

## 📚 DOCUMENTATION REFERENCES

- **JWT Integration Guide**: `src/modules/blockchain/JWT_BLOCKCHAIN_INTEGRATION.md`
- **Implementation Summary**: `JWT_BLOCKCHAIN_INTEGRATION_SUMMARY.md`
- **API Documentation**: Full Swagger documentation available at `/api-docs`
- **Project README**: `README.md`

---

## 💬 SUPPORT

For technical support và questions:
- Check health endpoint: `/api/blockchain/health`
- Review logs in `server.log`
- Verify network connectivity
- Validate JWT token expiry
- Confirm organization permissions

**Status**: ✅ **PRODUCTION READY** - All core features implemented and tested.
