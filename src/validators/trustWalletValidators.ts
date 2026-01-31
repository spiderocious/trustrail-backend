import { body } from 'express-validator';

/**
 * Validation rules for creating a TrustWallet
 */
export const createTrustWalletValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('TrustWallet name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  // Installment Plan validation
  body('installmentPlan')
    .notEmpty()
    .withMessage('Installment plan is required')
    .isObject()
    .withMessage('Installment plan must be an object'),

  body('installmentPlan.totalAmount')
    .notEmpty()
    .withMessage('Total amount is required')
    .isNumeric()
    .withMessage('Total amount must be a number')
    .custom((value) => value > 0)
    .withMessage('Total amount must be greater than 0'),

  body('installmentPlan.downPaymentPercentage')
    .notEmpty()
    .withMessage('Down payment percentage is required')
    .isNumeric()
    .withMessage('Down payment percentage must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Down payment percentage must be between 0 and 100'),

  body('installmentPlan.installmentCount')
    .notEmpty()
    .withMessage('Installment count is required')
    .isInt({ min: 1 })
    .withMessage('Installment count must be at least 1'),

  body('installmentPlan.frequency')
    .notEmpty()
    .withMessage('Frequency is required')
    .isIn(['weekly', 'monthly'])
    .withMessage('Frequency must be either "weekly" or "monthly"'),

  body('installmentPlan.interestRate')
    .optional()
    .isNumeric()
    .withMessage('Interest rate must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Interest rate must be between 0 and 100'),

  // Approval Workflow validation
  body('approvalWorkflow')
    .notEmpty()
    .withMessage('Approval workflow is required')
    .isObject()
    .withMessage('Approval workflow must be an object'),

  body('approvalWorkflow.autoApproveThreshold')
    .notEmpty()
    .withMessage('Auto-approve threshold is required')
    .isNumeric()
    .withMessage('Auto-approve threshold must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Auto-approve threshold must be between 0 and 100'),

  body('approvalWorkflow.autoDeclineThreshold')
    .notEmpty()
    .withMessage('Auto-decline threshold is required')
    .isNumeric()
    .withMessage('Auto-decline threshold must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Auto-decline threshold must be between 0 and 100'),

  body('approvalWorkflow.minTrustScore')
    .notEmpty()
    .withMessage('Minimum trust score is required')
    .isNumeric()
    .withMessage('Minimum trust score must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Minimum trust score must be between 0 and 100'),

  // Custom validation: autoApproveThreshold must be > autoDeclineThreshold
  body('approvalWorkflow').custom((workflow) => {
    if (workflow.autoApproveThreshold <= workflow.autoDeclineThreshold) {
      throw new Error('Auto-approve threshold must be greater than auto-decline threshold');
    }
    return true;
  }),

  // Custom validation: minTrustScore must be <= autoApproveThreshold
  body('approvalWorkflow').custom((workflow) => {
    if (workflow.minTrustScore > workflow.autoApproveThreshold) {
      throw new Error('Minimum trust score cannot exceed auto-approve threshold');
    }
    return true;
  }),
];

/**
 * Validation rules for updating a TrustWallet
 * Same as create but all fields are optional
 */
export const updateTrustWalletValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Name must be between 2 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('installmentPlan')
    .optional()
    .isObject()
    .withMessage('Installment plan must be an object'),

  body('installmentPlan.totalAmount')
    .optional()
    .isNumeric()
    .withMessage('Total amount must be a number')
    .custom((value) => value > 0)
    .withMessage('Total amount must be greater than 0'),

  body('installmentPlan.downPaymentPercentage')
    .optional()
    .isNumeric()
    .withMessage('Down payment percentage must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Down payment percentage must be between 0 and 100'),

  body('installmentPlan.installmentCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Installment count must be at least 1'),

  body('installmentPlan.frequency')
    .optional()
    .isIn(['weekly', 'monthly'])
    .withMessage('Frequency must be either "weekly" or "monthly"'),

  body('installmentPlan.interestRate')
    .optional()
    .isNumeric()
    .withMessage('Interest rate must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Interest rate must be between 0 and 100'),

  body('approvalWorkflow')
    .optional()
    .isObject()
    .withMessage('Approval workflow must be an object'),

  body('approvalWorkflow.autoApproveThreshold')
    .optional()
    .isNumeric()
    .withMessage('Auto-approve threshold must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Auto-approve threshold must be between 0 and 100'),

  body('approvalWorkflow.autoDeclineThreshold')
    .optional()
    .isNumeric()
    .withMessage('Auto-decline threshold must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Auto-decline threshold must be between 0 and 100'),

  body('approvalWorkflow.minTrustScore')
    .optional()
    .isNumeric()
    .withMessage('Minimum trust score must be a number')
    .custom((value) => value >= 0 && value <= 100)
    .withMessage('Minimum trust score must be between 0 and 100'),
];
