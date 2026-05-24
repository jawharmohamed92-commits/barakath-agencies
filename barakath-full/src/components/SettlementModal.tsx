import React from 'react';
import { AlertTriangle, CheckCircle, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  type: 'Paid' | 'Unpaid';
  refNo: string;
}

export default function SettlementModal({ isOpen, onClose, onConfirm, title, type, refNo }: SettlementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className={cn(
            "p-4 rounded-full mb-6",
            type === 'Paid' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}>
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
            {title}
          </h3>
          <p className="text-gray-500 mt-2 font-medium">Bill No: {refNo}</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-bold bg-white rounded-xl shadow-sm border-2 transition-all active:scale-95",
              type === 'Paid' 
                ? "border-green-600 text-black hover:bg-green-50" 
                : "border-red-600 text-black hover:bg-red-50"
            )}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
