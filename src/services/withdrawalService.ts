import Withdrawal, { IWithdrawal } from '../models/Withdrawal';
import TrustWallet from '../models/TrustWallet';
import PaymentTransaction from '../models/PaymentTransaction';
import Application from '../models/Application';
import { generateWithdrawalId } from '../utils/idGenerator';
import { logBusinessAction } from './auditService';
import logger from '../config/logger';

/**
 * Calculate available balance for a TrustWallet
 */
const calculateAvailableBalance = async (trustWalletId: string): Promise<number> => {
  try {
    // Get all successful payments for this TrustWallet
    const successfulPayments = await PaymentTransaction.find({
      trustWalletId,
      status: 'SUCCESSFUL',
    });

    const totalCollected = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Get all down payments received for applications in this TrustWallet
    const applications = await Application.find({
      trustWalletId,
      downPaymentReceived: true,
    });

    const totalDownPayments = applications.reduce(
      (sum, app) => sum + (app.downPaymentAmount || 0),
      0
    );

    // Get all completed/processing withdrawals
    const withdrawals = await Withdrawal.find({
      trustWalletId,
      status: { $in: ['COMPLETED', 'PROCESSING'] },
    });

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Available balance = (installments + down payments) - withdrawn
    const availableBalance = totalCollected + totalDownPayments - totalWithdrawn;

    return Math.max(0, availableBalance);
  } catch (error: any) {
    logger.error('Error calculating available balance:', error);
    throw error;
  }
};

/**
 * Request withdrawal of collected funds
 */
export const requestWithdrawal = async (
  businessId: string,
  businessEmail: string,
  trustWalletId: string,
  amount: number
): Promise<IWithdrawal> => {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than 0');
    }

    // Verify TrustWallet ownership
    const trustWallet = await TrustWallet.findOne({ trustWalletId, businessId });
    if (!trustWallet) {
      throw new Error('TrustWallet not found or does not belong to this business');
    }

    // Calculate available balance
    const availableBalance = await calculateAvailableBalance(trustWalletId);

    // Validate amount does not exceed available balance
    if (amount > availableBalance) {
      throw new Error(
        `Insufficient balance. Available: ₦${availableBalance.toFixed(2)}, Requested: ₦${amount.toFixed(2)}`
      );
    }

    // Generate withdrawal ID
    const withdrawalId = generateWithdrawalId();

    // Create withdrawal record
    const withdrawal = await Withdrawal.create({
      withdrawalId,
      trustWalletId,
      businessId,
      amount,
      status: 'PENDING',
      requestedAt: new Date(),
    });

    // Log audit
    await logBusinessAction(
      'withdrawal.request',
      businessId,
      businessEmail,
      'Withdrawal',
      withdrawalId,
      undefined,
      {
        trustWalletId,
        amount,
        availableBalance,
      }
    );

    logger.info(`Withdrawal requested: ${withdrawalId} for business ${businessId}, amount: ₦${amount}`);

    return withdrawal;
  } catch (error: any) {
    logger.error('Error requesting withdrawal:', error);
    throw new Error(`Failed to request withdrawal: ${error.message}`);
  }
};

/**
 * Get withdrawals for a business with filters
 */
export const getWithdrawals = async (
  businessId: string,
  filters: {
    trustWalletId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ withdrawals: any[]; totalCount: number; availableBalance?: number }> => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { businessId };

    if (filters.trustWalletId) {
      query.trustWalletId = filters.trustWalletId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    // Execute queries in parallel
    const [withdrawals, totalCount] = await Promise.all([
      Withdrawal.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Withdrawal.countDocuments(query),
    ]);

    // If filtering by specific TrustWallet, include available balance
    let availableBalance: number | undefined;
    if (filters.trustWalletId) {
      availableBalance = await calculateAvailableBalance(filters.trustWalletId);
    }

    return { withdrawals, totalCount, availableBalance };
  } catch (error: any) {
    logger.error('Error fetching withdrawals:', error);
    throw new Error(`Failed to fetch withdrawals: ${error.message}`);
  }
};

/**
 * Get a single withdrawal by ID
 */
export const getWithdrawalById = async (
  withdrawalId: string,
  businessId: string
): Promise<IWithdrawal | null> => {
  try {
    const withdrawal = await Withdrawal.findOne({ withdrawalId, businessId });
    return withdrawal;
  } catch (error: any) {
    logger.error('Error fetching withdrawal:', error);
    throw new Error(`Failed to fetch withdrawal: ${error.message}`);
  }
};

/**
 * Update withdrawal status (Admin only)
 * NOTE: This is for admin to mark withdrawals as processing/completed/failed
 */
export const updateWithdrawalStatus = async (
  withdrawalId: string,
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
): Promise<IWithdrawal> => {
  try {
    const withdrawal = await Withdrawal.findOne({ withdrawalId });
    if (!withdrawal) {
      throw new Error(`Withdrawal not found: ${withdrawalId}`);
    }

    withdrawal.status = status;

    if (status === 'PROCESSING') {
      withdrawal.processedAt = new Date();
    } else if (status === 'COMPLETED') {
      withdrawal.completedAt = new Date();
    }

    await withdrawal.save();

    logger.info(`Withdrawal ${withdrawalId} status updated to ${status}`);

    return withdrawal;
  } catch (error: any) {
    logger.error('Error updating withdrawal status:', error);
    throw new Error(`Failed to update withdrawal status: ${error.message}`);
  }
};

/**
 * Get available balance for a TrustWallet
 * Exported for use in other services
 */
export const getAvailableBalance = async (trustWalletId: string): Promise<number> => {
  return calculateAvailableBalance(trustWalletId);
};
