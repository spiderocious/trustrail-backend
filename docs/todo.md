# TrustRail Backend - Implementation Todo List

## ✅ Completed Tasks

### Phase 1: Project Setup & Configuration (3/4)
- [x] Install all npm dependencies (`npm install`)
- [x] Create `.env.example` with all environment variables
- [ ] Create `.gitignore` file
- [ ] Create `README.md` with project documentation

### Phase 2: Configuration Files (src/config/) - COMPLETE ✅
- [x] Create `database.ts` - MongoDB connection setup
- [x] Create `environment.ts` - Environment variable loader & validation
- [x] Create `logger.ts` - Winston logger configuration

### Phase 3: Utility Files (src/utils/) - COMPLETE ✅
- [x] Create `responseFormatter.ts` - Standardized API responses
- [x] Create `idGenerator.ts` - Generate unique IDs (TR-BIZ-xxx, TW-xxx, APP-xxx, etc.)
- [x] Create `dateUtils.ts` - Date manipulation helpers
- [x] Create `csvParser.ts` - Bank statement CSV parsing logic (⚠️ PROCESS IN MEMORY, NO FILE SAVING)
- [x] Create `signatureGenerator.ts` - MD5 signature for PWA requests

### Phase 4: TypeScript Type Definitions (src/types/) - COMPLETE ✅
- [x] Create `express.d.ts` - Extend Express Request type (add businessId, businessEmail, isAdmin)
- [x] Create `api.types.ts` - API request/response types
- [x] Create `pwa.types.ts` - PWA API request/response types
- [x] Create `trustEngine.types.ts` - Trust engine internal types

### Phase 5: Mongoose Models (src/models/) - COMPLETE ✅
- [x] Create `Business.ts` - Business owner accounts with PWA integration
- [x] Create `TrustWallet.ts` - TrustWallet configurations (installment plans + approval rules)
- [x] Create `Application.ts` - Customer applications with status flow
- [x] Create `TrustEngineOutput.ts` - Bank statement analysis results
- [x] Create `PaymentTransaction.ts` - Individual payment records
- [x] Create `Withdrawal.ts` - Business withdrawal requests
- [x] Create `PWAWebhookLog.ts` - Incoming PWA webhooks audit trail
- [x] Create `BusinessWebhookLog.ts` - Outgoing business webhooks delivery logs
- [x] Create `AuditLog.ts` - System-wide audit trail

### Phase 6: Core Services (src/services/) - 7/11 DONE
- [x] Create `encryptionService.ts` - ⭐ CRITICAL: TripleDES for PWA + bcrypt for passwords
- [x] Create `auditService.ts` - Audit log creation
- [x] Create `pwaService.ts` - ⭐ CRITICAL: PWA API integration (create merchant, mandate, invoice)
- [x] Create `authService.ts` - Registration, login, JWT generation
- [x] Create `trustWalletService.ts` - TrustWallet CRUD operations
- [x] Create `trustEngineService.ts` - ⭐ CRITICAL: Bank statement analysis + trust score calculation
- [x] Create `applicationService.ts` - Application management, manual approve/decline

## 🚀 In Progress
None

## 📋 Pending Tasks

### Phase 6: Core Services (src/services/) - REMAINING
- [ ] Create `paymentService.ts` - Payment transaction management
- [ ] Create `webhookService.ts` - Send webhooks to business owners
- [ ] Create `pwaWebhookService.ts` - ⭐ CRITICAL: Process incoming PWA webhooks
- [ ] Create `withdrawalService.ts` - Withdrawal processing
- [ ] Create `dashboardService.ts` - Analytics calculations

### Phase 7: Middleware (src/middleware/) - 5 Middleware
- [ ] Create `authMiddleware.ts` - JWT verification for business APIs
- [ ] Create `adminAuthMiddleware.ts` - JWT verification for admin APIs
- [ ] Create `validationMiddleware.ts` - Express-validator error handler
- [ ] Create `errorMiddleware.ts` - Global error handler
- [ ] Create `loggingMiddleware.ts` - Request/response logging

### Phase 8: Validators (src/validators/)
- [ ] Create `authValidators.ts` - Registration, login validation
- [ ] Create `trustWalletValidators.ts` - TrustWallet creation/update validation
- [ ] Create `applicationValidators.ts` - Application submission validation
- [ ] Create `paymentValidators.ts` - Payment validation

### Phase 9: Controllers (src/controllers/) - 10 Controllers
- [ ] Create `authController.ts` - Handle auth requests
- [ ] Create `trustWalletController.ts` - Handle TrustWallet requests
- [ ] Create `applicationController.ts` - Handle application requests
- [ ] Create `paymentController.ts` - Handle payment viewing requests
- [ ] Create `withdrawalController.ts` - Handle withdrawal requests
- [ ] Create `dashboardController.ts` - Handle dashboard requests
- [ ] Create `webhookController.ts` - Handle webhook config + PWA webhooks
- [ ] Create `publicController.ts` - Handle public customer requests
- [ ] Create `adminController.ts` - Handle admin requests
- [ ] Create `healthController.ts` - Handle health checks

### Phase 10: Routes (src/routes/) - 10 Route Files + Index
- [ ] Create `authRoutes.ts` - /api/auth/* (3 endpoints)
- [ ] Create `trustWalletRoutes.ts` - /api/trustwallets/* (8 endpoints)
- [ ] Create `applicationRoutes.ts` - /api/applications/* (6 endpoints)
- [ ] Create `paymentRoutes.ts` - /api/payments/* (2 endpoints)
- [ ] Create `withdrawalRoutes.ts` - /api/withdrawals/* (2 endpoints)
- [ ] Create `dashboardRoutes.ts` - /api/dashboard/* (2 endpoints)
- [ ] Create `webhookRoutes.ts` - /api/webhooks/* + /webhooks/pwa (2 endpoints)
- [ ] Create `publicRoutes.ts` - /public/* (3 endpoints)
- [ ] Create `adminRoutes.ts` - /admin/* (4 endpoints)
- [ ] Create `healthRoutes.ts` - /health (1 endpoint)
- [ ] Create `index.ts` - Route aggregator (combines all routes)

### Phase 11: Background Jobs (src/jobs/)
- [ ] Create `statementAnalysisJob.ts` - Process pending applications (every 60s)
- [ ] Create `paymentMonitorJob.ts` - Check overdue payments, detect defaults (every 5min)
- [ ] Create `jobScheduler.ts` - Job manager using setInterval

### Phase 12: App Setup
- [ ] Create `app.ts` - Express app setup (middleware, routes, error handling)
- [ ] Create `server.ts` - HTTP server + database connection + job scheduler startup

### Phase 13: Final Configuration
- [ ] Create `.env` file (copy from .env.example and fill in values)
- [ ] Create `.gitignore` (node_modules, dist, .env, logs, uploads)
- [ ] Update `README.md` with setup instructions

### Phase 14: Testing & Validation
- [ ] Test database connection
- [ ] Test all API endpoints manually
- [ ] Test PWA integration (mock mode)
- [ ] Test background jobs
- [ ] Test webhook flows

---

## 🔴 Important Notes

### CSV File Handling
⚠️ **CHANGE FROM SPEC**: Do NOT save CSV files to disk. Accept CSV in request body and process in memory only. Update:
- `csvParser.ts` to accept Buffer/string instead of file path
- `publicController.ts` to process multer upload directly without saving
- Remove `bankStatementCsvPath` from Application model or set to null

### Critical Dependencies
1. **TripleDES Encryption** - Must be exactly right for PWA API
2. **Trust Score Calculation** - Follow exact formula (0-100 points breakdown)
3. **PWA Webhooks** - Must verify signature and handle 3 event types correctly
4. **Background Jobs** - Use native setInterval, NO Redis/BullMQ

### Environment Variables Required
```
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/trustrail

# JWT
JWT_SECRET=your-256-bit-secret-here
ADMIN_JWT_SECRET=your-admin-256-bit-secret-here

# PWA API
PWA_BASE_URL=https://api.dev.onepipe.io/v2/transact
PWA_API_KEY=your-pwa-api-key
TRIPLE_DES_KEY=your-24-byte-key-here

# Admin Credentials
ADMIN_EMAIL=admin@trustrail.com
ADMIN_PASSWORD=secure-admin-password

# Background Jobs
STATEMENT_ANALYSIS_JOB_INTERVAL=60000
PAYMENT_MONITOR_JOB_INTERVAL=300000
```

### File Structure Summary
```
backend/
├── src/
│   ├── config/          (3 files)
│   ├── models/          (9 files)
│   ├── routes/          (11 files)
│   ├── controllers/     (10 files)
│   ├── services/        (11 files)
│   ├── jobs/            (3 files)
│   ├── middleware/      (5 files)
│   ├── utils/           (5 files)
│   ├── types/           (4 files)
│   ├── validators/      (4 files)
│   ├── app.ts           (1 file)
│   └── server.ts        (1 file)
├── logs/
├── docs/
├── package.json
├── tsconfig.json
├── .env.example
├── .env (gitignored)
├── .gitignore
└── README.md

Total: ~70 TypeScript files to create
```

---

## 📊 Progress Tracking
- [x] Phase 1: Project Setup & Configuration (3/4) - 75%
- [x] Phase 2: Configuration Files (3/3) - 100% ✅
- [x] Phase 3: Utility Files (5/5) - 100% ✅
- [x] Phase 4: Type Definitions (4/4) - 100% ✅
- [x] Phase 5: Mongoose Models (9/9) - 100% ✅
- [ ] Phase 6: Core Services (7/11) - 64%
- [ ] Phase 7: Middleware (0/5) - 0%
- [ ] Phase 8: Validators (0/4) - 0%
- [ ] Phase 9: Controllers (0/10) - 0%
- [ ] Phase 10: Routes (0/11) - 0%
- [ ] Phase 11: Background Jobs (0/3) - 0%
- [ ] Phase 12: App Setup (0/2) - 0%
- [ ] Phase 13: Final Configuration (0/3) - 0%
- [ ] Phase 14: Testing & Validation (0/4) - 0%

**Total Tasks: ~78**
**Completed: 31**
**In Progress: 0**
**Remaining: 47**

**Overall Progress: 40%** 🚀

---

*Last Updated: 2026-01-30*
