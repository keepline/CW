import { useEffect, useState } from 'react';
import { savingsApi } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';
import type { SavingsGoal } from '@/types';
import { PiggyBank, Plus, Trash2, Edit, ArrowUpCircle, Calculator } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const emptyForm = {
  name: '',
  target_amount: 0,
  current_amount: 0,
  deadline: '',
  monthly_contribution: 0,
  note: '',
};

function getMonthsRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const end = new Date(deadline);
  if (end <= now) return 0;
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
}

function getSuggestedMonthly(target: number, current: number, deadline: string | null): number | null {
  const months = getMonthsRemaining(deadline);
  if (months === null || months <= 0) return null;
  const remaining = Math.max(0, target - current);
  return remaining / months;
}

function simulateInvestment(
  current: number,
  monthly: number,
  months: number,
  annualRate: number
): { linear: number[]; growth: number[] } {
  const linear: number[] = [current];
  const growth: number[] = [current];
  const monthlyRate = annualRate / 100 / 12;

  for (let m = 0; m < months; m++) {
    linear.push(linear[linear.length - 1] + monthly);
    const prev = growth[growth.length - 1];
    growth.push(prev * (1 + monthlyRate) + monthly);
  }
  return { linear, growth };
}

export default function Savings() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState<number>(0);
  const [simulatorGoal, setSimulatorGoal] = useState<SavingsGoal | null>(null);
  const [simulatorRate, setSimulatorRate] = useState<number>(5);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const list = (await savingsApi.list()) as SavingsGoal[];
      setGoals(list || []);
    } catch (err) {
      console.error('Fetch savings goals error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const openAdd = () => {
    setEditing(null);
    const today = new Date();
    today.setFullYear(today.getFullYear() + 1);
    setForm({
      ...emptyForm,
      deadline: today.toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditing(g);
    setForm({
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      deadline: g.deadline ? g.deadline.slice(0, 10) : '',
      monthly_contribution: g.monthly_contribution,
      note: g.note || '',
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
      name: form.name,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount),
      deadline: form.deadline || null,
      monthly_contribution: Number(form.monthly_contribution),
      note: form.note || '',
    };
    try {
      if (editing) {
        await savingsApi.update(editing.id, payload);
      } else {
        await savingsApi.create(payload);
      }
      closeModal();
      fetchGoals();
    } catch (err) {
      console.error('Save savings goal error:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await savingsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchGoals();
    } catch (err) {
      console.error('Delete savings goal error:', err);
    }
  };

  const handleContribute = async () => {
    if (!contributeGoal || contributeAmount <= 0) return;
    try {
      await savingsApi.contribute(contributeGoal.id, contributeAmount);
      setContributeGoal(null);
      setContributeAmount(0);
      fetchGoals();
    } catch (err) {
      console.error('Contribute error:', err);
    }
  };

  const totalSavings = goals.reduce((a, g) => a + g.current_amount, 0);
  const closestDeadline = goals
    .filter((g) => g.deadline && new Date(g.deadline) > new Date())
    .sort((a, b) => (a.deadline && b.deadline ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime() : 0))[0];

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">储蓄目标</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title flex items-center gap-2">
          <PiggyBank className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          储蓄目标
        </h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加目标
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">储蓄总额</p>
          <p className="stat-value text-primary-600 dark:text-primary-400">{formatCurrency(totalSavings)}</p>
        </div>
        <div className="card">
          <p className="stat-label">目标数量</p>
          <p className="stat-value text-gray-900 dark:text-white">{goals.length} 个</p>
        </div>
        <div className="card">
          <p className="stat-label">最近截止</p>
          <p className="stat-value text-gray-900 dark:text-white">
            {closestDeadline ? formatDate(closestDeadline.deadline!) : '—'}
          </p>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PiggyBank}
            title="暂无储蓄目标"
            description="添加您的储蓄目标，如购房首付、旅行基金、应急金等，设定目标金额和截止日期，跟踪储蓄进度。"
            action={{ label: '添加目标', onClick: openAdd }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map((g) => {
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            const progress = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
            const suggestedMonthly = getSuggestedMonthly(g.target_amount, g.current_amount, g.deadline);
            const monthsLeft = getMonthsRemaining(g.deadline);
            const isComplete = g.current_amount >= g.target_amount;

            const pieData = [
              { name: '已完成', value: g.current_amount, color: isComplete ? '#10b981' : '#2563eb' },
              { name: '剩余', value: remaining, color: '#e5e7eb' },
            ].filter((d) => d.value > 0);
            if (pieData.length === 0) {
              pieData.push({ name: '已完成', value: 1, color: '#10b981' });
            }

            return (
              <div key={g.id} className="card space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                      <PiggyBank className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        目标 {formatCurrency(g.target_amount)} · 已存 {formatCurrency(g.current_amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setContributeGoal(g);
                        setContributeAmount(0);
                      }}
                      disabled={isComplete}
                      className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="存入"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(g)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSimulatorGoal(g);
                        setSimulatorRate(5);
                      }}
                      className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      title="投资模拟"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={40}
                          paddingAngle={0}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">进度</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">剩余 </span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(remaining)}</span>
                    </div>
                    {g.deadline && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">截止 {formatDate(g.deadline)}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">月计划存入</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(g.monthly_contribution)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">建议月存</span>
                    <p className="font-medium text-primary-600 dark:text-primary-400">
                      {suggestedMonthly !== null
                        ? formatCurrency(Math.round(suggestedMonthly * 100) / 100)
                        : monthsLeft === 0
                          ? '已到期'
                          : '无截止'}
                    </p>
                  </div>
                </div>

                {g.note && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={g.note}>
                    {g.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? '编辑目标' : '添加目标'} width="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">目标名称</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：购房首付、旅行基金"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">目标金额 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.target_amount || ''}
                onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="label">当前金额 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.current_amount || ''}
                onChange={(e) => setForm({ ...form, current_amount: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">截止日期</label>
              <input
                type="date"
                className="input"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div>
              <label className="label">月计划存入 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.monthly_contribution || ''}
                onChange={(e) => setForm({ ...form, monthly_contribution: Number(e.target.value) || 0 })}
              />
            </div>
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
        title="删除目标"
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
      />

      {/* Contribute Modal */}
      <Modal
        open={!!contributeGoal}
        onClose={() => {
          setContributeGoal(null);
          setContributeAmount(0);
        }}
        title="存入"
        width="max-w-sm"
      >
        {contributeGoal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {contributeGoal.name} · 当前 {formatCurrency(contributeGoal.current_amount)} /{' '}
              {formatCurrency(contributeGoal.target_amount)}
            </p>
            <div>
              <label className="label">存入金额 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                value={contributeAmount || ''}
                onChange={(e) => setContributeAmount(Number(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setContributeGoal(null);
                  setContributeAmount(0);
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleContribute}
                disabled={contributeAmount <= 0}
                className="btn-primary"
              >
                存入
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Investment Simulator Modal */}
      <Modal
        open={!!simulatorGoal}
        onClose={() => setSimulatorGoal(null)}
        title="投资回报模拟"
        width="max-w-md"
      >
        {simulatorGoal && (() => {
          const months = getMonthsRemaining(simulatorGoal.deadline) ?? 12;
          const { linear, growth } = simulateInvestment(
            simulatorGoal.current_amount,
            simulatorGoal.monthly_contribution || 0,
            months,
            simulatorRate
          );
          const linearEnd = linear[linear.length - 1];
          const growthEnd = growth[growth.length - 1];
          const extra = growthEnd - linearEnd;

          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {simulatorGoal.name} · 剩余 {months} 个月
              </p>
              <div>
                <label className="label">年化收益率 (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  className="input"
                  value={simulatorRate}
                  onChange={(e) => setSimulatorRate(Number(e.target.value) || 0)}
                />
              </div>
              <div className="card bg-gray-50 dark:bg-gray-700/50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">纯储蓄（无收益）</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(linearEnd)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">投资增值后</span>
                  <span className="font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(growthEnd)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-gray-500 dark:text-gray-400">预计多出</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(extra)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                以上为简化估算，实际收益受市场波动影响。
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
