import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X, Search, AlertTriangle, FileUp, Package, ArrowLeft, UserPlus, CheckCircle, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { db, Purchase, Customer, Product, Inventory, PurchaseItem } from '../lib/db';
import { cn, formatDate, getUnitAbbreviation } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'react-hot-toast';

interface PurchaseEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPurchase?: Purchase | null;
}

export default function PurchaseEntry({ isOpen, onClose, onSuccess, editingPurchase }: PurchaseEntryProps) {
  const { settings } = useSettings();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', phone: '', address: '' });

  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productIdx, setProductIdx] = useState(0);
  const [supplierIdx, setSupplierIdx] = useState(0);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryIdx, setCategoryIdx] = useState(0);

  // Reset indices when searches change
  useEffect(() => {
    setProductIdx(0);
  }, [productSearch]);

  useEffect(() => {
    setCategoryIdx(0);
  }, [categorySearch]);

  useEffect(() => {
    setSupplierIdx(0);
  }, [supplierSearch]);

  const [paymentType, setPaymentType] = useState<'Cash' | 'Credit' | null>(null);
  const [billStatus, setBillStatus] = useState<'paid' | 'unpaid' | null>(null);
  const [useSmartRounding, setUseSmartRounding] = useState(true);
  const [freightCharges, setFreightCharges] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const supplierInputRef = useRef<HTMLInputElement>(null);
  const billNoInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = [['CATEGORY', 'PRODUCT SEARCH', 'QTY', 'UNIT PRICE (BASE PRICE)', 'DISC (%)', 'TAX (%)', 'TOTAL']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // Add sample row: Total = (Qty * Price) * (1 - Disc%) * (1 + Tax%)
    // Row 2: B2 is PRODUCT SEARCH, C2 is QTY, D2 is PRICE
    const sampleRow = ['BICOLEX', 'Wheel Bearing (PRD-101)', 10, 500, 5, 18, ''];
    XLSX.utils.sheet_add_aoa(ws, [sampleRow], { origin: 'A2' });

    // Set formula for TOTAL column (Column G is index 6)
    // Formula: (Qty * Price) * (1 - Disc/100) * (1 + Tax/100)
    // In template: C2 is QTY, D2 is PRICE, E2 is DISC, F2 is TAX
    if (ws['G2']) {
      ws['G2'].f = '(C2*D2)*(1-E2/100)*(1+F2/100)';
    }

    XLSX.utils.book_append_sheet(wb, ws, "Purchase_Template");
    XLSX.writeFile(wb, "Purchase_Entry_Template.xlsx");
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use header: 1 to get raw arrays and ensure we don't skip the first data row
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length < 2) {
          toast.error("No data found in the Excel file.");
          return;
        }

        // Map column names to indices
        const headerRow = rows[0].map(h => (h || "").toString().trim().toUpperCase());
        const getIdx = (name: string) => headerRow.indexOf(name);

        const colIdx = {
          category: getIdx('CATEGORY'),
          productSearch: getIdx('PRODUCT SEARCH'),
          search: getIdx('SEARCH'),
          qty: getIdx('QTY'),
          price: getIdx('UNIT PRICE (BASE PRICE)'),
          disc: getIdx('DISC (%)'),
          tax: getIdx('TAX (%)')
        };

        const newItems: PurchaseItem[] = [];
        const allProducts = await db.getProducts();

        // Process data rows starting from Index 1 (first row after headers)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const searchVal = (row[colIdx.productSearch] || row[colIdx.search] || '').toString().trim();
          const excelCategory = (row[colIdx.category] || '').toString().trim();
          
          const qty = parseFloat(row[colIdx.qty]) || 0;
          const price = parseFloat(row[colIdx.price]) || 0;
          const disc = parseFloat(row[colIdx.disc]) || 0;
          const tax = parseFloat(row[colIdx.tax]) || 0;

          if (!searchVal && !excelCategory) continue;

          // Match by SEARCH: Primary Check (Item Code/SKU), followed by Secondary Check (Product Name)
          let p = allProducts.find(prod => (prod.sku?.toString() || "").toLowerCase() === searchVal.toLowerCase());
          if (!p) {
            p = allProducts.find(prod => (prod.name?.toString() || "").toLowerCase() === searchVal.toLowerCase());
          }

          if (p) {
            // Update product's category if Item Code (SEARCH) matched
            if (excelCategory && excelCategory !== p.category) {
              const updatedProduct = { ...p, category: excelCategory };
              await db.addProduct(updatedProduct);
              p = updatedProduct; // Update local ref
            }

            const subtotal = qty * price;
            const discountAmount = (subtotal * disc) / 100;
            const taxableAmount = subtotal - discountAmount;
            const taxAmount = (taxableAmount * tax) / 100;
            const total = taxableAmount + taxAmount;

            newItems.push({
              productId: p.id,
              name: p.name,
              category: p.category || 'GENERAL',
              quantity: qty,
              unit: p.baseUnit || 'PCS',
              price: price,
              discount: disc,
              tax: tax,
              total: total
            });
          }
        }

        if (newItems.length > 0) {
          setCart(prev => {
            const baseCart = prev.filter(item => item.productId);
            return [...baseCart, ...newItems];
          });
          toast.success(`Successfully imported ${newItems.length} items.`);
        } else {
          toast.error("Could not match any products from Excel. Please check SEARCH or PRODUCT name.");
        }
      } catch (err) {
        console.error("Import error:", err);
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (editingPurchase) {
        setBillNumber(editingPurchase.billNumber);
        setBillDate(editingPurchase.billDate);
        setSelectedSupplier(editingPurchase.vendorId);
        setSupplierSearch(editingPurchase.vendorName);
        setCart(editingPurchase.items);
        setPaymentType(editingPurchase.paymentType);
        setBillStatus(editingPurchase.status === 'paid' ? 'paid' : 'unpaid');
        setFreightCharges((editingPurchase.freight_charges ?? 0).toString());
      } else {
        setBillNumber('');
        setBillDate(new Date().toISOString().split('T')[0]);
        setSelectedSupplier('');
        setSupplierSearch('');
        setCart([{ 
          productId: '', 
          name: '', 
          category: '',
          quantity: 1, 
          unit: 'Nos', 
          price: 0, 
          discount: 0, 
          tax: 0, 
          total: 0 
        }]);
        setActiveItemIndex(0);
        setPaymentType(null);
        setBillStatus(null);
        setFreightCharges('0');
      }
      
      // Explicit focus on Bill No
      setTimeout(() => {
        billNoInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, editingPurchase]);

  const loadData = async () => {
    const [allCustomers, allProducts, allInv] = await Promise.all([
      db.getCustomers(),
      db.getProducts(),
      db.getInventory()
    ]);
    setSuppliers(allCustomers.filter(c => !c.isDeleted && c.groupId === 'vendor'));
    setProducts(allProducts.filter(p => !p.isDeleted));
    setInventory(allInv);
  };

  const filteredSuppliers = suppliers.filter(v => 
    String(v.name || "").toLowerCase().includes(supplierSearch.toLowerCase()) || 
    String(v.phone || "").includes(supplierSearch)
  ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const filteredProducts = products.filter(p => {
    const matchesSearch = String(p.name || "").toLowerCase().includes(productSearch.toLowerCase()) || String(p.sku || "").toLowerCase().includes(productSearch.toLowerCase());
    const currentRowCategory = activeItemIndex !== null ? cart[activeItemIndex]?.category : '';
    const matchesCategory = currentRowCategory ? p.category === currentRowCategory : true;
    return matchesSearch && matchesCategory;
  });

  const addItem = () => {
    setCart([...cart, { 
      productId: '', 
      name: '', 
      category: '',
      quantity: 1, 
      unit: 'Nos', 
      price: 0, 
      discount: 0, 
      tax: 0, 
      total: 0 
    }]);
    setActiveItemIndex(cart.length);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newCart = [...cart];
    const item = { ...newCart[index] };
    
    if (field === 'productId') {
      const p = products.find(prod => prod.id === value);
      if (p) {
        item.productId = p.id;
        item.name = p.name;
        item.category = p.category;
        item.price = p.purchasePrice || 0;
        item.unit = p.baseUnit || 'Nos';
        item.tax = p.tax || 0;
        (item as any).isNew = false;

        // Sync search states if editing active row
        if (activeItemIndex === index) {
          setProductSearch(p.name);
          setCategorySearch(p.category || '');
        }
      }
    } else if (field === 'category') {
      item.category = value;
      if (activeItemIndex === index) {
        setCategorySearch(value);
      }
    } else if (field === 'unit') {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        item.unit = value;
        // If switching to secondary unit, update price automatically
        if (value === p.secondaryUnit && p.conversionRate) {
          item.price = (p.purchasePrice || 0) * p.conversionRate;
        } else {
          item.price = p.purchasePrice || 0;
        }
      } else {
        item.unit = value;
      }
    } else {
      (item as any)[field] = value;
    }

    const qty = parseFloat(item.quantity?.toString()) || 0;
    const price = parseFloat(item.price?.toString()) || 0;
    const disc = parseFloat(item.discount?.toString()) || 0;
    const tax = parseFloat(item.tax?.toString()) || 0;
    
    const baseTotal = qty * price;
    const afterDisc = baseTotal - (baseTotal * (disc / 100));
    item.total = afterDisc + (afterDisc * (tax / 100));
    
    newCart[index] = item;
    setCart(newCart);
  };

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
    if (activeItemIndex === idx) setActiveItemIndex(null);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const fractionalPart = subtotal % 1;
  const roundOff = useSmartRounding 
    ? (fractionalPart === 0 ? 0 : (fractionalPart < 0.5 ? -fractionalPart : 1 - fractionalPart))
    : 0;
  const freightAmt = parseFloat(freightCharges) || 0;
  const totalAmount = subtotal + freightAmt;

  const handleSave = async () => {
    setError(null);

    // 1. Bill Number Validation
    if (!billNumber || billNumber.trim() === '') {
      setError("Bill Number is empty or ungenerated. Please check and enter a valid Bill Number.");
      toast.error("Validation error: Bill Number is required!");
      return;
    }

    // 2. Date Validation
    if (!billDate || billDate.trim() === '') {
      setError("Please select a valid calendar date.");
      toast.error("Validation error: Date is required!");
      return;
    }

    // 3. Supplier/Vendor Selection Validation
    if (!selectedSupplier) {
      setError("Please select a vendor/supplier account.");
      toast.error("Validation error: Supplier/Vendor is required!");
      return;
    }

    // 4. Bill Status Validation
    if (!billStatus || (billStatus !== 'paid' && billStatus !== 'unpaid')) {
      setError("Please select a Bill Status (Paid or Unpaid). Unmarked status is not allowed.");
      toast.error("Validation error: Bill Status is required!");
      return;
    }

    // 5. Purchase Type Validation
    if (!paymentType || (paymentType !== 'Cash' && paymentType !== 'Credit')) {
      setError("Please select exactly one Purchase Type (Counter Purchase or Credit Purchase). Unmarked purchase type is not allowed.");
      toast.error("Validation error: Purchase Type is required!");
      return;
    }

    // 6. Cart Validation
    if (cart.length === 0 || cart.every(i => !i.productId)) {
      setError("Cart is empty. Please add at least one item.");
      toast.error("Please add at least one item");
      return;
    }

    try {
      const supplier = suppliers.find(v => v.id === selectedSupplier);
      if (!supplier) return;

      const purchaseData: Purchase = {
        id: editingPurchase?.id || crypto.randomUUID(),
        vendorId: selectedSupplier,
        vendorName: supplier.name,
        billNumber,
        billDate,
        items: cart.filter(i => i.productId),
        subtotal,
        roundOff,
        total: totalAmount,
        freight_charges: freightAmt,
        grand_total: totalAmount,
        paymentType: paymentType,
        status: billStatus,
        remainingBalance: billStatus === 'unpaid' ? totalAmount : 0,
        createdAt: editingPurchase?.createdAt || new Date().toISOString()
      };

      await db.addPurchase(purchaseData);

      toast.success("Purchase saved successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to save purchase");
    }
  };

  const generatePDF = (purchase: Purchase) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(42, 157, 244);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.shopName || 'BARAKATH AGENCIES', 15, 15);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE INVOICE', 15, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`Supplier: ${purchase.vendorName}`, 15, 42);
    doc.text(`Bill No: ${purchase.billNumber}`, 15, 49);
    doc.text(`Date: ${formatDate(purchase.billDate)}`, pageWidth - 15, 42, { align: 'right' });

    const head = [['Item', 'Qty', 'Unit', 'Price', 'Disc%', 'Tax%', 'Total']];
    const body = purchase.items.map(item => [
      item.name,
      item.quantity.toString(),
      getUnitAbbreviation(item.unit),
      item.price.toFixed(2),
      `${item.discount}%`,
      `${item.tax}%`,
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 55,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 244] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: Rs. ${purchase.subtotal.toFixed(2)}`, pageWidth - 15, finalY, { align: 'right' });
    doc.text(`Round Off: Rs. ${purchase.roundOff.toFixed(2)}`, pageWidth - 15, finalY + 7, { align: 'right' });
    doc.setFontSize(14);
    doc.setTextColor(42, 157, 244);
    doc.text(`Total Amount: Rs. ${purchase.total.toFixed(2)}`, pageWidth - 15, finalY + 15, { align: 'right' });

    const fileName = `Purchase_${purchase.vendorName.replace(/\s+/g, '_')}_${purchase.billNumber}_${purchase.billDate}.pdf`;
    doc.save(fileName);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, colKey: string) => {
    const colOrder = ['category', 'product', 'quantity', 'unit', 'price', 'discount', 'tax'];
    const currentIdx = colOrder.indexOf(colKey);

    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIdx < colOrder.length - 1) {
        const nextCol = colOrder[currentIdx + 1];
        setTimeout(() => {
          const nextElem = document.querySelector(`[data-row="${rowIndex}"][data-col="${nextCol}"]`) as HTMLElement;
          nextElem?.focus();
          if (nextCol === 'product') {
            setActiveItemIndex(rowIndex);
            setProductSearch('');
          }
        }, 30);
      } else {
        if (rowIndex === cart.length - 1) {
          addItem();
          setTimeout(() => {
            const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="category"]`) as HTMLElement;
            nextRowElem?.focus();
          }, 100);
        } else {
          const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="category"]`) as HTMLElement;
          nextRowElem?.focus();
        }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const p = products.find(prod => prod.id === cart[rowIndex].productId);
      if (p && p.secondaryUnit && colKey === 'unit') {
        e.preventDefault();
        const nextUnit = cart[rowIndex].unit === p.baseUnit ? p.secondaryUnit : p.baseUnit;
        updateItem(rowIndex, 'unit', nextUnit);
      } else {
        if (e.key === 'ArrowDown' && rowIndex < cart.length - 1) {
          e.preventDefault();
          const nextElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${colKey}"]`) as HTMLElement;
          nextElem?.focus();
        } else if (e.key === 'ArrowUp' && rowIndex > 0) {
          e.preventDefault();
          const nextElem = document.querySelector(`[data-row="${rowIndex - 1}"][data-col="${colKey}"]`) as HTMLElement;
          nextElem?.focus();
        }
      }
    } else if (e.key === 'ArrowRight' && currentIdx < colOrder.length - 1) {
      e.preventDefault();
      const nextElem = document.querySelector(`[data-row="${rowIndex}"][data-col="${colOrder[currentIdx + 1]}"]`) as HTMLElement;
      nextElem?.focus();
    } else if (e.key === 'ArrowLeft' && currentIdx > 0) {
      e.preventDefault();
      const nextElem = document.querySelector(`[data-row="${rowIndex}"][data-col="${colOrder[currentIdx - 1]}"]`) as HTMLElement;
      nextElem?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col animate-in fade-in duration-200 overflow-hidden font-normal text-gray-900">
      {/* Condensed Header Section */}
      <div className="h-20 border-b border-gray-100 dark:border-gray-800 flex items-center px-6 bg-white dark:bg-gray-900 sticky top-0 z-20 gap-8">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 whitespace-nowrap">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-red-500">
            <ArrowLeft size={18} />
          </button>
          {editingPurchase ? 'Edit' : 'Add'} Purchase
        </h3>
        
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col gap-1">
            <span className="text-[10pt] font-bold text-gray-400">Bill No</span>
            <input 
              ref={billNoInputRef}
              autoFocus
              value={billNumber} 
              onChange={e => setBillNumber(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  dateInputRef.current?.focus();
                }
              }}
              placeholder="Entry No"
              className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 text-sm font-bold text-gray-900 dark:text-white focus:border-[#2a9df4] outline-none outline-0" 
              style={{ height: '12mm', width: '120px' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10pt] font-bold text-gray-400">Date</span>
            <input 
              ref={dateInputRef}
              type="date"
              value={billDate} 
              onChange={e => setBillDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  supplierInputRef.current?.focus();
                }
              }}
              className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 text-sm font-bold text-gray-900 dark:text-white focus:border-[#2a9df4] outline-none outline-0"
              style={{ height: '12mm', width: '160px' }}
            />
          </div>
          <div className="flex flex-col gap-1 relative" style={{ width: '320px' }}>
            <div className="flex justify-between items-center pr-2">
              <span className="text-[10pt] font-bold text-gray-400">Search Supplier</span>
              <button 
                onClick={() => setIsQuickAddOpen(true)}
                className="text-[10px] font-bold text-[#2a9df4] hover:underline uppercase tracking-widest"
              >
                + NEW SUPPLIER
              </button>
            </div>
            <div className="relative">
              <input 
                ref={supplierInputRef}
                type="text"
                placeholder="Type supplier name..."
                value={supplierSearch}
                onChange={e => {
                  setSupplierSearch(e.target.value);
                  setShowSupplierDropdown(true);
                  if (selectedSupplier) setSelectedSupplier('');
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                onKeyDown={e => {
                  if (showSupplierDropdown && filteredSuppliers.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSupplierIdx(prev => (prev < filteredSuppliers.length - 1 ? prev + 1 : prev));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSupplierIdx(prev => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const supplier = filteredSuppliers[supplierIdx];
                      if (supplier) {
                        setSelectedSupplier(supplier.id);
                        setSupplierSearch(supplier.name);
                        setShowSupplierDropdown(false);
                        if (cart.length === 0) addItem();
                        setTimeout(() => {
                          const firstRowCategory = document.querySelector('[data-row="0"][data-col="category"]') as HTMLElement;
                          firstRowCategory?.focus();
                        }, 50);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSupplierDropdown(false);
                    }
                  } else if (e.key === 'Enter' && selectedSupplier) {
                    e.preventDefault();
                    if (cart.length === 0) addItem();
                    setTimeout(() => {
                      const firstRowCategory = document.querySelector('[data-row="0"][data-col="category"]') as HTMLElement;
                      firstRowCategory?.focus();
                    }, 50);
                  }
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 pl-10 text-sm font-bold text-[#000000] dark:text-white focus:border-[#2a9df4] outline-none outline-0"
                style={{ height: '12mm' }}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              
              {showSupplierDropdown && supplierSearch.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                  {filteredSuppliers.map((v, idx) => (
                    <div 
                      key={v.id}
                      onClick={() => {
                        setSelectedSupplier(v.id);
                        setSupplierSearch(v.name);
                        setShowSupplierDropdown(false);
                        if (cart.length === 0) addItem();
                      }}
                      className={cn(
                        "px-6 py-2 cursor-pointer transition-colors",
                        idx === supplierIdx ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                    >
                      <div className="font-bold text-gray-900 dark:text-white">{v.name}</div>
                      <div className="text-xs text-gray-400">WhatsApp: {v.phone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleBulkImport}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all whitespace-nowrap"
          >
            <FileUp size={16} />
            Bulk Entry (Excel)
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors text-gray-400 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Validation Alert */}
      {error && (
        <div className="mx-6 my-2 px-4 py-3 bg-red-50 dark:bg-red-950/25 border-2 border-red-200 dark:border-red-900/40 rounded-lg flex items-start gap-2.5 text-red-700 dark:text-red-400 font-medium text-xs animate-in slide-in-from-top-2 whitespace-pre-line">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-bold uppercase tracking-wider mb-0.5">Validation Alert</div>
            <div>{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 font-bold self-start uppercase text-[9px] tracking-widest bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid Section */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 no-scrollbar">
        <table className="w-full border-collapse sticky top-0">
          <thead className="sticky top-0 z-10 bg-[#f59e0b] border-b-[1px] border-gray-400">
            <tr>
              <th className="px-3 py-3 text-left text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-48" style={{ fontFamily: 'Times New Roman' }}>CATEGORY</th>
              <th className="px-3 py-3 text-left text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400" style={{ fontFamily: 'Times New Roman' }}>PRODUCT SEARCH</th>
              <th className="px-3 py-3 text-right text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-24" style={{ fontFamily: 'Times New Roman' }}>QTY</th>
              <th className="px-3 py-3 text-center text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-28" style={{ fontFamily: 'Times New Roman' }}>UNIT</th>
              <th className="px-3 py-3 text-right text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-32" style={{ fontFamily: 'Times New Roman' }}>PRICE</th>
              <th className="px-3 py-3 text-right text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-28" style={{ fontFamily: 'Times New Roman' }}>DISC (%)</th>
              <th className="px-3 py-3 text-right text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-28" style={{ fontFamily: 'Times New Roman' }}>TAX (%)</th>
              <th className="px-3 py-3 text-right text-[14px] font-bold font-serif text-black uppercase tracking-tight border-[0.5px] border-gray-400 w-40" style={{ fontFamily: 'Times New Roman' }}>TOTAL</th>
              <th className="px-3 py-3 text-center w-16 border-[0.5px] border-gray-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cart.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors h-[30px]">
                <td className="px-3 py-1 relative border-[1px] border-gray-300 bg-orange-50/10 dark:bg-orange-900/5">
                  <input 
                    data-row={index} data-col="category"
                    type="text"
                    placeholder="Category..."
                    value={activeItemIndex === index ? categorySearch : (item.category || '')}
                    onChange={e => {
                      setCategorySearch(e.target.value);
                      setActiveItemIndex(index);
                      setShowCategoryDropdown(true);
                    }}
                    onFocus={() => {
                      setActiveItemIndex(index);
                      setCategorySearch(item.category || '');
                      setShowCategoryDropdown(false);
                      setProductSearch(''); // Ensure we aren't searching products
                    }}
                    onKeyDown={e => {
                      if (categorySearch.length > 0 || showCategoryDropdown) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowCategoryDropdown(true);
                          setCategoryIdx(prev => Math.min(prev + 1, Array.from(new Set(products.map(p => p.category))).length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setCategoryIdx(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const availableCats = Array.from(new Set(products.map(p => p.category))).filter(c => typeof c === 'string' && (c || "").toLowerCase().includes(categorySearch.toLowerCase())) as string[];
                          if (availableCats[categoryIdx]) {
                            const selectedCat = availableCats[categoryIdx];
                            updateItem(index, 'category', selectedCat);
                            setShowCategoryDropdown(false);
                            setCategorySearch(selectedCat);
                            setTimeout(() => {
                              const next = document.querySelector(`[data-row="${index}"][data-col="product"]`) as HTMLElement;
                              next?.focus();
                            }, 50);
                          }
                        } else if (e.key === 'Escape') {
                          setShowCategoryDropdown(false);
                          setCategorySearch(item.category || '');
                        }
                      } else {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowCategoryDropdown(true);
                        }
                        handleGridKeyDown(e, index, 'category');
                      }
                    }}
                    className="w-full bg-transparent text-[12px] font-normal text-black dark:text-white uppercase focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  />
                  {showCategoryDropdown && activeItemIndex === index && (
                    <div className="absolute z-30 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto left-0">
                      {Array.from(new Set(products.map(p => p.category)))
                        .filter(c => typeof c === 'string' && (c || "").toLowerCase().includes(categorySearch.toLowerCase()))
                        .map((cat, i) => (
                        <div 
                          key={cat as string}
                          onClick={() => {
                            const selectedCat = cat;
                            updateItem(index, 'category', selectedCat);
                            setShowCategoryDropdown(false);
                            setTimeout(() => {
                              const next = document.querySelector(`[data-row="${index}"][data-col="product"]`) as HTMLElement;
                              next?.focus();
                            }, 50);
                          }}
                          className={cn(
                            "px-6 py-2 cursor-pointer transition-colors text-[12px] font-bold uppercase",
                            i === categoryIdx ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1 relative border-[1px] border-gray-300 bg-white dark:bg-gray-800">
                  <input 
                    data-row={index} data-col="product"
                    type="text"
                    placeholder={item.productId ? "" : "Search product..."}
                    value={activeItemIndex === index ? productSearch : (item.name || '')}
                    autoComplete="off"
                    onChange={e => {
                      const val = e.target.value;
                      setProductSearch(val);
                      setActiveItemIndex(index);
                      if (val.length > 0) {
                        setShowProductDropdown(true);
                      } else {
                        setShowProductDropdown(false);
                      }
                    }}
                    onFocus={(e) => {
                      setActiveItemIndex(index);
                      const val = item.name || '';
                      setProductSearch(val);
                      setShowProductDropdown(false);
                      setCategorySearch('');
                    }}
                    onKeyDown={e => {
                      if (showProductDropdown) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setProductIdx(prev => Math.min(prev + 1, filteredProducts.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setProductIdx(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const selectedProduct = filteredProducts[productIdx];
                          if (selectedProduct) {
                            updateItem(index, 'productId', selectedProduct.id);
                            setShowProductDropdown(false);
                            setProductSearch(selectedProduct.name);
                            setTimeout(() => {
                              const next = document.querySelector(`[data-row="${index}"][data-col="quantity"]`) as HTMLElement;
                              next?.focus();
                            }, 50);
                          }
                        } else if (e.key === 'Escape') {
                          setShowProductDropdown(false);
                          setProductSearch(item.name || '');
                        }
                      } else {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          setShowProductDropdown(true);
                        }
                        handleGridKeyDown(e, index, 'product');
                      }
                    }}
                    className={cn(
                      "w-full bg-transparent text-[12px] font-normal focus:ring-0 p-0 border-none placeholder:text-gray-300 focus:bg-blue-50 dark:focus:bg-blue-900/20",
                      (item as any).isNew ? "text-red-600" : "text-black dark:text-white"
                    )}
                  />
                  {showProductDropdown && activeItemIndex === index && filteredProducts.length > 0 && (
                    <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto left-0">
                      {filteredProducts.map((p, i) => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            updateItem(index, 'productId', p.id);
                            setShowProductDropdown(false);
                            setProductSearch(p.name);
                            setTimeout(() => {
                              const next = document.querySelector(`[data-row="${index}"][data-col="quantity"]`) as HTMLElement;
                              next?.focus();
                            }, 50);
                          }}
                          className={cn(
                            "px-6 py-3 cursor-pointer transition-colors border-b last:border-0 border-gray-50 dark:border-gray-700",
                            i === productIdx ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <div className={cn(
                            "font-normal",
                            i === productIdx ? "text-blue-600" : "text-gray-900 dark:text-white"
                          )}>{p.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {p.sku} | <span className="font-bold" style={{ fontFamily: 'Times New Roman' }}>{(p.category || '').toUpperCase()}</span> | STOCK: {(() => {
                              const inv = inventory.find(i => i.productId === p.id);
                              return inv ? Number(inv.quantity).toFixed(2) : '0.00';
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1 text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                  <input 
                    data-row={index} data-col="quantity"
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', e.target.value)}
                    onFocus={e => {
                      e.target.select();
                      setActiveItemIndex(null);
                    }}
                    onKeyDown={e => handleGridKeyDown(e, index, 'quantity')}
                    className="bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none w-full focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  />
                </td>
                <td className="px-3 py-1 text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                  {(() => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <select 
                        data-row={index} data-col="unit"
                        value={item.unit}
                        onFocus={() => setActiveItemIndex(null)}
                        onChange={e => updateItem(index, 'unit', e.target.value)}
                        onKeyDown={e => handleGridKeyDown(e, index, 'unit')}
                        className="bg-transparent text-[12px] font-normal text-gray-900 dark:text-white uppercase border-none focus:ring-0 p-0 focus:bg-blue-50 dark:focus:bg-blue-900/20 w-full text-center cursor-pointer"
                      >
                        {product?.baseUnit && <option value={product.baseUnit}>{getUnitAbbreviation(product.baseUnit)}</option>}
                        {product?.secondaryUnit && <option value={product.secondaryUnit}>{getUnitAbbreviation(product.secondaryUnit)}</option>}
                        {!product && (
                          <>
                            <option value="Nos">Nos</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Box">Box</option>
                            <option value="Bgs">Bgs</option>
                            <option value="Ctn">Ctn</option>
                            <option value="Dzn">Dzn</option>
                            <option value="Mtr">Mtr</option>
                            <option value="Roll">Roll</option>
                          </>
                        )}
                      </select>
                    );
                  })()}
                </td>
                <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                  <input 
                    data-row={index} data-col="price"
                    type="number"
                    value={item.price}
                    onChange={e => updateItem(index, 'price', e.target.value)}
                    onFocus={e => {
                      e.target.select();
                      setActiveItemIndex(null);
                    }}
                    onKeyDown={e => handleGridKeyDown(e, index, 'price')}
                    className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  />
                </td>
                <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                  <input 
                    data-row={index} data-col="discount"
                    type="number"
                    value={item.discount}
                    onChange={e => updateItem(index, 'discount', e.target.value)}
                    onFocus={e => {
                      e.target.select();
                      setActiveItemIndex(null);
                    }}
                    onKeyDown={e => handleGridKeyDown(e, index, 'discount')}
                    className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  />
                </td>
                <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                  <input 
                    data-row={index} data-col="tax"
                    type="number"
                    value={item.tax}
                    onChange={e => updateItem(index, 'tax', e.target.value)}
                    onFocus={e => {
                      e.target.select();
                      setActiveItemIndex(null);
                    }}
                    onKeyDown={e => handleGridKeyDown(e, index, 'tax')}
                    className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  />
                </td>
                <td className="px-3 py-1 text-right text-[12px] font-normal text-gray-900 dark:text-white font-mono border-[0.5px] border-gray-100 dark:border-gray-800">
                  {item.total.toLocaleString()}
                </td>
                <td className="px-3 py-1 text-center text-gray-400 hover:text-red-500 border-[0.5px] border-gray-100 dark:border-gray-800">
                  <button onClick={() => removeItem(index)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-blue-50/30 dark:bg-blue-900/10">
              <td colSpan={9} className="px-4 py-2">
                <button 
                  onClick={addItem}
                  className="text-[12px] font-bold text-[#2a9df4] uppercase tracking-widest flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-1.5 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 hover:scale-105 transition-transform"
                >
                  <Plus size={14} /> ADD NEXT ITEM
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Section - Streamlined Horizontal Row */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 py-4 px-6 z-20 w-full overflow-hidden">
        <div className="max-w-full mx-auto flex items-center justify-between gap-4">
          
          {/* Purchase Document Identifier and Status Controllers */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#2a9df4]/10 text-[#2a9df4] rounded-md border border-[#2a9df4]/20">
              Purchase
            </span>

            {/* Bill Status Toggle */}
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-100 dark:border-gray-700 h-8">
              <button
                type="button"
                onClick={() => setBillStatus('paid')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all h-full flex items-center",
                  billStatus === 'paid'
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setBillStatus('unpaid')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all h-full flex items-center",
                  billStatus === 'unpaid'
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                Unpaid
              </button>
            </div>

            {/* Purchase Type Selection - Side-by-Side Checkboxes */}
            <div className="flex items-center gap-3 h-8">
              <div className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox"
                  id="counter-purchase-checkbox"
                  checked={paymentType === 'Cash'}
                  onChange={e => {
                    if (e.target.checked) setPaymentType('Cash');
                    else if (paymentType === 'Cash') setPaymentType(null);
                  }}
                  className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
                />
                <label htmlFor="counter-purchase-checkbox" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer whitespace-nowrap">
                  Counter Purchase
                </label>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox"
                  id="credit-purchase-checkbox"
                  checked={paymentType === 'Credit'}
                  onChange={e => {
                    if (e.target.checked) setPaymentType('Credit');
                    else if (paymentType === 'Credit') setPaymentType(null);
                  }}
                  className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
                />
                <label htmlFor="credit-purchase-checkbox" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer whitespace-nowrap">
                  Credit Purchase
                </label>
              </div>
            </div>
          </div>

          {/* 3. SMART ROUND OFF */}
          <div className="flex items-center gap-2 flex-shrink-0 h-8">
            <div className="flex items-center gap-1.5 cursor-pointer">
              <input 
                type="checkbox" 
                id="round-off-check-p"
                checked={useSmartRounding} 
                onChange={e => setUseSmartRounding(e.target.checked)} 
                className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
              />
              <label htmlFor="round-off-check-p" className="text-[10px] font-medium text-gray-400 uppercase tracking-widest cursor-pointer whitespace-nowrap">Round Off</label>
            </div>
            <span className="text-sm font-normal text-gray-900 dark:text-white">{roundOff.toFixed(2)}</span>
          </div>

          {/* FREIGHT/COURIER CHARGES */}
          <div className="flex items-center gap-2 flex-shrink-0 h-8 border-l border-gray-200 dark:border-gray-700 pl-3">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest whitespace-nowrap">Freight/Courier</span>
            <input 
              type="number"
              placeholder="0"
              value={freightCharges === '0' ? '' : freightCharges}
              onChange={e => setFreightCharges(e.target.value || '0')}
              className="w-16 text-right font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-2 py-0.5 text-xs focus:border-[#2a9df4] outline-none outline-0"
            />
          </div>

          {/* 4. SUB TOTAL */}
          <div className="flex items-center gap-2 flex-shrink-0 h-8">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest whitespace-nowrap">Sub Total</span>
            <span className="text-sm font-normal text-gray-900 dark:text-white">{subtotal.toFixed(2)}</span>
          </div>

          {/* 5. TOTAL */}
          <div className="flex items-center gap-2 flex-shrink-0 h-8">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Total</span>
            <span className="text-lg font-bold text-[#2a9df4] whitespace-nowrap tracking-tight">Rs. {totalAmount.toFixed(2)}</span>
          </div>

          {/* 6. ACTIONS */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0 h-8">
            <button 
              onClick={onClose}
              className="py-1.5 px-4 rounded-md text-[10px] font-medium uppercase tracking-widest bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000] border-2 border-transparent transition-all outline-none"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={cart.length === 0}
              className="py-1.5 px-6 rounded-md text-[10px] font-medium uppercase tracking-widest bg-[#2a9df4] text-white hover:bg-[#1e8ad4] transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              <CheckCircle size={14} />
              Save Purchase
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Supplier Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Quick Add Supplier</h3>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier Name *</label>
                <input 
                  autoFocus
                  type="text"
                  value={quickAddForm.name}
                  onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Enter supplier name..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                <input 
                  type="text"
                  value={quickAddForm.phone}
                  onChange={e => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Phone number..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</label>
                <textarea 
                  value={quickAddForm.address}
                  onChange={e => setQuickAddForm({...quickAddForm, address: e.target.value})}
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                  placeholder="City or Town..."
                 />
              </div>
              
              <button 
                onClick={async () => {
                  if (!quickAddForm.name) return;
                  const newId = crypto.randomUUID();
                  await db.addCustomer({
                    id: newId,
                    name: quickAddForm.name,
                    phone: quickAddForm.phone,
                    billingAddress: quickAddForm.address,
                    shippingAddress: quickAddForm.address,
                    email: '',
                    groupId: 'vendor',
                    gstNumber: '',
                    gstType: 'Unregistered',
                    state: '',
                    balance: 0,
                    openingBalanceDate: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                  });
                  setSuppliers([...suppliers, { id: newId, name: quickAddForm.name, phone: quickAddForm.phone } as any]);
                  setSelectedSupplier(newId);
                  setSupplierSearch(quickAddForm.name);
                  setIsQuickAddOpen(false);
                  setQuickAddForm({ name: '', phone: '', address: '' });
                }}
                disabled={!quickAddForm.name}
                className="w-full py-4 rounded-xl bg-[#2a9df4] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none mt-2"
              >
                Save & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
