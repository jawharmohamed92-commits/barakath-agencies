import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db, Sale, Customer, Product, Inventory, SaleItem } from '../lib/db';
import { Plus, Trash2, Download, MessageCircle, FileText, X, Search, Pencil, AlertTriangle, CheckCircle, Circle, FileUp, Package, ArrowUp, ArrowDown, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatDate, getUnitAbbreviation } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useTableKeyNav } from '../hooks/useTableKeyNav';
import SettlementModal from '../components/SettlementModal';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export default function Sales() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  
  const [activeTab, setActiveTab] = useState<'invoice' | 'estimate'>('invoice');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  const [settlementInfo, setSettlementInfo] = useState<{
    isOpen: boolean;
    item: Sale | null;
    type: 'Paid' | 'Unpaid';
  }>({ isOpen: false, item: null, type: 'Paid' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [saleType, setSaleType] = useState<'invoice' | 'estimate'>('invoice');
  const [billNumber, setBillNumber] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [packageLoaderAmt, setPackageLoaderAmt] = useState('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isRoundOff, setIsRoundOff] = useState(false);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Credit' | ''>('');
  const [billStatus, setBillStatus] = useState<'Paid' | 'Unpaid' | ''>('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [useSmartRounding, setUseSmartRounding] = useState(true);
  const [freightCharges, setFreightCharges] = useState('0');
  const [importStatus, setImportStatus] = useState<{message: string; type: 'success' | 'error' | null}>({message: '', type: null});
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', phone: '', address: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState<{
    isOpen: boolean;
    oldNo: string;
    newNo: string;
  }>({ isOpen: false, oldNo: '', newNo: '' });
  const [stockWarningModal, setStockWarningModal] = useState<{
    isOpen: boolean;
    items: Array<{
      name: string;
      billedQty: number;
      currentStock: number;
      shortage: number;
    }>;
  }>({ isOpen: false, items: [] });
  const [productIdxLocal, setProductIdxLocal] = useState(0);
  const [customerIdx, setCustomerIdx] = useState(0);
  const [categoryIdx, setCategoryIdx] = useState(0);

  // Reset indices when searches change
  useEffect(() => {
    setProductIdxLocal(0);
  }, [productSearch]);

  useEffect(() => {
    setCustomerIdx(0);
  }, [customerSearch]);

  useEffect(() => {
    setCategoryIdx(0);
  }, [categorySearch]);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const billNoInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const itemTableRef = useRef<HTMLTableElement>(null);
  const categoryRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const pkgLoaderInputRef = useRef<HTMLInputElement>(null);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const handleEnterKey = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement | HTMLButtonElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const filteredCustomers = customers
    .filter(c => c.groupId !== 'vendor') // Exclude Suppliers from Sales
    .filter(c => (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || "").includes(customerSearch))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = String(p.name || "").toLowerCase().includes(productSearch.toLowerCase()) || String(p.sku || "").toLowerCase().includes(productSearch.toLowerCase());
      const currentRowCategory = activeItemIndex !== null ? cart[activeItemIndex]?.category : '';
      const matchesCategory = currentRowCategory ? p.category === currentRowCategory : true;
      return matchesSearch && matchesCategory;
    });

  const discountInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);
  const addToCartRef = useRef<HTMLButtonElement>(null);

  const handleBillNoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dateInputRef.current?.focus();
    }
  };

  const handleBillDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      customerInputRef.current?.focus();
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (showCustomerDropdown && filteredCustomers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCustomerIdx(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCustomerIdx(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const customer = filteredCustomers[customerIdx];
        if (customer) {
          setSelectedCustomer(customer.id);
          setCustomerSearch(customer.name);
          setShowCustomerDropdown(false);
          if (cart.length === 0) {
            addItem();
          }
          setTimeout(() => {
            const firstRowCategory = document.querySelector('[data-row="0"][data-col="category"]') as HTMLElement;
            firstRowCategory?.focus();
          }, 50);
        }
      } else if (e.key === 'Escape') {
        setShowCustomerDropdown(false);
      }
    } else if (e.key === 'Enter') {
      if (selectedCustomer) {
        e.preventDefault();
        if (cart.length === 0) addItem();
        setTimeout(() => {
          const firstRowCategory = document.querySelector('[data-row="0"][data-col="category"]') as HTMLElement;
          firstRowCategory?.focus();
        }, 50);
      }
    }
  };

  const { selectedIndex: productIdx, handleKeyDown: handleProductKeyDown } = useKeyboardNavigation<Product>({
    items: filteredProducts,
    isOpen: showProductDropdown && productSearch.length > 0,
    setIsOpen: setShowProductDropdown,
    onSelect: (p: Product) => {
      setSelectedProduct(p.id);
      setProductSearch(p.name);
      setShowProductDropdown(false);
      setSelectedUnit(p.baseUnit || '');
      // Move focus to quantity
      setTimeout(() => qtyInputRef.current?.focus(), 0);
    }
  });

  const categories = Array.from(new Set(products.map(p => p.category || ''))).filter(Boolean).sort() as string[];

  useEffect(() => {
    const init = async () => {
      await loadData();
      
      const saleId = searchParams.get('id');
      const saleTypeParam = searchParams.get('type');
      const action = searchParams.get('action');
      
      if (saleId && saleTypeParam) {
        const allSales = await db.getSales();
        const sale = allSales.find(s => s.id === saleId);
        if (sale) {
          setActiveTab(saleTypeParam as 'invoice' | 'estimate');
          handleEditSale(sale);
        }
        setSearchParams({}, { replace: true });
      } else if (action === 'new') {
        setBillStatus('');
        setPaymentType('');
        setFreightCharges('0');
        setIsModalOpen(true);
        setSaleType('invoice');
        setSearchParams({}, { replace: true });
      }
    };
    init();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.relative')) {
        setShowCustomerDropdown(false);
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isModalOpen && !editingSaleId) {
      db.getNextReferenceNumber(saleType).then(setBillNumber);
    }
  }, [isModalOpen, saleType, editingSaleId]);

  const loadData = async () => {
    const allSales = await db.getSales();
    const activeSales = allSales.filter(s => !s.isDeleted);
    const sortedSales = [...activeSales].sort((a, b) => {
      const rawA = a.createdAt || a.date || '';
      const rawB = b.createdAt || b.date || '';
      const dateA = new Date(rawA).setHours(0,0,0,0);
      const dateB = new Date(rawB).setHours(0,0,0,0);
      if (dateB !== dateA) return dateB - dateA;

      const timeA = new Date(rawA).getTime();
      const timeB = new Date(rawB).getTime();
      if (timeB !== timeA) return timeB - timeA;

      const numA = parseInt((a.billNumber || '').replace(/\D/g, '') || '0');
      const numB = parseInt((b.billNumber || '').replace(/\D/g, '') || '0');
      return numB - numA;
    });
    setSales(sortedSales);
    
    const allCustomers = await db.getCustomers();
    setCustomers(allCustomers.filter(c => !c.isDeleted));
    
    const allProducts = await db.getProducts();
    setProducts(allProducts.filter(p => !p.isDeleted));
    
    setInventory(await db.getInventory());
  };

  const addItem = () => {
    setCart([...cart, { 
      productId: '', 
      name: '', 
      quantity: 1, 
      unit: 'Unit', 
      price: 0, 
      discount: 0, 
      tax: 0, 
      total: 0,
      category: ''
    } as any]);
    setActiveItemIndex(cart.length);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newCart = [...cart];
    const item = { ...newCart[index] } as any;
    
    if (field === 'productId') {
      const p = products.find(prod => prod.id === value);
      if (p) {
        item.productId = p.id;
        item.name = p.name;
        item.price = p.price || 0;
        item.unit = p.baseUnit || 'Nos';
        item.tax = p.tax || 0;
        item.category = p.category;
        item.isNew = false;
        
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
        // Automatically adjust price based on unit
        if (value === p.secondaryUnit && p.conversionRate) {
          item.price = (p.price || 0) * p.conversionRate;
        } else {
          item.price = p.price || 0; // Revert to base price
        }
      } else {
        item.unit = value;
      }
    } else {
      item[field] = value;
    }

    const p = products.find(prod => prod.id === item.productId);
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const disc = parseFloat(item.discount) || 0;
    const tax = parseFloat(item.tax) || 0;
    
    // Total is simply Qty * Price(adjusted for unit)
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

  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, colKey: string) => {
    // Dropdown navigation takes precedence
    if (showProductDropdown || showCustomerDropdown || (activeItemIndex === rowIndex && productSearch.length > 0)) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        return;
      }
    }

    const isEnter = e.key === 'Enter';
    const isArrowRight = e.key === 'ArrowRight';
    const isArrowLeft = e.key === 'ArrowLeft';
    const isArrowDown = e.key === 'ArrowDown';
    const isArrowUp = e.key === 'ArrowUp';

    if (isEnter) {
      e.preventDefault();
      const colOrder = ['category', 'product', 'quantity', 'unit', 'price', 'discount', 'tax'];
      const currentIdx = colOrder.indexOf(colKey);
      
      if (currentIdx < colOrder.length - 1) {
        const nextCol = colOrder[currentIdx + 1];
        setTimeout(() => {
          const nextElem = document.querySelector(`[data-row="${rowIndex}"][data-col="${nextCol}"]`) as HTMLElement;
          nextElem?.focus();
          // If it's the product search, clear search if focusing
          if (nextCol === 'product') {
            setActiveItemIndex(rowIndex);
            setProductSearch('');
          }
        }, 50);
      } else {
        // At the end of row (Tax percentage)
        if (rowIndex === cart.length - 1) {
          addItem(); // "+ ADD NEXT ITEM" function
          setTimeout(() => {
            const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="category"]`) as HTMLElement;
            nextRowElem?.focus();
          }, 100);
        } else {
          const nextRowElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="category"]`) as HTMLElement;
          nextRowElem?.focus();
        }
      }
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const p = products.find(prod => prod.id === cart[rowIndex].productId);
      if (p && p.secondaryUnit && colKey === 'unit') {
        e.preventDefault();
        const nextUnit = cart[rowIndex].unit === p.baseUnit ? p.secondaryUnit : p.baseUnit;
        updateItem(rowIndex, 'unit', nextUnit);
      } else {
        if (isArrowDown && rowIndex < cart.length - 1) {
          e.preventDefault();
          const nextElem = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${colKey}"]`) as HTMLElement;
          nextElem?.focus();
        } else if (isArrowUp && rowIndex > 0) {
          e.preventDefault();
          const nextElem = document.querySelector(`[data-row="${rowIndex - 1}"][data-col="${colKey}"]`) as HTMLElement;
          nextElem?.focus();
        }
      }
      return;
    }

    if (isArrowRight || isArrowLeft) {
      const colOrder = ['category', 'product', 'quantity', 'unit', 'price', 'discount', 'tax'];
      const currentIdx = colOrder.indexOf(colKey);
      let nextRow = rowIndex;
      let nextCol = colKey;

      if (isArrowRight && currentIdx < colOrder.length - 1) nextCol = colOrder[currentIdx + 1];
      if (isArrowLeft && currentIdx > 0) nextCol = colOrder[currentIdx - 1];
      if (isArrowDown && rowIndex < cart.length - 1) nextRow = rowIndex + 1;
      if (isArrowUp && rowIndex > 0) nextRow = rowIndex - 1;

      if (nextRow !== rowIndex || nextCol !== colKey) {
        e.preventDefault();
        setTimeout(() => {
          const nextElem = document.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"]`) as HTMLElement;
          nextElem?.focus();
          if (nextCol === 'product') {
            setActiveItemIndex(nextRow);
          }
        }, 0);
      }
    }
  };

  const isValidDate = (dateStr: string) => {
    const timestamp = Date.parse(dateStr);
    if (isNaN(timestamp)) return false;
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length !== 4) return false;
    return true;
  };

  const handleQuickAddCustomer = async () => {
    if (!quickAddForm.name) return;
    const newId = crypto.randomUUID();
    const newCustomer: Customer = {
      id: newId,
      name: quickAddForm.name,
      phone: quickAddForm.phone,
      billingAddress: quickAddForm.address,
      shippingAddress: quickAddForm.address,
      balance: 0,
      createdAt: new Date().toISOString(),
      email: '',
      groupId: 'general',
      gstNumber: '',
      gstType: 'Unregistered',
      openingBalanceDate: new Date().toISOString(),
      state: ''
    };
    await db.addCustomer(newCustomer);
    setCustomers([...customers, newCustomer]);
    setSelectedCustomer(newId);
    setCustomerSearch(newCustomer.name);
    setIsQuickAddOpen(false);
    setQuickAddForm({ name: '', phone: '', address: '' });
    setTimeout(() => customerInputRef.current?.focus(), 100);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const pkgLoader = parseFloat(packageLoaderAmt) || 0;
  
  const [roundOff, setRoundOff] = useState(0);

  useEffect(() => {
    if (useSmartRounding) {
      const baseTotal = subtotal + pkgLoader;
      const fractionalPart = baseTotal % 1;
      let calculatedRoundOff = 0;
      if (fractionalPart > 0) {
        if (fractionalPart < 0.5) {
          calculatedRoundOff = -fractionalPart;
        } else {
          calculatedRoundOff = 1 - fractionalPart;
        }
      }
      setRoundOff(Number(calculatedRoundOff.toFixed(2)));
    }
  }, [subtotal, pkgLoader, useSmartRounding]);

  const freightAmt = parseFloat(freightCharges) || 0;
  const total = subtotal + freightAmt;
  const roundOffAmt = roundOff;

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 1) {
          setImportStatus({ message: 'Excel file is empty', type: 'error' });
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h).trim());
        const expectedHeaders = ['Category', 'Product Name', 'Qty', 'Unit(Base, Secondary)', 'Purchase Price', 'Discount %', 'Tax %'];
        
        const isHeaderMatch = expectedHeaders.every(h => headers.includes(h));
        if (!isHeaderMatch) {
          setImportStatus({ message: `Invalid Template. Please use the official ${settings.shopName || 'BARAKATH AGENCIES'} format.`, type: 'error' });
          return;
        }

        const hIdx = (h: string) => headers.indexOf(h);
        const rows = jsonData.slice(1);
        const newItems: SaleItem[] = rows.map(row => {
          const categoryName = String(row[hIdx('Category')] || '');
          const productName = String(row[hIdx('Product Name')] || '');
          const qty = parseFloat(row[hIdx('Qty')]) || 1;
          const unitType = String(row[hIdx('Unit(Base, Secondary)')] || 'Base');
          const price = parseFloat(row[hIdx('Sale Price')]) || 0; // Notice: Sale Price for Sales
          const disc = parseFloat(row[hIdx('Discount %')]) || 0;
          const tax = parseFloat(row[hIdx('Tax %')]) || 0;

          const product = products.find(p => String(p.name || "").toLowerCase() === productName.toLowerCase());
          
          let item = {
            productId: product?.id || '',
            name: productName,
            quantity: qty,
            unit: unitType === 'Secondary' ? (product?.secondaryUnit || 'Unit') : (product?.baseUnit || 'Unit'),
            price: price || product?.sellingPrice || 0,
            discount: disc,
            tax: tax,
            total: 0,
            isNew: !product
          };

          const amount = item.price * item.quantity;
          item.total = amount * (1 - item.discount / 100) * (1 + item.tax / 100);
          return item;
        }).filter(item => item.name);

        setCart([...cart, ...newItems]);
        setImportStatus({ message: `${newItems.length} Items successfully fetched and added to bill.`, type: 'success' });
        setTimeout(() => setImportStatus({ message: '', type: null }), 5000);
      } catch (err) {
        setImportStatus({ message: 'Failed to process Excel file.', type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setSaleType(sale.type);
    setBillNumber(sale.billNumber || '');
    setBillDate(sale.date || new Date().toISOString().split('T')[0]);
    setSelectedCustomer(sale.customerId);
    setCustomerSearch(sale.customerName);
    setCart(sale.items);
    setPaymentType(sale.paymentType || '');
    setBillStatus(sale.status === 'paid' ? 'Paid' : 'Unpaid');
    setPackageLoaderAmt(sale.packageLoaderAmt.toString());
    setFreightCharges((sale.freight_charges ?? 0).toString());
    setIsRoundOff(sale.roundOff !== 0);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    try {
      await db.deleteSale(saleToDelete.id);
      setShowDeleteConfirm(false);
      setSaleToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting sale:", error);
      setErrorMessage("Failed to delete record.");
    }
  };

  const handleCreateSale = async () => {
    setModalError(null);

    // 1. Bill Number Validation
    if (!billNumber || billNumber.trim() === '') {
      setModalError("Bill Number is empty or ungenerated. Please enter a valid Bill Number.");
      toast.error("Validation error: Bill Number is required!");
      return;
    }

    // 2. Date Validation
    if (!billDate || !isValidDate(billDate)) {
      setModalError("Please select a valid calendar date.");
      toast.error("Validation error: Date is required!");
      return;
    }

    // 3. Customer Name Validation
    if (!selectedCustomer) {
      setModalError("Please select a customer.");
      toast.error("Validation error: Customer is required!");
      return;
    }

    // 4. Cart Validation
    if (cart.length === 0) {
      setModalError("Cart is empty. Add items before generating.");
      return;
    }
    const finalCart = cart.filter(item => item.productId);
    if (finalCart.length === 0) {
      setModalError("Please add at least one item to save.");
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) {
      setModalError("Selected customer not found.");
      return;
    }

    // 5. Bill Status and Sale Type Validation (Only for active Invoices)
    if (saleType === 'invoice') {
      if (!billStatus || (billStatus !== 'Paid' && billStatus !== 'Unpaid')) {
        setModalError("Please select a Bill Status (Paid or Unpaid). Unmarked status is not allowed.");
        toast.error("Validation error: Bill Status is required!");
        return;
      }
      if (!paymentType || (paymentType !== 'Cash' && paymentType !== 'Credit')) {
        setModalError("Please select exactly one Sale Type (Counter Sale or Credit Sale). Unmarked sale type is not allowed.");
        toast.error("Validation error: Sale Type is required!");
        return;
      }
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Stock Validation for Invoices
      if (saleType === 'invoice') {
        const freshInventory = await db.getInventory();
        let oldSaleItemsMap = new Map();
        
        // If editing, add back old quantities to get actual available stock
        if (editingSaleId) {
          const oldSale = sales.find(s => s.id === editingSaleId);
          if (oldSale && oldSale.type === 'invoice') {
            oldSale.items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              let qtyInBase = item.quantity;
              if (product && item.unit === product.secondaryUnit && product.conversionRate) {
                qtyInBase = item.quantity * product.conversionRate;
              }
              oldSaleItemsMap.set(item.productId, (oldSaleItemsMap.get(item.productId) || 0) + qtyInBase);
            });
          }
        }

        const problematicItems = [];
        for (const item of finalCart) {
          const product = products.find(p => p.id === item.productId);
          if (!product) continue;

          const inv = freshInventory.find(i => i.productId === item.productId);
          const currentStock = Number(inv ? inv.quantity : 0) + Number(oldSaleItemsMap.get(item.productId) || 0);

          let requestedQtyInBase = Number(item.quantity) || 0;
          if (item.unit === product.secondaryUnit && product.conversionRate) {
            requestedQtyInBase = (Number(item.quantity) || 0) * (Number(product.conversionRate) || 1);
          }

          if (requestedQtyInBase > currentStock) {
            const displayStock = isNaN(currentStock) ? 0 : currentStock;
            problematicItems.push({
              name: item.name,
              requested: requestedQtyInBase,
              available: displayStock
            });
          }
        }

        if (problematicItems.length > 0) {
          const itemLines = problematicItems.map(pItem => `- ${pItem.name}: Requested ${pItem.requested} qty, but only ${pItem.available} in stock`).join('\n');
          setModalError(`Insufficient Stock! Please correct quantities before saving:\n${itemLines}`);
          setIsSubmitting(false);
          toast.error("Validation error: Products out of stock!");
          return;
        }
      }

      const newSale: Sale = {
        id: editingSaleId || crypto.randomUUID(),
        billNumber: billNumber,
        customerId: customer.id,
        customerName: customer.name,
        items: finalCart,
        subtotal,
        packageLoaderAmt: pkgLoader,
        roundOff: roundOffAmt,
        total,
        freight_charges: freightAmt,
        grand_total: total,
        type: saleType,
        paymentType: saleType === 'estimate' ? 'estimate' : (paymentType || 'Cash'),
        status: saleType === 'estimate' ? 'estimate' : (billStatus === 'Paid' ? 'paid' : 'pending'),
        remainingBalance: saleType === 'estimate' ? 0 : (billStatus === 'Paid' ? 0 : total),
        date: billDate
      };

      await db.addSale(newSale);

      setIsModalOpen(false);
      setEditingSaleId(null);
      setCart([]);
      setSelectedCustomer('');
      setCustomerSearch('');
      setFreightCharges('0');
      loadData();
    } catch (error) {
      console.error("Error creating sale:", error);
      setModalError("Failed to save billing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmConvert = async () => {
    if (!editingSaleId) return;
    try {
      // Mark the original estimate as deleted/converted so it doesn't show up in estimate history
      const originalSale = sales.find(s => s.id === editingSaleId);
      if (originalSale) {
        await db.deleteSale(originalSale.id);
      }

      // Transition the mode instantly to Invoice and unlock/reveal status controllers
      setSaleType('invoice');
      setBillNumber(convertConfirm.newNo);
      setBillStatus('');
      setPaymentType('');
      setEditingSaleId(null); // Save as new invoice
      setModalError(null);

      toast.success(`Estimate converted to Invoice #${convertConfirm.newNo}! Please configure status parameters below and Save.`);
    } catch (error) {
      console.error("Error converting estimate to invoice:", error);
      setModalError("Failed to convert estimate to invoice.");
    } finally {
      setConvertConfirm({ isOpen: false, oldNo: '', newNo: '' });
    }
  };

  const handleCancelConvert = () => {
    setSaleType('estimate');
    setConvertConfirm({ isOpen: false, oldNo: '', newNo: '' });
  };

  const generatePDF = (sale: Sale, download = true) => {
    const isA5 = settings.printFormat === 'A5';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA5 ? 'a5' : 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    if (isA5) {
      // Optimized A5 Header
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
      // Header
      doc.setFillColor(0, 0, 0); // Pure Black for the bar as requested for academic/professional look? 
      // Actually user wanted "Normal Bold Black (700)" for numbers and "Centered and bold" for header.
      // Let's stick to centered header.
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(22);
      doc.setFont('times', 'bold');
      doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.text('Trichy', pageWidth / 2, 21, { align: 'center' });
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(15, 25, pageWidth - 15, 25);
    }

      const addr = settings.shopAddress || '';
      doc.text(addr, 15, 30);

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
    doc.setFont('times', 'bold');
    doc.text(`Date: ${formatDate(sale.date)}`, pageWidth - 15, startY, { align: 'right' });
    doc.text(`Bill No: ${sale.billNumber || sale.id}`, pageWidth - 15, startY + 5, { align: 'right' });

    // Items Table
    const hasTax = sale.items.some(item => item.tax > 0);
    const headRow = hasTax 
      ? ['Item', 'Qty', 'Unit', 'Price', 'Disc', 'Tax', 'Total']
      : ['Item', 'Qty', 'Unit', 'Price', 'Disc', 'Total'];

    const tableData = sale.items.map(item => {
      const row = [
        item.name,
        item.quantity.toString(),
        getUnitAbbreviation(item.unit),
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
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontSize: isA5 ? 8 : 10,
        font: 'times',
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: { 
        fontSize: isA5 ? 8 : 10, 
        cellPadding: isA5 ? 2 : 3,
        font: 'times',
        textColor: [0, 0, 0]
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

    doc.setFont('times', 'normal');
    doc.setFontSize(isA5 ? 9 : 11);
    
    doc.text('Subtotal:', labelX, currentY, { align: 'right' });
    doc.setFont('times', 'bold');
    doc.text(sale.subtotal.toFixed(2), valueX, currentY, { align: 'right' });
    
    currentY += 6;
    doc.setFont('times', 'normal');
    doc.text('Pkg & Loader:', labelX, currentY, { align: 'right' });
    doc.setFont('times', 'bold');
    doc.text(sale.packageLoaderAmt.toFixed(2), valueX, currentY, { align: 'right' });
    
    if (sale.roundOff !== 0) {
      currentY += 6;
      doc.setFont('times', 'normal');
      doc.text('Round Off:', labelX, currentY, { align: 'right' });
      doc.setFont('times', 'bold');
      doc.text(sale.roundOff.toFixed(2), valueX, currentY, { align: 'right' });
    }
    
    currentY += 8;
    doc.setFontSize(isA5 ? 10 : 13);
    doc.setFont('times', 'bold');
    doc.text('Total:', labelX, currentY, { align: 'right' });
    doc.text(sale.total.toFixed(2), valueX, currentY, { align: 'right' });

    if (download) {
      const fileName = `${sale.customerName.replace(/\s+/g, '_')}_${sale.billNumber || sale.id}.pdf`;
      doc.save(fileName);
    }
    return doc;
  };

  const shareWhatsApp = (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    if (!customer || !customer.phone) {
      setErrorMessage('Customer phone number not found!');
      return;
    }

    setErrorMessage(null);
    let message = `*AutoERP ${sale.type.toUpperCase()}*\n`;
    message += `Ref: ${sale.billNumber || sale.id}\n`;
    message += `Date: ${formatDate(sale.date)}\n\n`;
    message += `*Items:*\n`;
    sale.items.forEach(item => {
      message += `- ${item.name} x${item.quantity} (Rs.${item.total.toFixed(2)})\n`;
    });
    message += `\n*Subtotal:* Rs.${sale.subtotal.toFixed(2)}\n`;
    message += `*Pkg & Loader:* Rs.${sale.packageLoaderAmt.toFixed(2)}\n`;
    if (sale.roundOff !== 0) {
      message += `*Round Off:* Rs.${sale.roundOff.toFixed(2)}\n`;
    }
    message += `*Total:* Rs.${sale.total.toFixed(2)}\n\n`;
    message += `Thank you for your business!`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${customer.phone}?text=${encodedMessage}`, '_blank');
  };

  const filteredSales = sales.filter(sale => {
    const matchesType = sale.type === activeTab;
    const matchesDate = dateFilter ? new Date(sale.date).toISOString().split('T')[0] === dateFilter : true;
    const matchesCustomer = customerFilter ? sale.customerId === customerFilter : true;
    return matchesType && matchesDate && matchesCustomer;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { selectedIndex } = useTableKeyNav({
    items: filteredSales,
    onEnter: (index) => handleEditSale(filteredSales[index]),
    onDelete: (index) => {
      setSaleToDelete(filteredSales[index]);
      setShowDeleteConfirm(true);
    }
  });

  // Real-time price calculation for current selection in modal
  const getLivePriceData = () => {
    if (!selectedProduct) return null;
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return null;

    const qty = parseFloat(quantity) || 0;
    const conversionRate = product.conversionRate || 1;
    
    let qtyInSecondary = qty;
    if (selectedUnit === product.baseUnit && conversionRate) {
      qtyInSecondary = qty / conversionRate;
    }

    let baseWholesalePrice = product.price || 0;
    let isWholesaleApplied = false;
    
    if (product.wholesalePrices && product.wholesalePrices.length > 0) {
      const applicableTier = [...product.wholesalePrices]
        .sort((a, b) => b.qty - a.qty)
        .find(tier => qtyInSecondary >= tier.qty);
      
      if (applicableTier) {
        baseWholesalePrice = applicableTier.price;
        isWholesaleApplied = true;
      }
    }

    const priceUnit = product.salePriceUnit || 'Base Unit';
    let effectivePrice = baseWholesalePrice;

    if (priceUnit === 'Base Unit') {
      if (selectedUnit === product.secondaryUnit && conversionRate) {
        effectivePrice = baseWholesalePrice * conversionRate;
      }
    } else {
      if (selectedUnit === product.baseUnit && conversionRate) {
        effectivePrice = baseWholesalePrice / conversionRate;
      }
    }

    return { effectivePrice, isWholesaleApplied };
  };

  const livePriceData = getLivePriceData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-[22px] font-bold font-sans text-[#2a9df4] uppercase tracking-tight whitespace-nowrap">SALES MANAGEMENT</h2>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('invoice')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                activeTab === 'invoice' 
                  ? "bg-white dark:bg-gray-700 text-[#2a9df4] shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('estimate')}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                activeTab === 'estimate' 
                  ? "bg-white dark:bg-gray-700 text-[#2a9df4] shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Estimates
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto lg:justify-end">
          <div className="flex-1 sm:flex-none">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-[#2a9df4]"
            />
          </div>
          <div className="flex-1 sm:flex-none">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-00 dark:bg-gray-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-[#2a9df4] min-w-[130px]"
            >
              <option value="">All Customers</option>
              {customers.filter(c => c.groupId !== 'vendor').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {(dateFilter || customerFilter) && (
            <button 
              onClick={() => { setDateFilter(''); setCustomerFilter(''); }}
              className="px-2 py-1.5 text-xs text-red-500 hover:text-red-600 font-medium whitespace-nowrap"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => {
              setErrorMessage(null);
              setModalError(null);
              setCart([]);
              setSelectedCustomer('');
              setSaleType(activeTab === 'estimate' ? 'estimate' : 'invoice'); // Default to current tab type
              setBillStatus('');
              setPaymentType('');
              setFreightCharges('0');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#2a9df4] px-4 py-1.5 text-[10pt] font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-600 uppercase tracking-widest whitespace-nowrap ml-auto sm:ml-0"
          >
            <Plus size={16} /> New Billing
          </button>
        </div>
      </div>


      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <X size={16} className="bg-red-600 text-white rounded-full p-0.5" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
            <Trash2 size={18} />
          </button>
        </div>
      )}

      <div className="w-full bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-[#9ff270] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Date</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Bill No</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400">Customer</th>
              {activeTab !== 'estimate' && (
                <th className="px-3 py-2 text-center text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-24">Status</th>
              )}
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Amount</th>
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#9ff270] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {filteredSales.map((sale, idx) => {
              const isPaid = sale.status === 'paid' || sale.status === 'settled';
              const isSelected = idx === selectedIndex;
              return (
                <tr 
                  key={sale.id} 
                  data-row-index={idx}
                  className={cn(
                    "hover:bg-blue-50/50 transition-colors",
                    idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20 outline outline-1 outline-blue-300 z-10 relative"
                  )}
                >
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                    {formatDate(sale.date)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-medium text-gray-900 dark:text-white uppercase tracking-wider border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="font-bold">{sale.billNumber || sale.id.split('-')[0]}</div>
                    {sale.type !== 'estimate' && (
                      <div className="text-[10px] text-gray-500 font-medium">{sale.paymentType || 'Credit'}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-white text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                    {sale.customerName}
                  </td>
                  {activeTab !== 'estimate' && (
                    <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                        isPaid ? "bg-green-100 text-green-600 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
                      )}>
                        {isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-black dark:text-white text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    {sale.total.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-500 border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-end gap-3 translate-x-0">
                      <button onClick={() => generatePDF(sale)} className="text-gray-600 dark:text-gray-400 hover:text-[#2a9df4] dark:hover:text-[#2a9df4]" title="Download PDF">
                        <Download size={16} />
                      </button>
                      <button onClick={() => shareWhatsApp(sale)} className="text-gray-600 dark:text-gray-400 hover:text-green-500" title="Share via WhatsApp">
                        <MessageCircle size={16} />
                      </button>
                      <button onClick={() => handleEditSale(sale)} className="text-gray-600 dark:text-gray-400 hover:text-blue-500" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setSaleToDelete(sale);
                          setShowDeleteConfirm(true);
                        }} 
                        className="text-gray-600 dark:text-gray-400 hover:text-red-500" 
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan={activeTab === 'estimate' ? 5 : 6} className="px-6 py-10 text-center text-[12px] text-gray-500 dark:text-gray-400">
                  No transactions to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[70] flex flex-col animate-in fade-in duration-200 overflow-hidden">
          {/* Condensed Header Section */}
          <div className="h-20 border-b border-gray-100 dark:border-gray-800 flex items-center px-6 bg-white dark:bg-gray-900 sticky top-0 z-20 gap-8">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 whitespace-nowrap">
              <button 
                onClick={() => navigate('/')} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-red-500"
                title="Back to Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
              {editingSaleId ? 'Edit' : 'New'} {saleType === 'invoice' ? 'Invoice' : 'Estimate'}
            </h3>
            
            <div className="flex items-center gap-4 flex-1">
              <div className="flex flex-col gap-1">
                <span className="text-[10pt] font-bold text-gray-400">Bill No</span>
                <input 
                  ref={billNoInputRef}
                  autoFocus
                  value={billNumber} 
                  onChange={e => setBillNumber(e.target.value)}
                  readOnly={!!editingSaleId}
                  onKeyDown={handleBillNoKeyDown}
                  className={cn(
                    "bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 text-sm font-bold text-gray-900 dark:text-white focus:border-[#2a9df4] outline-none outline-0",
                    editingSaleId && "opacity-75 cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                  )} 
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
                  onKeyDown={handleBillDateKeyDown}
                  className={cn(
                    "bg-gray-50 dark:bg-gray-800 border-2 rounded-lg px-3 text-sm font-bold text-gray-900 dark:text-white focus:border-[#2a9df4] outline-none outline-0",
                    !isValidDate(billDate) ? "border-red-500" : "border-gray-100 dark:border-gray-700"
                  )}
                  style={{ height: '12mm', width: '160px' }}
                />
              </div>
              <div className="flex flex-col gap-1 relative" style={{ width: '380px' }}>
                <div className="flex justify-between items-center pr-2">
                  <span className="text-[10pt] font-bold text-gray-400">Search Customer</span>
                  <button 
                    onClick={() => setIsQuickAddOpen(true)}
                    className="text-[10px] font-bold text-[#2a9df4] hover:underline uppercase tracking-widest"
                  >
                    + NEW CUSTOMER
                  </button>
                </div>
                <div className="relative">
                  <input 
                    ref={customerInputRef}
                    type="text"
                    placeholder="Type customer name..."
                    value={customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (selectedCustomer) setSelectedCustomer('');
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onKeyDown={handleCustomerKeyDown}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg px-3 pl-10 text-sm font-bold text-[#000000] dark:text-white focus:border-[#2a9df4] outline-none outline-0"
                    style={{ height: '12mm' }}
                  />
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  
                  {showCustomerDropdown && customerSearch.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto">
                      {filteredCustomers.map((c, idx) => (
                        <div 
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c.id);
                            setCustomerSearch(c.name);
                            setShowCustomerDropdown(false);
                            if (cart.length === 0) addItem();
                          }}
                          className={cn(
                            "px-6 py-2 cursor-pointer transition-colors",
                            idx === customerIdx ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                          <div className="text-xs text-gray-400">WhatsApp: {c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors text-gray-400 hover:text-red-500"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Feedback */}
          {importStatus.message && (
            <div className={cn(
              "px-6 py-2 text-sm font-bold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300",
              importStatus.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
            )}>
              {importStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {importStatus.message}
            </div>
          )}

          {/* Validation Alert */}
          {modalError && (
            <div className="mx-6 my-2 px-4 py-3 bg-red-50 dark:bg-red-950/25 border-2 border-red-200 dark:border-red-900/40 rounded-lg flex items-start gap-2.5 text-red-700 dark:text-red-400 font-medium text-xs animate-in slide-in-from-top-2 whitespace-pre-line">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-bold uppercase tracking-wider mb-0.5">Validation Alert</div>
                <div>{modalError}</div>
              </div>
              <button onClick={() => setModalError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 font-bold self-start uppercase text-[9px] tracking-widest bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                Dismiss
              </button>
            </div>
          )}

          {/* Item Table - Scrollable Body */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 no-scrollbar">
            <table className="w-full border-collapse sticky top-0">
              <thead className="sticky top-0 z-10 bg-[#9ff270] border-b-[1px] border-gray-400">
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
                {cart.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <tr key={idx} className={cn(
                      "hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors h-[30px]",
                      item.isNew && "bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500"
                    )}>
                      <td className="px-3 py-1 relative border-[1px] border-gray-300 bg-orange-50/10 dark:bg-orange-900/5">
                        <input 
                          type="text"
                          data-row={idx}
                          data-col="category"
                          autoComplete="off"
                          placeholder="Category"
                          value={activeItemIndex === idx ? categorySearch : (item.category || '')}
                          onChange={e => {
                            setCategorySearch(e.target.value);
                            setActiveItemIndex(idx);
                            setShowCategoryDropdown(true);
                          }}
                          onFocus={() => {
                            setActiveItemIndex(idx);
                            setCategorySearch(item.category || '');
                            setShowCategoryDropdown(false);
                          }}
                          onKeyDown={e => {
                            const availableCats = categories.filter(c => (c || "").toLowerCase().includes(categorySearch.toLowerCase()));
                            if (showCategoryDropdown) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setCategoryIdx(prev => (prev < availableCats.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setCategoryIdx(prev => (prev > 0 ? prev - 1 : prev));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (availableCats[categoryIdx]) {
                                  updateItem(idx, 'category', availableCats[categoryIdx]);
                                  setShowCategoryDropdown(false);
                                  setTimeout(() => {
                                    const next = document.querySelector(`[data-row="${idx}"][data-col="product"]`) as HTMLElement;
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
                              handleGridKeyDown(e, idx, 'category');
                            }
                          }}
                          className="w-full bg-transparent text-[12px] font-normal text-black dark:text-white uppercase focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        />
                        {showCategoryDropdown && activeItemIndex === idx && (
                          <div className="absolute z-30 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto left-0">
                            {categories
                              .filter(c => (c || "").toLowerCase().includes(categorySearch.toLowerCase()))
                              .map((cat, i) => (
                              <div 
                                key={cat}
                                onClick={() => {
                                  updateItem(idx, 'category', cat);
                                  setShowCategoryDropdown(false);
                                  setTimeout(() => {
                                    const next = document.querySelector(`[data-row="${idx}"][data-col="product"]`) as HTMLElement;
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
                          type="text"
                          placeholder={item.productId ? "" : "Search product..."}
                          value={activeItemIndex === idx ? productSearch : (item.name || '')}
                          data-row={idx}
                          data-col="product"
                          autoComplete="off"
                          onChange={e => {
                            const val = e.target.value;
                            setProductSearch(val);
                            setActiveItemIndex(idx);
                            if (val.length > 0) {
                              setShowProductDropdown(true);
                            } else {
                              setShowProductDropdown(false);
                            }
                          }}
                          onFocus={(e) => {
                            setActiveItemIndex(idx);
                            const val = item.name || '';
                            setProductSearch(val);
                            setShowProductDropdown(false);
                          }}
                          onKeyDown={(e) => {
                            if (showProductDropdown) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setProductIdxLocal(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setProductIdxLocal(prev => (prev > 0 ? prev - 1 : prev));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                const selectedProduct = filteredProducts[productIdxLocal];
                                if (selectedProduct) {
                                  updateItem(idx, 'productId', selectedProduct.id);
                                  setShowProductDropdown(false);
                                  setProductSearch(selectedProduct.name);
                                  // Jump to Qty
                                  setTimeout(() => {
                                    const qtyElem = document.querySelector(`[data-row="${idx}"][data-col="quantity"]`) as HTMLElement;
                                    qtyElem?.focus();
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
                              handleGridKeyDown(e, idx, 'product');
                            }
                          }}
                          className={cn(
                            "w-full bg-transparent text-[12px] font-normal focus:ring-0 p-0 border-none placeholder:text-gray-300 focus:bg-blue-50 dark:focus:bg-blue-900/20",
                            item.isNew ? "text-red-600" : "text-black dark:text-white"
                          )}
                        />
                        {showProductDropdown && activeItemIndex === idx && filteredProducts.length > 0 && (
                          <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-auto left-0">
                            {filteredProducts.map((p, pIdx) => (
                              <div 
                                key={p.id}
                                onClick={() => {
                                  updateItem(idx, 'productId', p.id);
                                  setShowProductDropdown(false);
                                  setProductSearch(p.name);
                                  setTimeout(() => {
                                    const qtyElem = document.querySelector(`[data-row="${idx}"][data-col="quantity"]`) as HTMLElement;
                                    qtyElem?.focus();
                                  }, 50);
                                }}
                                className={cn(
                                  "px-6 py-3 cursor-pointer transition-colors border-b last:border-0 border-gray-50 dark:border-gray-700",
                                  pIdx === productIdxLocal ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                )}
                              >
                                <div className={cn(
                                  "font-normal",
                                  pIdx === productIdxLocal ? "text-blue-600" : "text-gray-900 dark:text-white"
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
                          type="number"
                          value={item.quantity}
                          onFocus={(e) => {
                            handleFocus(e);
                            setActiveItemIndex(null); // Reset when moving away from search field
                          }}
                          onWheel={handleWheel}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, idx, 'quantity')}
                          data-row={idx}
                          data-col="quantity"
                          className="bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none w-full focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        />
                      </td>
                      <td className="px-3 py-1 text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                        <select 
                          value={item.unit}
                          onFocus={() => setActiveItemIndex(null)}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, idx, 'unit')}
                          data-row={idx}
                          data-col="unit"
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
                      </td>
                      <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <input 
                          type="number"
                          value={item.price}
                          onFocus={(e) => {
                            handleFocus(e);
                            setActiveItemIndex(null);
                          }}
                          onWheel={handleWheel}
                          onChange={e => updateItem(idx, 'price', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, idx, 'price')}
                          data-row={idx}
                          data-col="price"
                          className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        />
                      </td>
                      <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <input 
                          type="number"
                          value={item.discount}
                          onFocus={(e) => {
                            handleFocus(e);
                            setActiveItemIndex(null);
                          }}
                          onWheel={handleWheel}
                          onChange={e => updateItem(idx, 'discount', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, idx, 'discount')}
                          data-row={idx}
                          data-col="discount"
                          className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        />
                      </td>
                      <td className="px-3 py-1 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <input 
                          type="number"
                          value={item.tax}
                          onFocus={(e) => {
                            handleFocus(e);
                            setActiveItemIndex(null);
                          }}
                          onWheel={handleWheel}
                          onChange={e => updateItem(idx, 'tax', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, idx, 'tax')}
                          data-row={idx}
                          data-col="tax"
                          className="w-full bg-transparent text-right text-[12px] font-normal text-gray-900 dark:text-white focus:ring-0 p-0 border-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                        />
                      </td>
                      <td className="px-3 py-1 text-right text-[12px] font-normal text-gray-900 dark:text-white font-mono border-[0.5px] border-gray-100 dark:border-gray-800">{item.total.toFixed(2)}</td>
                      <td className="px-3 py-1 text-center text-gray-400 hover:text-red-500 border-[0.5px] border-gray-100 dark:border-gray-800">
                        <button onClick={() => removeItem(idx)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                   <td colSpan={9} className="px-4 py-4">
                     <button 
                       onClick={addItem}
                       className="text-[10px] font-bold text-[#2a9df4] uppercase tracking-widest flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 hover:scale-105 transition-transform"
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
              
              {/* 1. BILL CONFIG (Buttons directly) */}
              <div className="flex gap-1 flex-shrink-0">
                {['invoice', 'estimate'].map(type => {
                  const originalSale = editingSaleId ? sales.find(s => s.id === editingSaleId) : null;
                  const isEditingEstimate = originalSale && originalSale.type === 'estimate';
                  return (
                    <button
                      key={type}
                      onClick={async () => {
                        if (type === 'invoice' && saleType === 'estimate' && isEditingEstimate) {
                          try {
                            const freshInventory = await db.getInventory();
                            const problematicItems = [];
                            const finalCart = cart.filter(item => item.productId);

                            for (const item of finalCart) {
                              const product = products.find(p => p.id === item.productId);
                              if (!product) continue;

                              const inv = freshInventory.find(i => i.productId === item.productId);
                              const currentStock = Number(inv ? inv.quantity : 0);

                              let requestedQtyInBase = Number(item.quantity) || 0;
                              if (item.unit === product.secondaryUnit && product.conversionRate) {
                                requestedQtyInBase = (Number(item.quantity) || 0) * (Number(product.conversionRate) || 1);
                              }

                              if (currentStock <= 0 || currentStock < requestedQtyInBase) {
                                problematicItems.push({
                                  name: item.name,
                                  billedQty: requestedQtyInBase,
                                  currentStock: currentStock,
                                  shortage: currentStock - requestedQtyInBase
                                });
                              }
                            }

                            if (problematicItems.length > 0) {
                              setStockWarningModal({
                                isOpen: true,
                                items: problematicItems
                              });
                              return;
                            }

                            const nextInvoiceNo = await db.getNextReferenceNumber('invoice');
                            setConvertConfirm({
                              isOpen: true,
                              oldNo: billNumber || originalSale?.billNumber || '',
                              newNo: nextInvoiceNo
                            });
                          } catch (err) {
                            console.error("Failed to fetch invoice number or check stock:", err);
                          }
                        } else {
                          setSaleType(type as any);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all uppercase tracking-widest",
                        saleType === type 
                          ? "bg-[#2a9df4] text-white shadow-sm font-bold" 
                          : "bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-gray-100"
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              {/* Real-time Status and Document Classification Toggles (Only visible when Invoice is selected) */}
              {saleType === 'invoice' && (
                <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-700 pl-3">
                  {/* Bill Status Toggle */}
                  <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-100 dark:border-gray-700 h-8">
                    <button
                      type="button"
                      onClick={() => setBillStatus('Paid')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all h-full flex items-center",
                        billStatus === 'Paid'
                          ? "bg-green-600 text-white shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      )}
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillStatus('Unpaid')}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all h-full flex items-center",
                        billStatus === 'Unpaid'
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      )}
                    >
                      Unpaid
                    </button>
                  </div>

                  {/* Sale Type Selection - Side-by-Side Checkboxes */}
                  <div className="flex items-center gap-3 h-8">
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        id="counter-sale-checkbox"
                        checked={paymentType === 'Cash'}
                        onChange={e => {
                          if (e.target.checked) setPaymentType('Cash');
                          else if (paymentType === 'Cash') setPaymentType('');
                        }}
                        className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="counter-sale-checkbox" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer whitespace-nowrap">
                        Counter Sale
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        id="credit-sale-checkbox"
                        checked={paymentType === 'Credit'}
                        onChange={e => {
                          if (e.target.checked) setPaymentType('Credit');
                          else if (paymentType === 'Credit') setPaymentType('');
                        }}
                        className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="credit-sale-checkbox" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer whitespace-nowrap">
                        Credit Sale
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SMART ROUND OFF */}
              <div className="flex items-center gap-2 flex-shrink-0 h-8">
                <div className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="round-off-check"
                    checked={useSmartRounding} 
                    onChange={e => setUseSmartRounding(e.target.checked)} 
                    className="w-3.5 h-3.5 text-[#2a9df4] rounded focus:ring-0 border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="round-off-check" className="text-[10px] font-medium text-gray-400 uppercase tracking-widest cursor-pointer whitespace-nowrap">Round Off</label>
                </div>
                <input 
                  type="number"
                  onFocus={handleFocus}
                  onWheel={handleWheel}
                  value={roundOff}
                  onChange={e => {
                    setRoundOff(parseFloat(e.target.value) || 0);
                    setUseSmartRounding(false);
                  }}
                  className="w-14 text-right font-medium text-gray-900 dark:text-white focus:ring-0 p-0 border-none bg-transparent text-sm"
                />
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

              {/* 5. SUB TOTAL */}
              <div className="flex items-center gap-2 flex-shrink-0 h-8">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest whitespace-nowrap">Sub Total</span>
                <span className="text-sm font-normal text-gray-900 dark:text-white">{subtotal.toFixed(2)}</span>
              </div>

              {/* 6. TOTAL */}
              <div className="flex items-center gap-2 flex-shrink-0 h-8">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Total</span>
                <span className="text-lg font-bold text-[#2a9df4] whitespace-nowrap tracking-tight">Rs. {total.toFixed(2)}</span>
              </div>

              {/* 7. ACTIONS */}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0 h-8">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="py-1.5 px-4 rounded-md text-[10px] font-medium uppercase tracking-widest bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000] border-2 border-transparent transition-all outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateSale}
                  disabled={isSubmitting || cart.length === 0}
                  className="py-1.5 px-6 rounded-md text-[10px] font-medium uppercase tracking-widest bg-[#2a9df4] text-white hover:bg-[#1e8ad4] transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  {isSubmitting ? 'Saving...' : `Save ${saleType === 'invoice' ? 'Invoice' : 'Estimate'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this {saleToDelete?.type}? It will be moved to the Recycle Bin and can be restored if needed.
              {saleToDelete?.type === 'invoice' && " Stock will be automatically reversed to inventory."}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSaleToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteSale}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Quick Add Party</h3>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Party Name *</label>
                <input 
                  autoFocus
                  type="text"
                  value={quickAddForm.name}
                  onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Enter shop or person name..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">WhatsApp Number</label>
                <input 
                  type="text"
                  value={quickAddForm.phone}
                  onChange={e => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="10 digit mobile number..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">District / Area</label>
                <input 
                  type="text"
                  value={quickAddForm.address}
                  onChange={e => setQuickAddForm({ ...quickAddForm, address: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-transparent focus:border-[#2a9df4] rounded-xl px-4 py-3 text-sm font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="City or Town..."
                />
              </div>
              
              <button 
                onClick={handleQuickAddCustomer}
                disabled={!quickAddForm.name}
                className="w-full py-4 rounded-xl bg-[#2a9df4] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none mt-2"
              >
                Save & Select
              </button>
            </div>
          </div>
        </div>
      )}
      <SettlementModal
        isOpen={settlementInfo.isOpen}
        onClose={() => setSettlementInfo({ isOpen: false, item: null, type: 'Paid' })}
        title={settlementInfo.type === 'Paid' ? "Payment received completely?" : "Payment NOT received completely?"}
        type={settlementInfo.type}
        refNo={settlementInfo.item?.id || ''}
        onConfirm={async () => {
          if (!settlementInfo.item) return;
          const sale = await db.getSale(settlementInfo.item.id);
          if (sale) {
            let amountDelta = 0;
            if (settlementInfo.type === 'Paid') {
              amountDelta = -(sale.remainingBalance || sale.total);
              sale.remainingBalance = 0;
              sale.status = 'paid';
            } else {
              amountDelta = sale.total;
              sale.remainingBalance = sale.total;
              sale.status = 'pending';
            }
            await db.addSale(sale);
            await db.updateCustomerBalance(sale.customerId, amountDelta);
            loadData();
          }
          setSettlementInfo({ isOpen: false, item: null, type: 'Paid' });
        }}
      />
      {convertConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4">Confirm Conversion</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm font-medium">
              {convertConfirm.oldNo} will be permanently converted to {convertConfirm.newNo}
            </p>
            <div className="flex justify-end gap-3 text-xs uppercase tracking-widest font-bold">
              <button 
                onClick={handleCancelConvert}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmConvert}
                className="px-4 py-2 bg-[#2a9df4] hover:bg-blue-600 text-white rounded-md transition-all shadow-md shadow-blue-500/20"
              >
                Convert to Invoice
              </button>
            </div>
          </div>
        </div>
      )}
      {stockWarningModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-xl w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                Cannot Convert — Insufficient Stock
              </h3>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The following products in this estimate do not have enough stock in inventory to compile an invoice.
            </p>

            <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Billed Qty</th>
                    <th className="p-3 text-center">Current Stock</th>
                    <th className="p-3 text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stockWarningModal.items.map((item, idx) => (
                    <tr key={idx} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="p-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                      <td className="p-3 text-center text-gray-600 dark:text-gray-300">{item.billedQty} qty</td>
                      <td className="p-3 text-center text-gray-600 dark:text-gray-300">{item.currentStock} stock</td>
                      <td className="p-3 text-right font-bold text-red-600">{item.shortage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 text-xs uppercase tracking-widest font-bold">
              <button 
                onClick={() => {
                  setStockWarningModal({ isOpen: false, items: [] });
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel Conversion
              </button>
              <button 
                onClick={() => {
                  setStockWarningModal({ isOpen: false, items: [] });
                  setIsModalOpen(false);
                  navigate('/products');
                }}
                className="px-4 py-2 bg-[#2a9df4] hover:bg-blue-600 text-white rounded-md transition-all shadow-md shadow-blue-500/20"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
