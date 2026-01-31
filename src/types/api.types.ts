// Auth API Types
export interface RegisterBusinessRequest {
  businessName: string;
  email: string;
  password: string;
  phoneNumber: string;
  rcNumber: string;
  settlementAccountNumber: string;
  settlementBankCode: string;
  settlementAccountName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  businessId: string;
  businessName: string;
  email: string;
  billerCode?: string;
}

// TrustWallet API Types
export interface CreateTrustWalletRequest {
  name: string;
  description?: string;
  installmentPlan: {
    totalAmount: number;
    downPaymentPercentage: number;
    installmentCount: number;
    frequency: 'weekly' | 'monthly';
    interestRate?: number;
  };
  approvalWorkflow: {
    autoApproveThreshold: number;
    autoDeclineThreshold: number;
    minTrustScore: number;
  };
}

export interface UpdateTrustWalletRequest extends Partial<CreateTrustWalletRequest> {}

// Application API Types
export interface SubmitApplicationRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  accountNumber: string;
  bankCode: string;
  bvn: string;
  // CSV file will be in req.file from multer
}

export interface ManualApproveRequest {
  notes?: string;
}

export interface ManualDeclineRequest {
  reason: string;
}

// Webhook API Types
export interface ConfigureWebhookRequest {
  webhookUrl: string;
  events?: string[];
}

// Withdrawal API Types
export interface CreateWithdrawalRequest {
  trustWalletId: string;
  amount: number;
}

// Pagination Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// Dashboard API Types
export interface DashboardOverviewResponse {
  trustWallets: {
    total: number;
    active: number;
  };
  applications: {
    total: number;
    approved: number;
    declined: number;
    pending: number;
    active: number;
    completed: number;
  };
  revenue: {
    totalCollected: number;
    outstandingBalance: number;
    availableForWithdrawal: number;
  };
  payments: {
    successfulCount: number;
    failedCount: number;
    successRate: number;
  };
  recentActivity: any[];
}

// Query Filter Types
export interface ApplicationFilters extends PaginationQuery {
  trustWalletId?: string;
  status?: string;
  search?: string;
}

export interface PaymentFilters extends PaginationQuery {
  trustWalletId?: string;
  applicationId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface WithdrawalFilters extends PaginationQuery {
  trustWalletId?: string;
  status?: string;
}

export interface AuditLogFilters extends PaginationQuery {
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
}
