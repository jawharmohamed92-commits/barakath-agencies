import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from './database.js';

const app = express();

/* =========================
   IMPORTANT FOR RENDER
========================= */

// Render gives PORT automatically
const PORT = process.env.PORT || 4000;

// Fix __dirname for ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Frontend dist folder
const distPath = path.join(__dirname, '../dist');

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json({ limit: '50mb' }));

// Serve frontend build files
app.use(express.static(distPath));

/* =========================
   HELPERS
========================= */

const toJS = (row) => {
  if (!row) return null;

  const obj = { ...row };

  ['items', 'payments', 'wholesalePrices'].forEach(col => {
    if (typeof obj[col] === 'string') {
      try {
        obj[col] = JSON.parse(obj[col]);
      } catch {
        obj[col] = [];
      }
    }
  });

  ['isDeleted', 'isCompleted', 'resetSequenceOnFY'].forEach(col => {
    if (col in obj) obj[col] = obj[col] === 1;
  });

  return obj;
};

const toRow = (obj) => {
  const row = { ...obj };

  ['items', 'payments', 'wholesalePrices'].forEach(col => {
    if (Array.isArray(row[col]) || typeof row[col] === 'object') {
      row[col] = JSON.stringify(row[col]);
    }
  });

  ['isDeleted', 'isCompleted', 'resetSequenceOnFY'].forEach(col => {
    if (col in row) row[col] = row[col] ? 1 : 0;
  });

  return row;
};

/* =========================
   CUSTOMERS
========================= */

app.get('/api/customers', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers').all();
  res.json(rows.map(toJS));
});

app.put('/api/customers', (req, res) => {
  const row = toRow(req.body);

  db.prepare(`
    INSERT INTO customers (
      id,name,phone,email,groupId,billingAddress,shippingAddress,
      gstType,gstNumber,state,balance,openingBalanceDate,
      createdAt,isDeleted,deletedAt
    )
    VALUES (
      @id,@name,@phone,@email,@groupId,@billingAddress,@shippingAddress,
      @gstType,@gstNumber,@state,@balance,@openingBalanceDate,
      @createdAt,@isDeleted,@deletedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      phone=excluded.phone,
      email=excluded.email,
      groupId=excluded.groupId,
      billingAddress=excluded.billingAddress,
      shippingAddress=excluded.shippingAddress,
      gstType=excluded.gstType,
      gstNumber=excluded.gstNumber,
      state=excluded.state,
      balance=excluded.balance,
      openingBalanceDate=excluded.openingBalanceDate,
      isDeleted=excluded.isDeleted,
      deletedAt=excluded.deletedAt
  `).run({
    phone: null,
    email: null,
    groupId: null,
    billingAddress: null,
    shippingAddress: null,
    gstType: null,
    gstNumber: null,
    state: null,
    balance: 0,
    openingBalanceDate: null,
    isDeleted: 0,
    deletedAt: null,
    ...row
  });

  res.json({ success: true });
});

/* =========================
   PRODUCTS
========================= */

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products').all();
  res.json(rows.map(toJS));
});

app.put('/api/products', (req, res) => {
  const row = toRow(req.body);

  db.prepare(`
    INSERT INTO products (
      id,sku,name,hsn,price,wholesalePrices,purchasePrice,
      category,brand,baseUnit,secondaryUnit,conversionRate,
      openingStock,salePriceUnit,purchasePriceUnit,
      createdAt,isDeleted,deletedAt
    )
    VALUES (
      @id,@sku,@name,@hsn,@price,@wholesalePrices,@purchasePrice,
      @category,@brand,@baseUnit,@secondaryUnit,@conversionRate,
      @openingStock,@salePriceUnit,@purchasePriceUnit,
      @createdAt,@isDeleted,@deletedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      sku=excluded.sku,
      name=excluded.name,
      hsn=excluded.hsn,
      price=excluded.price,
      wholesalePrices=excluded.wholesalePrices,
      purchasePrice=excluded.purchasePrice,
      category=excluded.category,
      brand=excluded.brand,
      baseUnit=excluded.baseUnit,
      secondaryUnit=excluded.secondaryUnit,
      conversionRate=excluded.conversionRate,
      openingStock=excluded.openingStock,
      salePriceUnit=excluded.salePriceUnit,
      purchasePriceUnit=excluded.purchasePriceUnit,
      isDeleted=excluded.isDeleted,
      deletedAt=excluded.deletedAt
  `).run({
    sku: null,
    hsn: null,
    price: 0,
    wholesalePrices: '[]',
    purchasePrice: null,
    category: null,
    brand: null,
    baseUnit: null,
    secondaryUnit: null,
    conversionRate: null,
    openingStock: 0,
    salePriceUnit: null,
    purchasePriceUnit: null,
    isDeleted: 0,
    deletedAt: null,
    ...row
  });

  res.json({ success: true });
});

/* =========================
   SETTINGS
========================= */

app.get('/api/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM settings LIMIT 1').get();

  if (!row) {
    return res.json(null);
  }

  const obj = { ...row };

  obj.resetSequenceOnFY = obj.resetSequenceOnFY === 1;

  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const s = req.body;

  db.prepare(`
    INSERT INTO settings (
      id,shopName,shopSubtext,shopAddress,shopPhone,
      shopGstin,invoicePrefix,estimatePrefix,printFormat,
      backupMode,autoBackupEmail,lastBackupDate,
      lastBackupStatus,resetSequenceOnFY,ownerName,
      ownerPhone,ownerUsername,ownerPassword,updatedAt
    )
    VALUES (
      @id,@shopName,@shopSubtext,@shopAddress,@shopPhone,
      @shopGstin,@invoicePrefix,@estimatePrefix,@printFormat,
      @backupMode,@autoBackupEmail,@lastBackupDate,
      @lastBackupStatus,@resetSequenceOnFY,@ownerName,
      @ownerPhone,@ownerUsername,@ownerPassword,@updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      shopName=excluded.shopName,
      shopSubtext=excluded.shopSubtext,
      shopAddress=excluded.shopAddress,
      shopPhone=excluded.shopPhone,
      shopGstin=excluded.shopGstin,
      invoicePrefix=excluded.invoicePrefix,
      estimatePrefix=excluded.estimatePrefix,
      printFormat=excluded.printFormat,
      backupMode=excluded.backupMode,
      autoBackupEmail=excluded.autoBackupEmail,
      lastBackupDate=excluded.lastBackupDate,
      lastBackupStatus=excluded.lastBackupStatus,
      resetSequenceOnFY=excluded.resetSequenceOnFY,
      ownerName=excluded.ownerName,
      ownerPhone=excluded.ownerPhone,
      ownerUsername=excluded.ownerUsername,
      ownerPassword=excluded.ownerPassword,
      updatedAt=excluded.updatedAt
  `).run({
    shopName: null,
    shopSubtext: null,
    shopAddress: null,
    shopPhone: null,
    shopGstin: null,
    invoicePrefix: null,
    estimatePrefix: null,
    printFormat: 'A4',
    backupMode: 'manual',
    autoBackupEmail: null,
    lastBackupDate: null,
    lastBackupStatus: null,
    resetSequenceOnFY: s.resetSequenceOnFY ? 1 : 0,
    ownerName: null,
    ownerPhone: null,
    ownerUsername: null,
    ownerPassword: null,
    ...s
  });

  res.json({ success: true });
});

/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Barakath Agencies API Running'
  });
});

/* =========================
   FRONTEND ROUTE FIX
========================= */

// Important for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database connected`);
});