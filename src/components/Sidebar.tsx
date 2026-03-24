import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Receipt, Wallet, PiggyBank,
  TrendingUp, Target, BarChart3, Bell, Moon, Sun,
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/installments', icon: CreditCard, label: '分期管理' },
  { to: '/expenses', icon: Receipt, label: '支出管理' },
  { to: '/income', icon: Wallet, label: '收入管理' },
  { to: '/budget', icon: BarChart3, label: '预算规划' },
  { to: '/debt-strategy', icon: TrendingUp, label: '债务策略' },
  { to: '/savings', icon: PiggyBank, label: '储蓄目标' },
  { to: '/forecast', icon: Target, label: '现金流预测' },
  { to: '/alerts', icon: Bell, label: '提醒中心' },
];

export default function Sidebar() {
  const { dark, toggle } = useThemeStore();

  return (
    <aside className="w-56 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          个人财务管家
        </h1>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-r-3 border-primary-600 dark:border-primary-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? '浅色模式' : '深色模式'}
        </button>
      </div>
    </aside>
  );
}
