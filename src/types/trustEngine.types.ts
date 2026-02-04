import { Transaction } from '../utils/csvParser';

// Trust Engine Analysis Types

export interface IncomeSource {
  description: string;
  frequency: string;
  avgAmount: number;
}

export interface IncomeAnalysis {
  totalIncome: number;
  avgMonthlyIncome: number;
  incomeConsistency: number; // 0-1
  incomeSources: IncomeSource[];
}

export interface SpendingCategories {
  bills: number;
  loans: number;
  gambling: number;
  transfers: number;
  other: number;
}

export interface SpendingAnalysis {
  totalSpending: number;
  avgMonthlySpending: number;
  spendingCategories: SpendingCategories;
}

export interface BalanceAnalysis {
  avgBalance: number;
  minBalance: number;
  maxBalance: number;
  closingBalance: number;
}

export interface BehaviorAnalysis {
  transactionCount: number;
  avgDailyTransactions: number;
  bounceCount: number;
  overdraftUsage: boolean;
}

export interface DebtProfile {
  existingLoanRepayments: number;
  debtToIncomeRatio: number;
}

export interface AffordabilityAssessment {
  canAffordInstallment: boolean;
  monthlyInstallmentAmount: number;
  disposableIncome: number;
  affordabilityRatio: number;
  cushion: number;
}

export interface RiskFlag {
  flag: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface TrustScoreBreakdown {
  incomeStability: number; // max 30
  spendingBehavior: number; // max 25
  balanceHealth: number; // max 20
  transactionBehavior: number; // max 15
  affordability: number; // max 10
  total: number; // 0-100
}

export interface TrustEngineAnalysisResult {
  // Statement Validity
  isValidStatement?: boolean; // false if document is not a valid bank statement
  invalidStatementReason?: string; // Reason why statement is invalid

  // Decision
  decision: 'APPROVED' | 'FLAGGED_FOR_REVIEW' | 'DECLINED';
  trustScore: number; // 0-100
  trustScoreBreakdown?: TrustScoreBreakdown;

  // Statement Period
  periodCovered: {
    startDate: Date;
    endDate: Date;
    monthsAnalyzed: number;
  };

  // Analyses
  incomeAnalysis: IncomeAnalysis;
  spendingAnalysis: SpendingAnalysis;
  balanceAnalysis: BalanceAnalysis;
  behaviorAnalysis: BehaviorAnalysis;
  debtProfile: DebtProfile;
  affordabilityAssessment: AffordabilityAssessment;

  // Risk Flags
  riskFlags: RiskFlag[];

  // Rule Compliance
  ruleCompliance: {
    passedMinTrustScore: boolean;
    overallPass: boolean;
  };
}

// Internal processing types
export interface TransactionsByMonth {
  [month: string]: Transaction[];
}

export interface MonthlyIncome {
  month: string;
  amount: number;
}

export interface CategoryKeywords {
  bills: string[];
  loans: string[];
  gambling: string[];
  salary: string[];
  freelance: string[];
  business: string[];
}

export const CATEGORY_KEYWORDS: CategoryKeywords = {
  bills: [
    'PHCN',
    'EKEDC',
    'IKEDC',
    'DSTV',
    'GOTV',
    'STARTIMES',
    'AIRTEL',
    'MTN',
    'GLO',
    '9MOBILE',
    'ETISALAT',
    'WATER BILL',
    'ELECTRICITY',
    'CABLE TV',
  ],
  loans: [
    'LOAN',
    'REPAYMENT',
    'INSTALLMENT',
    'CREDIT CORP',
    'CARBON',
    'BRANCH',
    'FAIRMONEY',
    'PALMCREDIT',
    'RENMONEY',
  ],
  gambling: [
    'BET',
    'BETKING',
    'SPORTYBET',
    'NAIRABET',
    '1XBET',
    'BET9JA',
    'MSPORT',
    'MERRYBET',
  ],
  salary: ['SALARY', 'SAL', 'WAGES', 'PAYROLL'],
  freelance: ['TRANSFER', 'REMITTANCE', 'UPWORK', 'FIVERR'],
  business: ['POS', 'PAYMENT FOR', 'SALES'],
};

export const BOUNCE_KEYWORDS = [
  'INSUFFICIENT FUNDS',
  'REVERSAL',
  'DECLINED',
  'FAILED',
  'REJECTED',
];

export default {
  CATEGORY_KEYWORDS,
  BOUNCE_KEYWORDS,
};
