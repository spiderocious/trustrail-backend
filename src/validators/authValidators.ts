import { body } from 'express-validator';

/**
 * Validation rules for business registration
 */
export const registerValidation = [
  body('businessName')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Business name must be between 2 and 200 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^234\d{10}$/)
    .withMessage('Phone number must be in Nigerian format (234XXXXXXXXXX)'),

  body('rcNumber')
    .trim()
    .notEmpty()
    .withMessage('RC number is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('RC number must be between 2 and 50 characters'),

  body('settlementAccountNumber')
    .trim()
    .notEmpty()
    .withMessage('Settlement account number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be exactly 10 digits')
    .isNumeric()
    .withMessage('Account number must contain only numbers'),

  body('settlementBankCode')
    .trim()
    .notEmpty()
    .withMessage('Settlement bank code is required')
    .isLength({ min: 3, max: 3 })
    .withMessage('Bank code must be exactly 3 digits')
    .isNumeric()
    .withMessage('Bank code must contain only numbers'),

  body('settlementAccountName')
    .trim()
    .notEmpty()
    .withMessage('Settlement account name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Account name must be between 2 and 200 characters'),
];

/**
 * Validation rules for business login
 */
export const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Validation rules for admin login
 */
export const adminLoginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required'),
];
