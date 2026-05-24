import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Sale, Product, Inventory, Customer } from '../lib/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, isAfter, startOfDay, subWeeks, subMonths, subYears, startOfToday, startOfMonth } from 'date-fns';
import { IndianRupee, ShoppingBag, Users, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, ChevronRight, X, Printer, Edit2, FileText, Plus } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatDate } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';

type TimeRange = 'week' | 'month' | '3months' | '6months' | 'year';

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalSales: 0,
    cashSales: 0,
    creditSales: 0,
    totalReceivables: 0,
    totalPayables: 0,
    salesCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    customersCount: 0,
    todaySales: 0,
    netProfit: 0,
    currentMonthName: format(new Date(), 'MMMM')
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartRange, setChartRange] = useState<'7days' | '30days'>('7days');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topProductsRange, setTopProductsRange] = useState<TimeRange>('month');
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);

  const loadData = async () => {
    const allSales = await db.getSales();
    const allPurchases = await db.getPurchases();
    const allInventory = await db.getInventory();
    const allCustomers = await db.getCustomers();
    const allProducts = await db.getProducts();
    const allExpenses = await db.getExpenses();

    const sales = allSales.filter(s => !s.isDeleted && s.type !== 'estimate');
    const purchases = allPurchases.filter(p => !p.isDeleted);
    const expenses = allExpenses.filter(e => !e.isDeleted);
    const customers = allCustomers.filter(c => !c.isDeleted);
    const products = allProducts.filter(p => !p.isDeleted);
    const inventory = allInventory.filter(i => {
      const product = products.find(p => p.id === i.productId);
      return product && !product.isDeleted;
    });
    
    // Monthly Profit Calculation
    const startOfCurrentMonth = startOfMonth(new Date());
    
    const monthlySales = sales.filter(s => new Date(s.date).getTime() >= startOfCurrentMonth.getTime());
    const monthlyPurchases = purchases.filter(p => new Date(p.billDate).getTime() >= startOfCurrentMonth.getTime());
    const monthlyExpenses = expenses.filter(e => new Date(e.date).getTime() >= startOfCurrentMonth.getTime());

    const monthlySalesRev = monthlySales.reduce((sum, s) => sum + s.total, 0);
    const monthlyPurchaseCost = monthlyPurchases.reduce((sum, p) => sum + p.total, 0);
    const monthlyOpExpenses = monthlyExpenses.reduce((sum, e) => sum + e.total, 0);
    const monthlyNetProfit = monthlySalesRev - (monthlyPurchaseCost + monthlyOpExpenses);

    // Calculate KPIs
    const totalSalesAmount = sales.reduce((sum, s) => sum + s.total, 0);
    const paidSales = sales.filter(s => s.paymentType === 'Cash' || (s.remainingBalance !== undefined && s.remainingBalance <= 0)).reduce((sum, s) => sum + s.total, 0);
    const totalReceivables = sales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
    const totalPayables = purchases.reduce((sum, p) => sum + (p.remainingBalance || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
    const netRevenue = totalSalesAmount - totalExpenses;
    
    const today = startOfToday();
    const todaySalesAmount = sales
      .filter(s => new Date(s.date).getTime() >= today.getTime())
      .reduce((sum, s) => sum + s.total, 0);

    const lowStock = inventory.filter(i => i.quantity <= i.minStockLevel);
    const outOfStock = inventory.filter(i => i.quantity <= 0);
    const lowStockWithNames = lowStock.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        name: product?.name || 'Unknown Product'
      };
    });

    setStats({
      totalSales: netRevenue,
      cashSales: paidSales,
      creditSales: totalReceivables, // Using total receivables for unpaid sales context
      totalReceivables,
      totalPayables,
      salesCount: sales.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      customersCount: customers.length,
      todaySales: todaySalesAmount,
      netProfit: monthlyNetProfit,
      currentMonthName: format(new Date(), 'MMMM')
    });

    setRecentSales(sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5));
    setCustomers(customers);
    setLowStockItems(lowStockWithNames);

    // Calculate Top Products based on range
    const now = new Date();
    let startDate = subMonths(now, 1);
    if (topProductsRange === 'week') startDate = subWeeks(now, 1);
    if (topProductsRange === '3months') startDate = subMonths(now, 3);
    if (topProductsRange === '6months') startDate = subMonths(now, 6);
    if (topProductsRange === 'year') startDate = subYears(now, 1);

    const filteredSales = sales.filter(s => isAfter(new Date(s.date), startDate));

    const productSalesMap: Record<string, { name: string, quantity: number, revenue: number, margin: number }> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const purchasePrice = product?.purchasePrice || 0;
        const marginPerUnit = item.price - purchasePrice;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = { name: item.name, quantity: 0, revenue: 0, margin: 0 };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].revenue += item.total;
        // Total margin for this product in this period
        productSalesMap[item.productId].margin += (marginPerUnit * item.quantity);
      });
    });

    const topProductsList = Object.values(productSalesMap)
      .map(p => ({
        ...p,
        // Individual margin for display (average)
        unitMargin: p.quantity > 0 ? p.margin / p.quantity : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    setTopProducts(topProductsList);

    // Calculate sales for chart based on range
    const daysCount = chartRange === '7days' ? 7 : 30;
    const chartDays = Array.from({ length: daysCount }).map((_, i) => {
      const d = subDays(new Date(), i);
      return {
        date: format(d, 'MMM dd'),
        amount: 0,
        fullDate: format(d, 'yyyy-MM-dd')
      };
    }).reverse();

    sales.forEach(sale => {
      const saleDate = format(new Date(sale.date), 'yyyy-MM-dd');
      const day = chartDays.find(d => d.fullDate === saleDate);
      if (day) {
        day.amount += sale.total;
      }
    });

    setChartData(chartDays);
  };

  const generatePDF = (sale: Sale) => {
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
      doc.setFontSize(14);
      doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 10, { align: 'center' });
      
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      if (settings.shopSubtext) {
        doc.text(settings.shopSubtext, pageWidth / 2, 14, { align: 'center' });
      }
      
      const headerInfo = [
        settings.shopAddress?.replace(/\n/g, ', '),
        settings.shopPhone ? `Phone: ${settings.shopPhone}` : null,
        settings.shopGstin ? `GSTIN: ${settings.shopGstin}` : null
      ].filter(Boolean).join(' | ');
      
      doc.text(headerInfo, pageWidth / 2, 18, { align: 'center' });
      doc.line(15, 20, pageWidth - 15, 20);
    } else {
      doc.setFillColor(42, 157, 244);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('times', 'bold');
      doc.text(settings.shopName || 'BARAKATH AGENCIES', 15, 12);
      
      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      if (settings.shopSubtext) {
        doc.text(settings.shopSubtext, 15, 17);
      }
      
      const rightHeaderInfo = [];
      if (settings.shopPhone) rightHeaderInfo.push(`Tel: ${settings.shopPhone}`);
      if (settings.shopGstin) rightHeaderInfo.push(`GSTIN: ${settings.shopGstin}`);
      
      doc.setFontSize(10);
      doc.text(sale.type.toUpperCase(), pageWidth - 15, 10, { align: 'right' });
      doc.setFontSize(8);
      rightHeaderInfo.forEach((info, i) => {
        doc.text(info, pageWidth - 15, 15 + (i * 4), { align: 'right' });
      });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      const addr = settings.shopAddress || '';
      doc.text(addr, 15, 30);
    }

    // Customer Info
    const customer = customers.find(c => c.id === sale.customerId);
    const startY = isA5 ? 25 : 45;
    
    doc.setFontSize(isA5 ? 9 : 11);
    doc.setFont('times', 'bold');
    doc.text(`Bill To: ${sale.customerName}`, 15, startY);
    
    doc.setFont('times', 'normal');
    if (customer?.billingAddress) {
      doc.setFontSize(isA5 ? 8 : 10);
      const addr = doc.splitTextToSize(customer.billingAddress, isA5 ? 60 : 100);
      doc.text(addr, 15, startY + 5);
    }
    
    doc.setFontSize(isA5 ? 9 : 11);
    doc.text(`Date: ${formatDate(sale.date)}`, pageWidth - 15, startY, { align: 'right' });
    doc.text(`Bill No: ${sale.id}`, pageWidth - 15, startY + 5, { align: 'right' });

    // Items Table
    const hasTax = sale.items.some(item => item.tax > 0);
    const headRow = hasTax 
      ? ['Item', 'Qty', 'Unit', 'Price', 'Disc', 'Tax', 'Total']
      : ['Item', 'Qty', 'Unit', 'Price', 'Disc', 'Total'];

    const tableData = sale.items.map(item => {
      const row = [
        item.name,
        item.quantity.toString(),
        item.unit,
        item.price.toFixed(2),
        item.discount.toFixed(2),
      ];
      if (hasTax) row.push(`${item.tax}%`);
      row.push(item.total.toFixed(2));
      return row;
    });

    autoTable(doc, {
      startY: startY + 15,
      head: [headRow],
      body: tableData,
      theme: isA5 ? 'grid' : 'striped',
      headStyles: { 
        fillColor: isA5 ? [60, 60, 60] : [42, 157, 244],
        fontSize: isA5 ? 8 : 10,
        halign: 'left'
      },
      bodyStyles: { 
        fontSize: isA5 ? 8 : 10, 
        cellPadding: isA5 ? 2 : 3,
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        // Right align all numbers
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: hasTax ? 'right' : 'right' }, 
        6: { halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || (startY + 20);

    // Totals Block aligned with the right edge (pageWidth - 15)
    // Label offset creates the 10px spacing requested to prevent cramping
    const valueX = pageWidth - 15;
    const labelX = pageWidth - 45; 
    let currentY = finalY + 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA5 ? 9 : 11);
    
    doc.text('Subtotal:', labelX, currentY, { align: 'right' });
    doc.text(sale.subtotal.toFixed(2), valueX, currentY, { align: 'right' });
    
    currentY += 6;
    doc.text('Pkg & Loader:', labelX, currentY, { align: 'right' });
    doc.text(sale.packageLoaderAmt.toFixed(2), valueX, currentY, { align: 'right' });
    
    if (sale.roundOff !== 0) {
      currentY += 6;
      doc.text('Round Off:', labelX, currentY, { align: 'right' });
      doc.text(sale.roundOff.toFixed(2), valueX, currentY, { align: 'right' });
    }
    
    currentY += 8;
    doc.setFontSize(isA5 ? 10 : 13);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', labelX, currentY, { align: 'right' });
    doc.text(sale.total.toFixed(2), valueX, currentY, { align: 'right' });

    doc.save(`${sale.type}_${sale.id}.pdf`);
  };

  useEffect(() => {
    loadData();
  }, [chartRange, topProductsRange]);

  return (
    <div className="flex flex-col space-y-3 pb-8">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-[#3B82F6] dark:text-blue-400">BARAKATH AGENCIES</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/purchase/new')}
            className="px-6 py-2 bg-white dark:bg-gray-800 text-blue-600 border border-blue-200 dark:border-blue-900 text-xs font-bold rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            Add Purchase
          </button>
          <button 
            onClick={() => navigate('/sales?action=new')}
            className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 dark:shadow-none"
          >
            New Billing
          </button>
        </div>
      </div>
      
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex flex-col items-center justify-center h-32">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.netProfit.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 font-medium lowercase tracking-widest">month net revenue</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex flex-col items-center justify-center h-32">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.todaySales.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 font-medium lowercase tracking-widest">today's sales</p>
          </div>
        </div>

        <div onClick={() => navigate('/products?filter=out-of-stock')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-red-500 flex flex-col items-center justify-center h-32 cursor-pointer hover:shadow-md transition-shadow">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.outOfStockCount}</p>
            <p className="text-[10px] text-gray-400 font-medium lowercase tracking-widest">out of stock</p>
          </div>
        </div>

        <div onClick={() => navigate('/customers')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-purple-500 flex flex-col items-center justify-center h-32 cursor-pointer hover:shadow-md transition-shadow">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stats.customersCount}</p>
            <p className="text-[10px] text-gray-400 font-medium lowercase tracking-widest">total customers</p>
          </div>
        </div>
      </div>
      
      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Sales Performance Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col min-h-[360px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-[12px] font-bold font-serif text-gray-800 dark:text-white uppercase tracking-tight">Sales Performance</h3>
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button 
                onClick={() => setChartRange('7days')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                  chartRange === '7days' ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"
                )}
              >
                7 Days
              </button>
              <button 
                onClick={() => setChartRange('30days')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                  chartRange === '30days' ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"
                )}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#9CA3AF', fontSize: 10}} 
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 10}} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={chartRange === '7days' ? 24 : 8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Sales Activity */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden min-h-[360px]">
          <h3 className="text-[12px] font-bold font-serif text-gray-800 dark:text-white mb-4 flex items-center gap-2 shrink-0 uppercase tracking-tight">
            <Clock size={16} className="text-[#3B82F6]" />
            Recent Sales
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 px-1 text-[10px] font-bold text-gray-400 uppercase">Customer</th>
                  <th className="py-2 px-1 text-[10px] font-bold text-gray-400 uppercase text-right">Amount</th>
                  <th className="py-2 px-1 text-[10px] font-bold text-gray-400 uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    onClick={() => setPreviewSale(sale)}
                    className="odd:bg-gray-50 dark:odd:bg-gray-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0">
                          {sale.customerName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-gray-900 dark:text-white truncate">{sale.customerName}</p>
                          <p className="text-[8px] text-gray-500">{format(new Date(sale.date), 'dd MMM')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-1 text-right">
                      <p className="text-[10px] font-bold text-gray-900 dark:text-white">₹{sale.total.toLocaleString()}</p>
                    </td>
                    <td className="py-3 px-1 text-center">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        sale.status === 'paid' ? "bg-green-100 text-green-700" : 
                        sale.status === 'pending' ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Analytics & Detailed Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
        {/* Top 10 Selling Products List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-[400px] overflow-hidden">
          <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 z-20 shrink-0">
            <h3 className="text-[12px] font-bold font-serif text-gray-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
              <TrendingUp size={16} className="text-green-500" />
              Top Selling Items
            </h3>
            <select 
              value={topProductsRange}
              onChange={(e) => setTopProductsRange(e.target.value as TimeRange)}
              className="text-[9px] font-bold border border-gray-200 dark:border-gray-700 rounded p-1 bg-transparent dark:text-white outline-none"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">6 Months</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase w-10">#</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-400 uppercase">Product</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-400 uppercase text-center">Margin</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-400 uppercase text-right">Qty</th>
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {topProducts.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="px-4 py-3 text-[10px] font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-3">
                      <p className="text-[11px] font-bold text-gray-800 dark:text-white truncate max-w-[150px]">{product.name}</p>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn(
                        "text-[10px] font-medium",
                        product.unitMargin > 0 ? "text-green-600" : "text-gray-500"
                      )}>
                        {product.unitMargin > 0 ? `+₹${product.unitMargin.toFixed(0)}` : `₹${product.unitMargin.toFixed(0)}`}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-[10px] text-gray-500">{product.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white">₹{product.revenue.toLocaleString()}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="text-xs">No sales data found</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alert List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-[400px] overflow-hidden">
          <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 z-20 shrink-0">
            <h3 className="text-[12px] font-bold font-serif text-gray-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
              <AlertTriangle size={16} className="text-red-500" />
              Low Stock Alert
            </h3>
            <button 
              onClick={() => navigate('/products?filter=low-stock')}
              className="text-[10px] font-bold text-blue-600 hover:underline"
            >
              View All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase">Product</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-400 uppercase text-center">In Stock</th>
                  <th className="px-2 py-2 text-[9px] font-bold text-gray-400 uppercase text-center">Min Level</th>
                  <th className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {lowStockItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate max-w-[180px]">{item.name}</p>
                      <p className="text-[8px] text-gray-500 uppercase tracking-widest">{item.unit}</p>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-bold",
                        item.quantity <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-[10px] text-gray-500 font-medium">{item.minStockLevel || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => navigate(`/purchase/new?productId=${item.productId}`)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold rounded hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lowStockItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ShoppingBag size={32} className="mb-2 opacity-20" />
                <p className="text-xs">Inventory is healthy</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {previewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="text-blue-500" />
                  {previewSale.type === 'invoice' ? 'Tax Invoice' : 'Estimate'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Ref: {previewSale.billNumber || previewSale.id}</p>
              </div>
              <button 
                onClick={() => setPreviewSale(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{previewSale.customerName}</p>
                  {customers.find(c => c.id === previewSale.customerId)?.billingAddress && (
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                      {customers.find(c => c.id === previewSale.customerId)?.billingAddress}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Transaction Details</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date: <span className="font-bold text-gray-900 dark:text-white">{format(new Date(previewSale.date), 'dd MMM yyyy')}</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Status: 
                    <span className={cn(
                      "ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      previewSale.status === 'paid' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {previewSale.status === 'paid' ? 'PAID' : 'UNPAID'}
                    </span>
                  </p>
                </div>
              </div>

              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase">Item Description</th>
                    <th className="text-right py-3 text-xs font-bold text-gray-400 uppercase">Qty</th>
                    <th className="text-right py-3 text-xs font-bold text-gray-400 uppercase">Price</th>
                    <th className="text-right py-3 text-xs font-bold text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {previewSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-500">Unit: {item.unit}</p>
                      </td>
                      <td className="py-4 text-right text-sm text-gray-700 dark:text-gray-300">{item.quantity}</td>
                      <td className="py-4 text-right text-sm text-gray-700 dark:text-gray-300">{item.price.toFixed(2)}</td>
                      <td className="py-4 text-right text-sm font-bold text-gray-900 dark:text-white">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">{previewSale.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Package & Loader</span>
                    <span className="font-medium text-gray-900 dark:text-white">{previewSale.packageLoaderAmt.toFixed(2)}</span>
                  </div>
                  {previewSale.roundOff !== 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Round Off</span>
                      <span className="font-medium text-gray-900 dark:text-white">{previewSale.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span>Grand Total</span>
                    <span className="text-blue-600">Rs. {previewSale.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button 
                onClick={() => {
                  navigate(`/sales?id=${previewSale.id}&type=${previewSale.type}`);
                  setPreviewSale(null);
                }}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 text-sm"
              >
                <Edit2 size={18} />
                Edit Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
