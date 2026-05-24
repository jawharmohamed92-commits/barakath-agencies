import React, { useEffect, useState } from 'react';
import { db, Customer, PartyGroup } from '../lib/db';
import { Plus, Download, X, CheckCircle2, Users, ChevronRight, Trash2, Edit2, ArrowLeft, Search, Truck, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { useTableKeyNav } from '../hooks/useTableKeyNav';
import UnpaidBalanceSheetModal from '../components/UnpaidBalanceSheetModal';

type TabType = 'address' | 'gst' | 'balance';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partyGroups, setPartyGroups] = useState<PartyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PartyGroup | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewParty, setPreviewParty] = useState<Customer | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('address');
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '+91',
    email: '',
    groupId: '',
    billingAddress: '',
    shippingAddress: '',
    gstType: 'Unregistered/Consumer',
    gstNumber: '',
    state: '',
    balance: '0',
    openingBalanceDate: new Date().toISOString().split('T')[0],
    isShippingSameAsBilling: true
  });

  const [newGroupName, setNewGroupName] = useState('');
  const [isVerifyingGST, setIsVerifyingGST] = useState(false);
  const [isGSTVerified, setIsGSTVerified] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<PartyGroup | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const groups = await db.getPartyGroups();
    const allCustomers = await db.getCustomers();
    
    // Ensure "General" and "Suppliers" groups exist
    let updatedGroups = [...groups];
    if (!groups.find(g => g.id === 'general')) {
      const generalGroup = { id: 'general', name: 'General', createdAt: new Date().toISOString() };
      await db.addPartyGroup(generalGroup);
      updatedGroups.push(generalGroup);
    }
    const existingVendorGroup = groups.find(g => g.id === 'vendor');
    if (!existingVendorGroup) {
      const vendorGroup = { id: 'vendor', name: 'Suppliers', createdAt: new Date().toISOString() };
      await db.addPartyGroup(vendorGroup);
      updatedGroups.push(vendorGroup);
    } else if (existingVendorGroup.name !== 'Suppliers') {
      // Ensure name is standardized to Suppliers
      existingVendorGroup.name = 'Suppliers';
      await db.addPartyGroup(existingVendorGroup);
    }
    
    const sales = await db.getSales();
    const purchases = await db.getPurchases();
    
    const customersWithLiveBalance = allCustomers.map(customer => {
      const customerSales = sales.filter(s => s.customerId === customer.id && !s.isDeleted && s.type !== 'estimate');
      const customerPurchases = purchases.filter(p => p.vendorId === customer.id && !p.isDeleted);
      
      const unpaidSales = customerSales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
      const unpaidPurchases = customerPurchases.reduce((sum, p) => sum + (p.remainingBalance || 0), 0);
      
      // For customers, positive means they owe us. For suppliers, we usually treat them separately or as negative.
      // The user wants 'what is actually owed' to be shown.
      const liveBalance = unpaidSales - unpaidPurchases; 
      
      return { ...customer, balance: liveBalance };
    });
    
    setPartyGroups(updatedGroups);
    setCustomers(customersWithLiveBalance.filter(c => !c.isDeleted));
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const newGroup: PartyGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      createdAt: new Date().toISOString()
    };
    await db.addPartyGroup(newGroup);
    setNewGroupName('');
    setIsGroupModalOpen(false);
    loadData();
    setFormData(prev => ({ ...prev, groupId: newGroup.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer: Customer = {
      id: formData.id || Date.now().toString(),
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      groupId: formData.groupId || 'general',
      billingAddress: formData.billingAddress,
      shippingAddress: formData.isShippingSameAsBilling ? formData.billingAddress : formData.shippingAddress,
      gstType: formData.gstType,
      gstNumber: formData.gstNumber,
      state: formData.state,
      balance: parseFloat(formData.balance) || 0,
      openingBalanceDate: formData.openingBalanceDate,
      createdAt: new Date().toISOString()
    };
    
    await db.addCustomer(customer);
    setIsModalOpen(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      phone: '+91',
      email: '',
      groupId: selectedGroup?.id || 'general',
      billingAddress: '',
      shippingAddress: '',
      gstType: 'Unregistered/Consumer',
      gstNumber: '',
      state: '',
      balance: '0',
      openingBalanceDate: new Date().toISOString().split('T')[0],
      isShippingSameAsBilling: true
    });
    setActiveTab('address');
    setIsGSTVerified(false);
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    await db.deleteCustomer(customerToDelete.id);
    setCustomerToDelete(null);
    loadData();
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    
    if (groupToDelete.id === 'general' || groupToDelete.id === 'vendor') {
      alert("Cannot delete default groups.");
      setGroupToDelete(null);
      return;
    }

    // Check if group has customers
    const groupCustomers = customers.filter(c => c.groupId === groupToDelete.id);
    if (groupCustomers.length > 0) {
      alert("Cannot delete group with active customers. Please move or delete customers first.");
      setGroupToDelete(null);
      return;
    }
    await db.deletePartyGroup(groupToDelete.id);
    setGroupToDelete(null);
    loadData();
  };

  const verifyGST = () => {
    if (!formData.gstNumber) return;
    setIsVerifyingGST(true);
    // Mock verification delay
    setTimeout(() => {
      setIsVerifyingGST(false);
      setIsGSTVerified(true);
    }, 1000);
  };

  const downloadBalanceSheet = async (customer: Customer) => {
    try {
      const [sales, purchases] = await Promise.all([
        db.getSales(),
        db.getPurchases()
      ]);
      
      const partySales = sales.filter(s => s.customerId === customer.id && !s.isDeleted && s.type !== 'estimate').map(s => ({ ...s, type: 'Sale' }));
      const partyPurchases = purchases.filter(p => p.vendorId === customer.id && !p.isDeleted).map(p => ({ ...p, type: 'Purchase' }));
      
      setPreviewParty(customer);
      setPreviewTransactions([...partySales, ...partyPurchases]);
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      alert('Failed to load transaction data.');
    }
  };

  const filteredCustomers = selectedGroup 
    ? customers.filter(c => c.groupId === selectedGroup.id)
    : [];

  const { selectedIndex } = useTableKeyNav({
    items: filteredCustomers,
    onEnter: (index) => {
      const customer = filteredCustomers[index];
      let phone = customer.phone;
      if (phone && !phone.startsWith('+91')) {
        phone = '+91' + phone;
      }
      setFormData({
        ...customer,
        phone: phone || '+91',
        balance: customer.balance.toString(),
        isShippingSameAsBilling: customer.billingAddress === customer.shippingAddress
      });
      setIsModalOpen(true);
    },
    onDelete: (index) => setCustomerToDelete(filteredCustomers[index])
  });

  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {selectedGroup && (
            <button 
              onClick={() => setSelectedGroup(null)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-[22px] font-bold font-sans text-[#2a9df4] uppercase tracking-tight">
            {selectedGroup ? `Party in ${selectedGroup.name}`.toUpperCase() : 'CUSTOMER GROUPS'}
          </h2>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#2a9df4] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} /> Add Customer
        </button>
      </div>

      {/* Main Content */}
      {!selectedGroup ? (
        /* Groups Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {partyGroups.map((group) => {
            const count = customers.filter(c => c.groupId === group.id).length;
            return (
              <div 
                key={group.id}
                className={cn(
                  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-all duration-300 group cursor-pointer",
                  group.id === 'vendor' ? "p-6" : "p-4"
                )}
                onClick={() => setSelectedGroup(group)}
              >
                <div className={cn(
                  "flex justify-between items-start",
                  group.id === 'vendor' ? "mb-4" : "mb-2"
                )}>
                  <div className={cn(
                    "p-3 rounded-lg group-hover:scale-110 transition-transform",
                    group.id === 'vendor' 
                      ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600" 
                      : "bg-blue-50 dark:bg-blue-900/30 text-[#2a9df4]"
                  )}>
                    {group.id === 'vendor' ? <Truck size={24} /> : <Users size={24} />}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {group.id !== 'general' && group.id !== 'vendor' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setGroupToDelete(group); }}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-[12px] font-bold font-serif text-gray-800 dark:text-white mb-1 uppercase tracking-tight">{group.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{count} Parties</p>
                <div className={cn(
                  "flex items-center text-xs font-bold text-[#2a9df4] uppercase tracking-wider",
                  group.id === 'vendor' ? "mt-4" : "mt-2"
                )}>
                  View Parties <ChevronRight size={14} className="ml-1" />
                </div>
              </div>
            );
          })}
          {/* Add Group Card */}
          <div 
            onClick={() => setIsGroupModalOpen(true)}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-[#2a9df4] hover:border-[#2a9df4] hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] hover:-translate-y-1 active:scale-[0.97] active:shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer group"
          >
            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold">Add New Group</span>
          </div>
        </div>
      ) : (
        /* Parties Table View */
        <div className="overflow-x-auto bg-white dark:bg-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar border border-gray-150 dark:border-gray-700 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#ec4af4] dark:bg-gray-800 border-b-[0.5px] border-gray-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400">PARTY NAME</th>
                <th className="px-6 py-4 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-48">WHATSAPP NUMBER</th>
                <th className="px-6 py-4 text-left text-[12px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">BALANCE</th>
                <th className="px-6 py-4 text-right text-[12px] font-bold font-serif text-black dark:text-white bg-[#ec4af4] dark:bg-gray-850 uppercase tracking-tight border-[0.5px] border-gray-400 w-32">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCustomers.map((customer, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <tr 
                    key={customer.id} 
                    data-row-index={idx}
                    className={cn(
                      "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20 outline outline-1 outline-blue-300 z-10 relative"
                    )}
                  >
                    <td className="px-6 py-4 whitespace-nowrap border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="text-[12px] font-bold text-gray-900 dark:text-white">{customer.name}</div>
                    <div className="text-[10px] text-gray-500">{customer.gstNumber || 'No GST'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="text-[12px] text-gray-700 dark:text-gray-300">{customer.phone}</div>
                    <div className="text-[10px] text-gray-500">{customer.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className={cn(
                      "text-[12px] font-bold",
                      customer.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    )}>
                      {customer.balance.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-[12px] font-medium border-[0.5px] border-gray-100 dark:border-gray-800">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => downloadBalanceSheet(customer)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Download Unpaid Statement"
                      >
                        <Printer size={18} />
                      </button>
                      <button
                        onClick={() => {
                          let phone = customer.phone;
                          if (phone && !phone.startsWith('+91')) {
                            phone = '+91' + phone;
                          }
                          setFormData({
                            ...customer,
                            phone: phone || '+91',
                            balance: customer.balance.toString(),
                            isShippingSameAsBilling: customer.billingAddress === customer.shippingAddress
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setCustomerToDelete(customer)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <Users size={48} className="mb-2 opacity-20" />
                      <p className="text-sm">No parties found in this group.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#2a9df4] text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">{formData.id ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Section: Core Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">WhatsApp Number *</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.phone} 
                    onChange={e => {
                      const val = e.target.value;
                      // Ensure it starts with +91
                      if (!val.startsWith('+91')) {
                        return;
                      }
                      // Only allow numbers after +91
                      const numbers = val.slice(3);
                      if (numbers && !/^\d+$/.test(numbers)) {
                        return;
                      }
                      // Limit to 10 digits after +91
                      if (numbers.length > 10) {
                        return;
                      }
                      setFormData({...formData, phone: val});
                    }} 
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                    placeholder="Enter WhatsApp number"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Group</label>
                  <div className="flex gap-2">
                    <select 
                      value={formData.groupId} 
                      onChange={e => setFormData({...formData, groupId: e.target.value})}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                    >
                      {partyGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setIsGroupModalOpen(true)}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-[#2a9df4] rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors"
                    >
                      + New Group
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabbed Navigation */}
              <div className="border-b border-gray-100 dark:border-gray-700">
                <div className="flex gap-6">
                  {(['address', 'gst', 'balance'] as TabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "pb-3 text-sm font-bold uppercase tracking-wider transition-all relative",
                        activeTab === tab 
                          ? "text-[#2a9df4]" 
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {tab}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2a9df4] rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[200px]">
                {activeTab === 'address' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Billing Address</label>
                      <textarea 
                        value={formData.billingAddress} 
                        onChange={e => setFormData({...formData, billingAddress: e.target.value})} 
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                        rows={2}
                        placeholder="Enter billing address"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="sameAsBilling"
                        checked={formData.isShippingSameAsBilling}
                        onChange={e => setFormData({...formData, isShippingSameAsBilling: e.target.checked})}
                        className="w-4 h-4 text-[#2a9df4] rounded border-gray-300 focus:ring-[#2a9df4]"
                      />
                      <label htmlFor="sameAsBilling" className="text-sm text-gray-600 dark:text-gray-400">Shipping address as same of billing</label>
                    </div>
                    {!formData.isShippingSameAsBilling && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shipping Address</label>
                        <textarea 
                          value={formData.shippingAddress} 
                          onChange={e => setFormData({...formData, shippingAddress: e.target.value})} 
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                          rows={2}
                          placeholder="Enter shipping address"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email ID</label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                        placeholder="example@mail.com"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'gst' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">GST Type</label>
                      <select 
                        value={formData.gstType} 
                        onChange={e => setFormData({...formData, gstType: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                      >
                        <option value="Unregistered/Consumer">Unregistered/Consumer</option>
                        <option value="Registered Business - Regular">Registered Business - Regular</option>
                        <option value="Registered Business - Composition">Registered Business - Composition</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">GST in Number</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={formData.gstNumber} 
                          onChange={e => { setFormData({...formData, gstNumber: e.target.value.toUpperCase()}); setIsGSTVerified(false); }} 
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all pr-12"
                          placeholder="Enter GSTIN"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {isGSTVerified ? (
                            <CheckCircle2 size={20} className="text-green-500" />
                          ) : (
                            <button 
                              type="button"
                              onClick={verifyGST}
                              disabled={!formData.gstNumber || isVerifyingGST}
                              className="text-xs font-bold text-[#2a9df4] hover:underline disabled:opacity-50"
                            >
                              {isVerifyingGST ? '...' : 'Verify'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">State</label>
                      <select 
                        value={formData.state} 
                        onChange={e => setFormData({...formData, state: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                      >
                        <option value="">Select State</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'balance' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Opening Balance Amount</label>
                      <input 
                        type="number" 
                        value={formData.balance} 
                        onChange={e => setFormData({...formData, balance: e.target.value})} 
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all font-bold text-lg"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">As of Date</label>
                      <input 
                        type="date" 
                        value={formData.openingBalanceDate} 
                        onChange={e => setFormData({...formData, openingBalanceDate: e.target.value})} 
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-center">
              <button 
                onClick={handleSubmit}
                className="px-12 py-3 bg-[#2a9df4] text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Group</h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Group Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-[#2a9df4] outline-none transition-all"
                  placeholder="e.g. Electricians"
                />
              </div>
              <button 
                onClick={handleAddGroup}
                className="w-full py-3 bg-[#2a9df4] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Party?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{customerToDelete.name}"</span>? It will be moved to the Recycle Bin.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setCustomerToDelete(null)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteCustomer}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation */}
      {groupToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Group?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Are you sure you want to delete the group <span className="font-bold text-gray-900 dark:text-white">"{groupToDelete.name}"</span>?
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteGroup}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPreviewModalOpen && previewParty && (
        <UnpaidBalanceSheetModal 
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          party={previewParty}
          transactions={previewTransactions}
        />
      )}
    </div>
  );
}
