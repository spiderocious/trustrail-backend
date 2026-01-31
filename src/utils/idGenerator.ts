/**
 * Generate unique IDs for different entities
 * Format: PREFIX-{timestamp}-{random}
 */

/**
 * Generate Business ID
 * Format: TR-BIZ-{timestamp}
 */
export const generateBusinessId = (): string => {
  const timestamp = Date.now();
  return `TR-BIZ-${timestamp}`;
};

/**
 * Generate TrustWallet ID
 * Format: TW-{timestamp}
 */
export const generateTrustWalletId = (): string => {
  const timestamp = Date.now();
  return `TW-${timestamp}`;
};

/**
 * Generate Application ID
 * Format: APP-{timestamp}
 */
export const generateApplicationId = (): string => {
  const timestamp = Date.now();
  return `APP-${timestamp}`;
};

/**
 * Generate Trust Engine Output ID
 * Format: TEO-{timestamp}
 */
export const generateTrustEngineOutputId = (): string => {
  const timestamp = Date.now();
  return `TEO-${timestamp}`;
};

/**
 * Generate Transaction ID
 * Format: TXN-{timestamp}
 */
export const generateTransactionId = (): string => {
  const timestamp = Date.now();
  return `TXN-${timestamp}`;
};

/**
 * Generate Withdrawal ID
 * Format: WD-{timestamp}
 */
export const generateWithdrawalId = (): string => {
  const timestamp = Date.now();
  return `WD-${timestamp}`;
};

/**
 * Generate PWA Webhook Log ID
 * Format: PWAL-{timestamp}
 */
export const generatePWAWebhookLogId = (): string => {
  const timestamp = Date.now();
  return `PWAL-${timestamp}`;
};

/**
 * Generate Business Webhook Log ID
 * Format: BWL-{timestamp}
 */
export const generateBusinessWebhookLogId = (): string => {
  const timestamp = Date.now();
  return `BWL-${timestamp}`;
};

/**
 * Generate Audit Log ID
 * Format: AUD-{timestamp}
 */
export const generateAuditLogId = (): string => {
  const timestamp = Date.now();
  return `AUD-${timestamp}`;
};

/**
 * Generate PWA Request Reference
 * Format: TR-REQ-{timestamp}
 */
export const generatePWARequestRef = (): string => {
  const timestamp = Date.now();
  return `TR-REQ-${timestamp}`;
};

/**
 * Generate random string for webhook secrets
 */
export const generateWebhookSecret = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
};
