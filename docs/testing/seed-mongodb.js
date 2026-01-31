/**
 * MongoDB Direct Seeding Script
 * Run with: mongosh <connection-string> seed-mongodb.js
 */

// Get all applications
const applications = db.applications.find({}).toArray();

if (applications.length === 0) {
  print('❌ No applications found!');
  quit(1);
}

print(`Found ${applications.length} applications\n`);

// Status distribution plan
const statusUpdates = [
  // Apps 0-2: COMPLETED
  { index: 0, status: 'COMPLETED', paymentsCompleted: 'all' },
  { index: 1, status: 'COMPLETED', paymentsCompleted: 'all' },
  { index: 2, status: 'COMPLETED', paymentsCompleted: 'all' },

  // Apps 3-5: ACTIVE
  { index: 3, status: 'ACTIVE', paymentsCompleted: 'partial' },
  { index: 4, status: 'ACTIVE', paymentsCompleted: 'partial' },
  { index: 5, status: 'ACTIVE', paymentsCompleted: 'partial' },

  // Apps 6-7: MANDATE_ACTIVE
  { index: 6, status: 'MANDATE_ACTIVE' },
  { index: 7, status: 'MANDATE_ACTIVE' },

  // Apps 8-9: MANDATE_CREATED
  { index: 8, status: 'MANDATE_CREATED' },
  { index: 9, status: 'MANDATE_CREATED' },

  // Apps 10-12: FLAGGED_FOR_REVIEW
  { index: 10, status: 'FLAGGED_FOR_REVIEW', trustScore: 55 },
  { index: 11, status: 'FLAGGED_FOR_REVIEW', trustScore: 52 },
  { index: 12, status: 'FLAGGED_FOR_REVIEW', trustScore: 48 },

  // Apps 13-14: AUTO_DECLINED
  { index: 13, status: 'AUTO_DECLINED', trustScore: 28 },
  { index: 14, status: 'AUTO_DECLINED', trustScore: 22 },

  // App 15: DECLINED
  { index: 15, status: 'DECLINED', trustScore: 50 },

  // App 16: DEFAULTED
  { index: 16, status: 'DEFAULTED', paymentsCompleted: 'failed' },
];

print('===============================================');
print('Phase 1: Updating Application Statuses');
print('===============================================\n');

statusUpdates.forEach(plan => {
  if (plan.index >= applications.length) return;

  const app = applications[plan.index];
  const customerName = `${app.customerDetails.firstName} ${app.customerDetails.lastName}`;

  print(`Setting ${customerName} to ${plan.status}`);

  const updateData = { status: plan.status };

  // Add mandate ref for certain statuses
  if (['MANDATE_CREATED', 'MANDATE_ACTIVE', 'ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(plan.status)) {
    updateData.pwaMandateRef = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add virtual account for active statuses
  if (['MANDATE_ACTIVE', 'ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(plan.status)) {
    updateData.virtualAccountNumber = `90${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  // Update trust scores for specific statuses
  if (plan.status === 'FLAGGED_FOR_REVIEW') {
    updateData['trustEngineOutput.trustScore'] = plan.trustScore;
    updateData['trustEngineOutput.decision'] = 'FLAGGED_FOR_REVIEW';
    updateData['trustEngineOutput.riskLevel'] = 'MEDIUM';
  }

  if (plan.status === 'AUTO_DECLINED') {
    updateData['trustEngineOutput.trustScore'] = plan.trustScore;
    updateData['trustEngineOutput.decision'] = 'AUTO_DECLINED';
    updateData['trustEngineOutput.riskLevel'] = 'HIGH';
  }

  if (plan.status === 'DECLINED') {
    updateData.declineReason = 'Incomplete documentation provided';
  }

  if (plan.status === 'COMPLETED') {
    updateData.paymentsCompleted = app.installmentCount;
    updateData.totalPaid = app.totalAmount;
    updateData.outstandingBalance = 0;
    updateData.completedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
  }

  if (plan.status === 'ACTIVE' && plan.paymentsCompleted === 'partial') {
    const completed = Math.ceil(app.installmentCount / 2);
    updateData.paymentsCompleted = completed;
    updateData.totalPaid = app.downPaymentAmount + (app.installmentAmount * completed);
    updateData.outstandingBalance = app.totalAmount - updateData.totalPaid;
  }

  if (plan.status === 'DEFAULTED') {
    updateData.paymentsCompleted = 1;
    updateData.totalPaid = app.installmentAmount;
    updateData.outstandingBalance = app.totalAmount - updateData.totalPaid;
  }

  db.applications.updateOne(
    { _id: app._id },
    { $set: updateData }
  );

  // Create payments
  if (plan.paymentsCompleted) {
    createPayments(app, plan.paymentsCompleted);
  }
});

function createPayments(app, paymentType) {
  const baseDate = new Date(app.createdAt);

  if (paymentType === 'all') {
    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      const completedDate = new Date(scheduledDate);
      completedDate.setHours(completedDate.getHours() + Math.floor(Math.random() * 24));

      db.paymenttransactions.insertOne({
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
        createdAt: scheduledDate,
        updatedAt: completedDate
      });
    }
    print(`  ✓ Created ${app.installmentCount} SUCCESSFUL payments`);
  }

  else if (paymentType === 'partial') {
    const completedPayments = Math.ceil(app.installmentCount / 2);

    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      const isCompleted = i < completedPayments;
      const status = isCompleted ? 'SUCCESSFUL' : 'SCHEDULED';

      const payment = {
        transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        applicationId: app.applicationId,
        amount: app.installmentAmount,
        status: status,
        paymentNumber: i + 1,
        totalPayments: app.installmentCount,
        scheduledDate: scheduledDate,
        createdAt: scheduledDate,
        updatedAt: scheduledDate
      };

      if (isCompleted) {
        payment.completedDate = new Date(scheduledDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
        payment.pwaTransactionRef = `PWA-TXN-${Date.now()}-${i}`;
        payment.pwaPaymentId = `PWA-PAY-${Date.now()}-${i}`;
      }

      db.paymenttransactions.insertOne(payment);
    }
    print(`  ✓ Created ${completedPayments} SUCCESSFUL + ${app.installmentCount - completedPayments} SCHEDULED payments`);
  }

  else if (paymentType === 'failed') {
    for (let i = 0; i < app.installmentCount; i++) {
      const scheduledDate = new Date(baseDate);
      if (app.installmentPlan.frequency === 'monthly') {
        scheduledDate.setMonth(baseDate.getMonth() + i + 1);
      } else {
        scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
      }

      let status = 'SCHEDULED';
      if (i === 0) status = 'SUCCESSFUL';
      else if (i < 4) status = 'FAILED';

      const payment = {
        transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        applicationId: app.applicationId,
        amount: app.installmentAmount,
        status: status,
        paymentNumber: i + 1,
        totalPayments: app.installmentCount,
        scheduledDate: scheduledDate,
        createdAt: scheduledDate,
        updatedAt: scheduledDate
      };

      if (status === 'SUCCESSFUL') {
        payment.completedDate = new Date(scheduledDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
        payment.pwaTransactionRef = `PWA-TXN-${Date.now()}-${i}`;
        payment.pwaPaymentId = `PWA-PAY-${Date.now()}-${i}`;
      }

      if (status === 'FAILED') {
        payment.failureReason = 'Insufficient funds';
        payment.pwaTransactionRef = `PWA-TXN-${Date.now()}-${i}`;
      }

      db.paymenttransactions.insertOne(payment);
    }
    print(`  ✓ Created 1 SUCCESSFUL + 3 FAILED + ${app.installmentCount - 4} SCHEDULED payments`);
  }
}

// Create scheduled payments for MANDATE_ACTIVE apps
print('\n===============================================');
print('Phase 2: Creating Scheduled Payments');
print('===============================================\n');

const mandateActiveApps = db.applications.find({ status: 'MANDATE_ACTIVE' }).toArray();
mandateActiveApps.forEach(app => {
  const baseDate = new Date(app.createdAt);

  for (let i = 0; i < app.installmentCount; i++) {
    const scheduledDate = new Date(baseDate);
    if (app.installmentPlan.frequency === 'monthly') {
      scheduledDate.setMonth(baseDate.getMonth() + i + 1);
    } else {
      scheduledDate.setDate(baseDate.getDate() + ((i + 1) * 7));
    }

    db.paymenttransactions.insertOne({
      transactionId: `INST-PAY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      applicationId: app.applicationId,
      amount: app.installmentAmount,
      status: 'SCHEDULED',
      paymentNumber: i + 1,
      totalPayments: app.installmentCount,
      scheduledDate: scheduledDate,
      createdAt: scheduledDate,
      updatedAt: scheduledDate
    });
  }

  print(`✓ Created ${app.installmentCount} SCHEDULED payments for ${app.customerDetails.firstName}`);
});

// Update TrustWallet statistics and balances
print('\n===============================================');
print('Phase 3: Updating TrustWallet Balances');
print('===============================================\n');

const trustWallets = db.trustwallets.find({}).toArray();
trustWallets.forEach(tw => {
  const twApplications = db.applications.find({ trustWalletId: tw.trustWalletId }).toArray();

  let totalRevenue = 0;
  let approvedCount = 0;

  twApplications.forEach(app => {
    if (['ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(app.status)) {
      approvedCount++;
      totalRevenue += app.totalPaid || 0;
    }
  });

  db.trustwallets.updateOne(
    { _id: tw._id },
    {
      $set: {
        'statistics.totalApplications': twApplications.length,
        'statistics.approvedApplications': approvedCount,
        'statistics.totalRevenue': totalRevenue,
        'statistics.availableBalance': totalRevenue
      }
    }
  );

  print(`✓ Updated ${tw.name}: ${twApplications.length} apps, ₦${(totalRevenue / 100).toLocaleString()} revenue`);
});

// Create withdrawal requests
print('\n===============================================');
print('Phase 4: Creating Withdrawals');
print('===============================================\n');

const withdrawalData = [
  { status: 'COMPLETED', amount: 50000000, daysAgo: 15 },
  { status: 'COMPLETED', amount: 75000000, daysAgo: 10 },
  { status: 'COMPLETED', amount: 100000000, daysAgo: 5 },
  { status: 'PENDING', amount: 30000000, daysAgo: 1 },
  { status: 'FAILED', amount: 25000000, daysAgo: 3 },
];

const tws = db.trustwallets.find({}).toArray();
withdrawalData.forEach((data, i) => {
  if (i >= tws.length) return;

  const tw = tws[i];
  if (tw.statistics.availableBalance >= data.amount) {
    const withdrawal = {
      withdrawalId: `WTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trustWalletId: tw.trustWalletId,
      businessId: tw.businessId,
      amount: data.amount,
      status: data.status,
      requestedAt: new Date(Date.now() - data.daysAgo * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (data.status === 'COMPLETED') {
      withdrawal.completedAt = new Date(Date.now() - (data.daysAgo - 1) * 24 * 60 * 60 * 1000);

      // Update TrustWallet balance
      db.trustwallets.updateOne(
        { _id: tw._id },
        { $inc: { 'statistics.availableBalance': -data.amount } }
      );
    }

    if (data.status === 'FAILED') {
      withdrawal.failureReason = 'Insufficient funds in settlement account';
    }

    db.withdrawals.insertOne(withdrawal);
    print(`✓ Created ${data.status} withdrawal for ${tw.name}: ₦${(data.amount / 100).toLocaleString()}`);
  }
});

// Summary
print('\n===============================================');
print('SUMMARY');
print('===============================================\n');

const statusCounts = db.applications.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();

print('Application Status Distribution:');
statusCounts.forEach(item => {
  print(`  ${item._id}: ${item.count}`);
});

const paymentCounts = db.paymenttransactions.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();

print('\nPayment Status Distribution:');
paymentCounts.forEach(item => {
  print(`  ${item._id}: ${item.count}`);
});

const totalWithdrawals = db.withdrawals.countDocuments();
print(`\nTotal Withdrawals: ${totalWithdrawals}`);

print('\n✅ Advanced data seeding completed!');
print('🎉 You can now login and see rich test data!\n');
