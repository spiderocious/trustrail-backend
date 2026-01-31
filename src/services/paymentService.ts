import PaymentTransaction, { IPaymentTransaction } from '../models/PaymentTransaction';
import Application, { IApplication } from '../models/Application';
import { generateTransactionId } from '../utils/idGenerator';
import { addDaysToDate, addMonthsToDate } from '../utils/dateUtils';
import { logSystemAction } from './auditService';
import logger from '../config/logger';

/**
 * Create a payment transaction for an application
 * Called by payment monitor job to schedule installment payments
 */
export const createPaymentTransaction = async (
  application: IApplication,
  paymentNumber: number
): Promise<IPaymentTransaction> => {
  try {
    // Generate transaction ID
    const transactionId = generateTransactionId();

    // Calculate scheduled date based on frequency
    let scheduledDate: Date;
    const baseDate = application.mandateActivatedAt || new Date();

    if (application.frequency === 'weekly') {
      // Add (paymentNumber - 1) weeks to mandate activation date
      scheduledDate = addDaysToDate(baseDate, (paymentNumber - 1) * 7);
    } else {
      // Monthly frequency: Add (paymentNumber - 1) months
      scheduledDate = addMonthsToDate(baseDate, paymentNumber - 1);
    }

    // Create payment transaction
    const paymentTransaction = await PaymentTransaction.create({
      transactionId,
      applicationId: application.applicationId,
      trustWalletId: application.trustWalletId,
      businessId: application.businessId,
      amount: application.installmentAmount,
      status: 'SCHEDULED',
      paymentNumber,
      totalPayments: application.installmentCount,
      scheduledDate,
      pwaTransactionRef: transactionId, // We'll use this as reference when sending to PWA
    });

    logger.info(`Payment transaction created: ${transactionId} for application ${application.applicationId}, payment ${paymentNumber}/${application.installmentCount}`);

    return paymentTransaction;
  } catch (error: any) {
    logger.error('Error creating payment transaction:', error);
    throw new Error(`Failed to create payment transaction: ${error.message}`);
  }
};

/**
 * Update payment transaction status
 * Called when PWA webhook is received (debit event)
 */
export const updatePaymentStatus = async (
  transactionId: string,
  status: 'SUCCESSFUL' | 'FAILED',
  paidDate?: Date,
  pwaPaymentId?: string,
  failureReason?: string
): Promise<IPaymentTransaction> => {
  try {
    // Find payment transaction
    const payment = await PaymentTransaction.findOne({ transactionId });
    if (!payment) {
      throw new Error(`Payment transaction not found: ${transactionId}`);
    }

    // Update payment status
    payment.status = status;

    if (status === 'SUCCESSFUL' && paidDate) {
      payment.paidDate = paidDate;
      if (pwaPaymentId) {
        payment.pwaPaymentId = pwaPaymentId;
      }
    }

    if (status === 'FAILED' && failureReason) {
      payment.failureReason = failureReason;
    }

    await payment.save();

    // Update Application totals
    const application = await Application.findOne({ applicationId: payment.applicationId });
    if (!application) {
      throw new Error(`Application not found: ${payment.applicationId}`);
    }

    if (status === 'SUCCESSFUL') {
      // Increment payments completed
      application.paymentsCompleted = (application.paymentsCompleted || 0) + 1;

      // Add to total paid
      application.totalPaid = (application.totalPaid || 0) + payment.amount;

      // Reduce outstanding balance
      application.outstandingBalance = Math.max(0, application.outstandingBalance - payment.amount);

      // Check if this was the last payment
      if (application.paymentsCompleted >= application.installmentCount) {
        application.status = 'COMPLETED';
        application.completedAt = new Date();
        logger.info(`Application ${application.applicationId} completed - all payments received`);
      }

      await application.save();

      // Log audit
      await logSystemAction(
        'payment.success',
        'PaymentTransaction',
        transactionId,
        undefined,
        {
          applicationId: application.applicationId,
          amount: payment.amount,
          paymentNumber: payment.paymentNumber,
          totalPayments: payment.totalPayments,
        }
      );

      logger.info(`Payment ${transactionId} marked as SUCCESSFUL. Application ${application.applicationId} progress: ${application.paymentsCompleted}/${application.installmentCount}`);
    } else if (status === 'FAILED') {
      // Log audit for failed payment
      await logSystemAction(
        'payment.failed',
        'PaymentTransaction',
        transactionId,
        undefined,
        {
          applicationId: application.applicationId,
          amount: payment.amount,
          paymentNumber: payment.paymentNumber,
          failureReason,
        }
      );

      logger.warn(`Payment ${transactionId} marked as FAILED. Reason: ${failureReason}`);
    }

    return payment;
  } catch (error: any) {
    logger.error('Error updating payment status:', error);
    throw new Error(`Failed to update payment status: ${error.message}`);
  }
};

/**
 * Get all payments for a business with filters
 */
export const getPayments = async (
  businessId: string,
  filters: {
    trustWalletId?: string;
    applicationId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }
): Promise<{ payments: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { businessId };

    if (filters.trustWalletId) {
      query.trustWalletId = filters.trustWalletId;
    }

    if (filters.applicationId) {
      query.applicationId = filters.applicationId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.scheduledDate = {};
      if (filters.startDate) {
        query.scheduledDate.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.scheduledDate.$lte = filters.endDate;
      }
    }

    // Execute queries in parallel
    const [payments, totalCount] = await Promise.all([
      PaymentTransaction.find(query)
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentTransaction.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error: any) {
    logger.error('Error fetching payments:', error);
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }
};

/**
 * Get a single payment transaction by ID
 */
export const getPaymentById = async (
  transactionId: string,
  businessId: string
): Promise<IPaymentTransaction | null> => {
  try {
    const payment = await PaymentTransaction.findOne({ transactionId, businessId });
    return payment;
  } catch (error: any) {
    logger.error('Error fetching payment:', error);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};
