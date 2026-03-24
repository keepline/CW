export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  created_at: string;
}

export interface Account {
  id: number;
  name: string;
  type: 'bank' | 'credit_card' | 'cash' | 'investment';
  balance: number;
  created_at: string;
}

export interface Installment {
  id: number;
  name: string;
  total_amount: number;
  total_periods: number;
  paid_periods: number;
  monthly_payment: number;
  interest_rate: number;
  start_date: string;
  payment_day: number;
  account_id: number | null;
  note: string;
  created_at: string;
}

export interface FixedExpense {
  id: number;
  name: string;
  amount: number;
  category_id: number | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  due_day: number;
  is_active: number;
  note: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  account_id: number | null;
  date: string;
  note: string;
  created_at: string;
}

export interface IncomeSource {
  id: number;
  name: string;
  amount: number;
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'irregular';
  pay_day: number;
  is_active: number;
  note: string;
  created_at: string;
}

export interface Budget {
  id: number;
  category_id: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  amount: number;
  period: 'monthly' | 'yearly';
  year: number;
  month: number | null;
  created_at: string;
}

export interface Debt {
  id: number;
  name: string;
  total_amount: number;
  remaining_amount: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number;
  note: string;
  created_at: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  monthly_contribution: number;
  note: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  type: 'installment' | 'expense' | 'debt' | 'savings' | 'custom';
  related_id: number | null;
  due_date: string;
  is_read: number;
  created_at: string;
}

export interface DashboardStats {
  monthlyIncome: number;
  monthlyExpense: number;
  totalInstallmentMonthly: number;
  totalDebtRemaining: number;
  totalSavings: number;
  installmentCount: number;
  activeInstallments: Installment[];
  debts: Debt[];
  savings: SavingsGoal[];
  reminders: Reminder[];
}

export interface TransactionSummary {
  income: number;
  expense: number;
  byCategory: {
    name: string;
    icon: string;
    color: string;
    type: string;
    total: number;
  }[];
}

export interface DebtPayoffStep {
  month: number;
  debtName: string;
  payment: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;
}

export interface DebtStrategy {
  name: string;
  totalInterest: number;
  totalMonths: number;
  schedule: DebtPayoffStep[];
  payoffOrder: string[];
}

export interface CashFlowMonth {
  month: string;
  income: number;
  expenses: number;
  installments: number;
  debtPayments: number;
  savingsContributions: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  events: string[];
}

export interface CashFlowForecast {
  scenario: 'optimistic' | 'baseline' | 'pessimistic';
  months: CashFlowMonth[];
}

export interface HealthScore {
  overall: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  emergencyFundMonths: number;
  budgetAdherence: number;
  details: {
    label: string;
    score: number;
    status: 'good' | 'warning' | 'danger';
    advice: string;
  }[];
}