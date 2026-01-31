import { Request, Response } from 'express';
import {
  createMerchant,
  createMandate,
  sendInstallmentInvoice,
  verifyWebhookSignature,
} from '../services/pwaService';
import { generatePWASignature } from '../utils/signatureGenerator';
import { encryptAccountCredentials, encryptBVN } from '../services/encryptionService';
import logger from '../config/logger';
import ResponseFormatter from '../utils/responseFormatter';

/**
 * PWA Test Controller
 * Exposes PWA service methods directly for testing without business logic
 */

/**
 * Test Create Merchant
 * POST /pwa-test/create-merchant
 *
 * Body:
 * {
 *   "businessName": "Test Business Ltd",
 *   "email": "test@business.com",
 *   "phoneNumber": "08012345678",
 *   "rcNumber": "RC123456",
 *   "settlementAccountNumber": "0123456789",
 *   "settlementBankCode": "058",
 *   "tin": "optional-tin",
 *   "address": "optional-address",
 *   "businessShortName": "optional-short-name",
 *   "webhookUrl": "optional-webhook-url",
 *   "whatsappContactName": "optional-name",
 *   "whatsappContactNo": "optional-phone",
 *   "customerFirstName": "optional-firstname",
 *   "customerLastName": "optional-lastname",
 *   "customerRef": "optional-ref"
 * }
 */
export const testCreateMerchant = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      businessName,
      email,
      phoneNumber,
      rcNumber,
      settlementAccountNumber,
      settlementBankCode,
      tin,
      address,
      businessShortName,
      webhookUrl,
      whatsappContactName,
      whatsappContactNo,
      customerFirstName,
      customerLastName,
      customerRef,
    } = req.body;

    // Validate required fields
    if (!businessName || !email || !phoneNumber || !rcNumber ||
        !settlementAccountNumber || !settlementBankCode) {
      res.status(400).json(
        ResponseFormatter.error('Missing required fields: businessName, email, phoneNumber, rcNumber, settlementAccountNumber, settlementBankCode')
      );
      return;
    }

    logger.info('PWA Test: Creating merchant', { businessName, email });

    // Call real PWA service
    const result = await createMerchant({
      businessName,
      email,
      phoneNumber,
      rcNumber,
      settlementAccountNumber,
      settlementBankCode,
      tin,
      address,
      businessShortName,
      webhookUrl,
      whatsappContactName,
      whatsappContactNo,
      customerFirstName,
      customerLastName,
      customerRef,
    });

    logger.info('PWA Test: Merchant created successfully', result);

    res.status(200).json(
      ResponseFormatter.success(result, 'Merchant created successfully')
    );
  } catch (error: any) {
    logger.error('PWA Test: Create merchant failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to create merchant')
    );
  }
};

/**
 * Test Create Mandate
 * POST /pwa-test/create-mandate
 *
 * Body:
 * {
 *   "accountNumber": "0123456789",
 *   "bankCode": "058",
 *   "bvn": "12345678901",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "email": "john@example.com",
 *   "phoneNumber": "08012345678",
 *   "billerCode": "BILL-xxx",
 *   "totalAmount": 100000
 * }
 */
export const testCreateMandate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, bankCode, bvn, firstName, lastName, email, phoneNumber, billerCode, totalAmount } = req.body;

    // Validate required fields
    if (!accountNumber || !bankCode || !bvn || !firstName || !lastName || !email || !phoneNumber || !billerCode || !totalAmount) {
      res.status(400).json(
        ResponseFormatter.error('Missing required fields: accountNumber, bankCode, bvn, firstName, lastName, email, phoneNumber, billerCode, totalAmount')
      );
      return;
    }

    // Validate types
    if (typeof totalAmount !== 'number') {
      res.status(400).json(
        ResponseFormatter.error('totalAmount must be a number')
      );
      return;
    }

    logger.info('PWA Test: Creating mandate', { accountNumber, bankCode, billerCode, totalAmount });

    // Call real PWA service
    const result = await createMandate(
      {
        accountNumber,
        bankCode,
        bvn, // Service will encrypt it
        firstName,
        lastName,
        email,
        phoneNumber,
      },
      billerCode,
      totalAmount
    );

    logger.info('PWA Test: Mandate created successfully', result);

    res.status(200).json(
      ResponseFormatter.success(result, 'Mandate created successfully')
    );
  } catch (error: any) {
    logger.error('PWA Test: Create mandate failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to create mandate')
    );
  }
};

/**
 * Test Send Installment Invoice
 * POST /pwa-test/send-invoice
 *
 * Body:
 * {
 *   "billerCode": "BILL-xxx",
 *   "downPayment": 10000,
 *   "installmentCount": 12,
 *   "frequency": "monthly",
 *   "startDate": "2026-02-15" // Optional, defaults to today
 * }
 */
export const testSendInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { billerCode, downPayment, installmentCount, frequency, startDate } = req.body;

    // Validate required fields
    if (!billerCode || !downPayment || !installmentCount || !frequency) {
      res.status(400).json(
        ResponseFormatter.error('Missing required fields: billerCode, downPayment, installmentCount, frequency')
      );
      return;
    }

    // Validate types
    if (typeof downPayment !== 'number' || typeof installmentCount !== 'number') {
      res.status(400).json(
        ResponseFormatter.error('downPayment and installmentCount must be numbers')
      );
      return;
    }

    // Validate frequency
    if (!['weekly', 'monthly'].includes(frequency)) {
      res.status(400).json(
        ResponseFormatter.error('frequency must be "weekly" or "monthly"')
      );
      return;
    }

    // Parse start date or use today
    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    logger.info('PWA Test: Sending installment invoice', {
      billerCode,
      downPayment,
      installmentCount,
      frequency,
      startDate: parsedStartDate,
    });

    // Call real PWA service
    const result = await sendInstallmentInvoice(
      billerCode,
      downPayment,
      installmentCount,
      frequency as 'weekly' | 'monthly',
      parsedStartDate
    );

    logger.info('PWA Test: Invoice sent successfully', result);

    res.status(200).json(
      ResponseFormatter.success(result, 'Invoice sent successfully')
    );
  } catch (error: any) {
    logger.error('PWA Test: Send invoice failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to send invoice')
    );
  }
};

/**
 * Test Signature Generation
 * POST /pwa-test/generate-signature
 *
 * Body:
 * {
 *   "requestRef": "any-request-reference"
 * }
 */
export const testGenerateSignature = async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestRef } = req.body;

    if (!requestRef) {
      res.status(400).json(
        ResponseFormatter.error('requestRef is required')
      );
      return;
    }

    logger.info('PWA Test: Generating signature', { requestRef });

    // Generate signature
    const signature = generatePWASignature(requestRef);

    res.status(200).json(
      ResponseFormatter.success(
        {
          requestRef,
          signature,
          algorithm: 'MD5',
          formula: 'MD5(request_ref + ";" + client_secret)',
        },
        'Signature generated successfully'
      )
    );
  } catch (error: any) {
    logger.error('PWA Test: Generate signature failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to generate signature')
    );
  }
};

/**
 * Test Webhook Signature Verification
 * POST /pwa-test/verify-webhook-signature
 *
 * Body:
 * {
 *   "requestRef": "webhook-request-ref",
 *   "receivedSignature": "signature-from-webhook"
 * }
 */
export const testVerifyWebhookSignature = async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestRef, receivedSignature } = req.body;

    if (!requestRef || !receivedSignature) {
      res.status(400).json(
        ResponseFormatter.error('requestRef and receivedSignature are required')
      );
      return;
    }

    logger.info('PWA Test: Verifying webhook signature', { requestRef });

    // Verify signature
    const isValid = verifyWebhookSignature(requestRef, receivedSignature);

    res.status(200).json(
      ResponseFormatter.success(
        {
          requestRef,
          receivedSignature,
          isValid,
          expectedSignature: generatePWASignature(requestRef),
        },
        isValid ? 'Signature is valid' : 'Signature is invalid'
      )
    );
  } catch (error: any) {
    logger.error('PWA Test: Verify webhook signature failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to verify signature')
    );
  }
};

/**
 * Test Encryption
 * POST /pwa-test/test-encryption
 *
 * Body:
 * {
 *   "accountNumber": "0123456789",
 *   "bankCode": "058",
 *   "bvn": "12345678901"
 * }
 */
export const testEncryption = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, bankCode, bvn } = req.body;

    if (!accountNumber || !bankCode || !bvn) {
      res.status(400).json(
        ResponseFormatter.error('accountNumber, bankCode, and bvn are required')
      );
      return;
    }

    logger.info('PWA Test: Testing encryption');

    // Encrypt credentials
    const encryptedCredentials = encryptAccountCredentials(accountNumber, bankCode);
    const encryptedBVN = encryptBVN(bvn);

    res.status(200).json(
      ResponseFormatter.success(
        {
          input: {
            accountNumber,
            bankCode,
            bvn,
          },
          encrypted: {
            credentials: encryptedCredentials,
            bvn: encryptedBVN,
          },
          algorithm: 'TripleDES',
        },
        'Encryption successful'
      )
    );
  } catch (error: any) {
    logger.error('PWA Test: Encryption failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to encrypt data')
    );
  }
};

/**
 * Get PWA Configuration
 * GET /pwa-test/config
 *
 * Returns current PWA configuration (without secrets)
 */
export const getPWAConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const env = (await import('../config/environment')).default;

    res.status(200).json(
      ResponseFormatter.success(
        {
          baseUrl: env.pwaBaseUrl,
          mockMode: env.pwaMockMode,
          hasApiKey: !!env.pwaApiKey,
          apiKeyLength: env.pwaApiKey?.length || 0,
          hasTripleDESKey: !!env.tripleDESKey,
          tripleDESKeyLength: env.tripleDESKey?.length || 0,
        },
        'PWA configuration retrieved'
      )
    );
  } catch (error: any) {
    logger.error('PWA Test: Get config failed:', error);
    res.status(500).json(
      ResponseFormatter.error(error.message || 'Failed to get configuration')
    );
  }
};

export default {
  testCreateMerchant,
  testCreateMandate,
  testSendInvoice,
  testGenerateSignature,
  testVerifyWebhookSignature,
  testEncryption,
  getPWAConfig,
};
