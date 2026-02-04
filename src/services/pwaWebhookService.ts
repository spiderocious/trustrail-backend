import Application from '../models/Application';
import Business from '../models/Business';
import PWAWebhookLog from '../models/PWAWebhookLog';
import { generatePWAWebhookLogId } from '../utils/idGenerator';
import { verifyPWAWebhookSignature } from '../utils/signatureGenerator';
import { updatePaymentStatus } from './paymentService';
import { sendInstallmentInvoice } from './pwaService';
import { sendWebhook } from './webhookService';
import { logSystemAction } from './auditService';
import logger from '../config/logger';

/**
 * Process incoming PWA webhook
 * Main entry point for all PWA webhooks
 */
export const processWebhook = async (rawPayload: any): Promise<{ success: boolean }> => {
  const logId = generatePWAWebhookLogId();

  try {
    // Extract key fields from webhook payload
    const requestRef = rawPayload.request_ref || '';
    const requestType = rawPayload.request_type || '';
    const eventType = rawPayload.details?.meta?.event_type || '';
    const transactionType = rawPayload.transaction_type || '';
    const billerCode = rawPayload.details?.meta?.biller_code || '';
    const transactionRef = rawPayload.details?.transaction_ref || '';
    const status = rawPayload.details?.status || '';
    const signatureHash = rawPayload.details?.meta?.signature_hash || rawPayload.signature_hash || '';

    // Verify signature
    const signatureValid = verifyPWAWebhookSignature(requestRef, signatureHash);

    // Determine event type if not explicitly provided
    let finalEventType = eventType;
    if (!finalEventType) {
      if (transactionType === 'activate_mandate' || requestType === 'activate_mandate') {
        finalEventType = 'activate_mandate';
      } else if (rawPayload.details?.meta?.cr_account) {
        finalEventType = 'credit';
      } else {
        finalEventType = 'debit';
      }
    }

    // Create webhook log
    const webhookLog = await PWAWebhookLog.create({
      logId,
      eventType: finalEventType,
      requestType,
      requestRef,
      rawPayload,
      billerCode,
      transactionRef,
      status,
      signatureValid,
      processedSuccessfully: false,
      receivedAt: new Date(),
    });

    // Route to appropriate handler based on event type
    try {
      if (finalEventType === 'debit') {
        await handleDebitEvent(rawPayload);
      } else if (finalEventType === 'credit') {
        await handleCreditEvent(rawPayload);
      } else if (finalEventType === 'activate_mandate') {
        await handleMandateActivation(rawPayload);
      } else {
        logger.warn(`Unknown PWA webhook event type: ${finalEventType}`);
      }

      // Mark as processed successfully
      webhookLog.processedSuccessfully = true;
      webhookLog.processedAt = new Date();
      await webhookLog.save();

      logger.info(`PWA webhook processed successfully: ${logId}, event: ${finalEventType}`);
      return { success: true };
    } catch (error: any) {
      // Log processing error
      webhookLog.errorMessage = error.message;
      webhookLog.processedAt = new Date();
      await webhookLog.save();

      logger.error(`PWA webhook processing failed: ${logId}`, error);
      return { success: false };
    }
  } catch (error: any) {
    logger.error('Error in processWebhook:', error);
    return { success: false };
  }
};

/**
 * Handle debit event (installment payment success/failure)
 */
const handleDebitEvent = async (payload: any): Promise<void> => {
  try {
    // Extract fields
    const transactionRef = payload.details?.transaction_ref || '';
    const status = payload.details?.status || '';
    const pwaPaymentId = payload.details?.meta?.payment_id || '';
    const failureReason = payload.details?.meta?.failure_reason || payload.details?.meta?.reason || 'Payment failed';
    const amount = parseFloat(payload.details?.amount || '0');

    if (!transactionRef) {
      throw new Error('Transaction reference not found in debit webhook');
    }

    // Check if payment transaction exists, create if not (fallback for PWA-initiated debits)
    const PaymentTransaction = (await import('../models/PaymentTransaction')).default;
    let payment = await PaymentTransaction.findOne({ transactionId: transactionRef });

    if (!payment) {
      // Payment doesn't exist - create it (PWA initiated the debit)
      logger.warn(`Payment transaction ${transactionRef} not found - creating from debit webhook`);

      // Try to find the application by matching biller code and amount
      const billerCode = payload.details?.meta?.biller_code || '';
      const business = await Business.findOne({ billerCode });

      if (!business) {
        throw new Error(`Business not found for biller code: ${billerCode}`);
      }

      // Find an active application for this business with matching installment amount
      const application = await Application.findOne({
        businessId: business.businessId,
        status: 'ACTIVE',
        installmentAmount: amount,
      }).sort({ createdAt: -1 });

      if (!application) {
        throw new Error(`No matching active application found for amount: ${amount}`);
      }

      // Create payment transaction
      const paymentsCompleted = application.paymentsCompleted || 0;
      payment = await PaymentTransaction.create({
        transactionId: transactionRef,
        applicationId: application.applicationId,
        trustWalletId: application.trustWalletId,
        businessId: application.businessId,
        amount,
        status: 'PENDING',
        paymentNumber: paymentsCompleted + 1,
        totalPayments: application.installmentCount,
        scheduledDate: new Date(),
        pwaTransactionRef: transactionRef,
        pwaPaymentId,
      });

      logger.info(`Created payment transaction ${transactionRef} for application ${application.applicationId}`);
    }

    // Update payment status
    const paymentStatus = status === 'Successful' ? 'SUCCESSFUL' : 'FAILED';
    const paidDate = status === 'Successful' ? new Date() : undefined;

    await updatePaymentStatus(
      transactionRef,
      paymentStatus,
      paidDate,
      pwaPaymentId,
      paymentStatus === 'FAILED' ? failureReason : undefined
    );

    // Reload payment to get updated data
    payment = await PaymentTransaction.findOne({ transactionId: transactionRef });

    if (payment) {
      // Get application and business
      const application = await Application.findOne({ applicationId: payment.applicationId });
      if (application) {
        const business = await Business.findOne({ businessId: application.businessId });

        // Send webhook to business
        if (business) {
          const webhookEvent = status === 'Successful' ? 'payment.success' : 'payment.failed';
          const webhookPayload = {
            event: webhookEvent,
            applicationId: application.applicationId,
            transactionId: payment.transactionId,
            amount: payment.amount,
            paymentNumber: payment.paymentNumber,
            totalPayments: payment.totalPayments,
            paidDate: payment.paidDate,
            failureReason: payment.failureReason,
            customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
            trustWalletId: application.trustWalletId,
          };

          await sendWebhook(business.businessId, webhookEvent, webhookPayload);
        }
      }
    }

    logger.info(`Debit event processed: ${transactionRef}, status: ${status}`);
  } catch (error: any) {
    logger.error('Error in handleDebitEvent:', error);
    throw error;
  }
};

/**
 * Handle credit event (down payment received)
 */
const handleCreditEvent = async (payload: any): Promise<void> => {
  try {
    // Extract fields
    const virtualAccount = payload.details?.meta?.cr_account || '';
    const amount = parseFloat(payload.details?.amount || '0');

    if (!virtualAccount) {
      throw new Error('Virtual account not found in credit webhook');
    }

    // Find application by virtual account number
    const application = await Application.findOne({ virtualAccountNumber: virtualAccount });
    if (!application) {
      throw new Error(`Application not found for virtual account: ${virtualAccount}`);
    }

    // Verify amount matches down payment required
    if (Math.abs(amount - application.downPaymentRequired) > 0.01) {
      logger.warn(`Down payment amount mismatch. Expected: ${application.downPaymentRequired}, Received: ${amount}`);
    }

    // Update application
    application.downPaymentReceived = true;
    application.downPaymentReceivedAt = new Date();
    application.downPaymentAmount = amount;
    application.totalPaid = (application.totalPaid || 0) + amount;
    application.outstandingBalance = Math.max(0, application.outstandingBalance - amount);
    application.status = 'ACTIVE'; // Move to active status
    await application.save();

    // Log audit
    await logSystemAction(
      'downpayment.received',
      'Application',
      application.applicationId,
      undefined,
      {
        amount,
        virtualAccount,
      }
    );

    // Get business
    const business = await Business.findOne({ businessId: application.businessId });
    if (!business) {
      throw new Error(`Business not found: ${application.businessId}`);
    }

    // Send webhook to business
    const webhookPayload = {
      event: 'downpayment.received',
      applicationId: application.applicationId,
      amount,
      virtualAccount,
      customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
      trustWalletId: application.trustWalletId,
      nextSteps: 'Installment payments will be automatically debited from customer account as per schedule',
      firstPaymentDate: application.mandateActivatedAt,
    };

    await sendWebhook(business.businessId, 'downpayment.received', webhookPayload);

    logger.info(`Down payment received for application ${application.applicationId}: ${amount}`);
  } catch (error: any) {
    logger.error('Error in handleCreditEvent:', error);
    throw error;
  }
};

/**
 * Handle mandate activation webhook from NIBSS
 */
const handleMandateActivation = async (payload: any): Promise<void> => {
  try {
    // Extract mandate reference - can be in multiple locations
    const mandateRef =
      payload.details?.transaction_ref ||
      payload.details?.data?.data?.reference ||
      payload.transaction_ref ||
      '';

    const pwaMandateId = payload.details?.data?.data?.id || payload.details?.mandate_id || '';

    if (!mandateRef) {
      throw new Error('Mandate reference not found in activation webhook');
    }

    // Find application by mandate reference
    const application = await Application.findOne({ pwaMandateRef: mandateRef });
    if (!application) {
      throw new Error(`Application not found for mandate reference: ${mandateRef}`);
    }

    // Check if virtual account already exists (idempotency check)
    if (application.virtualAccountNumber && application.status === 'MANDATE_ACTIVE') {
      logger.info(`Virtual account already exists for ${application.applicationId} - skipping duplicate webhook processing`);

      // Just update PWA mandate ID if not set
      if (!application.pwaMandateId && pwaMandateId) {
        application.pwaMandateId = pwaMandateId;
        await application.save();
        logger.info(`Updated PWA mandate ID for ${application.applicationId}: ${pwaMandateId}`);
      }

      return; // Skip duplicate processing
    }

    // Update application status
    application.status = 'MANDATE_ACTIVE';
    application.pwaMandateId = pwaMandateId;
    application.mandateActivatedAt = new Date();
    await application.save();

    // Log audit
    await logSystemAction(
      'mandate.activated',
      'Application',
      application.applicationId,
      undefined,
      {
        pwaMandateRef: mandateRef,
        pwaMandateId,
      }
    );

    // Get business
    const business = await Business.findOne({ businessId: application.businessId });
    if (!business) {
      throw new Error(`Business not found: ${application.businessId}`);
    }

    // Only call sendInstallmentInvoice if virtual account doesn't exist yet
    if (!application.virtualAccountNumber) {
      logger.info(`Creating virtual account for ${application.applicationId} via webhook`);

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
        new Date()
      );

      // Update application with virtual account number
      application.virtualAccountNumber = invoiceResult.virtualAccountNumber;
      await application.save();

      // Send webhook to business
      const webhookPayload = {
        event: 'mandate.activated',
        applicationId: application.applicationId,
        mandateRef,
        pwaMandateId,
        virtualAccount: invoiceResult.virtualAccountNumber,
        downPaymentRequired: application.downPaymentRequired,
        customerName: `${application.customerDetails.firstName} ${application.customerDetails.lastName}`,
        trustWalletId: application.trustWalletId,
        nextSteps: 'Customer should pay down payment to the virtual account to activate installment plan',
      };

      await sendWebhook(business.businessId, 'mandate.activated', webhookPayload);

      logger.info(`Mandate activated for application ${application.applicationId}. Virtual account: ${invoiceResult.virtualAccountNumber}`);
    } else {
      logger.info(`Virtual account already exists for ${application.applicationId}: ${application.virtualAccountNumber}`);
    }
  } catch (error: any) {
    logger.error('Error in handleMandateActivation:', error);
    throw error;
  }
};
