import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, History, Download } from "lucide-react";
import { db, Expense } from "../lib/db";
import { formatDate, cn } from "../lib/utils";
import { useTableKeyNav } from "../hooks/useTableKeyNav";
import { toast } from "react-hot-toast";

export default function Expenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; expenseNo: string }>({ isOpen: false, id: '', expenseNo: '' });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const allExpenses = await db.getExpenses();
      const activeExpenses = allExpenses.filter(e => !e.isDeleted);
      const sorted = [...activeExpenses].sort((a, b) => {
        const rawA = a.createdAt || a.date || '';
        const rawB = b.createdAt || b.date || '';
        const dateA = new Date(rawA).setHours(0,0,0,0);
        const dateB = new Date(rawB).setHours(0,0,0,0);
        if (dateB !== dateA) return dateB - dateA;

        const timeA = new Date(rawA).getTime();
        const timeB = new Date(rawB).getTime();
        if (timeB !== timeA) return timeB - timeA;

        const numA = parseInt((a.expenseNo || '').replace(/\D/g, '') || '0');
        const numB = parseInt((b.expenseNo || '').replace(/\D/g, '') || '0');
        return numB - numA;
      });
      setExpenses(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const { id, expenseNo } = deleteModal;
    if (!id) return;
    try {
      await db.deleteExpense(id);
      setExpenses(prev => {
        const active = prev.filter(e => e.id !== id);
        return [...active].sort((a, b) => {
          const rawA = a.createdAt || a.date || '';
          const rawB = b.createdAt || b.date || '';
          const dateA = new Date(rawA).setHours(0,0,0,0);
          const dateB = new Date(rawB).setHours(0,0,0,0);
          if (dateB !== dateA) return dateB - dateA;

          const timeA = new Date(rawA).getTime();
          const timeB = new Date(rawB).getTime();
          if (timeB !== timeA) return timeB - timeA;

          const numA = parseInt((a.expenseNo || '').replace(/\D/g, '') || '0');
          const numB = parseInt((b.expenseNo || '').replace(/\D/g, '') || '0');
          return numB - numA;
        });
      });
      setDeleteModal({ isOpen: false, id: '', expenseNo: '' });
      toast.success(`Expense [${expenseNo}] moved to Recycle Bin`);
    } catch (err) {
      toast.error("Failed to delete expense");
    }
  };

  const filteredExpenses = expenses.filter(e => 
    String(e.expenseNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(e.category || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { selectedIndex } = useTableKeyNav({
    items: filteredExpenses,
    onEnter: (index) => navigate(`/expenses/edit/${filteredExpenses[index].id}`),
    onDelete: (index) => setDeleteModal({ isOpen: true, id: filteredExpenses[index].id, expenseNo: filteredExpenses[index].expenseNo })
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a9df4] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 ">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold font-sans text-[#2a9df4] uppercase tracking-tight">EXPENSE MANAGEMENT</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search category or expense no..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-[#2a9df4] dark:text-white transition-all"
            />
          </div>
          <button
            onClick={() => navigate("/expenses/new")}
            className="flex items-center gap-2 rounded-lg bg-[#2a9df4] px-4 py-2 text-[10pt] font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-600 uppercase tracking-widest whitespace-nowrap"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="w-full bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-[#ef4444] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Date</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Expense No</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400">Category</th>
              <th className="px-3 py-2 text-center text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Payment Type</th>
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Amount</th>
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#ef4444] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((expense, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <tr 
                    key={expense.id} 
                    data-row-index={idx}
                    className={cn(
                      "hover:bg-blue-50/50 transition-colors",
                      idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20 outline outline-1 outline-blue-300 z-10 relative"
                    )}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                      {formatDate(expense.date)}
                    </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                    {expense.expenseNo}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-center text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                    {expense.category}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-center text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      expense.paymentType === 'Cash' ? "text-green-600 bg-green-50" : "text-blue-600 bg-blue-50"
                    )}>
                      {expense.paymentType}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-black dark:text-white text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    {expense.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-500 border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => navigate(`/expenses/edit/${expense.id}`)}
                        className="text-blue-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteModal({ isOpen: true, id: expense.id, expenseNo: expense.expenseNo })}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all active:scale-90"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-[12px]">
                  No expense records found. Click + Add Expense to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {deleteModal.isOpen && (
        <ConfirmDeleteModal 
          title="Delete Expense"
          message={`Are you sure you want to delete Expense "${deleteModal.expenseNo}"? This action will move the record to the Recycle Bin.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal({ isOpen: false, id: '', expenseNo: '' })}
        />
      )}
    </div>
  );
}

function ConfirmDeleteModal({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
            <Trash2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-2">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
          
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 px-6 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg uppercase tracking-widest"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
