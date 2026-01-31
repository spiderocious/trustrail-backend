import axios from 'axios';
import Business from '../models/Business';
import BusinessWebhookLog from '../models/BusinessWebhookLog';
import { generateBusinessWebhookLogId } from '../utils/idGenerator';
import { generateBusinessWebhookSignature } from '../utils/signatureGenerator';
import logger from '../config/logger';

/**
 * Send webhook to business owner
 * Called after significant events (application approved, payment received, etc.)
 */
export const sendWebhook = async (
  businessId: string,
  event: string,
  payload: any
): Promise<boolean> => {
  try {
    // Find business
    const business = await Business.findOne({ businessId });
    if (!business) {
      throw new Error(`Business not found: ${businessId}`);
    }

    // Check if webhook URL is configured
    if (!business.webhookUrl) {
      logger.debug(`No webhook URL configured for business ${businessId}, skipping webhook`);
      return false;
    }

    // Generate log ID
    const logId = generateBusinessWebhookLogId();

    // Convert payload to JSON string for signature generation
    const payloadString = JSON.stringify(payload);

    // Generate webhook signature if secret exists
    let signature: string | undefined;
    if (business.webhookSecret) {
      signature = generateBusinessWebhookSignature(payloadString, business.webhookSecret);
    }

    // Create webhook log record (status: pending)
    const webhookLog = await BusinessWebhookLog.create({
      logId,
      businessId,
      event,
      payload,
      url: business.webhookUrl,
      status: 'pending',
      attempts: 0,
      sentAt: new Date(),
    });

    try {
      // Make POST request to business webhook URL
      const headers: any = {
        'Content-Type': 'application/json',
        'X-TrustRail-Event': event,
      };

      if (signature) {
        headers['X-TrustRail-Signature'] = signature;
      }

      const response = await axios.post(business.webhookUrl, payload, {
        headers,
        timeout: 5000, // 5 second timeout
        validateStatus: (status) => status >= 200 && status < 300,
      });

      // Update log status to delivered
      webhookLog.status = 'delivered';
      webhookLog.httpStatus = response.status;
      webhookLog.deliveredAt = new Date();
      await webhookLog.save();

      logger.info(`Webhook delivered successfully to ${business.businessName} (${businessId}): ${event}`);
      return true;
    } catch (error: any) {
      // Update log status to failed
      webhookLog.status = 'failed';
      webhookLog.httpStatus = error.response?.status;
      webhookLog.errorMessage = error.message;
      webhookLog.attempts = 1;
      await webhookLog.save();

      logger.error(`Webhook delivery failed for business ${businessId}, event ${event}:`, error.message);
      return false;
    }
  } catch (error: any) {
    logger.error('Error in sendWebhook:', error);
    return false;
  }
};

/**
 * Retry failed webhooks
 * NOTE: Not implemented in MVP - can be added later as a background job
 * For now, just returns 0
 */
export const retryFailedWebhooks = async (): Promise<number> => {
  try {
    // Find failed webhooks that should be retried
    const failedWebhooks = await BusinessWebhookLog.find({
      status: 'failed',
      attempts: { $lt: 4 }, // Max 4 attempts
    }).limit(50);

    let retriedCount = 0;

    for (const log of failedWebhooks) {
      try {
        // Find business
        const business = await Business.findOne({ businessId: log.businessId });
        if (!business || !business.webhookUrl) {
          continue;
        }

        // Convert payload to JSON string
        const payloadString = JSON.stringify(log.payload);

        // Generate signature
        let signature: string | undefined;
        if (business.webhookSecret) {
          signature = generateBusinessWebhookSignature(payloadString, business.webhookSecret);
        }

        // Retry webhook
        const headers: any = {
          'Content-Type': 'application/json',
          'X-TrustRail-Event': log.event,
        };

        if (signature) {
          headers['X-TrustRail-Signature'] = signature;
        }

        const response = await axios.post(business.webhookUrl, log.payload, {
          headers,
          timeout: 5000,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        // Update log status to delivered
        log.status = 'delivered';
        log.httpStatus = response.status;
        log.deliveredAt = new Date();
        log.attempts += 1;
        await log.save();

        retriedCount++;
        logger.info(`Webhook retry successful for log ${log.logId}`);
      } catch (error: any) {
        // Increment attempts
        log.attempts += 1;
        log.errorMessage = error.message;
        log.httpStatus = error.response?.status;
        await log.save();

        logger.warn(`Webhook retry failed for log ${log.logId}, attempt ${log.attempts}`);
      }
    }

    if (retriedCount > 0) {
      logger.info(`Retried ${retriedCount} failed webhooks`);
    }

    return retriedCount;
  } catch (error: any) {
    logger.error('Error in retryFailedWebhooks:', error);
    return 0;
  }
};

/**
 * Get webhook delivery logs for a business
 */
export const getWebhookLogs = async (
  businessId: string,
  filters: {
    event?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ logs: any[]; totalCount: number }> => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: any = { businessId };

    if (filters.event) {
      query.event = filters.event;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const [logs, totalCount] = await Promise.all([
      BusinessWebhookLog.find(query)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessWebhookLog.countDocuments(query),
    ]);

    return { logs, totalCount };
  } catch (error: any) {
    logger.error('Error fetching webhook logs:', error);
    throw new Error(`Failed to fetch webhook logs: ${error.message}`);
  }
};
