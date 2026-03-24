import { runSql, queryAll, queryOne } from './database';

export const categoryApi = {
  list: async (type?: string) => {
    if (type) return queryAll('SELECT * FROM categories WHERE type = ? ORDER BY id', [type]);
    return queryAll('SELECT * FROM categories ORDER BY type, id');
  },
  create: async (data: any) => {
    runSql('INSERT INTO categories (name, type, icon, color) VALUES (?,?,?,?)',
      [data.name, data.type, data.icon || '', data.color || '#3b82f6']);
    return queryOne('SELECT * FROM categories ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql('UPDATE categories SET name=?, icon=?, color=? WHERE id=?',
      [data.name, data.icon, data.color, id]);
    return queryOne('SELECT * FROM categories WHERE id=?', [id]);
  },
  delete: async (id: number) => {
    runSql('DELETE FROM categories WHERE id=?', [id]);
  },
};

export const accountApi = {
  list: async () => queryAll('SELECT * FROM accounts ORDER BY id'),
  create: async (data: any) => {
    runSql('INSERT INTO accounts (name, type, balance) VALUES (?,?,?)',
      [data.name, data.type, data.balance || 0]);
    return queryOne('SELECT * FROM accounts ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql('UPDATE accounts SET name=?, type=?, balance=? WHERE id=?',
      [data.name, data.type, data.balance, id]);
    return queryOne('SELECT * FROM accounts WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM accounts WHERE id=?', [id]); },
};

export const installmentApi = {
  list: async () => queryAll('SELECT * FROM installments ORDER BY start_date DESC'),
  create: async (data: any) => {
    runSql(`INSERT INTO installments (name, total_amount, total_periods, paid_periods,
      monthly_payment, interest_rate, start_date, payment_day, account_id, note)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [data.name, data.total_amount, data.total_periods, data.paid_periods || 0,
       data.monthly_payment, data.interest_rate || 0, data.start_date,
       data.payment_day || 1, data.account_id || null, data.note || '']);
    return queryOne('SELECT * FROM installments ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE installments SET name=?, total_amount=?, total_periods=?, paid_periods=?,
      monthly_payment=?, interest_rate=?, start_date=?, payment_day=?, account_id=?, note=? WHERE id=?`,
      [data.name, data.total_amount, data.total_periods, data.paid_periods,
       data.monthly_payment, data.interest_rate, data.start_date,
       data.payment_day, data.account_id, data.note, id]);
    return queryOne('SELECT * FROM installments WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM installments WHERE id=?', [id]); },
  pay: async (id: number) => {
    runSql('UPDATE installments SET paid_periods = paid_periods + 1 WHERE id=? AND paid_periods < total_periods', [id]);
    return queryOne('SELECT * FROM installments WHERE id=?', [id]);
  },
};

export const fixedExpenseApi = {
  list: async () => queryAll(
    `SELECT fe.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM fixed_expenses fe LEFT JOIN categories c ON fe.category_id = c.id ORDER BY fe.id`),
  create: async (data: any) => {
    runSql(`INSERT INTO fixed_expenses (name, amount, category_id, frequency, due_day, is_active, note)
      VALUES (?,?,?,?,?,?,?)`,
      [data.name, data.amount, data.category_id || null, data.frequency || 'monthly',
       data.due_day || 1, data.is_active ?? 1, data.note || '']);
    return queryOne('SELECT * FROM fixed_expenses ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE fixed_expenses SET name=?, amount=?, category_id=?, frequency=?,
      due_day=?, is_active=?, note=? WHERE id=?`,
      [data.name, data.amount, data.category_id, data.frequency,
       data.due_day, data.is_active, data.note, id]);
    return queryOne('SELECT * FROM fixed_expenses WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM fixed_expenses WHERE id=?', [id]); },
};

export const transactionApi = {
  list: async (filters?: any) => {
    let sql = `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id`;
    const params: any[] = [];
    const where: string[] = [];

    if (filters?.type) { where.push('t.type = ?'); params.push(filters.type); }
    if (filters?.startDate) { where.push('t.date >= ?'); params.push(filters.startDate); }
    if (filters?.endDate) { where.push('t.date <= ?'); params.push(filters.endDate); }
    if (filters?.categoryId) { where.push('t.category_id = ?'); params.push(filters.categoryId); }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY t.date DESC, t.id DESC';
    if (filters?.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }

    return queryAll(sql, params);
  },
  create: async (data: any) => {
    runSql(`INSERT INTO transactions (type, amount, category_id, account_id, date, note)
      VALUES (?,?,?,?,?,?)`,
      [data.type, data.amount, data.category_id || null, data.account_id || null,
       data.date, data.note || '']);
    return queryOne('SELECT * FROM transactions ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE transactions SET type=?, amount=?, category_id=?, account_id=?,
      date=?, note=? WHERE id=?`,
      [data.type, data.amount, data.category_id, data.account_id, data.date, data.note, id]);
    return queryOne('SELECT * FROM transactions WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM transactions WHERE id=?', [id]); },
  summary: async (year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const income = queryOne(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date >= ? AND date < ?`,
      [startDate, endDate]
    );
    const expense = queryOne(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date >= ? AND date < ?`,
      [startDate, endDate]
    );
    const byCategory = queryAll(
      `SELECT c.name, c.icon, c.color, t.type, SUM(t.amount) as total
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date < ?
       GROUP BY t.category_id, t.type ORDER BY total DESC`,
      [startDate, endDate]
    );
    return { income: income?.total ?? 0, expense: expense?.total ?? 0, byCategory };
  },
};

export const incomeSourceApi = {
  list: async () => queryAll('SELECT * FROM income_sources ORDER BY id'),
  create: async (data: any) => {
    runSql(`INSERT INTO income_sources (name, amount, frequency, pay_day, is_active, note)
      VALUES (?,?,?,?,?,?)`,
      [data.name, data.amount, data.frequency || 'monthly',
       data.pay_day || 1, data.is_active ?? 1, data.note || '']);
    return queryOne('SELECT * FROM income_sources ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE income_sources SET name=?, amount=?, frequency=?, pay_day=?, is_active=?, note=? WHERE id=?`,
      [data.name, data.amount, data.frequency, data.pay_day, data.is_active, data.note, id]);
    return queryOne('SELECT * FROM income_sources WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM income_sources WHERE id=?', [id]); },
};

export const budgetApi = {
  list: async (year: number, month?: number) => {
    if (month) {
      return queryAll(
        `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
         FROM budgets b LEFT JOIN categories c ON b.category_id = c.id
         WHERE b.year = ? AND (b.month = ? OR b.month IS NULL) ORDER BY b.id`,
        [year, month]
      );
    }
    return queryAll(
      `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.year = ? ORDER BY b.id`,
      [year]
    );
  },
  create: async (data: any) => {
    runSql('INSERT INTO budgets (category_id, amount, period, year, month) VALUES (?,?,?,?,?)',
      [data.category_id, data.amount, data.period || 'monthly', data.year, data.month || null]);
    return queryOne('SELECT * FROM budgets ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql('UPDATE budgets SET category_id=?, amount=?, period=?, year=?, month=? WHERE id=?',
      [data.category_id, data.amount, data.period, data.year, data.month, id]);
    return queryOne('SELECT * FROM budgets WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM budgets WHERE id=?', [id]); },
};

export const debtApi = {
  list: async () => queryAll('SELECT * FROM debts ORDER BY interest_rate DESC'),
  create: async (data: any) => {
    runSql(`INSERT INTO debts (name, total_amount, remaining_amount, interest_rate,
      minimum_payment, due_day, note) VALUES (?,?,?,?,?,?,?)`,
      [data.name, data.total_amount, data.remaining_amount, data.interest_rate,
       data.minimum_payment, data.due_day || 1, data.note || '']);
    return queryOne('SELECT * FROM debts ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE debts SET name=?, total_amount=?, remaining_amount=?, interest_rate=?,
      minimum_payment=?, due_day=?, note=? WHERE id=?`,
      [data.name, data.total_amount, data.remaining_amount, data.interest_rate,
       data.minimum_payment, data.due_day, data.note, id]);
    return queryOne('SELECT * FROM debts WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM debts WHERE id=?', [id]); },
};

export const savingsApi = {
  list: async () => queryAll('SELECT * FROM savings_goals ORDER BY id'),
  create: async (data: any) => {
    runSql(`INSERT INTO savings_goals (name, target_amount, current_amount, deadline,
      monthly_contribution, note) VALUES (?,?,?,?,?,?)`,
      [data.name, data.target_amount, data.current_amount || 0, data.deadline || null,
       data.monthly_contribution || 0, data.note || '']);
    return queryOne('SELECT * FROM savings_goals ORDER BY id DESC LIMIT 1');
  },
  update: async (id: number, data: any) => {
    runSql(`UPDATE savings_goals SET name=?, target_amount=?, current_amount=?,
      deadline=?, monthly_contribution=?, note=? WHERE id=?`,
      [data.name, data.target_amount, data.current_amount, data.deadline,
       data.monthly_contribution, data.note, id]);
    return queryOne('SELECT * FROM savings_goals WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM savings_goals WHERE id=?', [id]); },
  contribute: async (id: number, amount: number) => {
    runSql('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id=?', [amount, id]);
    return queryOne('SELECT * FROM savings_goals WHERE id=?', [id]);
  },
};

export const reminderApi = {
  list: async (unreadOnly?: boolean) => {
    if (unreadOnly) return queryAll('SELECT * FROM reminders WHERE is_read = 0 ORDER BY due_date ASC');
    return queryAll('SELECT * FROM reminders ORDER BY due_date ASC');
  },
  create: async (data: any) => {
    runSql('INSERT INTO reminders (title, type, related_id, due_date) VALUES (?,?,?,?)',
      [data.title, data.type, data.related_id || null, data.due_date]);
    return queryOne('SELECT * FROM reminders ORDER BY id DESC LIMIT 1');
  },
  markRead: async (id: number) => {
    runSql('UPDATE reminders SET is_read = 1 WHERE id=?', [id]);
  },
  delete: async (id: number) => { runSql('DELETE FROM reminders WHERE id=?', [id]); },
  generate: async () => {
    const now = new Date();
    const installments = queryAll('SELECT * FROM installments WHERE paid_periods < total_periods') as any[];
    for (const inst of installments) {
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(inst.payment_day).padStart(2, '0')}`;
      const existing = queryOne(
        `SELECT id FROM reminders WHERE type='installment' AND related_id=? AND due_date=?`,
        [inst.id, dueDate]
      );
      if (!existing) {
        runSql('INSERT INTO reminders (title, type, related_id, due_date) VALUES (?,?,?,?)',
          [`${inst.name} - 第${inst.paid_periods + 1}期还款 ¥${inst.monthly_payment}`, 'installment', inst.id, dueDate]);
      }
    }
    const debts = queryAll('SELECT * FROM debts WHERE remaining_amount > 0') as any[];
    for (const debt of debts) {
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(debt.due_day).padStart(2, '0')}`;
      const existing = queryOne(
        `SELECT id FROM reminders WHERE type='debt' AND related_id=? AND due_date=?`,
        [debt.id, dueDate]
      );
      if (!existing) {
        runSql('INSERT INTO reminders (title, type, related_id, due_date) VALUES (?,?,?,?)',
          [`${debt.name} - 最低还款 ¥${debt.minimum_payment}`, 'debt', debt.id, dueDate]);
      }
    }
    return queryAll('SELECT * FROM reminders WHERE is_read = 0 ORDER BY due_date ASC');
  },
};

export const dashboardApi = {
  stats: async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const income = queryOne(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date >= ? AND date < ?`,
      [startDate, endDate]
    );
    const dailyExpense = queryOne(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date >= ? AND date < ?`,
      [startDate, endDate]
    );

    const fixedExpenses = queryAll('SELECT * FROM fixed_expenses WHERE is_active = 1');
    let fixedMonthlyTotal = 0;
    for (const fe of fixedExpenses) {
      if (fe.frequency === 'monthly') fixedMonthlyTotal += fe.amount;
      else if (fe.frequency === 'quarterly') fixedMonthlyTotal += fe.amount / 3;
      else if (fe.frequency === 'yearly') fixedMonthlyTotal += fe.amount / 12;
    }

    const installments = queryAll('SELECT * FROM installments WHERE paid_periods < total_periods');
    const debts = queryAll('SELECT * FROM debts WHERE remaining_amount > 0');
    const savings = queryAll('SELECT * FROM savings_goals');

    const totalInstallmentMonthly = installments.reduce((s: number, i: any) => s + i.monthly_payment, 0);
    const totalDebtRemaining = debts.reduce((s: number, d: any) => s + d.remaining_amount, 0);
    const totalSavings = savings.reduce((s: number, g: any) => s + g.current_amount, 0);

    return {
      monthlyIncome: income?.total ?? 0,
      monthlyExpense: (dailyExpense?.total ?? 0) + fixedMonthlyTotal,
      totalInstallmentMonthly,
      totalDebtRemaining,
      totalSavings,
      installmentCount: installments.length,
      activeInstallments: installments,
      debts,
      savings,
      reminders: queryAll('SELECT * FROM reminders WHERE is_read = 0 ORDER BY due_date ASC LIMIT 10'),
    };
  },
};
