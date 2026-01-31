import { Router } from 'express';
import {
  testCreateMerchant,
  testCreateMandate,
  testSendInvoice,
  testGenerateSignature,
  testVerifyWebhookSignature,
  testEncryption,
  getPWAConfig,
} from '../controllers/pwaTestController';

const router = Router();

/**
 * PWA Test Routes
 * Direct access to PWA service methods for testing
 *
 * IMPORTANT: These routes should be disabled in production or protected
 */

/**
 * GET /pwa-test/config
 * Get current PWA configuration (without secrets)
 */
router.get('/config', getPWAConfig);

/**
 * POST /pwa-test/create-merchant
 * Test merchant creation directly
 */
router.post('/create-merchant', testCreateMerchant);

/**
 * POST /pwa-test/create-mandate
 * Test mandate creation directly
 */
router.post('/create-mandate', testCreateMandate);

/**
 * POST /pwa-test/send-invoice
 * Test installment invoice sending directly
 */
router.post('/send-invoice', testSendInvoice);

/**
 * POST /pwa-test/generate-signature
 * Test signature generation
 */
router.post('/generate-signature', testGenerateSignature);

/**
 * POST /pwa-test/verify-webhook-signature
 * Test webhook signature verification
 */
router.post('/verify-webhook-signature', testVerifyWebhookSignature);

/**
 * POST /pwa-test/test-encryption
 * Test account credentials and BVN encryption
 */
router.post('/test-encryption', testEncryption);

export default router;
