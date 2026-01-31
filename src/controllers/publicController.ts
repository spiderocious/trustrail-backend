import { Request, Response, NextFunction } from 'express';
import TrustWallet from '../models/TrustWallet';
import Business from '../models/Business';
import Application from '../models/Application';
import TrustEngineOutput from '../models/TrustEngineOutput';
import { createApplication as createApplicationService } from '../services/applicationService';
import ResponseFormatter from '../utils/responseFormatter';
import logger from '../config/logger';

/**
 * Get TrustWallet information for customer application page
 * GET /public/trustwallet/:trustWalletId
 */
export const getTrustWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { trustWalletId } = req.params;

    // Find TrustWallet
    const trustWallet = await TrustWallet.findOne({ trustWalletId, isActive: true });

    if (!trustWallet) {
      res.status(404).json(
        ResponseFormatter.error('TrustWallet not found or inactive')
      );
      return;
    }

    // Find business
    const business = await Business.findOne({ businessId: trustWallet.businessId });

    // Return public information (hide sensitive data)
    const publicData = {
      trustWalletId: trustWallet.trustWalletId,
      businessName: business?.businessName || 'Unknown Business',
      name: trustWallet.name,
      description: trustWallet.description,
      installmentPlan: trustWallet.installmentPlan,
      requirements: [
        'Bank account details',
        '3-month bank statement (PDF or CSV format)',
        'BVN (Bank Verification Number)',
      ],
    };

    res.status(200).json(
      ResponseFormatter.success(publicData)
    );
  } catch (error: any) {
    logger.error('Get public TrustWallet controller error:', error);
    next(error);
  }
};

/**
 * Customer submits application with bank statement
 * POST /public/trustwallet/:trustWalletId/apply
 */
export const submitApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { trustWalletId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json(
        ResponseFormatter.error('Bank statement file (PDF or CSV) is required')
      );
      return;
    }

    // Verify TrustWallet exists and is active
    const trustWallet = await TrustWallet.findOne({ trustWalletId, isActive: true });
    if (!trustWallet) {
      res.status(404).json(
        ResponseFormatter.error('TrustWallet not found or inactive')
      );
      return;
    }

    const customerData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      accountNumber: req.body.accountNumber,
      bankCode: req.body.bankCode,
      bvn: req.body.bvn,
    };

    // STEP 1: Upload file to OpenAI FIRST (fail fast if upload fails)
    let openaiData: any = undefined;
    const useOpenAI = process.env.OPENAI_ENABLED === 'true';

    if (useOpenAI) {
      try {
        const { uploadFileToOpenAI } = await import('../services/openaiService');

        const { fileId, fileSize } = await uploadFileToOpenAI(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        openaiData = {
          fileId,
          fileName: req.file.originalname,
          fileSize,
          mimeType: req.file.mimetype,
          uploadedAt: new Date(),
        };

        logger.info(`File uploaded to OpenAI: ${fileId} for ${customerData.email}`);
      } catch (error: any) {
        // Upload failed - return error immediately (don't create application)
        logger.error('OpenAI file upload failed:', error);
        res.status(500).json(
          ResponseFormatter.error(`File upload failed: ${error.message}`)
        );
        return;
      }
    }

    // STEP 2: Create application (only after successful upload)
    const application = await createApplicationService(
      trustWalletId,
      customerData,
      openaiData || req.file.buffer // Use OpenAI data or fallback to buffer
    );

    res.status(201).json(
      ResponseFormatter.success(
        {
          applicationId: application.applicationId,
          status: application.status,
          message: 'Application submitted successfully. Analysis in progress.',
          estimatedTime: 'Analysis typically takes 2-5 minutes',
        },
        'Application submitted successfully'
      )
    );
  } catch (error: any) {
    logger.error('Submit application controller error:', error);
    next(error);
  }
};

/**
 * Check application status (for customer polling)
 * GET /public/application/:applicationId/status
 */
export const checkApplicationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { applicationId } = req.params;

    // Find application
    const application = await Application.findOne({ applicationId });

    if (!application) {
      res.status(404).json(
        ResponseFormatter.error('Application not found')
      );
      return;
    }

    // Get trust engine output if available
    let trustEngineOutput = null;
    if (application.trustEngineOutputId) {
      trustEngineOutput = await TrustEngineOutput.findOne({ outputId: application.trustEngineOutputId });
    }

    // Prepare response based on status
    const statusMessages: { [key: string]: string } = {
      PENDING_ANALYSIS: 'Your application is being analyzed. This typically takes 2-5 minutes.',
      ANALYZING: 'Analysis in progress...',
      APPROVED: 'Congratulations! You\'ve been approved. Mandate is being created.',
      DECLINED: 'Unfortunately, your application has been declined.',
      FLAGGED_FOR_REVIEW: 'Your application is under review. You\'ll be notified of the decision within 24 hours.',
      MANDATE_CREATED: 'Mandate created. Waiting for activation from NIBSS.',
      MANDATE_ACTIVE: 'Your installment plan is active. Please pay down payment to activate.',
      ACTIVE: 'Installment plan is active. Payments are being processed.',
      COMPLETED: 'All payments completed successfully!',
      DEFAULTED: 'Payment defaulted. Please contact support.',
    };

    const response: any = {
      applicationId: application.applicationId,
      status: application.status,
      message: statusMessages[application.status] || 'Processing',
    };

    // Add trust score if analyzed
    if (trustEngineOutput) {
      response.trustScore = trustEngineOutput.trustScore;
      response.decision = trustEngineOutput.decision;
    }

    // Add virtual account if mandate is active
    if (application.status === 'MANDATE_ACTIVE' && application.virtualAccountNumber) {
      response.virtualAccount = {
        accountNumber: application.virtualAccountNumber,
        amount: application.downPaymentRequired,
      };
      response.nextSteps = `Please transfer ₦${application.downPaymentRequired.toLocaleString()} to the virtual account to activate your installment plan.`;
    }

    // Add payment schedule if active
    if (application.status === 'ACTIVE' && application.mandateActivatedAt) {
      response.nextSteps = 'Installments will be automatically debited from your account as per schedule.';
      response.paymentsCompleted = application.paymentsCompleted;
      response.totalPayments = application.installmentCount;
      response.outstandingBalance = application.outstandingBalance;
    }

    res.status(200).json(
      ResponseFormatter.success(response)
    );
  } catch (error: any) {
    logger.error('Check application status controller error:', error);
    next(error);
  }
};
