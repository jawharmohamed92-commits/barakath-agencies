import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { Moon, Sun, LayoutDashboard, ShoppingCart, Package, Archive, Users, LogOut, Trash2, BarChart3, Wallet, Calculator, X, GripVertical, Bell, Settings as SettingsIcon } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { db, Reminder } from '../lib/db';

interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  resetDisplay: boolean;
  memory: number;
  grandTotal: number;
  lastResult: number | null;
}

function DraggableCalculator({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [calc, setCalc] = useState<CalculatorState>({
    display: '0',
    previousValue: null,
    operation: null,
    resetDisplay: false,
    memory: 0,
    grandTotal: 0,
    lastResult: null,
  });

  const TAX_RATE = 18; // Default 18% GST

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (calc.resetDisplay) {
      setCalc({ ...calc, display: digit, resetDisplay: false });
    } else {
      setCalc({ 
        ...calc, 
        display: calc.display === '0' && digit !== '.' ? digit : calc.display + digit 
      });
    }
  };

  const handleOperation = (op: string) => {
    const current = parseFloat(calc.display);
    if (calc.previousValue === null) {
      setCalc({ ...calc, previousValue: current, operation: op, resetDisplay: true });
    } else if (calc.operation) {
      const result = calculate(calc.previousValue, current, calc.operation);
      setCalc({ ...calc, display: result.toString(), previousValue: result, operation: op, resetDisplay: true });
    }
  };

  const calculate = (a: number, b: number, op: string) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (calc.previousValue !== null && calc.operation) {
      const result = calculate(calc.previousValue, parseFloat(calc.display), calc.operation);
      setCalc({ 
        ...calc, 
        display: result.toString(), 
        previousValue: null, 
        operation: null, 
        resetDisplay: true,
        grandTotal: calc.grandTotal + result,
        lastResult: result
      });
    }
  };

  const handleAC = () => {
    setCalc({ 
      display: '0', 
      previousValue: null, 
      operation: null, 
      resetDisplay: false, 
      memory: calc.memory, 
      grandTotal: 0,
      lastResult: null 
    });
  };

  const handleC = () => {
    setCalc({ ...calc, display: '0', resetDisplay: false });
  };

  const handleTaxPlus = () => {
    const current = parseFloat(calc.display);
    const result = current * (1 + TAX_RATE / 100);
    setCalc({ ...calc, display: result.toFixed(2), resetDisplay: true });
  };

  const handleTaxMinus = () => {
    const current = parseFloat(calc.display);
    const result = current / (1 + TAX_RATE / 100);
    setCalc({ ...calc, display: result.toFixed(2), resetDisplay: true });
  };

  const handlePercent = () => {
    const current = parseFloat(calc.display);
    if (calc.previousValue !== null && calc.operation) {
      const val = (calc.previousValue * current) / 100;
      setCalc({ ...calc, display: val.toString(), resetDisplay: true });
    } else {
      setCalc({ ...calc, display: (current / 100).toString(), resetDisplay: true });
    }
  };

  const handleSquareRoot = () => {
    const current = parseFloat(calc.display);
    setCalc({ ...calc, display: Math.sqrt(current).toString(), resetDisplay: true });
  };

  const handleMU = () => {
    // Mark Up Logic: Cost / (1 - Margin%)
    // If display has margin, and previous has cost
    if (calc.previousValue !== null && calc.operation === '/') {
      const margin = parseFloat(calc.display);
      const result = calc.previousValue / (1 - margin / 100);
      setCalc({ ...calc, display: result.toFixed(2), previousValue: null, operation: null, resetDisplay: true });
    }
  };

  const handleGrandTotal = () => {
    setCalc({ ...calc, display: calc.grandTotal.toString(), resetDisplay: true });
  };

  const handleCorrect = () => {
    if (calc.display.length > 1) {
      setCalc({ ...calc, display: calc.display.slice(0, -1) });
    } else {
      setCalc({ ...calc, display: '0' });
    }
  };

  const handleMemoryAdd = () => {
    setCalc({ ...calc, memory: calc.memory + parseFloat(calc.display), resetDisplay: true });
  };

  const handleMemorySub = () => {
    setCalc({ ...calc, memory: calc.memory - parseFloat(calc.display), resetDisplay: true });
  };

  const handleMRC = () => {
    setCalc({ ...calc, display: calc.memory.toString(), resetDisplay: true });
  };

  return (
    <div
      style={{ left: position.x, top: position.y }}
      className="fixed z-[100] w-[320px] bg-[#2d2d2d] rounded-2xl shadow-3xl border-4 border-[#1a1a1a] overflow-hidden select-none animate-in fade-in zoom-in duration-200"
    >
      <div
        onMouseDown={handleMouseDown}
        className="bg-[#1a1a1a] px-4 py-2 flex justify-between items-center cursor-move border-b border-gray-800"
      >
        <div className="flex items-center gap-2 text-gray-400">
          <GripVertical size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#2a9df4]">Commercial Calculator</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 bg-[#e0e0e0] space-y-4">
        {/* Display Panel */}
        <div className="bg-[#a8b8a8] p-4 rounded shadow-inner border-2 border-[#808080] relative overflow-hidden">
          <div className="absolute top-1 left-2 flex gap-2 text-[8px] font-bold text-gray-700/60 uppercase">
            {calc.memory !== 0 && <span>M</span>}
            {calc.operation && <span>{calc.operation}</span>}
            {calc.grandTotal !== 0 && <span>GT</span>}
          </div>
          <div className="text-right h-12 flex flex-col justify-end">
            <div className="text-xs text-gray-700 font-mono leading-none mb-1 h-3">
              {calc.previousValue !== null ? `${calc.previousValue} ${calc.operation || ''}` : ''}
            </div>
            <div className="text-3xl font-mono font-bold text-gray-900 tracking-tighter leading-none truncate">
              {calc.display}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {/* Top special row */}
          <button onClick={handleTaxPlus} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">TAX+</button>
          <button onClick={handleTaxMinus} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">TAX-</button>
          <button onClick={handleMRC} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">MRC</button>
          <button onClick={handleMemorySub} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">M-</button>
          <button onClick={handleMemoryAdd} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">M+</button>

          {/* Row 2 */}
          <button onClick={handleGrandTotal} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">GT</button>
          <button onClick={handlePercent} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">%</button>
          <button onClick={handleSquareRoot} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">√</button>
          <button onClick={handleMU} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95">MU</button>
          <button onClick={handleCorrect} className="h-10 bg-[#cfcfcf] hover:bg-gray-300 rounded text-[10px] font-bold text-gray-800 shadow transition-all active:scale-95 flex items-center justify-center">▶</button>

          {/* Row 3 - Start of main Numpad */}
          <button onClick={() => handleDigit('7')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">7</button>
          <button onClick={() => handleDigit('8')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">8</button>
          <button onClick={() => handleDigit('9')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">9</button>
          <button onClick={handleC} className="h-12 bg-[#e91e63] hover:bg-pink-600 rounded text-lg font-bold text-white shadow transition-all active:scale-95">C</button>
          <button onClick={handleAC} className="h-12 bg-[#f44336] hover:bg-red-600 rounded text-lg font-bold text-white shadow transition-all active:scale-95">AC</button>

          {/* Row 4 */}
          <button onClick={() => handleDigit('4')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">4</button>
          <button onClick={() => handleDigit('5')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">5</button>
          <button onClick={() => handleDigit('6')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">6</button>
          <button onClick={() => handleOperation('*')} className="h-12 bg-[#cfcfcf] hover:bg-gray-300 rounded text-xl font-bold text-gray-800 shadow transition-all active:scale-95">×</button>
          <button onClick={() => handleOperation('/')} className="h-12 bg-[#cfcfcf] hover:bg-gray-300 rounded text-xl font-bold text-gray-800 shadow transition-all active:scale-95">÷</button>

          {/* Row 5 */}
          <button onClick={() => handleDigit('1')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">1</button>
          <button onClick={() => handleDigit('2')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">2</button>
          <button onClick={() => handleDigit('3')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">3</button>
          <button onClick={() => handleOperation('+')} className="h-12 bg-[#cfcfcf] hover:bg-gray-300 rounded text-xl font-bold text-gray-800 shadow transition-all active:scale-95">+</button>
          <button onClick={() => handleOperation('-')} className="h-12 bg-[#cfcfcf] hover:bg-gray-300 rounded text-xl font-bold text-gray-800 shadow transition-all active:scale-95">-</button>

          {/* Row 6 */}
          <button onClick={() => handleDigit('0')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">0</button>
          <button onClick={() => handleDigit('00')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">00</button>
          <button onClick={() => handleDigit('.')} className="h-12 bg-[#4a4a4a] hover:bg-gray-600 rounded text-xl font-bold text-white shadow transition-all active:scale-95">.</button>
          <button onClick={handleEquals} className="h-12 bg-[#2196f3] hover:bg-blue-600 rounded text-2xl font-bold text-white shadow transition-all active:scale-95 col-span-2">=</button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const location = useLocation();
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);
  const [hasTodayReminders, setHasTodayReminders] = useState(false);

  const routeLabels: Record<string, string> = {
    '/': 'Dashboard',
    '/sales': 'Sales',
    '/products': 'Products',
    '/inventory': 'Purchases',
    '/expenses': 'Expenses',
    '/customers': 'Customers',
    '/reports': 'Reports',
    '/settings': 'Settings',
    '/recycle-bin': 'Recycle Bin',
    '/reminders': 'Reminders'
  };

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const reminders = await db.getReminders();
        const todayStr = new Date().toISOString().split('T')[0];
        const activeToday = reminders.filter(r => 
          !r.isCompleted && 
          r.dateTime.split('T')[0] === todayStr
        );
        setHasTodayReminders(activeToday.length > 0);
        setRemindersCount(reminders.filter(r => !r.isCompleted).length);
      } catch (err) {
        console.error('Failed to check reminders:', err);
      }
    };
    checkReminders();
    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Sales', path: '/sales', icon: ShoppingCart },
    { name: 'Product', path: '/products', icon: Package },
    { name: 'Purchases', path: '/inventory', icon: Wallet },
    { name: 'Expense', path: '/expenses', icon: Archive },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Recycle Bin', path: '/recycle-bin', icon: Trash2 },
  ];

  if (user?.role === 'owner') {
    navItems.push({ name: 'Settings', path: '/settings', icon: SettingsIcon });
  }

  return (
    <div className="min-h-screen bg-[#f0f6ff] dark:bg-gray-950 transition-colors duration-300 font-sans">
      <DraggableCalculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
      
      {/* Top Header */}
      <header className="bg-[#2a9df4] dark:bg-gray-900 text-white shadow-md transition-colors duration-300 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-5">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center gap-6">
              <h1 className="text-2xl font-bold tracking-tight">{settings.shopName || 'BARAKATH AGENCIES'}</h1>
              <div className="w-px h-5 bg-white/30" />
              <span className="text-sm text-blue-100 font-medium">{routeLabels[location.pathname] || ''}</span>
              <NavLink 
                to="/reminders" 
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200",
                  hasTodayReminders 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-white/10 hover:bg-white/20 text-white"
                )}
              >
                <Bell size={18} />
                <span className="text-sm font-bold">Reminders</span>
                {remindersCount > 0 && (
                  <span className="bg-white text-[#2a9df4] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {remindersCount}
                  </span>
                )}
              </NavLink>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsCalcOpen(!isCalcOpen)}
                  className="p-2 rounded-full hover:bg-white/20 transition-all duration-200 active:scale-95 flex items-center gap-2"
                  title="Calculator"
                >
                  <Calculator size={20} />
                </button>
                {user && (
                  <span className="text-sm font-medium hidden sm:block text-blue-50 dark:text-gray-300">
                    Welcome, {user.username}
                  </span>
                )}
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                aria-label="Toggle Dark Mode"
              >
                {isDark ? <Sun size={20} className="text-yellow-300" /> : <Moon size={20} />}
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-full hover:bg-white/20 transition-colors flex items-center"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-[1400px] mx-auto w-full px-5 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="md:w-64 flex-shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500 pl-3 shadow-sm transition-all duration-300"
                      : "bg-white/50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
                  )
                }
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Page Content */}
        <main className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
