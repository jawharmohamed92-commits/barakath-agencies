import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Search, 
  X,
  AlertCircle
} from "lucide-react";
import { db, Expense, ExpenseCategory, ExpenseItem } from "../lib/db";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";

export default function AddExpense() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryIdx, setCategoryIdx] = useState(0);

  const [expenseNo, setExpenseNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ExpenseItem[]>([
    { description: "", quantity: 1, price: 0, total: 0 }
  ]);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Credit' | 'Bank Transfer'>('Cash');
  const [useSmartRounding, setUseSmartRounding] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const expenseNoRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const categorySearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    const cats = await db.getExpenseCategories();
    setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));

    if (isEditing) {
      const expense = await db.getExpense(id!);
      if (expense) {
        setExpenseNo(expense.expenseNo);
        setDate(expense.date);
        setItems(expense.items);
        setPaymentType(expense.paymentType);
        setCategorySearch(expense.category);
        const cat = cats.find(c => c.name === expense.category);
        if (cat) setSelectedCategory({ id: cat.id, name: cat.name });
        // Handle smart rounding detection loosely
        const fractional = expense.subtotal % 1;
        setUseSmartRounding(expense.roundOff !== 0);
      }
    } else {
      const nextNo = await db.getNextReferenceNumber('expense');
      setExpenseNo(nextNo);
    }
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, price: 0, total: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) {
      setItems([{ description: "", quantity: 1, price: 0, total: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ExpenseItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[idx] };
    
    if (field === 'description') item.description = value;
    if (field === 'quantity') item.quantity = parseFloat(value) || 0;
    if (field === 'price') item.price = parseFloat(value) || 0;
    
    item.total = item.quantity * item.price;
    newItems[idx] = item;
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const fractionalPart = subtotal % 1;
  const roundOff = useSmartRounding 
    ? (fractionalPart === 0 ? 0 : (fractionalPart < 0.5 ? -fractionalPart : 1 - fractionalPart))
    : 0;
  const totalAmount = subtotal + roundOff;

  const handleSave = async () => {
    if (!categorySearch.trim()) {
      toast.error("Please select or enter an expense category");
      categorySearchRef.current?.focus();
      return;
    }
    if (items.some(i => !i.description.trim())) {
      toast.error("Please provide description for all items");
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseData: Omit<Expense, 'id'> = {
        category: categorySearch.trim(),
        categoryId: selectedCategory?.id,
        expenseNo,
        date,
        items,
        subtotal,
        roundOff,
        total: totalAmount,
        paymentType,
        status: paymentType === 'Credit' ? 'unpaid' : 'paid',
        remainingBalance: paymentType === 'Credit' ? totalAmount : 0,
        createdAt: new Date().toISOString(),
      };

      if (isEditing) {
        await db.updateExpense({ ...expenseData, id } as Expense);
        toast.success("Expense updated successfully");
      } else {
        await db.addExpense(expenseData);
        toast.success("Expense saved successfully");
      }
      navigate("/expenses");
    } catch (err) {
      toast.error("Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const catId = await db.addExpenseCategory({ name: newCategoryName.trim() });
      const cats = await db.getExpenseCategories();
      setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
      
      // Auto-select the newly created category
      setSelectedCategory({ id: catId, name: newCategoryName.trim() });
      setCategorySearch(newCategoryName.trim());
      
      setShowQuickAddCategory(false);
      setNewCategoryName("");
      toast.success("Category added and selected");
    } catch (err) {
      toast.error("Failed to add category");
    }
  };

  const filteredCategories = categories.filter(c => 
    String(c.name || "").toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, colKey: string) => {
    const colOrder = ['description', 'quantity', 'price'];
    const currentIdx = colOrder.indexOf(colKey);

    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIdx < colOrder.length - 1) {
        const nextCol = colOrder[currentIdx + 1];
        const nextElem = document.querySelector(`[data-row="${rowIndex}"][data-col="${nextCol}"]`) as HTMLElement;
        nextElem?.focus();
      } else {
        if (rowIndex === items.length - 1) {
          addItem();
          setTimeout(() => {
            const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="description"]`) as HTMLElement;
            nextRowElem?.focus();
          }, 30);
        } else {
          const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="description"]`) as HTMLElement;
          nextRowElem?.focus();
        }
      }
    } else if (e.key === 'ArrowDown' && rowIndex < items.length - 1) {
      const nextElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${colKey}"]`) as HTMLElement;
      nextElem?.focus();
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      const nextElem = document.querySelector(`[data-row="${rowIndex - 1}"][data-col="${colKey}"]`) as HTMLElement;
      nextElem?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/expenses")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-[#2a9df4] uppercase tracking-tight">
            {isEditing ? 'EDIT EXPENSE' : 'ADD NEW EXPENSE'}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Expense No</label>
          <input 
            ref={expenseNoRef}
            type="text"
            value={expenseNo}
            onChange={e => setExpenseNo(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#2a9df4] outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date</label>
          <input 
            ref={dateRef}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#2a9df4] outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 relative">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Expense Category</label>
            <button 
              onClick={() => setShowQuickAddCategory(true)}
              className="text-[10px] font-bold text-[#2a9df4] hover:underline uppercase"
            >
              + ADD CATEGORY
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-left text-sm font-bold focus:border-[#2a9df4] outline-none capitalize flex items-center justify-between"
            >
              <span className={cn(categorySearch ? "text-gray-900 dark:text-white" : "text-gray-400")}>
                {categorySearch || "Select Category"}
              </span>
              <Search size={16} className="text-gray-400" />
            </button>
            
            {showCategoryDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-auto">
                <div className="p-2 border-b border-gray-50 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                  <input 
                    type="text"
                    placeholder="Search categories..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-100 rounded-lg outline-none focus:border-blue-400"
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                </div>
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((c, i) => (
                    <div 
                      key={c.id}
                      onClick={() => {
                        setSelectedCategory({ id: c.id, name: c.name });
                        setCategorySearch(c.name);
                        setShowCategoryDropdown(false);
                      }}
                      className={cn(
                        "px-4 py-2 cursor-pointer transition-colors text-sm font-bold capitalize",
                        categorySearch === c.name ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                    >
                      {c.name}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-gray-500 italic">No categories found.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl mb-6">
        <div className="h-full overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#ef4444] sticky top-0 z-10 border-b-[0.5px] border-gray-400">
              <tr>
                <th className="px-4 py-2 text-left text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400">EXPENSE ITEM</th>
                <th className="px-4 py-2 text-center text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-24">QTY</th>
                <th className="px-4 py-2 text-right text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-32">PRICE/UNIT</th>
                <th className="px-4 py-2 text-right text-[12px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-32">AMOUNT</th>
                <th className="px-4 py-2 text-center w-16 border-[0.5px] border-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 h-[30px]">
                  <td className="px-4 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                    <input 
                      data-row={idx} data-col="description"
                      type="text"
                      placeholder="Enter item description..."
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      onKeyDown={e => handleGridKeyDown(e, idx, 'description')}
                      className="w-full bg-transparent text-[12px] font-medium border-none focus:ring-0 p-0 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                    />
                  </td>
                  <td className="px-4 py-1 text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                    <input 
                      data-row={idx} data-col="quantity"
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      onKeyDown={e => handleGridKeyDown(e, idx, 'quantity')}
                      className="w-20 bg-transparent text-[12px] text-center font-bold border-none focus:ring-0 p-0 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                    />
                  </td>
                  <td className="px-4 py-1 text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    <input 
                      data-row={idx} data-col="price"
                      type="number"
                      value={item.price}
                      onChange={e => updateItem(idx, 'price', e.target.value)}
                      onKeyDown={e => handleGridKeyDown(e, idx, 'price')}
                      className="w-28 bg-transparent text-[12px] text-right font-bold border-none focus:ring-0 p-0 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                    />
                  </td>
                  <td className="px-4 py-1 text-right text-[12px] font-bold text-gray-900 dark:text-white border-[0.5px] border-gray-100 dark:border-gray-800">
                    {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-1 text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                    <button 
                      onClick={() => removeItem(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button 
            onClick={addItem}
            className="flex items-center gap-1 px-4 py-3 text-xs font-bold text-[#2a9df4] hover:bg-blue-50 transition-colors w-full uppercase"
          >
            <Plus size={14} /> Add Row (Enter)
          </button>
        </div>
      </div>

      {/* Compact Footer */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-6 mt-auto">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment:</span>
            <div className="flex gap-1">
              {['Cash', 'Credit', 'Bank Transfer'].map((type) => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase",
                    paymentType === type 
                      ? "bg-[#2a9df4] text-white shadow-md shadow-blue-500/10" 
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-200"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox"
              checked={useSmartRounding}
              onChange={e => setUseSmartRounding(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#2a9df4] focus:ring-[#2a9df4]"
            />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-[#2a9df4] transition-colors">Smart Round Off</span>
          </label>
        </div>

        <div className="flex items-center gap-8 ml-auto">
          <div className="text-right">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Amount</div>
            <div className="text-2xl font-semibold text-[#2a9df4] leading-none">
              Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            {roundOff !== 0 && (
              <div className="text-[9px] text-gray-400 italic mt-1">
                (Round off: {roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)})
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/expenses")}
              className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all uppercase text-[10px] tracking-widest"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              onClick={handleSave}
              className="bg-[#2a9df4] hover:bg-blue-600 text-white px-10 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Category Modal */}
      {showQuickAddCategory && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl">
                    <Plus className="text-[#2a9df4]" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Category</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold">Expense Classification</p>
                  </div>
                </div>
                <button onClick={() => setShowQuickAddCategory(false)} className="text-gray-400 hover:text-red-500">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Category Name</label>
                  <input 
                    autoFocus
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Petrol, Snacks, Rent"
                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-[#2a9df4] focus:bg-white rounded-2xl px-6 py-4 text-sm font-bold text-gray-900 dark:text-white transition-all outline-none"
                  />
                </div>
                <button 
                  onClick={handleQuickAddCategory}
                  className="w-full py-4 bg-[#2a9df4] text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-[0.98] mt-4 uppercase tracking-widest text-sm"
                >
                  Create Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
