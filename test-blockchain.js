const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/blockchain`;

// Test data
const TEST_CONTRACT = {
  contractId: 'DEMO_20250829',
  lessorId: 'LANDLORD_2025',
  lesseeId: 'TENANT_2025',
  docHash: 'test_doc_hash_20250829',
  rentAmount: 10000000,
  depositAmount: 20000000,
  currency: 'VND',
  startDate: '2025-09-01T00:00:00.000Z',
  endDate: '2026-09-01T00:00:00.000Z'
};

const TEST_PAYMENT_SCHEDULE = {
  totalPeriods: 2,
  schedule: [
    {
      period: 1,
      amount: 10000000,
      dueDate: '2025-09-30T23:59:59.999Z'
    },
    {
      period: 2,
      amount: 10000000,
      dueDate: '2025-10-31T23:59:59.999Z'
    }
  ]
};

const TEST_PAYMENT = {
  period: '1',
  amount: 10000000,
  orderRef: 'ORDER_PAYMENT_20250829'
};

const TEST_PENALTY = {
  period: '1',
  penaltyType: 'LATE_PAYMENT',
  amount: 500000,
  reason: 'Payment overdue by 3 days'
};

const TEST_SIGNATURE = {
  party: 'lessor',
  certSerial: 'CERT_SERIAL_20250829',
  sigMetaJson: JSON.stringify({
    signedBy: 'LANDLORD_2025',
    timestamp: new Date().toISOString()
  })
};

// Headers for testing different organizations
const HEADERS = {
  OrgProp: {
    'orgName': 'OrgProp',
    'userId': 'admin-OrgProp',
    'Content-Type': 'application/json'
  },
  OrgTenant: {
    'orgName': 'OrgTenant', 
    'userId': 'admin-OrgTenant',
    'Content-Type': 'application/json'
  },
  OrgLandlord: {
    'orgName': 'OrgLandlord',
    'userId': 'admin-OrgLandlord',
    'Content-Type': 'application/json'
  }
};

// Test functions
async function testUtilityController() {
  console.log('\n=== TESTING UTILITY CONTROLLER ===');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test organizations
    console.log('2. Testing organizations...');
    const orgResponse = await axios.get(`${API_BASE}/organizations`);
    console.log('✅ Organizations:', orgResponse.data);
    
    // Test config
    console.log('3. Testing network config...');
    const configResponse = await axios.get(`${API_BASE}/config`);
    console.log('✅ Network config:', configResponse.data);
    
  } catch (error) {
    console.error('❌ Utility Controller Error:', error.response?.data || error.message);
  }
}

async function testContractsController() {
  console.log('\n=== TESTING CONTRACTS CONTROLLER ===');
  
  try {
    // Test create contract (as OrgProp)
    console.log('1. Testing create contract...');
    const createResponse = await axios.post(
      `${API_BASE}/contracts`, 
      TEST_CONTRACT,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Create contract:', createResponse.data);
    
    // Test get contract
    console.log('2. Testing get contract...');
    const getResponse = await axios.get(
      `${API_BASE}/contracts/${TEST_CONTRACT.contractId}`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Get contract:', getResponse.data);
    
    // Test add signature (as lessor)
    console.log('3. Testing add signature...');
    const signResponse = await axios.post(
      `${API_BASE}/contracts/${TEST_CONTRACT.contractId}/signatures`,
      TEST_SIGNATURE,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Add signature:', signResponse.data);
    
    // Test query contracts
    console.log('4. Testing query contracts...');
    const queryResponse = await axios.get(
      `${API_BASE}/contracts?status=CREATED`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Query contracts:', queryResponse.data);
    
    // Test get contract history
    console.log('5. Testing contract history...');
    const historyResponse = await axios.get(
      `${API_BASE}/contracts/${TEST_CONTRACT.contractId}/history`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Contract history:', historyResponse.data);
    
  } catch (error) {
    console.error('❌ Contracts Controller Error:', error.response?.data || error.message);
  }
}

async function testPaymentsController() {
  console.log('\n=== TESTING PAYMENTS CONTROLLER ===');
  
  try {
    // Test create payment schedule
    console.log('1. Testing create payment schedule...');
    const scheduleResponse = await axios.post(
      `${API_BASE}/payments/contracts/${TEST_CONTRACT.contractId}/schedules`,
      TEST_PAYMENT_SCHEDULE,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Create payment schedule:', scheduleResponse.data);
    
    // Test record payment
    console.log('2. Testing record payment...');
    const paymentResponse = await axios.post(
      `${API_BASE}/payments/contracts/${TEST_CONTRACT.contractId}/payments`,
      TEST_PAYMENT,
      { headers: HEADERS.OrgTenant }
    );
    console.log('✅ Record payment:', paymentResponse.data);
    
    // Wait a bit for payment to be recorded before applying penalty
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test apply penalty (on the same period that was just paid)
    console.log('3. Testing apply penalty...');
    const penaltyResponse = await axios.post(
      `${API_BASE}/payments/contracts/${TEST_CONTRACT.contractId}/penalties`,
      TEST_PENALTY,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Apply penalty:', penaltyResponse.data);
    
    // Test query payments
    console.log('4. Testing query payments...');
    const queryPaymentsResponse = await axios.get(
      `${API_BASE}/payments?status=PAID`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Query payments:', queryPaymentsResponse.data);
    
    // Test get overdue payments
    console.log('5. Testing overdue payments...');
    const overdueResponse = await axios.get(
      `${API_BASE}/payments/overdue`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Overdue payments:', overdueResponse.data);
    
    // Test get contract penalties
    console.log('6. Testing contract penalties...');
    const penaltiesResponse = await axios.get(
      `${API_BASE}/payments/contracts/${TEST_CONTRACT.contractId}/penalties`,
      { headers: HEADERS.OrgProp }
    );
    console.log('✅ Contract penalties:', penaltiesResponse.data);
    
  } catch (error) {
    console.error('❌ Payments Controller Error:', error.response?.data || error.message);
  }
}

async function testErrorHandling() {
  console.log('\n=== TESTING ERROR HANDLING ===');
  
  try {
    // Test invalid contract ID
    console.log('1. Testing invalid contract ID...');
    try {
      await axios.get(
        `${API_BASE}/contracts/INVALID_CONTRACT`,
        { headers: HEADERS.OrgProp }
      );
    } catch (error) {
      console.log('✅ Invalid contract ID error handled:', error.response.data);
    }
    
    // Test missing headers
    console.log('2. Testing missing headers...');
    try {
      await axios.get(`${API_BASE}/contracts`);
    } catch (error) {
      console.log('✅ Missing headers error handled:', error.response.data);
    }
    
    // Test duplicate contract creation
    console.log('3. Testing duplicate contract...');
    try {
      await axios.post(
        `${API_BASE}/contracts`, 
        TEST_CONTRACT,
        { headers: HEADERS.OrgProp }
      );
    } catch (error) {
      console.log('✅ Duplicate contract error handled:', error.response.data);
    }
    
  } catch (error) {
    console.error('❌ Error Handling Test Error:', error.message);
  }
}

async function testOrganizationPermissions() {
  console.log('\n=== TESTING ORGANIZATION PERMISSIONS ===');
  
  try {
    // Test different organizations accessing same contract
    console.log('1. Testing OrgTenant accessing contract...');
    const tenantResponse = await axios.get(
      `${API_BASE}/contracts/${TEST_CONTRACT.contractId}`,
      { headers: HEADERS.OrgTenant }
    );
    console.log('✅ OrgTenant access:', tenantResponse.data);
    
    console.log('2. Testing OrgLandlord accessing contract...');
    const agentResponse = await axios.get(
      `${API_BASE}/contracts/${TEST_CONTRACT.contractId}`,
      { headers: HEADERS.OrgLandlord }
    );
    console.log('✅ OrgLandlord access:', agentResponse.data);
    
    // Test contract creation by OrgLandlord (new functionality)
    console.log('3. Testing OrgLandlord creating contract...');
    const landlordContract = {
      ...TEST_CONTRACT,
      contractId: 'DEMO_LANDLORD_20250829', // Different contract ID
    };
    
    const createByLandlordResponse = await axios.post(
      `${API_BASE}/contracts`, 
      landlordContract,
      { headers: HEADERS.OrgLandlord }
    );
    console.log('✅ OrgLandlord contract creation:', createByLandlordResponse.data);
    
  } catch (error) {
    console.error('❌ Organization Permissions Error:', error.response?.data || error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 STARTING BLOCKCHAIN CONTROLLERS TEST SUITE');
  console.log('='.repeat(50));
  
  // Wait for server to be ready
  console.log('⏳ Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await testUtilityController();
    await testContractsController();
    await testPaymentsController();
    await testErrorHandling();
    await testOrganizationPermissions();
    
    console.log('\n🎉 ALL TESTS COMPLETED!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('💥 CRITICAL TEST ERROR:', error.message);
  }
}

// Run tests
runAllTests().catch(console.error);
