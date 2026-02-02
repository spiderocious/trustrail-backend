# TrustRail Backend

TrustRail is a B2B trust orchestration platform that sits on top of PayWithAccount to manage payment eligibility, consent logic, retries, defaults, and auditability, while leaving actual direct debit execution to PWA.

## Features

- 🤖 **OpenAI-Powered Analysis** - Bank statement analysis using GPT-4 (supports PDF & CSV)
- 🏦 **Trust Score Engine** - AI-generated trust score (0-100) based on income, spending, and behavior patterns
- 💳 **Automated Payments** - Direct debit integration via PWA/NIBSS
- 📊 **Business Dashboard** - Real-time analytics and payment tracking
- 🔐 **Security First** - TripleDES encryption, JWT auth, bcrypt password hashing
- ⚡ **Background Jobs** - Native Node.js processing (no Redis required)
- 📄 **Multiple Formats** - Accepts both PDF and CSV bank statements

## Tech Stack

- **Runtime:** Node.js 20.x LTS
- **Language:** TypeScript 5.3+
- **Framework:** Express 4.18+
- **Database:** MongoDB 7.0+ with Mongoose
- **AI:** OpenAI GPT-4 (bank statement analysis)
- **Authentication:** JWT + bcrypt
- **Encryption:** TripleDES (for PWA API)
- **Logging:** Winston

## Prerequisites

- Node.js >= 20.0.0
- MongoDB >= 7.0
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and fill in your values
nano .env
```

## Environment Variables

See `.env.example` for all required variables:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - 256-bit secret for business tokens
- `OPENAI_API_KEY` - OpenAI API key for analysis
- `OPENAI_PROMPT` - Custom prompt for bank statement analysis
- `PWA_API_KEY` - PayWithAccount API key
- `TRIPLE_DES_KEY` - 24-byte key for PWA encryption
- And more...

## Development

```bash
# Run in development mode with hot reload
npm run dev
```

Server runs on `http://localhost:3000`

## Build & Production

```bash
# Build TypeScript to JavaScript
npm run build

# Run production server
npm start
```

## API Documentation

### Base URL
- Development: `http://localhost:3000`
- Production: `https://api.trustrail.com`

### Main Endpoints

#### Authentication
- `POST /api/auth/register` - Register business account
- `POST /api/auth/login` - Login

#### TrustWallet Management
- `GET /api/trustwallets` - List TrustWallets
- `POST /api/trustwallets` - Create TrustWallet
- `GET /api/trustwallets/:id` - Get TrustWallet details

#### Applications
- `GET /api/applications` - List applications
- `GET /api/applications/:id` - Get application details
- `POST /api/applications/:id/approve` - Manually approve
- `POST /api/applications/:id/decline` - Manually decline

#### Public (Customer-facing)
- `GET /public/trustwallet/:id` - View TrustWallet info
- `POST /public/trustwallet/:id/apply` - Submit application
- `GET /public/application/:id/status` - Check status

#### Webhooks
- `POST /webhooks/pwa` - Receive PWA webhooks
- `POST /api/webhooks/configure` - Configure business webhook

#### Admin
- `GET /admin/health` - System health check
- `GET /admin/applications` - View all applications

Full API documentation: See `docs/work.md`

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database, logger, environment
│   ├── models/          # Mongoose schemas (9 models)
│   ├── routes/          # Express routes (11 files)
│   ├── controllers/     # Request handlers (10 files)
│   ├── services/        # Business logic (11 files)
│   ├── jobs/            # Background jobs (3 files)
│   ├── middleware/      # Auth, validation, errors (5 files)
│   ├── utils/           # Helpers (5 files)
│   ├── types/           # TypeScript definitions (4 files)
│   ├── validators/      # Input validation (4 files)
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── logs/                # Application logs
├── docs/                # Documentation
├── package.json
└── tsconfig.json
```

## Background Jobs

Two native Node.js jobs run automatically:

1. **Statement Analysis Job** (every 60s)
   - Processes pending applications
   - Analyzes bank statements
   - Generates trust scores
   - Creates PWA mandates

2. **Payment Monitor Job** (every 5min)
   - Checks for overdue payments
   - Detects defaulted applications
   - Monitors mandate activation delays

## Trust Score Calculation

Trust score (0-100) based on:

- **Income Stability (30pts)** - Consistency + income-to-installment ratio
- **Spending Behavior (25pts)** - Debt ratio, gambling, savings rate
- **Balance Health (20pts)** - Average balance + minimum buffer
- **Transaction Behavior (15pts)** - Bounces, overdrafts, activity
- **Affordability (10pts)** - Installment vs disposable income

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 30-day expiry
- TripleDES encryption for PWA API
- BVN encrypted at rest
- Request logging with Winston
- Audit trail for all actions

## License

MIT

## Support

For issues and questions, contact: support@trustrail.com
