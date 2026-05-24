import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { db, Sale, Purchase, Expense, Customer, Product, Inventory } from '../lib/db';
import { 
  BarChart3, 
  FileText, 
  Users, 
  Package, 
  ChevronLeft, 
  Printer, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Circle,
  Edit2,
  RefreshCw,
  Clock,
  X,
  Eye
} from 'lucide-react';
import { cn, formatDate, getUnitAbbreviation } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import UnpaidBalanceSheetModal from '../components/UnpaidBalanceSheetModal';
import SettlementModal from '../components/SettlementModal';

const getDueDays = (dateStr: string) => {
  const itemDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  itemDate.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} Days`;
};

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const view = searchParams.get('view');

  useEffect(() => {
    if (location.state?.reportView && !view) {
      setSearchParams({ view: location.state.reportView });
    }
  }, [location.state, view, setSearchParams]);

  if (!view) {
    return <ReportsLanding onSelect={(v) => setSearchParams({ view: v })} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSearchParams({})}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
            <h2 className="text-[12px] font-bold font-serif text-[#2a9df4] dark:text-blue-400 uppercase tracking-tight">
            {view === 'transactions' && 'Transaction Reports'}
            {view === 'parties' && 'Party Reports'}
            {view === 'items' && 'Item/Stock Reports'}
          </h2>
        </div>
      </div>

      {view === 'transactions' && <TransactionReports />}
      {view === 'parties' && <PartyReports />}
      {view === 'items' && <ItemStockReports />}
    </div>
  );
}

function ReportsLanding({ onSelect }: { onSelect: (view: string) => void }) {
  const cards = [
    { 
      id: 'transactions', 
      title: 'Transaction Reports', 
      desc: 'Sales, Purchases, Expenses & P&L', 
      icon: FileText,
      color: 'bg-blue-500'
    },
    { 
      id: 'parties', 
      title: 'Party Reports', 
      desc: 'Customer/Suppliers Statements & Balance Sheet', 
      icon: Users,
      color: 'bg-purple-500'
    },
    { 
      id: 'items', 
      title: 'Item/Stock Reports', 
      desc: 'Stock Valuation, Profitability & Performance', 
      icon: Package,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Business Reports</h2>
        <p className="text-gray-500 dark:text-gray-400">Select a report category to view detailed analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-transparent dark:border-transparent hover:border-[#CFB53B] hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-all duration-300 group"
            >
              <div className={cn("p-4 rounded-xl text-white mb-6 group-hover:scale-110 transition-transform", card.color)}>
                <Icon size={32} />
              </div>
              <h3 className="text-[12px] font-bold font-serif text-gray-900 dark:text-white mb-2 uppercase tracking-tight">{card.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Transaction Reports ---
function TransactionReports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  
  // Set default dates to current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [type, setType] = useState<'all' | 'sales' | 'purchases' | 'expenses' | 'pl'>(
    location.state?.reportType || 'all'
  );
  const [startDate, setStartDate] = useState(
    location.state?.reportType === 'pl' ? firstDayOfMonth : todayStr
  );
  const [endDate, setEndDate] = useState(
    location.state?.reportType === 'pl' ? todayStr : todayStr
  );
  const [data, setData] = useState<any[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [type, startDate, endDate]);

  const loadData = async () => {
    const [salesData, purchasesData, expensesData, productsData] = await Promise.all([
      db.getSales(),
      db.getPurchases(),
      db.getExpenses(),
      db.getProducts()
    ]);

    const sales = salesData.filter(s => !s.isDeleted && s.type !== 'estimate');
    const purchases = purchasesData.filter(p => !p.isDeleted);
    const expenses = expensesData.filter(e => !e.isDeleted);

    if (type === 'pl') {
      // Calculate P&L based on the formula: Net Profit = (Total Sales - Total Purchase Cost) - Total Expenses
      
      let totalPurchaseCost = 0;
      let totalSalesRevenue = 0;
      let totalOpExpenses = 0;

      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      // Total Sales
      const periodSales = sales.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
      totalSalesRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);

      // Total Purchase Cost (Sum of all individual product costs in period or sum of all bills)
      // Usually "Total Purchase Cost" in this context refers to the sum of Purchase bills in that period
      const periodPurchases = purchases.filter(p => {
        const d = new Date((p as any).date || (p as any).billDate);
        return d >= start && d <= end;
      });
      totalPurchaseCost = periodPurchases.reduce((sum, p) => sum + p.total, 0);

      // Total Expenses
      const periodExpenses = expenses.filter(e => {
        const d = new Date(e.date || e.createdAt);
        return d >= start && d <= end;
      });
      totalOpExpenses = periodExpenses.reduce((sum, e) => sum + e.total, 0);

      const netProfit = totalSalesRevenue - totalPurchaseCost - totalOpExpenses;

      setData([{ totalSalesRevenue, totalPurchaseCost, totalOpExpenses, netProfit, isPL: true }]);
      return;
    }

    let combined: any[] = [];

    if (type === 'all' || type === 'sales') {
      combined = [...combined, ...sales.map(s => ({ ...s, entryType: 'Sale' }))];
    }
    if (type === 'all' || type === 'purchases') {
      combined = [...combined, ...purchases.map(p => ({ ...p, entryType: 'Purchase' }))];
    }
    if (type === 'all' || type === 'expenses') {
      combined = [...combined, ...expenses.map(e => ({ ...e, entryType: 'Expense' }))];
    }

    // Filter by date
    if (startDate) {
      combined = combined.filter(item => {
        const dateStr = item.date || item.billDate || item.createdAt;
        return new Date(dateStr) >= new Date(startDate);
      });
    }
    if (endDate) {
      combined = combined.filter(item => {
        const dateStr = item.date || item.billDate || item.createdAt;
        const d = new Date(dateStr);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return d <= end;
      });
    }

    setData(combined.sort((a, b) => {
      const dateA = new Date(a.date || a.billDate || a.createdAt);
      const dateB = new Date(b.date || b.billDate || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    }));
  };

  const printReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header - Centered & Bold
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const shopAddr = 'Trichy';
    doc.text(shopAddr, pageWidth / 2, 21, { align: 'center' });
    doc.text(`Contact: ${settings.shopPhone || ''}`, pageWidth / 2, 26, { align: 'center' });

    // Separator line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 31, pageWidth - margin, 31);

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(`${type.toUpperCase()} REPORT`, margin, 42);
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, margin, 49);
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - margin, 42, { align: 'right' });
    
    if (type === 'pl') {
      const pl = data[0];
      autoTable(doc, {
        startY: 60,
        head: [['Metric', 'Amount (Rs.)']],
        body: [
          ['Total Sales Revenue', `Rs. ${pl.totalSalesRevenue.toFixed(2)}`],
          ['Cost of Goods Sold (COGS)', `Rs. ${pl.totalCogs.toFixed(2)}`],
          ['Gross Profit', `Rs. ${pl.grossProfit.toFixed(2)}`],
          ['Operating Expenses', `Rs. ${pl.totalOpExpenses.toFixed(2)}`],
          ['Net Profit', `Rs. ${pl.netProfit.toFixed(2)}`]
        ],
        theme: 'grid',
        headStyles: { 
          fillColor: [245, 245, 245], 
          textColor: [0, 0, 0], 
          lineWidth: 0.1, 
          lineColor: [0, 0, 0] 
        },
        bodyStyles: { 
          textColor: [0, 0, 0], 
          lineWidth: 0.1, 
          lineColor: [200, 200, 200] 
        },
        styles: { font: 'times' }
      });
    } else {
      const tableData = data.map(item => {
        let refNo = item.billNumber || item.expenseNo || item.id;
        if (refNo && refNo.length > 20 && !refNo.includes(' ')) {
          refNo = refNo.substring(0, 8);
        }
        
        return [
          formatDate(item.date || item.billDate || item.createdAt),
          refNo,
          item.customerName || item.vendorName || item.category,
          item.entryType,
          `Rs. ${item.total.toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: 60,
        head: [['Date', 'Bill No', 'Party/Cat', 'Type', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [245, 245, 245], 
          textColor: [0, 0, 0], 
          lineWidth: 0.1, 
          lineColor: [0, 0, 0] 
        },
        bodyStyles: { 
          textColor: [0, 0, 0], 
          lineWidth: 0.1, 
          lineColor: [200, 200, 200] 
        },
        styles: { font: 'times', fontSize: 10 },
        columnStyles: {
          4: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });
    }

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    doc.save(`${type.toUpperCase()}_Report_${dateStr}.pdf`);
  };

  if (selectedTransaction) {
    const isSale = selectedTransaction.entryType === 'Sale';
    const isPurchase = selectedTransaction.entryType === 'Purchase';
    const isExpense = selectedTransaction.entryType === 'Expense';

    const headerColor = isSale ? 'bg-[#9ff270]' : isPurchase ? 'bg-[#f59e0b]' : 'bg-[#ef4444]';
    const billNo = selectedTransaction.billNumber || selectedTransaction.expenseNo || selectedTransaction.id.substring(0, 8);
    const partyLabel = isSale ? 'Customer' : isPurchase ? 'Supplier' : 'Category';
    const partyName = selectedTransaction.customerName || selectedTransaction.vendorName || selectedTransaction.category;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedTransaction(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
            Transaction Detail - <span className="text-blue-600">{billNo}</span>
          </h2>
        </div>

        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 border-[0.5px] border-gray-200 dark:border-gray-700 p-6 rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bill Number</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{billNo}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(selectedTransaction.date || selectedTransaction.billDate || selectedTransaction.createdAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{partyLabel}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{partyName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              selectedTransaction.status === 'paid' ? "bg-green-600 text-white" :
              selectedTransaction.status === 'unpaid' || selectedTransaction.status === 'pending' ? "bg-red-600 text-white" :
              "bg-orange-500 text-white"
            )}>
              {selectedTransaction.status || 'Paid'}
            </span>
          </div>
        </div>

        {/* Itemized Grid (Excel Style) */}
        <div className="bg-white dark:bg-gray-800 border-[0.5px] border-gray-200 dark:border-gray-700 overflow-hidden rounded-xl shadow-sm">
          <table className="w-full border-collapse">
            <thead className={cn("border-b-[0.5px] border-gray-400", headerColor)}>
              <tr className="text-[12px] font-bold font-serif text-black uppercase tracking-tight">
                <th className="px-3 py-2 text-left border-[0.5px] border-gray-400 whitespace-nowrap">DESCRIPTION</th>
                {!isExpense && <th className="px-3 py-2 text-right border-[0.5px] border-gray-400 w-32 whitespace-nowrap">QTY</th>}
                {!isExpense && <th className="px-3 py-2 text-center border-[0.5px] border-gray-400 w-32 whitespace-nowrap">UNIT</th>}
                <th className="px-3 py-2 text-right border-[0.5px] border-gray-400 w-40 whitespace-nowrap">PRICE</th>
                <th className="px-3 py-2 text-right border-[0.5px] border-gray-400 w-40 whitespace-nowrap">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(selectedTransaction.items || []).map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 h-[40px]">
                  <td className="px-3 py-2 text-[12px] text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800 font-bold">
                    {item.name || item.productName || item.description || 'N/A'}
                  </td>
                  {!isExpense && (
                    <td className="px-3 py-2 text-[12px] text-right text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                      {item.quantity}
                    </td>
                  )}
                  {!isExpense && (
                    <td className="px-3 py-2 text-[12px] text-center text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                      {item.unit || '-'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-[12px] text-right text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800 font-mono">
                    ₹{(item.price || item.unitPrice || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right text-black dark:text-white font-bold border-[0.5px] border-gray-100 dark:border-gray-800 font-mono">
                    ₹{(item.total || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex justify-end pt-4">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-[12px] text-gray-500 px-2 font-bold uppercase">
              <span>Subtotal</span>
              <span>₹{(selectedTransaction.subtotal || (selectedTransaction.total - (selectedTransaction.taxAmount || 0))).toLocaleString()}</span>
            </div>
            {(selectedTransaction.taxAmount || 0) > 0 && (
              <div className="flex justify-between text-[12px] text-gray-500 px-2 font-bold uppercase">
                <span>Tax/GST</span>
                <span>₹{selectedTransaction.taxAmount.toLocaleString()}</span>
              </div>
            )}
            {(selectedTransaction.roundOff || 0) !== 0 && (
              <div className="flex justify-between text-[12px] text-gray-500 px-2 font-bold uppercase">
                <span>Round Off</span>
                <span>₹{selectedTransaction.roundOff?.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between p-4 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl mt-4 shadow-inner">
              <span className="text-[12px] font-bold text-gray-900 dark:text-white uppercase tracking-widest self-center">Grand Total</span>
              <span className="text-xl font-bold text-black dark:text-white">₹{selectedTransaction.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'pl' && data.length > 0 && data[0].isPL) {
    const pl = data[0];

    return (
      <div className="space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            </div>
          </div>
          <div className="flex gap-3">
            <select value={type} onChange={e => setType(e.target.value as any)} className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 outline-none">
              <option value="all">All Transactions</option>
              <option value="sales">Sales Reports</option>
              <option value="purchases">Purchase Reports</option>
              <option value="expenses">Expense Reports</option>
              <option value="pl">Profit & Loss</option>
            </select>
            <button onClick={printReport} className="p-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2">
              <Printer size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border-[0.5px] border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#CFB53B] border-b-[0.5px] border-gray-400">
              <tr>
                <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">METRIC DESCRIPTION</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">AMOUNT (RS.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="bg-white dark:bg-gray-800 hover:bg-blue-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-700 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">Total Sales Revenue</td>
                <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-green-600 text-right border-[0.5px] border-gray-100 dark:border-gray-800">{pl.totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-[#f9f9f9] dark:bg-gray-900/50 hover:bg-blue-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-700 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">Total Purchase Cost</td>
                <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-amber-600 text-right border-[0.5px] border-gray-100 dark:border-gray-800">{pl.totalPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-white dark:bg-gray-800 hover:bg-blue-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-700 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">Total Operating Expenses</td>
                <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-red-600 text-right border-[0.5px] border-gray-100 dark:border-gray-800">{pl.totalOpExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className={cn(
                "hover:bg-blue-50/50 transition-colors",
                pl.netProfit >= 0 ? "bg-green-50/50 dark:bg-green-900/20" : "bg-red-50/50 dark:bg-red-900/20"
              )}>
                <td className="px-6 py-6 whitespace-nowrap text-[14px] font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800 uppercase tracking-widest">
                  {pl.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
                </td>
                <td className={cn(
                  "px-6 py-6 whitespace-nowrap text-[18px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800",
                  pl.netProfit >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  Rs. {Math.abs(pl.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-200 dark:border-gray-700">
            (Net P&L = Sales Revenue - Purchase Cost - Operating Expenses)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select value={type} onChange={e => setType(e.target.value as any)} className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="all">All Transactions</option>
            <option value="sales">Sales Reports</option>
            <option value="purchases">Purchase Reports</option>
            <option value="expenses">Expense Reports</option>
            <option value="pl">Profit & Loss</option>
          </select>
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Printer size={18} /> Print
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-[#CFB53B] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap">DATE</th>
                <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32 whitespace-nowrap">TYPE</th>
                <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap">BILL NO</th>
                <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">PARTY NAME</th>
                <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-48 whitespace-nowrap">TOTAL AMOUNT</th>
                <th className="px-3 py-2 text-center text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32 whitespace-nowrap">STATUS</th>
                <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap">ACTIONS</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map((item, idx) => (
              <tr key={idx} className={cn(
                "hover:bg-blue-50/50 transition-colors",
                idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50"
              )}>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                  {formatDate(item.date || item.billDate || item.createdAt)}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] border-[0.5px] border-gray-100 dark:border-gray-800">
                   <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    item.entryType === 'Sale' ? "bg-green-100 text-green-800" :
                    item.entryType === 'Purchase' ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                  )}>
                    {item.entryType}
                  </span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                  {item.billNumber || item.expenseNo || item.id.split('-')[0]}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-400 border-[0.5px] border-gray-100 dark:border-gray-800">
                  {item.customerName || item.vendorName || item.category}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-black dark:text-white text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                  {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    item.status === 'paid' ? "bg-green-600 text-white" :
                    item.status === 'unpaid' || item.status === 'pending' ? "bg-red-600 text-white" :
                    "bg-orange-500 text-white" // Partial/Settled
                  )}>
                    {item.status || 'Paid'}
                  </span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-500 text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => setSelectedTransaction(item)}
                      className="text-blue-500 hover:text-blue-700 flex items-center gap-1 font-bold"
                    >
                      <Eye size={14} /> View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic text-[12px]">
                  No transactions found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Party Reports ---
function PartyReports() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'balance-sheet'>('balance-sheet');
  const [drillDown, setDrillDown] = useState<'receivables' | 'payables' | null>(null);
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');
  const [search, setSearch] = useState('');
  const [selectedParty, setSelectedParty] = useState<Customer | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewParty, setPreviewParty] = useState<Customer | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);
  const [parties, setParties] = useState<Customer[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [liveBalance, setLiveBalance] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: 'balance' | 'name', direction: 'asc' | 'desc' }>({ key: 'balance', direction: 'desc' });

  const [settlementInfo, setSettlementInfo] = useState<{
    isOpen: boolean;
    item: any;
    type: 'Paid' | 'Unpaid';
  }>({ isOpen: false, item: null, type: 'Paid' });

  const [receivablesTotal, setReceivablesTotal] = useState(0);
  const [payablesTotal, setPayablesTotal] = useState(0);
  const [drillDownData, setDrillDownData] = useState<{party: Customer, outstanding: number}[]>([]);

  useEffect(() => {
    loadParties();
  }, [partyType, drillDown]);

  useEffect(() => {
    if (selectedParty) {
      loadLedger(selectedParty.id);
    }
  }, [selectedParty, startDate, endDate, statusFilter]);

  const loadParties = async () => {
    const [customerData, salesRaw, purchases, expenses] = await Promise.all([
      db.getCustomers(),
      db.getSales(),
      db.getPurchases(),
      db.getExpenses()
    ]);
    const sales = salesRaw.filter(s => s.type !== 'estimate');
    const activeParties = customerData.filter(p => !p.isDeleted);
    setParties(activeParties);

    // Calculate Global Totals correctly (Receivables = Unpaid Sales, Payables = Unpaid Purchases + Unpaid Expenses)
    const recTotal = sales.filter(s => !s.isDeleted && s.status !== 'paid' && s.status !== 'settled').reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
    const payTotal = purchases.filter(p => !p.isDeleted && p.status !== 'paid' && p.status !== 'settled').reduce((sum, p) => sum + (p.remainingBalance || 0), 0) +
                    expenses.filter(e => !e.isDeleted && e.status !== 'paid' && e.status !== 'settled').reduce((sum, e) => sum + (e.remainingBalance || 0), 0);
    setReceivablesTotal(recTotal);
    setPayablesTotal(payTotal);

    // Prepare Drill-down data
    if (drillDown === 'receivables') {
      const perParty = activeParties.map(p => {
        const outstanding = sales.filter(s => s.customerId === p.id && !s.isDeleted && s.status !== 'paid' && s.status !== 'settled').reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
        return { party: p, outstanding };
      }).filter(i => i.outstanding > 0);
      setDrillDownData(perParty);
    } else if (drillDown === 'payables') {
      const perParty = activeParties.map(p => {
        const outstandingPurch = purchases.filter(purch => purch.vendorId === p.id && !purch.isDeleted && purch.status !== 'paid' && purch.status !== 'settled').reduce((sum, purch) => sum + (purch.remainingBalance || 0), 0);
        const outstandingExp = expenses.filter(exp => exp.vendorId === p.id && !exp.isDeleted && exp.status !== 'paid' && exp.status !== 'settled').reduce((sum, exp) => sum + (exp.remainingBalance || 0), 0);
        return { party: p, outstanding: outstandingPurch + outstandingExp };
      }).filter(i => i.outstanding > 0);
      setDrillDownData(perParty);
    }
  };

  const extractDistrict = (address: string) => {
    if (!address) return 'N/A';
    const words = address.trim().split(/[\s,]+/);
    return words[0] || 'N/A';
  };

  const getFormatDateFilename = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${d}${m}${y}_${hh}${mm}`;
  };

  const getItemDate = (item: any) => {
    return new Date(item.date || item.billDate || item.createdAt);
  };

  const loadLedger = async (partyId: string) => {
    const [salesRaw, purchases, expenses] = await Promise.all([
      db.getSales(),
      db.getPurchases(),
      db.getExpenses()
    ]);
    const sales = salesRaw.filter(s => s.type !== 'estimate');

    const partySales = sales.filter(s => s.customerId === partyId && !s.isDeleted).map(s => ({ ...s, type: 'Sale' }));
    const partyPurchases = purchases.filter(p => p.vendorId === partyId && !p.isDeleted).map(p => ({ ...p, type: 'Purchase' }));
    const partyExpenses = expenses.filter(e => e.vendorId === partyId && !e.isDeleted).map(e => ({ ...e, type: 'Expense' }));

    const sortedLedger = [...partySales, ...partyPurchases, ...partyExpenses].sort((a, b) => {
      const dateA = getItemDate(a);
      const dateB = getItemDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    const filteredLedger = sortedLedger.filter(item => {
      const itemDate = getItemDate(item).toISOString().split('T')[0];
      const matchesDate = itemDate >= startDate && itemDate <= endDate;
      if (!matchesDate) return false;
      
      if (statusFilter === 'All') return true;
      const status = getStatus(item);
      return status === statusFilter;
    });

    setLedger(filteredLedger);
    
    // Calculate live balance based on ALL unpaid amounts mapped logically (subtracting payments correctly)
    const liveBalanceCalc = sortedLedger.reduce((sum, item) => {
      const anyItem = item as any;
      const remaining = item.type === 'Expense' ? 0 : (typeof anyItem.remainingBalance === 'number' ? anyItem.remainingBalance : (anyItem.status === 'paid' ? 0 : item.total));
      return sum + remaining;
    }, 0);
    setLiveBalance(liveBalanceCalc);
  };

  const getRefinedType = (item: any) => {
    if (item.type === 'Expense') return 'Expense (Paid)';
    
    const anyItem = item as any;
    const method = anyItem.paymentType === 'Credit' ? 'Credit' : 'Cash';
    const label = partyType === 'customer' ? 'Sales' : 'Purchase';
    return `${label} (${method})`;
  };

  const getStatus = (item: any) => {
    if (item.type === 'Expense') return 'Paid';
    const anyItem = item as any;
    const remaining = typeof anyItem.remainingBalance === 'number' ? anyItem.remainingBalance : (anyItem.status === 'paid' ? 0 : item.total);
    // Explicitly check for zero balance first
    if (remaining <= 0) return 'Paid';
    return 'Unpaid';
  };

  const printLedger = (party: Customer, items: any[]) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Professional Header Design - Pure Black
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const shopAddr = settings.shopAddress?.replace(/\n/g, ', ') || 'Trichy';
    doc.text(shopAddr, pageWidth / 2, 21, { align: 'center' });

    // Line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.line(margin, 25, pageWidth - margin, 25);

    const startY = 35;
    doc.setFontSize(11);
    
    // Left Side: Party
    doc.setFont('times', 'bold');
    const statementLabel = items.some(i => i.type === 'Sale') ? 'SALES STATEMENT' : 'PURCHASE LEDGER';
    doc.text(statementLabel, margin, startY);
    
    doc.setFont('times', 'normal');
    doc.text(`Party: ${party.name}`, margin, startY + 7);
    doc.text(`Contact: ${party.phone || 'N/A'}`, margin, startY + 12);

    // Right Side: Balance
    doc.setFont('times', 'normal');
    doc.text(`Date of Issue: ${formatDate(new Date())}`, pageWidth - margin, startY, { align: 'right' });
    
    // Balance Logic: Sum of remaining balance for unpaid transactions
    const unpaidTotal = items
      .filter(i => getStatus(i) === 'Unpaid')
      .reduce((sum, item) => {
        const anyItem = item as any;
        return sum + (typeof anyItem.remainingBalance === 'number' ? anyItem.remainingBalance : item.total);
      }, 0);

    doc.setFont('times', 'bold');
    doc.text(`Outstanding Balance: Rs. ${unpaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, startY + 7, { align: 'right' });

    const headRow = ['Date', 'Bill No', 'Type', 'Due Days', 'Amount', 'Status'];
    const tableData = items.map(item => {
      const dateStr = item.date || item.billDate || item.createdAt;

      // Bill No Data Source Correction
      let billNo = '';
      if (item.type === 'Sale' || item.entryType === 'Sale') {
        billNo = item.billNumber || item.saleNo || item.id;
      } else if (item.type === 'Purchase' || item.entryType === 'Purchase') {
        billNo = item.billNumber || item.id;
      } else if (item.type === 'Expense' || item.entryType === 'Expense') {
        billNo = item.expenseNo || item.id;
      } else {
        billNo = item.billNumber || item.expenseNo || item.id;
      }

      if (billNo && billNo.length > 20 && !billNo.includes('-')) {
        billNo = billNo.substring(0, 8);
      }

      return [
        formatDate(dateStr),
        billNo,
        getRefinedType(item),
        getDueDays(dateStr),
        item.total.toFixed(2),
        getStatus(item).toUpperCase()
      ];
    });

    autoTable(doc, {
      startY: startY + 20,
      head: [headRow],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      bodyStyles: { 
        fontSize: 9, 
        textColor: [0, 0, 0], // Pure black
        fontStyle: 'normal',
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      styles: { font: 'times' },
      columnStyles: {
        1: { fontStyle: 'bold', textColor: [0, 0, 0] },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    });

    const typeLabel = (items.some(i => i.type === 'Sale')) ? 'Statement' : 'Ledger';
    if (typeLabel === 'Statement') {
      doc.save(`${party.name.replace(/\s+/g, '_')}_Statement_${getFormatDateFilename()}.pdf`);
    } else {
      const dStr = formatDate(new Date()).replace(/\//g, '-');
      doc.save(`Ledger_${party.name.replace(/\s+/g, '_')}_${dStr}.pdf`);
    }
  };

  const generateTransactionPDF = (transaction: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Set default color to Pure Black
    doc.setTextColor(0, 0, 0);

    // 1. Header (Minimalist)
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const shopAddr = 'Trichy';
    doc.text(shopAddr, pageWidth / 2, 21, { align: 'center' });
    doc.text(`Contact: ${settings.shopPhone || ''}`, pageWidth / 2, 26, { align: 'center' });

    // Separator line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 31, pageWidth - margin, 31);

    const isSale = transaction.type === 'Sale';
    const isPurchase = transaction.type === 'Purchase';
    const isExpense = transaction.type === 'Expense';

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    const title = isSale ? 'SALE BILL' : isPurchase ? 'PURCHASE BILL' : 'EXPENSE VOUCHER';
    doc.text(title, margin, 42);
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    
    const partyLabel = isSale ? 'Customer' : isPurchase ? 'Suppliers' : 'To';
    const partyName = isSale ? transaction.customerName : isPurchase ? transaction.vendorName : (transaction.vendorName || '-');
    doc.text(`${partyLabel}: ${partyName}`, margin, 50);
    
    const refLabel = isSale ? 'Sale ID' : isPurchase ? 'Bill No' : 'Exp No';
    const refNo = isSale ? (transaction.billNumber || transaction.id.substring(0, 8)) : isPurchase ? transaction.billNumber : transaction.expenseNo;
    doc.text(`${refLabel}: ${refNo}`, margin, 56);
    
    const dateStr = transaction.date || transaction.billDate || transaction.createdAt;
    doc.text(`Date: ${formatDate(dateStr)}`, pageWidth - margin, 50, { align: 'right' });

    if (transaction.items && transaction.items.length > 0) {
      // 3. Table
      const head = [['Category', 'Item Name', 'Qty', 'Unit', 'Price', 'Total']];
      const body = transaction.items.map((item: any) => [
        item.category || '-',
        item.name,
        item.quantity.toString(),
        getUnitAbbreviation(item.unit),
        (item.price || 0).toFixed(2),
        (item.total || 0).toFixed(2)
      ]);

      autoTable(doc, {
        startY: 65,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold', 
          font: 'times',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        bodyStyles: { 
          textColor: [0, 0, 0], // Pure black
          fontStyle: 'normal',
          font: 'times',
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        styles: { font: 'times', fontSize: 10 },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      const summaryRight = pageWidth - margin;

      doc.text(`Subtotal: ${(transaction.subtotal || transaction.total).toFixed(2)}`, summaryRight, finalY, { align: 'right' });
      if (transaction.roundOff) {
        doc.text(`Round Off: ${transaction.roundOff.toFixed(2)}`, summaryRight, finalY + 6, { align: 'right' });
      }
      
      doc.text(`Grand Total: Rs. ${transaction.total.toFixed(2)}`, summaryRight, finalY + (transaction.roundOff ? 14 : 8), { align: 'right' });
    } else {
      // For expenses without items
      doc.setFontSize(11);
      doc.text(`Amount Paid: Rs. ${transaction.total.toFixed(2)}`, margin, 70);
      if (transaction.category) {
        doc.text(`Spent On: ${transaction.category}`, margin, 77);
      }
      if (transaction.notes) {
        doc.text(`Remarks: ${transaction.notes}`, margin, 84);
      }
    }

    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `${title.replace(/\s+/g, '_')}_${partyName.replace(/\s+/g, '_')}_${refNo}_${todayStr}.pdf`;
    doc.save(fileName);
  };

  const openBalanceSheet = async (party: Customer) => {
    const [salesRaw, purchases] = await Promise.all([db.getSales(), db.getPurchases()]);
    const sales = salesRaw.filter(s => s.type !== 'estimate');
    // A5 Balance Sheet must ONLY show Unpaid records
    const pSales = sales.filter(s => s.customerId === party.id && !s.isDeleted && s.remainingBalance > 0).map(s => ({ ...s, type: 'Sale' }));
    const pPurchases = purchases.filter(p => p.vendorId === party.id && !p.isDeleted && p.remainingBalance > 0).map(p => ({ ...p, type: 'Purchase' }));
    
    setPreviewParty(party);
    setPreviewTransactions([...pSales, ...pPurchases]);
    setIsPreviewModalOpen(true);
  };

  const filteredParties = parties.filter(p => {
    const matchesSearch = String(p.name || "").toLowerCase().includes(search.toLowerCase()) || String(p.phone || "").includes(search);
    const matchesType = partyType === 'supplier' ? p.groupId === 'vendor' : p.groupId !== 'vendor';
    return matchesSearch && matchesType;
  });

  if (selectedParty) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedParty(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ChevronLeft size={20} /> Back to List
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 px-3 shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase">From</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 px-3 shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase">To</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 px-3 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase">Filter Status</span>
              <select 
                value={statusFilter} 
                onChange={e => {
                  setStatusFilter(e.target.value as any);
                  if (selectedParty) loadLedger(selectedParty.id);
                }}
                className="text-sm font-bold bg-transparent outline-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <button onClick={() => printLedger(selectedParty, ledger)} className="flex items-center gap-2 px-4 py-2 bg-[#2a9df4] text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
              <Printer size={18} /> Print Ledger
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedParty.name}</h3>
              <p className="text-gray-500">{selectedParty.phone}</p>
              <p className="text-gray-500">{selectedParty.billingAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Current Balance</p>
              <p className={cn("text-3xl font-bold", liveBalance >= 0 ? "text-green-600" : "text-red-600")}>
                {Math.abs(liveBalance).toLocaleString()}
                <span className="text-sm ml-1">{liveBalance >= 0 ? 'Cr' : 'Dr'}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#CFB53B] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">DATE</th>
                  <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">BILL NO</th>
                  <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">TYPE</th>
                  <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">DUE DAYS</th>
                  <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">AMOUNT</th>
                  <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {ledger.map((item, idx) => {
                  const refinedType = getRefinedType(item);
                  const status = getStatus(item);
                  const dateStr = item.date || item.billDate || item.createdAt;
                  
                  return (
                    <tr key={idx} className={cn(
                      "hover:bg-blue-50/50 transition-colors",
                      idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50"
                    )}>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-400 border-[0.5px] border-gray-100 dark:border-gray-800">
                        {formatDate(dateStr)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-gray-900 dark:text-white uppercase tracking-wider border-[0.5px] border-gray-100 dark:border-gray-800">
                        {item.billNumber || (item.type === 'Sale' ? item.saleNo : item.type === 'Purchase' ? item.billNumber : item.expenseNo) || item.id?.split('-')[0]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] border-[0.5px] border-gray-100 dark:border-gray-800">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          item.type === 'Sale' 
                            ? "bg-blue-50 text-blue-600 border border-blue-100" 
                            : "bg-orange-50 text-orange-600 border border-orange-100"
                        )}>
                          {refinedType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-500 dark:text-gray-400 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-1 font-medium">
                          <Clock size={14} className="text-gray-400" />
                          {getDueDays(dateStr)}
                        </div>
                      </td>
                      <td className={cn(
                        "px-6 py-4 whitespace-nowrap text-[12px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800",
                        item.type === 'Sale' ? "text-green-600" : "text-red-600"
                      )}>
                        {item.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] border-[0.5px] border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-4">
                          <span className={cn(
                            "uppercase tracking-tighter",
                            status === 'Paid' ? "text-green-600 font-medium" : "text-red-400 font-bold"
                          )}>
                            {status === 'Paid' ? 'Paid' : 'UNPAID'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generateTransactionPDF(item)}
                              className="p-1 text-gray-400 hover:text-black transition-colors"
                              title="Download Transaction Bill"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <SettlementModal 
          isOpen={settlementInfo.isOpen}
          onClose={() => setSettlementInfo({ isOpen: false, item: null, type: 'Paid' })}
          title={settlementInfo.type === 'Paid' 
            ? (settlementInfo.item?.type === 'Sale' ? "Payment received completely?" : "Payment made completely?")
            : (settlementInfo.item?.type === 'Sale' ? "Payment NOT received completely?" : "Payment NOT made completely?")
          }
          type={settlementInfo.type}
          refNo={settlementInfo.item?.id || settlementInfo.item?.billNumber || settlementInfo.item?.expenseNo || ''}
          onConfirm={async () => {
            const item = settlementInfo.item;
            const newType = settlementInfo.type;
            
            let amountDelta = 0;
            if (item.type === 'Sale') {
              const sale = await db.getSale(item.id);
              if (sale) {
                if (newType === 'Paid') {
                  amountDelta = -(sale.remainingBalance || sale.total);
                  sale.remainingBalance = 0;
                  sale.status = 'paid';
                } else {
                  amountDelta = sale.total;
                  sale.remainingBalance = sale.total;
                  sale.status = 'pending';
                }
                await db.addSale(sale);
              }
            } else if (item.type === 'Purchase') {
              const purchases = await db.getPurchases();
              const p = purchases.find(pur => pur.id === item.id);
              if (p) {
                if (newType === 'Paid') {
                  amountDelta = -(p.remainingBalance || p.total);
                  p.remainingBalance = 0;
                  p.status = 'paid';
                } else {
                  amountDelta = p.total;
                  p.remainingBalance = p.total;
                  p.status = 'unpaid';
                }
                await db.updatePurchase(p);
              }
            } else if (item.type === 'Expense') {
              const expenses = await db.getExpenses();
              const e = expenses.find(exp => exp.id === item.id);
              if (e) {
                if (newType === 'Paid') {
                  amountDelta = -(e.remainingBalance || e.total);
                  e.remainingBalance = 0;
                  e.status = 'paid';
                } else {
                  amountDelta = e.total;
                  e.remainingBalance = e.total;
                  e.status = 'unpaid';
                }
                await db.updateExpense(e);
              }
            }
            
            if (amountDelta !== 0 && selectedParty) {
              await db.updateCustomerBalance(selectedParty.id, amountDelta);
            }
            
            setSettlementInfo({ isOpen: false, item: null, type: 'Paid' });
            if (selectedParty) {
              await loadLedger(selectedParty.id);
              await loadParties();
            }
          }}
        />
      </div>
    );
  }

  if (activeTab === 'balance-sheet') {
    if (drillDown) {
      const sortedDrillDown = [...drillDownData]
        .filter(item => String(item.party?.name || "").toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          if (sortConfig.key === 'balance') {
            return sortConfig.direction === 'desc' ? b.outstanding - a.outstanding : a.outstanding - b.outstanding;
          }
          return sortConfig.direction === 'desc' ? b.party.name.localeCompare(a.party.name) : a.party.name.localeCompare(b.party.name);
        });

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setDrillDown(null)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {drillDown === 'receivables' ? 'Customer Receivables' : 'Supplier Payables'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const title = drillDown === 'receivables' ? 'Customer Receivables' : 'Suppliers Payables';
                  const headers = ['Party Name', 'District', 'Phone', 'Balance'];
                  const body = sortedDrillDown.map(i => [
                    i.party.name, 
                    extractDistrict(i.party.billingAddress), 
                    i.party.phone, 
                    i.outstanding.toFixed(2)
                  ]);
                  // Reusing generic print function logic (inline since printTable isn't globally available here)
                  const isA5 = settings.printFormat === 'A5';
                  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: isA5 ? 'a5' : 'a4' });
                  const pageWidth = doc.internal.pageSize.getWidth();
                  doc.setFont('times', 'bold');
                  doc.text('BARAKATH AGENCIES', pageWidth/2, 15, { align: 'center' });
                  doc.text(title.toUpperCase(), pageWidth/2, 22, { align: 'center' });
                  autoTable(doc, {
                    startY: 30,
                    head: [headers],
                    body: body,
                    theme: 'striped',
                    headStyles: { fillColor: [42, 157, 244] }
                  });
                  doc.save(`${title.replace(/\s+/g, '_')}_${getFormatDateFilename()}.pdf`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Printer size={18} /> Print
              </button>
              <button 
                onClick={() => {
                  // Basically same as print for now
                  const title = drillDown === 'receivables' ? 'Customer Receivables' : 'Supplier Payables';
                  const headers = ['Party Name', 'District', 'Phone', 'Balance'];
                  const body = sortedDrillDown.map(i => [
                    i.party.name, 
                    extractDistrict(i.party.billingAddress), 
                    i.party.phone, 
                    i.outstanding.toFixed(2)
                  ]);
                  const doc = new jsPDF();
                  autoTable(doc, { head: [headers], body: body });
                  doc.save(`${title.replace(/\s+/g, '_')}_${getFormatDateFilename()}.pdf`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download size={18} /> Download
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="mb-6 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by Party Name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#CFB53B] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
                  <tr>
                    <th 
                      onClick={() => setSortConfig({ key: 'name', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 cursor-pointer hover:bg-[#b8a034] dark:hover:bg-gray-700 transition-colors whitespace-nowrap font-serif"
                    >
                      PARTY/SUPPLIERS NAME (DISTRICT)
                    </th>
                    <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-48 whitespace-nowrap border-l-[0.5px] font-serif">PARTY NUMBER</th>
                    <th 
                      onClick={() => setSortConfig({ key: 'balance', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 cursor-pointer hover:bg-[#b8a034] dark:hover:bg-gray-700 transition-colors group w-48 whitespace-nowrap font-serif"
                    >
                      <div className="flex items-center gap-1">
                        BALANCE AMOUNT
                        <TrendingUp size={14} className={cn("transition-all", sortConfig.key === 'balance' && sortConfig.direction === 'asc' ? "rotate-180" : "")} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32 whitespace-nowrap font-serif">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedDrillDown.map((item, idx) => (
                    <tr key={idx} className={cn(
                      "hover:bg-blue-50/50 transition-colors",
                      idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50"
                    )}>
                      <td className="px-6 py-4 whitespace-nowrap border-[0.5px] border-gray-100 dark:border-gray-800">
                        <div className="text-[12px] font-bold text-gray-900 dark:text-white">{item.party.name}</div>
                        <div className="text-[10px] text-gray-500">{extractDistrict(item.party.billingAddress)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] text-gray-600 dark:text-gray-400 border-[0.5px] border-gray-100 dark:border-gray-800">
                        {item.party.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                        {item.outstanding.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-3 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <button 
                          onClick={async () => {
                            const [salesRaw, purchases] = await Promise.all([db.getSales(), db.getPurchases()]);
                            const sales = salesRaw.filter(s => s.type !== 'estimate');
                            const unpaidSales = sales.filter(s => s.customerId === item.party.id && !s.isDeleted && s.remainingBalance > 0).map(s => ({ ...s, type: 'Sale' }));
                            const unpaidPurchases = purchases.filter(p => p.vendorId === item.party.id && !p.isDeleted && p.remainingBalance > 0).map(p => ({ ...p, type: 'Purchase' }));
                            printLedger(item.party, [...unpaidSales, ...unpaidPurchases]);
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="A5 Unpaid Bills Statement"
                        >
                          <FileText size={18} />
                        </button>
                        <button 
                          onClick={() => setSelectedParty(item.party)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Ledger"
                        >
                          <ChevronLeft size={18} className="rotate-180" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedDrillDown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No parties found with outstanding balance.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <button 
            onClick={() => setDrillDown('receivables')}
            className="group flex flex-col items-center p-10 bg-white dark:bg-gray-800 rounded-3xl border-2 border-transparent hover:border-green-500 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-all duration-300"
          >
            <h3 className="text-2xl font-bold text-green-600 mb-6 uppercase tracking-widest">Total Receivables</h3>
            <div className="text-5xl font-medium text-gray-900 dark:text-white mb-4">
              {receivablesTotal.toLocaleString()}
            </div>
            <p className="text-gray-400 font-medium group-hover:text-green-500 transition-colors">Click to recover payments</p>
          </button>

          <button 
            onClick={() => setDrillDown('payables')}
            className="group flex flex-col items-center p-10 bg-white dark:bg-gray-800 rounded-3xl border-2 border-transparent hover:border-red-500 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-all duration-300"
          >
            <h3 className="text-2xl font-bold text-red-600 mb-6 uppercase tracking-widest">Total Payables</h3>
            <div className="text-5xl font-medium text-gray-900 dark:text-white mb-4">
              {payablesTotal.toLocaleString()}
            </div>
            <p className="text-gray-400 font-medium group-hover:text-red-500 transition-colors">Click to settle debts</p>
          </button>
        </div>
      </div>
    );
  }

  // This should not be reachable if activeTab is 'balance-sheet'
  return null;
}

// --- Item/Stock Reports ---
function ItemStockReports() {
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'item-pl';
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [data, setData] = useState<{
    products: Product[];
    inventory: Inventory[];
    sales: Sale[];
    purchases: Purchase[];
  }>({ products: [], inventory: [], sales: [], purchases: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [products, inventory, salesRaw, purchases] = await Promise.all([
      db.getProducts(),
      db.getInventory(),
      db.getSales(),
      db.getPurchases()
    ]);
    setData({ 
      products: products.filter(p => !p.isDeleted), 
      inventory, 
      sales: salesRaw.filter(s => !s.isDeleted && s.type !== 'estimate'), 
      purchases: purchases.filter(p => !p.isDeleted) 
    });
  };

  const setTab = (tab: string) => {
    setSearchParams({ view: 'items', tab });
    setSelectedCategory(null);
    setSearch('');
  };

  const printTable = (title: string, headers: string[], body: any[]) => {
    const isA5 = settings.printFormat === 'A5';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA5 ? 'a5' : 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    if (isA5) {
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(title.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
    } else {
      doc.setFillColor(42, 157, 144);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('times', 'bold');
      doc.text(settings.shopName || 'BARAKATH AGENCIES', 15, 17);
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.text(title.toUpperCase(), pageWidth - 15, 15, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    autoTable(doc, {
      startY: isA5 ? 25 : 35,
      head: [headers],
      body: body,
      theme: isA5 ? 'grid' : 'striped',
      headStyles: { 
        fillColor: isA5 ? [60, 60, 60] : [42, 157, 144], 
        textColor: [255, 255, 255],
        fontSize: isA5 ? 8 : 10,
        font: 'times'
      },
      bodyStyles: { fontSize: isA5 ? 8 : 10, cellPadding: isA5 ? 2 : 3, font: 'times' },
      margin: { left: 15, right: 15 }
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  // Helper: Get product sales volume
  const getProductSalesVolume = (productId: string) => {
    return data.sales.flatMap(s => s.items)
      .filter(i => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Helper: Get P&L for a product
  const getProductPL = (product: Product) => {
    const revenue = data.sales.flatMap(s => s.items)
      .filter(i => i.productId === product.id)
      .reduce((sum, i) => sum + i.total, 0);
    
    const cost = data.purchases.flatMap(p => p.items)
      .filter(i => i.productId === product.id)
      .reduce((sum, i) => sum + i.total, 0);
    
    const profit = revenue - cost;
    
    return { revenue, cost, profit };
  };

  const renderTabs = () => (
    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-fit mb-6">
      {[
        { id: 'item-pl', label: 'Item-wise P&L' },
        { id: 'category-pl', label: 'Category-wise P&L' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={cn(
            "px-4 py-2 text-sm font-bold rounded-md transition-all",
            activeTab === tab.id 
              ? "bg-white dark:bg-gray-800 text-[#2a9df4] shadow-sm" 
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // Stock reports logic removed based on user request

  // --- 3. Item-wise P&L ---
  if (activeTab === 'item-pl') {
    const categories = Array.from(new Set(data.products.map(p => p.category))) as string[];
    const plData = data.products
      .map(p => ({ product: p, ...getProductPL(p) }))
      .filter(i => String(i.product?.name || "").toLowerCase().includes(search.toLowerCase()));
    
    // Group by category to calculate relative margin
    const categoryProfits: Record<string, number> = {};
    categories.forEach((cat: string) => {
      categoryProfits[cat] = plData
        .filter(i => i.product.category === cat)
        .reduce((sum, i) => sum + i.profit, 0);
    });

    const finalData = plData.map(item => {
      const catProfit = categoryProfits[item.product.category] || 0;
      const relativeMargin = catProfit !== 0 ? (item.profit / catProfit) * 100 : 0;
      return { ...item, relativeMargin };
    }).sort((a, b) => b.profit - a.profit);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {renderTabs()}
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button 
              onClick={() => printTable('Item-wise P&L', ['Product', 'Cost', 'Revenue', 'Profit', 'Rel. Margin'], finalData.map(i => [i.product.name, i.cost.toFixed(2), i.revenue.toFixed(2), i.profit.toFixed(2), `${i.relativeMargin.toFixed(1)}%`]))}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border rounded-lg hover:bg-gray-50"
            >
              <Printer size={18} /> Print
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#CFB53B] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">PRODUCT NAME</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-48 whitespace-nowrap">TOTAL COST</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-56 whitespace-nowrap">TOTAL REVENUE</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-56 whitespace-nowrap">NET PROFIT/LOSS</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap">MARGIN %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {finalData.map((item, idx) => (
                <tr key={idx} className={cn(
                  "hover:bg-blue-50/50 transition-colors",
                  idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50"
                )}>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] font-medium text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">{item.product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] text-black text-right border-[0.5px] border-gray-100 dark:border-gray-800">{item.cost.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] text-black text-right border-[0.5px] border-gray-100 dark:border-gray-800">{item.revenue.toLocaleString()}</td>
                  <td className={cn("px-6 py-4 whitespace-nowrap text-[12px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800", item.profit >= 0 ? "text-green-600" : "text-red-600")}>
                    {item.profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    {item.relativeMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- 4. Category-wise P&L ---
  if (activeTab === 'category-pl') {
    const categories = Array.from(new Set(data.products.map(p => p.category))) as string[];
    const businessTotalProfit = categories.reduce((total: number, cat: string) => {
      const catProducts = data.products.filter(p => p.category === cat);
      return total + catProducts.reduce((sum, p) => sum + getProductPL(p).profit, 0);
    }, 0);

    const catPLData = categories.map(cat => {
      const catProducts = data.products.filter(p => p.category === cat);
      const stats = catProducts.map(p => getProductPL(p));
      const revenue = stats.reduce((sum, s) => sum + s.revenue, 0);
      const cost = stats.reduce((sum, s) => sum + s.cost, 0);
      const profit = revenue - cost;
      const relativeMargin = businessTotalProfit !== 0 ? (profit / businessTotalProfit) * 100 : 0;
      return { category: cat, revenue, cost, profit, relativeMargin };
    }).sort((a, b) => b.profit - a.profit);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {renderTabs()}
          <button 
            onClick={() => printTable('Category-wise P&L', ['Category', 'Cost', 'Revenue', 'Profit', 'Rel. Margin'], catPLData.map(i => [i.category, i.cost.toFixed(2), i.revenue.toFixed(2), i.profit.toFixed(2), `${i.relativeMargin.toFixed(1)}%`]))}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border rounded-lg hover:bg-gray-50"
          >
            <Printer size={18} /> Print
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#CFB53B] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 whitespace-nowrap">CATEGORY NAME</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-48 whitespace-nowrap">TOTAL COST</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-56 whitespace-nowrap">TOTAL REVENUE</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-56 whitespace-nowrap">NET PROFIT/LOSS</th>
                <th className="px-6 py-3 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#CFB53B] dark:bg-gray-855 uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap">MARGIN %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {catPLData.map((item, idx) => (
                <tr key={idx} className={cn(
                  "hover:bg-blue-50/50 transition-colors",
                  idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50"
                )}>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">{item.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] text-black text-right border-[0.5px] border-gray-100 dark:border-gray-800">{item.cost.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] text-black text-right border-[0.5px] border-gray-100 dark:border-gray-800">{item.revenue.toLocaleString()}</td>
                  <td className={cn("px-6 py-4 whitespace-nowrap text-[12px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800", item.profit >= 0 ? "text-green-600" : "text-red-600")}>
                    {item.profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] font-bold text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-end gap-2">
                       <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", item.relativeMargin >= 0 ? "bg-green-500" : "bg-red-500")} 
                          style={{ width: `${Math.min(Math.abs(item.relativeMargin), 100)}%` }} 
                        />
                      </div>
                      <span>{item.relativeMargin.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

function StockUpdateModal({ product, inventory, onClose, onSave }: { 
  product: Product, 
  inventory: Inventory, 
  onClose: () => void, 
  onSave: () => void 
}) {
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<'base' | 'secondary'>('base');
  const [type, setType] = useState<'add' | 'subtract' | 'set'>('add');

  const handleSave = async () => {
    const val = parseFloat(qty);
    if (isNaN(val)) return;

    let baseQtyChange = val;
    if (unit === 'secondary' && product.conversionRate) {
      baseQtyChange = val * product.conversionRate;
    }

    let newTotal = inventory.quantity;
    if (type === 'add') newTotal += baseQtyChange;
    else if (type === 'subtract') newTotal -= baseQtyChange;
    else newTotal = baseQtyChange;

    await db.updateInventory({
      ...inventory,
      quantity: Math.max(0, newTotal),
      lastUpdated: new Date().toISOString()
    });

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Update Stock: {product.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['add', 'subtract', 'set'].map(t => (
                <button
                  key={t}
                  onClick={() => setType(t as any)}
                  className={cn(
                    "py-2 text-xs font-bold rounded-lg border transition-all capitalize",
                    type === t ? "bg-blue-500 text-white border-blue-500" : "border-gray-200 dark:border-gray-700 text-gray-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <input 
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value as any)}
                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="base">{product.baseUnit}</option>
                {product.secondaryUnit && <option value="secondary">{product.secondaryUnit}</option>}
              </select>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Current Stock</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {inventory.quantity} {product.baseUnit}
              {product.secondaryUnit && product.conversionRate && (
                <span className="text-gray-400 font-medium ml-2">
                  ({(Number(inventory.quantity) / (Number(product.conversionRate) || 1)).toFixed(2)} {product.secondaryUnit})
                </span>
              )}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-lg shadow-blue-100"
            >
              Update Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
