import { runStatementAnalysisJob } from './statementAnalysisJob';
import { runPaymentMonitorJob } from './paymentMonitorJob';
import env from '../config/environment';
import logger from '../config/logger';

/**
 * Start all background jobs
 * Called from server.ts after database connection
 */
export const startBackgroundJobs = (): void => {
  logger.info('Starting background jobs...');

  // Statement Analysis Job - Process pending applications
  const statementAnalysisInterval = setInterval(async () => {
    try {
      await runStatementAnalysisJob();
    } catch (error: any) {
      logger.error('Statement analysis job error:', error);
      // Don't crash server - just log error
    }
  }, env.statementAnalysisJobInterval);

  logger.info(`Statement analysis job started (interval: ${env.statementAnalysisJobInterval}ms)`);

  // Payment Monitor Job - Check for overdue payments and defaults
  const paymentMonitorInterval = setInterval(async () => {
    try {
      await runPaymentMonitorJob();
    } catch (error: any) {
      logger.error('Payment monitor job error:', error);
      // Don't crash server - just log error
    }
  }, env.paymentMonitorJobInterval);

  logger.info(`Payment monitor job started (interval: ${env.paymentMonitorJobInterval}ms)`);

  logger.info('Background jobs started successfully');

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, stopping background jobs...');
    clearInterval(statementAnalysisInterval);
    clearInterval(paymentMonitorInterval);
    logger.info('Background jobs stopped');
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, stopping background jobs...');
    clearInterval(statementAnalysisInterval);
    clearInterval(paymentMonitorInterval);
    logger.info('Background jobs stopped');
  });
};
