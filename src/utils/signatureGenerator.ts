import crypto from 'crypto';
import env from '../config/environment';

/**
 * Generate MD5 signature for PWA API requests
 * Formula: MD5(request_ref + ";" + client_secret)
 * As per OnePipe API documentation
 */
export const generatePWASignature = (requestRef: string): string => {
  const data = `${requestRef};${env.pwaClientSecret}`;
  return crypto.createHash('md5').update(data).digest('hex');
};

/**
 * Verify PWA webhook signature
 */
export const verifyPWAWebhookSignature = (requestRef: string, receivedSignature: string): boolean => {
  const expectedSignature = generatePWASignature(requestRef);
  return expectedSignature === receivedSignature;
};

/**
 * Generate HMAC-SHA256 signature for business webhooks
 */
export const generateBusinessWebhookSignature = (payload: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
};

/**
 * Verify business webhook signature
 */
export const verifyBusinessWebhookSignature = (
  payload: string,
  secret: string,
  receivedSignature: string
): boolean => {
  const expectedSignature = generateBusinessWebhookSignature(payload, secret);
  return expectedSignature === receivedSignature;
};

export default {
  generatePWASignature,
  verifyPWAWebhookSignature,
  generateBusinessWebhookSignature,
  verifyBusinessWebhookSignature,
};
