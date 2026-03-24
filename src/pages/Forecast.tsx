import { useEffect, useState } from 'react';
import { installmentApi, fixedExpenseApi, incomeSourceApi, debtApi, savingsApi, transactionApi } from '@/utils/api';
import { formatCurrency, getCurrentYearMonth, getMonthLabel } from '@/utils/format';
import { generateAllScenarios } from '@/utils/strategy/cashflow';
import type { CashFlowForecast, CashFlowMonth, IncomeSource, FixedExpense, Installment, Debt, SavingsGoal, TransactionSummary } from '@/types';
import { Target, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts';
import EmptyState from '@/components/EmptyState';

const OPTIMISTIC_COLOR = '#10b981';
const BASELINE_COLOR = '#3b82f6';
const PESSIMISTIC_COLOR = '#ef4444';

export default function Forecast() {
  const [loading, setLoading] = useState(true);
  const [forecastHorizon, setForecastHorizon] = useState(12);
  const [selectedScenario, setSelectedScenario] = useState<'optimistic' | 'baseline' | 'pessimistic'>('baseline');
  const [scenarios, setScenarios] = useState<{
    optimistic: CashFlowForecast;
    baseline: CashFlowForecast;
    pessimistic: CashFlowForecast;
  } | null>(null);
  const [chartData, setChartData] = useState<{
    month: string;
    monthLabel: string;
    optimistic: number;
    baseline: number;
    pessimistic: number;
    optimisticCumulative: number;
    baselineCumulative: number;
    pessimisticCumulative: number;
    events: string[];
  }[]>([]);
  const [eventMonths, setEventMonths] = useState<{ month: string; label: string }[]>([]);

  const { year, month } = getCurrentYearMonth();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [incomeSources, fixedExpenses, installments, debts, savings, transRes] = await Promise.all([
          incomeSourceApi.list(),
          fixedExpenseApi.list(),
          installmentApi.list(),
          debtApi.list(),
          savingsApi.list(),
          (async () => {
            const summaries: TransactionSummary[] = [];
            for (let i = 2; i >= 0; i--) {
              let y = year;
              let m = month - i;
              if (m <= 0) {
                m += 12;
                y -= 1;
              }
              const s = await transactionApi.summary(y, m);
              summaries.push(s as TransactionSummary);
            }
            return summaries;
          })(),
        ]);

        const incomeList = (incomeSources || []) as IncomeSource[];
        const fixedList = (fixedExpenses || []) as FixedExpense[];
        const instList = (installments || []) as Installment[];
        const debtList = (debts || []) as Debt[];
        const savingsList = (savings || []) as SavingsGoal[];
        const summaries = transRes as TransactionSummary[];

        const monthlyFixed = fixedList
          .filter((e) => e.is_active)
          .reduce((sum, e) => {
            switch (e.frequency) {
              case 'monthly': return sum + e.amount;
              case 'quarterly': return sum + e.amount / 3;
              case 'yearly': return sum + e.amount / 12;
              default: return sum + e.amount;
            }
          }, 0);

        const variableExpenses = summaries.map((s) => Math.max(0, (s?.expense ?? 0) - monthlyFixed));
        const monthlyVariableExpense =
          variableExpenses.length > 0
            ? variableExpenses.reduce((a, b) => a + b, 0) / variableExpenses.length
            : 0;

        const allScenarios = generateAllScenarios(
          {
            incomeSources: incomeList,
            fixedExpenses: fixedList,
            installments: instList,
            debts: debtList,
            savingsGoals: savingsList,
            monthlyVariableExpense,
          },
          forecastHorizon
        );

        setScenarios(allScenarios);

        const base = allScenarios.baseline.months;
        const opt = allScenarios.optimistic.months;
        const pess = allScenarios.pessimistic.months;

        const data = base.map((m, i) => ({
          month: m.month,
          monthLabel: getMonthLabel(m.month),
          optimistic: opt[i]?.netCashFlow ?? 0,
          baseline: m.netCashFlow,
          pessimistic: pess[i]?.netCashFlow ?? 0,
          optimisticCumulative: opt[i]?.cumulativeCashFlow ?? 0,
          baselineCumulative: m.cumulativeCashFlow,
          pessimisticCumulative: pess[i]?.cumulativeCashFlow ?? 0,
          events: m.events ?? [],
        }));

        setChartData(data);

        const events: { month: string; label: string }[] = [];
        base.forEach((m) => {
          m.events?.forEach((ev) => {
            events.push({ month: m.month, label: ev });
          });
        });
        setEventMonths(events);
      } catch (err) {
        console.error('Forecast fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year, month, forecastHorizon]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">现金流预测</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (!scenarios) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="暂无预测数据"
          description="请先添加收入来源、固定支出等基础数据，系统将根据您的财务信息生成现金流预测。"
        />
      </div>
    );
  }

  const selected = scenarios[selectedScenario];
  const months = selected.months;

  const net12 = months[11]?.netCashFlow ?? 0;
  const net24 = forecastHorizon >= 24 ? (months[23]?.netCashFlow ?? 0) : null;
  const cum12 = months[11]?.cumulativeCashFlow ?? 0;
  const cum24 = forecastHorizon >= 24 ? (months[23]?.cumulativeCashFlow ?? 0) : null;

  const scenarioLabels = {
    optimistic: '乐观',
    baseline: '基准',
    pessimistic: '悲观',
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (!active || !payload?.length || !label) return null;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-gray-900 dark:text-white mb-2">{getMonthLabel(label)}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
            <span>{p.name}:</span>
            <span>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const eventMonthsByMonth = eventMonths.reduce<Record<string, string[]>>((acc, { month: m, label }) => {
    if (!acc[m]) acc[m] = [];
    acc[m].push(label);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <h1 className="page-title">现金流预测</h1>

      {/* Controls */}
      <div className="card flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="label mb-0">预测周期：</span>
          <input
            type="range"
            min={12}
            max={24}
            value={forecastHorizon}
            onChange={(e) => setForecastHorizon(Number(e.target.value))}
            className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{forecastHorizon} 个月</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="label mb-0">情景选择：</span>
          <div className="flex gap-2">
            {(['optimistic', 'baseline', 'pessimistic'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedScenario(s)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedScenario === s
                    ? s === 'optimistic'
                      ? 'bg-green-600 text-white'
                      : s === 'baseline'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {scenarioLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="stat-label">12个月净现金流</p>
            <p className={`stat-value ${net12 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(net12)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="stat-label">12个月累计现金流</p>
            <p className={`stat-value ${cum12 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(cum12)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="stat-label">24个月净现金流</p>
            <p className={`stat-value ${net24 !== null ? (net24 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-400'}`}>
              {net24 !== null ? formatCurrency(net24) : '—'}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <TrendingDown className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="stat-label">24个月累计现金流</p>
            <p className={`stat-value ${cum24 !== null ? (cum24 >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-400'}`}>
              {cum24 !== null ? formatCurrency(cum24) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="section-title mb-4">累计现金流趋势</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              {Object.entries(eventMonthsByMonth).map(([m, labels]) => (
                <ReferenceLine
                  key={m}
                  x={getMonthLabel(m)}
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  label={{ value: labels[0], position: 'top', fontSize: 10 }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="optimisticCumulative"
                name="乐观累计"
                stroke={OPTIMISTIC_COLOR}
                fill={OPTIMISTIC_COLOR}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="baselineCumulative"
                name="基准累计"
                stroke={BASELINE_COLOR}
                fill={BASELINE_COLOR}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="pessimisticCumulative"
                name="悲观累计"
                stroke={PESSIMISTIC_COLOR}
                fill={PESSIMISTIC_COLOR}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="card overflow-hidden">
        <h2 className="section-title mb-4">月度明细</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">月份</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">收入</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">支出</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">分期</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">债务还款</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">储蓄</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">净现金流</th>
                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">累计</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">关键事件</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr
                  key={m.month}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="py-2 px-2 text-gray-900 dark:text-white">{getMonthLabel(m.month)}</td>
                  <td className="py-2 px-2 text-right text-green-600 dark:text-green-400">{formatCurrency(m.income)}</td>
                  <td className="py-2 px-2 text-right text-red-600 dark:text-red-400">{formatCurrency(m.expenses)}</td>
                  <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(m.installments)}</td>
                  <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(m.debtPayments)}</td>
                  <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(m.savingsContributions)}</td>
                  <td
                    className={`py-2 px-2 text-right font-medium ${
                      m.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(m.netCashFlow)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right font-medium ${
                      m.cumulativeCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(m.cumulativeCashFlow)}
                  </td>
                  <td className="py-2 px-2 text-left text-amber-600 dark:text-amber-400 text-xs">
                    {m.events?.length ? m.events.join('；') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
