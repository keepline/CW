import { useEffect, useState } from 'react';
import { budgetApi, transactionApi, categoryApi } from '@/utils/api';
import { formatCurrency, getCurrentYearMonth } from '@/utils/format';
import type { Budget, Category, TransactionSummary } from '@/types';
import { BarChart3, Plus, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const emptyForm = {
  category_id: null as number | null,
  amount: 0,
  period: 'monthly' as 'monthly' | 'yearly',
};

interface BudgetWithActual extends Budget {
  actual: number;
  percentUsed: number;
  isOverspent: boolean;
}

function getProgressBarClass(percentUsed: number): string {
  if (percentUsed > 100) return 'bg-red-500';
  if (percentUsed >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getBadgeClass(percentUsed: number): string {
  if (percentUsed > 100) return 'badge-red';
  if (percentUsed >= 80) return 'badge-yellow';
  return 'badge-green';
}

export default function Budget() {
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [historyCompletion, setHistoryCompletion] = useState<{ month: string; rate: number }[]>([]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const fetchBudgets = async () => {
    try {
      const list = (await budgetApi.list(filterYear, filterMonth)) as Budget[];
      setBudgets(list || []);
    } catch (err) {
      console.error('Fetch budgets error:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const list = (await categoryApi.list('expense')) as Category[];
      setCategories(list || []);
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = (await transactionApi.summary(filterYear, filterMonth)) as TransactionSummary;
      setSummary(res || null);
    } catch (err) {
      console.error('Fetch summary error:', err);
    }
  };

  const fetchHistoryCompletion = async () => {
    try {
      const data: { month: string; rate: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let y = currentYear;
        let m = currentMonth - i;
        if (m <= 0) {
          m += 12;
          y -= 1;
        }
        const [budgetList, sumRes] = await Promise.all([
          budgetApi.list(y, m) as Promise<Budget[]>,
          transactionApi.summary(y, m) as Promise<TransactionSummary>,
        ]);
        const list = budgetList || [];
        const sum = sumRes || { expense: 0, byCategory: [] };
        const totalBudgeted = list.reduce((a, b) => a + b.amount, 0);
        const expenseByCategory = (sum.byCategory || []).filter((c: { type: string }) => c.type === 'expense');
        const categorySpentMap: Record<string, number> = {};
        expenseByCategory.forEach((c: { name: string; total: number }) => {
          const name = c.name || '未分类';
          categorySpentMap[name] = (categorySpentMap[name] || 0) + (c.total || 0);
        });
        let totalOverspent = 0;
        list.forEach((b) => {
          const spent = categorySpentMap[b.category_name || ''] ?? 0;
          totalOverspent += Math.max(0, spent - b.amount);
        });
        const rate = totalBudgeted > 0 ? Math.max(0, 1 - totalOverspent / totalBudgeted) : 1;
        data.push({ month: `${y}年${m}月`, rate });
      }
      setHistoryCompletion(data);
    } catch (err) {
      console.error('Fetch history completion error:', err);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchHistoryCompletion()]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    Promise.all([fetchBudgets(), fetchSummary()]);
  }, [filterYear, filterMonth]);

  const expenseByCategory = (summary?.byCategory || []).filter((c) => c.type === 'expense');
  const categorySpentMap: Record<string, number> = {};
  expenseByCategory.forEach((c) => {
    const name = c.name || '未分类';
    categorySpentMap[name] = (categorySpentMap[name] || 0) + (c.total || 0);
  });

  const budgetsWithActual: BudgetWithActual[] = budgets.map((b) => {
    const actual = categorySpentMap[b.category_name || ''] ?? 0;
    const percentUsed = b.amount > 0 ? (actual / b.amount) * 100 : 0;
    return {
      ...b,
      actual,
      percentUsed,
      isOverspent: actual > b.amount,
    };
  });

  const totalBudgeted = budgets.reduce((a, b) => a + b.amount, 0);
  const totalSpent = expenseByCategory.reduce((a, c) => a + (c.total || 0), 0);
  const overallAdherence = totalBudgeted > 0
    ? budgetsWithActual.reduce((acc, b) => {
        const within = b.amount > 0 ? Math.min(1, b.actual / b.amount) : 1;
        return acc + (within * b.amount) / totalBudgeted;
      }, 0)
    : 1;

  const chartData = budgetsWithActual.map((b) => ({
    name: b.category_name || '未分类',
    预算: b.amount,
    实际: b.actual,
  }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    setForm({
      category_id: b.category_id,
      amount: b.amount,
      period: b.period || 'monthly',
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
    if (!form.category_id) return;
    const payload = {
      category_id: form.category_id,
      amount: Number(form.amount),
      period: form.period,
      year: filterYear,
      month: filterMonth,
    };
    try {
      if (editing) {
        await budgetApi.update(editing.id, payload);
      } else {
        await budgetApi.create(payload);
      }
      closeModal();
      fetchBudgets();
      fetchHistoryCompletion();
    } catch (err) {
      console.error('Save budget error:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await budgetApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchBudgets();
      fetchHistoryCompletion();
    } catch (err) {
      console.error('Delete budget error:', err);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">预算规划</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <BarChart3 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        预算规划
      </h1>

      {/* Month/Year selector */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="label mb-0">选择月份</label>
          <select
            className="input w-24"
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <select
            className="input w-24"
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加预算
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">总预算</p>
          <p className="stat-value text-gray-900 dark:text-white">{formatCurrency(totalBudgeted)}</p>
        </div>
        <div className="card">
          <p className="stat-label">实际支出</p>
          <p className="stat-value text-red-600 dark:text-red-400">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="card">
          <p className="stat-label">预算执行率</p>
          <p className="stat-value text-primary-600 dark:text-primary-400">
            {(overallAdherence * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Historical completion rate */}
      {historyCompletion.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">历史预算完成率</h2>
          <div className="flex flex-wrap gap-2">
            {historyCompletion.map((h) => (
              <span key={h.month} className="badge badge-blue">
                {h.month}: {(h.rate * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="card">
        <h2 className="section-title mb-4">预算 vs 实际对比</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="预算" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="实际" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
            暂无预算数据，请先添加预算
          </div>
        )}
      </div>

      {/* Budget list */}
      <div className="card">
        <h2 className="section-title mb-4">预算明细</h2>
        {budgetsWithActual.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="暂无预算"
            description="为各支出分类设置月度预算，便于控制消费、追踪执行情况。"
            action={{ label: '添加预算', onClick: openAdd }}
          />
        ) : (
          <ul className="space-y-4">
            {budgetsWithActual.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${b.category_color || '#94a3b8'}20`,
                      color: b.category_color || '#64748b',
                    }}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {b.category_name || '未分类'}
                      </span>
                      {b.isOverspent && (
                        <span className="badge-red flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          超支
                        </span>
                      )}
                      {!b.isOverspent && b.percentUsed >= 80 && (
                        <span className="badge-yellow">接近上限</span>
                      )}
                      {!b.isOverspent && b.percentUsed < 80 && (
                        <span className={getBadgeClass(b.percentUsed)}>正常</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      <span>预算 {formatCurrency(b.amount)}</span>
                      <span>实际 {formatCurrency(b.actual)}</span>
                      <span>已用 {(b.percentUsed).toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressBarClass(b.percentUsed)}`}
                        style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                  <button
                    onClick={() => openEdit(b)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(b)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? '编辑预算' : '添加预算'}
        width="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">支出分类</label>
            <select
              className="input"
              value={form.category_id ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  category_id: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              required
            >
              <option value="">请选择分类</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">预算金额 (元)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
              required
            />
          </div>
          <div>
            <label className="label">周期</label>
            <select
              className="input"
              value={form.period}
              onChange={(e) =>
                setForm({
                  ...form,
                  period: e.target.value as 'monthly' | 'yearly',
                })
              }
            >
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
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
        title="删除预算"
        message={
          deleteTarget
            ? `确定要删除「${deleteTarget.category_name || '未分类'}」的预算吗？此操作不可恢复。`
            : ''
        }
        confirmText="删除"
        danger
      />
    </div>
  );
}
