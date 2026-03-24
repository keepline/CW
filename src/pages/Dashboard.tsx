import { useEffect, useState } from 'react';
import { dashboardApi, transactionApi, budgetApi } from '@/utils/api';
import { formatCurrency, formatDate, getCurrentYearMonth } from '@/utils/format';
import { calculateHealthScore } from '@/utils/strategy/healthScore';
import type { DashboardStats, TransactionSummary, HealthScore, Budget } from '@/types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank, AlertCircle, Shield } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);

  const { year, month } = getCurrentYearMonth();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsRes, summaryRes, budgetsRes] = await Promise.all([
          dashboardApi.stats(),
          transactionApi.summary(year, month),
          budgetApi.list(year, month),
        ]);
        setStats(statsRes as DashboardStats);
        setSummary(summaryRes as TransactionSummary);
        setBudgets((budgetsRes as Budget[]) || []);

        // Calculate health score
        const s = statsRes as DashboardStats;
        const monthlyDebtPayments =
          (s?.totalInstallmentMonthly ?? 0) +
          (s?.debts ?? []).reduce((sum: number, d: { minimum_payment: number }) => sum + d.minimum_payment, 0);
        const budgetTotal = (budgetsRes as Budget[]).reduce((s, b) => s + b.amount, 0);
        const budgetActual = (summaryRes as TransactionSummary)?.expense ?? 0;

        const score = calculateHealthScore({
          monthlyIncome: (statsRes as DashboardStats)?.monthlyIncome ?? 0,
          monthlyExpense: (statsRes as DashboardStats)?.monthlyExpense ?? 0,
          totalDebt: (statsRes as DashboardStats)?.totalDebtRemaining ?? 0,
          totalSavings: (statsRes as DashboardStats)?.totalSavings ?? 0,
          monthlyDebtPayments,
          budgetTotal,
          budgetActual,
        });
        setHealthScore(score);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">仪表盘</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  const income = stats?.monthlyIncome ?? 0;
  const expense = stats?.monthlyExpense ?? 0;
  const installmentTotal = stats?.totalInstallmentMonthly ?? 0;
  const net = income - expense - installmentTotal;

  // Expense breakdown for PieChart (expense categories only)
  const expenseByCategory =
    summary?.byCategory?.filter((c) => c.type === 'expense' && c.total > 0) ?? [];
  const pieData = expenseByCategory.map((c) => ({
    name: c.name || '未分类',
    value: c.total,
  }));

  // Installment progress for donut chart
  const installmentData =
    stats?.activeInstallments?.map((i) => ({
      name: i.name,
      value: Math.max(0, (i.total_periods - i.paid_periods) * i.monthly_payment),
    })) ?? [];
  const hasInstallments = installmentData.some((d) => d.value > 0);

  // Bar chart: income vs expense
  const barData = [
    { name: '收入', value: income, fill: '#10b981' },
    { name: '支出', value: expense, fill: '#ef4444' },
  ];

  // Budget usage: match budget to actual spending by category
  const budgetWithActual = budgets.map((b) => {
    const actual =
      summary?.byCategory?.find(
        (c) => c.type === 'expense' && c.name === b.category_name
      )?.total ?? 0;
    const pct = b.amount > 0 ? Math.min(100, (actual / b.amount) * 100) : 0;
    return {
      ...b,
      actual,
      pct,
      overBudget: actual > b.amount,
    };
  });

  const getHealthColor = (s: number) =>
    s >= 70 ? 'text-green-500' : s >= 40 ? 'text-yellow-500' : 'text-red-500';

  const getHealthBg = (s: number) =>
    s >= 70 ? 'stroke-green-500' : s >= 40 ? 'stroke-yellow-500' : 'stroke-red-500';

  return (
    <div className="p-6 space-y-6">
      <h1 className="page-title">仪表盘</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="stat-label">本月收入</p>
            <p className="stat-value text-green-600 dark:text-green-400">
              {formatCurrency(income)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
            <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="stat-label">本月支出</p>
            <p className="stat-value text-red-600 dark:text-red-400">
              {formatCurrency(expense)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="stat-label">净收入</p>
            <p className={`stat-value ${net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(net)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">收入 - 支出 - 分期还款</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <CreditCard className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="stat-label">分期还款</p>
            <p className="stat-value text-orange-600 dark:text-orange-400">
              {formatCurrency(installmentTotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health score */}
        <div className="card lg:col-span-1">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            财务健康度
          </h2>
          {healthScore ? (
            <div className="flex flex-col items-center">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-200 dark:text-gray-600"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray={`${healthScore.overall} 100`}
                    strokeLinecap="round"
                    className={`transition-all duration-500 ${getHealthBg(healthScore.overall)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getHealthColor(healthScore.overall)}`}>
                    {healthScore.overall}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">综合评分</p>
              <ul className="mt-4 w-full space-y-2">
                {healthScore.details.map((d) => (
                  <li key={d.label} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        d.status === 'good'
                          ? 'badge-green'
                          : d.status === 'warning'
                            ? 'badge-yellow'
                            : 'badge-red'
                      }
                    >
                      {d.score}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{d.label}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{d.advice}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无数据</p>
          )}
        </div>

        {/* Expense breakdown PieChart */}
        <div className="card">
          <h2 className="section-title mb-4">支出分类</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              本月暂无支出记录
            </div>
          )}
        </div>

        {/* Installment donut */}
        <div className="card">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <PiggyBank className="w-5 h-5" />
            分期还款进度
          </h2>
          {hasInstallments ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={installmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {installmentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              暂无进行中的分期
            </div>
          )}
        </div>
      </div>

      {/* Income vs Expense BarChart */}
      <div className="card">
        <h2 className="section-title mb-4">收支对比</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Budget usage progress bars */}
      <div className="card">
        <h2 className="section-title mb-4">预算执行</h2>
        {budgetWithActual.length > 0 ? (
          <div className="space-y-4">
            {budgetWithActual.map((b) => (
              <div key={b.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {b.category_name || '未分类'}
                  </span>
                  <span className={b.overBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                    {formatCurrency(b.actual)} / {formatCurrency(b.amount)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.overBudget ? 'bg-red-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${Math.min(100, b.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">本月暂无预算设置</p>
        )}
      </div>

      {/* Upcoming reminders */}
      <div className="card">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          即将到期提醒
        </h2>
        {stats?.reminders && stats.reminders.length > 0 ? (
          <ul className="space-y-3">
            {stats.reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">{r.title}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(r.due_date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">暂无待办提醒</p>
        )}
      </div>
    </div>
  );
}
