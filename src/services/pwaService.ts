import axios from 'axios';
import { addMonths } from 'date-fns';
import env from '../config/environment';
import logger from '../config/logger';
import {
  PWABaseRequest,
  PWABaseResponse,
  PWACreateMandateRequest,
  PWACreateMandateResponse,
  PWACreateMerchantRequest,
  PWASendInvoiceRequest,
  PWASendInvoiceResponse
} from '../types/pwa.types';
import { formatDateForPWA } from '../utils/dateUtils';
import { generatePWARequestRef } from '../utils/idGenerator';
import { generatePWASignature } from '../utils/signatureGenerator';
import { encryptAccountCredentials, encryptBVN } from './encryptionService';

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
 * Format phone number to Nigerian international format (234xxxxxxxxx)
 */
const formatPhoneNumber = (phone: string): string => {
  // Remove any spaces, dashes, or special characters
  let cleaned = phone.replace(/[^0-9]/g, '');
  // If it starts with 0, replace with 234
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  }
  // If it doesn't start with 234, add it
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
};

/**
 * Format phone number to local format (0xxxxxxxxxx) - 11 chars max
 */
const formatPhoneLocal = (phone: string): string => {
  // Remove any spaces, dashes, or special characters
  let cleaned = phone.replace(/[^0-9]/g, '');
  // Remove country code if present
  if (cleaned.startsWith('234')) {
    cleaned = '0' + cleaned.substring(3);
  }
  // Ensure it starts with 0
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  // Ensure max 11 characters
  return cleaned.substring(0, 11);
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
  tin?: string;
  address?: string;
  businessShortName?: string;
  webhookUrl?: string;
  whatsappContactName?: string;
  whatsappContactNo?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerRef?: string;
}): Promise<{ billerCode: string; merchantId: string }> => {
  const requestRef = generatePWARequestRef();
  const formattedPhone = formatPhoneNumber(businessData.phoneNumber);

  // Helper to validate numeric string
  const isNumericString = (str: string): boolean => /^\d+$/.test(str);

  // Helper to validate URL
  // const isValidUrl = (str: string): boolean => {
  //   try {
  //     new URL(str);
  //     return true;
  //   } catch {
  //     return false;
  //   }
  // };

  // Format phones for different fields
  const localPhone = formatPhoneLocal(businessData.phoneNumber);

  // Validate and format whatsapp number
  let whatsappPhone = localPhone;
  if (businessData.whatsappContactNo) {
    const formatted = formatPhoneLocal(businessData.whatsappContactNo);
    // Only use if it's a valid 11-digit number
    if (formatted.length === 11 && isNumericString(formatted)) {
      whatsappPhone = formatted;
    }
  }

  // customer_ref: max 13 chars, number string - validate if provided
  let customerRef = formattedPhone.substring(formattedPhone.length - 13);
  if (businessData.customerRef && isNumericString(businessData.customerRef)) {
    customerRef = businessData.customerRef.substring(0, 13); // Ensure max 13 chars
  }

  // Validate webhook URL
  const webhookUrl = process.env.WEBHOOK_URL;

  const payload: PWACreateMerchantRequest = {
    request_ref: requestRef,
    request_type: 'create merchant',
    auth: {
      auth_provider: 'PaywithAccount',
      secure: null,
      type: null,
      route_mode: null,
    },
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      transaction_desc: 'Applying for a new merchant account',
      amount: 0,
      customer: {
        customer_ref: customerRef,
        firstname: businessData?.customerFirstName || 'Merchant',
        surname: businessData?.customerLastName || 'Owner',
        email: businessData?.email,
        mobile_no: formattedPhone,
      },
      meta: {
        beta: 'enabled',
        biller_sector: 'Aggregattor',
        simple_payment: 'enabled',
        webhook_url: webhookUrl,
        whatsapp_contact_name: businessData?.businessName,
        whatsapp_contact_no: whatsappPhone,
        business_short_name: (businessData.businessShortName || businessData.businessName).substring(0, 15),
      },
      details: {
        business_name: businessData.businessName,
        rc_number: businessData.rcNumber,
        settlement_account_no: businessData.settlementAccountNumber,
        settlement_bank_code: businessData.settlementBankCode,
        tin: businessData.tin || businessData?.rcNumber,
        address: businessData.address || businessData?.businessName,
        notification_phone_number: formattedPhone,
        notification_email: businessData.email,
      },
      options: null,
    },
  };

  const response = await makeRequest<any>(payload);
  console.log('PWA Create Merchant Response:', response?.data?.provider_response);
  return {
    billerCode: response?.data?.provider_response?.meta?.biller_code,
    merchantId: response?.data?.merchant_id,
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
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
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

  // Format phone number
  const formattedPhone = formatPhoneNumber(customerData.phoneNumber);
  const customerRef = formattedPhone.substring(formattedPhone.length - 13);

  // Calculate start date (current date) and end date (6 months later)
  const startDate = new Date();
  const endDate = addMonths(startDate, 6);
  const formattedEndDate = formatDateForPWA(endDate);

  const payload: PWACreateMandateRequest = {
    request_ref: requestRef,
    request_type: 'create mandate',
    auth: {
      auth_provider: 'PaywithAccount',
      type: 'bank.account',
      secure: encryptedCredentials,
      route_mode: null,
    },
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      transaction_desc: 'Creating a mandate',
      transaction_ref_parent: null,
      amount: 0,
      customer: {
        customer_ref: customerRef,
        firstname: customerData.firstName,
        surname: customerData.lastName,
        email: customerData.email,
        mobile_no: formattedPhone,
      },
      meta: {
        amount: totalAmount.toString(), // Must be string
        skip_consent: 'true',
        bvn: encryptedBVN,
        biller_code: billerCode,
        customer_consent: "https://paywithaccount.com/consent_template.pdf",
        repeat_end_date: "2030-04-01",
        repeat_frequency: "once"
      },
      details: {},
    },
  };

  console.log(payload);

  const response = await makeRequest<PWACreateMandateResponse>(payload);

  return {
    mandateRef: response.data.reference,
  };
};

/**
 * Send installment invoice
 * Called after mandate creation to create virtual account and schedule debits
 */
export const sendInstallmentInvoice = async (
  customerData: {
    accountNumber: string;
    bankCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  },
  billerCode: string,
  totalAmount: number,
  downPayment: number,
  installmentCount: number,
  frequency: 'weekly' | 'monthly',
  startDate: Date
): Promise<{ virtualAccountNumber: string }> => {
  const requestRef = generatePWARequestRef();

  // Encrypt credentials for PWA
  const encryptedCredentials = encryptAccountCredentials(
    customerData.accountNumber,
    customerData.bankCode
  );

  // Format phone number
  const formattedPhone = formatPhoneNumber(customerData.phoneNumber);
  const customerRef = formattedPhone.substring(formattedPhone.length - 13);

  // Format start date for PWA
  const formattedStartDate = formatDateForPWA(startDate);

  const payload: PWASendInvoiceRequest = {
    request_ref: requestRef,
    request_type: 'send invoice',
    auth: {
      type: 'bank.account',
      secure: encryptedCredentials,
      auth_provider: 'PaywithAccount',
    },
    transaction: {
      mock_mode: env.pwaMockMode as 'Inspect' | 'Live',
      transaction_ref: requestRef,
      transaction_desc: 'Collect installment payment',
      transaction_ref_parent: null,
      amount: totalAmount,
      customer: {
        customer_ref: customerRef,
        firstname: customerData.firstName,
        surname: customerData.lastName,
        email: customerData.email,
        mobile_no: formattedPhone,
      },
      meta: {
        type: 'instalment',
        down_payment: downPayment,
        repeat_frequency: frequency,
        repeat_start_date: formattedStartDate,
        number_of_payments: installmentCount,
        biller_code: billerCode,
      },
      details: {},
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
