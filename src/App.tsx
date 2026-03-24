import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Installments from '@/pages/Installments';
import Expenses from '@/pages/Expenses';
import Income from '@/pages/Income';
import Budget from '@/pages/Budget';
import DebtStrategy from '@/pages/DebtStrategy';
import Savings from '@/pages/Savings';
import Forecast from '@/pages/Forecast';
import Alerts from '@/pages/Alerts';
import { useThemeStore } from '@/stores/themeStore';

export default function App() {
  const dark = useThemeStore((s) => s.dark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/income" element={<Income />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/debt-strategy" element={<DebtStrategy />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/alerts" element={<Alerts />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
