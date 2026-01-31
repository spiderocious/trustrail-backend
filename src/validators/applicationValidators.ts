import { body } from 'express-validator';

/**
 * Validation rules for customer application submission
 * Used in public routes for customers applying for installment plans
 */
export const createApplicationValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^234\d{10}$/)
    .withMessage('Phone number must be in Nigerian format (234XXXXXXXXXX)'),

  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be exactly 10 digits')
    .isNumeric()
    .withMessage('Account number must contain only numbers'),

  body('bankCode')
    .trim()
    .notEmpty()
    .withMessage('Bank code is required')
    .isLength({ min: 3, max: 3 })
    .withMessage('Bank code must be exactly 3 digits')
    .isNumeric()
    .withMessage('Bank code must contain only numbers'),

  body('bvn')
    .trim()
    .notEmpty()
    .withMessage('BVN is required')
    .isLength({ min: 11, max: 11 })
    .withMessage('BVN must be exactly 11 digits')
    .isNumeric()
    .withMessage('BVN must contain only numbers'),

  // Note: File validation (bankStatement) is handled by multer middleware, not express-validator
];

/**
 * Validation for manual approval/decline by business owner
 */
export const manualApproveValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];

export const manualDeclineValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];
