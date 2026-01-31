import { Request, Response, NextFunction } from 'express';
import Business from '../models/Business';
import { processWebhook } from '../services/pwaWebhookService';
import { generateWebhookSecret } from '../utils/idGenerator';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Configure business webhook URL for receiving notifications
 * POST /api/webhooks/configure
 */
export const configure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessId = req.businessId!;
    const { webhookUrl } = req.body;

    // Find business
    const business = await Business.findOne({ businessId });
    if (!business) {
      res.status(404).json(
        ResponseFormatter.error('Business not found')
      );
      return;
    }

    // Validate URL format (basic validation)
    try {
      new URL(webhookUrl);
    } catch (error) {
      res.status(400).json(
        ResponseFormatter.error('Invalid webhook URL format')
      );
      return;
    }

    // Generate webhook secret if not exists
    if (!business.webhookSecret) {
      business.webhookSecret = generateWebhookSecret();
    }

    // Update webhook URL
    business.webhookUrl = webhookUrl;
    await business.save();

    res.status(200).json(
      ResponseFormatter.success(
        {
          webhookUrl: business.webhookUrl,
          webhookSecret: business.webhookSecret,
        },
        'Webhook configured successfully'
      )
    );
  } catch (error: any) {
    logger.error('Configure webhook controller error:', error);
    next(error);
  }
};

/**
 * Receive webhooks from PWA (payment notifications)
 * POST /webhooks/pwa
 */
export const receivePWAWebhook = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    // Process webhook asynchronously
    await processWebhook(req.body);

    // Always return 200 OK to PWA (even if processing fails)
    // We log errors internally for debugging
    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error: any) {
    logger.error('Receive PWA webhook controller error:', error);

    // Still return 200 to PWA to prevent retries
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
    });
  }
};
