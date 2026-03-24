import type { HealthScore } from '@/types';

interface HealthInput {
  monthlyIncome: number;
  monthlyExpense: number;
  totalDebt: number;
  totalSavings: number;
  monthlyDebtPayments: number;
  budgetTotal: number;
  budgetActual: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function calculateHealthScore(input: HealthInput): HealthScore {
  const details: HealthScore['details'] = [];

  // 1. Debt-to-Income ratio (monthly debt payments / monthly income)
  const dti = input.monthlyIncome > 0
    ? input.monthlyDebtPayments / input.monthlyIncome
    : 1;
  const dtiScore = clamp(100 - dti * 250, 0, 100);
  details.push({
    label: '负债收入比',
    score: Math.round(dtiScore),
    status: dtiScore >= 70 ? 'good' : dtiScore >= 40 ? 'warning' : 'danger',
    advice: dti < 0.3
      ? '负债水平健康，继续保持'
      : dti < 0.5
        ? '负债偏高，建议减少新增债务'
        : '负债过重，需要制定积极的还款计划',
  });

  // 2. Savings rate (savings / income)
  const savingsRate = input.monthlyIncome > 0
    ? Math.max(0, input.monthlyIncome - input.monthlyExpense - input.monthlyDebtPayments) / input.monthlyIncome
    : 0;
  const savingsScore = clamp(savingsRate * 400, 0, 100);
  details.push({
    label: '储蓄率',
    score: Math.round(savingsScore),
    status: savingsScore >= 70 ? 'good' : savingsScore >= 40 ? 'warning' : 'danger',
    advice: savingsRate >= 0.2
      ? '储蓄率优秀，可考虑投资增值'
      : savingsRate >= 0.1
        ? '储蓄率尚可，建议逐步提高到20%'
        : '储蓄率过低，需要优化支出结构',
  });

  // 3. Emergency fund (months of expenses covered by savings)
  const emergencyMonths = input.monthlyExpense > 0
    ? input.totalSavings / input.monthlyExpense
    : 0;
  const emergencyScore = clamp(emergencyMonths / 6 * 100, 0, 100);
  details.push({
    label: '紧急资金储备',
    score: Math.round(emergencyScore),
    status: emergencyScore >= 70 ? 'good' : emergencyScore >= 40 ? 'warning' : 'danger',
    advice: emergencyMonths >= 6
      ? `当前储蓄可覆盖${Math.floor(emergencyMonths)}个月支出，储备充足`
      : emergencyMonths >= 3
        ? `仅覆盖${Math.floor(emergencyMonths)}个月，建议积累到6个月`
        : '紧急储备不足，优先建立3-6个月应急资金',
  });

  // 4. Budget adherence
  const budgetAdherence = input.budgetTotal > 0
    ? clamp(1 - (input.budgetActual - input.budgetTotal) / input.budgetTotal, 0, 1)
    : 0.5;
  const budgetScore = budgetAdherence * 100;
  details.push({
    label: '预算执行',
    score: Math.round(budgetScore),
    status: budgetScore >= 70 ? 'good' : budgetScore >= 40 ? 'warning' : 'danger',
    advice: budgetScore >= 80
      ? '预算控制良好，支出在计划范围内'
      : budgetScore >= 50
        ? '部分类别超支，建议检视消费习惯'
        : '预算严重超支，需要重新评估预算设定',
  });

  const overall = Math.round(
    dtiScore * 0.3 + savingsScore * 0.25 + emergencyScore * 0.25 + budgetScore * 0.2
  );

  return {
    overall,
    debtToIncomeRatio: Math.round(dti * 1000) / 1000,
    savingsRate: Math.round(savingsRate * 1000) / 1000,
    emergencyFundMonths: Math.round(emergencyMonths * 10) / 10,
    budgetAdherence: Math.round(budgetAdherence * 1000) / 1000,
    details,
  };
}
