import React, { useState, useEffect, useMemo } from "react";
import {
  Archive,
  Search,
  Plus,
  Download,
  FileUp,
  History,
  Trash2,
  Filter,
  Calendar,
  ArrowDown
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { db, Purchase } from "../lib/db";
import { formatDate, cn, getUnitAbbreviation } from "../lib/utils";
import { useTableKeyNav } from "../hooks/useTableKeyNav";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PurchaseEntry from "../components/PurchaseEntry";

export default function Inventory() {
  const { settings } = useSettings();
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseEntry, setShowPurchaseEntry] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; billNumber: string }>({ isOpen: false, id: '', billNumber: '' });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const history = await db.getPurchases();
      const activePurchases = history.filter(p => !p.isDeleted);
      const sorted = [...activePurchases].sort((a, b) => {
        const rawA = a.createdAt || a.billDate || '';
        const rawB = b.createdAt || b.billDate || '';
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
      setPurchaseHistory(sorted);
    } catch (error) {
      console.error("History error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const { id } = deleteModal;
    const purchase = purchaseHistory.find(p => p.id === id);
    if (!purchase) return;
    
    try {
      // 1. Instant UI Refresh: Filter & sort local state
      setPurchaseHistory(prev => {
        const active = prev.filter(p => p.id !== id);
        return [...active].sort((a, b) => {
          const rawA = a.createdAt || a.billDate || '';
          const rawB = b.createdAt || b.billDate || '';
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
      });
      setDeleteModal({ isOpen: false, id: '', billNumber: '' });

      // 2. Reverse inventory impact
      const invRecords = await db.getInventory();
      const allProducts = await db.getProducts();
      for (const item of purchase.items) {
        const inv = invRecords.find(i => i.productId === item.productId);
        if (inv) {
          const product = allProducts.find(p => p.id === item.productId);
          let qtyToDeduct = item.quantity;
          if (product && item.unit === product.secondaryUnit && product.conversionRate) {
            qtyToDeduct = item.quantity * product.conversionRate;
          }

          await db.updateInventory({
            ...inv,
            quantity: Math.max(0, inv.quantity - qtyToDeduct),
            lastUpdated: new Date().toISOString()
          });
        }
      }
      
      // 3. Reverse balance if unpaid
      if (purchase.status === 'unpaid') {
        // Subtract from supplier balance
        await db.updateCustomerBalance(purchase.vendorId, -purchase.total);
      }

      // 4. Soft delete in DB
      await db.deletePurchase(id);
      
      toast.success(`Purchase record [${purchase.billNumber}] moved to Recycle Bin. Inventory updated.`);
    } catch (error) {
      toast.error("Failed to delete record");
      loadHistory(); // Revert on failure
    }
  };

  const generatePurchasePDF = (purchase: Purchase) => {
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

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('PURCHASE BILL', margin, 42);
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(`Supplier: ${purchase.vendorName}`, margin, 50);
    doc.text(`Bill No: ${purchase.billNumber}`, margin, 56);
    doc.text(`Date: ${formatDate(purchase.billDate)}`, pageWidth - margin, 50, { align: 'right' });

    // 3. Table
    const head = [['Category', 'Item Name', 'Qty', 'Unit', 'Price', 'Total']];
    const body = purchase.items.map(item => [
      item.category || '-',
      item.name,
      item.quantity.toString(),
      getUnitAbbreviation(item.unit),
      item.price.toFixed(2),
      item.total.toFixed(2)
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
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      bodyStyles: { 
        textColor: [0, 0, 0], // Pure black
        fontStyle: 'normal',
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      styles: { 
        font: 'times', 
        fontSize: 10 
      },
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
    
    doc.text(`Subtotal: ${purchase.subtotal.toFixed(2)}`, summaryRight, finalY, { align: 'right' });
    doc.text(`Round Off: ${purchase.roundOff.toFixed(2)}`, summaryRight, finalY + 6, { align: 'right' });
    
    doc.text(`Grand Total: Rs. ${purchase.total.toFixed(2)}`, summaryRight, finalY + 14, { align: 'right' });

    const fileName = `Purchase_${purchase.vendorName.replace(/\s+/g, '_')}_${purchase.billNumber}_${purchase.billDate}.pdf`;
    doc.save(fileName);
  };

  const downloadTemplate = () => {
    const headers = [['CATEGORY', 'PRODUCT SEARCH', 'QTY', 'UNIT PRICE (BASE PRICE)', 'DISC (%)', 'TAX (%)', 'TOTAL']];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // Add sample row: B2 is PRODUCT SEARCH, C2 is QTY, D2 is PRICE
    const sampleRow = ['SPARE PARTS', 'Wheel Bearing (PRD-101)', 10, 500, 5, 18, ''];
    XLSX.utils.sheet_add_aoa(ws, [sampleRow], { origin: 'A2' });

    // Set formula for TOTAL column (Column G is index 6)
    if (ws['G2']) {
      ws['G2'].f = '(C2*D2)*(1-E2/100)*(1+F2/100)';
    }

    XLSX.utils.book_append_sheet(wb, ws, "Purchase_Template");
    XLSX.writeFile(wb, "Purchase_Entry_Template.xlsx");
  };

  const filteredPurchases = purchaseHistory.filter(p => 
    String(p.vendorName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.billNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { selectedIndex } = useTableKeyNav({
    items: filteredPurchases,
    onEnter: (index) => {
      setEditingPurchase(filteredPurchases[index]);
      setShowPurchaseEntry(true);
    },
    onDelete: (index) => setDeleteModal({ isOpen: true, id: filteredPurchases[index].id, billNumber: filteredPurchases[index].billNumber })
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a9df4] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold font-sans text-[#2a9df4] uppercase tracking-tight">PURCHASE MANAGEMENT</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search supplier or bill..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-[#2a9df4] dark:text-white transition-all"
            />
          </div>
          <button
            onClick={() => {
              setEditingPurchase(null);
              setShowPurchaseEntry(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#2a9df4] px-4 py-2 text-[10pt] font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-600 uppercase tracking-widest whitespace-nowrap"
          >
            <Plus size={16} /> Add Purchase
          </button>
        </div>
      </div>

      <div className="w-full bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
        <table className="w-full border-collapse">
          <thead className="bg-[#f59e0b] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Date</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Bill No</th>
              <th className="px-3 py-2 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400">Supplier</th>
              <th className="px-3 py-2 text-center text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-24">Status</th>
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Amount</th>
              <th className="px-3 py-2 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#f59e0b] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {filteredPurchases.length > 0 ? (
              filteredPurchases.map((purchase, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <tr 
                    key={purchase.id} 
                    data-row-index={idx}
                    className={cn(
                      "hover:bg-blue-50/50 transition-colors",
                      idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-[#f9f9f9] dark:bg-gray-900/50",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20 outline outline-1 outline-blue-300 z-10 relative"
                    )}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-gray-300 border-[0.5px] border-gray-100 dark:border-gray-800">
                      {formatDate(purchase.billDate)}
                    </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-medium text-gray-900 dark:text-white uppercase tracking-wider border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="font-bold">{purchase.billNumber}</div>
                    <div className="text-[10px] text-gray-500 font-medium">{purchase.paymentType || 'Credit'}</div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-900 dark:text-white text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                    {purchase.vendorName}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-center border-[0.5px] border-gray-100 dark:border-gray-800">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                      purchase.status === 'paid' ? "bg-green-100 text-green-600 border border-green-200" : "bg-red-100 text-red-600 border border-red-200"
                    )}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] font-bold text-black dark:text-white text-right border-[0.5px] border-gray-100 dark:border-gray-800">
                    {purchase.total.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[12px] text-gray-500 border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-end gap-3 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          generatePurchasePDF(purchase);
                        }}
                        className="text-gray-600 dark:text-gray-400 hover:text-[#2a9df4] dark:hover:text-[#2a9df4]"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPurchase(purchase);
                          setShowPurchaseEntry(true);
                        }}
                        className="text-blue-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({ isOpen: true, id: purchase.id, billNumber: purchase.billNumber });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all active:scale-90"
                        title="Delete Purchase"
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
                <td colSpan={6} className="px-6 py-10 text-center text-[12px] text-gray-500 dark:text-gray-400">
                  No transactions to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full-Screen Purchase Entry Modal */}
      <PurchaseEntry 
        isOpen={showPurchaseEntry}
        onClose={() => setShowPurchaseEntry(false)}
        onSuccess={loadHistory}
        editingPurchase={editingPurchase}
      />

      {deleteModal.isOpen && (
        <ConfirmDeleteModal 
          title="Delete Purchase"
          message={`Are you sure you want to delete Purchase "${deleteModal.billNumber}"? This action will move the record to the Recycle Bin and reverse inventory impact.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal({ isOpen: false, id: '', billNumber: '' })}
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
