import axios from 'axios';
import env from '../config/environment';
import logger from '../config/logger';
import { generatePWASignature } from '../utils/signatureGenerator';
import { generatePWARequestRef } from '../utils/idGenerator';
import { formatDateForPWA } from '../utils/dateUtils';
import { encryptAccountCredentials, encryptBVN } from './encryptionService';
import {
  PWABaseRequest,
  PWABaseResponse,
  PWACreateMerchantRequest,
  PWACreateMerchantResponse,
  PWACreateMandateRequest,
  PWACreateMandateResponse,
  PWASendInvoiceRequest,
  PWASendInvoiceResponse,
} from '../types/pwa.types';

/**
 * Make request to PWA API
 */
const makeRequest = async <T extends PWABaseResponse>(payload: PWABaseRequest): Promise<T> => {
  try {
    const signature = generatePWASignature(payload.request_ref);

    logger.info(`PWA API Request: ${payload.request_type}`, {
      request_ref: payload.request_ref,
    });

    const response = await axios.post<T>(env.pwaBaseUrl, payload, {
      headers: {
        Authorization: `Bearer ${env.pwaApiKey}`,
        Signature: signature,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    logger.info(`PWA API Response: ${payload.request_type} - ${response.data.status}`, {
      request_ref: payload.request_ref,
    });

    // Check response status
    if (response.data.status !== 'Successful' && response.data.status !== 'successful') {
      throw new Error(`PWA API error: ${response.data.message}`);
    }

    return response.data;
  } catch (error: any) {
    logger.error('PWA API request failed:', {
      request_type: payload.request_type,
      request_ref: payload.request_ref,
      error: error.message,
    });

    if (error.response) {
      // Server responded with error status
      throw new Error(`PWA API error: ${error.response.data?.message || error.message}`);
    } else if (error.request) {
      // No response received
      throw new Error('PWA API timeout or network error');
    } else {
      throw error;
    }
  }
};

/**
 * Create merchant on PWA
 * Called during business registration
 */
export const createMerchant = async (businessData: {
  businessName: string;
  email: string;
  phoneNumber: string;
  rcNumber: string;
  settlementAccountNumber: string;
  settlementBankCode: string;
  settlementAccountName: string;
}): Promise<{ billerCode: string; merchantId: string }> => {
  const requestRef = generatePWARequestRef();

  const payload: PWACreateMerchantRequest = {
    request_ref: requestRef,
    request_type: 'create merchant',
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      details: {
        business_name: businessData.businessName,
        email: businessData.email,
        phone_number: businessData.phoneNumber,
        rc_number: businessData.rcNumber,
        settlement_account_number: businessData.settlementAccountNumber,
        settlement_bank_code: businessData.settlementBankCode,
        settlement_account_name: businessData.settlementAccountName,
      },
      meta: {},
    },
  };

  const response = await makeRequest<PWACreateMerchantResponse>(payload);

  return {
    billerCode: response.data.biller_code,
    merchantId: response.data.merchant_id,
  };
};

/**
 * Create mandate for customer
 * Called after application approval
 */
export const createMandate = async (
  customerData: {
    accountNumber: string;
    bankCode: string;
    bvn: string; // Already encrypted in DB, needs to be re-encrypted for PWA
  },
  billerCode: string,
  totalAmount: number
): Promise<{ mandateRef: string }> => {
  const requestRef = generatePWARequestRef();

  // Encrypt credentials for PWA
  const encryptedCredentials = encryptAccountCredentials(
    customerData.accountNumber,
    customerData.bankCode
  );

  // BVN should already be encrypted, but we can encrypt it again for PWA
  const encryptedBVN = encryptBVN(customerData.bvn);

  const payload: PWACreateMandateRequest = {
    request_ref: requestRef,
    request_type: 'create mandate',
    auth: {
      type: 'bank.account',
      secure: encryptedCredentials,
      auth_provider: 'PaywithAccount',
    },
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      meta: {
        bvn: encryptedBVN,
        biller_code: billerCode,
        amount: totalAmount,
        skip_consent: 'true',
      },
    },
  };

  const response = await makeRequest<PWACreateMandateResponse>(payload);

  return {
    mandateRef: response.data.reference,
  };
};

/**
 * Send installment invoice
 * Called after mandate activation to create virtual account and schedule debits
 */
export const sendInstallmentInvoice = async (
  billerCode: string,
  downPayment: number,
  installmentCount: number,
  frequency: 'weekly' | 'monthly',
  startDate: Date
): Promise<{ virtualAccountNumber: string }> => {
  const requestRef = generatePWARequestRef();

  // Format start date for PWA
  const formattedStartDate = formatDateForPWA(startDate);

  const payload: PWASendInvoiceRequest = {
    request_ref: requestRef,
    request_type: 'send invoice',
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      meta: {
        type: 'instalment',
        down_payment: downPayment,
        repeat_frequency: frequency,
        repeat_start_date: formattedStartDate,
        number_of_payments: installmentCount,
        biller_code: billerCode,
      },
    },
  };

  const response = await makeRequest<PWASendInvoiceResponse>(payload);

  return {
    virtualAccountNumber: response.data.virtual_account_number,
  };
};

/**
 * Verify webhook signature from PWA
 */
export const verifyWebhookSignature = (requestRef: string, receivedSignature: string): boolean => {
  const expectedSignature = generatePWASignature(requestRef);
  return expectedSignature === receivedSignature;
};

export default {
  createMerchant,
  createMandate,
  sendInstallmentInvoice,
  verifyWebhookSignature,
};
