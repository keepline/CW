import { useEffect, useState } from 'react';
import { debtApi, installmentApi } from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { compareStrategies } from '@/utils/strategy/debtOptimizer';
import type { Debt, DebtPayoffStep, Installment } from '@/types';
import { TrendingUp, Plus, Trash2, Edit, Zap, Snowflake, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from 'recharts';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

interface DebtWithSource extends Debt {
  _source?: 'manual' | 'installment';
}

function installmentToDebt(inst: Installment): DebtWithSource {
  const remainingPeriods = inst.total_periods - inst.paid_periods;
  const totalPaymentsOverLife = inst.monthly_payment * inst.total_periods;
  const isInterestOnly = totalPaymentsOverLife < inst.total_amount * 0.5;

  let remainingAmount: number;
  let label: string;

  if (isInterestOnly) {
    remainingAmount = inst.total_amount + inst.monthly_payment * remainingPeriods;
    label = `自动关联自分期管理 · 剩余${remainingPeriods}期(先息后本，本金¥${inst.total_amount.toLocaleString()}到期一次偿还)`;
  } else {
    remainingAmount = inst.monthly_payment * remainingPeriods;
    label = `自动关联自分期管理 · 剩余${remainingPeriods}期`;
  }

  return {
    id: -inst.id,
    name: `[分期] ${inst.name}`,
    total_amount: inst.total_amount,
    remaining_amount: Math.round(remainingAmount * 100) / 100,
    interest_rate: inst.interest_rate * 100,
    minimum_payment: inst.monthly_payment,
    due_day: inst.payment_day,
    note: label,
    created_at: inst.created_at,
    _source: 'installment',
  };
}

const emptyForm = {
  name: '',
  total_amount: 0,
  remaining_amount: 0,
  interest_rate: 0,
  minimum_payment: 0,
  due_day: 1,
  note: '',
};

function buildTimelineData(
  initialTotal: number,
  avalancheSchedule: DebtPayoffStep[],
  snowballSchedule: DebtPayoffStep[],
  avalancheMonths: number,
  snowballMonths: number
) {
  const avalancheByMonth = new Map<number, number>();
  const snowballByMonth = new Map<number, number>();

  for (const step of avalancheSchedule) {
    const current = avalancheByMonth.get(step.month) ?? 0;
    avalancheByMonth.set(step.month, current + step.remainingBalance);
  }
  for (const step of snowballSchedule) {
    const current = snowballByMonth.get(step.month) ?? 0;
    snowballByMonth.set(step.month, current + step.remainingBalance);
  }

  const maxMonth = Math.max(avalancheMonths, snowballMonths, 1);
  const data: { month: number; name: string; 雪崩法: number; 雪球法: number }[] = [
    { month: 0, name: '初始', 雪崩法: initialTotal, 雪球法: initialTotal },
  ];

  for (let m = 1; m <= maxMonth; m++) {
    const av = m > avalancheMonths ? 0 : (avalancheByMonth.get(m) ?? 0);
    const sb = m > snowballMonths ? 0 : (snowballByMonth.get(m) ?? 0);
    data.push({ month: m, name: `第${m}月`, 雪崩法: Math.round(av * 100) / 100, 雪球法: Math.round(sb * 100) / 100 });
  }

  return data;
}

export default function DebtStrategy() {
  const [manualDebts, setManualDebts] = useState<DebtWithSource[]>([]);
  const [installmentDebts, setInstallmentDebts] = useState<DebtWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [extraBudget, setExtraBudget] = useState(0);
  const [expandedAvalanche, setExpandedAvalanche] = useState(false);
  const [expandedSnowball, setExpandedSnowball] = useState(false);

  const debts: DebtWithSource[] = [...installmentDebts, ...manualDebts];

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const [debtList, instList] = await Promise.all([
        debtApi.list() as Promise<Debt[]>,
        installmentApi.list() as Promise<Installment[]>,
      ]);
      setManualDebts((debtList || []).map(d => ({ ...d, _source: 'manual' as const })));
      const activeInstallments = (instList || []).filter(i => i.paid_periods < i.total_periods);
      setInstallmentDebts(activeInstallments.map(installmentToDebt));
    } catch (err) {
      console.error('Fetch debts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setForm({
      name: d.name,
      total_amount: d.total_amount,
      remaining_amount: d.remaining_amount,
      interest_rate: d.interest_rate,
      minimum_payment: d.minimum_payment,
      due_day: d.due_day,
      note: d.note || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      total_amount: Number(form.total_amount),
      remaining_amount: Number(form.remaining_amount),
      interest_rate: Number(form.interest_rate),
      minimum_payment: Number(form.minimum_payment),
      due_day: Number(form.due_day),
    };
    try {
      if (editing) {
        await debtApi.update(editing.id, payload);
      } else {
        await debtApi.create(payload);
      }
      closeModal();
      fetchDebts();
    } catch (err) {
      console.error('Save debt error:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await debtApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchDebts();
    } catch (err) {
      console.error('Delete debt error:', err);
    }
  };

  const activeDebts = debts.filter((d) => d.remaining_amount > 0);
  const comparison = activeDebts.length > 0 ? compareStrategies(debts, extraBudget) : null;
  const initialTotal = activeDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const barChartData = comparison
    ? [
        { name: '雪崩法', 总利息: comparison.avalanche.totalInterest, fill: '#3b82f6' },
        { name: '雪球法', 总利息: comparison.snowball.totalInterest, fill: '#06b6d4' },
      ]
    : [];
  const timelineData =
    comparison && activeDebts.length > 0
      ? buildTimelineData(
          initialTotal,
          comparison.avalanche.schedule,
          comparison.snowball.schedule,
          comparison.avalanche.totalMonths,
          comparison.snowball.totalMonths
        )
      : [];

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">债务策略</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">债务策略</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加债务
        </button>
      </div>

      {debts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={TrendingUp}
            title="暂无债务"
            description="添加您的债务信息，如信用卡、贷款等，系统将为您对比雪崩法与雪球法两种还款策略，帮助您选择最优方案。"
            action={{ label: '添加债务', onClick: openAdd }}
          />
        </div>
      ) : (
        <>
          {/* Installment sync info */}
          {installmentDebts.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-300">
              <Link2 className="w-4 h-4 shrink-0" />
              <span>
                已自动关联 <strong>{installmentDebts.length}</strong> 笔分期还款（剩余合计{' '}
                <strong>{formatCurrency(installmentDebts.reduce((s, d) => s + d.remaining_amount, 0))}</strong>
                ），数据来自「分期管理」模块，与债务一并参与策略计算。
              </span>
            </div>
          )}

          {/* Debt List */}
          <div className="card">
            <h2 className="section-title mb-4">债务列表</h2>
            <div className="space-y-4">
              {debts.map((d) => {
                const dws = d as DebtWithSource;
                const isFromInstallment = dws._source === 'installment';
                const progress = d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount) * 100 : 0;
                const isPaidOff = d.remaining_amount <= 0;
                return (
                  <div
                    key={`${isFromInstallment ? 'inst' : 'debt'}-${d.id}`}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isFromInstallment
                        ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{d.name}</h3>
                        {isFromInstallment && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                            <Link2 className="w-3 h-3" />
                            自动关联
                          </span>
                        )}
                        {isPaidOff && (
                          <span className="badge badge-green">已还清</span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">总金额</span>
                          <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(d.total_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">剩余金额</span>
                          <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(d.remaining_amount)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">利率</span>
                          <p className="font-medium text-gray-900 dark:text-white">{d.interest_rate}%</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">{isFromInstallment ? '月供' : '最低还款'}</span>
                          <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(d.minimum_payment)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">还款日</span>
                          <p className="font-medium text-gray-900 dark:text-white">每月 {d.due_day} 日</p>
                        </div>
                      </div>
                      {!isPaidOff && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>还款进度</span>
                            <span>{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isFromInstallment ? 'bg-orange-500' : 'bg-primary-500'}`}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {isFromInstallment && d.note && (
                        <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">{d.note}</p>
                      )}
                    </div>
                    {!isFromInstallment && (
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => openEdit(d)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(d)}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy Comparison - only when there are active debts */}
          {activeDebts.length > 0 && comparison && (
            <>
              {/* Extra Budget Slider */}
              <div className="card">
                <h2 className="section-title mb-4">额外还款预算模拟</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="label mb-0">每月额外可还金额（元）</label>
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {formatCurrency(extraBudget)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5000}
                      step={100}
                      value={extraBudget}
                      onChange={(e) => setExtraBudget(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>¥0</span>
                      <span>¥5,000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card border-2 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="section-title mb-0">雪崩法（优先高利率）</h3>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">总利息支出</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(comparison.avalanche.totalInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">还清月数</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {comparison.avalanche.totalMonths} 个月
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">还款顺序</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {comparison.avalanche.payoffOrder.join(' → ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedAvalanche(!expandedAvalanche)}
                    className="btn-secondary btn-sm w-full flex items-center justify-center gap-2"
                  >
                    {expandedAvalanche ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {expandedAvalanche ? '收起' : '查看'}月度还款明细
                  </button>
                  {expandedAvalanche && (
                    <div className="mt-4 overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left py-2 px-2">月份</th>
                            <th className="text-left py-2 px-2">债务</th>
                            <th className="text-right py-2 px-2">还款</th>
                            <th className="text-right py-2 px-2">利息</th>
                            <th className="text-right py-2 px-2">剩余</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.avalanche.schedule.map((s, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-1.5 px-2">第{s.month}月</td>
                              <td className="py-1.5 px-2">{s.debtName}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.payment)}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.interestPaid)}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.remainingBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card border-2 border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Snowflake className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="section-title mb-0">雪球法（优先小额）</h3>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">总利息支出</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(comparison.snowball.totalInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">还清月数</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {comparison.snowball.totalMonths} 个月
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">还款顺序</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {comparison.snowball.payoffOrder.join(' → ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedSnowball(!expandedSnowball)}
                    className="btn-secondary btn-sm w-full flex items-center justify-center gap-2"
                  >
                    {expandedSnowball ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {expandedSnowball ? '收起' : '查看'}月度还款明细
                  </button>
                  {expandedSnowball && (
                    <div className="mt-4 overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left py-2 px-2">月份</th>
                            <th className="text-left py-2 px-2">债务</th>
                            <th className="text-right py-2 px-2">还款</th>
                            <th className="text-right py-2 px-2">利息</th>
                            <th className="text-right py-2 px-2">剩余</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.snowball.schedule.map((s, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-1.5 px-2">第{s.month}月</td>
                              <td className="py-1.5 px-2">{s.debtName}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.payment)}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.interestPaid)}</td>
                              <td className="py-1.5 px-2 text-right">{formatCurrency(s.remainingBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendation Card */}
              <div className="card bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                <h3 className="section-title mb-3">策略建议</h3>
                <p className="text-gray-700 dark:text-gray-300">{comparison.advice}</p>
                {comparison.recommendation === 'avalanche' && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    雪崩法通过优先偿还高利率债务，可最大程度减少利息支出，适合注重长期财务效益的您。
                  </p>
                )}
                {comparison.recommendation === 'snowball' && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    雪球法通过先还清小额债务获得成就感，有助于保持还债动力，适合需要心理激励的您。
                  </p>
                )}
              </div>

              {/* Bar Chart - Interest Comparison */}
              <div className="card">
                <h2 className="section-title mb-4">总利息对比</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                      <XAxis dataKey="name" className="text-sm" />
                      <YAxis className="text-sm" tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="总利息" name="总利息支出" radius={[4, 4, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Line Chart - Payoff Timeline */}
              <div className="card">
                <h2 className="section-title mb-4">剩余债务随时间变化</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                      <XAxis dataKey="name" className="text-sm" />
                      <YAxis className="text-sm" tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px' }}
                        labelFormatter={(label) => label}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="雪崩法"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name="雪崩法"
                      />
                      <Line
                        type="monotone"
                        dataKey="雪球法"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                        name="雪球法"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {debts.length > 0 && activeDebts.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-500 dark:text-gray-400">恭喜！您已还清所有债务。</p>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? '编辑债务' : '添加债务'} width="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">名称</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：信用卡、消费贷"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">总金额 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.total_amount || ''}
                onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="label">剩余金额 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.remaining_amount || ''}
                onChange={(e) => setForm({ ...form, remaining_amount: Number(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">年利率 (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.interest_rate || ''}
                onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) || 0 })}
                placeholder="如：5.5"
              />
            </div>
            <div>
              <label className="label">最低还款 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.minimum_payment || ''}
                onChange={(e) => setForm({ ...form, minimum_payment: Number(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">每月还款日</label>
            <input
              type="number"
              min={1}
              max={28}
              className="input"
              value={form.due_day || ''}
              onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="label">备注</label>
            <textarea
              className="input min-h-[80px]"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editing ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除债务"
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
      />
    </div>
  );
}
