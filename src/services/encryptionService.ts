import crypto from 'crypto';
import bcrypt from 'bcrypt';
import env from '../config/environment';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Encrypt data using TripleDES for PWA API
 * As per OnePipe documentation:
 * 1. Convert CLIENT SECRET (not TRIPLE_DES_KEY) to UTF-16LE
 * 2. MD5 hash the buffered key
 * 3. Extend 16-byte MD5 hash to 24 bytes by appending first 8 bytes
 * 4. Use zero IV
 *
 * IMPORTANT: OnePipe uses the CLIENT SECRET for encryption, not a separate key
 */
export const encryptForPWA = (plainText: string): string => {
  const algorithm = 'des-ede3-cbc';

  // Step 1: Convert CLIENT SECRET to UTF-16LE buffer
  // OnePipe docs: "Encrypt using Client application secret key"
  const bufferedKey = Buffer.from(env.pwaClientSecret, 'utf16le');

  // Step 2: MD5 hash the buffered key
  const md5Hash = crypto.createHash('md5').update(bufferedKey).digest();

  // Step 3: Extend 16-byte MD5 hash to 24 bytes by appending first 8 bytes
  const key = Buffer.concat([md5Hash, md5Hash.slice(0, 8)]);

  // Step 4: Use zero IV (8 bytes of zeros)
  const iv = Buffer.alloc(8, 0);

  // Encrypt the plaintext
  const cipher = crypto.createCipheriv(algorithm, key, iv).setAutoPadding(true);
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
