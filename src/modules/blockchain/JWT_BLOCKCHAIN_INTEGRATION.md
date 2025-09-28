# JWT + Blockchain Integration Guide

## Overview

This guide explains how to use JWT authentication with Blockchain API endpoints in the RentHome backend.

## Authentication Flow

1. **JWT Authentication**: User must first authenticate and receive a JWT token
2. **Blockchain Headers**: Additional blockchain-specific headers are required
3. **Organization Validation**: User role must match the organization being accessed
4. **Blockchain Identity**: System creates blockchain identity based on JWT user info

## Required Headers

### JWT Token
```
Authorization: Bearer <your-jwt-token>
```

### Blockchain Headers
```
orgname: <organization-name>     # Required: OrgProp, OrgTenant, OrgLandlord
userid: <blockchain-user-id>     # Optional: defaults to JWT user ID
```

## API Endpoints

### 1. Contract Management

#### Create Contract
```http
POST /api/blockchain/contracts
Authorization: Bearer <jwt-token>
orgname: OrgProp
Content-Type: application/json

{
  "contractId": "CONTRACT_12345",
  "lessorId": "user123",
  "lesseeId": "user456",
  "propertyId": "prop789",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 1000,
  "deposit": 2000,
  "terms": "Standard rental terms"
}
```

#### Get Contract
```http
GET /api/blockchain/contracts/:contractId
Authorization: Bearer <jwt-token>
orgname: OrgProp
```

#### Update Contract Status
```http
PUT /api/blockchain/contracts/:contractId/status
Authorization: Bearer <jwt-token>
orgname: OrgProp
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

### 2. Payment Management

#### Record Payment
```http
POST /api/blockchain/payments/record
Authorization: Bearer <jwt-token>
orgname: OrgTenant
Content-Type: application/json

{
  "contractId": "CONTRACT_12345",
  "period": "2025-01",
  "amount": 1000,
  "orderRef": "VNPAY_ORDER_123"
}
```

#### Get Payment History
```http
GET /api/blockchain/payments/history/:contractId
Authorization: Bearer <jwt-token>
orgname: OrgTenant
```

### 3. Blockchain Utilities

#### Health Check (Public - No JWT required)
```http
GET /api/blockchain/health
```

#### Get Network Config (JWT Required)
```http
GET /api/blockchain/network-config
Authorization: Bearer <jwt-token>
orgname: OrgProp
```

## Role-Based Access Control

### Organization Access Rules

| User Role | Allowed Organizations | Description |
|-----------|----------------------|-------------|
| `admin` | All | Full access to all organizations |
| `landlord` / `property_owner` | `OrgProp` | Property management operations |
| `tenant` | `OrgTenant` | Tenant-related operations |
| `landlord` | `OrgLandlord` | landlord management operations |

### Example Access Matrix

```typescript
// Landlord accessing property operations
Headers: {
  Authorization: "Bearer <jwt-token>",
  orgname: "OrgProp"  // ✅ Allowed
}

// Tenant trying to access property operations  
Headers: {
  Authorization: "Bearer <jwt-token>",
  orgname: "OrgProp"  // ❌ Forbidden - role mismatch
}

// Admin accessing any organization
Headers: {
  Authorization: "Bearer <jwt-token>",
  orgname: "OrgTenant"  // ✅ Allowed - admin has full access
}
```

## Error Handling

### Common Error Responses

#### 401 Unauthorized - Invalid JWT
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid JWT token"
}
```

#### 400 Bad Request - Missing Headers
```json
{
  "statusCode": 400,
  "message": "Missing required header: orgName or x-org-name",
  "error": "Bad Request"
}
```

#### 401 Unauthorized - Invalid Organization
```json
{
  "statusCode": 401,
  "message": "Invalid organization: InvalidOrg. Supported organizations: OrgProp,OrgTenant,OrgLandlord",
  "error": "Unauthorized"
}
```

#### 403 Forbidden - Role Mismatch
```json
{
  "statusCode": 401,
  "message": "User 123 does not have permission to access organization: OrgProp",
  "error": "Unauthorized"
}
```

## Implementation Details

### Guard Chain
1. `JwtBlockchainAuthGuard` combines both JWT and blockchain validation
2. First validates JWT token using `JwtAuthGuard`
3. Then validates blockchain-specific requirements
4. Attaches both JWT user and blockchain user info to request

### Request Context
After successful authentication, the request object contains:

```typescript
request.user = {
  id: "123",
  email: "user@example.com",
  role: "landlord",
  // ... other JWT payload fields
}

request.blockchainUser = {
  userId: "123",
  orgName: "OrgProp", 
  mspId: "OrgPropMSP",
  jwtUser: request.user // Reference to JWT user
}
```

### Controller Usage
```typescript
@Controller('blockchain/contracts')
@UseGuards(JwtBlockchainAuthGuard)
export class ContractsController {
  
  @Post()
  async createContract(
    @CurrentUser() jwtUser: any,           // JWT user info
    @BlockchainUser() blockchainUser: any, // Blockchain user info
    @Body() contractData: CreateContractDto
  ) {
    // Both user contexts available
    console.log('JWT User:', jwtUser);
    console.log('Blockchain User:', blockchainUser);
    
    return this.contractsService.createContract(contractData, blockchainUser);
  }
}
```

## Testing

### Using Postman/Insomnia

1. First authenticate to get JWT token:
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "landlord@example.com",
  "password": "password123"
}
```

2. Use the returned token in blockchain API calls:
```http
POST /api/blockchain/contracts
Authorization: Bearer <received-jwt-token>
orgname: OrgProp
Content-Type: application/json

{
  // contract data
}
```

### Using curl

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"landlord@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Use token with blockchain API
curl -X POST http://localhost:3000/api/blockchain/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "orgname: OrgProp" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CONTRACT_12345",
    "lessorId": "user123",
    "lesseeId": "user456",
    "propertyId": "prop789",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "monthlyRent": 1000,
    "deposit": 2000,
    "terms": "Standard rental terms"
  }'
```

## Security Considerations

1. **JWT Token Expiry**: Tokens should have reasonable expiry times
2. **Role Validation**: Always validate user roles match organization access
3. **Input Sanitization**: All blockchain inputs should be validated
4. **Rate Limiting**: Consider adding rate limiting for blockchain operations
5. **Audit Logging**: Log all blockchain transactions for audit trails

## Troubleshooting

### Common Issues

1. **"Missing required header: orgName"**
   - Solution: Add `orgname` header to your request

2. **"Invalid organization: XYZ"** 
   - Solution: Use valid organization names: `OrgProp`, `OrgTenant`, `OrgLandlord`

3. **"User does not have permission to access organization"**
   - Solution: Ensure your JWT user role matches the organization

4. **"Unauthorized" with valid JWT**
   - Solution: Check if blockchain service is running and certificates are valid

For more details, check the controller implementations in:
- `src/modules/blockchain/contracts.controller.ts`
- `src/modules/blockchain/payments.controller.ts`
- `src/modules/blockchain/guards/jwt-blockchain-auth.guard.ts`
