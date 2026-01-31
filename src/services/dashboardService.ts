import TrustWallet from '../models/TrustWallet';
import Application from '../models/Application';
import PaymentTransaction from '../models/PaymentTransaction';
import Withdrawal from '../models/Withdrawal';
import AuditLog from '../models/AuditLog';
import TrustEngineOutput from '../models/TrustEngineOutput';
import logger from '../config/logger';

interface BusinessOverviewResponse {
  trustWallets: {
    total: number;
    active: number;
  };
  applications: {
    total: number;
    approved: number;
    declined: number;
    pending: number;
    active: number;
    completed: number;
    flaggedForReview: number;
  };
  revenue: {
    totalCollected: number;
    outstandingBalance: number;
    availableForWithdrawal: number;
  };
  payments: {
    successfulCount: number;
    failedCount: number;
    successRate: number;
  };
  recentActivity: any[];
}

/**
 * Get overall business statistics and metrics
 */
export const getBusinessOverview = async (businessId: string): Promise<BusinessOverviewResponse> => {
  try {
    // Count TrustWallets
    const [totalTrustWallets, activeTrustWallets] = await Promise.all([
      TrustWallet.countDocuments({ businessId }),
      TrustWallet.countDocuments({ businessId, isActive: true }),
    ]);

    // Count Applications by status
    const [
      totalApplications,
      approvedApplications,
      declinedApplications,
      pendingApplications,
      activeApplications,
      completedApplications,
      flaggedApplications,
    ] = await Promise.all([
      Application.countDocuments({ businessId }),
      Application.countDocuments({ businessId, status: { $in: ['APPROVED', 'MANDATE_CREATED', 'MANDATE_ACTIVE'] } }),
      Application.countDocuments({ businessId, status: 'DECLINED' }),
      Application.countDocuments({ businessId, status: { $in: ['PENDING_ANALYSIS', 'ANALYZING'] } }),
      Application.countDocuments({ businessId, status: 'ACTIVE' }),
      Application.countDocuments({ businessId, status: 'COMPLETED' }),
      Application.countDocuments({ businessId, status: 'FLAGGED_FOR_REVIEW' }),
    ]);

    // Calculate revenue metrics
    const [successfulPayments, applications, withdrawals] = await Promise.all([
      PaymentTransaction.find({ businessId, status: 'SUCCESSFUL' }),
      Application.find({ businessId }),
      Withdrawal.find({ businessId, status: { $in: ['COMPLETED', 'PROCESSING'] } }),
    ]);

    const totalCollected = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Add down payments to total collected
    const downPayments = applications
      .filter((app) => app.downPaymentReceived)
      .reduce((sum, app) => sum + (app.downPaymentAmount || 0), 0);

    const finalTotalCollected = totalCollected + downPayments;

    const outstandingBalance = applications.reduce((sum, app) => sum + app.outstandingBalance, 0);

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    const availableForWithdrawal = finalTotalCollected - totalWithdrawn;

    // Calculate payment stats
    const [successfulPaymentCount, failedPaymentCount] = await Promise.all([
      PaymentTransaction.countDocuments({ businessId, status: 'SUCCESSFUL' }),
      PaymentTransaction.countDocuments({ businessId, status: 'FAILED' }),
    ]);

    const totalPaymentAttempts = successfulPaymentCount + failedPaymentCount;
    const successRate = totalPaymentAttempts > 0
      ? (successfulPaymentCount / totalPaymentAttempts) * 100
      : 0;

    // Get recent activity (last 10 audit logs)
    const recentActivity = await AuditLog.find({ 'actor.id': businessId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return {
      trustWallets: {
        total: totalTrustWallets,
        active: activeTrustWallets,
      },
      applications: {
        total: totalApplications,
        approved: approvedApplications,
        declined: declinedApplications,
        pending: pendingApplications,
        active: activeApplications,
        completed: completedApplications,
        flaggedForReview: flaggedApplications,
      },
      revenue: {
        totalCollected: finalTotalCollected,
        outstandingBalance,
        availableForWithdrawal: Math.max(0, availableForWithdrawal),
      },
      payments: {
        successfulCount: successfulPaymentCount,
        failedCount: failedPaymentCount,
        successRate: parseFloat(successRate.toFixed(2)),
      },
      recentActivity,
    };
  } catch (error: any) {
    logger.error('Error getting business overview:', error);
    throw new Error(`Failed to get business overview: ${error.message}`);
  }
};

interface TrustWalletAnalyticsResponse {
  trustWallet: {
    trustWalletId: string;
    name: string;
    isActive: boolean;
  };
  applications: {
    total: number;
    approved: number;
    declined: number;
    flagged: number;
    pending: number;
    active: number;
    completed: number;
    approvalRate: number;
  };
  trustScores: {
    average: number;
    min: number;
    max: number;
    distribution: {
      excellent: number; // 80-100
      good: number; // 60-79
      fair: number; // 40-59
      poor: number; // 0-39
    };
  };
  revenue: {
    totalCollected: number;
    outstandingBalance: number;
    totalExpected: number;
  };
  payments: {
    successfulCount: number;
    failedCount: number;
    successRate: number;
  };
}

/**
 * Get analytics for a specific TrustWallet
 */
export const getTrustWalletAnalytics = async (
  trustWalletId: string,
  businessId: string,
  dateRange?: { startDate?: Date; endDate?: Date }
): Promise<TrustWalletAnalyticsResponse> => {
  try {
    // Verify ownership
    const trustWallet = await TrustWallet.findOne({ trustWalletId, businessId });
    if (!trustWallet) {
      throw new Error('TrustWallet not found or does not belong to this business');
    }

    // Build application query with optional date range
    const appQuery: any = { trustWalletId };
    if (dateRange?.startDate || dateRange?.endDate) {
      appQuery.submittedAt = {};
      if (dateRange.startDate) {
        appQuery.submittedAt.$gte = dateRange.startDate;
      }
      if (dateRange.endDate) {
        appQuery.submittedAt.$lte = dateRange.endDate;
      }
    }

    // Count applications by status
    const [
      totalApplications,
      approvedApplications,
      declinedApplications,
      flaggedApplications,
      pendingApplications,
      activeApplications,
      completedApplications,
    ] = await Promise.all([
      Application.countDocuments(appQuery),
      Application.countDocuments({ ...appQuery, status: { $in: ['APPROVED', 'MANDATE_CREATED', 'MANDATE_ACTIVE'] } }),
      Application.countDocuments({ ...appQuery, status: 'DECLINED' }),
      Application.countDocuments({ ...appQuery, status: 'FLAGGED_FOR_REVIEW' }),
      Application.countDocuments({ ...appQuery, status: { $in: ['PENDING_ANALYSIS', 'ANALYZING'] } }),
      Application.countDocuments({ ...appQuery, status: 'ACTIVE' }),
      Application.countDocuments({ ...appQuery, status: 'COMPLETED' }),
    ]);

    // Calculate approval rate
    const decisionsCount = approvedApplications + declinedApplications + flaggedApplications;
    const approvalRate = decisionsCount > 0
      ? (approvedApplications / decisionsCount) * 100
      : 0;

    // Get trust scores
    const trustOutputs = await TrustEngineOutput.find({
      trustWalletId,
      ...(dateRange?.startDate || dateRange?.endDate ? {
        analyzedAt: {
          ...(dateRange.startDate && { $gte: dateRange.startDate }),
          ...(dateRange.endDate && { $lte: dateRange.endDate }),
        }
      } : {})
    });

    let avgTrustScore = 0;
    let minTrustScore = 0;
    let maxTrustScore = 0;
    const scoreDistribution = {
      excellent: 0, // 80-100
      good: 0, // 60-79
      fair: 0, // 40-59
      poor: 0, // 0-39
    };

    if (trustOutputs.length > 0) {
      const scores = trustOutputs.map((output) => output.trustScore);
      avgTrustScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      minTrustScore = Math.min(...scores);
      maxTrustScore = Math.max(...scores);

      // Calculate distribution
      scores.forEach((score) => {
        if (score >= 80) scoreDistribution.excellent++;
        else if (score >= 60) scoreDistribution.good++;
        else if (score >= 40) scoreDistribution.fair++;
        else scoreDistribution.poor++;
      });
    }

    // Calculate revenue metrics
    const [successfulPayments, applicationsData] = await Promise.all([
      PaymentTransaction.find({ trustWalletId, status: 'SUCCESSFUL' }),
      Application.find({ trustWalletId }),
    ]);

    const totalCollected = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);

    const downPayments = applicationsData
      .filter((app) => app.downPaymentReceived)
      .reduce((sum, app) => sum + (app.downPaymentAmount || 0), 0);

    const finalTotalCollected = totalCollected + downPayments;

    const outstandingBalance = applicationsData.reduce((sum, app) => sum + app.outstandingBalance, 0);
    const totalExpected = applicationsData.reduce((sum, app) => sum + app.totalAmount, 0);

    // Calculate payment success rate
    const [successfulPaymentCount, failedPaymentCount] = await Promise.all([
      PaymentTransaction.countDocuments({ trustWalletId, status: 'SUCCESSFUL' }),
      PaymentTransaction.countDocuments({ trustWalletId, status: 'FAILED' }),
    ]);

    const totalPaymentAttempts = successfulPaymentCount + failedPaymentCount;
    const paymentSuccessRate = totalPaymentAttempts > 0
      ? (successfulPaymentCount / totalPaymentAttempts) * 100
      : 0;

    return {
      trustWallet: {
        trustWalletId: trustWallet.trustWalletId,
        name: trustWallet.name,
        isActive: trustWallet.isActive,
      },
      applications: {
        total: totalApplications,
        approved: approvedApplications,
        declined: declinedApplications,
        flagged: flaggedApplications,
        pending: pendingApplications,
        active: activeApplications,
        completed: completedApplications,
        approvalRate: parseFloat(approvalRate.toFixed(2)),
      },
      trustScores: {
        average: parseFloat(avgTrustScore.toFixed(2)),
        min: minTrustScore,
        max: maxTrustScore,
        distribution: scoreDistribution,
      },
      revenue: {
        totalCollected: finalTotalCollected,
        outstandingBalance,
        totalExpected,
      },
      payments: {
        successfulCount: successfulPaymentCount,
        failedCount: failedPaymentCount,
        successRate: parseFloat(paymentSuccessRate.toFixed(2)),
      },
    };
  } catch (error: any) {
    logger.error('Error getting TrustWallet analytics:', error);
    throw new Error(`Failed to get TrustWallet analytics: ${error.message}`);
  }
};
