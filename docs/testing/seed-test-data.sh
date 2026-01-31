#!/bin/bash

##############################################################################
# TrustRail Test Data Seeder
# Creates comprehensive test data for user: e2e-test-1769785976@test.com
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3030}"
TEST_EMAIL="e2e-test-1769785976@test.com"
TEST_PASSWORD="SecurePass123!"

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

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

##############################################################################
# Step 1: Login
##############################################################################

print_header "Step 1: Login as Test User"

LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }" \
    "$BASE_URL/api/auth/login")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
BUSINESS_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.businessId')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Login failed. User might not exist.${NC}"
    echo "$LOGIN_RESPONSE" | jq .
    exit 1
fi

print_success "Logged in successfully"
print_info "Business ID: $BUSINESS_ID"

##############################################################################
# Step 2: Create Multiple TrustWallets
##############################################################################

print_header "Step 2: Creating TrustWallets (7 total)"

# TrustWallet 1: School Fees - High threshold (active)
print_step "Creating TrustWallet 1: School Fees Payment Plan"
TW1_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "School Fees Payment Plan",
        "description": "Flexible payment plan for tuition fees",
        "installmentPlan": {
            "totalAmount": 50000000,
            "downPaymentPercentage": 25,
            "installmentCount": 3,
            "frequency": "monthly",
            "interestRate": 0
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 85,
            "autoDeclineThreshold": 40,
            "minTrustScore": 50
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW1_ID=$(echo "$TW1_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW1_ID (₦500,000 - 3 installments)"

# TrustWallet 2: Laptop Purchase - Medium threshold (active)
print_step "Creating TrustWallet 2: Laptop Purchase Plan"
TW2_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Laptop Purchase Plan",
        "description": "Buy now, pay later for laptops and computers",
        "installmentPlan": {
            "totalAmount": 30000000,
            "downPaymentPercentage": 20,
            "installmentCount": 4,
            "frequency": "monthly",
            "interestRate": 5
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 70,
            "autoDeclineThreshold": 35,
            "minTrustScore": 40
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW2_ID=$(echo "$TW2_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW2_ID (₦300,000 - 4 installments, 5% interest)"

# TrustWallet 3: Textbook Bundle - Low threshold (active)
print_step "Creating TrustWallet 3: Textbook Bundle"
TW3_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Textbook Bundle",
        "description": "Essential textbooks for the semester",
        "installmentPlan": {
            "totalAmount": 10000000,
            "downPaymentPercentage": 15,
            "installmentCount": 2,
            "frequency": "monthly",
            "interestRate": 0
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 60,
            "autoDeclineThreshold": 30,
            "minTrustScore": 35
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW3_ID=$(echo "$TW3_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW3_ID (₦100,000 - 2 installments)"

# TrustWallet 4: Lab Equipment - Weekly payments (active)
print_step "Creating TrustWallet 4: Lab Equipment"
TW4_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Lab Equipment Rental",
        "description": "Weekly rental for laboratory equipment",
        "installmentPlan": {
            "totalAmount": 8000000,
            "downPaymentPercentage": 30,
            "installmentCount": 8,
            "frequency": "weekly",
            "interestRate": 0
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 75,
            "autoDeclineThreshold": 45,
            "minTrustScore": 50
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW4_ID=$(echo "$TW4_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW4_ID (₦80,000 - 8 weekly installments)"

# TrustWallet 5: Hostel Accommodation - Large amount (active)
print_step "Creating TrustWallet 5: Hostel Accommodation"
TW5_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Hostel Accommodation",
        "description": "On-campus accommodation payment plan",
        "installmentPlan": {
            "totalAmount": 75000000,
            "downPaymentPercentage": 35,
            "installmentCount": 5,
            "frequency": "monthly",
            "interestRate": 3
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 80,
            "autoDeclineThreshold": 50,
            "minTrustScore": 55
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW5_ID=$(echo "$TW5_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW5_ID (₦750,000 - 5 installments, 3% interest)"

# TrustWallet 6: Professional Certification - Zero down payment (active)
print_step "Creating TrustWallet 6: Professional Certification"
TW6_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Professional Certification Course",
        "description": "Industry certification training program",
        "installmentPlan": {
            "totalAmount": 25000000,
            "downPaymentPercentage": 0,
            "installmentCount": 6,
            "frequency": "monthly",
            "interestRate": 8
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 90,
            "autoDeclineThreshold": 60,
            "minTrustScore": 65
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW6_ID=$(echo "$TW6_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW6_ID (₦250,000 - 6 installments, 8% interest, no down payment)"

# TrustWallet 7: Medical Equipment (will be deactivated)
print_step "Creating TrustWallet 7: Medical Equipment (will be deactivated)"
TW7_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Medical Equipment Purchase",
        "description": "Medical devices and equipment",
        "installmentPlan": {
            "totalAmount": 15000000,
            "downPaymentPercentage": 40,
            "installmentCount": 3,
            "frequency": "monthly",
            "interestRate": 0
        },
        "approvalWorkflow": {
            "autoApproveThreshold": 85,
            "autoDeclineThreshold": 50,
            "minTrustScore": 60
        }
    }' \
    "$BASE_URL/api/trustwallets")

TW7_ID=$(echo "$TW7_RESPONSE" | jq -r '.data.trustWalletId')
print_success "Created: $TW7_ID (₦150,000 - will be deactivated)"

# Deactivate TrustWallet 7
print_step "Deactivating TrustWallet 7"
curl -s -X DELETE \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/trustwallets/$TW7_ID" > /dev/null
print_success "TrustWallet 7 deactivated"

print_success "Created 7 TrustWallets (6 active, 1 inactive)"

##############################################################################
# Step 3: Create Applications
##############################################################################

print_header "Step 3: Creating Applications (20+ applications)"

STATEMENT_FILE="docs/testing/statement-docs.pdf"

if [ ! -f "$STATEMENT_FILE" ]; then
    echo -e "${RED}✗ Test PDF not found at $STATEMENT_FILE${NC}"
    exit 1
fi

# Applications for TW1 (School Fees) - 5 applications
print_step "Creating applications for TW1 (School Fees)"

# App 1 - Will be AUTO_APPROVED
APP1_RESPONSE=$(curl -s -X POST \
    -F "firstName=Chiamaka" \
    -F "lastName=Okonkwo" \
    -F "email=chiamaka.okonkwo@student.edu.ng" \
    -F "phoneNumber=2348091234567" \
    -F "accountNumber=0123456780" \
    -F "bankCode=058" \
    -F "bvn=12345678901" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW1_ID/apply")
APP1_ID=$(echo "$APP1_RESPONSE" | jq -r '.data.applicationId')
print_info "App 1 created: $APP1_ID (Chiamaka - will be auto-approved)"

# App 2
APP2_RESPONSE=$(curl -s -X POST \
    -F "firstName=Oluwaseun" \
    -F "lastName=Adeyemi" \
    -F "email=oluwaseun.adeyemi@student.edu.ng" \
    -F "phoneNumber=2348092345678" \
    -F "accountNumber=0234567890" \
    -F "bankCode=044" \
    -F "bvn=23456789012" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW1_ID/apply")
APP2_ID=$(echo "$APP2_RESPONSE" | jq -r '.data.applicationId')
print_info "App 2 created: $APP2_ID (Oluwaseun)"

# App 3
APP3_RESPONSE=$(curl -s -X POST \
    -F "firstName=Chidera" \
    -F "lastName=Nwankwo" \
    -F "email=chidera.nwankwo@student.edu.ng" \
    -F "phoneNumber=2348093456789" \
    -F "accountNumber=0345678901" \
    -F "bankCode=057" \
    -F "bvn=34567890123" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW1_ID/apply")
APP3_ID=$(echo "$APP3_RESPONSE" | jq -r '.data.applicationId')
print_info "App 3 created: $APP3_ID (Chidera)"

# App 4
APP4_RESPONSE=$(curl -s -X POST \
    -F "firstName=Emeka" \
    -F "lastName=Eze" \
    -F "email=emeka.eze@student.edu.ng" \
    -F "phoneNumber=2348094567890" \
    -F "accountNumber=0456789012" \
    -F "bankCode=011" \
    -F "bvn=45678901234" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW1_ID/apply")
APP4_ID=$(echo "$APP4_RESPONSE" | jq -r '.data.applicationId')
print_info "App 4 created: $APP4_ID (Emeka)"

# App 5
APP5_RESPONSE=$(curl -s -X POST \
    -F "firstName=Funmilayo" \
    -F "lastName=Babatunde" \
    -F "email=funmilayo.babatunde@student.edu.ng" \
    -F "phoneNumber=2348095678901" \
    -F "accountNumber=0567890123" \
    -F "bankCode=058" \
    -F "bvn=56789012345" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW1_ID/apply")
APP5_ID=$(echo "$APP5_RESPONSE" | jq -r '.data.applicationId')
print_info "App 5 created: $APP5_ID (Funmilayo)"

# Applications for TW2 (Laptop Purchase) - 4 applications
print_step "Creating applications for TW2 (Laptop Purchase)"

APP6_RESPONSE=$(curl -s -X POST \
    -F "firstName=Adebayo" \
    -F "lastName=Johnson" \
    -F "email=adebayo.johnson@tech.com" \
    -F "phoneNumber=2348096789012" \
    -F "accountNumber=0678901234" \
    -F "bankCode=044" \
    -F "bvn=67890123456" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW2_ID/apply")
APP6_ID=$(echo "$APP6_RESPONSE" | jq -r '.data.applicationId')
print_info "App 6 created: $APP6_ID (Adebayo - Laptop)"

APP7_RESPONSE=$(curl -s -X POST \
    -F "firstName=Ngozi" \
    -F "lastName=Okoro" \
    -F "email=ngozi.okoro@tech.com" \
    -F "phoneNumber=2348097890123" \
    -F "accountNumber=0789012345" \
    -F "bankCode=057" \
    -F "bvn=78901234567" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW2_ID/apply")
APP7_ID=$(echo "$APP7_RESPONSE" | jq -r '.data.applicationId')
print_info "App 7 created: $APP7_ID (Ngozi - Laptop)"

APP8_RESPONSE=$(curl -s -X POST \
    -F "firstName=Yusuf" \
    -F "lastName=Abdullahi" \
    -F "email=yusuf.abdullahi@tech.com" \
    -F "phoneNumber=2348098901234" \
    -F "accountNumber=0890123456" \
    -F "bankCode=011" \
    -F "bvn=89012345678" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW2_ID/apply")
APP8_ID=$(echo "$APP8_RESPONSE" | jq -r '.data.applicationId')
print_info "App 8 created: $APP8_ID (Yusuf - Laptop)"

APP9_RESPONSE=$(curl -s -X POST \
    -F "firstName=Blessing" \
    -F "lastName=Chukwu" \
    -F "email=blessing.chukwu@tech.com" \
    -F "phoneNumber=2348099012345" \
    -F "accountNumber=0901234567" \
    -F "bankCode=058" \
    -F "bvn=90123456789" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW2_ID/apply")
APP9_ID=$(echo "$APP9_RESPONSE" | jq -r '.data.applicationId')
print_info "App 9 created: $APP9_ID (Blessing - Laptop)"

# Applications for TW3 (Textbook Bundle) - 3 applications
print_step "Creating applications for TW3 (Textbook Bundle)"

APP10_RESPONSE=$(curl -s -X POST \
    -F "firstName=Ibrahim" \
    -F "lastName=Mohammed" \
    -F "email=ibrahim.mohammed@books.com" \
    -F "phoneNumber=2348081234567" \
    -F "accountNumber=1012345678" \
    -F "bankCode=044" \
    -F "bvn=01234567890" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW3_ID/apply")
APP10_ID=$(echo "$APP10_RESPONSE" | jq -r '.data.applicationId')
print_info "App 10 created: $APP10_ID (Ibrahim - Textbooks)"

APP11_RESPONSE=$(curl -s -X POST \
    -F "firstName=Amina" \
    -F "lastName=Bello" \
    -F "email=amina.bello@books.com" \
    -F "phoneNumber=2348082345678" \
    -F "accountNumber=1123456789" \
    -F "bankCode=057" \
    -F "bvn=11234567890" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW3_ID/apply")
APP11_ID=$(echo "$APP11_RESPONSE" | jq -r '.data.applicationId')
print_info "App 11 created: $APP11_ID (Amina - Textbooks)"

APP12_RESPONSE=$(curl -s -X POST \
    -F "firstName=Chinedu" \
    -F "lastName=Okafor" \
    -F "email=chinedu.okafor@books.com" \
    -F "phoneNumber=2348083456789" \
    -F "accountNumber=1234567890" \
    -F "bankCode=011" \
    -F "bvn=22345678901" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW3_ID/apply")
APP12_ID=$(echo "$APP12_RESPONSE" | jq -r '.data.applicationId')
print_info "App 12 created: $APP12_ID (Chinedu - Textbooks)"

# Applications for TW4 (Lab Equipment) - 3 applications
print_step "Creating applications for TW4 (Lab Equipment)"

APP13_RESPONSE=$(curl -s -X POST \
    -F "firstName=Aisha" \
    -F "lastName=Suleiman" \
    -F "email=aisha.suleiman@lab.edu" \
    -F "phoneNumber=2348084567890" \
    -F "accountNumber=2345678901" \
    -F "bankCode=058" \
    -F "bvn=33456789012" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW4_ID/apply")
APP13_ID=$(echo "$APP13_RESPONSE" | jq -r '.data.applicationId')
print_info "App 13 created: $APP13_ID (Aisha - Lab Equipment)"

APP14_RESPONSE=$(curl -s -X POST \
    -F "firstName=Tunde" \
    -F "lastName=Williams" \
    -F "email=tunde.williams@lab.edu" \
    -F "phoneNumber=2348085678901" \
    -F "accountNumber=3456789012" \
    -F "bankCode=044" \
    -F "bvn=44567890123" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW4_ID/apply")
APP14_ID=$(echo "$APP14_RESPONSE" | jq -r '.data.applicationId')
print_info "App 14 created: $APP14_ID (Tunde - Lab Equipment)"

APP15_RESPONSE=$(curl -s -X POST \
    -F "firstName=Nneka" \
    -F "lastName=Okoli" \
    -F "email=nneka.okoli@lab.edu" \
    -F "phoneNumber=2348086789012" \
    -F "accountNumber=4567890123" \
    -F "bankCode=057" \
    -F "bvn=55678901234" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW4_ID/apply")
APP15_ID=$(echo "$APP15_RESPONSE" | jq -r '.data.applicationId')
print_info "App 15 created: $APP15_ID (Nneka - Lab Equipment)"

# Applications for TW5 (Hostel) - 3 applications
print_step "Creating applications for TW5 (Hostel Accommodation)"

APP16_RESPONSE=$(curl -s -X POST \
    -F "firstName=Chukwuma" \
    -F "lastName=Ikenna" \
    -F "email=chukwuma.ikenna@hostel.edu" \
    -F "phoneNumber=2348087890123" \
    -F "accountNumber=5678901234" \
    -F "bankCode=011" \
    -F "bvn=66789012345" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW5_ID/apply")
APP16_ID=$(echo "$APP16_RESPONSE" | jq -r '.data.applicationId')
print_info "App 16 created: $APP16_ID (Chukwuma - Hostel)"

APP17_RESPONSE=$(curl -s -X POST \
    -F "firstName=Halima" \
    -F "lastName=Garba" \
    -F "email=halima.garba@hostel.edu" \
    -F "phoneNumber=2348088901234" \
    -F "accountNumber=6789012345" \
    -F "bankCode=058" \
    -F "bvn=77890123456" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW5_ID/apply")
APP17_ID=$(echo "$APP17_RESPONSE" | jq -r '.data.applicationId')
print_info "App 17 created: $APP17_ID (Halima - Hostel)"

APP18_RESPONSE=$(curl -s -X POST \
    -F "firstName=Obinna" \
    -F "lastName=Nnamdi" \
    -F "email=obinna.nnamdi@hostel.edu" \
    -F "phoneNumber=2348089012345" \
    -F "accountNumber=7890123456" \
    -F "bankCode=044" \
    -F "bvn=88901234567" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW5_ID/apply")
APP18_ID=$(echo "$APP18_RESPONSE" | jq -r '.data.applicationId')
print_info "App 18 created: $APP18_ID (Obinna - Hostel)"

# Applications for TW6 (Certification) - 2 applications
print_step "Creating applications for TW6 (Professional Certification)"

APP19_RESPONSE=$(curl -s -X POST \
    -F "firstName=Folake" \
    -F "lastName=Adeola" \
    -F "email=folake.adeola@cert.com" \
    -F "phoneNumber=2348071234567" \
    -F "accountNumber=8901234567" \
    -F "bankCode=057" \
    -F "bvn=99012345678" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW6_ID/apply")
APP19_ID=$(echo "$APP19_RESPONSE" | jq -r '.data.applicationId')
print_info "App 19 created: $APP19_ID (Folake - Certification)"

APP20_RESPONSE=$(curl -s -X POST \
    -F "firstName=Segun" \
    -F "lastName=Afolabi" \
    -F "email=segun.afolabi@cert.com" \
    -F "phoneNumber=2348072345678" \
    -F "accountNumber=9012345678" \
    -F "bankCode=011" \
    -F "bvn=00123456789" \
    -F "bankStatement=@$STATEMENT_FILE" \
    "$BASE_URL/public/trustwallet/$TW6_ID/apply")
APP20_ID=$(echo "$APP20_RESPONSE" | jq -r '.data.applicationId')
print_info "App 20 created: $APP20_ID (Segun - Certification)"

print_success "Created 20 applications across 6 TrustWallets"

##############################################################################
# Step 4: Wait for Analysis to Complete
##############################################################################

print_header "Step 4: Waiting for AI Analysis (180 seconds)"
print_info "All applications are being analyzed by the Trust Engine..."
print_info "This will take 60-100 seconds per batch. Please wait..."

sleep 180

print_success "Analysis period completed"

##############################################################################
# Step 5: Display Application IDs for MongoDB Manipulation
##############################################################################

print_header "Step 5: Application IDs Summary"

cat > /tmp/trustrail_app_ids.txt << EOF
# TrustRail Application IDs for MongoDB Manipulation
# Created: $(date)

# TW1 - School Fees
APP1_ID=$APP1_ID  # Chiamaka
APP2_ID=$APP2_ID  # Oluwaseun
APP3_ID=$APP3_ID  # Chidera
APP4_ID=$APP4_ID  # Emeka
APP5_ID=$APP5_ID  # Funmilayo

# TW2 - Laptop Purchase
APP6_ID=$APP6_ID  # Adebayo
APP7_ID=$APP7_ID  # Ngozi
APP8_ID=$APP8_ID  # Yusuf
APP9_ID=$APP9_ID  # Blessing

# TW3 - Textbook Bundle
APP10_ID=$APP10_ID  # Ibrahim
APP11_ID=$APP11_ID  # Amina
APP12_ID=$APP12_ID  # Chinedu

# TW4 - Lab Equipment
APP13_ID=$APP13_ID  # Aisha
APP14_ID=$APP14_ID  # Tunde
APP15_ID=$APP15_ID  # Nneka

# TW5 - Hostel Accommodation
APP16_ID=$APP16_ID  # Chukwuma
APP17_ID=$APP17_ID  # Halima
APP18_ID=$APP18_ID  # Obinna

# TW6 - Professional Certification
APP19_ID=$APP19_ID  # Folake
APP20_ID=$APP20_ID  # Segun

# TrustWallet IDs
TW1_ID=$TW1_ID  # School Fees
TW2_ID=$TW2_ID  # Laptop Purchase
TW3_ID=$TW3_ID  # Textbook Bundle
TW4_ID=$TW4_ID  # Lab Equipment
TW5_ID=$TW5_ID  # Hostel Accommodation
TW6_ID=$TW6_ID  # Professional Certification
TW7_ID=$TW7_ID  # Medical Equipment (inactive)

# Business ID
BUSINESS_ID=$BUSINESS_ID
EOF

print_info "Application IDs saved to: /tmp/trustrail_app_ids.txt"
cat /tmp/trustrail_app_ids.txt

print_success "Data seeding phase 1 complete!"
print_info "Next: Run the MongoDB manipulation script to set different statuses and create payments"

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. Review the application IDs above"
echo "2. Run: node backend/docs/testing/seed-advanced-data.js"
echo "3. This will create:"
echo "   - Applications in various states (ACTIVE, COMPLETED, FLAGGED_FOR_REVIEW, etc.)"
echo "   - Payment transactions (SUCCESSFUL, FAILED, PENDING)"
echo "   - Update TrustWallet balances"
echo "   - Enable withdrawal requests"
echo ""
