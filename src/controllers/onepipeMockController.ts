import { Request, Response } from 'express';
import axios from 'axios';
import logger from '../config/logger';
import env from '../config/environment';

/**
 * OnePipe Mock Controller
 * Simulates OnePipe/PWA API for testing without real integration
 */

// In-memory storage for mock data
const mockMerchants = new Map<string, { billerCode: string; merchantId: string }>();
const mockMandates = new Map<string, { mandateRef: string; reference: string }>();
const mockVirtualAccounts = new Map<string, string>();

/**
 * Main transact endpoint - handles all OnePipe request types
 * POST /onepipe-mock/transact
 */
export const transact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { request_ref, request_type, transaction } = req.body;

    // Basic validation
    if (!request_ref || typeof request_ref !== 'string') {
      res.status(400).json({
        status: 'Failed',
        message: 'request_ref is required and must be a string',
      });
      return;
    }

    if (!request_type || typeof request_type !== 'string') {
      res.status(400).json({
        status: 'Failed',
        message: 'request_type is required and must be a string',
      });
      return;
    }

    if (!transaction || typeof transaction !== 'object') {
      res.status(400).json({
        status: 'Failed',
        message: 'transaction is required and must be an object',
      });
      return;
    }

    logger.info(`OnePipe Mock: Received ${request_type}`, { request_ref });

    // Route to appropriate handler
    switch (request_type.toLowerCase()) {
      case 'create merchant':
        handleCreateMerchant(req, res);
        break;
      case 'create mandate':
        handleCreateMandate(req, res);
        break;
      case 'send invoice':
        handleSendInvoice(req, res);
        break;
      default:
        res.status(400).json({
          status: 'Failed',
          message: `Unknown request_type: ${request_type}`,
        });
    }
  } catch (error: any) {
    logger.error('OnePipe Mock error:', error);
    res.status(500).json({
      status: 'Failed',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Handle create merchant request
 */
const handleCreateMerchant = (req: Request, res: Response): void => {
  const { request_ref, transaction } = req.body;
  const { details } = transaction;

  // Validate required fields
  const requiredFields = [
    'business_name',
    'email',
    'phone_number',
    'rc_number',
    'settlement_account_number',
    'settlement_bank_code',
    'settlement_account_name',
  ];

  for (const field of requiredFields) {
    if (!details || !details[field] || typeof details[field] !== 'string') {
      res.status(400).json({
        status: 'Failed',
        message: `${field} is required and must be a string`,
      });
      return;
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(details.email)) {
    res.status(400).json({
      status: 'Failed',
      message: 'Invalid email format',
    });
    return;
  }

  // Generate mock biller code and merchant ID
  const billerCode = `BILL-${Date.now()}`;
  const merchantId = `MERCH-${Date.now()}`;

  // Store in memory
  mockMerchants.set(request_ref, { billerCode, merchantId });

  logger.info(`OnePipe Mock: Created merchant ${merchantId} with biller code ${billerCode}`);

  res.status(200).json({
    status: 'Successful',
    message: 'Merchant created successfully',
    data: {
      biller_code: billerCode,
      merchant_id: merchantId,
    },
  });
};

/**
 * Handle create mandate request
 */
const handleCreateMandate = (req: Request, res: Response): void => {
  const { request_ref: _request_ref, auth, transaction } = req.body;
  const { meta } = transaction;

  // Validate auth
  if (!auth || auth.type !== 'bank.account') {
    res.status(400).json({
      status: 'Failed',
      message: 'auth.type must be "bank.account"',
    });
    return;
  }

  if (!auth.secure || typeof auth.secure !== 'string') {
    res.status(400).json({
      status: 'Failed',
      message: 'auth.secure is required and must be a string',
    });
    return;
  }

  if (auth.auth_provider !== 'PaywithAccount') {
    res.status(400).json({
      status: 'Failed',
      message: 'auth.auth_provider must be "PaywithAccount"',
    });
    return;
  }

  // Validate meta
  if (!meta || !meta.biller_code || typeof meta.biller_code !== 'string') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.biller_code is required and must be a string',
    });
    return;
  }

  if (!meta.amount || typeof meta.amount !== 'number') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.amount is required and must be a number',
    });
    return;
  }

  if (!meta.bvn || typeof meta.bvn !== 'string') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.bvn is required and must be a string',
    });
    return;
  }

  // Generate mock mandate reference
  const mandateRef = `MAND-${Date.now()}`;
  const reference = `REF-${Date.now()}`;

  // Store in memory
  mockMandates.set(mandateRef, { mandateRef, reference });

  logger.info(`OnePipe Mock: Created mandate ${mandateRef}`);

  res.status(200).json({
    status: 'Successful',
    message: 'Mandate created successfully',
    data: {
      mandate_ref: mandateRef,
      reference: reference,
    },
  });
};

/**
 * Handle send invoice request
 */
const handleSendInvoice = (req: Request, res: Response): void => {
  const { request_ref: _request_ref, transaction } = req.body;
  const { meta } = transaction;

  // Validate meta
  if (!meta || meta.type !== 'instalment') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.type must be "instalment"',
    });
    return;
  }

  if (typeof meta.down_payment !== 'number') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.down_payment is required and must be a number',
    });
    return;
  }

  if (!['weekly', 'monthly'].includes(meta.repeat_frequency)) {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.repeat_frequency must be "weekly" or "monthly"',
    });
    return;
  }

  if (!meta.repeat_start_date || typeof meta.repeat_start_date !== 'string') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.repeat_start_date is required and must be a string',
    });
    return;
  }

  if (typeof meta.number_of_payments !== 'number') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.number_of_payments is required and must be a number',
    });
    return;
  }

  if (!meta.biller_code || typeof meta.biller_code !== 'string') {
    res.status(400).json({
      status: 'Failed',
      message: 'meta.biller_code is required and must be a string',
    });
    return;
  }

  // Generate mock virtual account
  const virtualAccountNumber = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const accountName = 'TrustRail Virtual Account';
  const bankName = 'Mock Bank';

  // Store in memory
  mockVirtualAccounts.set(meta.biller_code, virtualAccountNumber);

  logger.info(`OnePipe Mock: Created virtual account ${virtualAccountNumber} for biller ${meta.biller_code}`);

  res.status(200).json({
    status: 'Successful',
    message: 'Invoice sent successfully',
    data: {
      virtual_account_number: virtualAccountNumber,
      account_name: accountName,
      bank_name: bankName,
    },
  });
};

/**
 * Trigger webhook to TrustRail
 * POST /onepipe-mock/trigger-webhook
 *
 * Body:
 * {
 *   "webhook_type": "debit" | "credit" | "activate_mandate",
 *   "biller_code": "BILL-xxx",
 *   "mandate_ref": "MAND-xxx", // For activate_mandate
 *   "payment_id": "string", // For debit
 *   "transaction_ref": "string",
 *   "amount": 1000, // For debit/credit
 *   "status": "Successful" | "Failed", // For debit
 *   "failure_reason": "string" // Optional, for failed debit
 * }
 */
export const triggerWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      webhook_type,
      biller_code,
      mandate_ref,
      payment_id,
      transaction_ref,
      amount,
      status,
      failure_reason,
      virtual_account,
    } = req.body;

    // Validate webhook_type
    if (!['debit', 'credit', 'activate_mandate'].includes(webhook_type)) {
      res.status(400).json({
        error: 'webhook_type must be "debit", "credit", or "activate_mandate"',
      });
      return;
    }

    // Validate biller_code
    if (!biller_code || typeof biller_code !== 'string') {
      res.status(400).json({
        error: 'biller_code is required and must be a string',
      });
      return;
    }

    // Generate request_ref for webhook
    const requestRef = `WEBHOOK-${Date.now()}`;
    const signatureHash = `MOCK-SIG-${Date.now()}`; // Mock signature

    let webhookPayload: any;

    // Build webhook payload based on type
    if (webhook_type === 'debit') {
      // Validate debit-specific fields
      if (!payment_id || typeof payment_id !== 'string') {
        res.status(400).json({
          error: 'payment_id is required for debit webhook',
        });
        return;
      }

      if (!transaction_ref || typeof transaction_ref !== 'string') {
        res.status(400).json({
          error: 'transaction_ref is required for debit webhook',
        });
        return;
      }

      if (typeof amount !== 'number') {
        res.status(400).json({
          error: 'amount is required and must be a number for debit webhook',
        });
        return;
      }

      if (!['Successful', 'Failed'].includes(status)) {
        res.status(400).json({
          error: 'status must be "Successful" or "Failed" for debit webhook',
        });
        return;
      }

      webhookPayload = {
        request_ref: requestRef,
        request_type: 'debit_notification',
        details: {
          status,
          transaction_ref,
          amount,
          meta: {
            event_type: 'debit',
            signature_hash: signatureHash,
            biller_code,
            payment_id,
            ...(failure_reason && { failure_reason }),
          },
        },
      };
    } else if (webhook_type === 'credit') {
      // Validate credit-specific fields
      if (typeof amount !== 'number') {
        res.status(400).json({
          error: 'amount is required and must be a number for credit webhook',
        });
        return;
      }

      if (!virtual_account || typeof virtual_account !== 'string') {
        res.status(400).json({
          error: 'virtual_account is required for credit webhook',
        });
        return;
      }

      webhookPayload = {
        request_ref: requestRef,
        request_type: 'credit_notification',
        details: {
          status: 'Successful',
          amount,
          meta: {
            event_type: 'credit',
            signature_hash: signatureHash,
            biller_code,
            cr_account: virtual_account,
          },
        },
      };
    } else if (webhook_type === 'activate_mandate') {
      // Validate activate_mandate-specific fields
      if (!mandate_ref || typeof mandate_ref !== 'string') {
        res.status(400).json({
          error: 'mandate_ref is required for activate_mandate webhook',
        });
        return;
      }

      if (!transaction_ref || typeof transaction_ref !== 'string') {
        res.status(400).json({
          error: 'transaction_ref is required for activate_mandate webhook',
        });
        return;
      }

      webhookPayload = {
        request_ref: requestRef,
        request_type: 'activate_mandate',
        transaction_type: 'activate_mandate',
        details: {
          status: 'Successful',
          transaction_ref,
          data: {
            data: {
              id: Math.floor(Math.random() * 1000000),
              reference: mandate_ref,
            },
          },
          meta: {
            signature_hash: signatureHash,
            biller_code,
          },
        },
      };
    }

    // Send webhook to TrustRail
    const webhookUrl = `http://localhost:${env.port}/webhooks/pwa`;

    logger.info(`OnePipe Mock: Sending ${webhook_type} webhook to ${webhookUrl}`);

    try {
      const response = await axios.post(webhookUrl, webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      logger.info(`OnePipe Mock: Webhook delivered successfully`, {
        webhook_type,
        status: response.status,
      });

      res.status(200).json({
        success: true,
        message: `${webhook_type} webhook sent successfully`,
        webhook_payload: webhookPayload,
        response_status: response.status,
      });
    } catch (error: any) {
      logger.error(`OnePipe Mock: Webhook delivery failed`, error);

      res.status(500).json({
        success: false,
        message: 'Failed to send webhook to TrustRail',
        error: error.message || 'Unknown error occurred',
        webhook_payload: webhookPayload,
      });
    }
  } catch (error: any) {
    logger.error('OnePipe Mock trigger webhook error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * Get mock data (for debugging)
 * GET /onepipe-mock/data
 */
export const getMockData = (_req: Request, res: Response): void => {
  res.status(200).json({
    merchants: Array.from(mockMerchants.entries()).map(([ref, data]) => ({
      request_ref: ref,
      ...data,
    })),
    mandates: Array.from(mockMandates.entries()).map(([ref, data]) => ({
      mandate_ref: ref,
      ...data,
    })),
    virtualAccounts: Array.from(mockVirtualAccounts.entries()).map(([billerCode, account]) => ({
      biller_code: billerCode,
      virtual_account_number: account,
    })),
  });
};

/**
 * Reset mock data (for testing)
 * POST /onepipe-mock/reset
 */
export const resetMockData = (_req: Request, res: Response): void => {
  mockMerchants.clear();
  mockMandates.clear();
  mockVirtualAccounts.clear();

  logger.info('OnePipe Mock: All mock data cleared');

  res.status(200).json({
    success: true,
    message: 'All mock data cleared',
  });
};
