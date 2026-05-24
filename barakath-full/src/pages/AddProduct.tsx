import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, X, Plus, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { db, Product } from '../lib/db';
import { cn } from '../lib/utils';

const UNITS = [
  'None', 'Nos', 'Pcs', 'Box', 'Bgs', 'Ctn', 'Dzn', 'Mtr', 'Roll'
];

interface ProductFormState {
  type: 'product' | 'service';
  itemName: string;
  itemHsn: string;
  itemCode: string;
  category: string;
  brand: string;
  baseUnit: string;
  secondaryUnit: string;
  conversionRate: string;
  
  // Pricing
  salePrice: string;
  salePriceUnit: string;
  salePriceTaxType: 'without' | 'with';
  discount: string;
  discountType: 'percentage' | 'amount';
  wholesalePrices: Array<{ qty: string, price: string }>;
  purchasePrice: string;
  purchasePriceUnit: string;
  purchasePriceTaxType: 'without' | 'with';
  taxRate: string;

  // Stock
  openingQty: string;
  atPrice: string;
  asOfDate: string;
  minStock: string;
}

export default function AddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);

  const [formState, setFormState] = useState<ProductFormState>({
    type: 'product',
    itemName: '',
    itemHsn: '',
    itemCode: '',
    category: '',
    brand: '',
    baseUnit: 'None',
    secondaryUnit: 'None',
    conversionRate: '0',
    salePrice: '',
    salePriceUnit: 'Base Unit',
    salePriceTaxType: 'without',
    discount: '',
    discountType: 'percentage',
    wholesalePrices: [],
    purchasePrice: '',
    purchasePriceUnit: 'Base Unit',
    purchasePriceTaxType: 'without',
    taxRate: 'None',
    openingQty: '',
    atPrice: '',
    asOfDate: format(new Date(), 'yyyy-MM-dd'),
    minStock: '',
  });

  const [conversionHistory, setConversionHistory] = useState<Record<string, Array<{base: string, secondary: string, rate: string}>>>({});
  
  // Modals & Dropdowns
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    const savedHistory = localStorage.getItem('conversion_history');
    if (savedHistory) {
      setConversionHistory(JSON.parse(savedHistory));
    }
    if (id) {
      loadProduct(id);
    }
  }, [id]);

  const updateConversionHistory = (category: string, base: string, secondary: string, rate: string) => {
    if (base === 'None' || secondary === 'None' || !rate || rate === '0') return;
    
    const catHistory = conversionHistory[category] || [];
    const newEntry = { base, secondary, rate };
    
    // Check if duplicate
    const exists = catHistory.some(h => h.base === base && h.secondary === secondary && h.rate === rate);
    if (exists) return;

    const updatedCatHistory = [newEntry, ...catHistory].slice(0, 2);
    const newHistory = { ...conversionHistory, [category]: updatedCatHistory };
    
    setConversionHistory(newHistory);
    localStorage.setItem('conversion_history', JSON.stringify(newHistory));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).blur();
  };

  const nextRefs = {
    itemName: useRef<HTMLInputElement>(null),
    itemCode: useRef<HTMLInputElement>(null),
    brand: useRef<HTMLInputElement>(null),
    category: useRef<HTMLDivElement>(null),
    itemHsn: useRef<HTMLInputElement>(null),
    baseUnit: useRef<HTMLSelectElement>(null),
    secondaryUnit: useRef<HTMLSelectElement>(null),
    conversionRate: useRef<HTMLInputElement>(null),
    salePrice: useRef<HTMLInputElement>(null),
    salePriceUnit: useRef<HTMLSelectElement>(null),
    salePriceTaxType: useRef<HTMLSelectElement>(null),
    discount: useRef<HTMLInputElement>(null),
    discountType: useRef<HTMLSelectElement>(null),
    purchasePrice: useRef<HTMLInputElement>(null),
    purchasePriceUnit: useRef<HTMLSelectElement>(null),
    purchasePriceTaxType: useRef<HTMLSelectElement>(null),
    taxRate: useRef<HTMLSelectElement>(null),
    openingQty: useRef<HTMLInputElement>(null),
    atPrice: useRef<HTMLInputElement>(null),
    asOfDate: useRef<HTMLInputElement>(null),
    minStock: useRef<HTMLInputElement>(null),
    saveButton: useRef<HTMLButtonElement>(null),
  };

  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);

  const handleArrowNavigation = (e: React.KeyboardEvent, gridPos: { row: number, col: number }) => {
    // Define a mapping of positions to refs
    // Row 0: Basic Details
    // Column 0: itemName, 1: itemCode, 2: brand, 3: category, 4: itemHsn, 5: baseUnit, 6: secondaryUnit, 7: conversionRate
    // Row 1: Sale Price Details
    // Column 0: salePrice, 1: salePriceUnit, 2: salePriceTaxType, 3: discount, 4: discountType
    // Row 2: Purchase & Tax Details
    // Column 0: purchasePrice, 1: purchasePriceUnit, 2: purchasePriceTaxType, 3: taxRate
    // Row 3: Stock Details
    // Column 0: openingQty, 1: atPrice, 2: asOfDate, 3: minStock

    const navigationMap: Record<string, any> = {
      '0-0': nextRefs.itemName,
      '0-1': nextRefs.itemCode,
      '0-2': nextRefs.brand,
      '0-3': nextRefs.category,
      '0-4': nextRefs.itemHsn,
      '0-5': nextRefs.baseUnit,
      '0-6': nextRefs.secondaryUnit,
      '0-7': nextRefs.conversionRate,
      '1-0': nextRefs.salePrice,
      '1-1': nextRefs.salePriceUnit,
      '1-2': nextRefs.salePriceTaxType,
      '1-3': nextRefs.discount,
      '1-4': nextRefs.discountType,
      '2-0': nextRefs.purchasePrice,
      '2-1': nextRefs.purchasePriceUnit,
      '2-2': nextRefs.purchasePriceTaxType,
      '2-3': nextRefs.taxRate,
      '3-0': nextRefs.openingQty,
      '3-1': nextRefs.atPrice,
      '3-2': nextRefs.asOfDate,
      '3-3': nextRefs.minStock,
    };

    let nextPos = { ...gridPos };

    if (e.key === 'ArrowRight') nextPos.col++;
    else if (e.key === 'ArrowLeft') nextPos.col--;
    else if (e.key === 'ArrowDown') nextPos.row++;
    else if (e.key === 'ArrowUp') nextPos.row--;
    else return;

    const targetRef = navigationMap[`${nextPos.row}-${nextPos.col}`];
    if (targetRef && targetRef.current) {
      e.preventDefault();
      targetRef.current.focus();
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent, nextRef?: React.RefObject<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isCategoryDropdownOpen && highlightedCategoryIndex >= 0) {
        setFormState({ ...formState, category: categories[highlightedCategoryIndex] });
        setIsCategoryDropdownOpen(false);
        setTimeout(() => nextRefs.itemHsn.current?.focus(), 0);
      } else if (!isCategoryDropdownOpen) {
        setIsCategoryDropdownOpen(true);
        setHighlightedCategoryIndex(0);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (!isCategoryDropdownOpen) {
        setIsCategoryDropdownOpen(true);
        setHighlightedCategoryIndex(0);
      } else {
        setHighlightedCategoryIndex(prev => Math.min(prev + 1, categories.length - 1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (isCategoryDropdownOpen) {
        setHighlightedCategoryIndex(prev => Math.max(prev - 1, 0));
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setIsCategoryDropdownOpen(false);
    } else if (!isCategoryDropdownOpen) {
      handleArrowNavigation(e, { row: 0, col: 3 });
    }
  };

  const handleSelectKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<any>, gridPos?: { row: number, col: number }) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Try to open the native picker if supported
      if (e.currentTarget instanceof HTMLSelectElement && 'showPicker' in e.currentTarget) {
        try {
          (e.currentTarget as any).showPicker();
        } catch (err) {
          console.error('showPicker failed', err);
        }
      }
      
      // Move focus for standard logic if already chosen or requested
      // We rely on onChange usually for native selects to move forward after choice
      // but the user wants Enter to "lock and move". 
      // If the picker is open, Enter confirms selection in many browsers.
      if (nextRef) {
        nextRef.current?.focus();
      }
    } else if (gridPos) {
      handleArrowNavigation(e, gridPos);
    }
  };

  const loadCategories = async () => {
    const products = await db.getProducts();
    const dbCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
    setCategories(dbCategories);
  };

  const loadProduct = async (productId: string) => {
    const [product, inventory] = await Promise.all([
      db.getProduct(productId),
      db.getInventory()
    ]);
    const inv = inventory.find(i => i.productId === productId);

    if (product && !product.isDeleted) {
      setFormState(prev => ({
        ...prev,
        itemName: product.name,
        itemCode: product.sku,
        category: product.category,
        brand: product.brand || '',
        salePrice: product.price.toString(),
        salePriceUnit: product.salePriceUnit || 'Base Unit',
        purchasePrice: product.purchasePrice?.toString() || '',
        purchasePriceUnit: product.purchasePriceUnit || 'Base Unit',
        baseUnit: product.baseUnit || 'None',
        secondaryUnit: product.secondaryUnit || 'None',
        conversionRate: product.conversionRate?.toString() || '0',
        wholesalePrices: product.wholesalePrices?.map(wp => ({ qty: wp.qty.toString(), price: wp.price.toString() })) || [],
        openingQty: product.openingStock?.toString() || inv?.quantity.toString() || '',
        minStock: inv?.minStockLevel.toString() || '5',
      }));
    } else if (product && product.isDeleted) {
      setErrorMessage("This product has been deleted and cannot be edited.");
      setTimeout(() => navigate('/products'), 2000);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async (closeAfterSave: boolean) => {
    setErrorMessage(null);
    if (!formState.itemName) {
      setErrorMessage("Item Name is required");
      return;
    }
    
    const openingQtyNum = parseFloat(formState.openingQty);
    if (openingQtyNum > 0) {
      if (!formState.atPrice) {
        setErrorMessage("At Price is required when Opening Quantity is greater than 0");
        return;
      }
      if (!formState.asOfDate) {
        setErrorMessage("As Of Date is required when Opening Quantity is greater than 0");
        return;
      }
    }

    // Load existing product to check for conversion rate changes
    const existingProduct = id ? await db.getProduct(id) : null;
    const oldRate = existingProduct?.conversionRate || 0;
    const newRate = parseFloat(formState.conversionRate) || 0;
    const rateChanged = id && oldRate !== newRate;

    const newProduct: Product = {
      id: id || Date.now().toString(),
      sku: formState.itemCode || `SKU-${Date.now().toString().slice(-6)}`,
      name: formState.itemName,
      price: parseFloat(formState.salePrice) || 0,
      purchasePrice: parseFloat(formState.purchasePrice) || 0,
      salePriceUnit: formState.salePriceUnit,
      purchasePriceUnit: formState.purchasePriceUnit,
      category: formState.category || '',
      brand: formState.brand,
      baseUnit: formState.baseUnit,
      secondaryUnit: formState.secondaryUnit,
      conversionRate: newRate,
      openingStock: openingQtyNum,
      wholesalePrices: formState.wholesalePrices
        .filter(wp => wp.qty && wp.price)
        .map(wp => ({ qty: parseFloat(wp.qty), price: parseFloat(wp.price) })),
      createdAt: existingProduct?.createdAt || new Date().toISOString()
    };

    await db.addProduct(newProduct);

    // Update conversion history
    if (formState.category) {
      updateConversionHistory(
        formState.category,
        formState.baseUnit,
        formState.secondaryUnit,
        formState.conversionRate
      );
    }
    
    // Sync Inventory
    await db.syncGlobalData();

    // Trigger recalculation for pending records if conversion rate changed
    if (rateChanged) {
      const [allSales, allPurchases] = await Promise.all([
        db.getSales(),
        db.getPurchases()
      ]);

      const pendingSales = allSales.filter(s => s.status === 'pending' && !s.isDeleted);
      for (const sale of pendingSales) {
        let changed = false;
        const updatedItems = sale.items.map(item => {
          if (item.productId === newProduct.id && item.unit === newProduct.secondaryUnit) {
            changed = true;
            // effectivePrice = basePrice * conversionRate
            // item.price is the base price
            const qty = item.quantity;
            const basePrice = item.price;
            const effectivePrice = basePrice * newRate;
            const disc = item.discount || 0;
            const tax = item.tax || 0;
            const baseTotal = qty * effectivePrice;
            const afterDisc = baseTotal - (baseTotal * (disc / 100));
            const newTotal = afterDisc + (afterDisc * (tax / 100));
            return { ...item, total: newTotal };
          }
          return item;
        });

        if (changed) {
          const newSubtotal = updatedItems.reduce((sum, i) => sum + i.total, 0);
          const newTotal = newSubtotal + (sale.packageLoaderAmt || 0) + (sale.roundOff || 0);
          await db.addSale({ ...sale, items: updatedItems, subtotal: newSubtotal, total: newTotal });
        }
      }

      // Similar logic for Purchases
      const unpaidPurchases = allPurchases.filter(p => p.status === 'unpaid' && !p.isDeleted);
      for (const purchase of unpaidPurchases) {
        let changed = false;
        const updatedItems = purchase.items.map(item => {
          if (item.productId === newProduct.id && item.unit === newProduct.secondaryUnit) {
            changed = true;
            const qty = item.quantity;
            const basePrice = item.price;
            const effectivePrice = basePrice * newRate;
            const disc = item.discount || 0;
            const tax = item.tax || 0;
            const baseTotal = qty * effectivePrice;
            const afterDisc = baseTotal - (baseTotal * (disc / 100));
            const newTotal = afterDisc + (afterDisc * (tax / 100));
            return { ...item, total: newTotal };
          }
          return item;
        });

        if (changed) {
          const newSubtotal = updatedItems.reduce((sum, i) => sum + i.total, 0);
          const newTotal = newSubtotal + (purchase.roundOff || 0);
          await db.updatePurchase({ ...purchase, items: updatedItems, subtotal: newSubtotal, total: newTotal });
        }
      }
    }

    if (closeAfterSave) {
      navigate('/products');
    } else {
      setFormState({
        ...formState,
        itemName: '',
        itemHsn: '',
        itemCode: '',
        baseUnit: 'None',
        secondaryUnit: 'None',
        conversionRate: '0',
        salePrice: '',
        discount: '',
        wholesalePrices: [],
        purchasePrice: '',
        openingQty: '',
        atPrice: '',
        minStock: '',
      });
      // Focus item name
      setTimeout(() => nextRefs.itemName.current?.focus(), 0);
    }
  };

  const addWholesalePrice = () => {
    setFormState({
      ...formState,
      wholesalePrices: [...formState.wholesalePrices, { qty: '', price: '' }]
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-[12px] font-bold font-serif text-gray-800 uppercase tracking-tight">{id ? 'EDIT ITEM' : 'ADD ITEM'}</h1>
        </div>
        <div className="flex items-center gap-4 text-gray-500">
          <X size={24} className="cursor-pointer hover:text-gray-700" onClick={() => navigate('/products')} />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <X size={16} className="bg-red-600 text-white rounded-full p-0.5" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}
        {/* Basic Details */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 bg-white border-b">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name *</label>
            <input 
              ref={nextRefs.itemName}
              onKeyDown={(e) => {
                handleEnterKey(e, nextRefs.itemCode);
                handleArrowNavigation(e, { row: 0, col: 0 });
              }}
              onFocus={handleFocus}
              placeholder="Enter product name" 
              className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              value={formState.itemName}
              onChange={e => setFormState({...formState, itemName: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Code</label>
            <div className="flex gap-1">
              <input 
                ref={nextRefs.itemCode}
                onKeyDown={(e) => {
                  handleEnterKey(e, nextRefs.brand);
                  handleArrowNavigation(e, { row: 0, col: 1 });
                }}
                onFocus={handleFocus}
                placeholder="Code" 
                className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                value={formState.itemCode}
                onChange={e => setFormState({...formState, itemCode: e.target.value})}
              />
              <button 
                className="bg-blue-50 text-blue-600 px-2 rounded border border-blue-100 text-[10px] font-bold hover:bg-blue-100 transition-colors"
                onClick={() => setFormState({...formState, itemCode: `SKU-${Math.floor(Math.random() * 1000000)}`})}
              >
                Auto
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Brand</label>
            <input 
              ref={nextRefs.brand}
              onKeyDown={(e) => {
                handleEnterKey(e, nextRefs.category);
                handleArrowNavigation(e, { row: 0, col: 2 });
              }}
              onFocus={handleFocus}
              placeholder="Brand" 
              className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              value={formState.brand}
              onChange={e => setFormState({...formState, brand: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
            <div className="relative" ref={dropdownRef}>
              <div 
                ref={nextRefs.category}
                tabIndex={0}
                className="w-full border border-gray-300 rounded p-2.5 flex justify-between items-center cursor-pointer bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                onKeyDown={handleCategoryKeyDown}
              >
                <span className={formState.category ? 'text-gray-800' : 'text-gray-400'}>
                  {formState.category || 'Select Category'}
                </span>
                <span className="text-gray-400 text-xs">▼</span>
              </div>
              
              {isCategoryDropdownOpen && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded shadow-lg mt-1 z-20 max-h-60 flex flex-col">
                  <div className="overflow-y-auto flex-1 py-1">
                    {categories.map((cat, idx) => (
                      <div 
                        key={cat} 
                        className={cn(
                          "px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700",
                          highlightedCategoryIndex === idx && "bg-blue-100"
                        )}
                        onClick={() => {
                          setFormState({...formState, category: cat});
                          setIsCategoryDropdownOpen(false);
                          nextRefs.itemHsn.current?.focus();
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                  <div 
                    className="p-3 border-t text-blue-600 font-medium flex items-center gap-2 cursor-pointer hover:bg-blue-50 sticky bottom-0 bg-white text-sm"
                    onClick={() => {
                      setIsCategoryDropdownOpen(false);
                      setIsCategoryModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Add New
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item HSN</label>
            <div className="relative">
              <input 
                ref={nextRefs.itemHsn}
                onKeyDown={(e) => {
                  handleEnterKey(e, nextRefs.baseUnit);
                  handleArrowNavigation(e, { row: 0, col: 4 });
                }}
                onFocus={handleFocus}
                placeholder="HSN Code" 
                className="w-full border border-gray-300 rounded p-2.5 pr-8 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                value={formState.itemHsn}
                onChange={e => setFormState({...formState, itemHsn: e.target.value})}
              />
              <Search className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Unit</label>
            <select 
              ref={nextRefs.baseUnit}
              onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.secondaryUnit, { row: 0, col: 5 })}
              className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
              value={formState.baseUnit}
              onChange={e => setFormState({...formState, baseUnit: e.target.value})}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sec. Unit</label>
            <select 
              ref={nextRefs.secondaryUnit}
              onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.conversionRate, { row: 0, col: 6 })}
              className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
              value={formState.secondaryUnit}
              onChange={e => setFormState({...formState, secondaryUnit: e.target.value})}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Conv. Rate</label>
            <div className="flex items-center gap-0 border border-gray-300 rounded overflow-hidden bg-white">
              {/* Secondary Unit Segment */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-4 border-r border-gray-200 bg-gray-50/50">
                <span className="text-sm font-bold text-gray-700">1 {formState.secondaryUnit !== 'None' ? formState.secondaryUnit : 'UNIT'}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Secondary Unit</span>
              </div>
              
              {/* Divider */}
              <div className="px-3 text-xl font-bold text-gray-300 select-none">
                =
              </div>
              
              {/* Base Unit Segment */}
              <div className="flex-1 flex flex-col items-center py-2 px-4">
                <div className="flex items-center w-full justify-center">
                  <input 
                    ref={nextRefs.conversionRate}
                    onKeyDown={(e) => {
                      handleEnterKey(e, nextRefs.salePrice);
                      handleArrowNavigation(e, { row: 0, col: 7 });
                    }}
                    type="number"
                    className="w-16 text-center text-sm font-bold border-b-2 border-blue-500 outline-none p-0 bg-transparent"
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    value={formState.conversionRate}
                    onChange={e => setFormState({...formState, conversionRate: e.target.value})}
                    disabled={formState.secondaryUnit === 'None'}
                  />
                  <span className="ml-1 text-sm font-bold text-gray-700 uppercase">{formState.baseUnit !== 'None' ? formState.baseUnit : 'UNIT'}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Base Unit</span>
              </div>
            </div>
            
            {/* Logical Preview */}
            <p className="mt-2 text-[10px] font-medium text-gray-400 italic">
              Here system will show: 1 {formState.secondaryUnit !== 'None' ? formState.secondaryUnit : '[Secondary]'} = {formState.conversionRate || '0'} {formState.baseUnit !== 'None' ? formState.baseUnit : '[Base]'} conversion.
            </p>

            {/* Recent Conversions */}
            {formState.category && conversionHistory[formState.category] && conversionHistory[formState.category].length > 0 && (
              <div className="mt-3">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Recent Conversions</label>
                <div className="flex flex-wrap gap-2">
                  {conversionHistory[formState.category].map((hist, i) => (
                    <button
                      key={i}
                      onClick={() => setFormState({
                        ...formState,
                        baseUnit: hist.base,
                        secondaryUnit: hist.secondary,
                        conversionRate: hist.rate
                      })}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold border border-blue-100 rounded transition-colors whitespace-nowrap"
                    >
                      1 {hist.secondary.split(' ')[0]} = {hist.rate} {hist.base.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unified Content Sections */}
        <div className="p-6 space-y-6">
          {/* Sale Price Section */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight font-serif">Sales Pricing</h3>
              <button 
                className="text-blue-600 text-[10px] font-bold hover:text-blue-800 transition-colors uppercase tracking-widest"
                onClick={addWholesalePrice}
              >
                + Add Wholesale Price
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1 flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                <input 
                  ref={nextRefs.salePrice}
                  onKeyDown={(e) => {
                    handleEnterKey(e, nextRefs.salePriceUnit);
                    handleArrowNavigation(e, { row: 1, col: 0 });
                  }}
                  onFocus={handleFocus}
                  onWheel={handleWheel}
                  placeholder="Sale Price" 
                  type="number"
                  className="p-2.5 w-full outline-none text-sm"
                  value={formState.salePrice}
                  onChange={e => setFormState({...formState, salePrice: e.target.value})}
                />
              </div>
              <div className="md:col-span-1 flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                <select 
                  ref={nextRefs.salePriceUnit}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.salePriceTaxType, { row: 1, col: 1 })}
                  className="w-full bg-gray-50 p-2.5 outline-none text-gray-700 cursor-pointer text-xs font-bold"
                  value={formState.salePriceUnit}
                  onChange={e => setFormState({...formState, salePriceUnit: e.target.value})}
                >
                  <option value="Base Unit">Per {formState.baseUnit !== 'None' ? formState.baseUnit.split(' ')[0] : 'Base Unit'}</option>
                  {formState.secondaryUnit !== 'None' && (
                    <option value="Secondary Unit">Per {formState.secondaryUnit.split(' ')[0]}</option>
                  )}
                </select>
              </div>
              <div className="md:col-span-1 flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                <select 
                  ref={nextRefs.salePriceTaxType}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.discount, { row: 1, col: 2 })}
                  className="w-full bg-gray-50 p-2.5 outline-none text-gray-700 cursor-pointer text-xs font-bold"
                  value={formState.salePriceTaxType}
                  onChange={e => setFormState({...formState, salePriceTaxType: e.target.value as any})}
                >
                  <option value="without">Tax Exclusive</option>
                  <option value="with">Tax Inclusive</option>
                </select>
              </div>
              <div className="md:col-span-1 flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                <input 
                  ref={nextRefs.discount}
                  onKeyDown={(e) => {
                    handleEnterKey(e, nextRefs.discountType);
                    handleArrowNavigation(e, { row: 1, col: 3 });
                  }}
                  onFocus={handleFocus}
                  onWheel={handleWheel}
                  placeholder="Discount" 
                  type="number"
                  className="p-2.5 w-full outline-none text-sm"
                  value={formState.discount}
                  onChange={e => setFormState({...formState, discount: e.target.value})}
                />
                <select 
                  ref={nextRefs.discountType}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.purchasePrice, { row: 1, col: 4 })}
                  className="bg-gray-50 border-l border-gray-300 p-2.5 outline-none text-gray-700 cursor-pointer text-[10px] font-bold"
                  value={formState.discountType}
                  onChange={e => setFormState({...formState, discountType: e.target.value as any})}
                >
                  <option value="percentage">%</option>
                  <option value="amount">₹</option>
                </select>
              </div>
            </div>
            
            {formState.wholesalePrices.map((wp, idx) => (
              <div key={idx} className="flex gap-4 mt-4">
                <div className="flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden shadow-sm">
                  <input 
                    type="number"
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    placeholder="Min Wholesale Qty" 
                    className="p-2.5 w-36 outline-none border-r border-gray-200 text-sm"
                    value={wp.qty}
                    onChange={e => {
                      const newWp = [...formState.wholesalePrices];
                      newWp[idx].qty = e.target.value;
                      setFormState({...formState, wholesalePrices: newWp});
                    }}
                  />
                  <div className="bg-gray-50 px-3 flex items-center border-r border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                      {formState.secondaryUnit !== 'None' ? formState.secondaryUnit.split(' ')[0] : 'Unit'}
                    </span>
                  </div>
                  <input 
                    type="number"
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    placeholder="Wholesale Price" 
                    className="p-2.5 w-40 outline-none text-sm"
                    value={wp.price}
                    onChange={e => {
                      const newWp = [...formState.wholesalePrices];
                      newWp[idx].price = e.target.value;
                      setFormState({...formState, wholesalePrices: newWp});
                    }}
                  />
                </div>
                <button 
                  className="text-red-500 hover:text-red-700 transition-colors"
                  onClick={() => {
                    const newWp = formState.wholesalePrices.filter((_, i) => i !== idx);
                    setFormState({...formState, wholesalePrices: newWp});
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Purchase Price Container */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-tight font-serif">Purchase Price</h3>
              <div className="flex border border-gray-300 rounded focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden w-full">
                <input 
                  ref={nextRefs.purchasePrice}
                  onKeyDown={(e) => {
                    handleEnterKey(e, nextRefs.purchasePriceUnit);
                    handleArrowNavigation(e, { row: 2, col: 0 });
                  }}
                  onFocus={handleFocus}
                  onWheel={handleWheel}
                  placeholder="Price" 
                  type="number"
                  className="p-2.5 flex-1 outline-none text-sm"
                  value={formState.purchasePrice}
                  onChange={e => setFormState({...formState, purchasePrice: e.target.value})}
                />
                <select 
                  ref={nextRefs.purchasePriceUnit}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.purchasePriceTaxType, { row: 2, col: 1 })}
                  className="bg-gray-50 border-l border-gray-300 p-2.5 outline-none text-gray-700 cursor-pointer text-xs font-bold"
                  value={formState.purchasePriceUnit}
                  onChange={e => setFormState({...formState, purchasePriceUnit: e.target.value})}
                >
                  <option value="Base Unit">Per {formState.baseUnit !== 'None' ? formState.baseUnit.split(' ')[0] : 'Base Unit'}</option>
                  {formState.secondaryUnit !== 'None' && (
                    <option value="Secondary Unit">Per {formState.secondaryUnit.split(' ')[0]}</option>
                  )}
                </select>
                <select 
                  ref={nextRefs.purchasePriceTaxType}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.taxRate, { row: 2, col: 2 })}
                  className="bg-gray-50 border-l border-gray-300 p-2.5 outline-none text-gray-700 cursor-pointer text-xs"
                  value={formState.purchasePriceTaxType}
                  onChange={e => setFormState({...formState, purchasePriceTaxType: e.target.value as any})}
                >
                  <option value="without">Exclusive</option>
                  <option value="with">Inclusive</option>
                </select>
              </div>
            </div>

            {/* Taxes Container */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-tight font-serif">Taxes</h3>
              <div className="border border-gray-300 rounded p-2.5 relative focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <label className="absolute -top-2.5 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Tax Rate</label>
                <select 
                  ref={nextRefs.taxRate}
                  onKeyDown={(e) => handleSelectKeyDown(e, nextRefs.openingQty, { row: 2, col: 3 })}
                  className="w-full outline-none bg-transparent text-gray-800 cursor-pointer text-sm"
                  value={formState.taxRate}
                  onChange={e => setFormState({...formState, taxRate: e.target.value})}
                >
                  <option value="None">None</option>
                  <option value="GST 5%">GST 5%</option>
                  <option value="GST 12%">GST 12%</option>
                  <option value="GST 18%">GST 18%</option>
                  <option value="GST 28%">GST 28%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stock Details Section */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-tight font-serif">Stock Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Opening Quantity</label>
                  <input 
                    ref={nextRefs.openingQty}
                    onKeyDown={(e) => {
                      handleEnterKey(e, nextRefs.atPrice);
                      handleArrowNavigation(e, { row: 3, col: 0 });
                    }}
                    placeholder="e.g. 10" 
                    type="number" 
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    value={formState.openingQty}
                    onChange={e => setFormState({...formState, openingQty: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">At Price (Valuation)</label>
                  <input 
                    ref={nextRefs.atPrice}
                    onKeyDown={(e) => {
                      handleEnterKey(e, nextRefs.asOfDate);
                      handleArrowNavigation(e, { row: 3, col: 1 });
                    }}
                    placeholder="Valuation per unit" 
                    type="number" 
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    className={`w-full border rounded p-2.5 outline-none focus:ring-1 text-sm ${parseFloat(formState.openingQty) > 0 && !formState.atPrice ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                    value={formState.atPrice}
                    onChange={e => setFormState({...formState, atPrice: e.target.value})}
                  />
                  {parseFloat(formState.openingQty) > 0 && !formState.atPrice && (
                    <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium italic">Required when opening quantity is set</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">As Of Date</label>
                  <div className="border border-gray-300 rounded p-2.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <input 
                      ref={nextRefs.asOfDate}
                      onKeyDown={(e) => {
                        handleEnterKey(e, nextRefs.minStock);
                        handleArrowNavigation(e, { row: 3, col: 2 });
                      }}
                      type="date" 
                      className="w-full outline-none bg-transparent text-gray-800 text-sm"
                      value={formState.asOfDate}
                      onChange={e => setFormState({...formState, asOfDate: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Low Stock Warning</label>
                  <input 
                    ref={nextRefs.minStock}
                    onKeyDown={(e) => {
                      handleEnterKey(e, nextRefs.saveButton);
                      handleArrowNavigation(e, { row: 3, col: 3 });
                    }}
                    placeholder="e.g. 5" 
                    type="number" 
                    onFocus={handleFocus}
                    onWheel={handleWheel}
                    className="w-full border border-gray-300 rounded p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    value={formState.minStock}
                    onChange={e => setFormState({...formState, minStock: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Footer Actions */}
      <div className="w-full bg-transparent px-6 pb-6 pt-0 flex justify-center gap-4 shrink-0 mt-auto">
        <button 
          className="px-8 py-3 bg-[#3B82F6] hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
          onClick={() => handleSave(false)}
        >
          Save & Add Another
        </button>
        <button 
          ref={nextRefs.saveButton}
          className="px-16 py-3 border-2 border-[#3B82F6] bg-white text-[#3B82F6] hover:bg-blue-50 rounded-lg font-bold transition-all shadow-sm active:scale-95"
          onClick={() => handleSave(true)}
        >
          Save
        </button>
      </div>

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-96 shadow-2xl overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-800">Add Category</h3>
              <X className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setIsCategoryModalOpen(false)} />
            </div>
            <div className="p-5">
              <label className="block text-sm text-blue-600 font-medium mb-2">Enter Category Name</label>
              <input 
                autoFocus
                className="w-full border-2 border-blue-400 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="e.g., Grocery"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    setCategories([...categories, newCategoryName.trim()]);
                    setFormState({...formState, category: newCategoryName.trim()});
                    setNewCategoryName('');
                    setIsCategoryModalOpen(false);
                  }
                }}
              />
            </div>
            <div className="p-5 pt-2 flex justify-center">
              <button 
                className="bg-[#ef4444] text-white w-full py-2.5 rounded-full font-bold hover:bg-red-600 transition-colors shadow-md hover:shadow-lg"
                onClick={() => {
                  if(newCategoryName.trim()) {
                    setCategories([...categories, newCategoryName.trim()]);
                    setFormState({...formState, category: newCategoryName.trim()});
                    setNewCategoryName('');
                    setIsCategoryModalOpen(false);
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
