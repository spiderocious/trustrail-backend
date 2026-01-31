// PWA API Request Types

export interface PWABaseRequest {
  request_ref: string;
  request_type: string;
  auth?: {
    type: string;
    secure?: string;
    auth_provider: string;
  };
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    customer?: any;
    meta: any;
    details?: any;
  };
}

export interface PWACreateMerchantRequest extends PWABaseRequest {
  request_type: 'create merchant';
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    details: {
      business_name: string;
      email: string;
      phone_number: string;
      rc_number: string;
      settlement_account_number: string;
      settlement_bank_code: string;
      settlement_account_name: string;
    };
    meta: any;
  };
}

export interface PWACreateMandateRequest extends PWABaseRequest {
  request_type: 'create mandate';
  auth: {
    type: 'bank.account';
    secure: string; // Encrypted account details
    auth_provider: 'PaywithAccount';
  };
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    meta: {
      bvn: string; // Encrypted BVN
      biller_code: string;
      amount: number;
      skip_consent: string;
    };
  };
}

export interface PWASendInvoiceRequest extends PWABaseRequest {
  request_type: 'send invoice';
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    meta: {
      type: 'instalment';
      down_payment: number;
      repeat_frequency: 'weekly' | 'monthly';
      repeat_start_date: string; // Format: YYYY-MM-DD-HH-mm-ss
      number_of_payments: number;
      biller_code: string;
    };
  };
}

// PWA API Response Types

export interface PWABaseResponse {
  status: string;
  message: string;
  data?: any;
}

export interface PWACreateMerchantResponse extends PWABaseResponse {
  data: {
    biller_code: string;
    merchant_id: string;
  };
}

export interface PWACreateMandateResponse extends PWABaseResponse {
  data: {
    mandate_ref: string;
    reference: string;
  };
}

export interface PWASendInvoiceResponse extends PWABaseResponse {
  data: {
    virtual_account_number: string;
    account_name: string;
    bank_name: string;
  };
}

// PWA Webhook Types

export interface PWAWebhookPayload {
  request_ref: string;
  request_type: string;
  details: {
    status: string;
    transaction_ref?: string;
    amount?: number;
    meta: {
      event_type?: 'debit' | 'credit';
      signature_hash?: string;
      biller_code?: string;
      payment_id?: string;
      cr_account?: string; // Credit account (virtual account)
      dr_account?: string; // Debit account
    };
    data?: {
      data?: {
        id?: number; // PWA mandate ID
        reference?: string; // Mandate reference
      };
    };
  };
  transaction_type?: string; // Can be 'activate_mandate'
}

export interface PWADebitWebhook extends PWAWebhookPayload {
  details: {
    status: 'Successful' | 'Failed';
    transaction_ref: string;
    amount: number;
    meta: {
      event_type: 'debit';
      signature_hash: string;
      biller_code: string;
      payment_id: string;
      failure_reason?: string;
    };
  };
}

export interface PWACreditWebhook extends PWAWebhookPayload {
  details: {
    status: 'Successful';
    amount: number;
    meta: {
      event_type: 'credit';
      signature_hash: string;
      biller_code: string;
      cr_account: string; // Virtual account that received the credit
    };
  };
}

export interface PWAMandateActivationWebhook extends PWAWebhookPayload {
  transaction_type: 'activate_mandate';
  details: {
    status: 'Successful';
    transaction_ref: string;
    data: {
      data: {
        id: number; // PWA mandate ID
        reference: string; // Mandate reference
      };
    };
    meta: {
      signature_hash: string;
      biller_code: string;
    };
  };
}

// PWA Webhook Event Types
export type PWAWebhookEventType = 'debit' | 'credit' | 'activate_mandate' | 'unknown';

export interface PWAWebhookProcessingResult {
  success: boolean;
  eventType: PWAWebhookEventType;
  signatureValid: boolean;
  errorMessage?: string;
}
