<<<<<<< HEAD
import Application from '../models/Application';
import Business from '../models/Business';
import TrustWallet from '../models/TrustWallet';
import { analyzeApplication, saveTrustEngineOutput } from '../services/trustEngineService';
import { analyzeFileWithOpenAI } from '../services/openaiService';
import { createMandate, sendInstallmentInvoice } from '../services/pwaService';
import { sendWebhook } from '../services/webhookService';
import { logSystemAction } from '../services/auditService';
import logger from '../config/logger';
=======
import logger from "../config/logger";
import Application from "../models/Application";
import Business from "../models/Business";
import TrustWallet from "../models/TrustWallet";
import { logSystemAction } from "../services/auditService";
import { analyzeFileWithOpenAI } from "../services/openaiService";
import { createMandate } from "../services/pwaService";
import {
  analyzeApplication,
  saveTrustEngineOutput,
  createInvalidStatementOutput,
} from "../services/trustEngineService";
import { sendWebhook } from "../services/webhookService";
>>>>>>> main

/**
 * Statement Analysis Background Job
 * Processes pending applications by analyzing bank statements
 * Runs every 60 seconds (configurable)
 */
export const runStatementAnalysisJob = async (): Promise<void> => {
  try {
    logger.info("Statement analysis job started");

    // Query applications with status PENDING_ANALYSIS
    // Process maximum 10 at a time (FIFO - oldest first)
    const pendingApplications = await Application.find({
      status: "PENDING_ANALYSIS",
    })
      .sort({ submittedAt: 1 }) // Oldest first
      .limit(10);

    if (pendingApplications.length === 0) {
      logger.debug("No pending applications to analyze");
      return;
    }

    logger.info(
      `Processing ${pendingApplications.length} pending applications`,
    );

    // Process each application
    for (const application of pendingApplications) {
      try {
        // Update status to ANALYZING
        application.status = "ANALYZING";
        await application.save();

        logger.info(`Analyzing application ${application.applicationId}`);

        await logSystemAction(
          "application.process",
          "Application",
          application.applicationId,
          undefined,
          {
            trustWalletId: application.trustWalletId,
            businessId: application.businessId,
            applicationId: application.applicationId,
          },
        );

        let trustEngineOutput: any;

        // Check if OpenAI file ID exists
        if (application.openai?.fileId) {
          // Use OpenAI analysis
          try {
            const trustWallet = await TrustWallet.findOne({
              trustWalletId: application.trustWalletId,
            });
            if (!trustWallet) {
              throw new Error(
                `TrustWallet not found: ${application.trustWalletId}`,
              );
            }

            logger.info(
              `Using OpenAI analysis for application ${application.applicationId}`,
            );

            let { analysisResult, fullResponse, fullPrompt } =
              await analyzeFileWithOpenAI(
                application.openai.fileId,
                application.installmentAmount,
                trustWallet.approvalWorkflow,
              );

            // Check if OpenAI determined this is not a valid bank statement
            if (analysisResult.isValidStatement === false) {
              logger.warn(
                `Invalid statement detected for application ${application.applicationId}: ${analysisResult.invalidStatementReason}`,
              );

              // Replace with zeroed output
              analysisResult = createInvalidStatementOutput(
                analysisResult.invalidStatementReason ||
                  "Document is not a valid bank statement",
                application.installmentAmount,
              );
            }

            await logSystemAction(
              "application.processed",
              "Application",
              application.applicationId,
              undefined,
              {
                trustWalletId: application.trustWalletId,
                businessId: application.businessId,
                applicationId: application.applicationId,
                openAIResponse: fullResponse,
                openAIPrompt: fullPrompt,
              },
            );

            // Save the entire OpenAI response for debugging
            application.openai.analysisResponse = fullResponse;
            application.openai.analysisCompletedAt = new Date();

            // Save Trust Engine output to database
            const outputId = await saveTrustEngineOutput(
              application.applicationId,
              application.trustWalletId,
              application.businessId,
              analysisResult,
            );

            trustEngineOutput = {
              ...analysisResult,
              outputId,
            };

            logger.info(
              `OpenAI analysis completed for ${application.applicationId} (score: ${analysisResult.trustScore})`,
            );
          } catch (error: any) {
            logger.error(
              `OpenAI analysis failed for ${application.applicationId}:`,
              error,
            );

            // Fallback to JS analysis if buffer exists
            if (application.bankStatementCsvData) {
              logger.info(
                `Falling back to JS analysis for ${application.applicationId}`,
              );
              trustEngineOutput = await analyzeApplication(
                application.applicationId,
              );
            } else {
              throw error; // No fallback available
            }
          }
        } else {
          // Use legacy JS analysis
          logger.info(
            `Using JS analysis for application ${application.applicationId}`,
          );
          trustEngineOutput = await analyzeApplication(
            application.applicationId,
          );
        }

        // Link TrustEngineOutput to Application
        application.trustEngineOutputId = trustEngineOutput.outputId;
        application.analyzedAt = new Date();

        // Get business for webhook and PWA integration
        const business = await Business.findOne({
          businessId: application.businessId,
        });
        if (!business) {
          throw new Error(`Business not found: ${application.businessId}`);
        }

        // Handle decision
        if (trustEngineOutput.decision === "APPROVED") {
          // Update application status
          application.status = "APPROVED";
          application.approvedAt = new Date();
          await application.save();

          // Create PWA mandate
          const mandateResult = await createMandate(
            {
              accountNumber: application.customerDetails.accountNumber,
              bankCode: application.customerDetails.bankCode,
              bvn: application.customerDetails.bvn,
              firstName: application.customerDetails.firstName,
              lastName: application.customerDetails.lastName,
              email: application.customerDetails.email,
              phoneNumber: application.customerDetails.phoneNumber,
            },
            business.billerCode!,
            application.totalAmount,
          );

          // Update application with mandate reference
          application.pwaMandateRef = mandateResult.mandateRef;
          application.status = "MANDATE_CREATED";
          await application.save();

          // Immediately send installment invoice to create virtual account
          try {
            const invoiceResult = await sendInstallmentInvoice(
              {
                accountNumber: application.customerDetails.accountNumber,
                bankCode: application.customerDetails.bankCode,
                firstName: application.customerDetails.firstName,
                lastName: application.customerDetails.lastName,
                email: application.customerDetails.email,
                phoneNumber: application.customerDetails.phoneNumber,
              },
              business.billerCode!,
              application.totalAmount,
              application.downPaymentRequired,
              application.installmentCount,
              application.frequency,
              new Date() // Start date for installments
            );

            // Update application with virtual account
            application.virtualAccountNumber = invoiceResult.virtualAccountNumber;
            application.status = 'MANDATE_ACTIVE';
            application.mandateActivatedAt = new Date();
            await application.save();

            // Log audit
            await logSystemAction(
              'invoice.sent',
              'Application',
              application.applicationId,
              undefined,
              {
                virtualAccountNumber: invoiceResult.virtualAccountNumber,
                downPaymentRequired: application.downPaymentRequired,
              }
            );

            logger.info(`Virtual account created for ${application.applicationId}: ${invoiceResult.virtualAccountNumber}`);
          } catch (error: any) {
            logger.error(`Failed to create virtual account for ${application.applicationId}:`, error);
            // Leave status as MANDATE_CREATED - webhook handler will retry if NIBSS webhook arrives
          }

          // Send webhook to business
          await sendWebhook(business.businessId, "application.approved", {
            event: "application.approved",
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            totalAmount: application.totalAmount,
            pwaMandateRef: mandateResult.mandateRef,
            virtualAccountNumber: application.virtualAccountNumber,
            downPaymentRequired: application.downPaymentRequired,
            nextSteps: application.virtualAccountNumber
              ? 'Customer should pay down payment to the virtual account to activate installment plan'
              : 'Waiting for mandate activation',
          });

          logger.info(
            `Application ${application.applicationId} APPROVED and mandate created`,
          );
        } else if (trustEngineOutput.decision === "DECLINED") {
          // Update application status
          application.status = "DECLINED";
          application.declinedAt = new Date();
          await application.save();

          // Send webhook to business
          await sendWebhook(business.businessId, "application.declined", {
            event: "application.declined",
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            riskFlags: trustEngineOutput.riskFlags,
            isValidStatement: trustEngineOutput.isValidStatement !== false,
            invalidStatementReason: trustEngineOutput.invalidStatementReason,
          });

          logger.info(`Application ${application.applicationId} DECLINED`);
        } else if (trustEngineOutput.decision === "FLAGGED_FOR_REVIEW") {
          // Update application status
          application.status = "FLAGGED_FOR_REVIEW";
          await application.save();

          // Send webhook to business
          await sendWebhook(business.businessId, "application.flagged", {
            event: "application.flagged",
            applicationId: application.applicationId,
            trustWalletId: application.trustWalletId,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
            riskFlags: trustEngineOutput.riskFlags,
            message: "Application requires manual review",
          });

          logger.info(
            `Application ${application.applicationId} FLAGGED FOR REVIEW`,
          );
        }

        // Log audit
        await logSystemAction(
          `application.${trustEngineOutput.decision.toLowerCase()}`,
          "Application",
          application.applicationId,
          undefined,
          {
            trustScore: trustEngineOutput.trustScore,
            decision: trustEngineOutput.decision,
          },
        );
      } catch (error: any) {
        // Log error but continue processing other applications
        logger.error(
          `Error processing application ${application.applicationId}:`,
          error,
        );

        // Leave status as ANALYZING so it can be retried or manually reviewed
        // Don't crash the entire job
      }
    }

    logger.info("Statement analysis job completed");
  } catch (error: any) {
    logger.error("Statement analysis job error:", error);
    // Don't throw - let job continue running
  }
};
