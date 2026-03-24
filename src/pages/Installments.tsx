import { useEffect, useState } from 'react';
import { installmentApi } from '@/utils/api';
import { formatCurrency, formatDate, formatPercent } from '@/utils/format';
import type { Installment } from '@/types';
import { CreditCard, Plus, Trash2, Edit, CheckCircle, Calculator } from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const emptyForm = {
  name: '',
  total_amount: 0,
  total_periods: 12,
  paid_periods: 0,
  monthly_payment: 0,
  interest_rate: 0,
  start_date: '',
  payment_day: 1,
  note: '',
};

function calcEarlyRepayment(
  totalAmount: number,
  totalPeriods: number,
  paidPeriods: number,
  monthlyPayment: number,
  monthsToPrepay: number
) {
  const remainingPeriods = totalPeriods - paidPeriods;
  if (remainingPeriods <= 0 || monthsToPrepay >= remainingPeriods) return { interestSaved: 0, prepayAmount: 0 };
  const totalPaidIfFull = monthlyPayment * totalPeriods;
  const totalInterestFull = Math.max(0, totalPaidIfFull - totalAmount);
  const interestPerPeriod = totalInterestFull / totalPeriods;
  const periodsSaved = remainingPeriods - monthsToPrepay;
  const interestSaved = interestPerPeriod * periodsSaved;
  const prepayAmount = monthlyPayment * monthsToPrepay;
  return { interestSaved, prepayAmount };
}

export default function Installments() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Installment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Installment | null>(null);
  const [calcInstallment, setCalcInstallment] = useState<Installment | null>(null);
  const [prepayMonths, setPrepayMonths] = useState<number>(1);

  const fetchInstallments = async () => {
    setLoading(true);
    try {
      const list = (await installmentApi.list()) as Installment[];
      setInstallments(list || []);
    } catch (err) {
      console.error('Fetch installments error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, []);

  const openAdd = () => {
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, start_date: today });
    setModalOpen(true);
  };

  const openEdit = (i: Installment) => {
    setEditing(i);
    setForm({
      name: i.name,
      total_amount: i.total_amount,
      total_periods: i.total_periods,
      paid_periods: i.paid_periods,
      monthly_payment: i.monthly_payment,
      interest_rate: i.interest_rate ? i.interest_rate * 100 : 0,
      start_date: i.start_date ? i.start_date.slice(0, 10) : '',
      payment_day: i.payment_day,
      note: i.note || '',
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
      total_periods: Number(form.total_periods),
      paid_periods: Number(form.paid_periods),
      monthly_payment: Number(form.monthly_payment),
      interest_rate: Number(form.interest_rate) / 100,
      payment_day: Number(form.payment_day),
      account_id: editing?.account_id ?? null,
    };
    try {
      if (editing) {
        await installmentApi.update(editing.id, payload);
      } else {
        await installmentApi.create(payload);
      }
      closeModal();
      fetchInstallments();
    } catch (err) {
      console.error('Save installment error:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await installmentApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchInstallments();
    } catch (err) {
      console.error('Delete installment error:', err);
    }
  };

  const handlePay = async (i: Installment) => {
    if (i.paid_periods >= i.total_periods) return;
    try {
      await installmentApi.pay(i.id);
      fetchInstallments();
    } catch (err) {
      console.error('Pay installment error:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="page-title mb-6">分期管理</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">分期管理</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加分期
        </button>
      </div>

      {installments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="暂无分期"
            description="添加您的分期付款项目，如花呗、信用卡分期、消费贷等，便于统一管理和跟踪还款进度。"
            action={{ label: '添加分期', onClick: openAdd }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {installments.map((i) => {
            const remainingPeriods = i.total_periods - i.paid_periods;
            const remainingAmount = Math.max(0, i.monthly_payment * remainingPeriods);
            const progress = i.total_periods > 0 ? (i.paid_periods / i.total_periods) * 100 : 0;
            const isComplete = i.paid_periods >= i.total_periods;

            return (
              <div key={i.id} className="card space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                      <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{i.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        已还 {i.paid_periods}/{i.total_periods} 期 · 月供 {formatCurrency(i.monthly_payment)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePay(i)}
                      disabled={isComplete}
                      className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="标记本期已还"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(i)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(i)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setCalcInstallment(i);
                        setPrepayMonths(remainingPeriods > 1 ? remainingPeriods - 1 : 1);
                      }}
                      disabled={isComplete}
                      className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="提前还款模拟"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">还款进度</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isComplete ? 'bg-green-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">总金额</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(i.total_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">剩余期数</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {remainingPeriods} 期
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">剩余金额</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(remainingAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">利率</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatPercent(i.interest_rate)}
                    </p>
                  </div>
                </div>

                {i.start_date && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    开始日期：{formatDate(i.start_date)} · 每月 {i.payment_day} 日还款
                  </p>
                )}
                {i.note && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={i.note}>
                    {i.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? '编辑分期' : '添加分期'}
        width="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">名称</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：花呗、信用卡分期"
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
              <label className="label">总期数</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.total_periods || ''}
                onChange={(e) => setForm({ ...form, total_periods: Number(e.target.value) || 1 })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">已还期数</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.paid_periods || ''}
                onChange={(e) => setForm({ ...form, paid_periods: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="label">月供 (元)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.monthly_payment || ''}
                onChange={(e) => setForm({ ...form, monthly_payment: Number(e.target.value) || 0 })}
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
              <label className="label">每月还款日</label>
              <input
                type="number"
                min="1"
                max="28"
                className="input"
                value={form.payment_day || ''}
                onChange={(e) => setForm({ ...form, payment_day: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div>
            <label className="label">开始日期</label>
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
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
        title="删除分期"
        message={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        danger
      />

      {/* Early Repayment Calculator Modal */}
      <Modal
        open={!!calcInstallment}
        onClose={() => setCalcInstallment(null)}
        title="提前还款模拟器"
        width="max-w-md"
      >
        {calcInstallment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {calcInstallment.name} · 剩余{' '}
              {calcInstallment.total_periods - calcInstallment.paid_periods} 期
            </p>
            <div>
              <label className="label">计划在多少个月内还清</label>
              <input
                type="number"
                min="1"
                max={calcInstallment.total_periods - calcInstallment.paid_periods}
                className="input"
                value={prepayMonths}
                onChange={(e) => setPrepayMonths(Number(e.target.value) || 1)}
              />
            </div>
            {(() => {
              const { interestSaved, prepayAmount } = calcEarlyRepayment(
                calcInstallment.total_amount,
                calcInstallment.total_periods,
                calcInstallment.paid_periods,
                calcInstallment.monthly_payment,
                prepayMonths
              );
              return (
                <div className="card bg-gray-50 dark:bg-gray-700/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">预计还款金额</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(prepayAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">预计节省利息</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(interestSaved)}
                    </span>
                  </div>
                </div>
              );
            })()}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              以上为简化估算，实际以金融机构计算为准。
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
