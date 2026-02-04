// PWA API Request Types

export interface PWAAuth {
  auth_provider: string;
  secure: string | null;
  type: string | null;
  route_mode?: string | null;
}

export interface PWACustomer {
  customer_ref: string;
  firstname: string;
  surname: string;
  email: string;
  mobile_no: string;
}

export interface PWABaseRequest {
  request_ref: string;
  request_type: string;
  auth?: PWAAuth;
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    transaction_desc?: string;
    transaction_ref_parent?: string | null;
    amount?: number;
    customer?: PWACustomer;
    meta: any;
    details?: any;
    options?: any;
  };
}

export interface PWACreateMerchantRequest extends PWABaseRequest {
  request_type: 'create merchant';
  auth: PWAAuth;
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    transaction_desc: string;
    transaction_ref_parent?: string;
    amount: number;
    customer: PWACustomer;
    meta: {
      beta?: string;
      biller_sector?: string;
      simple_payment?: string;
      webhook_url?: string;
      whatsapp_contact_name?: string;
      whatsapp_contact_no?: string;
      business_short_name?: string;
    };
    details: {
      business_name: string;
      rc_number: string;
      settlement_account_no: string;
      settlement_bank_code: string;
      tin?: string;
      address?: string;
      notification_phone_number: string;
      notification_email: string;
    };
    options?: any;
  };
}

export interface PWACreateMandateRequest extends PWABaseRequest {
  request_type: 'create mandate';
  auth: PWAAuth & {
    type: 'bank.account';
    secure: string; // Encrypted account details
  };
  transaction: {
    mock_mode: 'Inspect' | 'Live';
    transaction_ref: string;
    transaction_desc: string;
    transaction_ref_parent: null;
    amount: number;
    customer: PWACustomer;
    meta: {
      amount: string; // Must be string in OnePipe API
      skip_consent: string;
      bvn: string; // Encrypted BVN
      biller_code: string;
      customer_consent: string;
      repeat_end_date?: string; // Format: YYYY-MM-DD
      repeat_frequency?: string; // 'weekly', 'monthly', or 'once'
    };
    details: Record<string, never>; // Empty object
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
