#!/bin/bash

##############################################################################
# TrustRail E2E Test with OnePipe Mock
# Complete end-to-end test using the built-in OnePipe mock
##############################################################################

# NOTE: This test works with both OpenAI (PDF/CSV) and JS fallback modes
# - If OPENAI_ENABLED=true: Requires valid OPENAI_API_KEY, OPENAI_MODEL, OPENAI_PROMPT
# - If OPENAI_ENABLED=false: Uses JS analysis (legacy mode)
# - Test supports both CSV and PDF bank statements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

wait_for_analysis() {
    local app_id=$1
    local token=$2
    local max_wait=180
    local elapsed=0

    echo -e "${YELLOW}Waiting for analysis to complete (polling every 5 seconds)${NC}"

    while [ $elapsed -lt $max_wait ]; do
        STATUS_CHECK=$(curl -s -H "Authorization: Bearer $token" "$BASE_URL/api/applications/$app_id")
        CURRENT_STATUS=$(echo "$STATUS_CHECK" | jq -r '.data.status')

        if [ "$CURRENT_STATUS" != "ANALYZING" ] && [ "$CURRENT_STATUS" != "PENDING" ]; then
            echo -e "\n${GREEN}✓ Analysis completed after ${elapsed} seconds${NC}"
            return 0
        fi

        printf "\rElapsed: %d seconds (Status: %s)" $elapsed "$CURRENT_STATUS"
        sleep 5
        elapsed=$((elapsed + 5))
    done

    echo -e "\n${RED}✗ Analysis timeout after ${max_wait} seconds${NC}"
    return 1
}

##############################################################################
# Test Execution
##############################################################################

print_header "🚀 TrustRail E2E Test with OnePipe Mock"
print_info "Base URL: $BASE_URL"
print_info "Test Duration: ~3-4 minutes\n"

# Check if server is running
print_step "Checking if server is running"
if ! curl -s "$BASE_URL/health" > /dev/null; then
    print_failure "Server is not running at $BASE_URL. Please start it with: npm run dev"
fi
print_success "Server is running"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_failure "jq is required but not installed. Install with: brew install jq"
fi

##############################################################################
# Step 1: Reset OnePipe Mock Data
##############################################################################

print_header "Step 1: Reset OnePipe Mock"

RESET_RESPONSE=$(curl -s -X POST "$BASE_URL/onepipe-mock/reset")
if echo "$RESET_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    print_success "OnePipe mock data cleared"
else
    print_failure "Failed to reset OnePipe mock"
fi

##############################################################################
# Step 2: Register Business
##############################################################################

print_header "Step 2: Register Business"

TIMESTAMP=$(date +%s)
TEST_EMAIL="e2e-test-${TIMESTAMP}@test.com"
TEST_RC="RC${TIMESTAMP}"

REGISTER_BODY='{
  "businessName": "E2E Test University",
  "email": "'$TEST_EMAIL'",
  "password": "SecurePass123!",
  "phoneNumber": "2348012345678",
  "rcNumber": "'$TEST_RC'",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "settlementAccountName": "E2E Test Account"
}'

REGISTER_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$REGISTER_BODY" \
    "$BASE_URL/api/auth/register")

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
    BUSINESS_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.businessId')
    BILLER_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.data.billerCode')

    print_success "Business registered"
    print_info "Business ID: $BUSINESS_ID"
    print_info "Biller Code: $BILLER_CODE"
    print_info "Email: $TEST_EMAIL"
else
    print_failure "Failed to register business"
    echo "$REGISTER_RESPONSE" | jq .
fi

##############################################################################
# Step 3: Create TrustWallet
##############################################################################

print_header "Step 3: Create TrustWallet"

TW_BODY='{
  "name": "E2E Test Fees",
  "description": "End-to-end test installment plan",
  "installmentPlan": {
    "totalAmount": 100000,
    "downPaymentPercentage": 20,
    "installmentCount": 4,
    "frequency": "monthly",
    "interestRate": 0
  },
  "approvalWorkflow": {
    "autoApproveThreshold": 35,
    "autoDeclineThreshold": 15,
    "minTrustScore": 20
  }
}'

TW_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$TW_BODY" \
    "$BASE_URL/api/trustwallets")

if echo "$TW_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    TRUSTWALLET_ID=$(echo "$TW_RESPONSE" | jq -r '.data.trustWalletId')
    print_success "TrustWallet created"
    print_info "TrustWallet ID: $TRUSTWALLET_ID"
else
    print_failure "Failed to create TrustWallet"
    echo "$TW_RESPONSE" | jq .
fi

##############################################################################
# Step 4: Use Test Bank Statement PDF
##############################################################################

print_header "Step 4: Use Test Bank Statement PDF"

STATEMENT_FILE="docs/testing/statement-docs.pdf"

if [ ! -f "$STATEMENT_FILE" ]; then
    print_failure "PDF file not found at $STATEMENT_FILE"
fi

print_success "Using PDF file: $STATEMENT_FILE"

##############################################################################
# Step 5: Submit Customer Application
##############################################################################

print_header "Step 5: Submit Customer Application"

APP_RESPONSE=$(curl -s -X POST \
    -F "firstName=John" \
    -F "lastName=Doe" \
    -F "email=john.doe-${TIMESTAMP}@example.com" \
    -F "phoneNumber=2348087654321" \
    -F "accountNumber=0123456789" \
    -F "bankCode=058" \
    -F "bvn=12345678901" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TRUSTWALLET_ID/apply")

if echo "$APP_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    APPLICATION_ID=$(echo "$APP_RESPONSE" | jq -r '.data.applicationId')
    print_success "Application submitted"
    print_info "Application ID: $APPLICATION_ID"
else
    print_failure "Failed to submit application"
    echo "$APP_RESPONSE" | jq .
fi

##############################################################################
# Step 6: Wait for Trust Engine Analysis
##############################################################################

print_header "Step 6: Trust Engine Analysis"

if ! wait_for_analysis "$APPLICATION_ID" "$TOKEN"; then
    print_failure "Analysis did not complete in time"
fi

##############################################################################
# Step 7: Check Application Status
##############################################################################

print_header "Step 7: Check Application Status"

STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/applications/$APPLICATION_ID")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status')
MANDATE_REF=$(echo "$STATUS_RESPONSE" | jq -r '.data.pwaMandateRef // "N/A"')
TRUST_SCORE=$(echo "$STATUS_RESPONSE" | jq -r '.data.trustEngineOutput.trustScore // "N/A"')
DECISION=$(echo "$STATUS_RESPONSE" | jq -r '.data.trustEngineOutput.decision // "N/A"')

print_success "Application analyzed"
print_info "Status: $STATUS"
print_info "Trust Score: $TRUST_SCORE"
print_info "Decision: $DECISION"

if [ "$STATUS" != "MANDATE_CREATED" ]; then
    print_failure "Expected status MANDATE_CREATED, got: $STATUS"
fi

if [ "$MANDATE_REF" == "N/A" ] || [ "$MANDATE_REF" == "null" ]; then
    print_failure "Mandate reference not found"
fi

print_success "PWA mandate created: $MANDATE_REF"

##############################################################################
# Step 8: Trigger Mandate Activation
##############################################################################

print_header "Step 8: Trigger Mandate Activation"

ACTIVATE_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
      "webhook_type": "activate_mandate",
      "biller_code": "'$BILLER_CODE'",
      "mandate_ref": "'$MANDATE_REF'",
      "transaction_ref": "'$APPLICATION_ID'"
    }' \
    "$BASE_URL/onepipe-mock/trigger-webhook")

if echo "$ACTIVATE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    print_success "Mandate activation webhook triggered"
else
    print_failure "Failed to trigger mandate activation"
    echo "$ACTIVATE_RESPONSE" | jq .
fi

sleep 3

# Verify mandate activated
STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/applications/$APPLICATION_ID")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status')
VIRTUAL_ACCOUNT=$(echo "$STATUS_RESPONSE" | jq -r '.data.virtualAccountNumber // "N/A"')

if [ "$STATUS" != "MANDATE_ACTIVE" ]; then
    print_failure "Expected status MANDATE_ACTIVE, got: $STATUS"
fi

print_success "Mandate activated"
print_info "Virtual Account: $VIRTUAL_ACCOUNT"

##############################################################################
# Step 9: Trigger Down Payment
##############################################################################

print_header "Step 9: Trigger Down Payment"

CREDIT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
      "webhook_type": "credit",
      "biller_code": "'$BILLER_CODE'",
      "virtual_account": "'$VIRTUAL_ACCOUNT'",
      "amount": 20000
    }' \
    "$BASE_URL/onepipe-mock/trigger-webhook")

if echo "$CREDIT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    print_success "Down payment webhook triggered"
else
    print_failure "Failed to trigger down payment"
    echo "$CREDIT_RESPONSE" | jq .
fi

sleep 3

##############################################################################
# Step 10: Verify Payments Scheduled
##############################################################################

print_header "Step 10: Verify Payment Transactions"

PAYMENTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/payments?applicationId=$APPLICATION_ID")

PAYMENT_COUNT=$(echo "$PAYMENTS_RESPONSE" | jq '.data | length')

print_success "$PAYMENT_COUNT payment transactions scheduled"

if [ "$PAYMENT_COUNT" -ne 4 ]; then
    print_failure "Expected 4 payment transactions, got: $PAYMENT_COUNT"
fi

##############################################################################
# Step 11: Process All Installment Payments
##############################################################################

print_header "Step 11: Process Installment Payments"

for i in {0..3}; do
    PAYMENT_ID=$(echo "$PAYMENTS_RESPONSE" | jq -r ".data[$i].transactionId")

    print_step "Processing payment $((i+1)) of 4: $PAYMENT_ID"

    DEBIT_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{
          "webhook_type": "debit",
          "biller_code": "'$BILLER_CODE'",
          "payment_id": "'$PAYMENT_ID'",
          "transaction_ref": "'$PAYMENT_ID'",
          "amount": 20000,
          "status": "Successful"
        }' \
        "$BASE_URL/onepipe-mock/trigger-webhook")

    if echo "$DEBIT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Payment $((i+1)) processed successfully"
    else
        print_failure "Failed to process payment $((i+1))"
    fi

    sleep 2
done

##############################################################################
# Step 12: Verify Final Status
##############################################################################

print_header "Step 12: Verify Final Application Status"

sleep 3

FINAL_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/applications/$APPLICATION_ID")

FINAL_STATUS=$(echo "$FINAL_RESPONSE" | jq -r '.data.status')
PAYMENTS_COMPLETED=$(echo "$FINAL_RESPONSE" | jq -r '.data.paymentsCompleted')
TOTAL_PAID=$(echo "$FINAL_RESPONSE" | jq -r '.data.totalPaid')
OUTSTANDING=$(echo "$FINAL_RESPONSE" | jq -r '.data.outstandingBalance')

print_success "Final Status: $FINAL_STATUS"
print_info "Payments Completed: $PAYMENTS_COMPLETED/4"
print_info "Total Paid: ₦$TOTAL_PAID"
print_info "Outstanding Balance: ₦$OUTSTANDING"

if [ "$FINAL_STATUS" != "COMPLETED" ]; then
    print_failure "Expected status COMPLETED, got: $FINAL_STATUS"
fi

if [ "$PAYMENTS_COMPLETED" -ne 4 ]; then
    print_failure "Expected 4 payments completed, got: $PAYMENTS_COMPLETED"
fi

##############################################################################
# Step 13: Request Withdrawal
##############################################################################

print_header "Step 13: Request Withdrawal"

WITHDRAWAL_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "trustWalletId": "'$TRUSTWALLET_ID'",
      "amount": 100000
    }' \
    "$BASE_URL/api/withdrawals")

if echo "$WITHDRAWAL_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    WITHDRAWAL_ID=$(echo "$WITHDRAWAL_RESPONSE" | jq -r '.data.withdrawalId')
    print_success "Withdrawal requested: $WITHDRAWAL_ID"
else
    print_failure "Failed to request withdrawal"
    echo "$WITHDRAWAL_RESPONSE" | jq .
fi

##############################################################################
# Test Summary
##############################################################################

print_header "📊 Test Summary"

echo -e "${GREEN}✓ Business registered and OnePipe merchant created${NC}"
echo -e "${GREEN}✓ TrustWallet created successfully${NC}"
echo -e "${GREEN}✓ Customer application submitted${NC}"
echo -e "${GREEN}✓ Bank statement analyzed (Trust Score: $TRUST_SCORE)${NC}"
echo -e "${GREEN}✓ Application auto-approved${NC}"
echo -e "${GREEN}✓ PWA mandate created and activated${NC}"
echo -e "${GREEN}✓ Virtual account created for down payment${NC}"
echo -e "${GREEN}✓ Down payment processed successfully${NC}"
echo -e "${GREEN}✓ 4 installment payments completed${NC}"
echo -e "${GREEN}✓ Application status: $FINAL_STATUS${NC}"
echo -e "${GREEN}✓ Withdrawal requested successfully${NC}"

echo -e "\n${GREEN}🎉 E2E TEST PASSED!${NC}\n"

##############################################################################
# Cleanup
##############################################################################

print_info "Test completed (using permanent PDF file, no cleanup needed)"

print_header "Test Details"
echo -e "Business ID: ${BLUE}$BUSINESS_ID${NC}"
echo -e "TrustWallet ID: ${BLUE}$TRUSTWALLET_ID${NC}"
echo -e "Application ID: ${BLUE}$APPLICATION_ID${NC}"
echo -e "Token: ${BLUE}${TOKEN:0:30}...${NC}"

echo -e "\n${YELLOW}Debug Commands:${NC}"
echo -e "View OnePipe mock data:"
echo -e "  ${BLUE}curl -s $BASE_URL/onepipe-mock/data | jq .${NC}"
echo -e "\nView audit logs:"
echo -e "  ${BLUE}curl -s -H \"Authorization: Bearer \$TOKEN\" \"$BASE_URL/api/applications/$APPLICATION_ID\" | jq .${NC}"
echo -e "\nView dashboard:"
echo -e "  ${BLUE}curl -s -H \"Authorization: Bearer $TOKEN\" \"$BASE_URL/api/dashboard/overview\" | jq .${NC}"

echo ""
