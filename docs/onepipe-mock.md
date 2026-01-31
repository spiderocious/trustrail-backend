# OnePipe Mock API Documentation

The OnePipe Mock simulates the OnePipe/PayWithAccount API for testing without real integration.

## Base URL

```
http://localhost:3000/onepipe-mock
```

## Configuration

To use the mock instead of the real OnePipe API, update your `.env` file:

```env
# Point to the mock endpoint
PWA_BASE_URL=http://localhost:3000/onepipe-mock/transact

# Mock mode should be set to Inspect
PWA_MOCK_MODE=Inspect
```

## API Endpoints

### 1. Main Transact Endpoint

**POST** `/onepipe-mock/transact`

Handles all OnePipe request types. The behavior depends on the `request_type` field.

#### Create Merchant

**Request:**
```json
{
  "request_ref": "unique-reference",
  "request_type": "create merchant",
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "unique-transaction-ref",
    "details": {
      "business_name": "Test Business",
      "email": "test@example.com",
      "phone_number": "2348012345678",
      "rc_number": "RC123456",
      "settlement_account_number": "1234567890",
      "settlement_bank_code": "058",
      "settlement_account_name": "Test Account"
    },
    "meta": {}
  }
}
```

**Response:**
```json
{
  "status": "Successful",
  "message": "Merchant created successfully",
  "data": {
    "biller_code": "BILL-1234567890123",
    "merchant_id": "MERCH-1234567890123"
  }
}
```

#### Create Mandate

**Request:**
```json
{
  "request_ref": "unique-reference",
  "request_type": "create mandate",
  "auth": {
    "type": "bank.account",
    "secure": "encrypted-account-details",
    "auth_provider": "PaywithAccount"
  },
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "unique-transaction-ref",
    "meta": {
      "bvn": "encrypted-bvn",
      "biller_code": "BILL-1234567890123",
      "amount": 100000,
      "skip_consent": "true"
    }
  }
}
```

**Response:**
```json
{
  "status": "Successful",
  "message": "Mandate created successfully",
  "data": {
    "mandate_ref": "MAND-1234567890123",
    "reference": "REF-1234567890123"
  }
}
```

#### Send Invoice

**Request:**
```json
{
  "request_ref": "unique-reference",
  "request_type": "send invoice",
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "unique-transaction-ref",
    "meta": {
      "type": "instalment",
      "down_payment": 20000,
      "repeat_frequency": "monthly",
      "repeat_start_date": "2026-02-01-00-00-00",
      "number_of_payments": 6,
      "biller_code": "BILL-1234567890123"
    }
  }
}
```

**Response:**
```json
{
  "status": "Successful",
  "message": "Invoice sent successfully",
  "data": {
    "virtual_account_number": "9876543210",
    "account_name": "TrustRail Virtual Account",
    "bank_name": "Mock Bank"
  }
}
```

---

## Webhook Trigger Endpoint

**POST** `/onepipe-mock/trigger-webhook`

Manually trigger webhooks to TrustRail for testing.

### Debit Webhook (Payment Notification)

**Request (Successful Payment):**
```json
{
  "webhook_type": "debit",
  "biller_code": "BILL-1234567890123",
  "payment_id": "PAY-123",
  "transaction_ref": "TXN-123",
  "amount": 15000,
  "status": "Successful"
}
```

**Request (Failed Payment):**
```json
{
  "webhook_type": "debit",
  "biller_code": "BILL-1234567890123",
  "payment_id": "PAY-123",
  "transaction_ref": "TXN-123",
  "amount": 15000,
  "status": "Failed",
  "failure_reason": "Insufficient funds"
}
```

**Response:**
```json
{
  "success": true,
  "message": "debit webhook sent successfully",
  "webhook_payload": { ... },
  "response_status": 200
}
```

### Credit Webhook (Down Payment Received)

**Request:**
```json
{
  "webhook_type": "credit",
  "biller_code": "BILL-1234567890123",
  "virtual_account": "9876543210",
  "amount": 20000
}
```

### Activate Mandate Webhook

**Request:**
```json
{
  "webhook_type": "activate_mandate",
  "biller_code": "BILL-1234567890123",
  "mandate_ref": "MAND-1234567890123",
  "transaction_ref": "TXN-123"
}
```

---

## Utility Endpoints

### Get Mock Data (Debugging)

**GET** `/onepipe-mock/data`

Returns all stored mock data (merchants, mandates, virtual accounts).

**Response:**
```json
{
  "merchants": [
    {
      "request_ref": "ref-1",
      "billerCode": "BILL-123",
      "merchantId": "MERCH-123"
    }
  ],
  "mandates": [
    {
      "mandate_ref": "MAND-123",
      "reference": "REF-123"
    }
  ],
  "virtualAccounts": [
    {
      "biller_code": "BILL-123",
      "virtual_account_number": "9876543210"
    }
  ]
}
```

### Reset Mock Data

**POST** `/onepipe-mock/reset`

Clears all mock data.

**Response:**
```json
{
  "success": true,
  "message": "All mock data cleared"
}
```

---

## Testing Flow

### 1. Business Registration Flow

```bash
# The TrustRail service will automatically call create merchant
# when a business registers
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "email": "test@example.com",
    "password": "password123",
    "phoneNumber": "2348012345678",
    "rcNumber": "RC123456",
    "settlementAccountNumber": "1234567890",
    "settlementBankCode": "058",
    "settlementAccountName": "Test Account"
  }'
```

### 2. Application Approval & Mandate Creation

When an application is approved, TrustRail automatically calls `create mandate`. After mandate is created, trigger the activation webhook:

```bash
curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_type": "activate_mandate",
    "biller_code": "BILL-1706623224000",
    "mandate_ref": "MAND-1706623225000",
    "transaction_ref": "TXN-123"
  }'
```

### 3. Down Payment

Simulate customer paying down payment to virtual account:

```bash
curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_type": "credit",
    "biller_code": "BILL-1706623224000",
    "virtual_account": "9876543210",
    "amount": 20000
  }'
```

### 4. Installment Payments

Simulate successful installment payment:

```bash
curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_type": "debit",
    "biller_code": "BILL-1706623224000",
    "payment_id": "TXN-1706623300001",
    "transaction_ref": "TXN-1706623300001",
    "amount": 15000,
    "status": "Successful"
  }'
```

Simulate failed installment payment:

```bash
curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_type": "debit",
    "biller_code": "BILL-1706623224000",
    "payment_id": "TXN-1706623300002",
    "transaction_ref": "TXN-1706623300002",
    "amount": 15000,
    "status": "Failed",
    "failure_reason": "Insufficient funds"
  }'
```

---

## Validation

The mock performs basic validation:

✅ **Type checking**: Validates field types (string, number, etc.)
✅ **Required fields**: Ensures all required fields are present
✅ **Enum validation**: Validates enum values (e.g., status, frequency)
✅ **Email format**: Basic email format validation

❌ **NOT validated**: Signature verification (always passes)
❌ **NOT validated**: Encryption (accepts any encrypted strings)
❌ **NOT validated**: Business logic constraints

---

## Notes

- All data is stored in-memory and will be lost when the server restarts
- Use `/onepipe-mock/reset` to clear data between tests
- Signatures are mocked and not validated
- The mock generates deterministic IDs based on timestamps
- Webhook delivery uses `http://localhost:3000/webhooks/pwa` as the target
