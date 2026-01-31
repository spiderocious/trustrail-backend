import TrustWallet, { ITrustWallet } from '../models/TrustWallet';
import Application from '../models/Application';
import { generateTrustWalletId } from '../utils/idGenerator';
import { logBusinessAction } from './auditService';
import logger from '../config/logger';

export interface CreateTrustWalletData {
  name: string;
  description?: string;
  installmentPlan: {
    totalAmount: number;
    downPaymentPercentage: number;
    installmentCount: number;
    frequency: 'weekly' | 'monthly';
    interestRate?: number;
  };
  approvalWorkflow: {
    autoApproveThreshold: number;
    autoDeclineThreshold: number;
    minTrustScore: number;
  };
}

/**
 * Create new TrustWallet
 */
export const createTrustWallet = async (
  businessId: string,
  businessEmail: string,
  data: CreateTrustWalletData
): Promise<ITrustWallet> => {
  // Check name uniqueness for this business
  const existing = await TrustWallet.findOne({
    businessId,
    name: data.name,
  });

  if (existing) {
    throw new Error('TrustWallet with this name already exists for your business');
  }

  // Validate workflow thresholds
  if (data.approvalWorkflow.autoApproveThreshold <= data.approvalWorkflow.autoDeclineThreshold) {
    throw new Error('Auto-approve threshold must be greater than auto-decline threshold');
  }

  if (data.approvalWorkflow.minTrustScore > data.approvalWorkflow.autoApproveThreshold) {
    throw new Error('Minimum trust score must be less than or equal to auto-approve threshold');
  }

  // Generate ID
  const trustWalletId = generateTrustWalletId();

  // Generate public URL
  const publicUrl = `/public/trustwallet/${trustWalletId}`;

  // Create TrustWallet
  const trustWallet = await TrustWallet.create({
    trustWalletId,
    businessId,
    name: data.name,
    description: data.description,
    installmentPlan: {
      ...data.installmentPlan,
      interestRate: data.installmentPlan.interestRate || 0,
    },
    approvalWorkflow: data.approvalWorkflow,
    publicUrl,
    isActive: true,
  });

  // Log audit
  await logBusinessAction(
    'trustwallet.create',
    businessId,
    businessEmail,
    'TrustWallet',
    trustWalletId
  );

  logger.info(`TrustWallet created: ${trustWalletId} by ${businessId}`);

  return trustWallet;
};

/**
 * List TrustWallets for business
 */
export const listTrustWallets = async (
  businessId: string,
  filters: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<{
  trustWallets: any[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}> => {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = { businessId };

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  const [trustWallets, totalCount] = await Promise.all([
    TrustWallet.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TrustWallet.countDocuments(query),
  ]);
  const wallets = trustWallets as any[];
  // for every trust wallet, we want to find the number of applications linked to it
  for (const wallet of wallets) {
    const applicationCount = await Application.countDocuments({ trustWalletId: wallet.trustWalletId });
    wallet.applicationCount = applicationCount;
  }

  return {
    trustWallets: wallets,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Get TrustWallet by ID
 */
export const getTrustWalletById = async (
  trustWalletId: string,
  businessId: string
): Promise<ITrustWallet> => {
  const trustWallet = await TrustWallet.findOne({ trustWalletId, businessId });

  if (!trustWallet) {
    throw new Error('TrustWallet not found');
  }

  return trustWallet;
};

/**
 * Update TrustWallet
 */
export const updateTrustWallet = async (
  trustWalletId: string,
  businessId: string,
  businessEmail: string,
  updates: Partial<CreateTrustWalletData>
): Promise<ITrustWallet> => {
  const trustWallet = await getTrustWalletById(trustWalletId, businessId);

  // Check name uniqueness if name is being updated
  if (updates.name && updates.name !== trustWallet.name) {
    const existing = await TrustWallet.findOne({
      businessId,
      name: updates.name,
      trustWalletId: { $ne: trustWalletId },
    });

    if (existing) {
      throw new Error('TrustWallet with this name already exists for your business');
    }
    trustWallet.name = updates.name;
  }

  // Update fields
  if (updates.description !== undefined) {
    trustWallet.description = updates.description;
  }

  if (updates.installmentPlan) {
    trustWallet.installmentPlan = {
      ...trustWallet.installmentPlan,
      ...updates.installmentPlan,
    };
  }

  if (updates.approvalWorkflow) {
    // Validate new workflow thresholds
    const newWorkflow = {
      ...trustWallet.approvalWorkflow,
      ...updates.approvalWorkflow,
    };

    if (newWorkflow.autoApproveThreshold <= newWorkflow.autoDeclineThreshold) {
      throw new Error('Auto-approve threshold must be greater than auto-decline threshold');
    }

    if (newWorkflow.minTrustScore > newWorkflow.autoApproveThreshold) {
      throw new Error('Minimum trust score must be less than or equal to auto-approve threshold');
    }

    trustWallet.approvalWorkflow = newWorkflow;
  }

  await trustWallet.save();

  // Log audit
  await logBusinessAction(
    'trustwallet.update',
    businessId,
    businessEmail,
    'TrustWallet',
    trustWalletId,
    { updates }
  );

  logger.info(`TrustWallet updated: ${trustWalletId} by ${businessId}`);

  return trustWallet;
};

/**
 * Delete TrustWallet (soft delete)
 */
export const deleteTrustWallet = async (
  trustWalletId: string,
  businessId: string,
  businessEmail: string
): Promise<void> => {
  const trustWallet = await getTrustWalletById(trustWalletId, businessId);

  // Check for active applications
  const activeApplications = await Application.findOne({
    trustWalletId,
    status: { $in: ['PENDING_ANALYSIS', 'ANALYZING', 'APPROVED', 'MANDATE_CREATED', 'MANDATE_ACTIVE', 'ACTIVE'] },
  });

  if (activeApplications) {
    throw new Error('Cannot delete TrustWallet with active applications');
  }

  // Soft delete
  trustWallet.isActive = false;
  await trustWallet.save();

  // Log audit
  await logBusinessAction(
    'trustwallet.delete',
    businessId,
    businessEmail,
    'TrustWallet',
    trustWalletId
  );

  logger.info(`TrustWallet deleted: ${trustWalletId} by ${businessId}`);
};

/**
 * Get TrustWallet by ID for public access (no ownership check)
 */
export const getTrustWalletForPublic = async (trustWalletId: string): Promise<ITrustWallet> => {
  const trustWallet = await TrustWallet.findOne({ trustWalletId, isActive: true });

  if (!trustWallet) {
    throw new Error('TrustWallet not found or inactive');
  }

  return trustWallet;
};

export default {
  createTrustWallet,
  listTrustWallets,
  getTrustWalletById,
  updateTrustWallet,
  deleteTrustWallet,
  getTrustWalletForPublic,
};
