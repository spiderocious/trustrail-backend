# Test Data Seeding Guide

**User:** `e2e-test-1769785976@test.com`
**Password:** `SecurePass123!`

---

## Quick Start

```bash
# Make sure server is running
npm run dev

# Run the complete seeder (in another terminal)
./backend/docs/testing/seed-all-data.sh
```

This will take about 3-5 minutes and create comprehensive test data.

---

## What Gets Created

### TrustWallets (7 total)

| Name | Amount | Installments | Frequency | Interest | Status |
|------|---------|--------------|-----------|----------|--------|
| School Fees Payment Plan | ₦500,000 | 3 | Monthly | 0% | Active |
| Laptop Purchase Plan | ₦300,000 | 4 | Monthly | 5% | Active |
| Textbook Bundle | ₦100,000 | 2 | Monthly | 0% | Active |
| Lab Equipment Rental | ₦80,000 | 8 | Weekly | 0% | Active |
| Hostel Accommodation | ₦750,000 | 5 | Monthly | 3% | Active |
| Professional Certification | ₦250,000 | 6 | Monthly | 8% | Active |
| Medical Equipment | ₦150,000 | 3 | Monthly | 0% | **Inactive** |

### Applications (20+ total)

Applications are distributed across different states:

- **3 COMPLETED** - Full payment cycle completed
- **3 ACTIVE** - Currently making payments (partial)
- **2 MANDATE_ACTIVE** - Mandate activated, ready for payments
- **2 MANDATE_CREATED** - Mandate created, awaiting activation
- **3 FLAGGED_FOR_REVIEW** - Needs manual approval
- **2 AUTO_DECLINED** - Automatically declined by Trust Engine
- **1 DECLINED** - Manually declined
- **1 DEFAULTED** - Failed to make payments (3+ failures)
- **Rest** - AUTO_APPROVED or other states

### Payment Transactions (50+ total)

Payment statuses:
- **SUCCESSFUL** - Payment completed successfully
- **FAILED** - Payment failed (insufficient funds, etc.)
- **SCHEDULED** - Upcoming scheduled payment
- **PENDING** - Payment in progress

### Withdrawal Requests (5 total)

- **3 COMPLETED** - Successfully withdrawn
- **1 PENDING** - Awaiting processing
- **1 FAILED** - Failed withdrawal attempt

---

## Manual Seeding (Step by Step)

If you want more control, run the scripts separately:

### Step 1: Create Base Data

```bash
./backend/docs/testing/seed-test-data.sh
```

This creates:
- 7 TrustWallets
- 20 applications (all in PENDING/ANALYZING state)
- Waits 3 minutes for AI analysis

### Step 2: Advanced Data Manipulation

```bash
node backend/docs/testing/seed-advanced-data.js
```

This updates:
- Application statuses to various states
- Creates payment transactions
- Updates TrustWallet balances
- Creates withdrawal requests

---

## Data Breakdown by TrustWallet

### TW1: School Fees (₦500,000)
**5 Applications:**
1. Chiamaka Okonkwo - COMPLETED
2. Oluwaseun Adeyemi - COMPLETED
3. Chidera Nwankwo - COMPLETED
4. Emeka Eze - ACTIVE (partial payments)
5. Funmilayo Babatunde - ACTIVE (partial payments)

### TW2: Laptop Purchase (₦300,000)
**4 Applications:**
6. Adebayo Johnson - ACTIVE (partial payments)
7. Ngozi Okoro - MANDATE_ACTIVE
8. Yusuf Abdullahi - MANDATE_ACTIVE
9. Blessing Chukwu - MANDATE_CREATED

### TW3: Textbook Bundle (₦100,000)
**3 Applications:**
10. Ibrahim Mohammed - MANDATE_CREATED
11. Amina Bello - FLAGGED_FOR_REVIEW
12. Chinedu Okafor - FLAGGED_FOR_REVIEW

### TW4: Lab Equipment (₦80,000)
**3 Applications:**
13. Aisha Suleiman - FLAGGED_FOR_REVIEW
14. Tunde Williams - AUTO_DECLINED
15. Nneka Okoli - AUTO_DECLINED

### TW5: Hostel Accommodation (₦750,000)
**3 Applications:**
16. Chukwuma Ikenna - DECLINED (manual)
17. Halima Garba - DEFAULTED (failed payments)
18. Obinna Nnamdi - AUTO_APPROVED

### TW6: Professional Certification (₦250,000)
**2 Applications:**
19. Folake Adeola - AUTO_APPROVED
20. Segun Afolabi - AUTO_APPROVED

---

## Testing Scenarios

### Dashboard Overview
Login and view:
- Summary cards with real numbers
- Recent applications in various states
- Payment activity
- Revenue across TrustWallets

### Applications Management
- Filter by status (COMPLETED, ACTIVE, FLAGGED_FOR_REVIEW, etc.)
- Manually approve/decline flagged applications
- View application details with payment history
- See trust scores ranging from 20-95

### Payment Tracking
- View successful payments across applications
- See failed payment scenarios
- Check scheduled upcoming payments
- Monitor payment completion rates

### Withdrawal Management
- View completed withdrawals
- See pending withdrawal requests
- Check failed withdrawal scenarios
- Verify balance calculations

### Analytics & Reports
- TrustWallet performance comparison
- Application approval rates
- Revenue trends
- Trust score distribution
- Generate CSV/JSON reports

---

## Resetting Data

To start fresh, you can:

1. **Delete all data for this user:**
```javascript
// In MongoDB or through Mongo shell
db.businesses.deleteOne({ email: "e2e-test-1769785976@test.com" });
db.trustwallets.deleteMany({ businessId: "BIZ-..." });
db.applications.deleteMany({ businessId: "BIZ-..." });
db.paymenttransactions.deleteMany({ /* related to business */ });
db.withdrawals.deleteMany({ businessId: "BIZ-..." });
```

2. **Register the user again:**
```bash
# Use the register endpoint or run seed-all-data.sh again
```

---

## Customization

### Want Different Data?

Edit `seed-test-data.sh` to:
- Change TrustWallet configurations
- Modify installment plans
- Add more applications
- Use different customer names

Edit `seed-advanced-data.js` to:
- Adjust status distribution
- Change payment success/failure rates
- Modify withdrawal amounts
- Customize dates and timing

---

## Troubleshooting

### "Server is not running"
```bash
# Start the backend server first
cd backend
npm run dev
```

### "No applications found"
Run `seed-test-data.sh` first before running `seed-advanced-data.js`

### "Login failed"
The user might not exist. The scripts will show the login response if it fails.

### Analysis Taking Too Long
The script waits 180 seconds for OpenAI analysis. If your API is slow, increase the sleep time in `seed-test-data.sh`

### MongoDB Connection Issues
Check your `.env` file has correct `MONGO_URI`

---

## Related Files

- [seed-all-data.sh](seed-all-data.sh) - Main runner script
- [seed-test-data.sh](seed-test-data.sh) - Creates base data via API
- [seed-advanced-data.js](seed-advanced-data.js) - Advanced MongoDB manipulation
- [e2e-test-with-onepipe-mock.sh](e2e-test-with-onepipe-mock.sh) - Original E2E test

---

**Happy Testing! 🚀**

When you login, you should see a fully populated dashboard ready for frontend integration work.
