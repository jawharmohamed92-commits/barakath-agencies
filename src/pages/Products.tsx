import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, Product, Inventory } from '../lib/db';
import { Plus, Pencil, Trash2, ArrowLeft, Package, Download, FileUp, Search, X, AlertCircle, TrendingUp, RefreshCw, Printer, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSettings } from '../context/SettingsContext';
import { useTableKeyNav } from '../hooks/useTableKeyNav';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'low-stock' | 'out-of-stock' | 'valuation'>('standard');
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
  const [importStatus, setImportStatus] = useState<{message: string; type: 'success' | 'error' | null}>({message: '', type: null});
  const [stockModal, setStockModal] = useState<{ isOpen: boolean; product: Product | null }>({ isOpen: false, product: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  useEffect(() => {
    loadData();
    
    // Support URL filters
    const filter = searchParams.get('filter');
    if (filter === 'out-of-stock') {
      setViewMode('out-of-stock');
      setIsWorkspaceActive(true);
    }
    if (filter === 'low-stock') {
      setViewMode('low-stock');
      setIsWorkspaceActive(true);
    }
  }, [searchParams]);

  const loadData = async () => {
    const [pData, iData] = await Promise.all([
      db.getProducts(),
      db.getInventory()
    ]);
    setProducts(pData.filter(p => !p.isDeleted));
    setInventory(iData);
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category || 'ACTIVE ITEMS'))).sort() as string[];
    return cats;
  }, [products]);

  const stats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;

    const categoryStats: Record<string, { low: number; out: number; value: number }> = {};

    products.forEach(p => {
      const cat = p.category || 'ACTIVE ITEMS';
      const inv = inventory.find(i => i.productId === p.id);
      const stock = inv?.quantity || 0;
      const purchasePrice = p.purchasePrice || 0;
      const isLow = stock <= (inv?.minStockLevel || 0) && stock > 0;
      const isOut = stock === 0;

      if (isLow) lowStockCount++;
      if (isOut) outOfStockCount++;
      totalValue += stock * purchasePrice;

      if (!categoryStats[cat]) {
        categoryStats[cat] = { low: 0, out: 0, value: 0 };
      }
      if (isLow) categoryStats[cat].low++;
      if (isOut) categoryStats[cat].out++;
      categoryStats[cat].value += stock * purchasePrice;
    });

    return {
      lowStockCount,
      outOfStockCount,
      totalValue,
      categoryStats
    };
  }, [products, inventory]);

  const filteredCategories = useMemo(() => {
    if (viewMode === 'low-stock') {
      return categories.filter(cat => stats.categoryStats[cat]?.low > 0);
    }
    if (viewMode === 'out-of-stock') {
      return categories.filter(cat => stats.categoryStats[cat]?.out > 0);
    }
    return categories;
  }, [categories, viewMode, stats.categoryStats]);

  const filteredProducts = products.filter(p => {
    const inv = inventory.find(i => i.productId === p.id);
    const stock = inv?.quantity || 0;
    
    let matchesView = true;
    if (viewMode === 'low-stock') {
      matchesView = stock <= (inv?.minStockLevel || 0) && stock > 0;
    } else if (viewMode === 'out-of-stock') {
      matchesView = stock === 0;
    }

    const matchesCategory = !selectedCategory || (p.category || 'ACTIVE ITEMS') === selectedCategory;
    const matchesSearch = String(p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                         String(p.sku || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesView && matchesCategory && matchesSearch;
  });

  const { selectedIndex } = useTableKeyNav({
    items: filteredProducts,
    onEnter: (index) => navigate(`/products/edit/${filteredProducts[index].id}`),
    onDelete: (index) => setDeleteModal({ isOpen: true, id: filteredProducts[index].id, name: filteredProducts[index].name })
  });

  const handleDelete = async () => {
    const { id, name } = deleteModal;
    if (!id) return;

    try {
      // 1. Instant-Vanish: Local State Update first
      setProducts(prev => prev.filter(p => p.id !== id));
      setDeleteModal({ isOpen: false, id: '', name: '' });
      
      // 2. Background Sync: Soft delete in database
      await db.deleteProduct(id);
      
      // 3. UI Feedback
      setImportStatus({ 
        message: `Item [${name}] moved to Recycle Bin.`, 
        type: 'success' 
      });

      // 4. Verification Sync
      await loadData();
    } catch (err) {
      console.error('Failed to delete product:', err);
      setImportStatus({ message: 'Error deleting product from Database.', type: 'error' });
      await loadData(); // Revert state from DB if failed
    }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveTarget || selectedProductIds.length === 0) return;

    try {
      const targetCat = bulkMoveTarget === 'ACTIVE ITEMS' ? '' : bulkMoveTarget;
      
      for (const id of selectedProductIds) {
        const product = products.find(p => p.id === id);
        if (product) {
          await db.addProduct({ ...product, category: targetCat });
        }
      }

      setImportStatus({ message: `Moved ${selectedProductIds.length} items to ${bulkMoveTarget}`, type: 'success' });
      setSelectedProductIds([]);
      setIsBulkMoveModalOpen(false);
      loadData();
    } catch (err) {
      setImportStatus({ message: 'Error moving products', type: 'error' });
    }
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handlePrintStockList = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileNameDate = now.toISOString().split('T')[0];
    
    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 22, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(settings.shopAddress || 'TRICHY', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('times', 'bold');
    const categoryTitle = selectedCategory ? selectedCategory.toUpperCase() : 'ALL CATEGORIES';
    const viewTitle = viewMode === 'low-stock' ? 'LOW STOCK' : viewMode === 'out-of-stock' ? 'OUT OF STOCK' : 'TOTAL PRODUCTS';
    doc.text(`${viewTitle} - ${categoryTitle}`, 15, 40);
    doc.setFontSize(10);
    doc.text(`Date: ${dateStr}`, pageWidth - 15, 40, { align: 'right' });

    // Table
    const tableData = filteredProducts.map(p => {
      const inv = inventory.find(i => i.productId === p.id);
      return [
        p.sku,
        p.name,
        p.category,
        inv?.quantity || 0,
        p.baseUnit || 'Nos'
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Item Code', 'Product Name', 'Category', 'Current Stock', 'Unit']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [42, 157, 244] },
      styles: { font: 'times' }
    });

    const categoryNameForFile = selectedCategory ? selectedCategory.replace(/\s+/g, '_') : 'All';
    doc.save(`Stocks_${categoryNameForFile}_${fileNameDate}.pdf`);
  };

  const handleExportTemplate = () => {
    const headers = [['ITEM CODE', 'PRODUCT NAME', 'CATEGORY', 'BASE UNIT', 'SECONDARY UNIT', 'CONV RATE (BASE)', 'PURCHASE PRICE', 'SALE PRICE', 'WHOLESALE PRICE', 'OPENING STOCK']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'product_import_template.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(ws);

        const currentProducts = await db.getProducts();
        const currentInventory = await db.getInventory();

        let importedCount = 0;
        let updatedCount = 0;

        for (const row of jsonData) {
          const sku = (row['ITEM CODE'] || '').toString().trim();
          const productName = (row['PRODUCT NAME'] || '').toString().trim();
          if (!productName) continue;

          // Merge Logic: Default to "GENERAL" if category missing or blank
          const excelCategory = (row['CATEGORY'] || '').toString().trim();
          const finalCategory = excelCategory || 'GENERAL';

          const wholesalePrice = parseFloat(row['WHOLESALE PRICE']) || 0;
          
          // Check if product exists by SKU
          const existingProduct = currentProducts.find(p => p.sku === sku);

          if (existingProduct) {
            // Update existing product's category and prices
            const updatedProduct: Product = {
              ...existingProduct,
              name: productName,
              category: finalCategory,
              baseUnit: row['BASE UNIT'] || existingProduct.baseUnit || 'Nos',
              secondaryUnit: row['SECONDARY UNIT'] || existingProduct.secondaryUnit || '',
              conversionRate: parseFloat(row['CONV RATE (BASE)']) || existingProduct.conversionRate || 1,
              price: parseFloat(row['SALE PRICE']) || existingProduct.price || 0,
              purchasePrice: parseFloat(row['PURCHASE PRICE']) || existingProduct.purchasePrice || 0,
              wholesalePrices: wholesalePrice > 0 ? [{ qty: 1, price: wholesalePrice }] : existingProduct.wholesalePrices
            };
            await db.addProduct(updatedProduct);
            updatedCount++;
          } else {
            // Create new product
            const product: Product = {
              id: crypto.randomUUID(),
              name: productName,
              sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
              category: finalCategory,
              baseUnit: row['BASE UNIT'] || 'Nos',
              secondaryUnit: row['SECONDARY UNIT'] || '',
              conversionRate: parseFloat(row['CONV RATE (BASE)']) || 1,
              price: parseFloat(row['SALE PRICE']) || 0,
              purchasePrice: parseFloat(row['PURCHASE PRICE']) || 0,
              openingStock: parseFloat(row['OPENING STOCK']) || 0,
              wholesalePrices: wholesalePrice > 0 ? [{ qty: 1, price: wholesalePrice }] : [],
              createdAt: new Date().toISOString()
            };

            await db.addProduct(product);
            
            // Sync Inventory for new products only
            await db.updateInventory({
              id: crypto.randomUUID() + '_inv',
              productId: product.id,
              quantity: product.openingStock || 0,
              minStockLevel: 5,
              lastUpdated: new Date().toISOString()
            });
            importedCount++;
          }
        }

        setImportStatus({ 
          message: `Import Status: ${importedCount} New, ${updatedCount} Updated`, 
          type: 'success' 
        });
        loadData();
      } catch (err) {
        console.error('Import Error:', err);
        setImportStatus({ message: 'Error importing products. Please check the template.', type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  if (selectedCategory !== null) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] w-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden font-sans p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Stage 2 Standardized Takeover Header Navigation Control */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700/50 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap py-1">
            <button 
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#2a9df4] border border-[#2a9df4]/30 hover:border-[#2a9df4] hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg transition-all font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft size={13} /> Back to Category Overview
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest font-mono flex items-center">
              {viewMode === 'standard' ? 'TOTAL PRODUCTS' :
               viewMode === 'low-stock' ? 'LOW STOCK' :
               viewMode === 'out-of-stock' ? 'OUT OF STOCK' : 'TOTAL STOCK VALUE'}
              <span className="mx-2 text-gray-300 dark:text-gray-600">{">"}</span>
              <span className="text-gray-900 dark:text-white font-serif font-bold">{selectedCategory.toUpperCase()}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Level 2 Search Integration */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input 
                type="text" 
                placeholder="Find in this category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-[#2a9df4]/30 rounded-md text-[11px] outline-none transition-all font-normal text-gray-900 dark:text-white"
              />
            </div>
            {selectedProductIds.length > 0 && selectedCategory === 'ACTIVE ITEMS' && (
              <button 
                onClick={() => setIsBulkMoveModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-all uppercase tracking-widest shadow-sm whitespace-nowrap cursor-pointer"
              >
                Move {selectedProductIds.length} Items
              </button>
            )}
            <button 
              onClick={handlePrintStockList}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-[#2a9df4] border border-[#2a9df4]/30 hover:bg-[#2a9df4]/10 rounded-md transition-all uppercase tracking-widest whitespace-nowrap cursor-pointer"
            >
              <Printer size={13} /> Print List
            </button>
          </div>
        </div>

        {/* High-Density Detailed Table list of Stage 2 Symmetrical Workspace */}
        <div className="flex-1 overflow-y-auto custom-scrollbar border border-transparent">
          <table className="w-full text-left bg-transparent" style={{ borderCollapse: 'collapse', border: 'none' }}>
            <thead className="sticky top-0 z-20 bg-white dark:bg-gray-800">
              <tr className="border-b border-transparent">
                <th className="px-2 py-[6px] w-10 text-center text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight bg-white dark:bg-gray-800" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleAllSelection}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight bg-white dark:bg-gray-800 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>PRODUCT NAME</th>
                <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight bg-white dark:bg-gray-800 w-28 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>SKU</th>
                <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight text-center bg-white dark:bg-gray-800 w-24 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>STOCK</th>
                {viewMode === 'valuation' ? (
                  <>
                    <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight text-right bg-white dark:bg-gray-800 w-28 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>PURCHASE COST</th>
                    <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight text-right bg-white dark:bg-gray-800 w-28 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>ASSET VALUE</th>
                  </>
                ) : (
                  <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight text-right bg-white dark:bg-gray-800 w-28 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>PRICE</th>
                )}
                <th className="px-2 py-[6px] text-[11px] font-bold font-serif text-gray-500 dark:text-gray-400 uppercase tracking-tight text-right sticky right-0 z-20 bg-white dark:bg-gray-800 w-28 whitespace-nowrap" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent bg-transparent">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'valuation' ? 7 : 6} className="px-2 py-8 text-center text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest text-[10px]" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                    No items found in this category.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, idx) => {
                  const inv = inventory.find(i => i.productId === product.id);
                  const stock = inv?.quantity || 0;
                  const purchasePrice = product.purchasePrice || 0;
                  const assetValue = stock * purchasePrice;
                  const isSelected = idx === selectedIndex;
                  
                  return (
                    <tr 
                      key={product.id} 
                      data-row-index={idx}
                      className={cn(
                        "hover:bg-gray-50/30 dark:hover:bg-gray-700/10 text-[11px] text-gray-900 dark:text-gray-100 font-normal transition-colors border-b border-transparent",
                        selectedProductIds.includes(product.id) ? "bg-blue-50/20 dark:bg-blue-900/5 mr-[-0.5px]" : "",
                        isSelected && "bg-blue-50/30 dark:bg-blue-900/10"
                      )}
                      style={{ borderBottomColor: 'transparent' }}
                    >
                      <td className="px-2 py-[6px] text-center bg-transparent" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-[6px] font-medium bg-transparent whitespace-normal" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>{product.name}</td>
                      <td className="px-2 py-[6px] text-gray-500 dark:text-gray-400 font-mono bg-transparent" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>{product.sku}</td>
                      <td className="px-2 py-[6px] text-center bg-transparent" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                        <span className={cn(
                          stock <= (inv?.minStockLevel || 0) && stock > 0 ? "text-red-500 font-bold" :
                          stock === 0 ? "text-red-600 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded font-bold text-[10px]" : "text-gray-900 dark:text-gray-100"
                        )}>
                          {stock} {product.baseUnit}
                        </span>
                      </td>
                      {viewMode === 'valuation' ? (
                        <>
                          <td className="px-2 py-[6px] text-right font-mono bg-transparent" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                            ₹ {purchasePrice.toLocaleString()}
                          </td>
                          <td className="px-2 py-[6px] text-right font-mono bg-transparent font-bold text-[#2a9df4]" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                            ₹ {assetValue.toLocaleString()}
                          </td>
                        </>
                      ) : (
                        <td className="px-2 py-[6px] text-right font-mono bg-transparent" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                          ₹ {product.price.toLocaleString()}
                        </td>
                      )}
                      <td className="px-2 py-[6px] text-right bg-white dark:bg-gray-800 transition-colors" style={{ verticalAlign: 'middle', padding: '6px 8px' }}>
                        <div className="flex justify-end items-center gap-1">
                          {viewMode === 'low-stock' || viewMode === 'out-of-stock' ? (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setStockModal({ isOpen: true, product });
                              }}
                              className="p-1 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-full transition-all cursor-pointer"
                              title="Update Stock"
                            >
                              <RefreshCw size={13} />
                            </button>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  navigate(`/products/edit/${product.id}`);
                                }}
                                className="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-all cursor-pointer"
                                title="Edit"
                              >
                                <Pencil size={13} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteModal({ isOpen: true, id: product.id, name: product.name });
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-full transition-all cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modals triggered inside Stage 2 details list */}
        {stockModal.isOpen && stockModal.product && (
          <StockUpdateModal 
            product={stockModal.product}
            inventory={inventory.find(i => i.productId === stockModal.product?.id)!}
            onClose={() => setStockModal({ isOpen: false, product: null })}
            onSave={loadData}
          />
        )}

        {deleteModal.isOpen && (
          <ConfirmDeleteModal 
            title="Delete Product"
            message={`Are you sure you want to delete "${deleteModal.name}"? This action will move the record to the Recycle Bin.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
          />
        )}

        {isBulkMoveModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-4 font-serif">Bulk Move Products</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-serif">Select a destination Category for {selectedProductIds.length} items.</p>
                
                <div className="space-y-4 mb-6">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-serif">Select Super Category</label>
                  <div className="relative">
                    <select 
                      value={bulkMoveTarget}
                      onChange={e => setBulkMoveTarget(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500 transition-all appearance-none text-gray-900 dark:text-white font-serif"
                    >
                      <option value="">Choose Category...</option>
                      {categories.filter(c => c !== selectedCategory).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="GENERAL">GENERAL</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsBulkMoveModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all uppercase tracking-widest font-serif"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkMove}
                    disabled={!bulkMoveTarget}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#2a9df4] hover:bg-blue-600 rounded-xl transition-all shadow-lg uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed font-serif"
                  >
                    Move Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 font-normal text-gray-900 dark:text-white">
      {/* Dynamic Main Page Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-[22px] font-bold font-sans text-[#2a9df4] uppercase tracking-tight">PRODUCT MANAGEMENT</h2>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleImport}
                accept=".xlsx,.xls"
              />
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-medium text-gray-500 bg-white hover:bg-gray-50 rounded-lg transition-all border border-gray-200 uppercase tracking-widest cursor-pointer">
                <FileUp size={14} /> Import
              </button>
            </div>
            <button 
              onClick={() => navigate('/products/new')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 text-[10px] font-medium text-white bg-[#2a9df4] hover:bg-blue-600 rounded-lg transition-all shadow-md uppercase tracking-widest cursor-pointer"
            >
              <Plus size={14} /> New Product
            </button>
          </div>
        </div>

        {/* Symmetrical Stage 1 Persistent Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => setViewMode('standard')}
            className={cn(
              "p-6 rounded-xl border transition-all duration-300 cursor-pointer group bg-white dark:bg-gray-800 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)]",
              viewMode === 'standard' ? "border-[#2a9df4] ring-1 ring-[#2a9df4]" : "border-gray-200 dark:border-gray-700 hover:border-[#2a9df4]"
            )}
          >
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">Total Products</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-medium text-blue-600 dark:text-blue-400">{products.length}</h3>
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Package size={20} />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setViewMode('out-of-stock')}
            className={cn(
              "p-6 rounded-xl border transition-all duration-300 cursor-pointer group bg-white dark:bg-gray-800 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)]",
              viewMode === 'out-of-stock' ? "border-red-600 ring-1 ring-red-600" : "border-gray-200 dark:border-gray-700 hover:border-red-600"
            )}
          >
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">Out of Stock</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-medium text-red-600 dark:text-red-400">{stats.outOfStockCount}</h3>
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setViewMode('low-stock')}
            className={cn(
              "p-6 rounded-xl border transition-all duration-300 cursor-pointer group bg-white dark:bg-gray-800 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)]",
              viewMode === 'low-stock' ? "border-yellow-500 ring-1 ring-yellow-500" : "border-gray-200 dark:border-gray-700 hover:border-yellow-500"
            )}
          >
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">Low Stock Items</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-medium text-yellow-500 dark:text-yellow-400">{stats.lowStockCount}</h3>
              <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-500 dark:text-yellow-400 group-hover:scale-110 transition-transform">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setViewMode('valuation')}
            className={cn(
              "p-6 rounded-xl border transition-all duration-300 cursor-pointer group bg-white dark:bg-gray-800 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)]",
              viewMode === 'valuation' ? "border-gray-900 dark:border-gray-100 ring-1 ring-gray-900 dark:ring-gray-150" : "border-gray-200 dark:border-gray-700 hover:border-[#2a9df4] dark:hover:border-blue-500"
            )}
          >
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">Total Stock Value</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-medium text-gray-900 dark:text-white">₹ {stats.totalValue.toLocaleString()}</h3>
              <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center text-gray-900 dark:text-gray-300 group-hover:scale-110 transition-transform">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Symmetrical Stage 1 Category Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest font-mono">
            {viewMode === 'standard' ? 'TOTAL PRODUCT CATEGORIES' :
             viewMode === 'low-stock' ? 'LOW STOCK CATEGORIES' :
             viewMode === 'out-of-stock' ? 'OUT OF STOCK CATEGORIES' :
             'VALUATION CATEGORIES'}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map(cat => {
            const catStat = stats.categoryStats[cat] || { low: 0, out: 0, value: 0 };
            const isActiveItems = cat === 'ACTIVE ITEMS';
            const totalCount = products.filter(p => (p.category || 'ACTIVE ITEMS') === cat).length;
            
            let label = 'Items';
            let badgeColorClass = 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300 border-blue-100 dark:border-blue-900/30';
            let displayValue = totalCount.toString();

            if (viewMode === 'low-stock') {
              label = 'Low Stock';
              displayValue = `${catStat.low} Low Stock`;
              badgeColorClass = 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/30';
            } else if (viewMode === 'out-of-stock') {
              label = 'Out Of Stock';
              displayValue = `${catStat.out} Exhausted`;
              badgeColorClass = 'text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-300 border-red-200 dark:border-red-900/30';
            } else if (viewMode === 'valuation') {
              label = 'Asset Value';
              displayValue = `₹ ${catStat.value.toLocaleString()}`;
              badgeColorClass = 'text-[#2a9df4] bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300 border-blue-200 dark:border-blue-900/30';
            } else {
              label = 'Active Items';
              displayValue = `${totalCount} Items`;
              badgeColorClass = 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300 border-blue-100 dark:border-blue-100/30';
            }

            return (
              <div 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "bg-white dark:bg-gray-800 p-5 rounded-xl border transition-all duration-300 cursor-pointer group hover:shadow-[0_10px_25px_rgba(0,0,0,0.06)] hover:-translate-y-1 active:scale-[0.97]",
                  isActiveItems 
                    ? "border-orange-200 dark:border-orange-950/30 bg-orange-50/10 dark:bg-orange-950/5 hover:border-orange-500" 
                    : "border-gray-200/85 dark:border-gray-700 hover:border-[#2a9df4] dark:hover:border-blue-500"
                )}
              >
                <h4 className={cn(
                  "text-[12px] font-bold font-serif uppercase tracking-tight mb-2 truncate leading-none",
                  isActiveItems ? "text-orange-600" : "text-gray-900 dark:text-white"
                )}>
                  {cat}
                </h4>
                
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold">{label}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-md border font-normal font-mono font-bold uppercase tracking-tight",
                    badgeColorClass
                  )}>
                    {displayValue}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Status Toast at Bottom */}
      {importStatus.message && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-sm px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={cn(
            "p-4 rounded-2xl flex items-center justify-between shadow-2xl backdrop-blur-md",
            importStatus.type === 'success' ? "bg-green-600/90 text-white" : "bg-red-600/90 text-white"
          )}>
            <span className="text-xs font-bold uppercase tracking-widest">{importStatus.message}</span>
            <button onClick={() => setImportStatus({ message: '', type: null })} className="p-1 hover:bg-white/20 rounded-full transition-colors ml-4">
              <X size={16} />
            </button>
          </div>
        </div>
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

function StockUpdateModal({ product, inventory, onClose, onSave }: { product: Product, inventory: Inventory, onClose: () => void, onSave: () => void }) {
  const [type, setType] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(product.purchasePrice?.toString() || '');

  const handleSave = async () => {
    const amount = parseFloat(qty) || 0;
    const newQty = type === 'ADD' ? inventory.quantity + amount : inventory.quantity - amount;
    
    await db.updateInventory({
      ...inventory,
      quantity: newQty,
      lastUpdated: new Date().toISOString()
    });

    if (price && parseFloat(price) !== product.purchasePrice) {
      await db.addProduct({
        ...product,
        purchasePrice: parseFloat(price)
      });
    }

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Update Stock</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{product.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Item Code</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{product.sku}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Category</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{product.category}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Update Type</label>
              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                <button 
                  onClick={() => setType('ADD')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all",
                    type === 'ADD' ? "bg-white dark:bg-gray-800 text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Plus size={16} /> ADD
                </button>
                <button 
                  onClick={() => setType('SUBTRACT')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all",
                    type === 'SUBTRACT' ? "bg-white dark:bg-gray-800 text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Minus size={16} /> SUBTRACT
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Quantity</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-[#2a9df4] rounded-xl text-sm font-bold outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Purchase Price</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-[#2a9df4] rounded-xl text-sm font-bold outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all uppercase tracking-widest"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#2a9df4] hover:bg-blue-600 rounded-xl transition-all shadow-lg uppercase tracking-widest"
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  );
}
