import type { Installment, FixedExpense, IncomeSource, Debt, SavingsGoal, CashFlowMonth, CashFlowForecast } from '@/types';
import { addMonths } from '../format';

interface ForecastInput {
  incomeSources: IncomeSource[];
  fixedExpenses: FixedExpense[];
  installments: Installment[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  monthlyVariableExpense: number;
}

function calculateMonthlyIncome(sources: IncomeSource[]): number {
  return sources
    .filter(s => s.is_active)
    .reduce((sum, s) => {
      switch (s.frequency) {
        case 'monthly': return sum + s.amount;
        case 'biweekly': return sum + s.amount * 26 / 12;
        case 'weekly': return sum + s.amount * 52 / 12;
        default: return sum + s.amount;
      }
    }, 0);
}

function calculateMonthlyFixedExpenses(expenses: FixedExpense[]): number {
  return expenses
    .filter(e => e.is_active)
    .reduce((sum, e) => {
      switch (e.frequency) {
        case 'monthly': return sum + e.amount;
        case 'quarterly': return sum + e.amount / 3;
        case 'yearly': return sum + e.amount / 12;
        default: return sum + e.amount;
      }
    }, 0);
}

export function generateForecast(
  input: ForecastInput,
  months: number = 24,
  scenario: 'optimistic' | 'baseline' | 'pessimistic' = 'baseline'
): CashFlowForecast {
  const scenarioMultipliers = {
    optimistic: { income: 1.05, expense: 0.95 },
    baseline: { income: 1.0, expense: 1.0 },
    pessimistic: { income: 0.90, expense: 1.10 },
  };

  const mult = scenarioMultipliers[scenario];
  const baseIncome = calculateMonthlyIncome(input.incomeSources) * mult.income;
  const baseFixed = calculateMonthlyFixedExpenses(input.fixedExpenses) * mult.expense;
  const baseVariable = input.monthlyVariableExpense * mult.expense;
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let cumulative = 0;
  const result: CashFlowMonth[] = [];

  for (let i = 0; i < months; i++) {
    const monthDate = addMonths(startDate, i);
    const events: string[] = [];

    let installmentTotal = 0;
    for (const inst of input.installments) {
      const remaining = inst.total_periods - inst.paid_periods;
      if (i < remaining) {
        installmentTotal += inst.monthly_payment;
        if (i === remaining - 1) {
          events.push(`✅ ${inst.name} 还清`);
        }
      }
    }

    let debtPayments = 0;
    for (const debt of input.debts) {
      if (debt.remaining_amount > 0) {
        debtPayments += debt.minimum_payment;
      }
    }

    let savingsContrib = 0;
    for (const goal of input.savingsGoals) {
      if (goal.monthly_contribution > 0) {
        const remaining = goal.target_amount - goal.current_amount;
        if (remaining > 0) {
          savingsContrib += Math.min(goal.monthly_contribution, remaining - i * goal.monthly_contribution);
          if (savingsContrib < 0) savingsContrib = 0;
        }
      }
    }

    const totalExpenses = baseFixed + baseVariable;
    const netCashFlow = baseIncome - totalExpenses - installmentTotal - debtPayments - savingsContrib;
    cumulative += netCashFlow;

    result.push({
      month: monthDate,
      income: Math.round(baseIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      installments: Math.round(installmentTotal * 100) / 100,
      debtPayments: Math.round(debtPayments * 100) / 100,
      savingsContributions: Math.round(Math.max(0, savingsContrib) * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      cumulativeCashFlow: Math.round(cumulative * 100) / 100,
      events,
    });
  }

  return { scenario, months: result };
}

export function generateAllScenarios(input: ForecastInput, months: number = 24) {
  return {
    optimistic: generateForecast(input, months, 'optimistic'),
    baseline: generateForecast(input, months, 'baseline'),
    pessimistic: generateForecast(input, months, 'pessimistic'),
  };
}
