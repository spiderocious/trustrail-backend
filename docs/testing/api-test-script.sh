#!/bin/bash

##############################################################################
# TrustRail API Automated Test Script
# Run all API endpoint tests and validate responses
##############################################################################

# NOTE: Supports both PDF and CSV bank statements
# OpenAI integration is optional (controlled by OPENAI_ENABLED env var)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a FAILED_TEST_NAMES

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ Test: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    FAILED_TEST_NAMES+=("$1")
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

test_api() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local headers="$5"
    local body="$6"

    print_test "$test_name"

    # Build curl command
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"

    # Add headers
    if [ -n "$headers" ]; then
        while IFS= read -r header; do
            curl_cmd="$curl_cmd -H '$header'"
        done <<< "$headers"
    fi

    # Add body for POST/PUT
    if [ -n "$body" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$body'"
    fi

    curl_cmd="$curl_cmd $BASE_URL$endpoint"

    # Execute request
    local response=$(eval $curl_cmd)
    local http_code=$(echo "$response" | tail -n 1)
    local response_body=$(echo "$response" | head -n -1)

    # Check status code
    if [ "$http_code" == "$expected_status" ]; then
        print_success "$test_name - Status: $http_code"
        echo "$response_body" | jq . 2>/dev/null || echo "$response_body"
        return 0
    else
        print_failure "$test_name - Expected: $expected_status, Got: $http_code"
        echo "$response_body"
        return 1
    fi
}

##############################################################################
# Test Execution
##############################################################################

print_header "🚀 TrustRail API Test Suite"
print_info "Base URL: $BASE_URL"
print_info "Starting tests...\n"

##############################################################################
# 1. HEALTH CHECK
##############################################################################

print_header "1. Health Check API"

test_api \
    "Health Check" \
    "GET" \
    "/health" \
    "200" \
    "" \
    ""

##############################################################################
# 2. BUSINESS AUTHENTICATION
##############################################################################

print_header "2. Business Authentication APIs"

# Generate unique email for test
TEST_EMAIL="test-$(date +%s)@university.com"

# 2.1 Register Business
REGISTER_BODY='{
  "businessName": "Test University",
  "email": "'$TEST_EMAIL'",
  "password": "SecurePass123!",
  "phoneNumber": "2348012345678",
  "rcNumber": "RC'$(date +%s)'",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "settlementAccountName": "Test Account"
}'

REGISTER_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$REGISTER_BODY" \
    "$BASE_URL/api/auth/register")

REGISTER_STATUS=$(echo $REGISTER_RESPONSE | jq -r '.success')

if [ "$REGISTER_STATUS" == "true" ]; then
    print_success "Business Registration"
    TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
    BUSINESS_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.business.businessId')
    print_info "Token: ${TOKEN:0:20}..."
    print_info "Business ID: $BUSINESS_ID"
else
    print_failure "Business Registration"
    echo $REGISTER_RESPONSE | jq .
    exit 1
fi

# 2.2 Login
LOGIN_BODY='{
  "email": "'$TEST_EMAIL'",
  "password": "SecurePass123!"
}'

test_api \
    "Business Login" \
    "POST" \
    "/api/auth/login" \
    "200" \
    "" \
    "$LOGIN_BODY"

# 2.3 Login with wrong password
WRONG_LOGIN_BODY='{
  "email": "'$TEST_EMAIL'",
  "password": "WrongPassword"
}'

test_api \
    "Business Login - Invalid Password" \
    "POST" \
    "/api/auth/login" \
    "401" \
    "" \
    "$WRONG_LOGIN_BODY"

# 2.4 Logout
test_api \
    "Business Logout" \
    "POST" \
    "/api/auth/logout" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

##############################################################################
# 3. TRUSTWALLET MANAGEMENT
##############################################################################

print_header "3. TrustWallet Management APIs"

# 3.1 Create TrustWallet
CREATE_TW_BODY='{
  "name": "Test Department Fees",
  "description": "Test installment plan",
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
  }
}'

CREATE_TW_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$CREATE_TW_BODY" \
    "$BASE_URL/api/trustwallets")

CREATE_TW_STATUS=$(echo $CREATE_TW_RESPONSE | jq -r '.success')

if [ "$CREATE_TW_STATUS" == "true" ]; then
    print_success "Create TrustWallet"
    TRUSTWALLET_ID=$(echo $CREATE_TW_RESPONSE | jq -r '.data.trustWalletId')
    print_info "TrustWallet ID: $TRUSTWALLET_ID"
else
    print_failure "Create TrustWallet"
    echo $CREATE_TW_RESPONSE | jq .
fi

# 3.2 List TrustWallets
test_api \
    "List TrustWallets" \
    "GET" \
    "/api/trustwallets?page=1&limit=20" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

# 3.3 Get Single TrustWallet
test_api \
    "Get Single TrustWallet" \
    "GET" \
    "/api/trustwallets/$TRUSTWALLET_ID" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

# 3.4 Update TrustWallet
UPDATE_TW_BODY='{
  "name": "Updated Test Department Fees"
}'

test_api \
    "Update TrustWallet" \
    "PUT" \
    "/api/trustwallets/$TRUSTWALLET_ID" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    "$UPDATE_TW_BODY"

# 3.5 Invalid TrustWallet - autoApprove <= autoDecline
INVALID_TW_BODY='{
  "name": "Invalid Workflow",
  "installmentPlan": {
    "totalAmount": 100000,
    "downPaymentPercentage": 20,
    "installmentCount": 4,
    "frequency": "monthly"
  },
  "approvalWorkflow": {
    "autoApproveThreshold": 40,
    "autoDeclineThreshold": 60,
    "minTrustScore": 30
  }
}'

test_api \
    "Create TrustWallet - Invalid Workflow" \
    "POST" \
    "/api/trustwallets" \
    "400" \
    "Authorization: Bearer $TOKEN" \
    "$INVALID_TW_BODY"

##############################################################################
# 4. PUBLIC CUSTOMER APIS
##############################################################################

print_header "4. Public Customer APIs"

# 4.1 Get Public TrustWallet Info
test_api \
    "Get Public TrustWallet Info" \
    "GET" \
    "/public/trustwallet/$TRUSTWALLET_ID" \
    "200" \
    "" \
    ""

# 4.2 Submit Application (without file for now - manual test required)
print_test "Submit Application (File Upload)"
print_info "⚠ Skipping - Requires multipart/form-data with PDF or CSV file"
print_info "Use manual test: http --form POST $BASE_URL/public/trustwallet/$TRUSTWALLET_ID/apply ..."

# 4.3 Check Application Status (will fail if no application exists)
test_api \
    "Check Application Status - Not Found" \
    "GET" \
    "/public/application/APP-NONEXISTENT/status" \
    "404" \
    "" \
    ""

##############################################################################
# 5. APPLICATION MANAGEMENT
##############################################################################

print_header "5. Application Management APIs"

# 5.1 List Applications
test_api \
    "List Applications" \
    "GET" \
    "/api/applications?page=1&limit=20" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

# 5.2 Get Application - Not Found
test_api \
    "Get Application - Not Found" \
    "GET" \
    "/api/applications/APP-NONEXISTENT" \
    "404" \
    "Authorization: Bearer $TOKEN" \
    ""

##############################################################################
# 6. PAYMENT MANAGEMENT
##############################################################################

print_header "6. Payment Management APIs"

# 6.1 List Payments
test_api \
    "List Payments" \
    "GET" \
    "/api/payments?page=1&limit=20" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

##############################################################################
# 7. WITHDRAWAL MANAGEMENT
##############################################################################

print_header "7. Withdrawal Management APIs"

# 7.1 Request Withdrawal - Insufficient Balance
WITHDRAWAL_BODY='{
  "trustWalletId": "'$TRUSTWALLET_ID'",
  "amount": 1000000
}'

test_api \
    "Request Withdrawal - Insufficient Balance" \
    "POST" \
    "/api/withdrawals" \
    "400" \
    "Authorization: Bearer $TOKEN" \
    "$WITHDRAWAL_BODY"

# 7.2 List Withdrawals
test_api \
    "List Withdrawals" \
    "GET" \
    "/api/withdrawals?page=1&limit=20" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

##############################################################################
# 8. DASHBOARD & ANALYTICS
##############################################################################

print_header "8. Dashboard & Analytics APIs"

# 8.1 Get Business Overview
test_api \
    "Get Business Overview" \
    "GET" \
    "/api/dashboard/overview" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

# 8.2 Generate Reports
test_api \
    "Generate Reports - Applications JSON" \
    "GET" \
    "/api/dashboard/reports?type=applications&format=json" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

# 8.3 TrustWallet Analytics
test_api \
    "TrustWallet Analytics" \
    "GET" \
    "/api/dashboard/trustwallet/$TRUSTWALLET_ID/analytics" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    ""

##############################################################################
# 9. WEBHOOK CONFIGURATION
##############################################################################

print_header "9. Webhook Configuration APIs"

# 9.1 Configure Webhook
WEBHOOK_BODY='{
  "webhookUrl": "https://example.com/webhooks/trustrail"
}'

test_api \
    "Configure Webhook URL" \
    "POST" \
    "/api/webhooks/configure" \
    "200" \
    "Authorization: Bearer $TOKEN" \
    "$WEBHOOK_BODY"

# 9.2 Invalid Webhook URL
INVALID_WEBHOOK_BODY='{
  "webhookUrl": "not-a-valid-url"
}'

test_api \
    "Configure Webhook - Invalid URL" \
    "POST" \
    "/api/webhooks/configure" \
    "400" \
    "Authorization: Bearer $TOKEN" \
    "$INVALID_WEBHOOK_BODY"

##############################################################################
# 10. ADMIN APIS
##############################################################################

print_header "10. Admin APIs"

# 10.1 Admin Login - Invalid Credentials
ADMIN_LOGIN_BODY='{
  "email": "admin@trustrail.com",
  "password": "wrong-password"
}'

test_api \
    "Admin Login - Invalid Credentials" \
    "POST" \
    "/admin/auth/login" \
    "401" \
    "" \
    "$ADMIN_LOGIN_BODY"

print_info "⚠ Admin endpoints require valid credentials from .env"
print_info "Skipping admin health checks (requires authentication)"

##############################################################################
# 11. AUTHORIZATION TESTS
##############################################################################

print_header "11. Authorization & Security Tests"

# 11.1 Access protected route without token
test_api \
    "Access Protected Route - No Token" \
    "GET" \
    "/api/trustwallets" \
    "401" \
    "" \
    ""

# 11.2 Access with invalid token
test_api \
    "Access Protected Route - Invalid Token" \
    "GET" \
    "/api/trustwallets" \
    "401" \
    "Authorization: Bearer invalid-token-123" \
    ""

# 11.3 Access non-existent route
test_api \
    "Access Non-Existent Route" \
    "GET" \
    "/api/nonexistent" \
    "404" \
    "" \
    ""

##############################################################################
# 12. INPUT VALIDATION TESTS
##############################################################################

print_header "12. Input Validation Tests"

# 12.1 Register with invalid email
INVALID_EMAIL_BODY='{
  "businessName": "Test",
  "email": "not-an-email",
  "password": "SecurePass123!",
  "phoneNumber": "2348012345678",
  "rcNumber": "RC123",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "settlementAccountName": "Test"
}'

test_api \
    "Register - Invalid Email" \
    "POST" \
    "/api/auth/register" \
    "400" \
    "" \
    "$INVALID_EMAIL_BODY"

# 12.2 Register with short password
SHORT_PASS_BODY='{
  "businessName": "Test",
  "email": "test@example.com",
  "password": "short",
  "phoneNumber": "2348012345678",
  "rcNumber": "RC123",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "settlementAccountName": "Test"
}'

test_api \
    "Register - Short Password" \
    "POST" \
    "/api/auth/register" \
    "400" \
    "" \
    "$SHORT_PASS_BODY"

# 12.3 Create TrustWallet with invalid amount
INVALID_AMOUNT_BODY='{
  "name": "Test",
  "installmentPlan": {
    "totalAmount": -100,
    "downPaymentPercentage": 20,
    "installmentCount": 4,
    "frequency": "monthly"
  },
  "approvalWorkflow": {
    "autoApproveThreshold": 85,
    "autoDeclineThreshold": 40,
    "minTrustScore": 50
  }
}'

test_api \
    "Create TrustWallet - Negative Amount" \
    "POST" \
    "/api/trustwallets" \
    "400" \
    "Authorization: Bearer $TOKEN" \
    "$INVALID_AMOUNT_BODY"

##############################################################################
# CLEANUP
##############################################################################

print_header "Cleanup"

# Delete test TrustWallet
if [ -n "$TRUSTWALLET_ID" ]; then
    print_info "Deleting test TrustWallet: $TRUSTWALLET_ID"
    curl -s -X DELETE \
        -H "Authorization: Bearer $TOKEN" \
        "$BASE_URL/api/trustwallets/$TRUSTWALLET_ID" > /dev/null
    print_success "Test TrustWallet deleted"
fi

##############################################################################
# SUMMARY
##############################################################################

print_header "📊 Test Summary"

echo -e "${BLUE}Total Tests:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Failed:${NC} $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed! 🎉${NC}\n"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed:${NC}"
    for test_name in "${FAILED_TEST_NAMES[@]}"; do
        echo -e "${RED}  - $test_name${NC}"
    done
    echo ""
    exit 1
fi
