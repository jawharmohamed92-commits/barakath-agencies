import React, { useEffect, useState } from 'react';
import { db, Sale, Product, Customer, Inventory, Purchase, Expense, Reminder } from '../lib/db';
import { Trash2, RotateCcw, FileText, Package, Users, Search, AlertTriangle, Archive, Bell, ShoppingCart, Wallet } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';

type BinTab = 'sales' | 'products' | 'customers' | 'purchases' | 'expenses' | 'reminders';

export default function RecycleBin() {
  const [activeTab, setActiveTab] = useState<BinTab>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: BinTab, id: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [s, p, c, allP, pur, exp, rem] = await Promise.all([
      db.getSales(),
      db.getProducts(),
      db.getCustomers(),
      db.getProducts(),
      db.getPurchases(),
      db.getExpenses(),
      db.getReminders()
    ]);
    
    setSales(s.filter(item => item.isDeleted));
    setProducts(p.filter(item => item.isDeleted));
    setCustomers(c.filter(item => item.isDeleted));
    setPurchases(pur.filter(item => item.isDeleted));
    setExpenses(exp.filter(item => item.isDeleted));
    setReminders(rem.filter(item => item.isDeleted));
    setAllProducts(allP);
  };

  const handleRestore = async (type: BinTab, id: string) => {
    try {
      if (type === 'sales') {
        await db.restoreSale(id);
      } else if (type === 'products') {
        await db.restoreProduct(id);
      } else if (type === 'customers') {
        await db.restoreCustomer(id);
      } else if (type === 'reminders') {
        await db.restoreReminder(id);
      } else if (type === 'purchases') {
        await db.restorePurchase(id);
      } else if (type === 'expenses') {
        await db.restoreExpense(id);
      }
      loadData();
    } catch (error) {
      console.error('Error restoring item:', error);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const { type, id } = confirmDelete;
      if (type === 'sales') {
        await db.permanentDeleteSale(id);
      } else if (type === 'products') {
        await db.permanentDeleteProduct(id);
      } else if (type === 'customers') {
        await db.permanentDeleteCustomer(id);
      } else if (type === 'reminders') {
        await db.permanentDeleteReminder(id);
      } else if (type === 'purchases') {
        await db.permanentDeletePurchase(id);
      } else if (type === 'expenses') {
        await db.permanentDeleteExpense(id);
      }
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      console.error('Error permanently deleting item:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: 'sales', name: 'Sales', icon: ShoppingCart, color: 'text-blue-600', border: 'border-blue-600' },
    { id: 'products', name: 'Products', icon: Package, color: 'text-sky-600', border: 'border-sky-600' },
    { id: 'customers', name: 'Customers', icon: Users, color: 'text-purple-600', border: 'border-purple-600' },
    { id: 'purchases', name: 'Purchases', icon: Wallet, color: 'text-amber-600', border: 'border-amber-600' },
    { id: 'expenses', name: 'Expenses', icon: Archive, color: 'text-red-600', border: 'border-red-600' },
    { id: 'reminders', name: 'Reminders', icon: Bell, color: 'text-pink-600', border: 'border-pink-600' },
  ];

  const getFilteredData = () => {
    switch (activeTab) {
      case 'sales':
        return sales.filter(s => String(s.id || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(s.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()));
      case 'products':
        return products.filter(p => String(p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(p.sku || "").toLowerCase().includes(searchTerm.toLowerCase()));
      case 'customers':
        return customers.filter(c => String(c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(c.phone || "").includes(searchTerm));
      case 'purchases':
        return purchases.filter(p => String(p.billNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(p.vendorName || "").toLowerCase().includes(searchTerm.toLowerCase()));
      case 'expenses':
        return expenses.filter(e => String(e.expenseNo || "").toLowerCase().includes(searchTerm.toLowerCase()) || String(e.category || "").toLowerCase().includes(searchTerm.toLowerCase()));
      case 'reminders':
        return reminders.filter(r => String(r.title || "").toLowerCase().includes(searchTerm.toLowerCase()));
      default:
        return [];
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Trash2 className="text-red-500" /> Recycle Bin
        </h2>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search deleted items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BinTab)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-[12px] font-bold uppercase tracking-widest transition-all relative whitespace-nowrap",
                activeTab === tab.id
                  ? cn(tab.color, "border-b-2", tab.border)
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              <Icon size={16} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full border-collapse">
          <thead className={cn(
            "border-b-[0.5px] border-gray-400 sticky top-0 z-10",
            activeTab === 'sales' ? 'bg-[#9ff270] dark:bg-green-900 text-black dark:text-white' : 
            activeTab === 'products' ? 'bg-[#a3caf9] dark:bg-blue-900 text-black dark:text-white' :
            activeTab === 'customers' ? 'bg-[#ec4af4] dark:bg-purple-900 text-black dark:text-white' :
            activeTab === 'purchases' ? 'bg-[#f59e0b] dark:bg-amber-900 text-black dark:text-white' :
            activeTab === 'expenses' ? 'bg-[#ef4444] dark:bg-red-900 text-black dark:text-white' :
            'bg-[#fb7185] dark:bg-rose-900 text-black dark:text-white'
          )}>
            <tr>
              <th className="px-6 py-4 text-left text-[12px] font-bold font-serif uppercase tracking-tight border-[0.5px] border-gray-400 font-serif">
                {activeTab === 'sales' ? 'Bill No / Customer' : 
                 activeTab === 'products' ? 'Product Name / SKU' : 
                 activeTab === 'purchases' ? 'Bill No / Party' : 
                 activeTab === 'expenses' ? 'Expense No / Category' :
                 activeTab === 'reminders' ? 'Reminder Title' : 
                 'Customer Name'}
              </th>
              
              {(activeTab === 'products' || activeTab === 'customers' || activeTab === 'reminders') && (
                <th className="px-6 py-4 text-left text-[12px] font-bold font-serif uppercase tracking-tight border-[0.5px] border-gray-400 font-serif">
                  {activeTab === 'products' ? 'Category' : activeTab === 'customers' ? 'Group' : 'Due Date'}
                </th>
              )}

              <th className="px-6 py-4 text-left text-[12px] font-bold font-serif uppercase tracking-tight border-[0.5px] border-gray-400 w-48 whitespace-nowrap font-serif">Date Deleted</th>
              
              {(activeTab === 'sales' || activeTab === 'purchases' || activeTab === 'expenses') && (
                <th className="px-6 py-4 text-right text-[12px] font-bold font-serif uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap font-serif">
                  BILL AMOUNT
                </th>
              )}
              
              <th className="px-6 py-4 text-right text-[12px] font-bold font-serif uppercase tracking-tight border-[0.5px] border-gray-400 w-40 whitespace-nowrap font-serif">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredData.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors h-[50px]">
                <td className="px-6 py-2 border-[0.5px] border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {activeTab === 'sales' ? item.id : 
                     activeTab === 'products' ? item.name : 
                     activeTab === 'reminders' ? item.title : 
                     activeTab === 'purchases' ? item.billNumber :
                     activeTab === 'expenses' ? item.expenseNo :
                     item.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activeTab === 'sales' ? item.customerName : 
                     activeTab === 'products' ? `SKU: ${item.sku}` : 
                     activeTab === 'purchases' ? item.vendorName : 
                     activeTab === 'expenses' ? item.category :
                     activeTab === 'reminders' ? item.category : 
                     `Ref: ${item.phone || item.id}`}
                  </div>
                </td>

                {(activeTab === 'products' || activeTab === 'customers' || activeTab === 'reminders') && (
                  <td className="px-6 py-2 border-[0.5px] border-gray-100 dark:border-gray-800 text-sm">
                    {activeTab === 'products' ? item.category : 
                     activeTab === 'customers' ? (item as any).type || 'General' : 
                     item.date ? formatDate(new Date(item.date)) : 'No Date'}
                  </td>
                )}

                <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 border-[0.5px] border-gray-100 dark:border-gray-800">
                  {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'N/A'}
                </td>

                {(activeTab === 'sales' || activeTab === 'purchases' || activeTab === 'expenses') && (
                  <td className="px-6 py-2 text-right text-sm font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                    ₹{(item.total || 0).toLocaleString()}
                  </td>
                )}

                <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium border-[0.5px] border-gray-100 dark:border-gray-800">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleRestore(activeTab, item.id)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      title="Restore"
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: activeTab, id: item.id })}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete Permanently"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center text-gray-400">
                    <Trash2 size={48} className="mb-2 opacity-20" />
                    <p className="text-sm">No items in Recycle Bin for {activeTab}.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Permanent Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Permanently?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  This action is irreversible. The data will be removed from the database forever.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  disabled={isDeleting}
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={handlePermanentDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
