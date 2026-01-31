# TrustRail Backend - Comprehensive Test Plan & API Validation

**Document Version:** 1.0
**Last Updated:** 2026-01-30
**Author:** Senior Principal QA Engineer

---

## Table of Contents

1. [Testing Strategy Overview](#testing-strategy-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [API Testing - All Endpoints](#api-testing---all-endpoints)
4. [Complete Flow Testing](#complete-flow-testing)
5. [Integration Testing](#integration-testing)
6. [Error Handling & Edge Cases](#error-handling--edge-cases)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Test Data Requirements](#test-data-requirements)
10. [Test Execution Checklist](#test-execution-checklist)

---

## Testing Strategy Overview

### Test Levels
1. **Unit Tests** - Individual function validation (Trust Engine, PWA Service)
2. **API Tests** - All 33 endpoints validation
3. **Integration Tests** - Complete business flows
4. **System Tests** - Background jobs, webhooks, PWA integration
5. **Security Tests** - Authentication, encryption, authorization
6. **Performance Tests** - Load, stress, concurrency

### Test Approach
- **Bottom-Up:** Start with foundational APIs (auth, health check)
- **Flow-Based:** Test complete customer journey end-to-end
- **Regression:** Ensure no breaking changes after updates
- **Automation:** Use HTTPie/Postman collections + automated scripts

---

## Test Environment Setup

### Prerequisites
```bash
# 1. MongoDB running
mongod --dbpath /path/to/data

# 2. Environment variables configured
cp .env.example .env
# Edit .env with test values

# 3. Server running
npm run dev

# 4. Test tools installed
npm install -g httpie
npm install --save-dev jest supertest
```

### Test Database Preparation
```bash
# Create test database
mongo trustrail_test

# Optional: Load test fixtures
npm run seed:test
```

### OnePipe Mock Configuration (RECOMMENDED for E2E Testing)

The TrustRail backend includes a built-in OnePipe mock server for testing without real API integration.

**Configure .env for Mock:**
```bash
# Point PWA API to the mock endpoint
PWA_BASE_URL=http://localhost:3000/onepipe-mock/transact

# Set mock mode to Inspect
PWA_MOCK_MODE=Inspect

# Mock API key (any value works with mock)
PWA_API_KEY=mock-api-key-for-testing

# Mock TripleDES key (24 bytes)
TRIPLE_DES_KEY=mock1234567890123456789012
```

**Mock Features:**
- ✅ Create Merchant API
- ✅ Create Mandate API
- ✅ Send Invoice API
- ✅ Manual webhook triggering (`/onepipe-mock/trigger-webhook`)
- ✅ Mock data inspection (`/onepipe-mock/data`)
- ✅ Mock data reset (`/onepipe-mock/reset`)

**Important:** The mock runs on the same server as TrustRail, so start the server once and all endpoints (TrustRail + OnePipe mock) are available.

**Reference:** See `/Users/feranmi/codebases/2026/trustrail/backend/docs/onepipe-mock.md` for full mock API documentation.

### Base URLs
- **Local TrustRail API:** `http://localhost:3000`
- **Local OnePipe Mock:** `http://localhost:3000/onepipe-mock`

---

## API Testing - All Endpoints

### 1. Health Check API

#### Test Case 1.1: Basic Health Check
**Endpoint:** `GET /health`
**Auth Required:** No

**Test Steps:**
```bash
http GET http://localhost:3000/health
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-30T10:00:00.000Z",
    "database": "connected"
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Response contains `status: "ok"`
- ✅ Database connection status is "connected"
- ✅ Timestamp is valid ISO string

---

### 2. Business Authentication APIs

#### Test Case 2.1: Business Registration - Valid Data
**Endpoint:** `POST /api/auth/register`
**Auth Required:** No

**Test Steps:**
```bash
http POST http://localhost:3000/api/auth/register \
  businessName="Lagos State University" \
  email="admin@lasu.edu.ng" \
  password="SecurePass123!" \
  phoneNumber="2348012345678" \
  rcNumber="RC123456" \
  settlementAccountNumber="0123456789" \
  settlementBankCode="058" \
  settlementAccountName="LASU Payment Account"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Business registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "business": {
      "businessId": "TR-BIZ-1738234567890",
      "businessName": "Lagos State University",
      "email": "admin@lasu.edu.ng",
      "billerCode": "BLR123456",
      "isActive": true
    }
  }
}
```

**Validation Points:**
- ✅ Status code: 201
- ✅ JWT token is present and valid
- ✅ businessId format matches: `TR-BIZ-{timestamp}`
- ✅ billerCode received from PWA API
- ✅ Business is created in database
- ✅ Password is bcrypt hashed (check DB)
- ✅ Audit log created for `business.register`

**Database Verification:**
```javascript
db.businesses.findOne({ email: "admin@lasu.edu.ng" })
// Verify: password is hashed, billerCode exists, timestamps set
```

#### Test Case 2.2: Business Registration - Duplicate Email
**Test Steps:**
```bash
# Register same email again
http POST http://localhost:3000/api/auth/register \
  businessName="Another University" \
  email="admin@lasu.edu.ng" \
  password="SecurePass123!" \
  phoneNumber="2348087654321" \
  rcNumber="RC654321" \
  settlementAccountNumber="9876543210" \
  settlementBankCode="058" \
  settlementAccountName="Another Account"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Email already registered"
}
```

**Validation Points:**
- ✅ Status code: 409 (Conflict)
- ✅ Error message indicates duplicate email
- ✅ No new business created in database

#### Test Case 2.3: Business Registration - Invalid Phone Format
**Test Steps:**
```bash
http POST http://localhost:3000/api/auth/register \
  businessName="Test University" \
  email="test@university.com" \
  password="SecurePass123!" \
  phoneNumber="08012345678" \
  rcNumber="RC789456" \
  settlementAccountNumber="0123456789" \
  settlementBankCode="058" \
  settlementAccountName="Test Account"
```

**Expected Response:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "phoneNumber",
      "message": "Phone number must be in Nigerian format (234XXXXXXXXXX)"
    }
  ]
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Validation error for phoneNumber
- ✅ No business created

#### Test Case 2.4: Business Login - Valid Credentials
**Endpoint:** `POST /api/auth/login`

**Test Steps:**
```bash
http POST http://localhost:3000/api/auth/login \
  email="admin@lasu.edu.ng" \
  password="SecurePass123!"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "business": {
      "businessId": "TR-BIZ-1738234567890",
      "businessName": "Lagos State University",
      "email": "admin@lasu.edu.ng"
    }
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ JWT token returned
- ✅ Token expires in 30 days
- ✅ Token payload contains businessId and email

**JWT Token Verification:**
```javascript
// Decode token and verify
{
  "businessId": "TR-BIZ-1738234567890",
  "email": "admin@lasu.edu.ng",
  "iat": 1738234567,
  "exp": 1740826567 // 30 days later
}
```

#### Test Case 2.5: Business Login - Invalid Credentials
**Test Steps:**
```bash
http POST http://localhost:3000/api/auth/login \
  email="admin@lasu.edu.ng" \
  password="WrongPassword123!"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Validation Points:**
- ✅ Status code: 401
- ✅ No token returned
- ✅ Generic error message (don't reveal if email exists)

#### Test Case 2.6: Business Logout
**Endpoint:** `POST /api/auth/logout`
**Auth Required:** Yes

**Test Steps:**
```bash
http POST http://localhost:3000/api/auth/logout \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logged out successfully. Please delete your token.",
  "data": null
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Message instructs client-side token deletion
- ✅ Token still valid (stateless JWT - client must delete)

---

### 3. TrustWallet Management APIs

#### Test Case 3.1: Create TrustWallet - Valid Data
**Endpoint:** `POST /api/trustwallets`
**Auth Required:** Yes

**Test Steps:**
```bash
TOKEN="<your-jwt-token>"

http POST http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}" \
  name="Computer Science Department Fees" \
  description="Installment payment plan for CS students" \
  installmentPlan:='{"totalAmount":100000,"downPaymentPercentage":20,"installmentCount":4,"frequency":"monthly","interestRate":0}' \
  approvalWorkflow:='{"autoApproveThreshold":85,"autoDeclineThreshold":40,"minTrustScore":50}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "TrustWallet created successfully",
  "data": {
    "trustWalletId": "TW-1738234567890",
    "businessId": "TR-BIZ-1738234567890",
    "name": "Computer Science Department Fees",
    "description": "Installment payment plan for CS students",
    "installmentPlan": {
      "totalAmount": 100000,
      "downPaymentPercentage": 20,
      "installmentCount": 4,
      "frequency": "monthly",
      "interestRate": 0
    },
    "approvalWorkflow": {
      "autoApproveThreshold": 85,
      "autoDeclineThreshold": 40,
      "minTrustScore": 50
    },
    "publicUrl": "/public/trustwallet/TW-1738234567890",
    "isActive": true,
    "createdAt": "2026-01-30T10:00:00.000Z"
  }
}
```

**Validation Points:**
- ✅ Status code: 201
- ✅ trustWalletId format: `TW-{timestamp}`
- ✅ businessId matches authenticated business
- ✅ publicUrl generated correctly
- ✅ All plan details saved correctly
- ✅ isActive defaults to true
- ✅ Audit log created

**Database Verification:**
```javascript
db.trustwallets.findOne({ trustWalletId: "TW-1738234567890" })
// Verify all fields match
```

#### Test Case 3.2: Create TrustWallet - Invalid Workflow (autoApprove <= autoDecline)
**Test Steps:**
```bash
http POST http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}" \
  name="Invalid Workflow Test" \
  installmentPlan:='{"totalAmount":100000,"downPaymentPercentage":20,"installmentCount":4,"frequency":"monthly"}' \
  approvalWorkflow:='{"autoApproveThreshold":50,"autoDeclineThreshold":60,"minTrustScore":40}'
```

**Expected Response:**
```json
{
  "success": false,
  "errors": [
    {
      "message": "Auto-approve threshold must be greater than auto-decline threshold"
    }
  ]
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Validation error message
- ✅ No TrustWallet created

#### Test Case 3.3: Create TrustWallet - Duplicate Name for Same Business
**Test Steps:**
```bash
# Create second TrustWallet with same name
http POST http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}" \
  name="Computer Science Department Fees" \
  installmentPlan:='{"totalAmount":150000,"downPaymentPercentage":25,"installmentCount":5,"frequency":"monthly"}' \
  approvalWorkflow:='{"autoApproveThreshold":85,"autoDeclineThreshold":40,"minTrustScore":50}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "TrustWallet with this name already exists for your business"
}
```

**Validation Points:**
- ✅ Status code: 409
- ✅ Error indicates duplicate name
- ✅ No new TrustWallet created

#### Test Case 3.4: List TrustWallets - No Filters
**Endpoint:** `GET /api/trustwallets`

**Test Steps:**
```bash
http GET http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "trustWalletId": "TW-1738234567890",
      "name": "Computer Science Department Fees",
      "isActive": true,
      "createdAt": "2026-01-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Only TrustWallets for authenticated business returned
- ✅ Pagination metadata present
- ✅ Default page: 1, limit: 20

#### Test Case 3.5: List TrustWallets - With Pagination
**Test Steps:**
```bash
http GET "http://localhost:3000/api/trustwallets?page=2&limit=5" \
  "Authorization:Bearer ${TOKEN}"
```

**Validation Points:**
- ✅ Returns correct page
- ✅ Respects limit
- ✅ totalPages calculated correctly

#### Test Case 3.6: Get Single TrustWallet
**Endpoint:** `GET /api/trustwallets/:id`

**Test Steps:**
```bash
http GET http://localhost:3000/api/trustwallets/TW-1738234567890 \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "trustWalletId": "TW-1738234567890",
    "businessId": "TR-BIZ-1738234567890",
    "name": "Computer Science Department Fees",
    "description": "Installment payment plan for CS students",
    "installmentPlan": { /* full details */ },
    "approvalWorkflow": { /* full details */ },
    "publicUrl": "/public/trustwallet/TW-1738234567890",
    "isActive": true
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Full TrustWallet details returned
- ✅ Only accessible by owner

#### Test Case 3.7: Get TrustWallet - Unauthorized Access
**Test Steps:**
```bash
# Use different business's token
http GET http://localhost:3000/api/trustwallets/TW-1738234567890 \
  "Authorization:Bearer ${OTHER_BUSINESS_TOKEN}"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "TrustWallet not found"
}
```

**Validation Points:**
- ✅ Status code: 404
- ✅ Cannot access other business's TrustWallets
- ✅ Generic error (don't reveal existence)

#### Test Case 3.8: Update TrustWallet
**Endpoint:** `PUT /api/trustwallets/:id`

**Test Steps:**
```bash
http PUT http://localhost:3000/api/trustwallets/TW-1738234567890 \
  "Authorization:Bearer ${TOKEN}" \
  name="Updated CS Department Fees" \
  installmentPlan:='{"totalAmount":120000,"downPaymentPercentage":25,"installmentCount":5,"frequency":"monthly","interestRate":2}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "TrustWallet updated successfully",
  "data": {
    "trustWalletId": "TW-1738234567890",
    "name": "Updated CS Department Fees",
    "installmentPlan": {
      "totalAmount": 120000,
      "downPaymentPercentage": 25,
      "installmentCount": 5,
      "frequency": "monthly",
      "interestRate": 2
    }
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Updated fields reflected
- ✅ Unchanged fields remain
- ✅ Audit log created with changes
- ✅ updatedAt timestamp updated

#### Test Case 3.9: Delete TrustWallet - No Active Applications
**Endpoint:** `DELETE /api/trustwallets/:id`

**Test Steps:**
```bash
http DELETE http://localhost:3000/api/trustwallets/TW-1738234567890 \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "TrustWallet deleted successfully",
  "data": null
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ TrustWallet soft deleted (isActive = false)
- ✅ Still exists in database
- ✅ Audit log created

#### Test Case 3.10: Delete TrustWallet - Has Active Applications
**Test Steps:**
```bash
# First create application for this TrustWallet (see later tests)
# Then try to delete
http DELETE http://localhost:3000/api/trustwallets/TW-WITH-APPS \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Cannot delete TrustWallet with active applications"
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ TrustWallet not deleted
- ✅ Active applications protected

---

### 4. Public Customer APIs

#### Test Case 4.1: Get Public TrustWallet Info
**Endpoint:** `GET /public/trustwallet/:trustWalletId`
**Auth Required:** No

**Test Steps:**
```bash
http GET http://localhost:3000/public/trustwallet/TW-1738234567890
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "trustWalletId": "TW-1738234567890",
    "businessName": "Lagos State University",
    "name": "Computer Science Department Fees",
    "description": "Installment payment plan for CS students",
    "installmentPlan": {
      "totalAmount": 100000,
      "downPaymentPercentage": 20,
      "installmentCount": 4,
      "frequency": "monthly",
      "interestRate": 0
    },
    "requirements": [
      "Bank account details",
      "3-month bank statement (PDF or CSV format)",
      "BVN (Bank Verification Number)"
    ]
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ No authentication required
- ✅ Sensitive business data not exposed
- ✅ Only active TrustWallets accessible
- ✅ Approval workflow not exposed

#### Test Case 4.2: Get Inactive TrustWallet
**Test Steps:**
```bash
# Try to access deleted/inactive TrustWallet
http GET http://localhost:3000/public/trustwallet/TW-INACTIVE
```

**Expected Response:**
```json
{
  "success": false,
  "error": "TrustWallet not found or inactive"
}
```

**Validation Points:**
- ✅ Status code: 404
- ✅ Inactive TrustWallets not accessible

#### Test Case 4.3: Submit Customer Application - Valid Data
**Endpoint:** `POST /public/trustwallet/:trustWalletId/apply`
**Content-Type:** `multipart/form-data`

**Prepare Test CSV File:**
```csv
Date,Description,Debit,Credit,Balance
2025-11-01,SALARY CREDIT FROM XYZ CORP,,250000,250000
2025-11-02,MTN AIRTIME,500,,249500
2025-11-03,TRANSFER TO JOHN DOE,10000,,239500
2025-11-05,POS PURCHASE - SHOPRITE,15000,,224500
2025-11-10,PHCN ELECTRICITY BILL,5000,,219500
2025-11-15,TRANSFER FROM JANE,20000,,239500
2025-12-01,SALARY CREDIT FROM XYZ CORP,,250000,489500
2025-12-02,MTN AIRTIME,500,,489000
2025-12-10,PHCN ELECTRICITY BILL,5000,,484000
2026-01-01,SALARY CREDIT FROM XYZ CORP,,250000,734000
```

**Test Steps:**
```bash
http --form POST http://localhost:3000/public/trustwallet/TW-1738234567890/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348012345678" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="12345678901" \
  bankStatement@test_statement.csv
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "applicationId": "APP-1738234567890",
    "status": "PENDING_ANALYSIS",
    "message": "Application submitted successfully. Analysis in progress.",
    "estimatedTime": "Analysis typically takes 2-5 minutes"
  }
}
```

**Validation Points:**
- ✅ Status code: 201
- ✅ applicationId generated (format: `APP-{timestamp}`)
- ✅ Initial status: PENDING_ANALYSIS
- ✅ CSV file processed in-memory (not saved to disk)
- ✅ BVN encrypted with TripleDES
- ✅ Application created in database
- ✅ Amounts calculated from TrustWallet config

**Database Verification:**
```javascript
db.applications.findOne({ applicationId: "APP-1738234567890" })
// Verify:
// - status: "PENDING_ANALYSIS"
// - customerDetails.bvn is encrypted
// - totalAmount: 100000
// - downPaymentRequired: 20000 (20% of 100000)
// - installmentAmount: 20000 ((100000-20000)/4)
// - installmentCount: 4
// - frequency: "monthly"
```

#### Test Case 4.4: Submit Application - Missing CSV File
**Test Steps:**
```bash
http --form POST http://localhost:3000/public/trustwallet/TW-1738234567890/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348012345678" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="12345678901"
  # No bankStatement file
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Bank statement PDF or CSV file is required"
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Error message indicates missing file
- ✅ No application created

#### Test Case 4.5: Submit Application - Invalid BVN Format
**Test Steps:**
```bash
http --form POST http://localhost:3000/public/trustwallet/TW-1738234567890/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348012345678" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="123456" \
  bankStatement@test_statement.csv
```

**Expected Response:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "bvn",
      "message": "BVN must be exactly 11 digits"
    }
  ]
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Validation error for BVN
- ✅ No application created

#### Test Case 4.6: Submit Application - File Too Large
**Test Steps:**
```bash
# Create CSV file > 5MB
dd if=/dev/zero of=large_file.csv bs=1M count=6

http --form POST http://localhost:3000/public/trustwallet/TW-1738234567890/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348012345678" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="12345678901" \
  bankStatement@large_file.csv
```

**Expected Response:**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 5MB"
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Multer file size limit enforced
- ✅ No application created

#### Test Case 4.7: Check Application Status - PENDING_ANALYSIS
**Endpoint:** `GET /public/application/:applicationId/status`
**Auth Required:** No

**Test Steps:**
```bash
http GET http://localhost:3000/public/application/APP-1738234567890/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "APP-1738234567890",
    "status": "PENDING_ANALYSIS",
    "message": "Your application is being analyzed. This typically takes 2-5 minutes."
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ No authentication required
- ✅ Status message user-friendly
- ✅ No sensitive data exposed

#### Test Case 4.8: Check Application Status - APPROVED with Virtual Account
**Prerequisites:** Wait for background job to analyze application

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "APP-1738234567890",
    "status": "MANDATE_ACTIVE",
    "message": "Your installment plan is active. Please pay down payment to activate.",
    "trustScore": 87,
    "decision": "APPROVED",
    "virtualAccount": {
      "accountNumber": "9876543210",
      "amount": 20000
    },
    "nextSteps": "Please transfer ₦20,000 to the virtual account to activate your installment plan."
  }
}
```

**Validation Points:**
- ✅ Status updated to MANDATE_ACTIVE
- ✅ Trust score displayed
- ✅ Virtual account details provided
- ✅ Clear next steps

#### Test Case 4.9: Check Application Status - DECLINED
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "APP-DECLINED",
    "status": "DECLINED",
    "message": "Unfortunately, your application has been declined.",
    "trustScore": 35,
    "decision": "DECLINED"
  }
}
```

**Validation Points:**
- ✅ Status: DECLINED
- ✅ Trust score below minTrustScore
- ✅ No virtual account details
- ✅ Polite decline message

---

### 5. Application Management APIs (Business)

#### Test Case 5.1: List All Applications
**Endpoint:** `GET /api/applications`
**Auth Required:** Yes

**Test Steps:**
```bash
http GET "http://localhost:3000/api/applications?page=1&limit=20" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "applicationId": "APP-1738234567890",
      "customerName": "John Doe",
      "trustWalletName": "Computer Science Department Fees",
      "status": "MANDATE_ACTIVE",
      "trustScore": 87,
      "totalAmount": 100000,
      "outstandingBalance": 80000,
      "submittedAt": "2026-01-30T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Only applications for authenticated business
- ✅ Summary data for each application
- ✅ Pagination metadata

#### Test Case 5.2: List Applications - Filter by Status
**Test Steps:**
```bash
http GET "http://localhost:3000/api/applications?status=APPROVED&page=1&limit=20" \
  "Authorization:Bearer ${TOKEN}"
```

**Validation Points:**
- ✅ Only APPROVED applications returned
- ✅ Other statuses excluded

#### Test Case 5.3: List Applications - Search by Customer Name
**Test Steps:**
```bash
http GET "http://localhost:3000/api/applications?search=John" \
  "Authorization:Bearer ${TOKEN}"
```

**Validation Points:**
- ✅ Applications matching "John" in customer name/email/phone
- ✅ Case-insensitive search

#### Test Case 5.4: Get Single Application Details
**Endpoint:** `GET /api/applications/:id`

**Test Steps:**
```bash
http GET http://localhost:3000/api/applications/APP-1738234567890 \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "APP-1738234567890",
    "trustWalletId": "TW-1738234567890",
    "businessId": "TR-BIZ-1738234567890",
    "customerDetails": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "2348012345678",
      "accountNumber": "0123456789",
      "bankCode": "058",
      "bvn": "[ENCRYPTED]"
    },
    "status": "MANDATE_ACTIVE",
    "totalAmount": 100000,
    "downPaymentRequired": 20000,
    "installmentAmount": 20000,
    "installmentCount": 4,
    "paymentsCompleted": 0,
    "totalPaid": 0,
    "outstandingBalance": 100000,
    "trustWallet": {
      "name": "Computer Science Department Fees"
    },
    "trustEngineOutput": {
      "trustScore": 87,
      "decision": "APPROVED",
      "statementAnalysis": { /* full details */ }
    },
    "payments": []
  }
}
```

**Validation Points:**
- ✅ Full application details
- ✅ BVN masked in response
- ✅ Related TrustWallet info included
- ✅ Trust engine output included
- ✅ Payment history included

#### Test Case 5.5: Manually Approve Flagged Application
**Endpoint:** `POST /api/applications/:id/approve`
**Auth Required:** Yes

**Prerequisites:**
- Application must be in FLAGGED_FOR_REVIEW status

**Test Steps:**
```bash
http POST http://localhost:3000/api/applications/APP-FLAGGED/approve \
  "Authorization:Bearer ${TOKEN}" \
  reason="Customer has good history with our institution"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Application approved successfully",
  "data": {
    "applicationId": "APP-FLAGGED",
    "status": "MANDATE_CREATED",
    "approvedAt": "2026-01-30T10:05:00.000Z",
    "pwaMandateRef": "PWA-MANDATE-123456"
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Status updated to MANDATE_CREATED
- ✅ PWA mandate created
- ✅ approvedAt timestamp set
- ✅ pwaMandateRef stored
- ✅ Webhook sent to business
- ✅ Audit log created

**PWA API Call Verification:**
```javascript
// Verify PWA createMandate was called with:
// - Encrypted customer account details
// - Encrypted BVN
// - Correct biller code
// - Total amount
```

#### Test Case 5.6: Manually Approve - Already Processed Application
**Test Steps:**
```bash
# Try to approve APPROVED application
http POST http://localhost:3000/api/applications/APP-1738234567890/approve \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Application is not in FLAGGED_FOR_REVIEW status"
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Cannot approve non-flagged applications
- ✅ No status change

#### Test Case 5.7: Manually Decline Flagged Application
**Endpoint:** `POST /api/applications/:id/decline`

**Test Steps:**
```bash
http POST http://localhost:3000/api/applications/APP-FLAGGED-2/decline \
  "Authorization:Bearer ${TOKEN}" \
  reason="Insufficient transaction history"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Application declined successfully",
  "data": {
    "applicationId": "APP-FLAGGED-2",
    "status": "DECLINED",
    "declinedAt": "2026-01-30T10:06:00.000Z"
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Status updated to DECLINED
- ✅ declinedAt timestamp set
- ✅ Decline reason stored
- ✅ Webhook sent to business
- ✅ Audit log created

---

### 6. Payment Management APIs

#### Test Case 6.1: List All Payments
**Endpoint:** `GET /api/payments`
**Auth Required:** Yes

**Test Steps:**
```bash
http GET "http://localhost:3000/api/payments?page=1&limit=20" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "transactionId": "TXN-1738234567890",
      "customerName": "John Doe",
      "trustWalletName": "Computer Science Department Fees",
      "amount": 20000,
      "status": "SUCCESSFUL",
      "scheduledDate": "2026-02-01T00:00:00.000Z",
      "paidDate": "2026-02-01T08:30:00.000Z",
      "paymentNumber": 1,
      "totalPayments": 4
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Only payments for authenticated business
- ✅ Payment summary data
- ✅ Pagination

#### Test Case 6.2: List Payments - Filter by Status
**Test Steps:**
```bash
http GET "http://localhost:3000/api/payments?status=SUCCESSFUL" \
  "Authorization:Bearer ${TOKEN}"
```

**Validation Points:**
- ✅ Only SUCCESSFUL payments returned

#### Test Case 6.3: List Payments - Filter by Date Range
**Test Steps:**
```bash
http GET "http://localhost:3000/api/payments?startDate=2026-01-01&endDate=2026-01-31" \
  "Authorization:Bearer ${TOKEN}"
```

**Validation Points:**
- ✅ Only payments within date range
- ✅ Date filtering on scheduledDate

#### Test Case 6.4: Get Single Payment Details
**Endpoint:** `GET /api/payments/:id`

**Test Steps:**
```bash
http GET http://localhost:3000/api/payments/TXN-1738234567890 \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN-1738234567890",
    "applicationId": "APP-1738234567890",
    "trustWalletId": "TW-1738234567890",
    "businessId": "TR-BIZ-1738234567890",
    "amount": 20000,
    "status": "SUCCESSFUL",
    "paymentNumber": 1,
    "totalPayments": 4,
    "scheduledDate": "2026-02-01T00:00:00.000Z",
    "paidDate": "2026-02-01T08:30:00.000Z",
    "pwaPaymentId": "PWA-PAY-123456",
    "pwaTransactionRef": "TXN-1738234567890",
    "application": {
      "applicationId": "APP-1738234567890",
      "customerName": "John Doe"
    },
    "customer": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    }
  }
}
```

**Validation Points:**
- ✅ Full payment details
- ✅ Related application info
- ✅ Customer details included
- ✅ PWA payment ID if available

---

### 7. Withdrawal Management APIs

#### Test Case 7.1: Request Withdrawal - Valid Amount
**Endpoint:** `POST /api/withdrawals`
**Auth Required:** Yes

**Prerequisites:**
- TrustWallet must have collected funds

**Test Steps:**
```bash
http POST http://localhost:3000/api/withdrawals \
  "Authorization:Bearer ${TOKEN}" \
  trustWalletId="TW-1738234567890" \
  amount=50000
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Withdrawal request created successfully",
  "data": {
    "withdrawalId": "WD-1738234567890",
    "trustWalletId": "TW-1738234567890",
    "businessId": "TR-BIZ-1738234567890",
    "amount": 50000,
    "status": "PENDING",
    "requestedAt": "2026-01-30T10:10:00.000Z"
  }
}
```

**Validation Points:**
- ✅ Status code: 201
- ✅ withdrawalId generated (format: `WD-{timestamp}`)
- ✅ Initial status: PENDING
- ✅ Amount validated against available balance
- ✅ Audit log created

#### Test Case 7.2: Request Withdrawal - Exceeds Available Balance
**Test Steps:**
```bash
http POST http://localhost:3000/api/withdrawals \
  "Authorization:Bearer ${TOKEN}" \
  trustWalletId="TW-1738234567890" \
  amount=1000000
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Insufficient balance. Available balance: ₦50,000"
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ Error indicates insufficient balance
- ✅ Shows available balance
- ✅ No withdrawal created

#### Test Case 7.3: List Withdrawal History
**Endpoint:** `GET /api/withdrawals`

**Test Steps:**
```bash
http GET "http://localhost:3000/api/withdrawals?page=1&limit=20" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "withdrawalId": "WD-1738234567890",
      "trustWalletName": "Computer Science Department Fees",
      "amount": 50000,
      "status": "PENDING",
      "requestedAt": "2026-01-30T10:10:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

**Validation Points:**
- ✅ Only withdrawals for authenticated business
- ✅ Withdrawal summary data
- ✅ Pagination

---

### 8. Dashboard & Analytics APIs

#### Test Case 8.1: Get Business Overview
**Endpoint:** `GET /api/dashboard/overview`
**Auth Required:** Yes

**Test Steps:**
```bash
http GET http://localhost:3000/api/dashboard/overview \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "trustWallets": {
      "total": 2,
      "active": 2
    },
    "applications": {
      "total": 10,
      "approved": 7,
      "declined": 2,
      "pending": 1,
      "active": 5,
      "completed": 2
    },
    "revenue": {
      "totalCollected": 500000,
      "outstandingBalance": 300000,
      "availableForWithdrawal": 450000
    },
    "payments": {
      "successfulCount": 25,
      "failedCount": 2,
      "successRate": 92.59
    },
    "recentActivity": [
      {
        "action": "payment.success",
        "description": "Payment received from John Doe",
        "timestamp": "2026-01-30T09:00:00.000Z"
      }
    ]
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ All metrics calculated correctly
- ✅ Only data for authenticated business
- ✅ Recent activity last 10 items

#### Test Case 8.2: Generate Reports - Applications JSON
**Endpoint:** `GET /api/dashboard/reports`

**Test Steps:**
```bash
http GET "http://localhost:3000/api/dashboard/reports?type=applications&format=json" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "applicationId": "APP-1738234567890",
      "customerName": "John Doe",
      "trustWalletName": "Computer Science Department Fees",
      "status": "ACTIVE",
      "trustScore": 87,
      "totalAmount": 100000,
      "submittedAt": "2026-01-30T10:00:00.000Z"
    }
  ]
}
```

**Validation Points:**
- ✅ JSON array of applications
- ✅ All applications for business

#### Test Case 8.3: Generate Reports - Payments CSV
**Test Steps:**
```bash
http GET "http://localhost:3000/api/dashboard/reports?type=payments&format=csv" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```csv
transactionId,customerName,trustWalletName,amount,status,scheduledDate,paidDate
TXN-1738234567890,John Doe,Computer Science Department Fees,20000,SUCCESSFUL,2026-02-01,2026-02-01
```

**Validation Points:**
- ✅ CSV format with headers
- ✅ All payments for business
- ✅ Content-Type: text/csv

#### Test Case 8.4: TrustWallet Analytics
**Endpoint:** `GET /api/dashboard/trustwallet/:trustWalletId/analytics`

**Test Steps:**
```bash
http GET "http://localhost:3000/api/dashboard/trustwallet/TW-1738234567890/analytics?startDate=2026-01-01&endDate=2026-01-31" \
  "Authorization:Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "applications": {
      "total": 10,
      "approved": 7,
      "declined": 2,
      "pending": 1,
      "approvalRate": 70
    },
    "trustScores": {
      "average": 75,
      "distribution": {
        "0-20": 1,
        "21-40": 1,
        "41-60": 2,
        "61-80": 3,
        "81-100": 3
      }
    },
    "revenue": {
      "totalCollected": 200000,
      "expectedTotal": 500000,
      "outstandingBalance": 300000
    },
    "payments": {
      "successfulCount": 10,
      "failedCount": 1,
      "successRate": 90.91
    }
  }
}
```

**Validation Points:**
- ✅ Analytics for specific TrustWallet only
- ✅ Date range filtering applied
- ✅ Trust score distribution calculated
- ✅ All metrics accurate

---

### 9. Webhook Configuration APIs

#### Test Case 9.1: Configure Webhook URL
**Endpoint:** `POST /api/webhooks/configure`
**Auth Required:** Yes

**Test Steps:**
```bash
http POST http://localhost:3000/api/webhooks/configure \
  "Authorization:Bearer ${TOKEN}" \
  webhookUrl="https://your-business.com/webhooks/trustrail"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook configured successfully",
  "data": {
    "webhookUrl": "https://your-business.com/webhooks/trustrail",
    "webhookSecret": "whs_1234567890abcdef",
    "events": ["all"]
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ webhookSecret generated
- ✅ webhookUrl saved in Business record
- ✅ Test ping sent to webhook URL

**Database Verification:**
```javascript
db.businesses.findOne({ businessId: "TR-BIZ-1738234567890" })
// Verify webhookUrl and webhookSecret saved
```

#### Test Case 9.2: Configure Webhook - Invalid URL
**Test Steps:**
```bash
http POST http://localhost:3000/api/webhooks/configure \
  "Authorization:Bearer ${TOKEN}" \
  webhookUrl="not-a-valid-url"
```

**Expected Response:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "webhookUrl",
      "message": "Must be a valid URL"
    }
  ]
}
```

**Validation Points:**
- ✅ Status code: 400
- ✅ URL validation error
- ✅ No webhook configured

---

### 10. Admin APIs

#### Test Case 10.1: Admin Login
**Endpoint:** `POST /admin/auth/login`
**Auth Required:** No

**Test Steps:**
```bash
http POST http://localhost:3000/admin/auth/login \
  email="admin@trustrail.com" \
  password="<ADMIN_PASSWORD from .env>"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ JWT token returned
- ✅ Token signed with ADMIN_JWT_SECRET
- ✅ Token contains role: 'admin'
- ✅ Token expires in 24 hours

#### Test Case 10.2: Admin Login - Invalid Credentials
**Test Steps:**
```bash
http POST http://localhost:3000/admin/auth/login \
  email="admin@trustrail.com" \
  password="wrong-password"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid admin credentials"
}
```

**Validation Points:**
- ✅ Status code: 401
- ✅ No token returned

#### Test Case 10.3: System Health Check
**Endpoint:** `GET /admin/health`
**Auth Required:** Yes (Admin)

**Test Steps:**
```bash
ADMIN_TOKEN="<admin-jwt-token>"

http GET http://localhost:3000/admin/health \
  "Authorization:Bearer ${ADMIN_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-30T10:15:00.000Z",
    "uptime": 3600,
    "database": {
      "status": "connected",
      "responseTime": 5
    },
    "pwa": {
      "status": "connected",
      "lastSuccessfulCall": "2026-01-30T10:14:00.000Z"
    },
    "backgroundJobs": {
      "statementAnalysisJob": {
        "running": true,
        "lastRun": "2026-01-30T10:14:00.000Z",
        "processedCount": 150
      },
      "paymentMonitorJob": {
        "running": true,
        "lastRun": "2026-01-30T10:10:00.000Z"
      }
    },
    "metrics": {
      "totalBusinesses": 25,
      "totalApplications": 500,
      "pendingAnalysis": 5,
      "activePayments": 200
    }
  }
}
```

**Validation Points:**
- ✅ Status code: 200
- ✅ Requires admin authentication
- ✅ All system metrics present
- ✅ Database status checked
- ✅ PWA API status checked
- ✅ Background jobs status included

#### Test Case 10.4: PWA Health Check
**Endpoint:** `GET /admin/pwa-health`

**Test Steps:**
```bash
http GET http://localhost:3000/admin/pwa-health \
  "Authorization:Bearer ${ADMIN_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pwaApi": {
      "status": "connected",
      "lastTestAt": "2026-01-30T10:15:00.000Z",
      "responseTime": 120
    },
    "webhooks": {
      "received": {
        "last24Hours": 150,
        "lastReceived": "2026-01-30T10:14:00.000Z",
        "signatureFailures": 0,
        "processingErrors": 2
      },
      "sent": {
        "last24Hours": 145,
        "deliverySuccessRate": 98.6,
        "pendingRetries": 3
      }
    }
  }
}
```

**Validation Points:**
- ✅ PWA API connectivity tested
- ✅ Webhook statistics accurate
- ✅ Signature verification stats
- ✅ Delivery success rate calculated

#### Test Case 10.5: View Audit Logs
**Endpoint:** `GET /admin/audit-logs`

**Test Steps:**
```bash
http GET "http://localhost:3000/admin/audit-logs?page=1&limit=50&action=application.approve" \
  "Authorization:Bearer ${ADMIN_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "logId": "AUD-1738234567890",
      "action": "application.approve",
      "actor": {
        "type": "business",
        "id": "TR-BIZ-1738234567890",
        "email": "admin@lasu.edu.ng"
      },
      "resourceType": "Application",
      "resourceId": "APP-1738234567890",
      "changes": {
        "status": {
          "before": "FLAGGED_FOR_REVIEW",
          "after": "APPROVED"
        }
      },
      "metadata": {
        "notes": "Manually approved by business owner"
      },
      "timestamp": "2026-01-30T10:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

**Validation Points:**
- ✅ Audit logs returned
- ✅ Filters applied correctly
- ✅ Actor information included
- ✅ Changes tracked for updates

#### Test Case 10.6: View All Applications (Admin)
**Endpoint:** `GET /admin/applications`

**Test Steps:**
```bash
http GET "http://localhost:3000/admin/applications?page=1&limit=50&status=APPROVED&minTrustScore=80" \
  "Authorization:Bearer ${ADMIN_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "applicationId": "APP-1738234567890",
      "businessName": "Lagos State University",
      "trustWalletName": "Computer Science Department Fees",
      "customerName": "John Doe",
      "customerPhone": "2348012345678",
      "status": "APPROVED",
      "trustScore": 87,
      "totalAmount": 100000,
      "submittedAt": "2026-01-30T10:00:00.000Z",
      "analyzedAt": "2026-01-30T10:02:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 1,
    "totalPages": 1
  },
  "summary": {
    "totalCount": 1,
    "statusCounts": {
      "APPROVED": 1
    },
    "averageTrustScore": 87
  }
}
```

**Validation Points:**
- ✅ Applications from all businesses
- ✅ Advanced filters applied
- ✅ Summary statistics included
- ✅ Admin-only access

---

## Complete Flow Testing

### Flow 1: Happy Path - Customer Gets Approved and Completes Payments

**Scenario:** Customer applies, gets auto-approved, pays down payment, completes all installments

**Test Steps:**

1. **Business Registration**
```bash
# Step 1.1: Business registers
http POST http://localhost:3000/api/auth/register \
  businessName="Lagos State University" \
  email="admin@lasu.edu.ng" \
  password="SecurePass123!" \
  phoneNumber="2348012345678" \
  rcNumber="RC123456" \
  settlementAccountNumber="0123456789" \
  settlementBankCode="058" \
  settlementAccountName="LASU Payment Account"

# Capture TOKEN from response
```

2. **Create TrustWallet**
```bash
# Step 1.2: Business creates TrustWallet
http POST http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}" \
  name="CS Department Fees" \
  installmentPlan:='{"totalAmount":100000,"downPaymentPercentage":20,"installmentCount":4,"frequency":"monthly","interestRate":0}' \
  approvalWorkflow:='{"autoApproveThreshold":85,"autoDeclineThreshold":40,"minTrustScore":50}'

# Capture TRUSTWALLET_ID from response
```

3. **Customer Submits Application**
```bash
# Step 1.3: Customer applies with good bank statement
http --form POST http://localhost:3000/public/trustwallet/${TRUSTWALLET_ID}/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348012345678" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="12345678901" \
  bankStatement@good_statement.csv

# Capture APPLICATION_ID from response
```

4. **Wait for Analysis (Background Job)**
```bash
# Step 1.4: Wait 1-2 minutes for statement analysis job
# Monitor application status
http GET http://localhost:3000/public/application/${APPLICATION_ID}/status

# Should transition through:
# PENDING_ANALYSIS → ANALYZING → APPROVED → MANDATE_CREATED
```

5. **Verify PWA Mandate Creation**
```bash
# Step 1.5: Check application details
http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}"

# Verify pwaMandateRef is set
```

6. **Trigger Mandate Activation (Using OnePipe Mock)**
```bash
# Step 1.6: Get the biller code and mandate ref
BILLER_CODE=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}" | jq -r '.data.businessDetails.billerCode')

MANDATE_REF=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}" | jq -r '.data.pwaMandateRef')

# Use OnePipe mock to trigger mandate activation webhook
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="activate_mandate" \
  biller_code="${BILLER_CODE}" \
  mandate_ref="${MANDATE_REF}" \
  transaction_ref="${APPLICATION_ID}"

# Status should update to MANDATE_ACTIVE
# Virtual account should be created
```

**Alternative (Direct PWA Webhook):**
```bash
# If you want to test webhook processing directly
http POST http://localhost:3000/webhooks/pwa \
  request_ref="PWA-MANDATE-123" \
  request_type="mandate" \
  details:='{
    "status": "Successful",
    "transaction_ref": "<pwaMandateRef from step 1.5>",
    "data": {
      "data": {
        "id": 12345,
        "reference": "<pwaMandateRef>"
      }
    },
    "meta": {
      "event_type": "activate_mandate",
      "signature_hash": "mock-signature"
    }
  }'
```

7. **Customer Checks Status - Virtual Account Provided**
```bash
# Step 1.7: Customer checks status
http GET http://localhost:3000/public/application/${APPLICATION_ID}/status

# Response should include virtualAccount details
```

8. **Simulate Down Payment (Using OnePipe Mock)**
```bash
# Step 1.8: Get virtual account number
VIRTUAL_ACCOUNT=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}" | jq -r '.data.virtualAccountNumber')

# Use OnePipe mock to trigger down payment credit webhook
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="credit" \
  biller_code="${BILLER_CODE}" \
  virtual_account="${VIRTUAL_ACCOUNT}" \
  amount=20000

# downPaymentReceived should be true
# Installment invoice should be sent to PWA
```

**Alternative (Direct PWA Webhook):**
```bash
http POST http://localhost:3000/webhooks/pwa \
  request_ref="PWA-CREDIT-123" \
  request_type="credit" \
  details:='{
    "status": "Successful",
    "amount": 20000,
    "meta": {
      "cr_account": "<virtualAccountNumber>",
      "event_type": "credit",
      "signature_hash": "mock-signature"
    }
  }'
```

9. **Verify Payment Transactions Created**
```bash
# Step 1.9: Check payments
http GET "http://localhost:3000/api/payments?applicationId=${APPLICATION_ID}" \
  "Authorization:Bearer ${TOKEN}"

# Should have 4 SCHEDULED payment transactions
```

10. **Simulate Monthly Installment Payments (Using OnePipe Mock)**
```bash
# Step 1.10: Get payment transactions
PAYMENTS=$(http GET "http://localhost:3000/api/payments?applicationId=${APPLICATION_ID}" \
  "Authorization:Bearer ${TOKEN}" | jq -r '.data[] | .transactionId')

# Trigger successful payment for each transaction
for PAYMENT_ID in $PAYMENTS; do
  echo "Processing payment: $PAYMENT_ID"

  # Use OnePipe mock to trigger successful payment
  http POST http://localhost:3000/onepipe-mock/trigger-webhook \
    webhook_type="debit" \
    biller_code="${BILLER_CODE}" \
    payment_id="${PAYMENT_ID}" \
    transaction_ref="${PAYMENT_ID}" \
    amount=20000 \
    status="Successful"

  # Wait a moment between payments
  sleep 2
done

# After last payment, application status should be COMPLETED
```

**Alternative - Single Payment (Direct PWA Webhook):**
```bash
# Get first payment transaction ID
TRANSACTION_ID=$(http GET "http://localhost:3000/api/payments?applicationId=${APPLICATION_ID}" \
  "Authorization:Bearer ${TOKEN}" | jq -r '.data[0].transactionId')

# Trigger successful payment webhook
http POST http://localhost:3000/webhooks/pwa \
  request_ref="PWA-DEBIT-1" \
  request_type="debit" \
  details:='{
    "status": "Successful",
    "transaction_ref": "'${TRANSACTION_ID}'",
    "amount": 20000,
    "meta": {
      "event_type": "debit",
      "payment_id": "PWA-PAY-001",
      "signature_hash": "mock-signature"
    }
  }'
```

11. **Verify Final Status**
```bash
# Step 1.11: Check final application status
http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}"

# Verify:
# - status: COMPLETED
# - paymentsCompleted: 4
# - totalPaid: 100000
# - outstandingBalance: 0
```

12. **Business Withdraws Funds**
```bash
# Step 1.12: Business requests withdrawal
http POST http://localhost:3000/api/withdrawals \
  "Authorization:Bearer ${TOKEN}" \
  trustWalletId="${TRUSTWALLET_ID}" \
  amount=100000

# Withdrawal status: PENDING
```

**Validation Checkpoints:**
- ✅ Business registered and received billerCode
- ✅ TrustWallet created with correct config
- ✅ Application created with PENDING_ANALYSIS
- ✅ Background job analyzed statement
- ✅ Trust score calculated correctly (>= 85)
- ✅ Auto-approved based on threshold
- ✅ PWA mandate created successfully
- ✅ Mandate activated via webhook
- ✅ Virtual account created
- ✅ Down payment webhook processed
- ✅ 4 payment transactions scheduled
- ✅ Each payment webhook processed correctly
- ✅ Application marked COMPLETED
- ✅ Business webhooks sent for each event
- ✅ Audit logs created for all actions
- ✅ Withdrawal request created

---

### Flow 1.1: Complete E2E Test Using OnePipe Mock (RECOMMENDED)

**Scenario:** Full end-to-end test using the built-in OnePipe mock for easy testing without external dependencies.

**Prerequisites:**
```bash
# Ensure .env is configured for mock
PWA_BASE_URL=http://localhost:3000/onepipe-mock/transact
PWA_MOCK_MODE=Inspect
PWA_API_KEY=mock-api-key
TRIPLE_DES_KEY=mock1234567890123456789012

# Reset mock data before starting
http POST http://localhost:3000/onepipe-mock/reset
```

**Complete Test Script:**

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== TrustRail E2E Test with OnePipe Mock ===${NC}\n"

# 1. Reset mock data
echo -e "${BLUE}Step 1: Resetting OnePipe mock data${NC}"
http POST http://localhost:3000/onepipe-mock/reset

# 2. Register business
echo -e "\n${BLUE}Step 2: Registering business${NC}"
REGISTER_RESPONSE=$(http --json POST http://localhost:3000/api/auth/register \
  businessName="E2E Test University" \
  email="e2e-$(date +%s)@test.com" \
  password="SecurePass123!" \
  phoneNumber="2348012345678" \
  rcNumber="RC$(date +%s)" \
  settlementAccountNumber="0123456789" \
  settlementBankCode="058" \
  settlementAccountName="E2E Test Account")

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
BILLER_CODE=$(echo $REGISTER_RESPONSE | jq -r '.data.business.billerCode')

echo -e "${GREEN}✓ Business registered. Biller Code: $BILLER_CODE${NC}"

# 3. Create TrustWallet
echo -e "\n${BLUE}Step 3: Creating TrustWallet${NC}"
TW_RESPONSE=$(http --json POST http://localhost:3000/api/trustwallets \
  "Authorization:Bearer ${TOKEN}" \
  name="E2E Test Fees" \
  description="End-to-end test installment plan" \
  installmentPlan:='{
    "totalAmount": 100000,
    "downPaymentPercentage": 20,
    "installmentCount": 4,
    "frequency": "monthly",
    "interestRate": 0
  }' \
  approvalWorkflow:='{
    "autoApproveThreshold": 85,
    "autoDeclineThreshold": 40,
    "minTrustScore": 50
  }')

TRUSTWALLET_ID=$(echo $TW_RESPONSE | jq -r '.data.trustWalletId')

echo -e "${GREEN}✓ TrustWallet created: $TRUSTWALLET_ID${NC}"

# 4. Create good bank statement CSV
echo -e "\n${BLUE}Step 4: Creating test bank statement${NC}"
cat > /tmp/good_statement.csv << 'EOF'
Date,Description,Debit,Credit,Balance
2025-11-01,SALARY CREDIT FROM XYZ CORP,,250000,250000
2025-11-02,MTN AIRTIME,500,,249500
2025-11-03,TRANSFER TO JOHN DOE,10000,,239500
2025-11-05,POS PURCHASE - SHOPRITE,15000,,224500
2025-11-10,PHCN ELECTRICITY BILL,5000,,219500
2025-11-15,TRANSFER FROM JANE,,20000,239500
2025-12-01,SALARY CREDIT FROM XYZ CORP,,250000,489500
2025-12-02,MTN AIRTIME,500,,489000
2025-12-10,PHCN ELECTRICITY BILL,5000,,484000
2025-12-15,TRANSFER TO SAVINGS,30000,,454000
2026-01-01,SALARY CREDIT FROM XYZ CORP,,250000,704000
2026-01-02,MTN AIRTIME,500,,703500
2026-01-10,PHCN ELECTRICITY BILL,5000,,698500
EOF

echo -e "${GREEN}✓ Test CSV created${NC}"

# 5. Submit customer application
echo -e "\n${BLUE}Step 5: Submitting customer application${NC}"
APP_RESPONSE=$(http --form POST http://localhost:3000/public/trustwallet/${TRUSTWALLET_ID}/apply \
  firstName="John" \
  lastName="Doe" \
  email="john.doe@example.com" \
  phoneNumber="2348087654321" \
  accountNumber="0123456789" \
  bankCode="058" \
  bvn="12345678901" \
  bankStatement@/tmp/good_statement.csv)

APPLICATION_ID=$(echo $APP_RESPONSE | jq -r '.data.applicationId')

echo -e "${GREEN}✓ Application submitted: $APPLICATION_ID${NC}"

# 6. Wait for background job to process
echo -e "\n${BLUE}Step 6: Waiting for trust engine analysis (60 seconds)${NC}"
sleep 65

# 7. Check application status
echo -e "\n${BLUE}Step 7: Checking application status${NC}"
STATUS_RESPONSE=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}")

STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.status')
MANDATE_REF=$(echo $STATUS_RESPONSE | jq -r '.data.pwaMandateRef')
TRUST_SCORE=$(echo $STATUS_RESPONSE | jq -r '.data.trustEngineOutput.trustScore // "N/A"')

echo -e "${GREEN}✓ Status: $STATUS, Trust Score: $TRUST_SCORE${NC}"

if [ "$STATUS" == "MANDATE_CREATED" ]; then
  echo -e "${GREEN}✓ PWA mandate created: $MANDATE_REF${NC}"
else
  echo -e "⚠ Expected MANDATE_CREATED, got: $STATUS"
  exit 1
fi

# 8. Trigger mandate activation
echo -e "\n${BLUE}Step 8: Triggering mandate activation webhook${NC}"
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="activate_mandate" \
  biller_code="${BILLER_CODE}" \
  mandate_ref="${MANDATE_REF}" \
  transaction_ref="${APPLICATION_ID}"

sleep 2

# 9. Verify mandate activated
STATUS_RESPONSE=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}")

STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.status')
VIRTUAL_ACCOUNT=$(echo $STATUS_RESPONSE | jq -r '.data.virtualAccountNumber')

echo -e "${GREEN}✓ Status: $STATUS, Virtual Account: $VIRTUAL_ACCOUNT${NC}"

# 10. Trigger down payment
echo -e "\n${BLUE}Step 9: Triggering down payment webhook${NC}"
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="credit" \
  biller_code="${BILLER_CODE}" \
  virtual_account="${VIRTUAL_ACCOUNT}" \
  amount=20000

sleep 2

# 11. Verify payments scheduled
echo -e "\n${BLUE}Step 10: Verifying payment transactions created${NC}"
PAYMENTS_RESPONSE=$(http GET "http://localhost:3000/api/payments?applicationId=${APPLICATION_ID}" \
  "Authorization:Bearer ${TOKEN}")

PAYMENT_COUNT=$(echo $PAYMENTS_RESPONSE | jq '.data | length')

echo -e "${GREEN}✓ $PAYMENT_COUNT payment transactions scheduled${NC}"

# 12. Process all installment payments
echo -e "\n${BLUE}Step 11: Processing installment payments${NC}"
for i in {1..4}; do
  PAYMENT_ID=$(echo $PAYMENTS_RESPONSE | jq -r ".data[$((i-1))].transactionId")

  echo -e "  Processing payment $i of 4: $PAYMENT_ID"

  http POST http://localhost:3000/onepipe-mock/trigger-webhook \
    webhook_type="debit" \
    biller_code="${BILLER_CODE}" \
    payment_id="${PAYMENT_ID}" \
    transaction_ref="${PAYMENT_ID}" \
    amount=20000 \
    status="Successful" > /dev/null

  sleep 2
done

echo -e "${GREEN}✓ All payments processed${NC}"

# 13. Verify final status
echo -e "\n${BLUE}Step 12: Verifying final application status${NC}"
FINAL_RESPONSE=$(http GET http://localhost:3000/api/applications/${APPLICATION_ID} \
  "Authorization:Bearer ${TOKEN}")

FINAL_STATUS=$(echo $FINAL_RESPONSE | jq -r '.data.status')
PAYMENTS_COMPLETED=$(echo $FINAL_RESPONSE | jq -r '.data.paymentsCompleted')
TOTAL_PAID=$(echo $FINAL_RESPONSE | jq -r '.data.totalPaid')
OUTSTANDING=$(echo $FINAL_RESPONSE | jq -r '.data.outstandingBalance')

echo -e "${GREEN}✓ Final Status: $FINAL_STATUS${NC}"
echo -e "${GREEN}✓ Payments Completed: $PAYMENTS_COMPLETED/4${NC}"
echo -e "${GREEN}✓ Total Paid: ₦$TOTAL_PAID${NC}"
echo -e "${GREEN}✓ Outstanding Balance: ₦$OUTSTANDING${NC}"

# 14. Request withdrawal
echo -e "\n${BLUE}Step 13: Requesting withdrawal${NC}"
WITHDRAWAL_RESPONSE=$(http --json POST http://localhost:3000/api/withdrawals \
  "Authorization:Bearer ${TOKEN}" \
  trustWalletId="${TRUSTWALLET_ID}" \
  amount=100000)

WITHDRAWAL_ID=$(echo $WITHDRAWAL_RESPONSE | jq -r '.data.withdrawalId')

echo -e "${GREEN}✓ Withdrawal requested: $WITHDRAWAL_ID${NC}"

# 15. Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}✓ Business registered and merchant created${NC}"
echo -e "${GREEN}✓ TrustWallet created${NC}"
echo -e "${GREEN}✓ Customer application submitted${NC}"
echo -e "${GREEN}✓ Bank statement analyzed (Score: $TRUST_SCORE)${NC}"
echo -e "${GREEN}✓ Application auto-approved${NC}"
echo -e "${GREEN}✓ PWA mandate created and activated${NC}"
echo -e "${GREEN}✓ Virtual account created${NC}"
echo -e "${GREEN}✓ Down payment processed${NC}"
echo -e "${GREEN}✓ 4 installment payments completed${NC}"
echo -e "${GREEN}✓ Application status: $FINAL_STATUS${NC}"
echo -e "${GREEN}✓ Withdrawal requested${NC}"

echo -e "\n${GREEN}🎉 E2E Test PASSED!${NC}\n"

# Cleanup
rm -f /tmp/good_statement.csv
```

**Save this script as `e2e-test-with-mock.sh` and run:**
```bash
chmod +x e2e-test-with-mock.sh
./e2e-test-with-mock.sh
```

**Expected Duration:** ~3-4 minutes

**Validation Points:**
- ✅ OnePipe mock creates merchant automatically
- ✅ Business receives biller code
- ✅ TrustWallet created successfully
- ✅ Application submitted and analyzed
- ✅ Trust score ≥ 85 (auto-approved)
- ✅ Mock creates mandate successfully
- ✅ Mock webhook triggers mandate activation
- ✅ Mock creates virtual account
- ✅ Mock webhook processes down payment
- ✅ 4 payment transactions scheduled
- ✅ Mock webhooks process all payments
- ✅ Application marked COMPLETED
- ✅ Withdrawal request created

**Debug Commands:**
```bash
# View mock data
http GET http://localhost:3000/onepipe-mock/data

# Check business webhooks sent
http GET "http://localhost:3000/api/audit-logs?action=webhook" \
  "Authorization:Bearer ${TOKEN}"

# Check application audit trail
http GET "http://localhost:3000/api/audit-logs?resourceId=${APPLICATION_ID}" \
  "Authorization:Bearer ${TOKEN}"
```

---

### Flow 2: Customer Gets Declined Due to Low Trust Score

**Test CSV:** Create statement with:
- Inconsistent income
- High gambling activity
- Multiple bounced transactions
- Low average balance

**Expected Outcome:**
- Trust score < 40 (autoDeclineThreshold)
- Status: DECLINED
- No PWA mandate created
- Business receives decline webhook

**Validation:**
- ✅ Trust engine correctly identifies risks
- ✅ Trust score calculation accurate
- ✅ Auto-decline logic works
- ✅ No PWA API calls made

---

### Flow 3: Customer Gets Flagged for Manual Review

**Test CSV:** Create statement with:
- Trust score between 40-84
- Some risk flags but not critical

**Expected Outcome:**
- Trust score: 50-84
- Status: FLAGGED_FOR_REVIEW
- Business receives flagged webhook
- Business can manually approve/decline

**Test Steps:**
1. Submit application → FLAGGED_FOR_REVIEW
2. Business views trust engine output
3. Business manually approves
4. PWA mandate created
5. Continue with payment flow

**Validation:**
- ✅ Auto-decision logic respects thresholds
- ✅ Manual approval creates mandate
- ✅ Audit log tracks manual action

---

### Flow 4: Payment Default Detection

**Scenario:** Customer fails 3 consecutive payments

**Test Steps:**
1. Complete flow 1 up to active payments
2. Simulate 3 failed debit webhooks
3. Verify application marked as DEFAULTED
4. Verify business receives default webhook

**Validation:**
- ✅ Payment monitor job detects defaults
- ✅ Application status updated to DEFAULTED
- ✅ Business notified immediately
- ✅ Remaining payments not attempted

---

### Flow 5: Concurrent Applications Processing

**Scenario:** Multiple customers apply simultaneously

**Test Steps:**
1. Submit 10 applications in parallel
2. Wait for background job to process
3. Verify all processed correctly
4. Check no race conditions

**Validation:**
- ✅ Background job processes 10 at a time
- ✅ No duplicate processing
- ✅ All statuses updated correctly
- ✅ No database conflicts

---

## Integration Testing

### Integration Test 1: PWA API Integration

**Test:** End-to-end PWA API flow

**Components:**
- encryptionService (TripleDES)
- signatureGenerator (MD5)
- pwaService (API calls)
- pwaWebhookService (webhook processing)

**Test Steps:**

1. **Create Merchant (Registration)**
```javascript
// Mock PWA API endpoint
POST https://api.dev.onepipe.io/v2/transact
{
  "request_ref": "TR-REG-123",
  "request_type": "create merchant",
  "transaction": {
    "details": {
      "business_name": "Test Business",
      "settlement_account": "0123456789"
    }
  }
}

// Verify signature: MD5(API_KEY + ";" + request_ref)
// Verify response contains billerCode
```

2. **Create Mandate (Approval)**
```javascript
// Verify TripleDES encryption
const encrypted = encryptForPWA("0123456789", "058");
// Should match PWA expected format

// Verify mandate request
POST https://api.dev.onepipe.io/v2/transact
{
  "request_ref": "TR-MANDATE-123",
  "request_type": "create mandate",
  "auth": {
    "secure": "<encrypted credentials>"
  },
  "meta": {
    "bvn": "<encrypted BVN>",
    "biller_code": "BLR123456"
  }
}
```

3. **Send Invoice (Virtual Account Creation)**
```javascript
POST https://api.dev.onepipe.io/v2/transact
{
  "request_ref": "TR-INVOICE-123",
  "request_type": "send invoice",
  "meta": {
    "type": "instalment",
    "down_payment": 20000,
    "repeat_frequency": "monthly",
    "number_of_payments": 4
  }
}

// Verify virtual account in response
```

4. **Process Webhooks**
```javascript
// Test signature verification
const signature = generateMD5(API_KEY + ";" + request_ref);
// Must match webhook signature_hash

// Test debit event processing
// Test credit event processing
// Test mandate activation processing
```

**Validation:**
- ✅ Encryption matches PWA expectations
- ✅ Signatures verified correctly
- ✅ All API calls successful
- ✅ Webhook signatures validated
- ✅ Webhook events processed correctly

---

### Integration Test 2: Background Jobs

**Test:** Background job execution and error handling

**Components:**
- statementAnalysisJob
- paymentMonitorJob
- jobScheduler

**Test Steps:**

1. **Statement Analysis Job**
```bash
# Create 15 pending applications
# Wait for job to run (60s interval)
# Verify:
# - Processes 10 applications per run
# - Remaining 5 queued for next run
# - Job doesn't crash on errors
# - Failed applications stay in ANALYZING
```

2. **Payment Monitor Job**
```bash
# Create applications with overdue payments
# Wait for job to run (5min interval)
# Verify:
# - Detects overdue payments
# - Marks defaults after 3 failures
# - Logs warnings
# - Sends webhooks
```

3. **Job Error Handling**
```bash
# Test job resilience:
# - MongoDB disconnect during job
# - PWA API down during mandate creation
# - Invalid CSV format
# Verify:
# - Jobs log errors and continue
# - Server doesn't crash
# - Jobs retry on next run
```

**Validation:**
- ✅ Jobs run on schedule
- ✅ Process limits respected
- ✅ Error handling works
- ✅ No memory leaks
- ✅ Logs comprehensive

---

### Integration Test 3: Webhook Delivery

**Test:** Business webhook notification system

**Components:**
- webhookService (sending)
- BusinessWebhookLog (tracking)
- Signature generation (HMAC-SHA256)

**Test Steps:**

1. **Configure Webhook**
```bash
# Setup test webhook receiver
# Configure business webhook URL
# Verify webhook secret generated
```

2. **Trigger Events**
```bash
# Trigger various events:
# - application.approved
# - application.declined
# - payment.success
# - payment.failed
# - downpayment.received
# - mandate.activated
```

3. **Verify Deliveries**
```javascript
// Check BusinessWebhookLog
db.businesswebhooklogs.find({})

// Verify:
// - Webhook sent for each event
// - Correct payload
// - Signature included
// - Retry logic on failures
```

**Validation:**
- ✅ Webhooks sent for all events
- ✅ Payloads formatted correctly
- ✅ Signatures valid (HMAC-SHA256)
- ✅ Retry on failure
- ✅ Delivery logs accurate

---

## Error Handling & Edge Cases

### Error Scenario 1: Invalid JWT Token

**Test Cases:**
- Expired token
- Invalid signature
- Malformed token
- Missing token
- Token for wrong business

**Expected:**
- 401 Unauthorized
- Clear error message
- No data access

---

### Error Scenario 2: Database Failures

**Test Cases:**
- MongoDB disconnect during request
- Duplicate key errors
- Validation errors
- Write concerns

**Expected:**
- Graceful error handling
- Appropriate HTTP status codes
- No data corruption
- Transaction rollback where applicable

---

### Error Scenario 3: PWA API Failures

**Test Cases:**
- Network timeout
- 4xx errors from PWA
- 5xx errors from PWA
- Invalid response format
- Missing required fields

**Expected:**
- Retry logic for network errors
- No retry for 4xx errors
- Error logged
- Application status preserved
- User notified

---

### Edge Case 1: Concurrent Updates

**Scenario:** Multiple requests updating same resource

**Test:**
```bash
# Run 10 concurrent requests to update TrustWallet
parallel -j10 'http PUT http://localhost:3000/api/trustwallets/TW-123 "Authorization:Bearer ${TOKEN}" name="Updated {#}"' ::: {1..10}

# Verify:
# - No race conditions
# - Last write wins or proper locking
# - All updates audited
```

---

### Edge Case 2: Large CSV Files

**Scenario:** Customer uploads 4.9MB CSV (near limit)

**Test:**
- Verify memory handling
- Ensure parsing completes
- Check for memory leaks

---

### Edge Case 3: Special Characters in Names

**Scenario:** Customer name with emojis, unicode, special chars

**Test:**
```bash
firstName="José María 李明" \
lastName="O'Connor-Smith 👨‍💼"

# Verify:
# - Data saved correctly
# - Retrieved without corruption
# - Displays properly
```

---

## Performance Testing

### Performance Test 1: API Response Times

**Target:** 95% of requests < 200ms

**Test:**
```bash
# Use Apache Bench or wrk
ab -n 1000 -c 10 http://localhost:3000/health
ab -n 1000 -c 10 -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/api/trustwallets

# Measure:
# - Average response time
# - 95th percentile
# - 99th percentile
# - Failures
```

**Acceptance Criteria:**
- ✅ 95% < 200ms
- ✅ 99% < 500ms
- ✅ 0% errors

---

### Performance Test 2: Concurrent User Load

**Target:** Support 100 concurrent users

**Test:**
```bash
# Simulate 100 concurrent users
# Mix of operations:
# - 40% read operations
# - 40% write operations
# - 20% complex queries

# Monitor:
# - Response times
# - Error rates
# - Memory usage
# - CPU usage
```

---

### Performance Test 3: Background Job Performance

**Test:** 1000 pending applications

**Metrics:**
- Time to process all applications
- Memory usage during processing
- Error rate
- No performance degradation

---

## Security Testing

### Security Test 1: Authentication Bypass Attempts

**Tests:**
- Access protected routes without token
- Use expired token
- Use token from different business
- Use admin token for business routes
- SQL injection in login

**Expected:**
- All blocked with 401/403
- No data leakage
- Attempts logged

---

### Security Test 2: Authorization Checks

**Tests:**
- Business A accessing Business B's data
- Regular user accessing admin endpoints
- Accessing deleted/inactive resources

**Expected:**
- 404 (not revealing existence)
- No data leakage

---

### Security Test 3: Encryption Validation

**Tests:**
- BVN encryption/decryption
- Password hashing (bcrypt)
- TripleDES for PWA
- JWT signing

**Expected:**
- All encryption strong
- No plaintext storage
- Proper key management

---

### Security Test 4: Input Validation

**Tests:**
- XSS attempts in names
- SQL injection in search
- Path traversal in file uploads
- Large payloads (DoS)
- Malformed JSON
- CSV injection

**Expected:**
- All sanitized
- Validation errors returned
- No code execution

---

## Test Data Requirements

### 1. Good Bank Statement (Auto-Approve)
- 3 months of consistent salary (₦250k/month)
- Low spending
- No bounces
- Good average balance
- No gambling
- Expected Score: 85+

### 2. Poor Bank Statement (Auto-Decline)
- Inconsistent income
- Multiple bounces (5+)
- High gambling activity
- Overdraft usage
- Low balance
- Expected Score: <40

### 3. Borderline Statement (Flagged)
- Some risk flags
- Moderate income
- Few bounces (1-2)
- Expected Score: 50-84

### 4. Test Business Accounts
- At least 3 test businesses
- Different settlement banks
- Various TrustWallet configs

### 5. Test PWA Credentials
- Mock PWA API or test credentials
- Valid API key for signature generation

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] MongoDB running and accessible
- [ ] Server running on port 3000
- [ ] Environment variables configured
- [ ] Test data prepared
- [ ] HTTPie/Postman installed
- [ ] Test database cleaned

### Test Execution
- [ ] Run health check
- [ ] Test all authentication APIs
- [ ] Test all TrustWallet APIs
- [ ] Test all Application APIs
- [ ] Test all Payment APIs
- [ ] Test all Withdrawal APIs
- [ ] Test all Dashboard APIs
- [ ] Test all Webhook APIs
- [ ] Test all Public APIs
- [ ] Test all Admin APIs
- [ ] Test complete flows (4 flows)
- [ ] Test error scenarios
- [ ] Test edge cases
- [ ] Run integration tests
- [ ] Run performance tests
- [ ] Run security tests

### Post-Test Verification
- [ ] All audit logs created
- [ ] Database consistency verified
- [ ] No memory leaks
- [ ] All webhooks delivered
- [ ] Background jobs stable
- [ ] No unhandled errors in logs

---

## Success Criteria

### Functional Requirements
- ✅ All 33 API endpoints working
- ✅ All 4 complete flows successful
- ✅ Trust engine calculations accurate
- ✅ PWA integration functional
- ✅ Background jobs executing
- ✅ Webhooks delivering

### Non-Functional Requirements
- ✅ 95% requests < 200ms
- ✅ Supports 100 concurrent users
- ✅ No security vulnerabilities
- ✅ All data encrypted at rest
- ✅ Comprehensive audit trail
- ✅ Error handling robust

### Quality Metrics
- ✅ 0% API failures
- ✅ 100% test coverage for critical paths
- ✅ No data corruption
- ✅ No memory leaks
- ✅ Logs comprehensive and useful

---

**End of Comprehensive Test Plan**
