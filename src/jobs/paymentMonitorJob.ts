import PaymentTransaction from '../models/PaymentTransaction';
import Application from '../models/Application';
import { sendWebhook } from '../services/webhookService';
import { logSystemAction } from '../services/auditService';
import logger from '../config/logger';

/**
 * Payment Monitor Background Job
 * Checks for overdue payments and detects defaulted applications
 * Runs every 5 minutes (configurable)
 */
export const runPaymentMonitorJob = async (): Promise<void> => {
  try {
    logger.info('Payment monitor job started');

    const now = new Date();

    // 1. Find overdue scheduled payments
    const overduePayments = await PaymentTransaction.find({
      status: 'SCHEDULED',
      scheduledDate: { $lt: now },
    });

    if (overduePayments.length > 0) {
      logger.warn(`Found ${overduePayments.length} overdue scheduled payments`);

      // For MVP: Just log warnings
      // Future: Can trigger automatic payment via PWA or send reminders
      for (const payment of overduePayments) {
        logger.warn(`Overdue payment: ${payment.transactionId}, scheduled for ${payment.scheduledDate}`);
      }
    }

    // 2. Check for defaulted applications (3+ failed payments)
    const activeApplications = await Application.find({ status: 'ACTIVE' });

    for (const application of activeApplications) {
      try {
        // Count failed payments for this application
        const failedPaymentCount = await PaymentTransaction.countDocuments({
          applicationId: application.applicationId,
          status: 'FAILED',
        });

        // If 3 or more failed payments, mark as defaulted
        if (failedPaymentCount >= 3) {
          logger.warn(`Application ${application.applicationId} has ${failedPaymentCount} failed payments - marking as DEFAULTED`);

          // Update application status
          application.status = 'DEFAULTED';
          await application.save();

          // Send webhook to business
          await sendWebhook(application.businessId, 'application.defaulted', {
            event: 'application.defaulted',
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            failedPaymentCount,
            outstandingBalance: application.outstandingBalance,
            paymentsCompleted: application.paymentsCompleted,
            totalPayments: application.installmentCount,
          });

          // Log audit
          await logSystemAction(
            'application.defaulted',
            'Application',
            application.applicationId,
            undefined,
            {
              failedPaymentCount,
              outstandingBalance: application.outstandingBalance,
            }
          );

          logger.info(`Application ${application.applicationId} marked as DEFAULTED`);
        }
      } catch (error: any) {
        logger.error(`Error checking application ${application.applicationId} for defaults:`, error);
        // Continue with other applications
      }
    }

    // 3. Monitor mandate activation delays (> 48 hours)
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const stuckMandates = await Application.find({
      status: 'MANDATE_CREATED',
      createdAt: { $lt: twoDaysAgo },
    });

    if (stuckMandates.length > 0) {
      logger.warn(`Found ${stuckMandates.length} mandates stuck in MANDATE_CREATED for > 48 hours`);

      for (const application of stuckMandates) {
        logger.warn(
          `Stuck mandate: Application ${application.applicationId}, created ${application.createdAt}, mandate ref: ${application.pwaMandateRef}`
        );
        // Future: Can alert admin for manual check
      }
    }

    logger.info('Payment monitor job completed');
  } catch (error: any) {
    logger.error('Payment monitor job error:', error);
    // Don't throw - let job continue running
  }
};
