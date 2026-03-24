import { useEffect, useState } from 'react';
import { fixedExpenseApi, transactionApi, categoryApi } from '@/utils/api';
import { formatCurrency, formatDate, getFrequencyLabel, getCurrentYearMonth } from '@/utils/format';
import type { FixedExpense, Transaction, Category } from '@/types';
import { Receipt, Plus, Trash2, Edit, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function monthlyEquivalent(amount: number, frequency: string): number {
  if (frequency === 'monthly') return amount;
  if (frequency === 'quarterly') return amount / 3;
  if (frequency === 'yearly') return amount / 12;
  return amount;
}

const emptyFixedForm = {
  name: '',
  amount: 0,
  category_id: null as number | null,
  frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
  due_day: 1,
  note: '',
};

const emptyTransactionForm = {
  amount: 0,
  category_id: null as number | null,
  date: '',
  note: '',
};

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<'fixed' | 'daily'>('fixed');
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixedModalOpen, setFixedModalOpen] = useState(false);
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [fixedForm, setFixedForm] = useState(emptyFixedForm);
  const [deleteFixedTarget, setDeleteFixedTarget] = useState<FixedExpense | null>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<Transaction | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<number | ''>('');
  const [filterYear, setFilterYear] = useState(getCurrentYearMonth().year);
  const [filterMonth, setFilterMonth] = useState(getCurrentYearMonth().month);
  const [trendData, setTrendData] = useState<{ month: string; 支出: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number; color: string }[]>([]);

  const { year, month } = getCurrentYearMonth();

  const fetchFixedExpenses = async () => {
    try {
      const list = (await fixedExpenseApi.list()) as FixedExpense[];
      setFixedExpenses((list || []).filter((f) => f.is_active !== 0));
    } catch (err) {
      console.error('Fetch fixed expenses error:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(filterYear, filterMonth, 0).getDate();
      const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const filters: { type: string; startDate: string; endDate: string; categoryId?: number } = {
        type: 'expense',
        startDate,
        endDate,
      };
      if (filterCategoryId !== '') filters.categoryId = filterCategoryId as number;
      const list = (await transactionApi.list(filters)) as Transaction[];
      setTransactions(list || []);
    } catch (err) {
      console.error('Fetch transactions error:', err);
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

  const fetchTrendData = async () => {
    try {
      const data: { month: string; 支出: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let y = year;
        let m = month - i;
        if (m <= 0) {
          m += 12;
          y -= 1;
        }
        const res = (await transactionApi.summary(y, m)) as { expense: number };
        data.push({
          month: `${y}年${m}月`,
          支出: res?.expense ?? 0,
        });
      }
      setTrendData(data);
    } catch (err) {
      console.error('Fetch trend error:', err);
    }
  };

  const fetchPieData = async () => {
    try {
      const res = (await transactionApi.summary(filterYear, filterMonth)) as any;
      const expenseCats = (res?.byCategory || []).filter((c: any) => c.type === 'expense' && c.total > 0);
      setPieData(
        expenseCats.map((c: any, i: number) => ({
          name: c.name || '未分类',
          value: c.total,
          color: c.color || COLORS[i % COLORS.length],
        }))
      );
    } catch (err) {
      console.error('Fetch pie data error:', err);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchFixedExpenses(), fetchCategories()]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchPieData();
  }, [filterYear, filterMonth, filterCategoryId]);

  useEffect(() => {
    fetchTrendData();
  }, [year, month]);

  const totalMonthlyFixed = fixedExpenses.reduce(
    (sum, f) => sum + monthlyEquivalent(f.amount, f.frequency),
    0
  );

  const openAddFixed = () => {
    setEditingFixed(null);
    setFixedForm(emptyFixedForm);
    setFixedModalOpen(true);
  };

  const openEditFixed = (f: FixedExpense) => {
    setEditingFixed(f);
    setFixedForm({
      name: f.name,
      amount: f.amount,
      category_id: f.category_id,
      frequency: f.frequency,
      due_day: f.due_day,
      note: f.note || '',
    });
    setFixedModalOpen(true);
  };

  const closeFixedModal = () => {
    setFixedModalOpen(false);
    setEditingFixed(null);
    setFixedForm(emptyFixedForm);
  };

  const handleSubmitFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: fixedForm.name,
      amount: Number(fixedForm.amount),
      category_id: fixedForm.category_id || null,
      frequency: fixedForm.frequency,
      due_day: Number(fixedForm.due_day),
      is_active: 1,
      note: fixedForm.note,
    };
    try {
      if (editingFixed) {
        await fixedExpenseApi.update(editingFixed.id, payload);
      } else {
        await fixedExpenseApi.create(payload);
      }
      closeFixedModal();
      fetchFixedExpenses();
    } catch (err) {
      console.error('Save fixed expense error:', err);
    }
  };

  const handleDeleteFixed = async () => {
    if (!deleteFixedTarget) return;
    try {
      await fixedExpenseApi.delete(deleteFixedTarget.id);
      setDeleteFixedTarget(null);
      fetchFixedExpenses();
    } catch (err) {
      console.error('Delete fixed expense error:', err);
    }
  };

  const openAddTransaction = () => {
    setEditingTransaction(null);
    const today = new Date().toISOString().slice(0, 10);
    setTransactionForm({ ...emptyTransactionForm, date: today });
    setTransactionModalOpen(true);
  };

  const openEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setTransactionForm({
      amount: t.amount,
      category_id: t.category_id,
      date: t.date ? t.date.slice(0, 10) : '',
      note: t.note || '',
    });
    setTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setTransactionModalOpen(false);
    setEditingTransaction(null);
    setTransactionForm(emptyTransactionForm);
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: 'expense' as const,
      amount: Number(transactionForm.amount),
      category_id: transactionForm.category_id || null,
      account_id: editingTransaction?.account_id ?? null,
      date: transactionForm.date,
      note: transactionForm.note,
    };
    try {
      if (editingTransaction) {
        await transactionApi.update(editingTransaction.id, payload);
      } else {
        await transactionApi.create(payload);
      }
      closeTransactionModal();
      fetchTransactions();
      fetchPieData();
      fetchTrendData();
    } catch (err) {
      console.error('Save transaction error:', err);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransactionTarget) return;
    try {
      await transactionApi.delete(deleteTransactionTarget.id);
      setDeleteTransactionTarget(null);
      fetchTransactions();
      fetchPieData();
      fetchTrendData();
    } catch (err) {
      console.error('Delete transaction error:', err);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => year - 2 + i);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">支出管理</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <Receipt className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        支出管理
      </h1>

      {/* Summary card */}
      <div className="card flex items-center gap-4">
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
          <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="stat-label">固定支出月均负担</p>
          <p className="stat-value text-red-600 dark:text-red-400">
            {formatCurrency(totalMonthlyFixed)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('fixed')}
          className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
            activeTab === 'fixed'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          固定支出
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
            activeTab === 'daily'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          日常支出
        </button>
      </div>

      {activeTab === 'fixed' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">固定支出列表</h2>
            <button onClick={openAddFixed} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              添加固定支出
            </button>
          </div>

          {fixedExpenses.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Receipt}
                title="暂无固定支出"
                description="添加房租、水电、订阅等固定支出，便于统一管理和预算规划。"
                action={{ label: '添加固定支出', onClick: openAddFixed }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fixedExpenses.map((f) => (
                <div key={f.id} className="card flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{f.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatCurrency(f.amount)} · {getFrequencyLabel(f.frequency)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      每月 {formatCurrency(monthlyEquivalent(f.amount, f.frequency))} · 每月 {f.due_day} 日
                    </p>
                    {f.category_name && (
                      <span
                        className="badge mt-2"
                        style={{
                          backgroundColor: `${f.category_color || '#94a3b8'}20`,
                          color: f.category_color || '#64748b',
                        }}
                      >
                        {f.category_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditFixed(f)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteFixedTarget(f)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="card flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="label mb-0">月份</label>
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
            <div className="flex items-center gap-2">
              <label className="label mb-0">分类</label>
              <select
                className="input w-40"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">全部</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={openAddTransaction} className="btn-primary flex items-center gap-2 ml-auto">
              <Plus className="w-4 h-4" />
              添加支出
            </button>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="section-title mb-4">支出趋势（近6个月）</h2>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="支出" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  暂无数据
                </div>
              )}
            </div>
            <div className="card">
              <h2 className="section-title mb-4">支出分类占比</h2>
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
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  本月暂无支出记录
                </div>
              )}
            </div>
          </div>

          {/* Transaction list */}
          <div className="card">
            <h2 className="section-title mb-4">支出明细</h2>
            {transactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="暂无支出记录"
                description="添加日常支出记录，如餐饮、交通、购物等，便于追踪消费习惯。"
                action={{ label: '添加支出', onClick: openAddTransaction }}
              />
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 -mx-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${t.category_color || '#94a3b8'}20`,
                          color: t.category_color || '#64748b',
                        }}
                      >
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {t.category_name || '未分类'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(t.date)} {t.note && `· ${t.note}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        -{formatCurrency(t.amount)}
                      </span>
                      <button
                        onClick={() => openEditTransaction(t)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTransactionTarget(t)}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
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
        </div>
      )}

      {/* Fixed expense modal */}
      <Modal open={fixedModalOpen} onClose={closeFixedModal} title={editingFixed ? '编辑固定支出' : '添加固定支出'} width="max-w-lg">
        <form onSubmit={handleSubmitFixed} className="space-y-4">
          <div>
            <label className="label">名称</label>
            <input
              type="text"
              className="input"
              value={fixedForm.name}
              onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })}
              placeholder="如：房租、水电、订阅"
              required
            />
          </div>
          <div>
            <label className="label">金额 (元)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={fixedForm.amount || ''}
              onChange={(e) => setFixedForm({ ...fixedForm, amount: Number(e.target.value) || 0 })}
              required
            />
          </div>
          <div>
            <label className="label">分类</label>
            <select
              className="input"
              value={fixedForm.category_id ?? ''}
              onChange={(e) =>
                setFixedForm({
                  ...fixedForm,
                  category_id: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">不分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">频率</label>
            <select
              className="input"
              value={fixedForm.frequency}
              onChange={(e) =>
                setFixedForm({
                  ...fixedForm,
                  frequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                })
              }
            >
              <option value="monthly">每月</option>
              <option value="quarterly">每季度</option>
              <option value="yearly">每年</option>
            </select>
          </div>
          <div>
            <label className="label">到期日（每月几号）</label>
            <input
              type="number"
              min="1"
              max="28"
              className="input"
              value={fixedForm.due_day || ''}
              onChange={(e) => setFixedForm({ ...fixedForm, due_day: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="label">备注</label>
            <textarea
              className="input min-h-[80px]"
              value={fixedForm.note}
              onChange={(e) => setFixedForm({ ...fixedForm, note: e.target.value })}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeFixedModal} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editingFixed ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transaction modal */}
      <Modal
        open={transactionModalOpen}
        onClose={closeTransactionModal}
        title={editingTransaction ? '编辑支出' : '添加支出'}
        width="max-w-lg"
      >
        <form onSubmit={handleSubmitTransaction} className="space-y-4">
          <div>
            <label className="label">金额 (元)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={transactionForm.amount || ''}
              onChange={(e) =>
                setTransactionForm({ ...transactionForm, amount: Number(e.target.value) || 0 })
              }
              required
            />
          </div>
          <div>
            <label className="label">分类</label>
            <select
              className="input"
              value={transactionForm.category_id ?? ''}
              onChange={(e) =>
                setTransactionForm({
                  ...transactionForm,
                  category_id: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">不分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">日期</label>
            <input
              type="date"
              className="input"
              value={transactionForm.date}
              onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">备注</label>
            <textarea
              className="input min-h-[80px]"
              value={transactionForm.note}
              onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeTransactionModal} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editingTransaction ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete fixed confirm */}
      <ConfirmDialog
        open={!!deleteFixedTarget}
        onClose={() => setDeleteFixedTarget(null)}
        onConfirm={handleDeleteFixed}
        title="删除固定支出"
        message={deleteFixedTarget ? `确定要删除「${deleteFixedTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
      />

      {/* Delete transaction confirm */}
      <ConfirmDialog
        open={!!deleteTransactionTarget}
        onClose={() => setDeleteTransactionTarget(null)}
        onConfirm={handleDeleteTransaction}
        title="删除支出记录"
        message={
          deleteTransactionTarget
            ? `确定要删除这条支出记录（${formatCurrency(deleteTransactionTarget.amount)}）吗？此操作不可恢复。`
            : ''
        }
        confirmText="删除"
        danger
      />
    </div>
  );
}
