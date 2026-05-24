// ─────────────────────────────────────────────────────────────────────────────
//  db.ts  —  SQLite-backed API client (replaces IndexedDB / idb)
//  All methods have the same signatures as before, so no other file changes.
// ─────────────────────────────────────────────────────────────────────────────

const API = '/api';

// ── Types (unchanged) ─────────────────────────────────────────────────────────

export interface PartyGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  groupId: string;
  billingAddress: string;
  shippingAddress: string;
  gstType: string;
  gstNumber: string;
  state: string;
  balance: number;
  openingBalanceDate: string;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface WholesalePrice {
  qty: number;
  price: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  hsn?: string;
  price: number;
  wholesalePrices?: WholesalePrice[];
  purchasePrice?: number;
  category: string;
  brand?: string;
  baseUnit?: string;
  secondaryUnit?: string;
  conversionRate?: number;
  openingStock?: number;
  salePriceUnit?: string;
  purchasePriceUnit?: string;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  minStockLevel: number;
  lastUpdated: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: 'Cash' | 'Bank';
  note?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Sale {
  id: string;
  billNumber?: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  packageLoaderAmt: number;
  roundOff: number;
  total: number;
  freight_charges?: number;
  grand_total?: number;
  type: 'invoice' | 'estimate';
  paymentType: 'Cash' | 'Credit' | 'estimate';
  status: 'paid' | 'pending' | 'settled' | 'estimate';
  remainingBalance: number;
  date: string;
  paymentDate?: string;
  payments?: Payment[];
  createdAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  tax: number;
  total: number;
  isNew?: boolean;
}

export interface Purchase {
  id: string;
  vendorId: string;
  vendorName: string;
  billNumber: string;
  billDate: string;
  items: PurchaseItem[];
  subtotal: number;
  roundOff: number;
  total: number;
  freight_charges?: number;
  grand_total?: number;
  paymentType: 'Cash' | 'Credit';
  status: 'paid' | 'unpaid' | 'settled';
  remainingBalance: number;
  paymentDate?: string;
  payments?: Payment[];
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface ExpenseItem {
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  categoryId?: string;
  vendorId?: string;
  vendorName?: string;
  expenseNo: string;
  date: string;
  items: ExpenseItem[];
  subtotal: number;
  total: number;
  roundOff: number;
  paymentType: 'Cash' | 'Credit' | 'Bank Transfer';
  status: 'paid' | 'unpaid' | 'settled';
  remainingBalance: number;
  payments?: Payment[];
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  category: string;
  isCompleted: boolean;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface AppSettings {
  id: string;
  shopName?: string;
  shopSubtext?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopGstin?: string;
  invoicePrefix?: string;
  estimatePrefix?: string;
  printFormat: 'A4' | 'A5';
  backupMode?: 'auto' | 'manual';
  autoBackupEmail?: string;
  lastBackupDate?: string;
  lastBackupStatus?: 'success' | 'failed';
  resetSequenceOnFY?: boolean;
  ownerName?: string;
  ownerPhone?: string;
  ownerUsername?: string;
  ownerPassword?: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  phone?: string;
  role: 'owner' | 'staff';
  createdAt: string;
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  return res.json();
}

// ── db object — same surface area as before ───────────────────────────────────

export const db = {

  // ── Sequence numbers ────────────────────────────────────────────────────────
  async getNextReferenceNumber(type: 'invoice' | 'estimate' | 'expense') {
    const data = await api<{ ref: string }>('GET', `/nextRef/${type}`);
    return data.ref;
  },

  // ── Customers ───────────────────────────────────────────────────────────────
  async getCustomers(): Promise<Customer[]> {
    return api('GET', '/customers');
  },
  async addCustomer(customer: Customer) {
    await api('PUT', '/customers', customer);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async deleteCustomer(id: string) {
    await api('DELETE', `/customers/${id}`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async permanentDeleteCustomer(id: string) {
    await api('DELETE', `/customers/${id}/permanent`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async restoreCustomer(id: string) {
    await api('POST', `/customers/${id}/restore`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async updateCustomerBalance(id: string, amount: number) {
    await api('PATCH', `/customers/${id}/balance`, { amount });
  },
  async recalculateBalances() {
    await this.syncGlobalData();
  },

  // ── Party Groups ────────────────────────────────────────────────────────────
  async getPartyGroups(): Promise<PartyGroup[]> {
    return api('GET', '/partyGroups');
  },
  async addPartyGroup(group: PartyGroup) {
    await api('PUT', '/partyGroups', group);
  },
  async deletePartyGroup(id: string) {
    await api('DELETE', `/partyGroups/${id}`);
  },

  // ── Products ────────────────────────────────────────────────────────────────
  async getProducts(): Promise<Product[]> {
    return api('GET', '/products');
  },
  async getProduct(id: string): Promise<Product | null> {
    return api('GET', `/products/${id}`);
  },
  async addProduct(product: Product) {
    await api('PUT', '/products', product);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async deleteProduct(id: string) {
    await api('DELETE', `/products/${id}`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async permanentDeleteProduct(id: string) {
    await api('DELETE', `/products/${id}/permanent`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async restoreProduct(id: string) {
    await api('POST', `/products/${id}/restore`);
    this.notifyMutation();
    await this.syncGlobalData();
  },

  // ── Inventory ───────────────────────────────────────────────────────────────
  async getInventory(): Promise<Inventory[]> {
    return api('GET', '/inventory');
  },
  async updateInventory(inventory: Inventory) {
    await api('PUT', '/inventory', inventory);
  },

  // ── Sales ───────────────────────────────────────────────────────────────────
  async getSales(): Promise<Sale[]> {
    return api('GET', '/sales');
  },
  async getSale(id: string): Promise<Sale | null> {
    return api('GET', `/sales/${id}`);
  },
  async addSale(sale: Sale) {
    await api('PUT', '/sales', sale);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async deleteSale(id: string) {
    await api('DELETE', `/sales/${id}`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async permanentDeleteSale(id: string) {
    await api('DELETE', `/sales/${id}/permanent`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async restoreSale(id: string) {
    await api('POST', `/sales/${id}/restore`);
    this.notifyMutation();
    await this.syncGlobalData();
  },

  // ── Purchases ───────────────────────────────────────────────────────────────
  async getPurchases(): Promise<Purchase[]> {
    return api('GET', '/purchases');
  },
  async addPurchase(purchase: Omit<Purchase, 'id'> & { id?: string }) {
    const data = await api<{ id: string }>('PUT', '/purchases', purchase);
    this.notifyMutation();
    await this.syncGlobalData();
    return data.id;
  },
  async updatePurchase(purchase: Purchase) {
    await api('PUT', '/purchases', purchase);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async deletePurchase(id: string) {
    await api('DELETE', `/purchases/${id}`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async permanentDeletePurchase(id: string) {
    await api('DELETE', `/purchases/${id}/permanent`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async restorePurchase(id: string) {
    await api('POST', `/purchases/${id}/restore`);
    this.notifyMutation();
    await this.syncGlobalData();
  },

  // ── Expense Categories ──────────────────────────────────────────────────────
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return api('GET', '/expenseCategories');
  },
  async addExpenseCategory(category: Omit<ExpenseCategory, 'id' | 'createdAt'>) {
    const data = await api<{ id: string }>('POST', '/expenseCategories', category);
    return data.id;
  },

  // ── Expenses ────────────────────────────────────────────────────────────────
  async getExpenses(): Promise<Expense[]> {
    return api('GET', '/expenses');
  },
  async getExpense(id: string): Promise<Expense | null> {
    return api('GET', `/expenses/${id}`);
  },
  async addExpense(expense: Omit<Expense, 'id'>) {
    const data = await api<{ id: string }>('POST', '/expenses', expense);
    this.notifyMutation();
    await this.syncGlobalData();
    return data.id;
  },
  async updateExpense(expense: Expense) {
    await api('PUT', `/expenses/${expense.id}`, expense);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async deleteExpense(id: string) {
    await api('DELETE', `/expenses/${id}`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async restoreExpense(id: string) {
    await api('POST', `/expenses/${id}/restore`);
    this.notifyMutation();
    await this.syncGlobalData();
  },
  async permanentDeleteExpense(id: string) {
    await api('DELETE', `/expenses/${id}/permanent`);
    this.notifyMutation();
    await this.syncGlobalData();
  },

  // ── Reminders ───────────────────────────────────────────────────────────────
  async getReminders(): Promise<Reminder[]> {
    return api('GET', '/reminders');
  },
  async addReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>) {
    const data = await api<{ id: string }>('POST', '/reminders', reminder);
    return data.id;
  },
  async updateReminder(reminder: Reminder) {
    await api('PUT', `/reminders/${reminder.id}`, reminder);
  },
  async deleteReminder(id: string) {
    await api('DELETE', `/reminders/${id}`);
  },
  async restoreReminder(id: string) {
    await api('POST', `/reminders/${id}/restore`);
  },
  async permanentDeleteReminder(id: string) {
    await api('DELETE', `/reminders/${id}/permanent`);
  },

  // ── Users ───────────────────────────────────────────────────────────────────
  async getUsers(): Promise<User[]> {
    return api('GET', '/users');
  },
  async addUser(user: User) {
    await api('PUT', '/users', user);
  },
  async deleteUser(id: string) {
    await api('DELETE', `/users/${id}`);
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  async getSettings(): Promise<AppSettings | null> {
    return api('GET', '/settings');
  },
  async saveSettings(settings: AppSettings) {
    await api('PUT', '/settings', settings);
  },

  // ── Export / Import ─────────────────────────────────────────────────────────
  async exportDatabase(): Promise<string> {
    const res = await fetch(`${API}/export`);
    return res.text();
  },
  async importDatabase(jsonData: string) {
    const data = JSON.parse(jsonData);
    await api('POST', '/import', data);
    this.notifyMutation();
  },

  // ── Sync (forensic recalculation) ──────────────────────────────────────────
  async syncGlobalData() {
    try {
      await api('POST', '/sync');
    } catch (e) {
      console.warn('Sync warning:', e);
    }
  },

  // ── Subscription / reactive updates ────────────────────────────────────────
  _listeners: [] as (() => void)[],
  subscribe(listener: () => void) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  },
  notifyMutation() {
    this._listeners.forEach(l => l());
  },
};

// Keep initDB for any legacy imports — it's a no-op now
export const initDB = () => Promise.resolve();
