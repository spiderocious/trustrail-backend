import mongoose, { Schema, Document } from 'mongoose';

export interface IIncomeSource {
  description: string;
  frequency: string;
  avgAmount: number;
}

export interface ISpendingCategories {
  bills: number;
  loans: number;
  gambling: number;
  transfers: number;
  other: number;
}

export interface IRiskFlag {
  flag: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface ITrustEngineOutput extends Document {
  outputId: string;
  applicationId: string;
  trustWalletId: string;
  businessId: string;
  decision: 'APPROVED' | 'FLAGGED_FOR_REVIEW' | 'DECLINED';
  trustScore: number;
  statementAnalysis: {
    periodCovered: {
      startDate: Date;
      endDate: Date;
      monthsAnalyzed: number;
    };
    incomeAnalysis: {
      totalIncome: number;
      avgMonthlyIncome: number;
      incomeConsistency: number;
      incomeSources: IIncomeSource[];
    };
    spendingAnalysis: {
      totalSpending: number;
      avgMonthlySpending: number;
      spendingCategories: ISpendingCategories;
    };
    balanceAnalysis: {
      avgBalance: number;
      minBalance: number;
      maxBalance: number;
      closingBalance: number;
    };
    behaviorAnalysis: {
      transactionCount: number;
      avgDailyTransactions: number;
      bounceCount: number;
      overdraftUsage: boolean;
    };
    debtProfile: {
      existingLoanRepayments: number;
      debtToIncomeRatio: number;
    };
    affordabilityAssessment: {
      canAffordInstallment: boolean;
      monthlyInstallmentAmount: number;
      disposableIncome: number;
      affordabilityRatio: number;
      cushion: number;
    };
    riskFlags: IRiskFlag[];
    ruleCompliance: {
      passedMinTrustScore: boolean;
      overallPass: boolean;
    };
  };
  analyzedAt: Date;
  createdAt: Date;
}

const IncomeSourceSchema = new Schema(
  {
    description: { type: String, required: true },
    frequency: { type: String, required: true },
    avgAmount: { type: Number, required: true },
  },
  { _id: false }
);

const SpendingCategoriesSchema = new Schema(
  {
    bills: { type: Number, default: 0 },
    loans: { type: Number, default: 0 },
    gambling: { type: Number, default: 0 },
    transfers: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  { _id: false }
);

const RiskFlagSchema = new Schema(
  {
    flag: { type: String, required: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const TrustEngineOutputSchema: Schema = new Schema(
  {
    outputId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    trustWalletId: {
      type: String,
      required: true,
      index: true,
    },
    businessId: {
      type: String,
      required: true,
      index: true,
    },
    decision: {
      type: String,
      enum: ['APPROVED', 'FLAGGED_FOR_REVIEW', 'DECLINED'],
      required: true,
      index: true,
    },
    trustScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    statementAnalysis: {
      periodCovered: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        monthsAnalyzed: { type: Number, required: true },
      },
      incomeAnalysis: {
        totalIncome: { type: Number, required: true },
        avgMonthlyIncome: { type: Number, required: true },
        incomeConsistency: { type: Number, required: true },
        incomeSources: [IncomeSourceSchema],
      },
      spendingAnalysis: {
        totalSpending: { type: Number, required: true },
        avgMonthlySpending: { type: Number, required: true },
        spendingCategories: SpendingCategoriesSchema,
      },
      balanceAnalysis: {
        avgBalance: { type: Number, required: true },
        minBalance: { type: Number, required: true },
        maxBalance: { type: Number, required: true },
        closingBalance: { type: Number, required: true },
      },
      behaviorAnalysis: {
        transactionCount: { type: Number, required: true },
        avgDailyTransactions: { type: Number, required: true },
        bounceCount: { type: Number, required: true },
        overdraftUsage: { type: Boolean, required: true },
      },
      debtProfile: {
        existingLoanRepayments: { type: Number, required: true },
        debtToIncomeRatio: { type: Number, required: true },
      },
      affordabilityAssessment: {
        canAffordInstallment: { type: Boolean, required: true },
        monthlyInstallmentAmount: { type: Number, required: true },
        disposableIncome: { type: Number, required: true },
        affordabilityRatio: { type: Number, required: true },
        cushion: { type: Number, required: true },
      },
      riskFlags: [RiskFlagSchema],
      ruleCompliance: {
        passedMinTrustScore: { type: Boolean, required: true },
        overallPass: { type: Boolean, required: true },
      },
    },
    analyzedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TrustEngineOutputSchema.index({ outputId: 1 }, { unique: true });
TrustEngineOutputSchema.index({ applicationId: 1 }, { unique: true });
TrustEngineOutputSchema.index({ trustWalletId: 1 });
TrustEngineOutputSchema.index({ businessId: 1 });
TrustEngineOutputSchema.index({ decision: 1 });

export default mongoose.model<ITrustEngineOutput>('TrustEngineOutput', TrustEngineOutputSchema);
