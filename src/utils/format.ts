export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getFrequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    monthly: '每月',
    quarterly: '每季度',
    yearly: '每年',
    biweekly: '每两周',
    weekly: '每周',
    irregular: '不定期',
  };
  return map[freq] || freq;
}

export function getAccountTypeLabel(type: string): string {
  const map: Record<string, string> = {
    bank: '银行卡',
    credit_card: '信用卡',
    cash: '现金',
    investment: '投资账户',
  };
  return map[type] || type;
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthDiff(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
