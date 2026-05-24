import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../barakath-agencies.db');

const db = new Database(DB_PATH);

// Performance settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// ─── CREATE ALL TABLES ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    groupId TEXT,
    billingAddress TEXT,
    shippingAddress TEXT,
    gstType TEXT,
    gstNumber TEXT,
    state TEXT,
    balance REAL DEFAULT 0,
    openingBalanceDate TEXT,
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS partyGroups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    hsn TEXT,
    price REAL DEFAULT 0,
    wholesalePrices TEXT,        -- stored as JSON array
    purchasePrice REAL,
    category TEXT,
    brand TEXT,
    baseUnit TEXT,
    secondaryUnit TEXT,
    conversionRate REAL,
    openingStock REAL DEFAULT 0,
    salePriceUnit TEXT,
    purchasePriceUnit TEXT,
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    minStockLevel REAL DEFAULT 5,
    lastUpdated TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    FOREIGN KEY (productId) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    billNumber TEXT,
    customerId TEXT NOT NULL,
    customerName TEXT NOT NULL,
    items TEXT NOT NULL,         -- JSON array of SaleItem
    subtotal REAL DEFAULT 0,
    packageLoaderAmt REAL DEFAULT 0,
    roundOff REAL DEFAULT 0,
    total REAL DEFAULT 0,
    freight_charges REAL,
    grand_total REAL,
    type TEXT NOT NULL,          -- 'invoice' | 'estimate'
    paymentType TEXT NOT NULL,   -- 'Cash' | 'Credit' | 'estimate'
    status TEXT NOT NULL,        -- 'paid' | 'pending' | 'settled' | 'estimate'
    remainingBalance REAL DEFAULT 0,
    date TEXT NOT NULL,
    paymentDate TEXT,
    payments TEXT,               -- JSON array of Payment
    createdAt TEXT,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    vendorId TEXT NOT NULL,
    vendorName TEXT NOT NULL,
    billNumber TEXT,
    billDate TEXT NOT NULL,
    items TEXT NOT NULL,         -- JSON array of PurchaseItem
    subtotal REAL DEFAULT 0,
    roundOff REAL DEFAULT 0,
    total REAL DEFAULT 0,
    freight_charges REAL,
    grand_total REAL,
    paymentType TEXT NOT NULL,   -- 'Cash' | 'Credit'
    status TEXT NOT NULL,        -- 'paid' | 'unpaid' | 'settled'
    remainingBalance REAL DEFAULT 0,
    paymentDate TEXT,
    payments TEXT,               -- JSON array of Payment
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS expenseCategories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    categoryId TEXT,
    vendorId TEXT,
    vendorName TEXT,
    expenseNo TEXT NOT NULL,
    date TEXT NOT NULL,
    items TEXT NOT NULL,         -- JSON array of ExpenseItem
    subtotal REAL DEFAULT 0,
    total REAL DEFAULT 0,
    roundOff REAL DEFAULT 0,
    paymentType TEXT NOT NULL,   -- 'Cash' | 'Credit' | 'Bank Transfer'
    status TEXT NOT NULL,        -- 'paid' | 'unpaid' | 'settled'
    remainingBalance REAL DEFAULT 0,
    payments TEXT,               -- JSON array of Payment
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    dateTime TEXT NOT NULL,
    category TEXT,
    isCompleted INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,          -- 'owner' | 'staff'
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    shopName TEXT,
    shopSubtext TEXT,
    shopAddress TEXT,
    shopPhone TEXT,
    shopGstin TEXT,
    invoicePrefix TEXT,
    estimatePrefix TEXT,
    printFormat TEXT DEFAULT 'A4',
    backupMode TEXT DEFAULT 'manual',
    autoBackupEmail TEXT,
    lastBackupDate TEXT,
    lastBackupStatus TEXT,
    resetSequenceOnFY INTEGER DEFAULT 0,
    ownerName TEXT,
    ownerPhone TEXT,
    ownerUsername TEXT,
    ownerPassword TEXT,
    updatedAt TEXT NOT NULL
  );
`);

console.log(`✅ SQLite database ready at: ${DB_PATH}`);

export default db;
