import { useEffect, useState } from 'react';
import { reminderApi } from '@/utils/api';
import { formatDate } from '@/utils/format';
import type { Reminder } from '@/types';
import { Bell, Plus, Trash2, Check, RefreshCw, Filter } from 'lucide-react';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

const TYPE_LABELS: Record<Reminder['type'], string> = {
  installment: '分期',
  expense: '固定支出',
  debt: '债务',
  savings: '储蓄',
  custom: '自定义',
};

const TYPE_BADGE_CLASS: Record<Reminder['type'], string> = {
  installment: 'badge-blue',
  expense: 'badge-red',
  debt: 'badge bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  savings: 'badge-green',
  custom: 'badge bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

type FilterType = 'all' | 'unread' | Reminder['type'];

function getGroupKey(dueDate: string): 'overdue' | 'today' | 'upcoming' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

const GROUP_LABELS: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: '已逾期',
  today: '今日',
  upcoming: '即将到期',
};

const GROUP_BORDER: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'border-l-red-500',
  today: 'border-l-yellow-500',
  upcoming: 'border-l-blue-500',
};

export default function Alerts() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', type: 'custom' as Reminder['type'], due_date: '' });

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const list = (await reminderApi.list()) as Reminder[];
      setReminders(list || []);
    } catch (err) {
      console.error('Fetch reminders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await reminderApi.generate();
      await fetchReminders();
    } catch (err) {
      console.error('Generate reminders error:', err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await reminderApi.generate();
      await fetchReminders();
    };
    init();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await reminderApi.markRead(id);
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_read: 1 } : r))
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await reminderApi.delete(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete reminder error:', err);
    }
  };

  const handleAdd = async () => {
    if (!addForm.title.trim() || !addForm.due_date) return;
    try {
      await reminderApi.create({
        title: addForm.title.trim(),
        type: addForm.type,
        due_date: addForm.due_date,
        related_id: null,
      });
      setAddForm({ title: '', type: 'custom', due_date: '' });
      setAddModalOpen(false);
      await fetchReminders();
    } catch (err) {
      console.error('Add reminder error:', err);
    }
  };

  const filtered = reminders.filter((r) => {
    if (filterType === 'unread') return r.is_read === 0;
    if (filterType !== 'all') return r.type === filterType;
    return true;
  });

  const grouped = filtered.reduce<Record<'overdue' | 'today' | 'upcoming', Reminder[]>>(
    (acc, r) => {
      const key = getGroupKey(r.due_date);
      acc[key].push(r);
      return acc;
    },
    { overdue: [], today: [], upcoming: [] }
  );

  const unreadCount = reminders.filter((r) => r.is_read === 0).length;

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="page-title">提醒中心</h1>
          {unreadCount > 0 && (
            <span className="badge badge-red flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              {unreadCount} 未读
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            自动生成提醒
          </button>
          <button
            onClick={() => {
              setAddForm({ title: '', type: 'custom', due_date: todayStr });
              setAddModalOpen(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加提醒
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">筛选：</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setFilterType('unread')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'unread'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            仅未读
          </button>
          {(['installment', 'expense', 'debt', 'savings', 'custom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === t
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">加载中...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="暂无提醒"
            description="点击「自动生成提醒」根据分期、固定支出、债务等自动创建提醒，或手动添加自定义提醒。"
            action={{
              label: '添加提醒',
              onClick: () => {
                setAddForm({ title: '', type: 'custom', due_date: todayStr });
                setAddModalOpen(true);
              },
            }}
          />
        ) : (
          <div className="space-y-6">
            {(['overdue', 'today', 'upcoming'] as const).map((key) => {
              const items = grouped[key];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <h3 className={`section-title mb-3 flex items-center gap-2`}>
                    <span
                      className={`w-1 h-5 rounded-full ${
                        key === 'overdue'
                          ? 'bg-red-500'
                          : key === 'today'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                      }`}
                    />
                    {GROUP_LABELS[key]}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({items.length})
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div
                        key={r.id}
                        className={`card flex items-center justify-between gap-4 border-l-4 ${GROUP_BORDER[getGroupKey(r.due_date)]} ${
                          r.is_read ? 'opacity-75' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {r.title}
                            </span>
                            <span className={TYPE_BADGE_CLASS[r.type]}>{TYPE_LABELS[r.type]}</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            到期日：{formatDate(r.due_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.is_read === 0 && (
                            <button
                              onClick={() => handleMarkRead(r.id)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="标记为已读"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="添加自定义提醒"
      >
        <div className="space-y-4">
          <div>
            <label className="label">标题</label>
            <input
              type="text"
              className="input"
              placeholder="例如：缴纳物业费"
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">类型</label>
            <select
              className="input"
              value={addForm.type}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, type: e.target.value as Reminder['type'] }))
              }
            >
              {(['installment', 'expense', 'debt', 'savings', 'custom'] as const).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">到期日期</label>
            <input
              type="date"
              className="input"
              value={addForm.due_date}
              onChange={(e) => setAddForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddModalOpen(false)} className="btn-secondary">
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!addForm.title.trim() || !addForm.due_date}
              className="btn-primary"
            >
              添加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
