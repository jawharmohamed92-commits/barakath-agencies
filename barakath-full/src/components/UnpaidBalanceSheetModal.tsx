import React, { useState } from 'react';
import { X, Printer, Phone } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer } from '../lib/db';
import { useSettings } from '../context/SettingsContext';

interface BalanceSheetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Customer;
  transactions: any[]; // Combined sales/purchases
}

export default function BalanceSheetPreviewModal({ isOpen, onClose, party, transactions }: BalanceSheetPreviewModalProps) {
  const { settings } = useSettings();
  const [filter, setFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');

  if (!isOpen) return null;

  // Sorting transactions globally from Recent to Past (descending)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date || a.billDate || a.createdAt).getTime();
    const dateB = new Date(b.date || b.billDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  // Calculate generic pending/outstanding count
  const pendingCount = transactions.filter(t => {
    const remaining = typeof t.remainingBalance === 'number' ? t.remainingBalance : (t.status === 'paid' ? 0 : t.total);
    return remaining > 0;
  }).length;

  const getPaidDate = (t: any): string => {
    if (t.paymentDate) {
      return new Date(t.paymentDate).toLocaleDateString('en-GB');
    }
    if (t.payments && t.payments.length > 0) {
      const dates = t.payments.map((p: any) => new Date(p.date).getTime()).filter((time: number) => !isNaN(time));
      if (dates.length > 0) {
        const maxDate = new Date(Math.max(...dates));
        return maxDate.toLocaleDateString('en-GB');
      }
    }
    return new Date(t.date || t.billDate || t.createdAt || new Date()).toLocaleDateString('en-GB');
  };

  // Filter transactions in real-time based on selected dropdown option (All, Paid, Unpaid)
  const filteredRows = sortedTransactions.filter(t => {
    const remainingBalance = typeof t.remainingBalance === 'number' ? t.remainingBalance : 0;
    const isPaid = remainingBalance <= 0;
    
    if (filter === 'Paid') {
      return isPaid;
    } else if (filter === 'Unpaid') {
      return !isPaid;
    }
    return true; // 'All'
  });

  const totalRemaining = filteredRows.reduce((sum, t) => sum + (t.remainingBalance || 0), 0);

  const generatePDF = (autoDownload = true) => {
    const isA4 = settings.printFormat !== 'A5';
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA4 ? 'a4' : 'a5'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setTextColor(0, 0, 0);

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text(settings.shopName || 'BARAKATH AGENCIES', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const shopAddr = settings.shopAddress || 'Trichy';
    doc.text(shopAddr, pageWidth / 2, 21, { align: 'center' });
    doc.text(`Contact: ${settings.shopPhone || ''}`, pageWidth / 2, 26, { align: 'center' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 31, pageWidth - margin, 31);

    // Info Section
    const startY = 40;
    doc.setFontSize(14);
    doc.setFont('times', 'bold');
    doc.text(`Statement To: ${party.name}`, margin, startY);

    doc.setFontSize(12);
    doc.text(`Filtered Balance: Rs. ${totalRemaining.toFixed(2)}`, margin, startY + 8);
    
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, startY, { align: 'right' });
    doc.text(`Status: ${filter} Bills`, pageWidth - margin, startY + 5, { align: 'right' });

    // Table mapping
    const tableData = filteredRows.map(t => {
      const billDate = new Date(t.date || t.billDate || t.createdAt);
      const refNo = t.billNumber || t.id.substring(0, 8);
      const totalStr = t.total.toFixed(2);
      
      const remainingBalance = typeof t.remainingBalance === 'number' ? t.remainingBalance : 0;
      const amountPaid = t.total - remainingBalance;
      
      let statusLabel = 'UNPAID';
      if (remainingBalance <= 0) {
        statusLabel = 'PAID';
      } else if (amountPaid > 0) {
        statusLabel = 'PARTIALLY PAID';
      }

      let agingOrPaidDate = '';
      if (statusLabel === 'PAID') {
        agingOrPaidDate = `Paid on ${getPaidDate(t)}`;
      } else {
        const diffTime = new Date().getTime() - billDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const overdueDays = diffDays > 0 ? diffDays : 0;
        agingOrPaidDate = `${overdueDays} Days Overdue`;
      }

      return [
        billDate.toLocaleDateString('en-GB'),
        refNo,
        t.type || 'Sale',
        totalStr,
        statusLabel,
        agingOrPaidDate
      ];
    });

    autoTable(doc, {
      startY: startY + 18,
      head: [['Date', 'Bill No', 'Type', 'Amount', 'Status', 'Aging / Paid On']],
      body: tableData,
      theme: 'grid',
      styles: { font: 'times', fontSize: settings.printFormat === 'A5' ? 8 : 10 },
      headStyles: { 
        fillColor: [245, 245, 245], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      bodyStyles: { 
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [230, 230, 230]
      },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    const todayString = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `${party.name.replace(/\s+/g, '_')}_Statement_${todayString}.pdf`;
    doc.save(fileName);
  };

  // Compile the WhatsApp Custom Payload Web URL
  const getWhatsAppUrl = () => {
    let cleanPhone = party.phone ? party.phone.replace(/\D/g, '') : '';
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
    let text = `*BILL STATEMENT - ${settings.shopName || 'BARAKATH AGENCIES'}*\n`;
    text += `*Customer:* ${party.name}\n`;
    text += `*Filter:* ${filter} Bills\n`;
    text += `*Date of Issue:* ${new Date().toLocaleDateString('en-GB')}\n`;
    text += `-------------------------------------------\n`;
    
    if (filteredRows.length === 0) {
      text += `No transactions found.\n`;
    } else {
      filteredRows.forEach(t => {
        const d = new Date(t.date || t.billDate || t.createdAt).toLocaleDateString('en-GB');
        const billNo = t.billNumber || t.id.substring(0, 8);
        const remainingBalance = typeof t.remainingBalance === 'number' ? t.remainingBalance : 0;
        const amountPaid = t.total - remainingBalance;
        
        let statusLabel = 'UNPAID';
        if (remainingBalance <= 0) {
          statusLabel = 'PAID';
        } else if (amountPaid > 0) {
          statusLabel = 'PARTIALLY PAID';
        }
        
        let agingOrPaidDate = '';
        if (statusLabel === 'PAID') {
          const pDate = getPaidDate(t);
          agingOrPaidDate = `Paid: ${pDate}`;
        } else {
          const billDate = new Date(t.date || t.billDate || t.createdAt);
          const diffTime = new Date().getTime() - billDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const overdueDays = diffDays > 0 ? diffDays : 0;
          agingOrPaidDate = `${overdueDays}d Overdue`;
        }
        
        text += `• *${d}* | *${billNo}* | Rs.${t.total.toFixed(2)} | *${statusLabel}* (${agingOrPaidDate})\n`;
      });
    }
    
    text += `-------------------------------------------\n`;
    text += `*Total Outstanding (Filtered):* Rs.${totalRemaining.toFixed(2)}\n\n`;
    text += `Thank you for your business!`;
    
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  };

  const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-white">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.18 1.448 4.817 1.449 5.4 0 9.794-4.391 9.797-9.793.002-2.618-1.01-5.079-2.852-6.92C16.517 1.936 14.07 1.905 12.01 1.905c-5.398 0-9.793 4.393-9.797 9.797-.001 1.748.498 3.31 1.411 4.767l-.982 3.58 3.673-.963zm12.383-6.522c-.31-.155-1.838-.907-2.126-1.01-.288-.106-.498-.156-.708.156-.21.312-.813 1.01-.995 1.217-.182.21-.363.235-.673.08-1.445-.724-2.408-1.222-3.374-2.87-.24-.411.24-.381.685-1.272.073-.15.037-.282-.018-.39-.056-.113-.498-1.2-.683-1.649-.18-.435-.361-.375-.498-.381-.127-.006-.273-.007-.42-.007-.147 0-.385.055-.587.275-.202.22-.769.752-.769 1.83 0 1.08.784 2.12.893 2.27.109.15 1.544 2.358 3.74 3.3.523.225.931.36 1.249.462.525.166 1.002.143 1.38.087.42-.062 1.284-.524 1.465-1.033.18-.508.18-.944.126-1.035-.054-.09-.2-.14-.51-.295z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header Block */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          
          {/* Title and Metadata */}
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-wider uppercase">BILL STATEMENT</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Customer Name: <span className="font-bold text-gray-700 dark:text-gray-300">{party.name}</span> | Pending Bills: <span className="font-bold text-red-500">{pendingCount}</span>
            </p>
          </div>
          
          {/* Center Filtering dropdown */}
          <div className="flex justify-start md:justify-center">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2a9df4] cursor-pointer"
            >
              <option value="All">All Bills</option>
              <option value="Paid">Paid Bills</option>
              <option value="Unpaid">Unpaid Bills</option>
            </select>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex justify-end items-center gap-2">
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#20ba5a] transition-all shadow-md shadow-green-500/10 active:scale-95"
              title="Share Statement via WhatsApp"
            >
              <WhatsAppIcon />
              <span>WhatsApp</span>
            </a>
            <button 
              onClick={() => generatePDF(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a9df4] text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md shadow-blue-500/10 active:scale-95"
              title="Save Statement PDF"
            >
              <Printer size={15} />
              <span>PDF</span>
            </button>
            <button onClick={onClose} className="p-1 px-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500">
              <X size={20} />
            </button>
          </div>
        </div>        {/* Dynamic Native Data Table View */}
        <div className="flex-1 bg-white dark:bg-gray-905 overflow-y-auto p-4 max-h-[450px]">
          <div className="overflow-x-auto border border-gray-150 dark:border-gray-800 rounded-xl shadow-sm bg-white dark:bg-gray-900 custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 border-collapse">
              <thead className="bg-[#ec4af4] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-1.5 text-left text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 font-serif">DATE</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 font-serif">BILL NO / INVOICE NO</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 font-serif">TYPE</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 font-serif">AMOUNT</th>
                  <th className="px-3 py-1.5 text-center text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 border-r-[0.5px] font-serif">STATUS</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-wider border-[0.5px] border-gray-400 font-serif">DUE DAYS / PAID DATE</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {filteredRows.map((t) => {
                  const dateStr = new Date(t.date || t.billDate || t.createdAt).toLocaleDateString('en-GB');
                  const refNo = t.billNumber || t.id.substring(0, 8);
                  const total = typeof t.total === 'number' ? t.total : 0;
                  const remainingBalance = typeof t.remainingBalance === 'number' ? t.remainingBalance : 0;
                  const amountPaid = total - remainingBalance;
                  
                  let statusLabel = 'UNPAID';
                  let statusBadgeClass = 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30';
                  if (remainingBalance <= 0) {
                    statusLabel = 'PAID';
                    statusBadgeClass = 'bg-green-50 text-green-600 border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/30';
                  } else if (amountPaid > 0) {
                    statusLabel = 'PARTIALLY PAID';
                    statusBadgeClass = 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30';
                  }

                  // Conditional Column dynamic logic
                  let conditionalValue = '';
                  let conditionalColor = 'text-gray-500';
                  if (statusLabel === 'PAID') {
                    const pDate = getPaidDate(t);
                    conditionalValue = `Paid on ${pDate}`;
                    conditionalColor = 'text-green-600 dark:text-green-400 font-medium';
                  } else {
                    const billDate = new Date(t.date || t.billDate || t.createdAt);
                    const diffTime = new Date().getTime() - billDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const overdueDays = diffDays > 0 ? diffDays : 0;
                    conditionalValue = `${overdueDays} Days Overdue`;
                    conditionalColor = 'text-red-500 font-semibold';
                  }

                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-3 py-1 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100 border-[0.5px] border-gray-150 dark:border-gray-800">{dateStr}</td>
                      <td className="px-3 py-1 whitespace-nowrap text-xs font-mono font-bold text-gray-700 dark:text-gray-300 border-[0.5px] border-gray-150 dark:border-gray-800">{refNo}</td>
                      <td className="px-3 py-1 whitespace-nowrap text-xs text-gray-500 border-[0.5px] border-gray-150 dark:border-gray-800">{t.type || 'Sale'}</td>
                      <td className="px-3 py-1 whitespace-nowrap text-xs font-bold text-right text-gray-900 dark:text-gray-100 border-[0.5px] border-gray-150 dark:border-gray-800">Rs. {total.toFixed(2)}</td>
                      <td className="px-3 py-1 whitespace-nowrap text-center border-[0.5px] border-gray-105 dark:border-gray-800">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className={`px-3 py-1 whitespace-nowrap text-xs text-right border-[0.5px] border-gray-150 dark:border-gray-800 ${conditionalColor}`}>
                        {conditionalValue}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
                      No bills found matching the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Banner Info */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Showing <span className="font-bold">{filteredRows.length}</span> of <span className="font-bold">{transactions.length}</span> transaction(s).
          </div>
          <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
            <div className="text-gray-600 dark:text-gray-300">
              Total Outstanding: <span className="text-red-500 font-extrabold ml-1">Rs. {totalRemaining.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
