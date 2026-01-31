import Application, { IApplication } from '../models/Application';
import TrustWallet from '../models/TrustWallet';
import Business from '../models/Business';
import TrustEngineOutput from '../models/TrustEngineOutput';
import PaymentTransaction from '../models/PaymentTransaction';
import { generateApplicationId } from '../utils/idGenerator';
import { encryptBVN } from './encryptionService';
import { logBusinessAction, logSystemAction } from './auditService';
import { createMandate } from './pwaService';
import logger from '../config/logger';

export interface CreateApplicationData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  accountNumber: string;
  bankCode: string;
  bvn: string;
}

/**
 * Create new application
 * Accepts OpenAI data (fileId) OR CSV buffer for fallback
 */
export const createApplication = async (
  trustWalletId: string,
  customerData: CreateApplicationData,
  fileDataOrBuffer?: any | Buffer
): Promise<IApplication> => {
  // Find TrustWallet
  const trustWallet = await TrustWallet.findOne({ trustWalletId, isActive: true });
  if (!trustWallet) {
    throw new Error('TrustWallet not found or inactive');
  }

  // Encrypt BVN
  const encryptedBVN = encryptBVN(customerData.bvn);

  // Generate application ID
  const applicationId = generateApplicationId();

  // Calculate amounts from TrustWallet config
  const totalAmount = trustWallet.installmentPlan.totalAmount;
  const downPaymentRequired =
    (totalAmount * trustWallet.installmentPlan.downPaymentPercentage) / 100;
  const installmentAmount =
    (totalAmount - downPaymentRequired) / trustWallet.installmentPlan.installmentCount;

  // Determine if we have OpenAI data or buffer (fallback)
  let openaiData: any = undefined;
  let csvBuffer: Buffer | undefined;

  if (fileDataOrBuffer) {
    if (Buffer.isBuffer(fileDataOrBuffer)) {
      csvBuffer = fileDataOrBuffer; // Fallback buffer
    } else {
      openaiData = fileDataOrBuffer; // OpenAI data
    }
  }

  // Create application
  const application = await Application.create({
    applicationId,
    trustWalletId,
    businessId: trustWallet.businessId,
    customerDetails: {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phoneNumber: customerData.phoneNumber,
      accountNumber: customerData.accountNumber,
      bankCode: customerData.bankCode,
      bvn: encryptedBVN,
    },
    bankStatementCsvData: csvBuffer, // DEPRECATED - fallback only
    openai: openaiData, // NEW - OpenAI file tracking
    status: 'PENDING_ANALYSIS',
    totalAmount,
    downPaymentRequired,
    installmentAmount,
    installmentCount: trustWallet.installmentPlan.installmentCount,
    frequency: trustWallet.installmentPlan.frequency,
    outstandingBalance: totalAmount,
    submittedAt: new Date(),
  });

  // Log audit
  await logSystemAction(
    'application.submit',
    'Application',
    applicationId,
    undefined,
    { trustWalletId, businessId: trustWallet.businessId }
  );

  logger.info(`Application created: ${applicationId} for TrustWallet ${trustWalletId}`);

  return application;
};

/**
 * List applications
 */
export const listApplications = async (
  businessId: string,
  filters: {
    trustWalletId?: string;
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }
): Promise<{
  applications: any[];
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

  if (filters.trustWalletId) {
    query.trustWalletId = filters.trustWalletId;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    // Search in customer name, email, phone
    query.$or = [
      { 'customerDetails.firstName': { $regex: filters.search, $options: 'i' } },
      { 'customerDetails.lastName': { $regex: filters.search, $options: 'i' } },
      { 'customerDetails.email': { $regex: filters.search, $options: 'i' } },
      { 'customerDetails.phoneNumber': { $regex: filters.search, $options: 'i' } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    query.submittedAt = {};
    if (filters.startDate) {
      query.submittedAt.$gte = filters.startDate;
    }
    if (filters.endDate) {
      query.submittedAt.$lte = filters.endDate;
    }
  }

  const [applications, totalCount] = await Promise.all([
    Application.find(query)
      .select('-customerDetails.bvn -customerDetails.accountNumber') // Exclude sensitive data
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(query),
  ]);

  // Populate trust engine outputs for all applications
  const applicationsWithTrustOutput = await Promise.all(
    applications.map(async (app: any) => {
      if (app.trustEngineOutputId) {
        const trustEngineOutput = await TrustEngineOutput.findOne({
          outputId: app.trustEngineOutputId,
        }).lean();
        return {
          ...app,
          trustEngineOutput,
        };
      }
      return app;
    })
  );

  return {
    applications: applicationsWithTrustOutput,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Get application by ID
 */
export const getApplicationById = async (
  applicationId: string,
  businessId: string
): Promise<any> => {
  const application = await Application.findOne({ applicationId, businessId });
  if (!application) {
    throw new Error('Application not found');
  }

  // Get related data
  const [trustWallet, trustEngineOutput, payments] = await Promise.all([
    TrustWallet.findOne({ trustWalletId: application.trustWalletId }),
    application.trustEngineOutputId
      ? TrustEngineOutput.findOne({ outputId: application.trustEngineOutputId })
      : null,
    PaymentTransaction.find({ applicationId }).sort({ paymentNumber: 1 }),
  ]);

  return {
    ...application.toObject(),
    trustWallet,
    trustEngineOutput,
    payments,
  };
};

/**
 * Manually approve application
 */
export const manuallyApprove = async (
  applicationId: string,
  businessId: string,
  businessEmail: string,
  notes?: string
): Promise<IApplication> => {
  const application = await Application.findOne({ applicationId, businessId });
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'FLAGGED_FOR_REVIEW') {
    throw new Error('Can only manually approve applications that are flagged for review');
  }

  // Update status
  application.status = 'APPROVED';
  application.approvedAt = new Date();

  // Get business for biller code
  const business = await Business.findOne({ businessId });
  if (!business || !business.billerCode) {
    throw new Error('Business or biller code not found');
  }

  // Create PWA mandate
  try {
    const mandateResult = await createMandate(
      {
        accountNumber: application.customerDetails.accountNumber,
        bankCode: application.customerDetails.bankCode,
        bvn: application.customerDetails.bvn,
      },
      business.billerCode,
      application.totalAmount
    );

    application.pwaMandateRef = mandateResult.mandateRef;
    application.status = 'MANDATE_CREATED';
  } catch (error: any) {
    logger.error(`Failed to create PWA mandate for application ${applicationId}:`, error);
    throw new Error(`Failed to create mandate: ${error.message}`);
  }

  await application.save();

  // Log audit
  await logBusinessAction(
    'application.approve_manual',
    businessId,
    businessEmail,
    'Application',
    applicationId,
    { status: { before: 'FLAGGED_FOR_REVIEW', after: application.status } },
    { notes }
  );

  logger.info(`Application manually approved: ${applicationId} by ${businessId}`);

  return application;
};

/**
 * Manually decline application
 */
export const manuallyDecline = async (
  applicationId: string,
  businessId: string,
  businessEmail: string,
  reason: string
): Promise<IApplication> => {
  const application = await Application.findOne({ applicationId, businessId });
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'FLAGGED_FOR_REVIEW') {
    throw new Error('Can only manually decline applications that are flagged for review');
  }

  // Update status
  application.status = 'DECLINED';
  application.declinedAt = new Date();
  await application.save();

  // Log audit
  await logBusinessAction(
    'application.decline_manual',
    businessId,
    businessEmail,
    'Application',
    applicationId,
    { status: { before: 'FLAGGED_FOR_REVIEW', after: 'DECLINED' } },
    { reason }
  );

  logger.info(`Application manually declined: ${applicationId} by ${businessId}`);

  return application;
};

export default {
  createApplication,
  listApplications,
  getApplicationById,
  manuallyApprove,
  manuallyDecline,
};
