import Application from '../models/Application';
import Business from '../models/Business';
import TrustWallet from '../models/TrustWallet';
import { analyzeApplication, saveTrustEngineOutput } from '../services/trustEngineService';
import { analyzeFileWithOpenAI } from '../services/openaiService';
import { createMandate } from '../services/pwaService';
import { sendWebhook } from '../services/webhookService';
import { logSystemAction } from '../services/auditService';
import logger from '../config/logger';

/**
 * Statement Analysis Background Job
 * Processes pending applications by analyzing bank statements
 * Runs every 60 seconds (configurable)
 */
export const runStatementAnalysisJob = async (): Promise<void> => {
  try {
    logger.info('Statement analysis job started');

    // Query applications with status PENDING_ANALYSIS
    // Process maximum 10 at a time (FIFO - oldest first)
    const pendingApplications = await Application.find({ status: 'PENDING_ANALYSIS' })
      .sort({ submittedAt: 1 }) // Oldest first
      .limit(10);

    if (pendingApplications.length === 0) {
      logger.debug('No pending applications to analyze');
      return;
    }

    logger.info(`Processing ${pendingApplications.length} pending applications`);

    // Process each application
    for (const application of pendingApplications) {
      try {
        // Update status to ANALYZING
        application.status = 'ANALYZING';
        await application.save();

        logger.info(`Analyzing application ${application.applicationId}`);

        let trustEngineOutput: any;

        // Check if OpenAI file ID exists
        if (application.openai?.fileId) {
          // Use OpenAI analysis
          try {
            const trustWallet = await TrustWallet.findOne({ trustWalletId: application.trustWalletId });
            if (!trustWallet) {
              throw new Error(`TrustWallet not found: ${application.trustWalletId}`);
            }

            logger.info(`Using OpenAI analysis for application ${application.applicationId}`);

            const { analysisResult, fullResponse } = await analyzeFileWithOpenAI(
              application.openai.fileId,
              application.installmentAmount,
              trustWallet.approvalWorkflow
            );

            // Save the entire OpenAI response for debugging
            application.openai.analysisResponse = fullResponse;
            application.openai.analysisCompletedAt = new Date();

            // Save Trust Engine output to database
            const outputId = await saveTrustEngineOutput(
              application.applicationId,
              application.trustWalletId,
              application.businessId,
              analysisResult
            );

            trustEngineOutput = {
              ...analysisResult,
              outputId,
            };

            logger.info(`OpenAI analysis completed for ${application.applicationId} (score: ${analysisResult.trustScore})`);
          } catch (error: any) {
            logger.error(`OpenAI analysis failed for ${application.applicationId}:`, error);

            // Fallback to JS analysis if buffer exists
            if (application.bankStatementCsvData) {
              logger.info(`Falling back to JS analysis for ${application.applicationId}`);
              trustEngineOutput = await analyzeApplication(application.applicationId);
            } else {
              throw error; // No fallback available
            }
          }
        } else {
          // Use legacy JS analysis
          logger.info(`Using JS analysis for application ${application.applicationId}`);
          trustEngineOutput = await analyzeApplication(application.applicationId);
        }

        // Link TrustEngineOutput to Application
        application.trustEngineOutputId = trustEngineOutput.outputId;
        application.analyzedAt = new Date();

        // Get business for webhook and PWA integration
        const business = await Business.findOne({ businessId: application.businessId });
        if (!business) {
          throw new Error(`Business not found: ${application.businessId}`);
        }

        // Handle decision
        if (trustEngineOutput.decision === 'APPROVED') {
          // Update application status
          application.status = 'APPROVED';
          application.approvedAt = new Date();
          await application.save();

          // Create PWA mandate
          const mandateResult = await createMandate(
            {
              accountNumber: application.customerDetails.accountNumber,
              bankCode: application.customerDetails.bankCode,
              bvn: application.customerDetails.bvn,
            },
            business.billerCode!,
            application.totalAmount
          );

          // Update application with mandate reference
          application.pwaMandateRef = mandateResult.mandateRef;
          application.status = 'MANDATE_CREATED';
          await application.save();

          // Send webhook to business
          await sendWebhook(business.businessId, 'application.approved', {
            event: 'application.approved',
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            totalAmount: application.totalAmount,
            pwaMandateRef: mandateResult.mandateRef,
          });

          logger.info(`Application ${application.applicationId} APPROVED and mandate created`);
        } else if (trustEngineOutput.decision === 'DECLINED') {
          // Update application status
          application.status = 'DECLINED';
          application.declinedAt = new Date();
          await application.save();

          // Send webhook to business
          await sendWebhook(business.businessId, 'application.declined', {
            event: 'application.declined',
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            riskFlags: trustEngineOutput.riskFlags,
          });

          logger.info(`Application ${application.applicationId} DECLINED`);
        } else if (trustEngineOutput.decision === 'FLAGGED_FOR_REVIEW') {
          // Update application status
          application.status = 'FLAGGED_FOR_REVIEW';
          await application.save();

          // Send webhook to business
          await sendWebhook(business.businessId, 'application.flagged', {
            event: 'application.flagged',
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            riskFlags: trustEngineOutput.riskFlags,
            message: 'Application requires manual review',
          });

          logger.info(`Application ${application.applicationId} FLAGGED FOR REVIEW`);
        }

        // Log audit
        await logSystemAction(
          `application.${trustEngineOutput.decision.toLowerCase()}`,
          'Application',
          application.applicationId,
          undefined,
          {
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
          }
        );
      } catch (error: any) {
        // Log error but continue processing other applications
        logger.error(`Error processing application ${application.applicationId}:`, error);

        // Leave status as ANALYZING so it can be retried or manually reviewed
        // Don't crash the entire job
      }
    }

    logger.info('Statement analysis job completed');
  } catch (error: any) {
    logger.error('Statement analysis job error:', error);
    // Don't throw - let job continue running
  }
};
