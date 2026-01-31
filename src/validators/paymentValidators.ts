import { query, body } from 'express-validator';

/**
 * Validation for payment listing query parameters
 */
export const listPaymentsValidation = [
  query('trustWalletId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('TrustWallet ID must not be empty'),

  query('applicationId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Application ID must not be empty'),

  query('status')
    .optional()
    .isIn(['SCHEDULED', 'PENDING', 'SUCCESSFUL', 'FAILED'])
    .withMessage('Status must be one of: SCHEDULED, PENDING, SUCCESSFUL, FAILED'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validation for withdrawal request
 */
export const createWithdrawalValidation = [
  body('trustWalletId')
    .trim()
    .notEmpty()
    .withMessage('TrustWallet ID is required'),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => value > 0)
    .withMessage('Amount must be greater than 0'),
];

/**
 * Validation for withdrawal listing query parameters
 */
export const listWithdrawalsValidation = [
  query('trustWalletId')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('TrustWallet ID must not be empty'),

  query('status')
    .optional()
    .isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
    .withMessage('Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
