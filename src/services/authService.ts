import jwt from 'jsonwebtoken';
import Business from '../models/Business';
import { generateBusinessId } from '../utils/idGenerator';
import { hashPassword, comparePassword } from './encryptionService';
import { createMerchant } from './pwaService';
import { logBusinessAction } from './auditService';
import env from '../config/environment';
import logger from '../config/logger';

export interface RegisterBusinessData {
  businessName: string;
  email: string;
  password: string;
  phoneNumber: string;
  rcNumber: string;
  settlementAccountNumber: string;
  settlementBankCode: string;
  settlementAccountName: string;
}

export interface AuthResponse {
  token: string;
  businessId: string;
  businessName: string;
  email: string;
  billerCode?: string;
}

/**
 * Register new business
 */
export const registerBusiness = async (data: RegisterBusinessData): Promise<AuthResponse> => {
  // Check if email already exists
  const existingEmail = await Business.findOne({ email: data.email });
  if (existingEmail) {
    throw new Error('Email already registered');
  }

  // Check if RC number already exists
  const existingRC = await Business.findOne({ rcNumber: data.rcNumber });
  if (existingRC) {
    throw new Error('RC number already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(data.password);

  // Generate business ID
  const businessId = generateBusinessId();

  // Create business record
  const business = new Business({
    businessId,
    businessName: data.businessName,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    phoneNumber: data.phoneNumber,
    rcNumber: data.rcNumber,
    settlementAccountNumber: data.settlementAccountNumber,
    settlementBankCode: data.settlementBankCode,
    settlementAccountName: data.settlementAccountName,
    isActive: true,
  });

  // Create merchant on PWA
  try {
    const pwaResult = await createMerchant({
      businessName: data.businessName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      rcNumber: data.rcNumber,
      settlementAccountNumber: data.settlementAccountNumber,
      settlementBankCode: data.settlementBankCode,
      settlementAccountName: data.settlementAccountName,
    });

    business.billerCode = pwaResult.billerCode;
    business.pwaMerchantId = pwaResult.merchantId;
  } catch (error: any) {
    logger.error('Failed to create PWA merchant during registration:', error);
    throw new Error(`Registration failed: ${error.message}`);
  }

  // Save business
  await business.save();

  // Generate JWT
  const token = generateToken(businessId, data.email);

  // Log audit
  await logBusinessAction(
    'business.register',
    businessId,
    data.email,
    'Business',
    businessId
  );

  logger.info(`Business registered: ${data.email} (${businessId})`);

  return {
    token,
    businessId,
    businessName: data.businessName,
    email: data.email,
    billerCode: business.billerCode,
  };
};

/**
 * Login business
 */
export const loginBusiness = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  // Find business by email
  const business = await Business.findOne({ email: email.toLowerCase() });
  if (!business) {
    throw new Error('Invalid email or password');
  }

  // Check if active
  if (!business.isActive) {
    throw new Error('Account is inactive');
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, business.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Generate JWT
  const token = generateToken(business.businessId, business.email);

  logger.info(`Business logged in: ${business.email} (${business.businessId})`);

  return {
    token,
    businessId: business.businessId,
    businessName: business.businessName,
    email: business.email,
    billerCode: business.billerCode,
  };
};

/**
 * Generate JWT token
 */
export const generateToken = (businessId: string, email: string): string => {
  const payload = {
    businessId,
    email,
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: '30d', // 30 days
  });

  return token;
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): { businessId: string; email: string } => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      businessId: string;
      email: string;
    };
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate admin JWT token
 */
export const generateAdminToken = (email: string): string => {
  const payload = {
    role: 'admin',
    email,
  };

  const token = jwt.sign(payload, env.adminJwtSecret, {
    expiresIn: '24h', // 24 hours
  });

  return token;
};

/**
 * Verify admin JWT token
 */
export const verifyAdminToken = (token: string): { role: string; email: string } => {
  try {
    const decoded = jwt.verify(token, env.adminJwtSecret) as {
      role: string;
      email: string;
    };
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired admin token');
  }
};

/**
 * Admin login
 */
export const loginAdmin = async (email: string, password: string): Promise<{ token: string }> => {
  // Check against environment variables
  if (email !== env.adminEmail || password !== env.adminPassword) {
    throw new Error('Invalid admin credentials');
  }

  const token = generateAdminToken(email);

  logger.info(`Admin logged in: ${email}`);

  return { token };
};

export default {
  registerBusiness,
  loginBusiness,
  generateToken,
  verifyToken,
  generateAdminToken,
  verifyAdminToken,
  loginAdmin,
};
