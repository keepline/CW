import type { Debt, DebtStrategy, DebtPayoffStep } from '@/types';

interface DebtState {
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
}

function simulatePayoff(
  debts: DebtState[],
  extraBudget: number,
  sortFn: (a: DebtState, b: DebtState) => number
): DebtStrategy {
  const states = debts.map(d => ({ ...d }));
  const schedule: DebtPayoffStep[] = [];
  const payoffOrder: string[] = [];
  let totalInterest = 0;
  let month = 0;
  const maxMonths = 360;

  while (states.some(d => d.balance > 0.01) && month < maxMonths) {
    month++;
    const active = states.filter(d => d.balance > 0.01);
    active.sort(sortFn);

    let extraLeft = extraBudget;

    for (const debt of active) {
      const monthlyInterest = debt.balance * (debt.rate / 100 / 12);
      totalInterest += monthlyInterest;
      debt.balance += monthlyInterest;

      let payment = Math.min(debt.minPayment, debt.balance);
      debt.balance -= payment;

      if (debt === active[0] && extraLeft > 0) {
        const extra = Math.min(extraLeft, debt.balance);
        debt.balance -= extra;
        payment += extra;
        extraLeft -= extra;
      }

      const principalPaid = payment - monthlyInterest;

      schedule.push({
        month,
        debtName: debt.name,
        payment,
        interestPaid: monthlyInterest,
        principalPaid: Math.max(0, principalPaid),
        remainingBalance: Math.max(0, debt.balance),
      });

      if (debt.balance <= 0.01 && !payoffOrder.includes(debt.name)) {
        debt.balance = 0;
        payoffOrder.push(debt.name);
      }
    }
  }

  return {
    name: '',
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalMonths: month,
    schedule,
    payoffOrder,
  };
}

export function avalancheStrategy(debts: Debt[], extraBudget: number = 0): DebtStrategy {
  const states: DebtState[] = debts
    .filter(d => d.remaining_amount > 0)
    .map(d => ({
      name: d.name,
      balance: d.remaining_amount,
      rate: d.interest_rate,
      minPayment: d.minimum_payment,
    }));

  const result = simulatePayoff(states, extraBudget, (a, b) => b.rate - a.rate);
  result.name = '雪崩法（优先高利率）';
  return result;
}

export function snowballStrategy(debts: Debt[], extraBudget: number = 0): DebtStrategy {
  const states: DebtState[] = debts
    .filter(d => d.remaining_amount > 0)
    .map(d => ({
      name: d.name,
      balance: d.remaining_amount,
      rate: d.interest_rate,
      minPayment: d.minimum_payment,
    }));

  const result = simulatePayoff(states, extraBudget, (a, b) => a.balance - b.balance);
  result.name = '雪球法（优先小额）';
  return result;
}

export function compareStrategies(debts: Debt[], extraBudget: number = 0) {
  const avalanche = avalancheStrategy(debts, extraBudget);
  const snowball = snowballStrategy(debts, extraBudget);

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const monthsSaved = snowball.totalMonths - avalanche.totalMonths;

  return {
    avalanche,
    snowball,
    recommendation: interestSaved > 0 ? 'avalanche' as const : 'snowball' as const,
    interestDifference: Math.abs(interestSaved),
    monthsDifference: Math.abs(monthsSaved),
    advice: interestSaved > 0
      ? `雪崩法可节省 ¥${Math.abs(interestSaved).toFixed(2)} 利息，提前 ${Math.abs(monthsSaved)} 个月还清`
      : `两种策略效果相近，雪球法有助于保持还债动力`,
  };
}
