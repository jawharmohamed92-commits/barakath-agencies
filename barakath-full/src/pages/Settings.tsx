import React, { useEffect, useState, useRef } from 'react';
import { db, User } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Plus, Trash2, Shield, User as UserIcon, X, AlertTriangle, Printer, Check, Database, Download, Upload, Server, FolderSync, Clock, FileUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { Navigate } from 'react-router-dom';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

import * as XLSX from 'xlsx';

export default function Settings() {
  const { user: currentUser } = useAuth();
  const { settings, updatePrintFormat, updateSettings, isSynced, markSynced } = useSettings();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', phone: '' });
  const [ownerFormData, setOwnerFormData] = useState({ 
    ownerName: settings?.ownerName || '', 
    ownerPhone: settings?.ownerPhone || '',
    ownerUsername: settings?.ownerUsername || '',
    ownerPassword: settings?.ownerPassword || ''
  });
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Backup & Restore State
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [backupMode, setBackupMode] = useState<'auto' | 'manual'>(settings?.backupMode || 'manual');
  const [autoBackupEmail, setAutoBackupEmail] = useState(settings?.autoBackupEmail || '');
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = [
    { id: 'shop', title: 'Shop Configuration', subtitle: 'Business profile and contact details used for invoices', icon: Server },
    { id: 'data', title: 'Data Integrity', subtitle: 'Repair party balances and sync transaction history', icon: Database },
    { id: 'users', title: 'User Management', subtitle: 'Manage staff accounts and access control', icon: Shield },
    { id: 'billing', title: 'Billing & Sequences', subtitle: 'Configure invoice prefix and financial year resets', icon: Clock },
    { id: 'backup', title: 'Backup & Security', subtitle: 'Safeguard your data with cloud or local snapshots', icon: FolderSync },
    { id: 'templates', title: 'Bulk Entry & Templates', subtitle: 'Download Excel sheets for high-volume data import', icon: FileUp },
    { id: 'printing', title: 'Printing Preferences', subtitle: 'Standardize page layouts for bills and reports', icon: Printer },
  ];

  const downloadTemplate = (type: 'products' | 'customers' | 'purchase') => {
    let headers: any[][] = [];
    let fileName = '';
    let includeFormula = false;

    if (type === 'products') {
      headers = [['ITEM CODE', 'PRODUCT NAME', 'CATEGORY', 'BASE UNIT', 'SECONDARY UNIT', 'CONV RATE (BASE)', 'PURCHASE PRICE', 'SALE PRICE', 'WHOLESALE PRICE', 'OPENING STOCK']];
      fileName = 'Product_Template_Barakath.xlsx';
    } else if (type === 'customers') {
      headers = [['Party Name', 'Phone Number', 'District', 'Address', 'Opening Balance', 'Type (Customer/Suppliers)']];
      fileName = 'Customer_Template_Barakath.xlsx';
    } else {
      headers = [['CATEGORY', 'PRODUCT SEARCH', 'QTY', 'UNIT PRICE (BASE PRICE)', 'DISC (%)', 'TAX (%)', 'TOTAL']];
      fileName = 'Purchase_Entry_Template_Barakath.xlsx';
      includeFormula = true;
    }

    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    if (type === 'purchase') {
      const sampleRow = ['BICOLEX', 'Wheel Bearing (PRD-101)', 10, 500, 5, 18, ''];
      XLSX.utils.sheet_add_aoa(ws, [sampleRow], { origin: 'A2' });
      if (ws['G2']) ws['G2'].f = '(C2*D2)*(1-E2/100)*(1+F2/100)';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
  };

  if (!currentUser || currentUser.role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      ownerName: ownerFormData.ownerName,
      ownerPhone: ownerFormData.ownerPhone,
      ownerUsername: ownerFormData.ownerUsername,
      ownerPassword: ownerFormData.ownerPassword
    });
    setIsOwnerModalOpen(false);
    toast.success("Owner details updated successfully.");
  };

  const loadUsers = async () => {
    const allUsers = await db.getUsers();
    setUsers(allUsers);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;

    const newUser: User = {
      id: crypto.randomUUID(),
      username: formData.username,
      password: formData.password,
      phone: formData.phone,
      role: 'staff',
      createdAt: new Date().toISOString()
    };

    await db.addUser(newUser);
    setIsModalOpen(false);
    setFormData({ username: '', password: '', phone: '' });
    loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    await db.deleteUser(userToDelete.id);
    setUserToDelete(null);
    loadUsers();
  };

  const handleManualBackupSystem = async () => {
    try {
      const dataStr = await db.exportDatabase();
      
      const zip = new JSZip();
      zip.file('database_backup.json', dataStr);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const filename = `Barakath_Agencies_Backup_${dd}-${mm}-${yyyy}_${hh}${min}.zip`;

      const link = document.createElement("a");
      const url = URL.createObjectURL(zipBlob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await updateSettings({ lastBackupDate: new Date().toISOString(), lastBackupStatus: 'success' });
      alert('Backup downloaded successfully!');
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Backup generation failed.');
    }
  };

  const handleManualBackupCloud = async () => {
    alert('Google Drive connection requires OAuth Client credentials.\n\nOption A recommends connecting your Google Workspace, and mapping a Cloud Function.\n\nPlease refer to "AI Services Panel" for integration parameters.');
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring will overwrite all current data. Proceed?')) {
      if (backupInputRef.current) backupInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      let jsonDataStr = '';

      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(file);
        const jsonFile = unzipped.file('database_backup.json');
        if (!jsonFile) throw new Error("Invalid Backup Format: No 'database_backup.json' found inside zip.");
        jsonDataStr = await jsonFile.async('string');
      } else if (file.name.endsWith('.json')) {
        jsonDataStr = await file.text();
      } else {
        throw new Error("Invalid Backup Format: Must be .zip or .json");
      }

      await db.importDatabase(jsonDataStr);
      alert('Data successfully restored! The application will now reload to apply changes.');
      window.location.reload();
    } catch (err: any) {
      console.error('Restore failed:', err);
      setRestoreError(err.message || 'Restoration failed. Corrupt or invalid backup file.');
      if (backupInputRef.current) backupInputRef.current.value = '';
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      {saveSuccess && (
        <div className="fixed top-20 right-6 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-[100] animate-in slide-in-from-right-10 duration-300 flex items-center gap-2">
          <Check size={20} /> Configuration updated successfully
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <div 
              key={section.id} 
              className={cn(
                "bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-300 overflow-hidden",
                isActive 
                  ? "border-blue-500 ring-1 ring-blue-500/20 shadow-[0_4px_12px_rgba(59,130,246,0.1)]" 
                  : "border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-900 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.99] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)]"
              )}
            >
              {/* Header */}
              <button
                onClick={() => setActiveSection(isActive ? null : section.id)}
                className="w-full text-left p-5 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    isActive ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "bg-gray-50 dark:bg-gray-900/50 text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20"
                  )}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 relative">
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white">{section.title}</h3>
                       {section.id === 'data' && isSynced && (
                         <motion.div
                           initial={{ scale: 0, opacity: 0 }}
                           animate={{ scale: 1, opacity: 1 }}
                           className="flex items-center"
                           title="All records synchronized and healthy."
                         >
                           <Check className="text-[#16A34A]" size={18} strokeWidth={3} />
                         </motion.div>
                       )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{section.subtitle}</p>
                  </div>
                </div>
                <div className={cn(
                  "p-2 rounded-full transition-transform duration-300",
                  isActive ? "text-blue-600 rotate-180" : "text-gray-400 group-hover:text-blue-500"
                )}>
                  <ChevronDown size={20} />
                </div>
              </button>

              {/* Content */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="p-6 pt-0 border-t border-gray-50 dark:border-gray-700/50">
                      {section.id === 'shop' && (
                        <div className="space-y-6 pt-6">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">General Information</span>
                             <button 
                                onClick={async () => {
                                  setSaveSuccess(true);
                                  setTimeout(() => setSaveSuccess(false), 3000);
                                }}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/10"
                              >
                                Save Changes
                              </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Shop Name</label>
                              <input 
                                type="text"
                                value={settings.shopName || ''}
                                onChange={e => updateSettings({ shopName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="e.g. BARAKATH AGENCIES"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Subtext / Tagline</label>
                              <input 
                                type="text"
                                value={settings.shopSubtext || ''}
                                onChange={e => updateSettings({ shopSubtext: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="e.g. AUTOMOBILE ELECTRICAL SPARES"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Phone Number</label>
                              <input 
                                type="text"
                                value={settings.shopPhone || ''}
                                onChange={e => updateSettings({ shopPhone: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="e.g. +91 98765 43210"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">GSTIN Number</label>
                              <input 
                                type="text"
                                value={settings.shopGstin || ''}
                                onChange={e => updateSettings({ shopGstin: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Enter GSTIN..."
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Address</label>
                              <textarea 
                                value={settings.shopAddress || ''}
                                onChange={e => updateSettings({ shopAddress: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                placeholder="Shop Address..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Invoice Prefix</label>
                              <input 
                                type="text"
                                value={settings.invoicePrefix || 'INV'}
                                onChange={e => updateSettings({ invoicePrefix: e.target.value.toUpperCase() })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="INV"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 tracking-wider">Estimate Prefix</label>
                              <input 
                                type="text"
                                value={settings.estimatePrefix || 'ES'}
                                onChange={e => updateSettings({ estimatePrefix: e.target.value.toUpperCase() })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="ES"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                       {section.id === 'data' && (
                        <div className="pt-6 space-y-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium text-center mb-6">
                            Run a forensic scan to reconcile stock levels and financial balances across all transaction history.
                          </p>
                          <div className="flex justify-center">
                            <button
                              disabled={isSyncing}
                              onClick={async () => {
                                setIsSyncing(true);
                                // Ensure UI paints spinner immediately
                                await new Promise(resolve => setTimeout(resolve, 100));
                                try {
                                  await db.syncGlobalData();
                                  markSynced();
                                  toast.success("All data repaired and synced successfully.");
                                } catch (err) {
                                  console.error("Forensic Sync Error:", err);
                                  toast.error("Sync Failed. Please check logs.");
                                } finally {
                                  setIsSyncing(false);
                                }
                              }}
                              className={cn(
                                "w-full md:w-auto px-10 py-5 font-bold rounded-xl transition-all duration-700 flex items-center justify-center gap-3 shadow-lg transform active:scale-95 disabled:cursor-not-allowed group",
                                isSynced && !isSyncing
                                  ? "bg-green-600 text-white shadow-green-500/40 hover:bg-green-700 scale-105"
                                  : "bg-blue-600 text-white shadow-blue-500/40 hover:bg-blue-700"
                              )}
                            >
                              {isSyncing ? (
                                <>
                                  <Loader2 size={24} className="animate-spin text-white flex-shrink-0" />
                                  <span className="animate-pulse">Syncing...</span>
                                </>
                              ) : isSynced ? (
                                <>
                                  <Check size={28} className="animate-in zoom-in spin-in-90 duration-500 text-white flex-shrink-0" />
                                  <span>Data Repaired & Synced Successfully</span>
                                </>
                              ) : (
                                <>
                                  <Database size={20} className="group-hover:rotate-12 transition-transform" />
                                  <span>Repair & Sync</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {section.id === 'users' && (
                        <div className="pt-6 space-y-4">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Staff Accounts</span>
                            <button
                              onClick={() => setIsModalOpen(true)}
                              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm font-bold"
                            >
                              <Plus size={16} /> New User
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-800">
                                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Username</th>
                                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone / ID</th>
                                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Shield size={14} className="text-blue-500" /> {settings.ownerName} (Owner)
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-500 font-medium">{settings.ownerPhone}</td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-100 text-blue-600">Primary</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => {
                                        setOwnerFormData({
                                          ownerName: settings.ownerName || '',
                                          ownerPhone: settings.ownerPhone || '',
                                          ownerUsername: settings.ownerUsername || '',
                                          ownerPassword: settings.ownerPassword || ''
                                        });
                                        setIsOwnerModalOpen(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-700 text-[10px] font-bold uppercase tracking-wider hover:underline"
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </tr>
                                {users.map((u) => (
                                  <tr key={u.id} className="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{u.username}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 font-medium">{u.phone || 'N/A'}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gray-100 text-gray-600">Staff</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        onClick={() => setUserToDelete(u)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {section.id === 'billing' && (
                        <div className="pt-6 space-y-4">
                          <div className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer group"
                               onClick={() => updateSettings({ resetSequenceOnFY: !settings.resetSequenceOnFY })}>
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "p-3 rounded-xl transition-colors",
                                settings.resetSequenceOnFY ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                              )}>
                                <FolderSync size={24} />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Reset sequences on Financial Year</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Automatically restart billing counts (e.g., INV-001) on April 1st of every year.</p>
                              </div>
                            </div>
                            <div className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              settings.resetSequenceOnFY ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                            )}>
                              <div className={cn(
                                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                                settings.resetSequenceOnFY && "translate-x-6"
                              )} />
                            </div>
                          </div>
                        </div>
                      )}

                      {section.id === 'backup' && (
                        <div className="pt-6 space-y-8">
                          {settings?.lastBackupDate && (
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg text-sm font-medium w-fit">
                              <Clock size={16} /> Last Backup: {new Date(settings.lastBackupDate).toLocaleString()}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Download size={14} /> Outbound Data
                              </h3>
                              
                              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-fit">
                                <button
                                  type="button"
                                  onClick={() => setBackupMode('auto')}
                                  className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", backupMode === 'auto' ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500")}
                                >Auto Cloud</button>
                                <button
                                  type="button"
                                  onClick={() => setBackupMode('manual')}
                                  className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", backupMode === 'manual' ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500")}
                                >Manual ZIP</button>
                              </div>

                              {backupMode === 'auto' ? (
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Google Drive Email</label>
                                    <div className="flex gap-2 mt-1">
                                      <input 
                                        type="email" 
                                        value={autoBackupEmail}
                                        onChange={e => setAutoBackupEmail(e.target.value)}
                                        placeholder="admin@barakath.com"
                                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                      {settings?.lastBackupStatus === 'success' && (
                                        <div className="h-10 w-10 flex items-center justify-center bg-green-100 text-green-600 rounded-full"><Check size={20} /></div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={async () => {
                                      await updateSettings({ backupMode: 'auto', autoBackupEmail });
                                      alert('Auto-Backup Settings saved.');
                                    }} className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-colors text-xs">Save Settings</button>
                                    <button onClick={handleManualBackupCloud} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors text-xs">Test Cloud Sync</button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={handleManualBackupSystem}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                  <Download size={18} /> Download Local ZIP Backup
                                </button>
                              )}
                            </div>

                            <div className="space-y-6 md:pl-8 md:border-l border-gray-100 dark:border-gray-700">
                              <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <Upload size={14} /> Inbound Data (Restore)
                              </h3>
                              <p className="text-xs text-gray-500 leading-relaxed italic">Restoring from a backup will permanently overwrite all current system data.</p>
                              {restoreError && <div className="text-xs text-red-600 bg-red-100 px-3 py-2 rounded-lg font-bold">{restoreError}</div>}
                              <input type="file" accept=".zip,.json" className="hidden" ref={backupInputRef} onChange={handleRestoreUpload} />
                              <button 
                                onClick={() => backupInputRef.current?.click()}
                                disabled={isRestoring}
                                className="w-full bg-white dark:bg-gray-800 border-2 border-red-500 text-red-600 font-bold py-3 rounded-lg hover:bg-red-50 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                              >
                                <Upload size={18} /> {isRestoring ? 'Restoring...' : 'Upload & Restore'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {section.id === 'templates' && (
                        <div className="pt-6 space-y-6">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { label: 'Products', type: 'products', desc: 'Category, prices, stock' },
                              { label: 'Customers', type: 'customers', desc: 'Party details & balances' },
                              { label: 'Purchase', type: 'purchase', desc: 'Bulk bill item entry' },
                            ].map(item => (
                              <div key={item.type} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/30">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-1 text-sm">{item.label}</h3>
                                <p className="text-[10px] text-gray-500 mb-3">{item.desc}</p>
                                <button 
                                  onClick={() => downloadTemplate(item.type as any)}
                                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-gray-800 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                >
                                  <Download size={14} /> Template
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex gap-3">
                            <Database size={18} className="text-blue-500 shrink-0" />
                            <div className="text-xs text-blue-800 dark:text-blue-300">
                              <p className="font-bold mb-1">How to use Fetch?</p>
                              <p>Fill the Excel sheets and use the "Import Items from Excel" button within the Add Purchase or New Billing screens to pull items instantly.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {section.id === 'printing' && (
                        <div className="pt-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(['A4', 'A5'] as const).map(format => (
                              <button
                                key={format}
                                onClick={() => updatePrintFormat(format)}
                                className={cn(
                                  "p-4 rounded-xl border-2 text-left transition-all relative group",
                                  settings.printFormat === format ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : "border-gray-100 dark:border-gray-700 hover:border-blue-200"
                                )}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="font-bold text-gray-900 dark:text-white">{format === 'A4' ? 'A4 (Standard)' : 'A5 (Compact)'}</div>
                                  {settings.printFormat === format && <div className="p-1 bg-blue-600 text-white rounded-full"><Check size={12} /></div>}
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                  {format === 'A4' ? 'Full-page layout (210 x 297 mm). Best for detailed reports.' : 'Half-page layout (148 x 210 mm). Best for quick bills.'}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Staff User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input 
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number (For OTP Login)</label>
                <input 
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="Enter password"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Owner Modal */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Owner Details</h3>
              <button onClick={() => setIsOwnerModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateOwner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Name</label>
                <input 
                  type="text"
                  required
                  value={ownerFormData.ownerName}
                  onChange={e => setOwnerFormData({ ...ownerFormData, ownerName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="Owner Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner WhatsApp Number</label>
                <input 
                  type="tel"
                  required
                  maxLength={10}
                  value={ownerFormData.ownerPhone}
                  onChange={e => setOwnerFormData({ ...ownerFormData, ownerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="WhatsApp Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Username</label>
                <input 
                  type="text"
                  required
                  value={ownerFormData.ownerUsername}
                  onChange={e => setOwnerFormData({ ...ownerFormData, ownerUsername: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Password</label>
                <input 
                  type="password"
                  required
                  value={ownerFormData.ownerPassword}
                  onChange={e => setOwnerFormData({ ...ownerFormData, ownerPassword: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2a9df4]"
                  placeholder="Password"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsOwnerModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  Update Owner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete User?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{userToDelete.username}"</span>? They will be logged out immediately.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}