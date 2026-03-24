import { useEffect, useState } from 'react';
import { incomeSourceApi, transactionApi, categoryApi } from '@/utils/api';
import { formatCurrency, formatDate, getFrequencyLabel, getCurrentYearMonth } from '@/utils/format';
import type { IncomeSource, Transaction, Category } from '@/types';
import { Wallet, Plus, Trash2, Edit } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#ef4444'];

function monthlyEquivalent(amount: number, frequency: string): number {
  if (frequency === 'monthly') return amount;
  if (frequency === 'biweekly') return amount * (26 / 12);
  if (frequency === 'weekly') return amount * (52 / 12);
  return 0; // irregular
}

const emptySourceForm = {
  name: '',
  amount: 0,
  frequency: 'monthly' as 'monthly' | 'biweekly' | 'weekly' | 'irregular',
  pay_day: 1,
  is_active: 1,
  note: '',
};

const emptyTransactionForm = {
  amount: 0,
  category_id: null as number | null,
  date: '',
  note: '',
};

export default function Income() {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [deleteSourceTarget, setDeleteSourceTarget] = useState<IncomeSource | null>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<Transaction | null>(null);
  const [filterYear, setFilterYear] = useState(getCurrentYearMonth().year);
  const [filterMonth, setFilterMonth] = useState(getCurrentYearMonth().month);
  const [trendData, setTrendData] = useState<{ month: string; 收入: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);

  const { year, month } = getCurrentYearMonth();

  const fetchIncomeSources = async () => {
    try {
      const list = (await incomeSourceApi.list()) as IncomeSource[];
      setIncomeSources(list || []);
    } catch (err) {
      console.error('Fetch income sources error:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(filterYear, filterMonth, 0).getDate();
      const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const filters = {
        type: 'income',
        startDate,
        endDate,
      };
      const list = (await transactionApi.list(filters)) as Transaction[];
      setTransactions(list || []);
    } catch (err) {
      console.error('Fetch transactions error:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const list = (await categoryApi.list('income')) as Category[];
      setCategories(list || []);
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  const fetchTrendData = async () => {
    try {
      const data: { month: string; 收入: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let y = year;
        let m = month - i;
        if (m <= 0) {
          m += 12;
          y -= 1;
        }
        const res = (await transactionApi.summary(y, m)) as { income: number };
        data.push({
          month: `${y}年${m}月`,
          收入: res?.income ?? 0,
        });
      }
      setTrendData(data);
    } catch (err) {
      console.error('Fetch trend error:', err);
    }
  };

  const fetchPieData = () => {
    const activeSources = incomeSources.filter((s) => s.is_active !== 0);
    const data = activeSources
      .map((s, i) => ({
        name: s.name,
        value: monthlyEquivalent(s.amount, s.frequency),
        color: COLORS[i % COLORS.length],
      }))
      .filter((d) => d.value > 0);
    setPieData(data);
  };

  const fetchMonthlyTotal = async () => {
    try {
      const res = (await transactionApi.summary(year, month)) as { income: number };
      setMonthlyTotal(res?.income ?? 0);
    } catch (err) {
      console.error('Fetch monthly total error:', err);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchIncomeSources(), fetchCategories()]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchMonthlyTotal();
  }, [filterYear, filterMonth]);

  useEffect(() => {
    fetchPieData();
  }, [incomeSources]);

  useEffect(() => {
    fetchTrendData();
  }, [year, month]);

  const activeSourcesCount = incomeSources.filter((s) => s.is_active !== 0).length;

  const openAddSource = () => {
    setEditingSource(null);
    setSourceForm(emptySourceForm);
    setSourceModalOpen(true);
  };

  const openEditSource = (s: IncomeSource) => {
    setEditingSource(s);
    setSourceForm({
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      pay_day: s.pay_day,
      is_active: s.is_active,
      note: s.note || '',
    });
    setSourceModalOpen(true);
  };

  const closeSourceModal = () => {
    setSourceModalOpen(false);
    setEditingSource(null);
    setSourceForm(emptySourceForm);
  };

  const handleSubmitSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: sourceForm.name,
      amount: Number(sourceForm.amount),
      frequency: sourceForm.frequency,
      pay_day: Number(sourceForm.pay_day),
      is_active: sourceForm.is_active,
      note: sourceForm.note,
    };
    try {
      if (editingSource) {
        await incomeSourceApi.update(editingSource.id, payload);
      } else {
        await incomeSourceApi.create(payload);
      }
      closeSourceModal();
      fetchIncomeSources();
    } catch (err) {
      console.error('Save income source error:', err);
    }
  };

  const handleDeleteSource = async () => {
    if (!deleteSourceTarget) return;
    try {
      await incomeSourceApi.delete(deleteSourceTarget.id);
      setDeleteSourceTarget(null);
      fetchIncomeSources();
    } catch (err) {
      console.error('Delete income source error:', err);
    }
  };

  const toggleSourceActive = async (s: IncomeSource) => {
    try {
      await incomeSourceApi.update(s.id, {
        ...s,
        is_active: s.is_active ? 0 : 1,
      });
      fetchIncomeSources();
    } catch (err) {
      console.error('Toggle income source error:', err);
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
      type: 'income' as const,
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
      fetchMonthlyTotal();
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
      fetchMonthlyTotal();
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
        <h1 className="page-title mb-6">收入管理</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="page-title flex items-center gap-2">
        <Wallet className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        收入管理
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
            <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="stat-label">月总收入</p>
            <p className="stat-value text-green-600 dark:text-green-400">
              {formatCurrency(monthlyTotal)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary-100 dark:bg-primary-900/30">
            <Wallet className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="stat-label">活跃收入来源数</p>
            <p className="stat-value text-primary-600 dark:text-primary-400">
              {activeSourcesCount}
            </p>
          </div>
        </div>
      </div>

      {/* Income sources section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="section-title">收入来源</h2>
          <button onClick={openAddSource} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加收入来源
          </button>
        </div>

        {incomeSources.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title="暂无收入来源"
              description="添加工资、副业、投资等收入来源，便于统一管理和收入结构分析。"
              action={{ label: '添加收入来源', onClick: openAddSource }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incomeSources.map((s) => (
              <div
                key={s.id}
                className={`card flex items-start justify-between ${s.is_active === 0 ? 'opacity-60' : ''}`}
              >
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatCurrency(s.amount)} · {getFrequencyLabel(s.frequency)}
                  </p>
                  {s.frequency !== 'irregular' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      月均约 {formatCurrency(monthlyEquivalent(s.amount, s.frequency))} · 每月 {s.pay_day} 日
                    </p>
                  )}
                  {s.frequency === 'irregular' && s.pay_day > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      每月 {s.pay_day} 日
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSourceActive(s)}
                    className={`p-2 rounded-lg transition-colors ${
                      s.is_active
                        ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}
                    title={s.is_active ? '设为停用' : '设为活跃'}
                  >
                    <span className="text-xs font-medium">{s.is_active ? '停用' : '启用'}</span>
                  </button>
                  <button
                    onClick={() => openEditSource(s)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteSourceTarget(s)}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title mb-4">收入结构分析</h2>
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
              暂无活跃收入来源
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="section-title mb-4">收入趋势（近6个月）</h2>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* Income transactions section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="section-title">收入记录</h2>
          <div className="flex items-center gap-4">
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
            <button onClick={openAddTransaction} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              记录收入
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">收入明细</h2>
          {transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="暂无收入记录"
              description="添加工资、奖金、兼职等收入记录，便于追踪收入变化。"
              action={{ label: '记录收入', onClick: openAddTransaction }}
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
                        backgroundColor: `${t.category_color || '#10b981'}20`,
                        color: t.category_color || '#059669',
                      }}
                    >
                      <Wallet className="w-5 h-5" />
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
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      +{formatCurrency(t.amount)}
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

      {/* Income source modal */}
      <Modal
        open={sourceModalOpen}
        onClose={closeSourceModal}
        title={editingSource ? '编辑收入来源' : '添加收入来源'}
        width="max-w-lg"
      >
        <form onSubmit={handleSubmitSource} className="space-y-4">
          <div>
            <label className="label">名称</label>
            <input
              type="text"
              className="input"
              value={sourceForm.name}
              onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
              placeholder="如：工资、副业、投资"
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
              value={sourceForm.amount || ''}
              onChange={(e) => setSourceForm({ ...sourceForm, amount: Number(e.target.value) || 0 })}
              required
            />
          </div>
          <div>
            <label className="label">频率</label>
            <select
              className="input"
              value={sourceForm.frequency}
              onChange={(e) =>
                setSourceForm({
                  ...sourceForm,
                  frequency: e.target.value as 'monthly' | 'biweekly' | 'weekly' | 'irregular',
                })
              }
            >
              <option value="monthly">每月</option>
              <option value="biweekly">每两周</option>
              <option value="weekly">每周</option>
              <option value="irregular">不定期</option>
            </select>
          </div>
          <div>
            <label className="label">发薪日（每月几号）</label>
            <input
              type="number"
              min="1"
              max="28"
              className="input"
              value={sourceForm.pay_day || ''}
              onChange={(e) => setSourceForm({ ...sourceForm, pay_day: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!sourceForm.is_active}
                onChange={(e) => setSourceForm({ ...sourceForm, is_active: e.target.checked ? 1 : 0 })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              启用
            </label>
          </div>
          <div>
            <label className="label">备注</label>
            <textarea
              className="input min-h-[80px]"
              value={sourceForm.note}
              onChange={(e) => setSourceForm({ ...sourceForm, note: e.target.value })}
              placeholder="可选"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeSourceModal} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editingSource ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Income transaction modal */}
      <Modal
        open={transactionModalOpen}
        onClose={closeTransactionModal}
        title={editingTransaction ? '编辑收入记录' : '记录收入'}
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

      {/* Delete source confirm */}
      <ConfirmDialog
        open={!!deleteSourceTarget}
        onClose={() => setDeleteSourceTarget(null)}
        onConfirm={handleDeleteSource}
        title="删除收入来源"
        message={deleteSourceTarget ? `确定要删除「${deleteSourceTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
      />

      {/* Delete transaction confirm */}
      <ConfirmDialog
        open={!!deleteTransactionTarget}
        onClose={() => setDeleteTransactionTarget(null)}
        onConfirm={handleDeleteTransaction}
        title="删除收入记录"
        message={
          deleteTransactionTarget
            ? `确定要删除这条收入记录（${formatCurrency(deleteTransactionTarget.amount)}）吗？此操作不可恢复。`
            : ''
        }
        confirmText="删除"
        danger
      />
    </div>
  );
}
