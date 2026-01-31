import { Router } from 'express';
import { configure, receivePWAWebhook } from '../controllers/webhookController';
import authMiddleware from '../middleware/authMiddleware';
import { body } from 'express-validator';
import { validationMiddleware } from '../middleware/validationMiddleware';

const router = Router();

/**
 * POST /api/webhooks/configure - Configure business webhook URL
 * Requires authentication
 */
router.post(
  '/configure',
  authMiddleware,
  [
    body('webhookUrl')
      .trim()
      .notEmpty()
      .withMessage('Webhook URL is required')
      .isURL()
      .withMessage('Must be a valid URL'),
  ],
  validationMiddleware,
  configure
);

/**
 * POST /webhooks/pwa - Receive webhooks from PWA
 * No authentication (verified by signature)
 */
router.post('/pwa', receivePWAWebhook);

export default router;
