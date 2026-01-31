import { Router } from 'express';
import {
  transact,
  triggerWebhook,
  getMockData,
  resetMockData,
} from '../controllers/onepipeMockController';

const router = Router();

/**
 * OnePipe Mock Routes
 * Simulates OnePipe/PWA API endpoints for testing
 */

/**
 * POST /onepipe-mock/transact
 * Main endpoint that handles all OnePipe request types:
 * - create merchant
 * - create mandate
 * - send invoice
 */
router.post('/transact', transact);

/**
 * POST /onepipe-mock/trigger-webhook
 * Manually trigger webhooks to TrustRail
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
 *   "failure_reason": "string", // Optional, for failed debit
 *   "virtual_account": "1234567890" // For credit
 * }
 */
router.post('/trigger-webhook', triggerWebhook);

/**
 * GET /onepipe-mock/data
 * Get all mock data (for debugging)
 */
router.get('/data', getMockData);

/**
 * POST /onepipe-mock/reset
 * Clear all mock data (for testing)
 */
router.post('/reset', resetMockData);

export default router;
