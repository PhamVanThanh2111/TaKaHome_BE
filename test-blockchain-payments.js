const axios = require('axios');

// Base URL và headers
const BASE_URL = 'http://localhost:3000';
const HEADERS = {
  'Content-Type': 'application/json',
  'orgName': 'OrgProp',
  'userId': 'admin-OrgProp'
};

// Helper function để gọi API
async function apiCall(method, url, data = null, headers = HEADERS) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${url}`,
      data,
      headers
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      return { error: error.response.data };
    }
    throw error;
  }
}

async function testPaymentsController() {
  console.log('\n🚀 TESTING PAYMENTS CONTROLLER IN DETAIL');
  console.log('='.repeat(50));
  
  const contractId = 'CONTRACT_TEST_001';
  
  try {
    // 1. Test Create Payment Schedule
    console.log('1. Testing create payment schedule...');
    const scheduleData = {
      totalPeriods: 12,
      schedule: [
        {
          period: 2025,
          amount: 15000000,
          dueDate: "2025-01-31T23:59:59.999Z"
        },
        {
          period: 2025,
          amount: 15000000,
          dueDate: "2025-02-28T23:59:59.999Z"
        },
        {
          period: 2025,
          amount: 15000000,
          dueDate: "2025-03-31T23:59:59.999Z"
        }
      ]
    };
    
    const scheduleResult = await apiCall('POST', `/api/blockchain/payments/contracts/${contractId}/schedules`, scheduleData);
    
    if (scheduleResult.success) {
      console.log('✅ Payment schedule created successfully');
      console.log('Data:', JSON.stringify(scheduleResult.data, null, 2));
    } else if (scheduleResult.error) {
      console.log('❌ Payment schedule error:', scheduleResult.error);
    } else {
      console.log('✅ Payment schedule result:', JSON.stringify(scheduleResult, null, 2));
    }
    
    // 2. Test Record Payment
    console.log('\n2. Testing record payment...');
    const paymentData = {
      period: "2025-01",
      amount: 15000000,
      orderRef: "ORDER_REF_001"
    };
    
    const paymentResult = await apiCall('POST', `/api/blockchain/payments/contracts/${contractId}/payments`, paymentData);
    
    if (paymentResult.success) {
      console.log('✅ Payment recorded successfully');
      console.log('Data:', JSON.stringify(paymentResult.data, null, 2));
    } else if (paymentResult.error) {
      console.log('❌ Payment record error:', paymentResult.error);
    } else {
      console.log('✅ Payment result:', JSON.stringify(paymentResult, null, 2));
    }
    
    // 3. Test Mark Payment Overdue
    console.log('\n3. Testing mark payment overdue...');
    const overdueResult = await apiCall('PUT', `/api/blockchain/payments/contracts/${contractId}/payments/2025-02/overdue`, {});
    
    if (overdueResult.success) {
      console.log('✅ Payment marked as overdue successfully');
    } else if (overdueResult.error) {
      console.log('❌ Mark overdue error:', overdueResult.error);
    } else {
      console.log('✅ Mark overdue result:', JSON.stringify(overdueResult, null, 2));
    }
    
    // 4. Test Apply Penalty
    console.log('\n4. Testing apply penalty...');
    const penaltyData = {
      penaltyType: "LATE_PAYMENT",
      amount: 500000,
      reason: "Late payment for period 2025-02"
    };
    
    const penaltyResult = await apiCall('POST', `/api/blockchain/payments/contracts/${contractId}/penalties`, penaltyData);
    
    if (penaltyResult.success) {
      console.log('✅ Penalty applied successfully');
      console.log('Data:', JSON.stringify(penaltyResult.data, null, 2));
    } else if (penaltyResult.error) {
      console.log('❌ Apply penalty error:', penaltyResult.error);
    } else {
      console.log('✅ Penalty result:', JSON.stringify(penaltyResult, null, 2));
    }
    
    // 5. Test Query Payments
    console.log('\n5. Testing query payments...');
    const queryResult = await apiCall('GET', '/api/blockchain/payments?status=PAID');
    
    if (queryResult.success) {
      console.log('✅ Payments queried successfully');
      console.log('Count:', queryResult.data.length);
    } else if (queryResult.error) {
      console.log('❌ Query payments error:', queryResult.error);
    } else {
      console.log('✅ Query result:', JSON.stringify(queryResult, null, 2));
    }
    
    // 6. Test Get Overdue Payments
    console.log('\n6. Testing get overdue payments...');
    const overduePaymentsResult = await apiCall('GET', '/api/blockchain/payments/overdue');
    
    if (overduePaymentsResult.success) {
      console.log('✅ Overdue payments retrieved successfully');
      console.log('Count:', overduePaymentsResult.data.length);
    } else if (overduePaymentsResult.error) {
      console.log('❌ Get overdue payments error:', overduePaymentsResult.error);
    } else {
      console.log('✅ Overdue payments result:', JSON.stringify(overduePaymentsResult, null, 2));
    }
    
    // 7. Test Get Contract Penalties
    console.log('\n7. Testing get contract penalties...');
    const penaltiesResult = await apiCall('GET', `/api/blockchain/payments/contracts/${contractId}/penalties`);
    
    if (penaltiesResult.success) {
      console.log('✅ Contract penalties retrieved successfully');
      console.log('Count:', penaltiesResult.data.length);
    } else if (penaltiesResult.error) {
      console.log('❌ Get penalties error:', penaltiesResult.error);
    } else {
      console.log('✅ Penalties result:', JSON.stringify(penaltiesResult, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
  
  console.log('\n🎉 PAYMENTS CONTROLLER TEST COMPLETED!');
  console.log('='.repeat(50));
}

async function testContractActivation() {
  console.log('\n🚀 TESTING CONTRACT ACTIVATION FLOW');
  console.log('='.repeat(50));
  
  const contractId = 'CONTRACT_TEST_001';
  
  try {
    // 1. Add lessee signature
    console.log('1. Adding lessee signature...');
    const lesseeSignature = {
      party: "lessee",
      certSerial: "CERT_LESSEE_001", 
      sigMetaJson: JSON.stringify({
        signature: "lessee_signature_data",
        timestamp: new Date().toISOString()
      })
    };
    
    const lesseeResult = await apiCall('POST', `/api/blockchain/contracts/${contractId}/signatures`, lesseeSignature);
    
    if (lesseeResult.success) {
      console.log('✅ Lessee signature added successfully');
    } else if (lesseeResult.error) {
      console.log('❌ Lessee signature error:', lesseeResult.error);
    }
    
    // 2. Try to activate contract
    console.log('\n2. Attempting to activate contract...');
    const activateResult = await apiCall('PUT', `/api/blockchain/contracts/${contractId}/activate`, {});
    
    if (activateResult.success) {
      console.log('✅ Contract activated successfully');
      console.log('Status:', activateResult.data.status);
    } else if (activateResult.error) {
      console.log('❌ Contract activation error:', activateResult.error);
    } else {
      console.log('✅ Activation result:', JSON.stringify(activateResult, null, 2));
    }
    
    // 3. Try to terminate contract
    console.log('\n3. Testing contract termination...');
    const terminateData = {
      reason: "Test termination - early contract end"
    };
    
    const terminateResult = await apiCall('PUT', `/api/blockchain/contracts/${contractId}/terminate`, terminateData);
    
    if (terminateResult.success) {
      console.log('✅ Contract terminated successfully');
      console.log('Status:', terminateResult.data.status);
    } else if (terminateResult.error) {
      console.log('❌ Contract termination error:', terminateResult.error);
    } else {
      console.log('✅ Termination result:', JSON.stringify(terminateResult, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

// Chạy tests
async function runAllTests() {
  console.log('⏳ Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testPaymentsController();
  await testContractActivation();
}

runAllTests().catch(console.error);
