# TrustRail Backend - Complete Implementation Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Database Design](#database-design)
7. [API Endpoints](#api-endpoints)
8. [Core Services](#core-services)
9. [Background Jobs](#background-jobs)
10. [Middleware](#middleware)
11. [Integration Points](#integration-points)
12. [Security & Encryption](#security--encryption)
13. [Implementation Workflow](#implementation-workflow)
14. [Success Criteria](#success-criteria)

---

## Executive Summary

**TrustRail** is a white-label Buy Now Pay Later (BNPL) platform that enables Nigerian businesses to offer installment payment plans to their customers. Unlike traditional BNPL services that rely on credit bureaus or payment history, TrustRail analyzes customer bank statements to assess affordability and creditworthiness.

**Core Innovation:** Automated bank statement analysis that generates a trust score (0-100) to determine if a customer can afford monthly installments.

**Technical Stack:** Node.js + Express + TypeScript + MongoDB

**Key Constraint:** No third-party job queues (Redis, BullMQ) - use native Node.js background jobs only.

---

## Product Overview

### What Problem Does TrustRail Solve?

Nigerian businesses want to offer installment payments to increase sales, but lack:
1. **Credit Assessment Tools** - No access to reliable credit bureaus
2. **Technical Infrastructure** - Complex banking APIs (NIBSS/PWA) are hard to integrate
3. **Risk Management** - No way to determine customer affordability

### How TrustRail Works

**Business Owner Journey:**
1. Business registers on TrustRail
2. Business creates "TrustWallets" (payment collection points)
3. Each TrustWallet has its own installment plan rules and approval thresholds
4. Business shares TrustWallet public URL with customers

**Customer Journey:**
1. Customer visits TrustWallet URL
2. Customer submits:
   - Bank account details (for direct debit mandate)
   - 3-month bank statement (CSV file)
3. TrustRail analyzes statement in background
4. Customer gets instant decision: Approved / Flagged for Review / Declined
5. If approved: Mandate is created, customer pays down payment
6. Installments automatically debit from customer's account monthly

**Business Benefit:**
- No technical integration required
- Risk-free (only approved customers get installments)
- Automated payment collection
- Real-time payment tracking

---

### Business Model

**Hierarchy:**
```
1 Business Owner
  └── Multiple TrustWallets (e.g., "Fees for CS Dept", "Medical Equipment Payment")
       └── Multiple Customer Applications per TrustWallet
            └── Multiple Payment Transactions per Application
```

**Example Use Case:**
- **Business:** Lagos State University
- **TrustWallet 1:** Computer Science Department Fees
  - Rules: ₦100,000 total, 20% down payment, 4 monthly installments
  - Approval: Auto-approve if trust score ≥ 70
- **TrustWallet 2:** Engineering Department Fees
  - Rules: ₦150,000 total, 30% down payment, 6 monthly installments
  - Approval: Auto-approve if trust score ≥ 80

Each TrustWallet operates independently with its own risk appetite.

---

### Key Concepts

**TrustWallet:**
- Embeddable payment widget with unique public URL
- Contains installment plan configuration (amount, down payment %, installment count, frequency)
- Contains approval workflow rules (auto-approve threshold, auto-decline threshold, minimum trust score)

**Application:**
- A customer's request to pay via installments
- Status flow: `PENDING_ANALYSIS` → `ANALYZING` → `APPROVED/DECLINED/FLAGGED_FOR_REVIEW` → `MANDATE_CREATED` → `MANDATE_ACTIVE` → `ACTIVE` → `COMPLETED/DEFAULTED`

**Trust Engine:**
- Background service that analyzes bank statement CSV
- Generates trust score (0-100) based on income stability, spending behavior, balance health, transaction patterns
- Outputs detailed report: income sources, debt-to-income ratio, risk flags, affordability assessment

**Trust Score:**
- 0-100 numeric score indicating customer's creditworthiness
- Based on bank statement analysis (NOT payment history with TrustRail)
- Components:
  - Income Stability (30 points): Consistent salary, adequate income vs. installment amount
  - Spending Behavior (25 points): Debt ratio, gambling activity, savings rate
  - Balance Health (20 points): Average balance, minimum balance buffer
  - Transaction Behavior (15 points): Bounce count, overdraft usage, activity level
  - Affordability (10 points): Installment amount vs. disposable income

**Mandate:**
- Legal authorization for recurring direct debits from customer's bank account
- Created via PWA (PayWithAccount) API after customer approval
- Activated by NIBSS (Nigerian Inter-Bank Settlement System) within 24 hours

**PWA Integration:**
- PayWithAccount is the payment infrastructure provider
- Handles: mandate creation, direct debits, virtual account generation
- TrustRail acts as orchestrator, PWA executes payments

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRUSTRAIL PLATFORM                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   Business   │    │ Trust Engine │    │  Background  │    │
│  │   Owner API  │    │   (Analysis) │    │     Jobs     │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│          │                   │                    │            │
│          └───────────────────┴────────────────────┘            │
│                             │                                  │
│                    ┌────────▼────────┐                        │
│                    │    MongoDB      │                        │
│                    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
         │                                            │
         │ REST API                                   │ Webhooks
         │                                            │
┌────────▼────────┐                         ┌────────▼────────┐
│   Public URLs   │                         │  PWA/NIBSS API  │
│  (Customers)    │                         │   (Payments)    │
└─────────────────┘                         └─────────────────┘
```

### Data Flow: Customer Application to Payment

```
1. Customer submits application → Public API
   ↓
2. Application saved with status: PENDING_ANALYSIS
   ↓
3. Background Job picks up application
   ↓
4. Trust Engine analyzes CSV bank statement
   ↓
5. Trust Engine generates score + decision
   ↓
6. If APPROVED:
   → Create PWA mandate (encrypted customer details)
   → Wait for PWA webhook: mandate activation
   ↓
7. On mandate activation:
   → Send installment invoice to PWA
   → PWA creates virtual account for down payment
   ↓
8. Customer pays down payment
   → PWA sends credit webhook
   ↓
9. PWA auto-schedules monthly debits
   ↓
10. Each debit:
    → PWA sends debit webhook (success/failure)
    → TrustRail updates payment status
    → TrustRail notifies business owner
```

---

### Three-Layer Architecture

**Layer 1: Route → Controller (Request Handling)**
- Receives HTTP requests
- Validates input using express-validator
- Extracts authentication data (JWT)
- Sanitizes and formats data
- Calls appropriate service method
- Returns formatted response

**Layer 2: Service (Business Logic)**
- Contains ALL business logic
- Performs database operations
- Orchestrates complex workflows
- Integrates with external APIs (PWA)
- Handles error scenarios
- No direct HTTP concerns

**Layer 3: Model (Data Layer)**
- Mongoose schemas
- Database constraints
- Indexes for query optimization
- Virtual fields
- Instance methods

**Critical Rule:** Controllers ONLY sanitize data and call services. ALL logic lives in services.

---

## Technology Stack

### Core Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 20.x LTS | JavaScript runtime |
| Language | TypeScript | 5.3+ | Type safety |
| Framework | Express | 4.18+ | Web framework |
| Database | MongoDB | 7.0+ | NoSQL database |
| ODM | Mongoose | 8.0+ | MongoDB object modeling |
| Auth | jsonwebtoken | 9.0+ | JWT generation/verification |
| Encryption | crypto (native) | - | TripleDES for PWA |
| Password Hashing | bcrypt | 5.1+ | Password security |
| Validation | express-validator | 7.0+ | Request validation |
| HTTP Client | axios | 1.6+ | PWA API calls |
| CSV Parsing | csv-parser | 3.0+ | Bank statement parsing |
| Logging | winston | 3.11+ | Structured logging |
| Date Handling | date-fns | 3.0+ | Date manipulation |
| Environment | dotenv | 16.0+ | Environment variables |
| Security | helmet | 7.1+ | Security headers |
| CORS | cors | 2.8+ | Cross-origin requests |
| File Upload | multer | 1.4.5+ | CSV file handling |

### What We DO NOT Use

❌ **Redis** - No external caching layer
❌ **BullMQ / Bee-Queue / Kue** - No third-party job queues
❌ **Nodemailer / SendGrid** - No email services
❌ **Email Verification** - Skip on signup
❌ **Socket.io** - No real-time WebSockets
❌ **GraphQL** - REST API only
❌ **TypeORM / Prisma** - Mongoose only
❌ **PM2** - Not required for MVP
❌ **Docker** - Not required for MVP

### Why These Constraints?

- **Simplicity:** Fewer moving parts = faster development
- **Cost:** No external services to pay for
- **Deployment:** Easier to deploy without Redis/queue dependencies
- **Development:** Native Node.js solutions are sufficient for MVP scale

---

## Project Structure

```
trustrail-backend/
├── src/
│   ├── config/                      # Configuration files
│   │   ├── database.ts              # MongoDB connection setup
│   │   ├── environment.ts           # Environment variable loader & validation
│   │   └── logger.ts                # Winston logger configuration
│   │
│   ├── models/                      # Mongoose schemas (9 models)
│   │   ├── Business.ts              # Business owner accounts
│   │   ├── TrustWallet.ts           # TrustWallet configurations
│   │   ├── Application.ts           # Customer applications
│   │   ├── TrustEngineOutput.ts     # Bank statement analysis results
│   │   ├── PaymentTransaction.ts    # Individual payment records
│   │   ├── Withdrawal.ts            # Business withdrawal requests
│   │   ├── PWAWebhookLog.ts         # Incoming PWA webhooks (audit trail)
│   │   ├── BusinessWebhookLog.ts    # Outgoing business webhooks (delivery logs)
│   │   └── AuditLog.ts              # System-wide audit trail
│   │
│   ├── routes/                      # Express route definitions
│   │   ├── index.ts                 # Route aggregator (combines all routes)
│   │   ├── authRoutes.ts            # /api/auth/* - Registration, login
│   │   ├── trustWalletRoutes.ts     # /api/trustwallets/* - TrustWallet CRUD
│   │   ├── applicationRoutes.ts     # /api/applications/* - Application management
│   │   ├── paymentRoutes.ts         # /api/payments/* - Payment viewing
│   │   ├── withdrawalRoutes.ts      # /api/withdrawals/* - Withdrawal requests
│   │   ├── dashboardRoutes.ts       # /api/dashboard/* - Analytics & stats
│   │   ├── webhookRoutes.ts         # /api/webhooks/* - Webhook config + PWA receiver
│   │   ├── publicRoutes.ts          # /public/* - Customer-facing endpoints
│   │   ├── adminRoutes.ts           # /admin/* - Admin monitoring endpoints
│   │   └── healthRoutes.ts          # /health - Health check
│   │
│   ├── controllers/                 # Request handlers (thin layer)
│   │   ├── authController.ts        # Handle auth requests
│   │   ├── trustWalletController.ts # Handle TrustWallet requests
│   │   ├── applicationController.ts # Handle application requests
│   │   ├── paymentController.ts     # Handle payment viewing requests
│   │   ├── withdrawalController.ts  # Handle withdrawal requests
│   │   ├── dashboardController.ts   # Handle dashboard requests
│   │   ├── webhookController.ts     # Handle webhook config + PWA webhooks
│   │   ├── publicController.ts      # Handle public customer requests
│   │   ├── adminController.ts       # Handle admin requests
│   │   └── healthController.ts      # Handle health checks
│   │
│   ├── services/                    # Business logic (thick layer)
│   │   ├── authService.ts           # Registration, login, JWT generation
│   │   ├── trustWalletService.ts    # TrustWallet CRUD operations
│   │   ├── applicationService.ts    # Application management, manual approve/decline
│   │   ├── trustEngineService.ts    # ⭐ CRITICAL: Bank statement analysis + scoring
│   │   ├── pwaService.ts            # ⭐ CRITICAL: PWA API integration wrapper
│   │   ├── encryptionService.ts     # ⭐ CRITICAL: TripleDES encryption for PWA
│   │   ├── paymentService.ts        # Payment transaction management
│   │   ├── withdrawalService.ts     # Withdrawal processing
│   │   ├── webhookService.ts        # Outgoing webhooks to businesses
│   │   ├── pwaWebhookService.ts     # Incoming PWA webhook processing
│   │   ├── dashboardService.ts      # Analytics calculations
│   │   └── auditService.ts          # Audit log creation
│   │
│   ├── jobs/                        # Background jobs (native Node.js)
│   │   ├── statementAnalysisJob.ts  # ⭐ Process pending applications
│   │   ├── paymentMonitorJob.ts     # Check for overdue payments
│   │   └── jobScheduler.ts          # Job manager (setInterval wrapper)
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── authMiddleware.ts        # JWT verification for business APIs
│   │   ├── adminAuthMiddleware.ts   # JWT verification for admin APIs
│   │   ├── validationMiddleware.ts  # Request validation error handler
│   │   ├── errorMiddleware.ts       # Global error handler
│   │   └── loggingMiddleware.ts     # Request/response logging
│   │
│   ├── utils/                       # Helper functions
│   │   ├── responseFormatter.ts     # Standardized API responses
│   │   ├── idGenerator.ts           # Generate unique IDs (TR-BIZ-xxx, TW-xxx, etc.)
│   │   ├── dateUtils.ts             # Date manipulation helpers
│   │   ├── csvParser.ts             # Bank statement CSV parsing logic
│   │   └── signatureGenerator.ts    # MD5 signature for PWA requests
│   │
│   ├── types/                       # TypeScript type definitions
│   │   ├── express.d.ts             # Express type extensions (add businessId to Request)
│   │   ├── api.types.ts             # API request/response types
│   │   ├── pwa.types.ts             # PWA API request/response types
│   │   └── trustEngine.types.ts     # Trust engine internal types
│   │
│   ├── validators/                  # Express-validator schemas
│   │   ├── authValidators.ts        # Registration, login validation
│   │   ├── trustWalletValidators.ts # TrustWallet creation validation
│   │   ├── applicationValidators.ts # Application validation
│   │   └── paymentValidators.ts     # Payment validation
│   │
│   ├── app.ts                       # Express app setup (middleware, routes)
│   └── server.ts                    # HTTP server + database connection + job scheduler
│
├── uploads/                         # File upload directory
│   └── statements/                  # Bank statement CSV files
│
├── logs/                            # Application logs
│   ├── error.log                    # Error logs only
│   └── combined.log                 # All logs
│
├── .env                             # Environment variables (not committed)
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── package.json                     # NPM dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

---

## Database Design

### Schema Overview

We have **9 MongoDB collections** (Mongoose models):

1. **Business** - Business owner accounts
2. **TrustWallet** - Payment collection configurations
3. **Application** - Customer applications
4. **TrustEngineOutput** - Bank statement analysis results
5. **PaymentTransaction** - Individual payment records
6. **Withdrawal** - Withdrawal requests
7. **PWAWebhookLog** - Incoming webhooks from PWA
8. **BusinessWebhookLog** - Outgoing webhooks to businesses
9. **AuditLog** - System audit trail

---

### 1. Business Schema

**Purpose:** Store business owner account information

**Key Fields:**
- `businessId` (string, unique, indexed) - Format: `TR-BIZ-{timestamp}`
- `businessName` (string, required)
- `email` (string, unique, lowercase, required)
- `password` (string, required) - bcrypt hashed
- `phoneNumber` (string, required) - Format: `234XXXXXXXXXX`
- `rcNumber` (string, required, unique) - Company registration number
- `billerCode` (string, indexed) - From PWA create merchant API
- `pwaMerchantId` (string) - PWA merchant identifier
- `settlementAccountNumber` (string) - Where to send collected funds
- `settlementBankCode` (string) - Bank code (3-digit)
- `settlementAccountName` (string) - Account name for verification
- `webhookUrl` (string) - Where we send payment notifications
- `webhookSecret` (string) - For webhook signature generation
- `isActive` (boolean, default: true)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Indexes:**
- Primary: `businessId` (unique)
- Secondary: `email` (unique), `billerCode`

**Relationships:**
- Has many: TrustWallets, Applications

---

### 2. TrustWallet Schema

**Purpose:** Store TrustWallet configurations (installment plans + approval rules)

**Key Fields:**
- `trustWalletId` (string, unique, indexed) - Format: `TW-{timestamp}`
- `businessId` (string, required, indexed) - Foreign key to Business
- `name` (string, required) - e.g., "Computer Science Dept Fees"
- `description` (string, optional)

**Installment Plan (embedded object):**
- `totalAmount` (number, required) - e.g., 100000
- `downPaymentPercentage` (number, required) - e.g., 20 (means 20%)
- `installmentCount` (number, required) - e.g., 4
- `frequency` (enum: 'weekly' | 'monthly', required)
- `interestRate` (number, default: 0) - e.g., 0 or 5 (percentage)

**Approval Workflow (embedded object):**
- `autoApproveThreshold` (number, required) - e.g., 85 (auto-approve if score ≥ 85)
- `autoDeclineThreshold` (number, required) - e.g., 40 (auto-decline if score < 40)
- `minTrustScore` (number, required) - e.g., 50 (minimum score required)

**Other Fields:**
- `publicUrl` (string, required) - Format: `/public/trustwallet/{trustWalletId}`
- `isActive` (boolean, default: true)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Indexes:**
- Primary: `trustWalletId` (unique)
- Secondary: `businessId`
- Compound: `(businessId, name)` (unique together)

**Relationships:**
- Belongs to: Business
- Has many: Applications

**Business Rules:**
- `downPaymentPercentage` must be 0-100
- `installmentCount` must be > 0
- `autoApproveThreshold` > `autoDeclineThreshold`
- `minTrustScore` must be 0-100

---

### 3. Application Schema

**Purpose:** Store customer applications for installment plans

**Status Flow:**
```
PENDING_ANALYSIS (initial)
    ↓
ANALYZING (background job processing)
    ↓
APPROVED / FLAGGED_FOR_REVIEW / DECLINED (trust engine decision)
    ↓
MANDATE_CREATED (PWA mandate created)
    ↓
MANDATE_ACTIVE (PWA mandate activated by NIBSS)
    ↓
ACTIVE (payments in progress)
    ↓
COMPLETED (all payments done) / DEFAULTED (too many failures)
```

**Key Fields:**
- `applicationId` (string, unique, indexed) - Format: `APP-{timestamp}`
- `trustWalletId` (string, required, indexed) - Foreign key
- `businessId` (string, required, indexed) - Foreign key

**Customer Details (embedded object):**
- `firstName` (string, required)
- `lastName` (string, required)
- `email` (string, required)
- `phoneNumber` (string, required, indexed) - Format: `234XXXXXXXXXX`
- `accountNumber` (string, required) - Customer's bank account
- `bankCode` (string, required) - 3-digit CBN code
- `bvn` (string, required) - Encrypted BVN

**Bank Statement:**
- `bankStatementCsvPath` (string, optional) - File path on server

**Status:**
- `status` (enum, required, indexed) - See status flow above

**Trust Engine:**
- `trustEngineOutputId` (string, indexed) - Foreign key to TrustEngineOutput

**PWA Integration:**
- `pwaMandateRef` (string, indexed) - From create mandate response
- `pwaMandateId` (number, indexed) - From activate webhook
- `virtualAccountNumber` (string, indexed) - For down payment
- `downPaymentReceived` (boolean, default: false)
- `downPaymentAmount` (number)
- `downPaymentReceivedAt` (Date)

**Calculated Amounts:**
- `totalAmount` (number, required) - From TrustWallet config
- `downPaymentRequired` (number, required) - Calculated from percentage
- `installmentAmount` (number, required) - Per installment
- `installmentCount` (number, required)
- `frequency` (enum: 'weekly' | 'monthly', required)

**Payment Tracking:**
- `paymentsCompleted` (number, default: 0)
- `totalPaid` (number, default: 0)
- `outstandingBalance` (number, required)

**Timestamps:**
- `submittedAt` (Date, default: now)
- `analyzedAt` (Date)
- `approvedAt` (Date)
- `declinedAt` (Date)
- `mandateActivatedAt` (Date)
- `completedAt` (Date)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Indexes:**
- Primary: `applicationId` (unique)
- Secondary: `trustWalletId`, `businessId`, `status`, `trustEngineOutputId`, `pwaMandateRef`, `pwaMandateId`, `virtualAccountNumber`, `customerDetails.phoneNumber`
- Compound: `(businessId, status)` for filtering

**Relationships:**
- Belongs to: TrustWallet, Business
- Has one: TrustEngineOutput
- Has many: PaymentTransactions

---

### 4. TrustEngineOutput Schema

**Purpose:** Store detailed bank statement analysis results

**Key Fields:**
- `outputId` (string, unique, indexed) - Format: `TEO-{timestamp}`
- `applicationId` (string, unique, indexed) - One-to-one relationship
- `trustWalletId` (string, required, indexed)
- `businessId` (string, required, indexed)

**Decision:**
- `decision` (enum: 'APPROVED' | 'FLAGGED_FOR_REVIEW' | 'DECLINED', required, indexed)
- `trustScore` (number, required, 0-100)

**Statement Analysis (embedded object):**

**Period Covered:**
- `startDate` (Date)
- `endDate` (Date)
- `monthsAnalyzed` (number)

**Income Analysis:**
- `totalIncome` (number) - Total over period
- `avgMonthlyIncome` (number) - Average per month
- `incomeConsistency` (number, 0-1) - How consistent (1 = 100% consistent)
- `incomeSources` (array of objects):
  - `description` (string) - e.g., "SALARY", "FREELANCE"
  - `frequency` (string) - e.g., "monthly"
  - `avgAmount` (number)

**Spending Analysis:**
- `totalSpending` (number)
- `avgMonthlySpending` (number)
- `spendingCategories` (object):
  - `bills` (number)
  - `loans` (number) - Existing loan repayments detected
  - `gambling` (number)
  - `transfers` (number)
  - `other` (number)

**Balance Analysis:**
- `avgBalance` (number)
- `minBalance` (number)
- `maxBalance` (number)
- `closingBalance` (number)

**Behavior Analysis:**
- `transactionCount` (number)
- `avgDailyTransactions` (number)
- `bounceCount` (number) - Insufficient funds occurrences
- `overdraftUsage` (boolean)

**Debt Profile:**
- `existingLoanRepayments` (number) - Monthly
- `debtToIncomeRatio` (number) - e.g., 0.3 = 30%

**Affordability Assessment (embedded object):**
- `canAffordInstallment` (boolean)
- `monthlyInstallmentAmount` (number)
- `disposableIncome` (number) - Income - (spending + loans)
- `affordabilityRatio` (number) - installment / disposableIncome
- `cushion` (number) - Remaining income after installment

**Risk Flags (array of objects):**
- `flag` (string) - e.g., "HIGH_GAMBLING_ACTIVITY"
- `severity` (enum: 'LOW' | 'MEDIUM' | 'HIGH')
- `description` (string)

**Rule Compliance (embedded object):**
- `passedMinTrustScore` (boolean)
- `overallPass` (boolean)

**Timestamps:**
- `analyzedAt` (Date, required)
- `createdAt` (Date, auto)

**Indexes:**
- Primary: `outputId` (unique)
- Secondary: `applicationId` (unique), `trustWalletId`, `businessId`, `decision`

**Relationships:**
- Belongs to: Application

---

### 5. PaymentTransaction Schema

**Purpose:** Track individual installment payments

**Status Flow:**
```
SCHEDULED (created by payment monitor job, not sent to PWA yet)
    ↓
PENDING (sent to PWA, awaiting webhook)
    ↓
SUCCESSFUL (debit webhook received with success) / FAILED (debit webhook with failure)
```

**Key Fields:**
- `transactionId` (string, unique, indexed) - Format: `TXN-{timestamp}`
- `applicationId` (string, required, indexed) - Foreign key
- `trustWalletId` (string, required, indexed) - Foreign key
- `businessId` (string, required, indexed) - Foreign key
- `amount` (number, required)
- `status` (enum: 'SCHEDULED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED', default: 'SCHEDULED', indexed)
- `paymentNumber` (number, required) - 1, 2, 3, etc.
- `totalPayments` (number, required) - Total expected
- `scheduledDate` (Date, required, indexed)
- `paidDate` (Date) - When actually paid
- `pwaPaymentId` (string, indexed) - From PWA webhook `meta.payment_id`
- `pwaTransactionRef` (string, indexed) - Our reference sent to PWA
- `failureReason` (string) - From PWA webhook
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Indexes:**
- Primary: `transactionId` (unique)
- Secondary: `applicationId`, `trustWalletId`, `businessId`, `status`, `scheduledDate`, `pwaPaymentId`, `pwaTransactionRef`
- Compound: `(applicationId, paymentNumber)` (unique together)

**Relationships:**
- Belongs to: Application, TrustWallet, Business

---

### 6. Withdrawal Schema

**Purpose:** Track business withdrawal requests

**Status Flow:**
```
PENDING (request created)
    ↓
PROCESSING (admin processing)
    ↓
COMPLETED (funds transferred) / FAILED (transfer failed)
```

**Key Fields:**
- `withdrawalId` (string, unique, indexed) - Format: `WD-{timestamp}`
- `trustWalletId` (string, required, indexed) - Which TrustWallet to withdraw from
- `businessId` (string, required, indexed) - Foreign key
- `amount` (number, required)
- `status` (enum: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED', default: 'PENDING')
- `requestedAt` (Date, default: now)
- `processedAt` (Date)
- `completedAt` (Date)
- `createdAt` (Date, auto)
- `updatedAt` (Date, auto)

**Indexes:**
- Primary: `withdrawalId` (unique)
- Secondary: `trustWalletId`, `businessId`

**Relationships:**
- Belongs to: TrustWallet, Business

---

### 7. PWAWebhookLog Schema

**Purpose:** Audit trail of all webhooks received from PWA

**Key Fields:**
- `logId` (string, unique, indexed) - Format: `PWAL-{timestamp}`
- `eventType` (enum: 'debit' | 'credit' | 'activate_mandate' | 'unknown', required, indexed)
- `requestType` (string, required) - From webhook `request_type`
- `requestRef` (string, required, indexed) - From webhook `request_ref`
- `rawPayload` (object, required) - Full webhook JSON
- `billerCode` (string, indexed) - Extracted from payload
- `transactionRef` (string, indexed) - Extracted from payload
- `status` (string) - "Successful" / "Failed"
- `signatureValid` (boolean, required) - Did signature verification pass?
- `processedSuccessfully` (boolean, required) - Did we process without errors?
- `errorMessage` (string) - If processing failed
- `receivedAt` (Date, default: now)
- `processedAt` (Date)

**Indexes:**
- Primary: `logId` (unique)
- Secondary: `eventType`, `requestRef`, `billerCode`, `transactionRef`

**Purpose:** Debugging PWA integration issues, audit trail, compliance

---

### 8. BusinessWebhookLog Schema

**Purpose:** Track webhooks sent to business owners

**Key Fields:**
- `logId` (string, unique, indexed) - Format: `BWL-{timestamp}`
- `businessId` (string, required, indexed) - Foreign key
- `event` (string, required, indexed) - e.g., "application.approved", "payment.success"
- `payload` (object, required) - Webhook body sent
- `url` (string, required) - Business webhook URL
- `status` (enum: 'pending' | 'delivered' | 'failed', default: 'pending', indexed)
- `httpStatus` (number) - HTTP response code
- `attempts` (number, default: 0) - Retry count
- `sentAt` (Date, default: now)
- `deliveredAt` (Date) - When successfully delivered
- `errorMessage` (string) - If delivery failed

**Indexes:**
- Primary: `logId` (unique)
- Secondary: `businessId`, `event`, `status`

**Purpose:** Webhook delivery monitoring, retry logic, debugging

---

### 9. AuditLog Schema

**Purpose:** System-wide audit trail for compliance and debugging

**Key Fields:**
- `logId` (string, unique, indexed) - Format: `AUD-{timestamp}`
- `action` (string, required, indexed) - e.g., "business.register", "application.approve", "payment.success"
- `actor` (embedded object):
  - `type` (enum: 'business' | 'admin' | 'system', required)
  - `id` (string) - businessId or 'admin'
  - `email` (string)
- `resourceType` (string, required, indexed) - e.g., "Application", "TrustWallet"
- `resourceId` (string, required, indexed) - ID of affected resource
- `changes` (object) - Before/after values for updates
- `metadata` (object) - Additional context
- `timestamp` (Date, default: now, indexed)

**Indexes:**
- Primary: `logId` (unique)
- Secondary: `action`, `resourceType`, `resourceId`, `timestamp`
- Compound: `(actor.id, timestamp)` for user activity history, `(resourceType, resourceId)` for resource history

**Purpose:** Compliance, debugging, user activity tracking, dispute resolution

---

## API Endpoints

### Endpoint Categories

1. **Authentication** - Business owner auth (3 endpoints)
2. **TrustWallet Management** - CRUD operations (8 endpoints)
3. **Application Management** - View and manual actions (6 endpoints)
4. **Payment Management** - View payments (2 endpoints)
5. **Withdrawal Management** - Request withdrawals (2 endpoints)
6. **Dashboard** - Analytics (2 endpoints)
7. **Webhooks** - Configuration and receiving (2 endpoints)
8. **Public** - Customer-facing (3 endpoints)
9. **Admin** - System monitoring (4 endpoints)
10. **Health** - System health (1 endpoint)

**Total: ~33 endpoints**

---

### 1. Authentication Routes (`/api/auth`)

**Base Path:** `/api/auth`
**Authentication:** None (public endpoints)

#### `POST /api/auth/register`
**Purpose:** Register new business owner account

**Request Body:**
- `businessName` (string, required) - Company name
- `email` (string, required) - Business email
- `password` (string, required) - Min 8 chars
- `phoneNumber` (string, required) - Nigerian format 234XXXXXXXXXX
- `rcNumber` (string, required) - Company registration number
- `settlementAccountNumber` (string, required) - Bank account for payouts
- `settlementBankCode` (string, required) - 3-digit bank code
- `settlementAccountName` (string, required) - Account name

**Validation:**
- Email must be valid and unique
- Phone number must match Nigerian format
- Password minimum 8 characters
- RC number must be unique
- Settlement account details must be complete

**Process:**
1. Validate input
2. Check if email/RC already exists
3. Hash password with bcrypt
4. Generate unique `businessId`
5. Create business record in database
6. Call PWA `create merchant` API
7. Store `billerCode` from PWA response
8. Generate JWT token
9. Return token + business details

**Response:**
- `token` (string) - JWT token for authentication
- `businessId` (string)
- `businessName` (string)
- `email` (string)
- `billerCode` (string) - From PWA

**Notes:**
- NO email verification (skip it)
- Business is immediately active after registration
- PWA merchant creation happens synchronously during registration

---

#### `POST /api/auth/login`
**Purpose:** Business owner login

**Request Body:**
- `email` (string, required)
- `password` (string, required)

**Process:**
1. Find business by email
2. Compare password with bcrypt hash
3. Generate JWT token
4. Return token + business details

**Response:**
- `token` (string) - JWT token
- `businessId` (string)
- `businessName` (string)
- `email` (string)

---

#### `POST /api/auth/logout`
**Purpose:** Logout (token invalidation - optional for MVP)

**Authentication:** Required (JWT)

**Process:**
- For MVP: Just tell frontend to delete token
- Future: Maintain blacklist of invalidated tokens

**Response:**
- `message` - "Logged out successfully"

**Notes:**
- JWT is stateless, so logout is client-side for MVP
- No server-side token blacklist needed for MVP

---

### 2. TrustWallet Routes (`/api/trustwallets`)

**Base Path:** `/api/trustwallets`
**Authentication:** Required (JWT) - All endpoints

#### `POST /api/trustwallets`
**Purpose:** Create new TrustWallet

**Request Body:**
- `name` (string, required) - e.g., "Computer Science Fees"
- `description` (string, optional)
- `installmentPlan` (object, required):
  - `totalAmount` (number, required)
  - `downPaymentPercentage` (number, required, 0-100)
  - `installmentCount` (number, required, > 0)
  - `frequency` (enum: 'weekly' | 'monthly', required)
  - `interestRate` (number, default: 0)
- `approvalWorkflow` (object, required):
  - `autoApproveThreshold` (number, required, 0-100)
  - `autoDeclineThreshold` (number, required, 0-100)
  - `minTrustScore` (number, required, 0-100)

**Validation:**
- Name unique per business
- `autoApproveThreshold` > `autoDeclineThreshold`
- `minTrustScore` ≤ `autoApproveThreshold`
- `downPaymentPercentage` between 0-100
- `installmentCount` > 0

**Process:**
1. Validate input
2. Extract `businessId` from JWT
3. Check name uniqueness for this business
4. Generate `trustWalletId`
5. Generate `publicUrl` = `/public/trustwallet/{trustWalletId}`
6. Create TrustWallet record
7. Log audit trail
8. Return TrustWallet details

**Response:**
- Full TrustWallet object including `publicUrl`

---

#### `GET /api/trustwallets`
**Purpose:** List all TrustWallets for logged-in business

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `isActive` (boolean, optional) - Filter by active status

**Process:**
1. Extract `businessId` from JWT
2. Query TrustWallets filtered by `businessId`
3. Apply pagination
4. Return list with metadata

**Response:**
- `trustWallets` (array)
- `pagination` (object):
  - `page` (number)
  - `limit` (number)
  - `totalCount` (number)
  - `totalPages` (number)

---

#### `GET /api/trustwallets/:id`
**Purpose:** Get single TrustWallet details

**Path Parameters:**
- `id` (string) - trustWalletId

**Process:**
1. Extract `businessId` from JWT
2. Find TrustWallet by `id` AND `businessId` (ensure ownership)
3. Return details

**Response:**
- Full TrustWallet object

**Error Cases:**
- 404 if not found or doesn't belong to this business

---

#### `PUT /api/trustwallets/:id`
**Purpose:** Update TrustWallet configuration

**Path Parameters:**
- `id` (string) - trustWalletId

**Request Body:**
- Same as create, but all fields optional
- Can update: `name`, `description`, `installmentPlan`, `approvalWorkflow`

**Process:**
1. Verify ownership (businessId from JWT matches)
2. Validate input
3. Update TrustWallet
4. Log audit trail
5. Return updated TrustWallet

**Response:**
- Updated TrustWallet object

---

#### `DELETE /api/trustwallets/:id`
**Purpose:** Delete TrustWallet (soft delete - set `isActive: false`)

**Path Parameters:**
- `id` (string) - trustWalletId

**Process:**
1. Verify ownership
2. Check if TrustWallet has active applications (prevent deletion if yes)
3. Set `isActive: false`
4. Log audit trail
5. Return success

**Response:**
- `message` - "TrustWallet deleted successfully"

**Business Rule:**
- Cannot delete TrustWallet with active applications
- Can delete if all applications are completed/declined

---

#### `GET /api/trustwallets/:id/applications`
**Purpose:** List all applications for specific TrustWallet

**Path Parameters:**
- `id` (string) - trustWalletId

**Query Parameters:**
- `status` (enum, optional) - Filter by application status
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Process:**
1. Verify ownership
2. Query applications filtered by `trustWalletId` and optional `status`
3. Apply pagination
4. Return list

**Response:**
- `applications` (array) - Each includes customer name, status, trust score, amounts
- `pagination` (object)

---

#### `GET /api/trustwallets/:id/payments`
**Purpose:** List all payments for specific TrustWallet

**Path Parameters:**
- `id` (string) - trustWalletId

**Query Parameters:**
- `status` (enum, optional) - Filter by payment status
- `startDate` (date, optional)
- `endDate` (date, optional)
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Process:**
1. Verify ownership
2. Query PaymentTransactions filtered by `trustWalletId` and optional filters
3. Apply pagination
4. Calculate summary stats (total collected, success rate)
5. Return list + stats

**Response:**
- `payments` (array)
- `summary` (object):
  - `totalCollected` (number)
  - `successfulPayments` (number)
  - `failedPayments` (number)
  - `successRate` (number)
- `pagination` (object)

---

#### `GET /api/trustwallets/:id/balance`
**Purpose:** Get total collected funds for TrustWallet (available for withdrawal)

**Path Parameters:**
- `id` (string) - trustWalletId

**Process:**
1. Verify ownership
2. Sum all SUCCESSFUL payments for this TrustWallet
3. Subtract already withdrawn amounts
4. Return available balance

**Response:**
- `totalCollected` (number) - Total successful payments
- `totalWithdrawn` (number) - Total already withdrawn
- `availableBalance` (number) - Available for withdrawal

---

#### `GET /api/trustwallets/:id/analytics`
**Purpose:** Get analytics for specific TrustWallet

**Path Parameters:**
- `id` (string) - trustWalletId

**Query Parameters:**
- `startDate` (date, optional)
- `endDate` (date, optional)

**Process:**
1. Verify ownership
2. Calculate metrics:
   - Total applications (by status)
   - Approval rate
   - Average trust score
   - Total revenue
   - Payment success rate
   - Completion rate
3. Return metrics

**Response:**
- `applications` (object):
  - `total` (number)
  - `approved` (number)
  - `declined` (number)
  - `pending` (number)
  - `approvalRate` (number)
- `trustScores` (object):
  - `average` (number)
  - `distribution` (object) - Count by score ranges
- `revenue` (object):
  - `totalCollected` (number)
  - `expectedTotal` (number)
  - `outstandingBalance` (number)
- `payments` (object):
  - `successfulCount` (number)
  - `failedCount` (number)
  - `successRate` (number)

---

### 3. Application Routes (`/api/applications`)

**Base Path:** `/api/applications`
**Authentication:** Required (JWT)

#### `GET /api/applications`
**Purpose:** List all applications across all TrustWallets for this business

**Query Parameters:**
- `trustWalletId` (string, optional) - Filter by specific TrustWallet
- `status` (enum, optional) - Filter by status
- `search` (string, optional) - Search by customer name/email/phone
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Process:**
1. Extract `businessId` from JWT
2. Query applications with filters
3. Include related data: customer name, trust score, TrustWallet name
4. Apply pagination
5. Return list

**Response:**
- `applications` (array) - Each includes:
  - `applicationId`
  - `customerName` (firstName + lastName)
  - `trustWalletName`
  - `status`
  - `trustScore` (if analyzed)
  - `totalAmount`
  - `outstandingBalance`
  - `submittedAt`
- `pagination` (object)

---

#### `GET /api/applications/:id`
**Purpose:** Get full application details

**Path Parameters:**
- `id` (string) - applicationId

**Process:**
1. Verify ownership (businessId from JWT)
2. Find application
3. Include related TrustWallet config
4. Include TrustEngineOutput if exists
5. Include payment transactions
6. Return full details

**Response:**
- Full Application object
- `trustWallet` (object) - Related TrustWallet details
- `trustEngineOutput` (object) - Full analysis if exists
- `payments` (array) - All payment transactions

---

#### `GET /api/applications/:id/statement-analysis`
**Purpose:** View detailed bank statement analysis (TrustEngineOutput)

**Path Parameters:**
- `id` (string) - applicationId

**Process:**
1. Verify ownership
2. Find application
3. Find related TrustEngineOutput
4. Return detailed analysis

**Response:**
- Full TrustEngineOutput object with all analysis details:
  - Income breakdown
  - Spending categories
  - Balance analysis
  - Risk flags
  - Affordability assessment

**Error Cases:**
- 404 if application not analyzed yet
- 403 if doesn't belong to this business

---

#### `POST /api/applications/:id/approve`
**Purpose:** Manually approve flagged application

**Path Parameters:**
- `id` (string) - applicationId

**Request Body:**
- `notes` (string, optional) - Admin notes for approval

**Validation:**
- Application must be in `FLAGGED_FOR_REVIEW` status

**Process:**
1. Verify ownership
2. Check application is flagged
3. Update status to `APPROVED`
4. Set `approvedAt` timestamp
5. Create PWA mandate
6. Store `pwaMandateRef`
7. Log audit trail
8. Send webhook to business
9. Return updated application

**Response:**
- Updated Application object

**Error Cases:**
- 400 if application is not flagged
- 409 if already processed

---

#### `POST /api/applications/:id/decline`
**Purpose:** Manually decline flagged application

**Path Parameters:**
- `id` (string) - applicationId

**Request Body:**
- `reason` (string, required) - Reason for decline

**Validation:**
- Application must be in `FLAGGED_FOR_REVIEW` status

**Process:**
1. Verify ownership
2. Check application is flagged
3. Update status to `DECLINED`
4. Set `declinedAt` timestamp
5. Store decline reason
6. Log audit trail
7. Send webhook to business
8. Return updated application

**Response:**
- Updated Application object

---

#### `GET /api/applications/:id/payments`
**Purpose:** List all payments for specific application

**Path Parameters:**
- `id` (string) - applicationId

**Process:**
1. Verify ownership
2. Find application
3. Query PaymentTransactions for this application
4. Return list with summary

**Response:**
- `payments` (array) - All payments
- `summary` (object):
  - `totalPaid` (number)
  - `outstandingBalance` (number)
  - `paymentsCompleted` (number)
  - `paymentsTotal` (number)

---

### 4. Payment Routes (`/api/payments`)

**Base Path:** `/api/payments`
**Authentication:** Required (JWT)

#### `GET /api/payments`
**Purpose:** List all payments across all applications

**Query Parameters:**
- `trustWalletId` (string, optional)
- `applicationId` (string, optional)
- `status` (enum, optional)
- `startDate` (date, optional)
- `endDate` (date, optional)
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Process:**
1. Extract `businessId` from JWT
2. Query PaymentTransactions with filters
3. Include customer name and application details
4. Apply pagination
5. Return list

**Response:**
- `payments` (array) - Each includes:
  - `transactionId`
  - `customerName`
  - `trustWalletName`
  - `amount`
  - `status`
  - `scheduledDate`
  - `paidDate`
  - `paymentNumber`
  - `totalPayments`
- `pagination` (object)

---

#### `GET /api/payments/:id`
**Purpose:** Get single payment transaction details

**Path Parameters:**
- `id` (string) - transactionId

**Process:**
1. Verify ownership
2. Find payment transaction
3. Include application details
4. Return full details

**Response:**
- Full PaymentTransaction object
- `application` (object) - Related application summary
- `customer` (object) - Customer details

---

### 5. Withdrawal Routes (`/api/withdrawals`)

**Base Path:** `/api/withdrawals`
**Authentication:** Required (JWT)

#### `POST /api/withdrawals`
**Purpose:** Request withdrawal of collected funds

**Request Body:**
- `trustWalletId` (string, required) - Which TrustWallet to withdraw from
- `amount` (number, required) - Amount to withdraw

**Validation:**
- Amount must be > 0
- Amount must not exceed available balance
- TrustWallet must belong to this business

**Process:**
1. Verify ownership of TrustWallet
2. Check available balance
3. Validate amount ≤ available balance
4. Generate `withdrawalId`
5. Create Withdrawal record with status `PENDING`
6. Log audit trail
7. Return withdrawal details

**Response:**
- Full Withdrawal object

**Notes:**
- Actual fund transfer is manual for MVP (admin processes offline)
- Future: Integrate with bank API for automated transfers

---

#### `GET /api/withdrawals`
**Purpose:** List withdrawal history

**Query Parameters:**
- `trustWalletId` (string, optional)
- `status` (enum, optional)
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Process:**
1. Extract `businessId` from JWT
2. Query Withdrawals with filters
3. Include TrustWallet name
4. Apply pagination
5. Return list

**Response:**
- `withdrawals` (array)
- `pagination` (object)

---

### 6. Dashboard Routes (`/api/dashboard`)

**Base Path:** `/api/dashboard`
**Authentication:** Required (JWT)

#### `GET /api/dashboard/overview`
**Purpose:** Get overall business statistics

**Process:**
1. Extract `businessId` from JWT
2. Calculate metrics:
   - Total TrustWallets (active/inactive)
   - Total applications (by status)
   - Total revenue (collected + outstanding)
   - Success rates
   - Recent activity
3. Return dashboard data

**Response:**
- `trustWallets` (object):
  - `total` (number)
  - `active` (number)
- `applications` (object):
  - `total` (number)
  - `approved` (number)
  - `declined` (number)
  - `pending` (number)
  - `active` (number)
  - `completed` (number)
- `revenue` (object):
  - `totalCollected` (number)
  - `outstandingBalance` (number)
  - `availableForWithdrawal` (number)
- `payments` (object):
  - `successfulCount` (number)
  - `failedCount` (number)
  - `successRate` (number)
- `recentActivity` (array) - Last 10 activities

---

#### `GET /api/dashboard/reports`
**Purpose:** Generate downloadable reports

**Query Parameters:**
- `type` (enum: 'applications' | 'payments', required)
- `trustWalletId` (string, optional)
- `startDate` (date, optional)
- `endDate` (date, optional)
- `format` (enum: 'json' | 'csv', default: 'json')

**Process:**
1. Extract `businessId` from JWT
2. Query data based on filters
3. Format as JSON or CSV
4. Return data

**Response:**
- JSON: Array of records
- CSV: CSV formatted string

---

### 7. Webhook Routes (`/api/webhooks`)

**Base Path:** `/api/webhooks`

#### `POST /api/webhooks/configure`
**Purpose:** Set business webhook URL for receiving notifications

**Authentication:** Required (JWT)

**Request Body:**
- `webhookUrl` (string, required) - HTTPS URL
- `events` (array, optional) - Specific events to receive (default: all)

**Validation:**
- URL must be HTTPS (in production)
- URL must be reachable (test ping)

**Process:**
1. Extract `businessId` from JWT
2. Validate URL format
3. Generate `webhookSecret` for signature
4. Update Business record
5. Test webhook with ping event
6. Return configuration

**Response:**
- `webhookUrl` (string)
- `webhookSecret` (string) - Use this to verify signatures
- `events` (array)

---

#### `POST /webhooks/pwa`
**Purpose:** Receive webhooks from PWA (payment notifications)

**Authentication:** None (verified by signature)

**Request Body:**
- Full PWA webhook payload (see PWA webhook documentation)

**Process:**
1. Log raw webhook to PWAWebhookLog
2. Verify signature using MD5(API_KEY + ";" + request_ref)
3. Route webhook based on event type:
   - `event_type: "debit"` → handleDebitEvent
   - `event_type: "credit"` → handleCreditEvent
   - `transaction_type: "activate_mandate"` → handleMandateActivation
4. Update application/payment status
5. Trigger next action (e.g., send installment invoice)
6. Send webhook to business owner
7. Return 200 OK

**Webhook Routing:**

**Debit Event (Payment Success/Failure):**
- Extract `transaction_ref` (our payment transactionId)
- Find PaymentTransaction
- Update status: PENDING → SUCCESSFUL/FAILED
- Update Application: `totalPaid`, `paymentsCompleted`, `outstandingBalance`
- If last payment and successful: Update Application status → COMPLETED
- Send webhook to business: `payment.success` or `payment.failed`

**Credit Event (Down Payment Received):**
- Extract `cr_account` (virtual account number)
- Find Application by `virtualAccountNumber`
- Update `downPaymentReceived: true`, `downPaymentReceivedAt: now`
- Call PWA `send invoice` (installment type)
- Send webhook to business: `downpayment.received`

**Mandate Activation:**
- Extract `transaction_ref` or `data.data.reference`
- Find Application by `pwaMandateRef`
- Update status: MANDATE_CREATED → MANDATE_ACTIVE
- Store `pwaMandateId` from `data.data.id`
- Set `mandateActivatedAt: now`
- Call PWA `send invoice` (installment type) to create virtual account
- Send webhook to business: `mandate.activated`

**Response:**
- `200 OK` - Webhook processed
- `401 Unauthorized` - Invalid signature
- `500 Internal Server Error` - Processing failed

**Important:** Return 200 immediately even if processing fails (log error for later debugging)

---

### 8. Public Routes (`/public`)

**Base Path:** `/public`
**Authentication:** None (customer-facing endpoints)

#### `GET /public/trustwallet/:trustWalletId`
**Purpose:** Get TrustWallet information for customer application page

**Path Parameters:**
- `trustWalletId` (string)

**Process:**
1. Find TrustWallet by id
2. Check `isActive: true`
3. Return public information (hide sensitive business data)

**Response:**
- `trustWalletId` (string)
- `businessName` (string)
- `name` (string) - TrustWallet name
- `description` (string)
- `installmentPlan` (object) - All details
- `requirements` (array) - What customer needs to provide

**Error Cases:**
- 404 if not found or inactive

---

#### `POST /public/trustwallet/:trustWalletId/apply`
**Purpose:** Customer submits application with bank statement

**Path Parameters:**
- `trustWalletId` (string)

**Request Body (multipart/form-data):**
- `firstName` (string, required)
- `lastName` (string, required)
- `email` (string, required)
- `phoneNumber` (string, required) - Nigerian format
- `accountNumber` (string, required)
- `bankCode` (string, required) - 3-digit
- `bvn` (string, required) - 11 digits
- `bankStatement` (file, required) - CSV file, max 5MB

**Validation:**
- All fields required
- Phone number must be Nigerian format
- Bank statement must be CSV file
- BVN must be 11 digits
- File size < 5MB

**Process:**
1. Validate input
2. Check TrustWallet exists and is active
3. Encrypt BVN using TripleDES
4. Save CSV file to `uploads/statements/`
5. Generate `applicationId`
6. Calculate amounts from TrustWallet config:
   - `downPaymentRequired` = totalAmount × (downPaymentPercentage / 100)
   - `installmentAmount` = (totalAmount - downPaymentRequired) / installmentCount
7. Create Application record with status `PENDING_ANALYSIS`
8. Log audit trail
9. Return application confirmation

**Response:**
- `applicationId` (string)
- `status` (string) - "PENDING_ANALYSIS"
- `message` (string) - "Application submitted successfully. Analysis in progress."
- `estimatedTime` (string) - "Analysis typically takes 2-5 minutes"

**Notes:**
- Background job will pick up and analyze this application
- Customer can check status using next endpoint

---

#### `GET /public/application/:applicationId/status`
**Purpose:** Check application status (for customer polling)

**Path Parameters:**
- `applicationId` (string)

**Process:**
1. Find application
2. Return current status and relevant details

**Response:**
- `applicationId` (string)
- `status` (string) - Current status
- `message` (string) - Status description
- `trustScore` (number) - If analyzed
- `decision` (string) - If analyzed: "APPROVED" / "DECLINED" / "FLAGGED"
- `virtualAccount` (object) - If approved and mandate created:
  - `accountNumber` (string)
  - `accountName` (string)
  - `bankName` (string)
  - `amount` (number) - Down payment amount
- `nextSteps` (string) - What customer should do next

**Status Messages:**
- `PENDING_ANALYSIS` → "Your application is being analyzed. This typically takes 2-5 minutes."
- `ANALYZING` → "Analysis in progress..."
- `APPROVED` → "Congratulations! You've been approved. Please pay down payment to activate installments."
- `DECLINED` → "Unfortunately, your application has been declined."
- `FLAGGED_FOR_REVIEW` → "Your application is under review. You'll be notified of the decision within 24 hours."
- `MANDATE_ACTIVE` → "Your installment plan is active. First payment will be debited on [date]."

---

### 9. Admin Routes (`/admin`)

**Base Path:** `/admin`
**Authentication:** Admin JWT (separate from business JWT)

#### `POST /admin/auth/login`
**Purpose:** Admin login

**Request Body:**
- `email` (string, required)
- `password` (string, required)

**Process:**
1. Check credentials against environment variables:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
2. Generate JWT with admin role
3. Return token

**Response:**
- `token` (string) - Admin JWT

**Notes:**
- Hardcoded admin credentials for MVP
- Uses separate JWT secret (`ADMIN_JWT_SECRET`)
- Token contains `{ role: 'admin', email }`

---

#### `GET /admin/health`
**Purpose:** System health check with detailed metrics

**Process:**
1. Check database connection
2. Check PWA API connectivity
3. Get background job status
4. Calculate system metrics

**Response:**
- `status` (string) - "healthy" / "degraded" / "unhealthy"
- `timestamp` (Date)
- `uptime` (number) - Seconds
- `database` (object):
  - `status` (string) - "connected" / "disconnected"
  - `responseTime` (number) - Milliseconds
- `pwa` (object):
  - `status` (string) - "connected" / "disconnected"
  - `lastSuccessfulCall` (Date)
- `backgroundJobs` (object):
  - `statementAnalysisJob` (object):
    - `running` (boolean)
    - `lastRun` (Date)
    - `processedCount` (number)
  - `paymentMonitorJob` (object):
    - `running` (boolean)
    - `lastRun` (Date)
- `metrics` (object):
  - `totalBusinesses` (number)
  - `totalApplications` (number)
  - `pendingAnalysis` (number)
  - `activePayments` (number)

---

#### `GET /admin/pwa-health`
**Purpose:** Check PWA API connectivity and webhook status

**Process:**
1. Test PWA API connection (make test request)
2. Count recent webhooks received
3. Check for webhook processing errors
4. Calculate webhook delivery success rate

**Response:**
- `pwaApi` (object):
  - `status` (string) - "connected" / "error"
  - `lastTestAt` (Date)
  - `responseTime` (number) - Milliseconds
  - `errorMessage` (string) - If error
- `webhooks` (object):
  - `received` (object):
    - `last24Hours` (number)
    - `lastReceived` (Date)
    - `signatureFailures` (number)
    - `processingErrors` (number)
  - `sent` (object):
    - `last24Hours` (number)
    - `deliverySuccessRate` (number)
    - `pendingRetries` (number)

---

#### `GET /admin/audit-logs`
**Purpose:** View system audit logs with filters

**Query Parameters:**
- `action` (string, optional) - Filter by action type
- `actorId` (string, optional) - Filter by actor (businessId)
- `resourceType` (string, optional) - Filter by resource type
- `resourceId` (string, optional) - Filter by specific resource
- `startDate` (date, optional)
- `endDate` (date, optional)
- `page` (number, default: 1)
- `limit` (number, default: 50)

**Process:**
1. Query AuditLog collection with filters
2. Apply pagination
3. Sort by timestamp (desc)
4. Return logs

**Response:**
- `logs` (array) - Each includes:
  - `logId`
  - `action`
  - `actor` (object)
  - `resourceType`
  - `resourceId`
  - `changes` (if update)
  - `metadata`
  - `timestamp`
- `pagination` (object)

**Example Actions to Filter:**
- `business.register`
- `trustwallet.create`
- `trustwallet.update`
- `application.submit`
- `application.approve`
- `application.decline`
- `payment.success`
- `payment.failed`
- `mandate.create`
- `mandate.activate`

---

#### `GET /admin/applications`
**Purpose:** View all applications across all businesses with filters

**Query Parameters:**
- `businessId` (string, optional)
- `trustWalletId` (string, optional)
- `status` (enum, optional)
- `minTrustScore` (number, optional)
- `maxTrustScore` (number, optional)
- `search` (string, optional) - Search customer name/email/phone
- `startDate` (date, optional)
- `endDate` (date, optional)
- `page` (number, default: 1)
- `limit` (number, default: 50)

**Process:**
1. Query Application collection with filters
2. Include business name, TrustWallet name, customer details
3. Include trust score if analyzed
4. Apply pagination
5. Sort by submittedAt (desc)
6. Return list

**Response:**
- `applications` (array) - Each includes:
  - `applicationId`
  - `businessName`
  - `trustWalletName`
  - `customerName`
  - `customerPhone`
  - `status`
  - `trustScore`
  - `totalAmount`
  - `submittedAt`
  - `analyzedAt`
- `pagination` (object)
- `summary` (object):
  - `totalCount` (number)
  - `statusCounts` (object) - Count by each status
  - `averageTrustScore` (number)

---

### 10. Health Route (`/health`)

**Base Path:** `/health`
**Authentication:** None

#### `GET /health`
**Purpose:** Basic health check (for load balancers / monitoring)

**Process:**
1. Check if server is responsive
2. Check database connection
3. Return status

**Response:**
- `status` (string) - "ok"
- `timestamp` (Date)
- `database` (string) - "connected" / "disconnected"

**Notes:**
- This is a lightweight endpoint for uptime monitoring
- Use `/admin/health` for detailed metrics

---

## Core Services

Services contain ALL business logic. Controllers only sanitize data and call services.

### Service Architecture

```
Controller (thin)
    ↓ Validates input
    ↓ Extracts auth data
    ↓ Calls service method
    ↓
Service (thick)
    ↓ Business logic
    ↓ Database operations
    ↓ External API calls
    ↓ Error handling
    ↓
Returns result to controller
```

---

### 1. Auth Service

**File:** `src/services/authService.ts`

**Responsibility:** Handle business registration, login, JWT generation

**Key Methods:**

#### `registerBusiness(data)`
**Input:** Registration data from request
**Process:**
1. Validate uniqueness (email, RC number)
2. Hash password with bcrypt (10 rounds)
3. Generate unique `businessId` (format: `TR-BIZ-{timestamp}`)
4. Create Business record in database
5. Call PWA `create merchant` API:
   - Send business details
   - Receive `billerCode` from PWA
6. Update Business record with `billerCode` and `pwaMerchantId`
7. Generate JWT token
8. Log audit: `business.register`
9. Return token + business details
**Output:** `{ token, business }`
**Errors:** Email exists, RC exists, PWA API error

#### `loginBusiness(email, password)`
**Input:** Login credentials
**Process:**
1. Find business by email
2. Compare password with bcrypt hash
3. Check `isActive: true`
4. Generate JWT token
5. Return token + business details
**Output:** `{ token, business }`
**Errors:** Invalid credentials, account inactive

#### `generateToken(businessId, email)`
**Input:** Business identifiers
**Process:**
1. Create JWT payload: `{ businessId, email, iat, exp }`
2. Sign with `JWT_SECRET`
3. Set expiry: 30 days
4. Return token
**Output:** JWT token string

---

### 2. TrustWallet Service

**File:** `src/services/trustWalletService.ts`

**Responsibility:** TrustWallet CRUD operations

**Key Methods:**

#### `createTrustWallet(businessId, data)`
**Input:** Business ID from JWT, TrustWallet configuration
**Process:**
1. Validate business ownership
2. Check name uniqueness for this business
3. Validate workflow thresholds (autoApprove > autoDecline)
4. Generate `trustWalletId` (format: `TW-{timestamp}`)
5. Generate `publicUrl` = `/public/trustwallet/{trustWalletId}`
6. Create TrustWallet record
7. Log audit: `trustwallet.create`
8. Return TrustWallet
**Output:** TrustWallet object

#### `listTrustWallets(businessId, filters, pagination)`
**Input:** Business ID, optional filters, page/limit
**Process:**
1. Query TrustWallets filtered by businessId
2. Apply additional filters (isActive)
3. Apply pagination
4. Count total for pagination metadata
5. Return list + pagination
**Output:** `{ trustWallets[], pagination }`

#### `getTrustWalletById(trustWalletId, businessId)`
**Input:** TrustWallet ID, Business ID for ownership check
**Process:**
1. Find TrustWallet by id AND businessId
2. Return TrustWallet or throw 404
**Output:** TrustWallet object

#### `updateTrustWallet(trustWalletId, businessId, updates)`
**Input:** TrustWallet ID, Business ID, update data
**Process:**
1. Verify ownership
2. Validate updates
3. Update TrustWallet
4. Log audit: `trustwallet.update` with changes
5. Return updated TrustWallet
**Output:** Updated TrustWallet object

#### `deleteTrustWallet(trustWalletId, businessId)`
**Input:** TrustWallet ID, Business ID
**Process:**
1. Verify ownership
2. Check for active applications (prevent delete if exists)
3. Soft delete: Set `isActive: false`
4. Log audit: `trustwallet.delete`
5. Return success
**Output:** `{ success: true }`

---

### 3. Application Service

**File:** `src/services/applicationService.ts`

**Responsibility:** Application management, manual approve/decline

**Key Methods:**

#### `createApplication(trustWalletId, customerData, csvFilePath)`
**Input:** TrustWallet ID, customer details, uploaded CSV path
**Process:**
1. Find TrustWallet (validate exists and active)
2. Encrypt BVN using TripleDES
3. Generate `applicationId` (format: `APP-{timestamp}`)
4. Calculate amounts from TrustWallet config:
   - `downPaymentRequired` = totalAmount × (downPaymentPercentage / 100)
   - `installmentAmount` = (totalAmount - downPaymentRequired) / installmentCount
   - `outstandingBalance` = totalAmount
5. Create Application record:
   - Status: `PENDING_ANALYSIS`
   - Store encrypted BVN
   - Store CSV file path
6. Log audit: `application.submit`
7. Return application
**Output:** Application object
**Notes:** Background job will pick this up for analysis

#### `listApplications(businessId, filters, pagination)`
**Input:** Business ID, filters (trustWalletId, status, search), pagination
**Process:**
1. Build query filtered by businessId
2. Apply additional filters
3. Apply search on customer name/email/phone
4. Apply pagination
5. Include related data: TrustWallet name, trust score
6. Return list + pagination
**Output:** `{ applications[], pagination }`

#### `getApplicationById(applicationId, businessId)`
**Input:** Application ID, Business ID for ownership
**Process:**
1. Find application with ownership check
2. Include related TrustWallet
3. Include TrustEngineOutput if exists
4. Include PaymentTransactions
5. Return full application details
**Output:** Application object with related data

#### `manuallyApprove(applicationId, businessId, notes)`
**Input:** Application ID, Business ID, optional notes
**Process:**
1. Verify ownership
2. Check status is `FLAGGED_FOR_REVIEW`
3. Update status to `APPROVED`
4. Set `approvedAt: now`
5. Call PWA `create mandate`:
   - Encrypt customer account details
   - Send to PWA
   - Receive mandate reference
6. Update Application with `pwaMandateRef`
7. Update status to `MANDATE_CREATED`
8. Log audit: `application.approve_manual`
9. Send webhook to business: `application.approved`
10. Return updated application
**Output:** Updated Application object
**Errors:** Not flagged, PWA API error

#### `manuallyDecline(applicationId, businessId, reason)`
**Input:** Application ID, Business ID, decline reason
**Process:**
1. Verify ownership
2. Check status is `FLAGGED_FOR_REVIEW`
3. Update status to `DECLINED`
4. Set `declinedAt: now`
5. Store decline reason
6. Log audit: `application.decline_manual`
7. Send webhook to business: `application.declined`
8. Return updated application
**Output:** Updated Application object

---

### 4. Trust Engine Service (⭐ CRITICAL)

**File:** `src/services/trustEngineService.ts`

**Responsibility:** Bank statement analysis, trust score calculation, affordability assessment

**Key Methods:**

#### `analyzeApplication(applicationId)`
**Input:** Application ID
**Process:**
1. Find application with TrustWallet config
2. Read CSV file from `bankStatementCsvPath`
3. Parse CSV → Extract transactions
4. Analyze income patterns
5. Analyze spending patterns
6. Analyze balance patterns
7. Analyze transaction behavior
8. Calculate debt-to-income ratio
9. Assess affordability
10. Calculate trust score (0-100)
11. Generate risk flags
12. Make decision (APPROVED/FLAGGED/DECLINED)
13. Create TrustEngineOutput record
14. Return output
**Output:** TrustEngineOutput object
**Notes:** This is called by background job

#### `parseBankStatementCsv(filePath)`
**Input:** CSV file path
**Process:**
1. Read CSV file using csv-parser
2. Detect header row
3. Parse each transaction:
   - Date (try multiple formats)
   - Description
   - Debit amount
   - Credit amount
   - Balance
4. Handle missing balance (calculate from running total)
5. Validate data integrity
6. Return array of transactions
**Output:** `Transaction[]` array
**Data Structure:**
```
Transaction {
  date: Date
  description: string
  debit: number
  credit: number
  balance: number
}
```

#### `analyzeIncome(transactions)`
**Input:** Array of transactions
**Process:**
1. Filter credit transactions (income)
2. Calculate total income over period
3. Calculate average monthly income
4. Detect income sources:
   - SALARY keywords: "SALARY", "SAL", "WAGES"
   - FREELANCE keywords: "TRANSFER", "REMITTANCE"
   - BUSINESS keywords: "POS", "PAYMENT FOR"
5. Calculate income consistency:
   - Count months with income
   - Calculate ratio: months_with_income / total_months
6. Identify frequency of each source (monthly, weekly, irregular)
7. Return income analysis
**Output:**
```
{
  totalIncome: number
  avgMonthlyIncome: number
  incomeConsistency: number (0-1)
  incomeSources: [
    { description, frequency, avgAmount }
  ]
}
```

#### `analyzeSpending(transactions)`
**Input:** Array of transactions
**Process:**
1. Filter debit transactions (spending)
2. Calculate total spending
3. Calculate average monthly spending
4. Categorize spending:
   - **Bills**: PHCN, DSTV, GOTV, AIRTEL, MTN, GLO, water bill
   - **Loans**: LOAN, REPAYMENT, INSTALLMENT, CREDIT CORP
   - **Gambling**: BET, BETKING, SPORTYBET, NAIRABET, 1XBET
   - **Transfers**: TRANSFER, FIP, NIP
   - **Other**: Everything else
5. Sum amounts per category
6. Return spending analysis
**Output:**
```
{
  totalSpending: number
  avgMonthlySpending: number
  spendingCategories: {
    bills: number
    loans: number
    gambling: number
    transfers: number
    other: number
  }
}
```

#### `analyzeBalance(transactions)`
**Input:** Array of transactions
**Process:**
1. Extract balance values
2. Calculate average balance
3. Find minimum balance (lowest point)
4. Find maximum balance (highest point)
5. Get closing balance (last transaction)
6. Return balance analysis
**Output:**
```
{
  avgBalance: number
  minBalance: number
  maxBalance: number
  closingBalance: number
}
```

#### `analyzeBehavior(transactions)`
**Input:** Array of transactions
**Process:**
1. Count total transactions
2. Calculate average daily transactions
3. Detect bounces:
   - Look for "INSUFFICIENT FUNDS", "REVERSAL", "DECLINED"
4. Count bounce occurrences
5. Detect overdraft usage:
   - Check if balance goes negative
6. Return behavior analysis
**Output:**
```
{
  transactionCount: number
  avgDailyTransactions: number
  bounceCount: number
  overdraftUsage: boolean
}
```

#### `calculateDebtProfile(incomeAnalysis, spendingAnalysis)`
**Input:** Income and spending analyses
**Process:**
1. Extract existing loan repayments from spending categories
2. Calculate debt-to-income ratio:
   - Formula: existingLoans / avgMonthlyIncome
3. Return debt profile
**Output:**
```
{
  existingLoanRepayments: number
  debtToIncomeRatio: number
}
```

#### `assessAffordability(incomeAnalysis, spendingAnalysis, debtProfile, installmentAmount)`
**Input:** All analyses + installment amount from TrustWallet
**Process:**
1. Calculate disposable income:
   - Formula: avgMonthlyIncome - (avgMonthlySpending + existingLoanRepayments)
2. Calculate affordability ratio:
   - Formula: installmentAmount / disposableIncome
3. Determine if can afford:
   - Rule: affordabilityRatio must be < 0.5 (installment < 50% of disposable income)
4. Calculate cushion:
   - Formula: disposableIncome - installmentAmount
5. Return affordability assessment
**Output:**
```
{
  canAffordInstallment: boolean
  monthlyInstallmentAmount: number
  disposableIncome: number
  affordabilityRatio: number
  cushion: number
}
```

#### `calculateTrustScore(allAnalyses)`
**Input:** Income, spending, balance, behavior analyses + affordability
**Process:**

**Formula Breakdown:**

**1. Income Stability (30 points max)**
- Income consistency: `incomeConsistency × 15` (15 points max)
- Income-to-installment ratio:
  - If installment < 20% of income: +15 points
  - If installment < 30% of income: +10 points
  - If installment < 40% of income: +5 points
  - Else: 0 points

**2. Spending Behavior (25 points max)**
- Debt-to-income penalty:
  - Points = `max(0, 10 - (debtToIncomeRatio × 20))`
  - Example: 30% debt ratio → 10 - 6 = 4 points
- Gambling penalty:
  - If gambling > 0: `-min(10, gamblingAmount / 1000)`
- Savings rate bonus:
  - Savings rate = (income - spending) / income
  - Points = `min(15, savingsRate × 20)`

**3. Balance Health (20 points max)**
- Balance-to-installment ratio:
  - If avgBalance > 2× installment: +10 points
  - If avgBalance > 1× installment: +5 points
  - Else: 0 points
- Minimum balance buffer:
  - If minBalance > installment: +10 points
  - If minBalance > 0.5× installment: +5 points
  - Else: 0 points

**4. Transaction Behavior (15 points max)**
- Bounce count:
  - If 0 bounces: +5 points
  - If ≤ 2 bounces: +2 points
  - If > 2 bounces: -5 points
- Overdraft usage:
  - If no overdraft: +5 points
  - If overdraft used: -5 points
- Activity level:
  - If > 30 transactions: +5 points
  - If > 15 transactions: +2 points
  - Else: 0 points

**5. Affordability (10 points max)**
- Affordability ratio:
  - If installment < 20% of disposable income: +10 points
  - If installment < 30%: +7 points
  - If installment < 40%: +4 points
  - Else: 0 points

**Final Score:**
- Sum all components
- Clamp between 0-100
- Round to integer

**Output:** Number (0-100)

#### `generateRiskFlags(behaviorAnalysis, spendingAnalysis)`
**Input:** Behavior and spending analyses
**Process:**
1. Check for risk indicators:
   - High gambling activity (> ₦10,000/month)
   - Frequent bounces (> 3)
   - Overdraft usage
   - High loan repayments (> 40% of income)
2. For each detected risk:
   - Create flag object
   - Assign severity (LOW/MEDIUM/HIGH)
   - Add description
3. Return array of risk flags
**Output:**
```
RiskFlag[] = [
  {
    flag: string (e.g., "HIGH_GAMBLING_ACTIVITY")
    severity: "LOW" | "MEDIUM" | "HIGH"
    description: string
  }
]
```

#### `makeDecision(trustScore, trustWallet, affordability)`
**Input:** Trust score, TrustWallet rules, affordability assessment
**Process:**
1. Check if can afford installment:
   - If `canAffordInstallment: false` → DECLINED
2. Check against TrustWallet rules:
   - If score < `autoDeclineThreshold` → DECLINED
   - If score < `minTrustScore` → DECLINED
   - If score ≥ `autoApproveThreshold` → APPROVED
   - Else → FLAGGED_FOR_REVIEW
3. Return decision
**Output:** "APPROVED" | "FLAGGED_FOR_REVIEW" | "DECLINED"

---

### 5. PWA Service (⭐ CRITICAL)

**File:** `src/services/pwaService.ts`

**Responsibility:** All PWA API integrations

**Key Methods:**

#### `createMerchant(business)`
**Input:** Business object
**Process:**
1. Generate `request_ref` (unique reference)
2. Build payload:
   - `request_type: "create merchant"`
   - Business details in `transaction.details`
3. Generate MD5 signature
4. Make POST request to PWA API
5. Parse response
6. Extract `billerCode` from response
7. Return biller code
**Output:** `{ billerCode: string }`
**Notes:** Called during business registration

#### `createMandate(application, business)`
**Input:** Application object, Business object
**Process:**
1. Generate `request_ref`
2. Encrypt customer credentials:
   - Format: `{accountNumber};{bankCode}`
   - Use TripleDES encryption
3. Encrypt BVN (already encrypted in Application, decrypt then re-encrypt for PWA)
4. Build payload:
   - `request_type: "create mandate"`
   - `auth.secure` = encrypted credentials
   - `meta.bvn` = encrypted BVN
   - `meta.biller_code` = business.billerCode
   - `meta.amount` = application.totalAmount
   - `meta.skip_consent: "true"`
5. Generate signature
6. Make POST request
7. Parse response
8. Extract mandate reference
9. Return reference
**Output:** `{ pwaMandateRef: string }`
**Notes:** Called after customer approval

#### `sendInstallmentInvoice(application, business)`
**Input:** Application object, Business object
**Process:**
1. Generate `request_ref`
2. Build payload:
   - `request_type: "send invoice"`
   - `meta.type: "instalment"`
   - `meta.down_payment` = application.downPaymentRequired
   - `meta.repeat_frequency` = application.frequency
   - `meta.repeat_start_date` = format date (YYYY-MM-DD-HH-mm-ss)
   - `meta.number_of_payments` = application.installmentCount
   - `meta.biller_code` = business.billerCode
3. Generate signature
4. Make POST request
5. Parse response
6. Extract virtual account details from response
7. Return virtual account
**Output:** `{ virtualAccountNumber: string }`
**Notes:** Called after mandate activation

#### `generateSignature(requestRef)`
**Input:** Request reference string
**Process:**
1. Concatenate: `API_KEY + ";" + requestRef`
2. Hash with MD5
3. Return hex digest
**Output:** MD5 hash string

#### `verifyWebhookSignature(requestRef, receivedSignature)`
**Input:** Request ref from webhook, signature from webhook
**Process:**
1. Generate expected signature using `generateSignature(requestRef)`
2. Compare with received signature
3. Return boolean
**Output:** Boolean (true if valid)

#### `makeRequest(payload)`
**Input:** PWA API payload
**Process:**
1. Add headers:
   - `Authorization: Bearer {API_KEY}`
   - `Signature: {generated_signature}`
   - `Content-Type: application/json`
2. Make POST request to `PWA_BASE_URL`
3. Handle errors:
   - Network errors
   - 4xx/5xx responses
   - Timeout
4. Parse response JSON
5. Check response status
6. Return response data
**Output:** Response object
**Error Handling:**
- Throw descriptive errors for troubleshooting
- Log all requests/responses for debugging

---

### 6. Encryption Service (⭐ CRITICAL)

**File:** `src/services/encryptionService.ts`

**Responsibility:** TripleDES encryption for PWA, bcrypt for passwords

**Key Methods:**

#### `encryptForPWA(accountNumber, bankCode)`
**Input:** Account number, bank code
**Process:**
1. Format plain text: `{accountNumber};{bankCode}`
2. Get encryption key from environment (`TRIPLE_DES_KEY`)
3. Validate key is exactly 24 bytes
4. Create TripleDES cipher (algorithm: des-ede3)
5. Encrypt plain text
6. Convert to base64
7. Return encrypted string
**Output:** Base64-encoded encrypted string
**Notes:** This goes into PWA API `auth.secure` field

#### `encryptBVN(bvn)`
**Input:** BVN string (11 digits)
**Process:**
1. Same as `encryptForPWA` but for single value
2. Return encrypted string
**Output:** Base64-encoded encrypted string

#### `hashPassword(password)`
**Input:** Plain text password
**Process:**
1. Generate salt with bcrypt (10 rounds)
2. Hash password with salt
3. Return hash
**Output:** Bcrypt hash string
**Notes:** Used for business owner passwords

#### `comparePassword(password, hash)`
**Input:** Plain text password, stored hash
**Process:**
1. Use bcrypt compare function
2. Return boolean result
**Output:** Boolean (true if match)

---

### 7. Payment Service

**File:** `src/services/paymentService.ts`

**Responsibility:** Payment transaction management

**Key Methods:**

#### `createPaymentTransaction(application, paymentNumber)`
**Input:** Application object, payment number (1, 2, 3...)
**Process:**
1. Generate `transactionId`
2. Calculate scheduled date:
   - Start from `application.mandateActivatedAt`
   - Add (paymentNumber - 1) × frequency interval
3. Create PaymentTransaction record:
   - Status: `SCHEDULED`
   - Amount: `application.installmentAmount`
   - `paymentNumber` and `totalPayments`
4. Return transaction
**Output:** PaymentTransaction object
**Notes:** Called by payment monitor job

#### `updatePaymentStatus(transactionId, status, paidDate, pwaPaymentId, failureReason)`
**Input:** Transaction ID, new status, optional fields
**Process:**
1. Find payment transaction
2. Update status
3. If successful:
   - Set `paidDate`
   - Store `pwaPaymentId`
4. If failed:
   - Store `failureReason`
5. Update Application totals:
   - If successful: Increment `paymentsCompleted`, add to `totalPaid`, reduce `outstandingBalance`
6. Check if last payment:
   - If yes and successful: Update Application status to `COMPLETED`
7. Log audit
8. Return updated transaction
**Output:** Updated PaymentTransaction object

---

### 8. Webhook Service

**File:** `src/services/webhookService.ts`

**Responsibility:** Send webhooks to business owners

**Key Methods:**

#### `sendWebhook(businessId, event, payload)`
**Input:** Business ID, event type, webhook payload
**Process:**
1. Find business
2. Check if webhookUrl configured
3. Generate `logId`
4. Create BusinessWebhookLog record (status: pending)
5. Generate webhook signature (if webhookSecret exists):
   - HMAC-SHA256(payload + webhookSecret)
6. Make POST request to business webhook URL:
   - Headers:
     - `Content-Type: application/json`
     - `X-TrustRail-Signature: {signature}`
     - `X-TrustRail-Event: {event}`
   - Body: JSON payload
   - Timeout: 5 seconds
7. Handle response:
   - If 200: Update log status to `delivered`
   - If error: Update log status to `failed`, store error
8. If failed: Schedule retry (increment attempts)
9. Return success/failure
**Output:** Boolean
**Notes:** Called after every significant event

#### `retryFailedWebhooks()`
**Input:** None
**Process:**
1. Find BusinessWebhookLog records:
   - Status: `failed`
   - Attempts < 4
   - Last attempt > 30 seconds ago
2. For each log:
   - Retry sending webhook
   - Increment attempts
   - Update status
3. Return retry count
**Output:** Number of retries attempted
**Notes:** Called periodically by background job (not implemented in MVP)

---

### 9. PWA Webhook Service

**File:** `src/services/pwaWebhookService.ts`

**Responsibility:** Process incoming PWA webhooks

**Key Methods:**

#### `processWebhook(rawPayload)`
**Input:** Full webhook JSON from PWA
**Process:**
1. Generate `logId`
2. Extract key fields:
   - `eventType` = `details.meta.event_type` OR determine from `transaction_type`
   - `requestRef` = `request_ref`
   - `billerCode` = `details.meta.biller_code`
   - `transactionRef` = `details.transaction_ref`
   - `status` = `details.status`
3. Verify signature:
   - Extract `signature_hash` from `details.meta`
   - Call `pwaService.verifyWebhookSignature(requestRef, signature_hash)`
4. Create PWAWebhookLog record
5. Route to handler based on eventType:
   - `debit` → `handleDebitEvent(payload)`
   - `credit` → `handleCreditEvent(payload)`
   - `activate_mandate` → `handleMandateActivation(payload)`
6. Update log with processing result
7. Return success
**Output:** `{ success: true }`

#### `handleDebitEvent(payload)`
**Input:** Webhook payload
**Process:**
1. Extract fields:
   - `transactionRef` = `details.transaction_ref` (our transactionId)
   - `status` = `details.status` (Successful/Failed)
   - `ppayment_id` = `details.meta.payment_id`
   - `failureReason` (if failed)
2. Find PaymentTransaction by `transactionRef`
3. Update payment status:
   - If "Successful": Status = `SUCCESSFUL`, set `paidDate`
   - If "Failed": Status = `FAILED`, store `failureReason`
4. Update Application:
   - If successful: Update totals, check if completed
   - If failed: Increment failure count, check if defaulted (3+ failures)
5. Find Business
6. Send webhook to business:
   - Event: `payment.success` or `payment.failed`
   - Payload: Payment details
7. Log audit
8. Return success
**Output:** void

#### `handleCreditEvent(payload)`
**Input:** Webhook payload
**Process:**
1. Extract fields:
   - `virtualAccount` = `details.meta.cr_account`
   - `amount` = `details.amount`
2. Find Application by `virtualAccountNumber`
3. Verify amount matches `downPaymentRequired`
4. Update Application:
   - `downPaymentReceived: true`
   - `downPaymentReceivedAt: now`
   - `totalPaid` += amount
   - `outstandingBalance` -= amount
5. Call PWA `send invoice` (installment):
   - Triggers scheduled debits
6. Find Business
7. Send webhook to business:
   - Event: `downpayment.received`
   - Payload: Down payment details + next steps
8. Log audit
9. Return success
**Output:** void

#### `handleMandateActivation(payload)`
**Input:** Webhook payload
**Process:**
1. Extract fields:
   - `mandateRef` = `details.transaction_ref` or `details.data.data.reference`
   - `pwaMandateId` = `details.data.data.id`
2. Find Application by `pwaMandateRef`
3. Update Application:
   - Status: `MANDATE_CREATED` → `MANDATE_ACTIVE`
   - Store `pwaMandateId`
   - Set `mandateActivatedAt: now`
4. Call PWA `send invoice` (installment):
   - Creates virtual account for down payment
   - Returns virtual account details
5. Update Application with `virtualAccountNumber`
6. Find Business
7. Send webhook to business:
   - Event: `mandate.activated`
   - Payload: Mandate details + virtual account
8. Log audit
9. Return success
**Output:** void

---

### 10. Dashboard Service

**File:** `src/services/dashboardService.ts`

**Responsibility:** Calculate analytics and statistics

**Key Methods:**

#### `getBusinessOverview(businessId)`
**Input:** Business ID
**Process:**
1. Count TrustWallets (total, active)
2. Count Applications by status
3. Calculate revenue:
   - Total collected (sum successful payments)
   - Outstanding balance (sum application outstanding balances)
   - Available for withdrawal (collected - withdrawn)
4. Calculate payment stats:
   - Success/failure counts
   - Success rate
5. Get recent activity (last 10 audit logs)
6. Return dashboard data
**Output:** Dashboard object with all metrics

#### `getTrustWalletAnalytics(trustWalletId, businessId, dateRange)`
**Input:** TrustWallet ID, Business ID, optional date range
**Process:**
1. Verify ownership
2. Count applications by status
3. Calculate approval rate
4. Calculate average trust score
5. Calculate revenue metrics
6. Calculate payment success rate
7. Group data by time period (if date range provided)
8. Return analytics
**Output:** Analytics object

---

### 11. Audit Service

**File:** `src/services/auditService.ts`

**Responsibility:** Create audit log entries

**Key Methods:**

#### `log(action, actor, resourceType, resourceId, changes, metadata)`
**Input:** Action, actor info, resource info, changes, extra metadata
**Process:**
1. Generate `logId`
2. Create AuditLog record:
   - Action
   - Actor (type, id, email)
   - Resource type and ID
   - Changes (before/after for updates)
   - Metadata
   - Timestamp (now)
3. Return log
**Output:** AuditLog object
**Usage Example:**
```
auditService.log(
  'application.approve_manual',
  { type: 'business', id: businessId, email: businessEmail },
  'Application',
  applicationId,
  { status: { before: 'FLAGGED', after: 'APPROVED' } },
  { notes: 'Manually approved by business owner' }
)
```

---

## Background Jobs

### Job Architecture

**Implementation:** Native Node.js `setInterval` (NO third-party queues)

**Job Scheduler:** Central manager that starts all jobs

**Jobs Run:**
1. **Statement Analysis Job** - Every 60 seconds
2. **Payment Monitor Job** - Every 5 minutes

---

### 1. Statement Analysis Job

**File:** `src/jobs/statementAnalysisJob.ts`

**Purpose:** Process pending applications (analyze bank statements)

**Interval:** 60 seconds (configurable via `STATEMENT_ANALYSIS_JOB_INTERVAL`)

**Process:**

**Every 60 seconds:**
1. Query Applications:
   - Status: `PENDING_ANALYSIS`
   - Limit: 10 (process 10 at a time)
   - Sort: Oldest first (FIFO)

2. For each application:
   - Update status to `ANALYZING`
   - Call `trustEngineService.analyzeApplication(applicationId)`
   - Wait for analysis completion
   - Get TrustEngineOutput

3. Based on decision:
   
   **If APPROVED:**
   - Update Application status to `APPROVED`
   - Set `approvedAt: now`
   - Call `pwaService.createMandate(application, business)`
   - Store `pwaMandateRef` in Application
   - Update status to `MANDATE_CREATED`
   - Send webhook to business: `application.approved`
   
   **If DECLINED:**
   - Update Application status to `DECLINED`
   - Set `declinedAt: now`
   - Send webhook to business: `application.declined`
   
   **If FLAGGED_FOR_REVIEW:**
   - Update Application status to `FLAGGED_FOR_REVIEW`
   - Send webhook to business: `application.flagged`

4. Link TrustEngineOutput:
   - Store `trustEngineOutputId` in Application
   - Set `analyzedAt: now`

5. Log audit for each processed application

6. Handle errors:
   - If analysis fails, log error
   - Leave status as `ANALYZING` (will retry next run)
   - Continue with next application

**Error Handling:**
- Wrap entire job in try-catch
- Log errors to winston
- Don't crash server on job failure
- Failed applications stay in `ANALYZING` and can be manually retried

**Performance:**
- Process maximum 10 applications per run
- Each analysis takes ~5-15 seconds
- Total job duration: ~1-3 minutes max
- Job runs every 60 seconds, so queue will eventually clear

---

### 2. Payment Monitor Job

**File:** `src/jobs/paymentMonitorJob.ts`

**Purpose:** Check for overdue payments, detect defaults

**Interval:** 5 minutes (300 seconds, configurable via `PAYMENT_MONITOR_JOB_INTERVAL`)

**Process:**

**Every 5 minutes:**

1. **Find Overdue Scheduled Payments:**
   - Query PaymentTransactions:
     - Status: `SCHEDULED`
     - `scheduledDate` < now
   - For each overdue payment:
     - Log warning
     - (Future: Send reminder to customer)
     - (Future: Auto-trigger payment via PWA)

2. **Check for Defaulted Applications:**
   - Query Applications:
     - Status: `ACTIVE`
   - For each application:
     - Count failed payments
     - If failed payments >= 3:
       - Update Application status to `DEFAULTED`
       - Send webhook to business: `application.defaulted`
       - Log audit

3. **Monitor Mandate Activation Delays:**
   - Query Applications:
     - Status: `MANDATE_CREATED`
     - `createdAt` > 48 hours ago (NIBSS activation should be within 24hrs)
   - For each stuck mandate:
     - Log warning
     - (Future: Alert admin for manual check)

**Error Handling:**
- Same as statement analysis job
- Don't crash on errors
- Log and continue

**Future Enhancements (Not in MVP):**
- Auto-retry failed payments
- Send SMS reminders to customers
- Escalate overdue payments to admin

---

### 3. Job Scheduler

**File:** `src/jobs/jobScheduler.ts`

**Purpose:** Start and manage all background jobs

**Implementation:**

**Function: `startBackgroundJobs()`**

Called from `server.ts` after database connection

**Process:**
1. Log: "Starting background jobs..."

2. Start Statement Analysis Job:
   - Use `setInterval`
   - Interval: `STATEMENT_ANALYSIS_JOB_INTERVAL` (default 60000ms)
   - Wrap job in try-catch
   - Log errors without crashing

3. Start Payment Monitor Job:
   - Use `setInterval`
   - Interval: `PAYMENT_MONITOR_JOB_INTERVAL` (default 300000ms)
   - Wrap job in try-catch
   - Log errors without crashing

4. Log: "Background jobs started successfully"

**Example Structure:**
```
export function startBackgroundJobs() {
  logger.info('Starting background jobs...');
  
  // Statement Analysis Job
  setInterval(async () => {
    try {
      await runStatementAnalysisJob();
    } catch (error) {
      logger.error('Statement analysis job error:', error);
    }
  }, parseInt(process.env.STATEMENT_ANALYSIS_JOB_INTERVAL || '60000'));
  
  // Payment Monitor Job
  setInterval(async () => {
    try {
      await runPaymentMonitorJob();
    } catch (error) {
      logger.error('Payment monitor job error:', error);
    }
  }, parseInt(process.env.PAYMENT_MONITOR_JOB_INTERVAL || '300000'));
  
  logger.info('Background jobs started successfully');
}
```

**Notes:**
- Jobs run indefinitely once started
- No job persistence (if server restarts, jobs restart)
- No job queue (jobs run on schedule regardless of pending work)
- Simple and sufficient for MVP scale

---

## Middleware

### 1. Auth Middleware

**File:** `src/middleware/authMiddleware.ts`

**Purpose:** Verify JWT token for business APIs

**Process:**
1. Extract token from `Authorization: Bearer {token}` header
2. If no token: Return 401 Unauthorized
3. Verify token using `jwt.verify(token, JWT_SECRET)`
4. If invalid/expired: Return 401 Unauthorized
5. Decode token payload: `{ businessId, email, iat, exp }`
6. Attach to request object:
   - `req.businessId = payload.businessId`
   - `req.businessEmail = payload.email`
7. Call `next()` to proceed

**Usage:** Applied to all `/api/*` routes except auth routes

**Type Extension:**
Need to extend Express Request type to include `businessId` and `businessEmail`

---

### 2. Admin Auth Middleware

**File:** `src/middleware/adminAuthMiddleware.ts`

**Purpose:** Verify JWT token for admin APIs

**Process:**
1. Extract token from `Authorization: Bearer {token}` header
2. If no token: Return 401
3. Verify token using `jwt.verify(token, ADMIN_JWT_SECRET)`
4. Check payload contains `role: 'admin'`
5. If not admin: Return 403 Forbidden
6. Attach to request: `req.isAdmin = true`
7. Call `next()`

**Usage:** Applied to all `/admin/*` routes

---

### 3. Validation Middleware

**File:** `src/middleware/validationMiddleware.ts`

**Purpose:** Handle express-validator validation errors

**Process:**
1. Call `validationResult(req)` from express-validator
2. If errors exist:
   - Format error messages
   - Return 400 Bad Request with error details
3. If no errors: Call `next()`

**Usage:** Applied after validator chains in routes

**Example Route Usage:**
```
router.post(
  '/trustwallets',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('installmentPlan.totalAmount').isNumeric().withMessage('Total amount must be a number')
  ],
  validationMiddleware,
  trustWalletController.create
)
```

---

### 4. Error Middleware

**File:** `src/middleware/errorMiddleware.ts`

**Purpose:** Global error handler (catch-all)

**Process:**
1. Receive error object
2. Log error with winston
3. Extract status code (default 500)
4. Extract error message
5. Return formatted error response:
   - `error: message`
   - In development: Include stack trace
6. Don't crash server

**Usage:** Applied last in Express middleware chain (after all routes)

**Error Format:**
```
{
  error: "Error message",
  stack: "..." (only in development)
}
```

---

### 5. Logging Middleware

**File:** `src/middleware/loggingMiddleware.ts`

**Purpose:** Log all HTTP requests and responses

**Process:**
1. Record request start time
2. Listen for response finish event
3. On finish:
   - Calculate duration
   - Log to winston:
     - Method
     - URL
     - Status code
     - Duration (ms)
     - IP address
4. Call `next()` immediately (don't block request)

**Usage:** Applied early in Express middleware chain (before routes)

**Log Format:**
```
{
  method: "POST",
  url: "/api/trustwallets",
  status: 201,
  duration: "145ms",
  ip: "192.168.1.1"
}
```

---

## Integration Points

### 1. PWA API Integration

**Base URL:** `https://api.dev.onepipe.io/v2/transact` (configurable)

**Authentication:**
- Bearer token: `Authorization: Bearer {PWA_API_KEY}`
- Signature: `Signature: {MD5_HASH}`

**Signature Generation:**
- Formula: `MD5(PWA_API_KEY + ";" + request_ref)`
- Must be computed for every request
- `request_ref` must be unique per request

**Request Format:**
```
{
  request_ref: "TR-XXX-{timestamp}",
  request_type: "create merchant" | "create mandate" | "send invoice",
  auth: {
    type: "bank.account",
    secure: "{TRIPLE_DES_ENCRYPTED}",
    auth_provider: "PaywithAccount"
  },
  transaction: {
    mock_mode: "Inspect" | "Live",
    transaction_ref: "{OUR_TRACKING_ID}",
    customer: { ... },
    meta: { ... },
    details: { ... }
  }
}
```

**Mock Mode:**
- `Inspect`: Test mode (no real money movement)
- `Live`: Production mode

**Error Handling:**
- Always log request/response for debugging
- Handle network timeouts (30s timeout)
- Handle 4xx/5xx errors
- Retry logic: Retry once on network error, don't retry on 4xx

---

### 2. MongoDB Database

**Connection:**
- Use Mongoose ODM
- Connection string from `MONGODB_URI`
- Options:
  - `useNewUrlParser: true`
  - `useUnifiedTopology: true`
- Handle connection errors gracefully
- Auto-reconnect on disconnect

**Indexes:**
- Create indexes on application startup (Mongoose auto-creates from schema)
- Critical indexes:
  - Business: `businessId`, `email`, `billerCode`
  - TrustWallet: `trustWalletId`, `businessId`
  - Application: `applicationId`, `trustWalletId`, `businessId`, `status`, `customerDetails.phoneNumber`
  - PaymentTransaction: `transactionId`, `applicationId`, `status`, `pwaTransactionRef`
  - PWAWebhookLog: `requestRef`, `eventType`
  - AuditLog: `action`, `resourceType`, `resourceId`, `timestamp`

**Connection Pooling:**
- Mongoose handles this automatically
- Default pool size: 10

---

### 3. File Storage

**Bank Statement CSV Upload:**

**Storage Location:** `uploads/statements/`

**File Naming:** `{timestamp}-{originalFilename}.csv`

**File Size Limit:** 5MB

**Security:**
- Validate file extension (only `.csv`)
- Validate MIME type
- Sanitize filename
- Store outside web root

**Access Control:**
- Files only accessible via backend
- Not publicly accessible
- Business can only access files for their applications

**Cleanup (Future):**
- Delete CSV files after 90 days
- Keep TrustEngineOutput in database permanently

---


**From PWA:**

See PWA webhook documentation in API Endpoints section.

---

## Security & Encryption

### 1. Password Security

**Hashing Algorithm:** bcrypt
**Salt Rounds:** 10
**Storage:** Never store plain text passwords
**Comparison:** Always use bcrypt.compare (constant-time comparison)

---

### 2. JWT Tokens

**Business Tokens:**
- Secret: `JWT_SECRET` (256-bit minimum)
- Algorithm: HS256
- Expiry: 30 days
- Payload: `{ businessId, email, iat, exp }`
- Storage: Client-side (localStorage or httpOnly cookie)

**Admin Tokens:**
- Secret: `ADMIN_JWT_SECRET` (different from business secret)
- Algorithm: HS256
- Expiry: 24 hours
- Payload: `{ role: 'admin', email, iat, exp }`

**Security Practices:**
- Rotate secrets in production
- Use strong, random secrets (256-bit)
- Never expose secrets in logs
- Validate token on every request

---

### 3. TripleDES Encryption

**Purpose:** Encrypt customer credentials and BVN for PWA API

**Algorithm:** TripleDES (des-ede3)

**Key Requirements:**
- Exactly 24 bytes (192 bits)
- Store in `TRIPLE_DES_KEY` environment variable
- Use strong, random key

**Encryption Process:**
1. Create cipher with key
2. Encrypt plain text
3. Convert to base64
4. Return encrypted string

**Decryption:** Not needed for MVP (PWA decrypts on their end)

**Fields Encrypted:**
- Customer account number + bank code (format: `{account};{bank}`)
- Customer BVN

---

### 4. Data Protection

**Sensitive Data:**
- BVN: Always encrypted at rest (in Application