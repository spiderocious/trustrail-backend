import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  jwtSecret: string;
  adminJwtSecret: string;
  pwaBaseUrl: string;
  pwaApiKey: string;
  pwaClientSecret: string;
  adminEmail: string;
  adminPassword: string;
  statementAnalysisJobInterval: number;
  paymentMonitorJobInterval: number;
  pwaMockMode: string;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    return '';
  }
  return value;
};

export const env: EnvironmentConfig = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  mongodbUri: getEnvVar('MONGODB_URI'),
  jwtSecret: getEnvVar('JWT_SECRET'),
  adminJwtSecret: getEnvVar('ADMIN_JWT_SECRET'),
  pwaBaseUrl: getEnvVar('PWA_BASE_URL'),
  pwaApiKey: getEnvVar('PWA_API_KEY'),
  pwaClientSecret: getEnvVar('PWA_CLIENT_SECRET'),
  adminEmail: getEnvVar('ADMIN_EMAIL'),
  adminPassword: getEnvVar('ADMIN_PASSWORD'),
  statementAnalysisJobInterval: parseInt(
    getEnvVar('STATEMENT_ANALYSIS_JOB_INTERVAL', '60000'),
    10
  ),
  paymentMonitorJobInterval: parseInt(
    getEnvVar('PAYMENT_MONITOR_JOB_INTERVAL', '300000'),
    10
  ),
  pwaMockMode: getEnvVar('PWA_MOCK_MODE', 'Inspect'),
};

// Validate critical configurations

if (env.jwtSecret === env.adminJwtSecret) {
  throw new Error('JWT_SECRET and ADMIN_JWT_SECRET must be different');
}

if (env.jwtSecret.length < 32) {
  console.warn('⚠️  WARNING: JWT_SECRET should be at least 256 bits (32 characters) for security');
}

export default env;
