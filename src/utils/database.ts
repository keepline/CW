type SqlJsDatabase = any;

let db: SqlJsDatabase;
const DB_KEY = 'finance_db';

async function loadSqlJs(): Promise<any> {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/sql-wasm.js';
  document.head.appendChild(script);
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load sql.js'));
  });
  return (window as any).initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/${file}`,
  });
}

async function loadFromStorage(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open('FinanceApp', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('db');
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('db', 'readonly');
      const store = tx.objectStore('db');
      const get = store.get(DB_KEY);
      get.onsuccess = () => resolve(get.result ?? null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

function saveToStorage() {
  if (!db) return;
  const data = db.export();
  const req = indexedDB.open('FinanceApp', 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore('db');
  };
  req.onsuccess = () => {
    const tx = req.result.transaction('db', 'readwrite');
    tx.objectStore('db').put(data, DB_KEY);
  };
}

export async function initDatabase() {
  const SQL = await loadSqlJs();
  const saved = await loadFromStorage();
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  runMigrations();
  saveToStorage();
}

function runMigrations() {
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    icon TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank','credit_card','cash','investment')),
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    total_periods INTEGER NOT NULL,
    paid_periods INTEGER DEFAULT 0,
    monthly_payment REAL NOT NULL,
    interest_rate REAL DEFAULT 0,
    start_date TEXT NOT NULL,
    payment_day INTEGER NOT NULL DEFAULT 1,
    account_id INTEGER,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('monthly','quarterly','yearly')),
    due_day INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount REAL NOT NULL,
    category_id INTEGER,
    account_id INTEGER,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS income_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('monthly','biweekly','weekly','irregular')),
    pay_day INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly','yearly')),
    year INTEGER NOT NULL,
    month INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    remaining_amount REAL NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    minimum_payment REAL NOT NULL DEFAULT 0,
    due_day INTEGER DEFAULT 1,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    deadline TEXT,
    monthly_contribution REAL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('installment','expense','debt','savings','custom')),
    related_id INTEGER,
    due_date TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  seedDefaultCategories();
}

function seedDefaultCategories() {
  const [row] = queryAll('SELECT COUNT(*) as c FROM categories');
  if (row?.c > 0) return;

  const defaults: [string, string, string, string][] = [
    ['餐饮', 'expense', '🍜', '#ef4444'],
    ['交通', 'expense', '🚗', '#f97316'],
    ['购物', 'expense', '🛒', '#eab308'],
    ['住房', 'expense', '🏠', '#22c55e'],
    ['通讯', 'expense', '📱', '#06b6d4'],
    ['娱乐', 'expense', '🎮', '#8b5cf6'],
    ['医疗', 'expense', '🏥', '#ec4899'],
    ['教育', 'expense', '📚', '#6366f1'],
    ['其他支出', 'expense', '📦', '#64748b'],
    ['工资', 'income', '💰', '#10b981'],
    ['副业', 'income', '💼', '#059669'],
    ['投资收益', 'income', '📈', '#0d9488'],
    ['其他收入', 'income', '🎁', '#14b8a6'],
  ];

  for (const [name, type, icon, color] of defaults) {
    db.run('INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)', [name, type, icon, color]);
  }
  saveToStorage();
}

export function runSql(sql: string, params?: any[]) {
  db.run(sql, params);
  saveToStorage();
}

export function queryAll(sql: string, params?: any[]): Record<string, any>[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const results: Record<string, any>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql: string, params?: any[]): Record<string, any> | null {
  const results = queryAll(sql, params);
  return results[0] ?? null;
}

export function exportDb(): Uint8Array {
  return db.export();
}

export function importDb(data: Uint8Array) {
  const SQL = db.constructor;
  db = new SQL.Database(data);
  saveToStorage();
}
