# OnePipe/PWA Testing Endpoints Documentation

This document lists all endpoints for testing the OnePipe/PWA integration.

---

## **PWA Test Endpoints** (Direct access to real PWA APIs)

Base URL: `http://localhost:3000/pwa-test`

These endpoints call the REAL OnePipe APIs using your configured credentials.

---

### 1. Get PWA Configuration

**Method:** `GET`
**Path:** `/pwa-test/config`

**Description:** Get current PWA configuration without exposing secrets.

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "PWA configuration retrieved",
  "data": {
    "baseUrl": "https://api.dev.onepipe.io/v2/transact",
    "mockMode": "Inspect",
    "hasApiKey": true,
    "apiKeyLength": 64,
    "hasTripleDESKey": true,
    "tripleDESKeyLength": 24
  }
}
```

---

### 2. Test Create Merchant

**Method:** `POST`
**Path:** `/pwa-test/create-merchant`

**Description:** Creates a merchant directly on OnePipe without going through business signup. Now includes all fields required by OnePipe API.

**Request Body:**
```json
{
  "businessName": "Test Business Ltd",
  "email": "test@business.com",
  "phoneNumber": "08012345678",
  "rcNumber": "RC123456",
  "settlementAccountNumber": "0123456789",
  "settlementBankCode": "058",
  "tin": "optional-tax-id",
  "address": "optional-business-address",
  "businessShortName": "optional-short-name",
  "webhookUrl": "optional-webhook-url",
  "whatsappContactName": "optional-contact-name",
  "whatsappContactNo": "optional-whatsapp-number",
  "customerFirstName": "optional-first-name",
  "customerLastName": "optional-last-name",
  "customerRef": "optional-customer-reference"
}
```

**Required Fields:**
- `businessName`, `email`, `phoneNumber`, `rcNumber`, `settlementAccountNumber`, `settlementBankCode`

**Optional Fields:**
- All other fields are optional and will be auto-populated with sensible defaults if not provided

**Response:**
```json
{
  "success": true,
  "message": "Merchant created successfully",
  "data": {
    "billerCode": "BILL-1738395847123",
    "merchantId": "MERCH-1738395847123"
  }
}
```

---

### 3. Test Create Mandate

**Method:** `POST`
**Path:** `/pwa-test/create-mandate`

**Description:** Creates a mandate directly on OnePipe.

**Request Body:**
```json
{
  "accountNumber": "0123456789",
  "bankCode": "058",
  "bvn": "12345678901",
  "billerCode": "BILL-1738395847123",
  "totalAmount": 100000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mandate created successfully",
  "data": {
    "mandateRef": "MAND-REF-XXX"
  }
}
```

---

### 4. Test Send Installment Invoice

**Method:** `POST`
**Path:** `/pwa-test/send-invoice`

**Description:** Sends installment invoice to create virtual account for down payment.

**Request Body:**
```json
{
  "billerCode": "BILL-1738395847123",
  "downPayment": 10000,
  "installmentCount": 12,
  "frequency": "monthly",
  "startDate": "2026-02-15"
}
```

**Notes:**
- `frequency` must be either `"weekly"` or `"monthly"`
- `startDate` is optional (defaults to today if not provided)
- Date format: `YYYY-MM-DD`

**Response:**
```json
{
  "success": true,
  "message": "Invoice sent successfully",
  "data": {
    "virtualAccountNumber": "1234567890"
  }
}
```

---

### 5. Test Signature Generation

**Method:** `POST`
**Path:** `/pwa-test/generate-signature`

**Description:** Tests the signature generation algorithm (HMAC-SHA512).

**Request Body:**
```json
{
  "requestRef": "any-request-reference-12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signature generated successfully",
  "data": {
    "requestRef": "any-request-reference-12345",
    "signature": "a1b2c3d4e5f6...",
    "algorithm": "HMAC-SHA512"
  }
}
```

---

### 6. Test Webhook Signature Verification

**Method:** `POST`
**Path:** `/pwa-test/verify-webhook-signature`

**Description:** Verifies a webhook signature received from OnePipe.

**Request Body:**
```json
{
  "requestRef": "WEBHOOK-12345",
  "receivedSignature": "signature-from-onepipe-webhook"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signature is valid",
  "data": {
    "requestRef": "WEBHOOK-12345",
    "receivedSignature": "signature-from-onepipe-webhook",
    "isValid": true,
    "expectedSignature": "a1b2c3d4e5f6..."
  }
}
```

---

### 7. Test Encryption

**Method:** `POST`
**Path:** `/pwa-test/test-encryption`

**Description:** Tests TripleDES encryption for account credentials and BVN.

**Request Body:**
```json
{
  "accountNumber": "0123456789",
  "bankCode": "058",
  "bvn": "12345678901"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Encryption successful",
  "data": {
    "input": {
      "accountNumber": "0123456789",
      "bankCode": "058",
      "bvn": "12345678901"
    },
    "encrypted": {
      "credentials": "encrypted-base64-string-xxx",
      "bvn": "encrypted-base64-string-yyy"
    },
    "algorithm": "TripleDES"
  }
}
```

---

## **OnePipe Mock Endpoints** (Simulates OnePipe responses)

Base URL: `http://localhost:3000/onepipe-mock`

These endpoints simulate OnePipe's API for testing without real integration.

---

### 1. Mock Transact Endpoint

**Method:** `POST`
**Path:** `/onepipe-mock/transact`

**Description:** Main endpoint that handles all OnePipe request types (create merchant, create mandate, send invoice).

**Request Body (Create Merchant):**
```json
{
  "request_ref": "REQ-12345",
  "request_type": "create merchant",
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "REQ-12345",
    "details": {
      "business_name": "Test Business Ltd",
      "email": "test@business.com",
      "phone_number": "08012345678",
      "rc_number": "RC123456",
      "settlement_account_number": "0123456789",
      "settlement_bank_code": "058",
      "settlement_account_name": "Test Business Account"
    },
    "meta": {}
  }
}
```

**Request Body (Create Mandate):**
```json
{
  "request_ref": "REQ-12345",
  "request_type": "create mandate",
  "auth": {
    "type": "bank.account",
    "secure": "encrypted-credentials",
    "auth_provider": "PaywithAccount"
  },
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "REQ-12345",
    "meta": {
      "bvn": "encrypted-bvn",
      "biller_code": "BILL-12345",
      "amount": 100000,
      "skip_consent": "true"
    }
  }
}
```

**Request Body (Send Invoice):**
```json
{
  "request_ref": "REQ-12345",
  "request_type": "send invoice",
  "transaction": {
    "mock_mode": "Inspect",
    "transaction_ref": "REQ-12345",
    "meta": {
      "type": "instalment",
      "down_payment": 10000,
      "repeat_frequency": "monthly",
      "repeat_start_date": "2026-02-15-00-00-00",
      "number_of_payments": 12,
      "biller_code": "BILL-12345"
    }
  }
}
```

**Response (varies by request_type):**
```json
{
  "status": "Successful",
  "message": "...",
  "data": {
    // Response data based on request type
  }
}
```

---

### 2. Trigger Mock Webhook

**Method:** `POST`
**Path:** `/onepipe-mock/trigger-webhook`

**Description:** Manually trigger webhooks to TrustRail (for testing webhook handlers).

**Request Body (Activate Mandate):**
```json
{
  "webhook_type": "activate_mandate",
  "biller_code": "BILL-12345",
  "mandate_ref": "MAND-12345",
  "transaction_ref": "TXN-12345"
}
```

**Request Body (Debit - Payment Success):**
```json
{
  "webhook_type": "debit",
  "biller_code": "BILL-12345",
  "payment_id": "PAY-12345",
  "transaction_ref": "TXN-12345",
  "amount": 8333,
  "status": "Successful"
}
```

**Request Body (Debit - Payment Failed):**
```json
{
  "webhook_type": "debit",
  "biller_code": "BILL-12345",
  "payment_id": "PAY-12345",
  "transaction_ref": "TXN-12345",
  "amount": 8333,
  "status": "Failed",
  "failure_reason": "Insufficient funds"
}
```

**Request Body (Credit - Down Payment):**
```json
{
  "webhook_type": "credit",
  "biller_code": "BILL-12345",
  "virtual_account": "1234567890",
  "amount": 10000
}
```

**Response:**
```json
{
  "success": true,
  "message": "debit webhook sent successfully",
  "webhook_payload": {
    // The actual payload sent to TrustRail
  },
  "response_status": 200
}
```

---

### 3. Get Mock Data

**Method:** `GET`
**Path:** `/onepipe-mock/data`

**Description:** View all mock data stored in memory (for debugging).

**Request Body:** None

**Response:**
```json
{
  "merchants": [
    {
      "request_ref": "REQ-12345",
      "billerCode": "BILL-12345",
      "merchantId": "MERCH-12345"
    }
  ],
  "mandates": [
    {
      "mandate_ref": "MAND-12345",
      "reference": "REF-12345"
    }
  ],
  "virtualAccounts": [
    {
      "biller_code": "BILL-12345",
      "virtual_account_number": "1234567890"
    }
  ]
}
```

---

### 4. Reset Mock Data

**Method:** `POST`
**Path:** `/onepipe-mock/reset`

**Description:** Clear all mock data from memory.

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "message": "All mock data cleared"
}
```

---

## **Webhook Receiver Endpoint** (Receives webhooks FROM OnePipe)

Base URL: `http://localhost:3000/webhooks`

---

### Receive PWA Webhook

**Method:** `POST`
**Path:** `/webhooks/pwa`

**Description:** Endpoint that receives webhooks from OnePipe. This is called BY OnePipe, not by you.

**Webhook Payload (Mandate Activation):**
```json
{
  "request_ref": "WEBHOOK-12345",
  "request_type": "activate_mandate",
  "transaction_type": "activate_mandate",
  "details": {
    "status": "Successful",
    "transaction_ref": "TXN-12345",
    "data": {
      "data": {
        "id": 123456,
        "reference": "MAND-12345"
      }
    },
    "meta": {
      "signature_hash": "signature-from-onepipe",
      "biller_code": "BILL-12345"
    }
  }
}
```

**Webhook Payload (Debit Notification):**
```json
{
  "request_ref": "WEBHOOK-12345",
  "request_type": "debit_notification",
  "details": {
    "status": "Successful",
    "transaction_ref": "TXN-12345",
    "amount": 8333,
    "meta": {
      "event_type": "debit",
      "signature_hash": "signature-from-onepipe",
      "biller_code": "BILL-12345",
      "payment_id": "PAY-12345",
      "failure_reason": "Optional - only if failed"
    }
  }
}
```

**Webhook Payload (Credit Notification):**
```json
{
  "request_ref": "WEBHOOK-12345",
  "request_type": "credit_notification",
  "details": {
    "status": "Successful",
    "amount": 10000,
    "meta": {
      "event_type": "credit",
      "signature_hash": "signature-from-onepipe",
      "biller_code": "BILL-12345",
      "cr_account": "1234567890"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received"
}
```

---

## Testing Flow Examples

### **Test 1: Validate Production Keys**

1. Check config:
   ```bash
   curl http://localhost:3000/pwa-test/config
   ```

2. Test signature generation:
   ```bash
   curl -X POST http://localhost:3000/pwa-test/generate-signature \
     -H "Content-Type: application/json" \
     -d '{"requestRef": "TEST-12345"}'
   ```

3. Test encryption:
   ```bash
   curl -X POST http://localhost:3000/pwa-test/test-encryption \
     -H "Content-Type: application/json" \
     -d '{
       "accountNumber": "0123456789",
       "bankCode": "058",
       "bvn": "12345678901"
     }'
   ```

---

### **Test 2: Full Merchant Creation Flow**

1. Create merchant:
   ```bash
   curl -X POST http://localhost:3000/pwa-test/create-merchant \
     -H "Content-Type: application/json" \
     -d '{
       "businessName": "Test Business Ltd",
       "email": "test@business.com",
       "phoneNumber": "08012345678",
       "rcNumber": "RC123456",
       "settlementAccountNumber": "0123456789",
       "settlementBankCode": "058",
       "settlementAccountName": "Test Business Account"
     }'
   ```

2. Save the returned `billerCode` for next steps.

---

### **Test 3: Full Mandate & Invoice Flow**

1. Create mandate (using billerCode from Test 2):
   ```bash
   curl -X POST http://localhost:3000/pwa-test/create-mandate \
     -H "Content-Type: application/json" \
     -d '{
       "accountNumber": "0123456789",
       "bankCode": "058",
       "bvn": "12345678901",
       "billerCode": "BILL-12345",
       "totalAmount": 100000
     }'
   ```

2. Send invoice (using billerCode):
   ```bash
   curl -X POST http://localhost:3000/pwa-test/send-invoice \
     -H "Content-Type: application/json" \
     -d '{
       "billerCode": "BILL-12345",
       "downPayment": 10000,
       "installmentCount": 12,
       "frequency": "monthly"
     }'
   ```

---

### **Test 4: Mock Webhook Testing**

1. Trigger mandate activation:
   ```bash
   curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "webhook_type": "activate_mandate",
       "biller_code": "BILL-12345",
       "mandate_ref": "MAND-12345",
       "transaction_ref": "TXN-12345"
     }'
   ```

2. Trigger credit webhook:
   ```bash
   curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "webhook_type": "credit",
       "biller_code": "BILL-12345",
       "virtual_account": "1234567890",
       "amount": 10000
     }'
   ```

3. Trigger debit webhook (success):
   ```bash
   curl -X POST http://localhost:3000/onepipe-mock/trigger-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "webhook_type": "debit",
       "biller_code": "BILL-12345",
       "payment_id": "PAY-12345",
       "transaction_ref": "TXN-12345",
       "amount": 8333,
       "status": "Successful"
     }'
   ```

---

## Bank Codes Reference

Common Nigerian bank codes for testing:

| Bank | Code |
|------|------|
| GTBank | 058 |
| Access Bank | 044 |
| Zenith Bank | 057 |
| First Bank | 011 |
| UBA | 033 |
| Ecobank | 050 |
| Fidelity Bank | 070 |
| FCMB | 214 |
| Sterling Bank | 232 |
| Stanbic IBTC | 221 |

---

## Important Notes

1. **Production Safety**: The `/pwa-test` endpoints should be disabled or protected in production.

2. **Mock Mode**:
   - `Inspect` = Testing mode (OnePipe won't actually process)
   - `Live` = Production mode (OnePipe will process real transactions)

3. **Signature Verification**: All webhooks from OnePipe include a `signature_hash` that must be verified using your API key.

4. **Error Handling**: All endpoints return errors in this format:
   ```json
   {
     "success": false,
     "message": "Error message here"
   }
   ```

5. **Date Format**: PWA expects dates in format `YYYY-MM-DD-HH-mm-ss` (e.g., `2026-02-15-00-00-00`)

---

## Environment Variables Required

```bash
PWA_BASE_URL=https://api.onepipe.io/v2/transact  # Production
PWA_API_KEY=your-production-api-key  # Bearer token for Authorization header
PWA_CLIENT_SECRET=your-client-secret  # Used for signature generation (MD5)
TRIPLE_DES_KEY=your-24-byte-secret-key!!  # For encrypting account details
PWA_MOCK_MODE=Live  # For production (use "Inspect" for testing)
```

**Important Notes:**
- `PWA_API_KEY` and `PWA_CLIENT_SECRET` are different values from OnePipe
- Signature is generated as: `MD5(request_ref + ";" + client_secret)`
- The API key is used in the `Authorization: Bearer {api_key}` header
- The client secret is used only for generating the `Signature` header
