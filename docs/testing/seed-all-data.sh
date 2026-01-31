#!/bin/bash

##############################################################################
# Complete Test Data Seeding Runner
# Sets up comprehensive test data for e2e-test-1769785976@test.com
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "  TrustRail Complete Data Seeding"
echo "=========================================="
echo -e "${NC}\n"

echo -e "${YELLOW}This will create:${NC}"
echo "  ✓ 7 TrustWallets (6 active, 1 inactive)"
echo "  ✓ 20+ customer applications"
echo "  ✓ Applications in various states (COMPLETED, ACTIVE, FLAGGED_FOR_REVIEW, etc.)"
echo "  ✓ 50+ payment transactions (SUCCESSFUL, FAILED, SCHEDULED, PENDING)"
echo "  ✓ 5 withdrawal requests (COMPLETED, PENDING, FAILED)"
echo ""
echo -e "${YELLOW}Test User:${NC}"
echo "  Email: e2e-test-1769785976@test.com"
echo "  Password: SecurePass123!"
echo ""
echo -e "${RED}WARNING: This will modify your database!${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Check if server is running
echo -e "\n${BLUE}Checking if server is running...${NC}"
if ! curl -s "http://localhost:3030/health" > /dev/null; then
    echo -e "${RED}✗ Server is not running at http://localhost:3030${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"

# Phase 1: Create TrustWallets and Applications
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 1: Creating TrustWallets & Applications${NC}"
echo -e "${BLUE}========================================${NC}\n"

bash docs/testing/seed-test-data.sh

# Phase 2: Advanced data manipulation
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 2: Setting Statuses & Creating Payments${NC}"
echo -e "${BLUE}========================================${NC}\n"

node docs/testing/seed-advanced-data.js

# Done!
echo -e "\n${GREEN}"
echo "=========================================="
echo "  ✓ Data Seeding Complete!"
echo "=========================================="
echo -e "${NC}\n"

echo -e "${YELLOW}Login Credentials:${NC}"
echo "  Email: e2e-test-1769785976@test.com"
echo "  Password: SecurePass123!"
echo ""
echo -e "${YELLOW}What you now have:${NC}"
echo "  • 6 active TrustWallets with different configurations"
echo "  • 20+ applications in various states"
echo "  • 50+ payment transactions"
echo "  • 5 withdrawal requests"
echo "  • Rich data for frontend integration testing"
echo ""
echo -e "${GREEN}Happy Testing! 🚀${NC}\n"
