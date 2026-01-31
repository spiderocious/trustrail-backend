# TrustRail API Testing Documentation

This directory contains comprehensive testing documentation and automated test scripts for the TrustRail BNPL platform.

## 📁 Contents

1. **COMPREHENSIVE-TEST-PLAN.md** - Complete testing strategy and test cases for all APIs
2. **api-test-script.sh** - Automated bash script to test all API endpoints
3. **README.md** - This file

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install required tools
brew install httpie  # macOS
# or
sudo apt-get install httpie  # Linux

# Install jq for JSON parsing
brew install jq  # macOS
# or
sudo apt-get install jq  # Linux

# Configure .env for OnePipe mock (RECOMMENDED for testing)
# Edit backend/.env and set:
PWA_BASE_URL=http://localhost:3000/onepipe-mock/transact
PWA_MOCK_MODE=Inspect
PWA_API_KEY=mock-api-key-for-testing
TRIPLE_DES_KEY=mock1234567890123456789012

### OpenAI Configuration (Optional)

TrustRail supports AI-powered bank statement analysis using OpenAI:

```bash
# Enable OpenAI analysis (optional)
OPENAI_ENABLED=true
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o
OPENAI_PROMPT="Your custom analysis prompt..."
```

**Features:**
- ✅ Supports both PDF and CSV bank statements
- ✅ More comprehensive analysis than JS-based approach
- ✅ Configurable prompt for custom analysis requirements
- ✅ Falls back to JS analysis if OpenAI fails

**To disable OpenAI** (use JS fallback):
```bash
OPENAI_ENABLED=false
```


# Ensure server is running (starts both TrustRail + OnePipe mock)
cd backend
npm run dev
```

### Run Automated Tests

```bash
# Make scripts executable
chmod +x docs/testing/api-test-script.sh
chmod +x docs/testing/e2e-test-with-onepipe-mock.sh

# Run all API tests (quick validation)
./docs/testing/api-test-script.sh

# Run complete E2E test with OnePipe mock (RECOMMENDED)
./docs/testing/e2e-test-with-onepipe-mock.sh

# Run with custom base URL
BASE_URL=http://localhost:4000 ./docs/testing/api-test-script.sh
```

**What's the difference?**
- `api-test-script.sh` - Tests individual API endpoints (~2-3 minutes)
- `e2e-test-with-onepipe-mock.sh` - Tests complete customer journey including PWA integration (~3-4 minutes)

**Which one should I run?**
- For **quick API validation**: Run `api-test-script.sh`
- For **full end-to-end flow testing**: Run `e2e-test-with-onepipe-mock.sh` (RECOMMENDED)

---

## 🎭 OnePipe Mock for E2E Testing

TrustRail includes a **built-in OnePipe mock server** that simulates the PayWithAccount API without requiring external dependencies. This is **HIGHLY RECOMMENDED** for testing.

### Why Use the Mock?

✅ **No external API dependencies** - Test offline
✅ **Instant webhooks** - Trigger webhooks manually
✅ **Complete control** - Simulate success and failure scenarios
✅ **Data inspection** - View all mock data at any time
✅ **Easy reset** - Clear all data between tests
✅ **Same server** - Runs alongside TrustRail (no separate process)

### Mock Features

The OnePipe mock provides:

1. **API Endpoints:**
   - `POST /onepipe-mock/transact` - Main transact endpoint
     - Create Merchant
     - Create Mandate
     - Send Invoice (virtual account creation)

2. **Webhook Triggers:**
   - `POST /onepipe-mock/trigger-webhook` - Manually trigger webhooks
     - `activate_mandate` - Activate a mandate
     - `credit` - Simulate down payment received
     - `debit` - Simulate installment payment (success/failure)

3. **Utility Endpoints:**
   - `GET /onepipe-mock/data` - View all stored mock data
   - `POST /onepipe-mock/reset` - Clear all mock data

### Configuration

To use the mock, update your `.env`:

```bash
# Point PWA API to the mock
PWA_BASE_URL=http://localhost:3000/onepipe-mock/transact

# Set mock mode
PWA_MOCK_MODE=Inspect

# Mock credentials (any value works)
PWA_API_KEY=mock-api-key-for-testing
TRIPLE_DES_KEY=mock1234567890123456789012

### OpenAI Configuration (Optional)

TrustRail supports AI-powered bank statement analysis using OpenAI:

```bash
# Enable OpenAI analysis (optional)
OPENAI_ENABLED=true
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o
OPENAI_PROMPT="Your custom analysis prompt..."
```

**Features:**
- ✅ Supports both PDF and CSV bank statements
- ✅ More comprehensive analysis than JS-based approach
- ✅ Configurable prompt for custom analysis requirements
- ✅ Falls back to JS analysis if OpenAI fails

**To disable OpenAI** (use JS fallback):
```bash
OPENAI_ENABLED=false
```

```

### Usage Example

```bash
# 1. Reset mock data
http POST http://localhost:3000/onepipe-mock/reset

# 2. Register business (automatically creates merchant via mock)
http POST http://localhost:3000/api/auth/register \
  businessName="Test Business" \
  email="test@example.com" \
  # ... other fields

# 3. After application is approved and mandate created, trigger activation
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="activate_mandate" \
  biller_code="BILL-123" \
  mandate_ref="MAND-123" \
  transaction_ref="APP-123"

# 4. Trigger down payment
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="credit" \
  biller_code="BILL-123" \
  virtual_account="9876543210" \
  amount=20000

# 5. Trigger successful payment
http POST http://localhost:3000/onepipe-mock/trigger-webhook \
  webhook_type="debit" \
  biller_code="BILL-123" \
  payment_id="TXN-123" \
  transaction_ref="TXN-123" \
  amount=15000 \
  status="Successful"

# 6. View all mock data
http GET http://localhost:3000/onepipe-mock/data
```

**Full Documentation:** See [`/backend/docs/onepipe-mock.md`](../onepipe-mock.md)

---

## 📚 Documentation Guide

### COMPREHENSIVE-TEST-PLAN.md

This document contains:

#### 1. **Complete API Test Cases** (All 33+ endpoints)
   - Health Check
   - Business Authentication (3 endpoints)
   - TrustWallet Management (5 endpoints)
   - Application Management (4 endpoints)
   - Payment Management (2 endpoints)
   - Withdrawal Management (2 endpoints)
   - Dashboard & Analytics (3 endpoints)
   - Webhook Configuration (2 endpoints)
   - Public Customer APIs (3 endpoints)
   - Admin APIs (4 endpoints)

#### 2. **Complete Flow Testing** (5 major flows)
   - **Flow 1:** Happy Path - Customer approval to payment completion
   - **Flow 2:** Customer declined due to low trust score
   - **Flow 3:** Customer flagged for manual review
   - **Flow 4:** Payment default detection
   - **Flow 5:** Concurrent applications processing

#### 3. **Integration Testing**
   - PWA API Integration (end-to-end)
   - Background Jobs (statement analysis, payment monitoring)
   - Webhook Delivery System
   - Database Transactions

#### 4. **Error Handling & Edge Cases**
   - Invalid JWT tokens
   - Database failures
   - PWA API failures
   - Concurrent updates
   - Large PDF or CSV files
   - Special characters in input

#### 5. **Performance Testing**
   - API response time benchmarks
   - Concurrent user load testing
   - Background job performance
   - Memory and CPU profiling

#### 6. **Security Testing**
   - Authentication bypass attempts
   - Authorization checks
   - Encryption validation
   - Input validation and sanitization
   - XSS/SQL injection prevention

---

## 🧪 Test Execution Strategy

### Level 1: Automated API Tests (Quick Validation)

Run the automated script for fast validation:

```bash
./docs/testing/api-test-script.sh
```

**What it covers:**
- All basic API endpoints
- Authentication flows
- Input validation
- Authorization checks
- Response format validation

**Duration:** ~2-3 minutes

### Level 2: Manual Flow Testing (Comprehensive)

Follow the flow tests in COMPREHENSIVE-TEST-PLAN.md:

1. **Complete Happy Path Flow**
   - Register business
   - Create TrustWallet
   - Submit customer application
   - Wait for analysis
   - Process webhooks
   - Complete payments
   - Request withdrawal

2. **Test Edge Cases**
   - Low trust score (auto-decline)
   - Medium trust score (flagged for review)
   - Payment defaults
   - Concurrent applications

**Duration:** ~30-45 minutes per flow

### Level 3: Integration & Performance Testing

Use the detailed test cases for:

1. **PWA Integration Testing**
   - Test encryption (TripleDES)
   - Test signature generation (MD5)
   - Test all PWA API calls
   - Test webhook signature verification

2. **Background Jobs Testing**
   - Test statement analysis job
   - Test payment monitor job
   - Test error recovery
   - Test concurrent processing

3. **Performance Testing**
   ```bash
   # Install Apache Bench
   brew install apache-bench

   # Test API performance
   ab -n 1000 -c 10 http://localhost:3000/health
   ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000/api/trustwallets
   ```

**Duration:** 1-2 hours

### Level 4: Security Testing

Perform security validation:

1. **Authentication Security**
   - Test JWT expiration
   - Test token tampering
   - Test password hashing

2. **Authorization Security**
   - Test cross-business access
   - Test privilege escalation
   - Test data leakage

3. **Input Security**
   - Test XSS attempts
   - Test SQL injection
   - Test file upload restrictions

**Duration:** 1-2 hours

---

## 📊 Test Reporting

### Automated Script Output

The automated script provides:
- ✅ Color-coded pass/fail indicators
- 📊 Test summary statistics
- 📝 Detailed error messages
- 🔍 Response body inspection

Example output:
```
========================================
📊 Test Summary
========================================

Total Tests: 45
Passed: 43
Failed: 2

✗ Some tests failed:
  - Create TrustWallet - Invalid Workflow
  - Admin Login - Invalid Credentials
```

### Manual Test Tracking

Use this checklist format in your test reports:

```markdown
## Test Execution Report

**Date:** 2026-01-30
**Tester:** Your Name
**Environment:** Local Development

### Results

- [ ] All Health Check APIs - PASS
- [ ] Authentication APIs - PASS (3/3)
- [ ] TrustWallet APIs - PASS (5/5)
- [ ] Application APIs - PASS (4/4)
- [ ] Payment APIs - PASS (2/2)
- [ ] Withdrawal APIs - PASS (2/2)
- [ ] Dashboard APIs - PASS (3/3)
- [ ] Webhook APIs - PASS (2/2)
- [ ] Public APIs - PASS (3/3)
- [ ] Admin APIs - PASS (4/4)

### Issues Found

1. **Issue:** Brief description
   - **Severity:** Critical/High/Medium/Low
   - **Steps to Reproduce:** ...
   - **Expected:** ...
   - **Actual:** ...
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution:** Ensure server is running
```bash
npm run dev
```

#### 2. MongoDB Not Connected
```bash
Error: MongoNetworkError: failed to connect
```

**Solution:** Start MongoDB
```bash
mongod --dbpath /path/to/data
```

#### 3. Tests Failing Due to Previous Data
**Solution:** Clean test database
```bash
mongo trustrail
db.dropDatabase()
```

#### 4. JWT Token Expired
**Solution:** Re-run registration step in script to get fresh token

#### 5. PWA API Errors
**Solution:** Check PWA credentials in .env
```bash
PWA_BASE_URL=https://api.dev.onepipe.io/v2/transact
PWA_API_KEY=your-api-key
TRIPLE_DES_KEY=your-24-byte-key
```

---

## 📝 Test Data Management

### Required Test Data

#### 1. Good Bank Statement CSV
Create `test-data/good_statement.csv`:
```csv
Date,Description,Debit,Credit,Balance
2025-11-01,SALARY CREDIT FROM XYZ CORP,,250000,250000
2025-11-02,MTN AIRTIME,500,,249500
2025-12-01,SALARY CREDIT FROM XYZ CORP,,250000,499500
2026-01-01,SALARY CREDIT FROM XYZ CORP,,250000,749500
```

#### 2. Poor Bank Statement CSV
Create `test-data/poor_statement.csv`:
```csv
Date,Description,Debit,Credit,Balance
2025-11-01,FREELANCE PAYMENT,,50000,50000
2025-11-05,INSUFFICIENT FUNDS - BOUNCE,0,,50000
2025-11-10,SPORTYBET,15000,,35000
2025-11-15,BETKING,10000,,25000
2025-12-01,TRANSFER,,30000,55000
2025-12-10,INSUFFICIENT FUNDS - BOUNCE,0,,55000
```

#### 3. Test Business Credentials
```json
{
  "businessName": "Test University",
  "email": "test@university.com",
  "password": "SecurePass123!",
  "phoneNumber": "2348012345678",
  "rcNumber": "RC123456",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "settlementAccountName": "Test Account"
}
```

---

## 🎯 Success Criteria

### API Testing Success Criteria
- ✅ All 33+ endpoints return expected status codes
- ✅ All request validations work correctly
- ✅ All response formats match specifications
- ✅ All authentication/authorization checks pass
- ✅ No unhandled errors in logs

### Flow Testing Success Criteria
- ✅ Complete customer journey from application to payment
- ✅ Trust engine correctly calculates scores
- ✅ PWA integration creates mandates successfully
- ✅ Webhooks deliver to business endpoints
- ✅ Background jobs process applications
- ✅ Payment defaults detected correctly

### Performance Success Criteria
- ✅ 95% of API requests < 200ms
- ✅ System handles 100 concurrent users
- ✅ Background jobs process without lag
- ✅ No memory leaks during extended operation

### Security Success Criteria
- ✅ All authentication bypasses blocked
- ✅ All authorization checks enforced
- ✅ All encryption properly implemented
- ✅ All input sanitized and validated
- ✅ No sensitive data leakage

---

## 📞 Support

For issues or questions about testing:

1. Check the [COMPREHENSIVE-TEST-PLAN.md](./COMPREHENSIVE-TEST-PLAN.md) for detailed test cases
2. Review the automated script output for error details
3. Check server logs: `backend/logs/combined.log`
4. Verify environment variables in `.env`
5. Ensure all dependencies installed: `npm install`

---

## 🔄 Continuous Testing

### Pre-Commit Testing
```bash
# Run quick validation before committing
./docs/testing/api-test-script.sh
```

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Start MongoDB
        run: |
          docker run -d -p 27017:27017 mongo:7.0
      - name: Run tests
        run: ./docs/testing/api-test-script.sh
```

---

## 📈 Test Coverage Goals

| Category | Target Coverage | Current Status |
|----------|----------------|----------------|
| API Endpoints | 100% | ✅ Complete |
| Complete Flows | 100% | ✅ Complete |
| Error Scenarios | 90% | ✅ Complete |
| Edge Cases | 80% | ✅ Complete |
| Performance | 100% | ✅ Complete |
| Security | 100% | ✅ Complete |

---

**Last Updated:** 2026-01-30
**Version:** 1.0
