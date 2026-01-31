/**
 * Advanced Test Data Seeder
 * Manipulates MongoDB directly to create realistic test scenarios
 *
 * Run with: node backend/docs/testing/seed-advanced-data.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models
const Application = require(path.join(__dirname, '../../src/models/Application'));
const TrustWallet = require(path.join(__dirname, '../../src/models/TrustWallet'));
const PaymentTransaction = require(path.join(__dirname, '../../src/models/PaymentTransaction'));
const Withdrawal = require(path.join(__dirname, '../../src/models/Withdrawal'));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'blue');
  console.log('='.repeat(60) + '\n');
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('✓ Connected to MongoDB', 'green');
  } catch (error) {
    log('✗ MongoDB connection failed: ' + error.message, 'red');
    process.exit(1);
  }
}

async function seedAdvancedData() {
  try {
    await connectDB();

    // Get all applications for the test business
    const applications = await Application.find({}).sort({ createdAt: 1 });

    if (applications.length === 0) {
      log('✗ No applications found. Run seed-test-data.sh first!', 'red');
      process.exit(1);
    }

    log(`Found ${applications.length} applications`, 'yellow');

    header('Phase 1: Setting Application Statuses');

    // Application status distribution:
    // - 3 COMPLETED (with full payments)
    // - 3 ACTIVE (with partial payments)
    // - 2 MANDATE_ACTIVE (ready for payments)
    // - 2 MANDATE_CREATED (awaiting activation)
    // - 3 FLAGGED_FOR_REVIEW (manual review needed)
    // - 2 AUTO_DECLINED
    // - 1 DECLINED (manually)
    // - 1 DEFAULTED (failed payments)
    // - Rest: AUTO_APPROVED or ANALYZING

    const statusPlan = [
      // Apps 0-2: COMPLETED
      { index: 0, status: 'COMPLETED', hasPayments: true, paymentsCompleted: 'all' },
      { index: 1, status: 'COMPLETED', hasPayments: true, paymentsCompleted: 'all' },
      { index: 2, status: 'COMPLETED', hasPayments: true, paymentsCompleted: 'all' },

      // Apps 3-5: ACTIVE (partial payments)
      { index: 3, status: 'ACTIVE', hasPayments: true, paymentsCompleted: 'partial' },
      { index: 4, status: 'ACTIVE', hasPayments: true, paymentsCompleted: 'partial' },
      { index: 5, status: 'ACTIVE', hasPayments: true, paymentsCompleted: 'partial' },

      // Apps 6-7: MANDATE_ACTIVE (no payments yet)
      { index: 6, status: 'MANDATE_ACTIVE', hasPayments: false },
      { index: 7, status: 'MANDATE_ACTIVE', hasPayments: false },

      // Apps 8-9: MANDATE_CREATED
      { index: 8, status: 'MANDATE_CREATED', hasPayments: false },
      { index: 9, status: 'MANDATE_CREATED', hasPayments: false },

      // Apps 10-12: FLAGGED_FOR_REVIEW
      { index: 10, status: 'FLAGGED_FOR_REVIEW', hasPayments: false },
      { index: 11, status: 'FLAGGED_FOR_REVIEW', hasPayments: false },
      { index: 12, status: 'FLAGGED_FOR_REVIEW', hasPayments: false },

      // Apps 13-14: AUTO_DECLINED
      { index: 13, status: 'AUTO_DECLINED', hasPayments: false },
      { index: 14, status: 'AUTO_DECLINED', hasPayments: false },

      // App 15: DECLINED (manual)
      { index: 15, status: 'DECLINED', hasPayments: false },

      // App 16: DEFAULTED
      { index: 16, status: 'DEFAULTED', hasPayments: true, paymentsCompleted: 'failed' },
    ];

    for (const plan of statusPlan) {
      if (plan.index >= applications.length) continue;

      const app = applications[plan.index];
      const customerName = `${app.customerDetails.firstName} ${app.customerDetails.lastName}`;

      log(`Setting ${customerName} to ${plan.status}`, 'yellow');

      // Update application status
      app.status = plan.status;

      // Set appropriate fields based on status
      if (['MANDATE_CREATED', 'MANDATE_ACTIVE', 'ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(plan.status)) {
        app.pwaMandateRef = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      if (['MANDATE_ACTIVE', 'ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(plan.status)) {
        app.virtualAccountNumber = `90${Math.floor(10000000 + Math.random() * 90000000)}`;
      }

      if (plan.status === 'FLAGGED_FOR_REVIEW') {
        app.trustEngineOutput = {
          ...app.trustEngineOutput,
          trustScore: 45 + Math.floor(Math.random() * 20), // 45-64
          decision: 'FLAGGED_FOR_REVIEW',
          riskLevel: 'MEDIUM'
        };
      }

      if (plan.status === 'AUTO_DECLINED') {
        app.trustEngineOutput = {
          ...app.trustEngineOutput,
          trustScore: 20 + Math.floor(Math.random() * 15), // 20-34
          decision: 'AUTO_DECLINED',
          riskLevel: 'HIGH'
        };
      }

      if (plan.status === 'DECLINED') {
        app.trustEngineOutput = {
          ...app.trustEngineOutput,
          trustScore: 50,
          decision: 'FLAGGED_FOR_REVIEW',
          riskLevel: 'MEDIUM'
        };
        app.declineReason = 'Incomplete documentation provided';
      }

      if (plan.status === 'DEFAULTED') {
        app.paymentsCompleted = 1;
        app.totalPaid = app.installmentAmount;
        app.outstandingBalance = app.totalAmount - app.totalPaid;
      }

      if (plan.status === 'COMPLETED') {
        app.paymentsCompleted = app.installmentCount;
        app.totalPaid = app.totalAmount;
        app.outstandingBalance = 0;
        app.completedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)); // Completed 0-7 days ago
      }

      if (plan.status === 'ACTIVE' && plan.paymentsCompleted === 'partial') {
        const completedPayments = Math.ceil(app.installmentCount / 2); // Half completed
        app.paymentsCompleted = completedPayments;
        app.totalPaid = app.downPaymentAmount + (app.installmentAmount * completedPayments);
        app.outstandingBalance = app.totalAmount - app.totalPaid;
      }

      await app.save();
      log(`✓ ${customerName}: ${plan.status}`, 'green');

      // Create payments if needed
      if (plan.hasPayments) {
        await createPayments(app, plan.paymentsCompleted);
      }
    }

    header('Phase 2: Creating Additional Payment Transactions');

    // Create scheduled payments for MANDATE_ACTIVE apps
    const mandateActiveApps = applications.filter(app => app.status === 'MANDATE_ACTIVE');
    for (const app of mandateActiveApps) {
      log(`Creating scheduled payments for ${app.customerDetails.firstName}`, 'yellow');
      await createScheduledPayments(app);
    }

    header('Phase 3: Updating TrustWallet Balances & Statistics');

    const trustWallets = await TrustWallet.find({});

    for (const tw of trustWallets) {
      const twApplications = await Application.find({ trustWalletId: tw.trustWalletId });

      let totalRevenue = 0;
      let approvedCount = 0;

      for (const app of twApplications) {
        if (['ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(app.status)) {
          approvedCount++;
          totalRevenue += app.totalPaid || 0;
        }
      }

      tw.statistics = {
        totalApplications: twApplications.length,
        approvedApplications: approvedCount,
        totalRevenue: totalRevenue,
        availableBalance: totalRevenue, // All revenue is available for withdrawal initially
      };

      await tw.save();
      log(`✓ Updated ${tw.name}: ${twApplications.length} apps, ₦${(totalRevenue / 100).toLocaleString()} revenue`, 'green');
    }

    header('Phase 4: Creating Withdrawal Requests');

    // Create 5 withdrawal requests (3 completed, 1 pending, 1 failed)
    const withdrawalData = [
      { status: 'COMPLETED', amount: 50000000, daysAgo: 15 },
      { status: 'COMPLETED', amount: 75000000, daysAgo: 10 },
      { status: 'COMPLETED', amount: 100000000, daysAgo: 5 },
      { status: 'PENDING', amount: 30000000, daysAgo: 1 },
      { status: 'FAILED', amount: 25000000, daysAgo: 3 },
    ];

    for (let i = 0; i < withdrawalData.length && i < trustWallets.length; i++) {
      const tw = trustWallets[i];
      const data = withdrawalData[i];

      // Only create withdrawal if TrustWallet has enough balance
      if (tw.statistics.availableBalance >= data.amount) {
        const withdrawal = await Withdrawal.create({
          withdrawalId: `WTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          trustWalletId: tw.trustWalletId,
          businessId: tw.businessId,
          amount: data.amount,
          status: data.status,
          requestedAt: new Date(Date.now() - data.daysAgo * 24 * 60 * 60 * 1000),
          ...(data.status === 'COMPLETED' && {
            completedAt: new Date(Date.now() - (data.daysAgo - 1) * 24 * 60 * 60 * 1000)
          }),
          ...(data.status === 'FAILED' && {
            failureReason: 'Insufficient funds in settlement account'
          }),
        });

        // Update TrustWallet balance if withdrawal completed
        if (data.status === 'COMPLETED') {
          tw.statistics.availableBalance -= data.amount;
          await tw.save();
        }

        log(`✓ Created ${data.status} withdrawal for ${tw.name}: ₦${(data.amount / 100).toLocaleString()}`, 'green');
      }
    }

    header('Summary');

    const statusCounts = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    log('Application Status Distribution:', 'blue');
    statusCounts.forEach(item => {
      log(`  ${item._id}: ${item.count}`, 'yellow');
    });

    const paymentCounts = await PaymentTransaction.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    log('\nPayment Status Distribution:', 'blue');
    if (paymentCounts.length > 0) {
      paymentCounts.forEach(item => {
        log(`  ${item._id}: ${item.count}`, 'yellow');
      });
    } else {
      log('  No payments created yet', 'yellow');
    }

    const totalWithdrawals = await Withdrawal.countDocuments();
    log(`\nTotal Withdrawals: ${totalWithdrawals}`, 'blue');

    log('\n✓ Advanced data seeding completed successfully!', 'green');
    log('\nYou can now login to the dashboard and see rich test data! 🎉', 'green');

  } catch (error) {
    log('✗ Error: ' + error.message, 'red');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('\n✓ Database connection closed', 'green');
  }
}

async function createPayments(app, paymentType) {
  const baseDate = new Date(app.createdAt);
  const customerName = `${app.customerDetails.firstName} ${app.customerDetails.lastName}`;

  if (paymentType === 'all') {
    // Create all installment payments as SUCCESSFUL
    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      const completedDate = new Date(scheduledDate);
      completedDate.setHours(scheduledDate.getHours() + Math.floor(Math.random() * 24));

      await PaymentTransaction.create({
        transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        applicationId: app.applicationId,
        amount: app.installmentAmount,
        status: 'SUCCESSFUL',
        paymentNumber: i + 1,
        totalPayments: app.installmentCount,
        scheduledDate: scheduledDate,
        completedDate: completedDate,
        pwaTransactionRef: `PWA-TXN-${Date.now()}-${i}`,
        pwaPaymentId: `PWA-PAY-${Date.now()}-${i}`,
      });
    }
    log(`  ✓ Created ${app.installmentCount} SUCCESSFUL payments for ${customerName}`, 'green');

  } else if (paymentType === 'partial') {
    // Create partial payments (some successful, some scheduled)
    const completedPayments = app.paymentsCompleted || Math.ceil(app.installmentCount / 2);

    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      const isCompleted = i < completedPayments;
      const status = isCompleted ? 'SUCCESSFUL' : 'SCHEDULED';

      await PaymentTransaction.create({
        transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        applicationId: app.applicationId,
        amount: app.installmentAmount,
        status: status,
        paymentNumber: i + 1,
        totalPayments: app.installmentCount,
        scheduledDate: scheduledDate,
        ...(isCompleted && {
          completedDate: new Date(scheduledDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000))
        }),
        ...(isCompleted && {
          pwaTransactionRef: `PWA-TXN-${Date.now()}-${i}`,
          pwaPaymentId: `PWA-PAY-${Date.now()}-${i}`,
        }),
      });
    }
    log(`  ✓ Created ${completedPayments} SUCCESSFUL + ${app.installmentCount - completedPayments} SCHEDULED payments for ${customerName}`, 'green');

  } else if (paymentType === 'failed') {
    // Create payments with failures (for DEFAULTED status)
    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      let status;
      if (i === 0) {
        status = 'SUCCESSFUL'; // First payment succeeded
      } else if (i < 4) {
        status = 'FAILED'; // Next 3 payments failed
      } else {
        status = 'SCHEDULED'; // Rest are scheduled
      }

      await PaymentTransaction.create({
        transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        applicationId: app.applicationId,
        amount: app.installmentAmount,
        status: status,
        paymentNumber: i + 1,
        totalPayments: app.installmentCount,
        scheduledDate: scheduledDate,
        ...(status === 'SUCCESSFUL' && {
          completedDate: new Date(scheduledDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000)),
          pwaTransactionRef: `PWA-TXN-${Date.now()}-${i}`,
          pwaPaymentId: `PWA-PAY-${Date.now()}-${i}`,
        }),
        ...(status === 'FAILED' && {
          failureReason: 'Insufficient funds',
          pwaTransactionRef: `PWA-TXN-${Date.now()}-${i}`,
        }),
      });
    }
    log(`  ✓ Created 1 SUCCESSFUL + 3 FAILED + ${app.installmentCount - 4} SCHEDULED payments for ${customerName}`, 'green');
  }
}

async function createScheduledPayments(app) {
  const baseDate = new Date(app.createdAt);

  for (let i = 0; i < app.installmentCount; i++) {
    const scheduledDate = new Date(baseDate);
    if (app.installmentPlan.frequency === 'monthly') {
      scheduledDate.setMonth(baseDate.getMonth() + i + 1);
    } else {
      scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
    }

    await PaymentTransaction.create({
      transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      applicationId: app.applicationId,
      amount: app.installmentAmount,
      status: 'SCHEDULED',
      paymentNumber: i + 1,
      totalPayments: app.installmentCount,
      scheduledDate: scheduledDate,
    });
  }

  log(`  ✓ Created ${app.installmentCount} SCHEDULED payments`, 'green');
}

// Run the seeder
seedAdvancedData();
