import crypto from 'crypto';
import bcrypt from 'bcrypt';
import env from '../config/environment';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Encrypt data using TripleDES for PWA API
 */
export const encryptForPWA = (plainText: string): string => {
  const algorithm = 'des-ede3-cbc';
  const key = Buffer.from(env.tripleDesKey);

  // Validate key length (must be exactly 24 bytes for TripleDES)
  if (key.length !== 24) {
    throw new Error('TripleDES key must be exactly 24 bytes');
  }
  const iv = crypto.randomBytes(8);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return encrypted;
};

/**
 * Encrypt customer account credentials for PWA
 * Format: accountNumber;bankCode
 */
export const encryptAccountCredentials = (accountNumber: string, bankCode: string): string => {
  const plainText = `${accountNumber};${bankCode}`;
  return encryptForPWA(plainText);
};

/**
 * Encrypt BVN for PWA
 */
export const encryptBVN = (bvn: string): string => {
  return encryptForPWA(bvn);
};

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

/**
 * Compare password with hash using bcrypt
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export default {
  encryptForPWA,
  encryptAccountCredentials,
  encryptBVN,
  hashPassword,
  comparePassword,
};
