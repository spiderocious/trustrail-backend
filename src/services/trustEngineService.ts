import { parseBankStatementCSV, Transaction } from '../utils/csvParser';
import { getMonthsBetween } from '../utils/dateUtils';
import TrustEngineOutput from '../models/TrustEngineOutput';
import { generateTrustEngineOutputId } from '../utils/idGenerator';
import {
  TrustEngineAnalysisResult,
  IncomeAnalysis,
  SpendingAnalysis,
  BalanceAnalysis,
  BehaviorAnalysis,
  DebtProfile,
  AffordabilityAssessment,
  RiskFlag,
  CATEGORY_KEYWORDS,
  BOUNCE_KEYWORDS,
} from '../types/trustEngine.types';
import { IApprovalWorkflow } from '../models/TrustWallet';
import logger from '../config/logger';

/**
 * Analyze bank statement CSV and generate trust score
 */
export const analyzeStatement = async (
  csvContent: Buffer | string,
  installmentAmount: number,
  approvalWorkflow: IApprovalWorkflow
): Promise<TrustEngineAnalysisResult> => {
  // Parse CSV
  const transactions = await parseBankStatementCSV(csvContent);

  if (transactions.length === 0) {
    throw new Error('No transactions found in CSV');
  }

  // Get date range
  const startDate = transactions[0].date;
  const endDate = transactions[transactions.length - 1].date;
  const monthsAnalyzed = Math.max(getMonthsBetween(startDate, endDate), 1);

  // Perform analyses
  const incomeAnalysis = analyzeIncome(transactions, monthsAnalyzed);
  const spendingAnalysis = analyzeSpending(transactions, monthsAnalyzed);
  const balanceAnalysis = analyzeBalance(transactions);
  const behaviorAnalysis = analyzeBehavior(transactions, monthsAnalyzed);
  const debtProfile = calculateDebtProfile(incomeAnalysis, spendingAnalysis);
  const affordabilityAssessment = assessAffordability(
    incomeAnalysis,
    spendingAnalysis,
    debtProfile,
    installmentAmount
  );

  // Generate risk flags
  const riskFlags = generateRiskFlags(
    behaviorAnalysis,
    spendingAnalysis,
    debtProfile,
    affordabilityAssessment
  );

  // Calculate trust score
  const trustScore = calculateTrustScore(
    incomeAnalysis,
    spendingAnalysis,
    balanceAnalysis,
    behaviorAnalysis,
    affordabilityAssessment,
    installmentAmount
  );

  // Make decision
  const decision = makeDecision(trustScore, approvalWorkflow, affordabilityAssessment);

  // Rule compliance
  const ruleCompliance = {
    passedMinTrustScore: trustScore >= approvalWorkflow.minTrustScore,
    overallPass: decision === 'APPROVED',
  };

  return {
    decision,
    trustScore,
    periodCovered: {
      startDate,
      endDate,
      monthsAnalyzed,
    },
    incomeAnalysis,
    spendingAnalysis,
    balanceAnalysis,
    behaviorAnalysis,
    debtProfile,
    affordabilityAssessment,
    riskFlags,
    ruleCompliance,
  };
};

/**
 * Analyze income patterns
 */
const analyzeIncome = (transactions: Transaction[], monthsAnalyzed: number): IncomeAnalysis => {
  const creditTransactions = transactions.filter(tx => tx.credit > 0);
  const totalIncome = creditTransactions.reduce((sum, tx) => sum + tx.credit, 0);
  const avgMonthlyIncome = totalIncome / monthsAnalyzed;

  // Detect income sources
  const incomeSources: any[] = [];
  const salaryTxs = creditTransactions.filter(tx =>
    CATEGORY_KEYWORDS.salary.some(keyword => tx.description.toUpperCase().includes(keyword))
  );
  const freelanceTxs = creditTransactions.filter(tx =>
    CATEGORY_KEYWORDS.freelance.some(keyword => tx.description.toUpperCase().includes(keyword))
  );
  const businessTxs = creditTransactions.filter(tx =>
    CATEGORY_KEYWORDS.business.some(keyword => tx.description.toUpperCase().includes(keyword))
  );

  if (salaryTxs.length > 0) {
    const avgAmount = salaryTxs.reduce((sum, tx) => sum + tx.credit, 0) / salaryTxs.length;
    incomeSources.push({
      description: 'SALARY',
      frequency: 'monthly',
      avgAmount,
    });
  }

  if (freelanceTxs.length > 0) {
    const avgAmount = freelanceTxs.reduce((sum, tx) => sum + tx.credit, 0) / freelanceTxs.length;
    incomeSources.push({
      description: 'FREELANCE',
      frequency: 'irregular',
      avgAmount,
    });
  }

  if (businessTxs.length > 0) {
    const avgAmount = businessTxs.reduce((sum, tx) => sum + tx.credit, 0) / businessTxs.length;
    incomeSources.push({
      description: 'BUSINESS',
      frequency: 'irregular',
      avgAmount,
    });
  }

  // Calculate income consistency (simplified: ratio of months with income)
  const monthsWithIncome = Math.min(creditTransactions.length / 5, monthsAnalyzed); // Assume ~5 credits per month minimum
  const incomeConsistency = Math.min(monthsWithIncome / monthsAnalyzed, 1);

  return {
    totalIncome,
    avgMonthlyIncome,
    incomeConsistency,
    incomeSources,
  };
};

/**
 * Analyze spending patterns
 */
const analyzeSpending = (transactions: Transaction[], monthsAnalyzed: number): SpendingAnalysis => {
  const debitTransactions = transactions.filter(tx => tx.debit > 0);
  const totalSpending = debitTransactions.reduce((sum, tx) => sum + tx.debit, 0);
  const avgMonthlySpending = totalSpending / monthsAnalyzed;

  // Categorize spending
  const spendingCategories = {
    bills: 0,
    loans: 0,
    gambling: 0,
    transfers: 0,
    other: 0,
  };

  debitTransactions.forEach(tx => {
    const desc = tx.description.toUpperCase();
    let categorized = false;

    if (CATEGORY_KEYWORDS.bills.some(keyword => desc.includes(keyword))) {
      spendingCategories.bills += tx.debit;
      categorized = true;
    }
    if (CATEGORY_KEYWORDS.loans.some(keyword => desc.includes(keyword))) {
      spendingCategories.loans += tx.debit;
      categorized = true;
    }
    if (CATEGORY_KEYWORDS.gambling.some(keyword => desc.includes(keyword))) {
      spendingCategories.gambling += tx.debit;
      categorized = true;
    }
    if (!categorized && (desc.includes('TRANSFER') || desc.includes('FIP') || desc.includes('NIP'))) {
      spendingCategories.transfers += tx.debit;
    } else if (!categorized) {
      spendingCategories.other += tx.debit;
    }
  });

  return {
    totalSpending,
    avgMonthlySpending,
    spendingCategories,
  };
};

/**
 * Analyze balance patterns
 */
const analyzeBalance = (transactions: Transaction[]): BalanceAnalysis => {
  const balances = transactions.map(tx => tx.balance);
  const avgBalance = balances.reduce((sum, b) => sum + b, 0) / balances.length;
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const closingBalance = balances[balances.length - 1];

  return {
    avgBalance,
    minBalance,
    maxBalance,
    closingBalance,
  };
};

/**
 * Analyze transaction behavior
 */
const analyzeBehavior = (transactions: Transaction[], monthsAnalyzed: number): BehaviorAnalysis => {
  const transactionCount = transactions.length;
  const days = Math.max(monthsAnalyzed * 30, 1);
  const avgDailyTransactions = transactionCount / days;

  // Detect bounces
  const bounceCount = transactions.filter(tx =>
    BOUNCE_KEYWORDS.some(keyword => tx.description.toUpperCase().includes(keyword))
  ).length;

  // Detect overdraft usage
  const overdraftUsage = transactions.some(tx => tx.balance < 0);

  return {
    transactionCount,
    avgDailyTransactions,
    bounceCount,
    overdraftUsage,
  };
};

/**
 * Calculate debt profile
 */
const calculateDebtProfile = (
  incomeAnalysis: IncomeAnalysis,
  spendingAnalysis: SpendingAnalysis
): DebtProfile => {
  const existingLoanRepayments = spendingAnalysis.spendingCategories.loans;
  const monthlyLoans = existingLoanRepayments; // Assume this is already monthly
  const debtToIncomeRatio = incomeAnalysis.avgMonthlyIncome > 0
    ? monthlyLoans / incomeAnalysis.avgMonthlyIncome
    : 0;

  return {
    existingLoanRepayments: monthlyLoans,
    debtToIncomeRatio,
  };
};

/**
 * Assess affordability
 */
const assessAffordability = (
  incomeAnalysis: IncomeAnalysis,
  spendingAnalysis: SpendingAnalysis,
  debtProfile: DebtProfile,
  installmentAmount: number
): AffordabilityAssessment => {
  const disposableIncome =
    incomeAnalysis.avgMonthlyIncome -
    (spendingAnalysis.avgMonthlySpending + debtProfile.existingLoanRepayments);

  const affordabilityRatio = disposableIncome > 0
    ? installmentAmount / disposableIncome
    : 1;

  const canAffordInstallment = affordabilityRatio < 0.5; // Installment must be < 50% of disposable income
  const cushion = disposableIncome - installmentAmount;

  return {
    canAffordInstallment,
    monthlyInstallmentAmount: installmentAmount,
    disposableIncome,
    affordabilityRatio,
    cushion,
  };
};

/**
 * Calculate trust score (0-100)
 */
const calculateTrustScore = (
  incomeAnalysis: IncomeAnalysis,
  spendingAnalysis: SpendingAnalysis,
  balanceAnalysis: BalanceAnalysis,
  behaviorAnalysis: BehaviorAnalysis,
  affordabilityAssessment: AffordabilityAssessment,
  installmentAmount: number
): number => {
  let score = 0;

  // 1. Income Stability (30 points)
  score += incomeAnalysis.incomeConsistency * 15; // 15 points max
  const incomeToInstallmentRatio = installmentAmount / incomeAnalysis.avgMonthlyIncome;
  if (incomeToInstallmentRatio < 0.2) score += 15;
  else if (incomeToInstallmentRatio < 0.3) score += 10;
  else if (incomeToInstallmentRatio < 0.4) score += 5;

  // 2. Spending Behavior (25 points)
  const debtRatio = affordabilityAssessment.disposableIncome > 0
    ? spendingAnalysis.spendingCategories.loans / incomeAnalysis.avgMonthlyIncome
    : 1;
  score += Math.max(0, 10 - debtRatio * 20); // 10 points max
  if (spendingAnalysis.spendingCategories.gambling > 0) {
    score -= Math.min(10, spendingAnalysis.spendingCategories.gambling / 1000);
  }
  const savingsRate = (incomeAnalysis.avgMonthlyIncome - spendingAnalysis.avgMonthlySpending) / incomeAnalysis.avgMonthlyIncome;
  score += Math.min(15, savingsRate * 20); // 15 points max

  // 3. Balance Health (20 points)
  if (balanceAnalysis.avgBalance > installmentAmount * 2) score += 10;
  else if (balanceAnalysis.avgBalance > installmentAmount) score += 5;

  if (balanceAnalysis.minBalance > installmentAmount) score += 10;
  else if (balanceAnalysis.minBalance > installmentAmount * 0.5) score += 5;

  // 4. Transaction Behavior (15 points)
  if (behaviorAnalysis.bounceCount === 0) score += 5;
  else if (behaviorAnalysis.bounceCount <= 2) score += 2;
  else score -= 5;

  if (!behaviorAnalysis.overdraftUsage) score += 5;
  else score -= 5;

  if (behaviorAnalysis.transactionCount > 30) score += 5;
  else if (behaviorAnalysis.transactionCount > 15) score += 2;

  // 5. Affordability (10 points)
  if (affordabilityAssessment.affordabilityRatio < 0.2) score += 10;
  else if (affordabilityAssessment.affordabilityRatio < 0.3) score += 7;
  else if (affordabilityAssessment.affordabilityRatio < 0.4) score += 4;

  // Clamp between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Generate risk flags
 */
const generateRiskFlags = (
  behaviorAnalysis: BehaviorAnalysis,
  spendingAnalysis: SpendingAnalysis,
  debtProfile: DebtProfile,
  affordabilityAssessment: AffordabilityAssessment
): RiskFlag[] => {
  const flags: RiskFlag[] = [];

  if (spendingAnalysis.spendingCategories.gambling > 10000) {
    flags.push({
      flag: 'HIGH_GAMBLING_ACTIVITY',
      severity: 'HIGH',
      description: `Gambling spending: ₦${spendingAnalysis.spendingCategories.gambling.toFixed(2)}`,
    });
  }

  if (behaviorAnalysis.bounceCount > 3) {
    flags.push({
      flag: 'FREQUENT_BOUNCES',
      severity: 'HIGH',
      description: `${behaviorAnalysis.bounceCount} bounces detected`,
    });
  }

  if (behaviorAnalysis.overdraftUsage) {
    flags.push({
      flag: 'OVERDRAFT_USAGE',
      severity: 'MEDIUM',
      description: 'Account has gone into overdraft',
    });
  }

  if (debtProfile.debtToIncomeRatio > 0.4) {
    flags.push({
      flag: 'HIGH_DEBT_TO_INCOME',
      severity: 'HIGH',
      description: `Debt-to-income ratio: ${(debtProfile.debtToIncomeRatio * 100).toFixed(1)}%`,
    });
  }

  if (!affordabilityAssessment.canAffordInstallment) {
    flags.push({
      flag: 'CANNOT_AFFORD_INSTALLMENT',
      severity: 'HIGH',
      description: 'Installment exceeds 50% of disposable income',
    });
  }

  return flags;
};

/**
 * Make decision based on trust score and rules
 */
const makeDecision = (
  trustScore: number,
  approvalWorkflow: IApprovalWorkflow,
  affordabilityAssessment: AffordabilityAssessment
): 'APPROVED' | 'FLAGGED_FOR_REVIEW' | 'DECLINED' => {
  // If cannot afford, auto-decline
  if (!affordabilityAssessment.canAffordInstallment) {
    return 'DECLINED';
  }

  // Check against min trust score
  if (trustScore < approvalWorkflow.minTrustScore) {
    return 'DECLINED';
  }

  // Check against auto-decline threshold
  if (trustScore < approvalWorkflow.autoDeclineThreshold) {
    return 'DECLINED';
  }

  // Check against auto-approve threshold
  if (trustScore >= approvalWorkflow.autoApproveThreshold) {
    return 'APPROVED';
  }

  // Between thresholds = flagged for manual review
  return 'FLAGGED_FOR_REVIEW';
};

/**
 * Save analysis result to database
 */
export const saveTrustEngineOutput = async (
  applicationId: string,
  trustWalletId: string,
  businessId: string,
  analysisResult: TrustEngineAnalysisResult
): Promise<string> => {
  const outputId = generateTrustEngineOutputId();

  await TrustEngineOutput.create({
    outputId,
    applicationId,
    trustWalletId,
    businessId,
    decision: analysisResult.decision,
    trustScore: analysisResult.trustScore,
    statementAnalysis: {
      periodCovered: analysisResult.periodCovered,
      incomeAnalysis: analysisResult.incomeAnalysis,
      spendingAnalysis: analysisResult.spendingAnalysis,
      balanceAnalysis: analysisResult.balanceAnalysis,
      behaviorAnalysis: analysisResult.behaviorAnalysis,
      debtProfile: analysisResult.debtProfile,
      affordabilityAssessment: analysisResult.affordabilityAssessment,
      riskFlags: analysisResult.riskFlags,
      ruleCompliance: analysisResult.ruleCompliance,
    },
    analyzedAt: new Date(),
  });

  logger.info(`Trust engine output saved: ${outputId} for application ${applicationId}`);

  return outputId;
};

/**
 * Analyze application by ID
 * Fetches application, analyzes CSV, and saves result
 */
export const analyzeApplication = async (applicationId: string): Promise<any> => {
  const Application = (await import('../models/Application')).default;
  const TrustWallet = (await import('../models/TrustWallet')).default;

  // Find application
  const application = await Application.findOne({ applicationId });
  if (!application) {
    throw new Error(`Application not found: ${applicationId}`);
  }

  // Check if CSV data exists
  if (!application.bankStatementCsvData) {
    throw new Error(`No bank statement CSV data found for application: ${applicationId}`);
  }

  // Get TrustWallet for approval workflow
  const trustWallet = await TrustWallet.findOne({ trustWalletId: application.trustWalletId });
  if (!trustWallet) {
    throw new Error(`TrustWallet not found: ${application.trustWalletId}`);
  }

  // Analyze CSV
  const analysisResult = await analyzeStatement(
    application.bankStatementCsvData,
    application.installmentAmount,
    trustWallet.approvalWorkflow
  );

  // Save result to database
  const outputId = await saveTrustEngineOutput(
    applicationId,
    application.trustWalletId,
    application.businessId,
    analysisResult
  );

  // Return output with outputId
  return {
    ...analysisResult,
    outputId,
  };
};

export default {
  analyzeStatement,
  saveTrustEngineOutput,
  analyzeApplication,
};
