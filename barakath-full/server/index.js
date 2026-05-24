import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import db from './database.js';

const app = express();
const PORT = 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const toJS = (row) => {
  if (!row) return null;
  const obj = { ...row };
  // Parse JSON columns
  ['items', 'payments', 'wholesalePrices'].forEach(col => {
    if (typeof obj[col] === 'string') {
      try { obj[col] = JSON.parse(obj[col]); } catch { obj[col] = []; }
    }
  });
  // Convert SQLite integers back to booleans
  ['isDeleted', 'isCompleted', 'resetSequenceOnFY'].forEach(col => {
    if (col in obj) obj[col] = obj[col] === 1;
  });
  return obj;
};

const toRow = (obj) => {
  const row = { ...obj };
  ['items', 'payments', 'wholesalePrices'].forEach(col => {
    if (Array.isArray(row[col]) || (row[col] && typeof row[col] === 'object')) {
      row[col] = JSON.stringify(row[col]);
    }
  });
  ['isDeleted', 'isCompleted', 'resetSequenceOnFY'].forEach(col => {
    if (col in row) row[col] = row[col] ? 1 : 0;
  });
  return row;
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

app.get('/api/customers', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers').all();
  res.json(rows.map(toJS));
});

app.put('/api/customers', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    INSERT INTO customers (id,name,phone,email,groupId,billingAddress,shippingAddress,
      gstType,gstNumber,state,balance,openingBalanceDate,createdAt,isDeleted,deletedAt)
    VALUES (@id,@name,@phone,@email,@groupId,@billingAddress,@shippingAddress,
      @gstType,@gstNumber,@state,@balance,@openingBalanceDate,@createdAt,@isDeleted,@deletedAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, phone=excluded.phone, email=excluded.email,
      groupId=excluded.groupId, billingAddress=excluded.billingAddress,
      shippingAddress=excluded.shippingAddress, gstType=excluded.gstType,
      gstNumber=excluded.gstNumber, state=excluded.state, balance=excluded.balance,
      openingBalanceDate=excluded.openingBalanceDate, isDeleted=excluded.isDeleted,
      deletedAt=excluded.deletedAt
  `).run({ phone: null, email: null, groupId: null, billingAddress: null,
            shippingAddress: null, gstType: null, gstNumber: null, state: null,
            balance: 0, openingBalanceDate: null, isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true });
});

app.delete('/api/customers/:id', (req, res) => {
  db.prepare('UPDATE customers SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/customers/:id/permanent', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/customers/:id/restore', (req, res) => {
  db.prepare('UPDATE customers SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/customers/:id/balance', (req, res) => {
  const { amount } = req.body;
  db.prepare('UPDATE customers SET balance = balance + ? WHERE id=?').run(amount, req.params.id);
  res.json({ success: true });
});

// ─── PARTY GROUPS ─────────────────────────────────────────────────────────────

app.get('/api/partyGroups', (req, res) => {
  res.json(db.prepare('SELECT * FROM partyGroups').all());
});

app.put('/api/partyGroups', (req, res) => {
  const row = req.body;
  db.prepare(`INSERT INTO partyGroups (id,name,createdAt) VALUES (@id,@name,@createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name`).run(row);
  res.json({ success: true });
});

app.delete('/api/partyGroups/:id', (req, res) => {
  db.prepare('DELETE FROM partyGroups WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products').all();
  res.json(rows.map(toJS));
});

app.get('/api/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  res.json(row ? toJS(row) : null);
});

app.put('/api/products', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    INSERT INTO products (id,sku,name,hsn,price,wholesalePrices,purchasePrice,category,
      brand,baseUnit,secondaryUnit,conversionRate,openingStock,salePriceUnit,purchasePriceUnit,
      createdAt,isDeleted,deletedAt)
    VALUES (@id,@sku,@name,@hsn,@price,@wholesalePrices,@purchasePrice,@category,
      @brand,@baseUnit,@secondaryUnit,@conversionRate,@openingStock,@salePriceUnit,@purchasePriceUnit,
      @createdAt,@isDeleted,@deletedAt)
    ON CONFLICT(id) DO UPDATE SET
      sku=excluded.sku, name=excluded.name, hsn=excluded.hsn, price=excluded.price,
      wholesalePrices=excluded.wholesalePrices, purchasePrice=excluded.purchasePrice,
      category=excluded.category, brand=excluded.brand, baseUnit=excluded.baseUnit,
      secondaryUnit=excluded.secondaryUnit, conversionRate=excluded.conversionRate,
      openingStock=excluded.openingStock, salePriceUnit=excluded.salePriceUnit,
      purchasePriceUnit=excluded.purchasePriceUnit, isDeleted=excluded.isDeleted,
      deletedAt=excluded.deletedAt
  `).run({ sku: null, hsn: null, price: 0, wholesalePrices: '[]', purchasePrice: null,
            category: null, brand: null, baseUnit: null, secondaryUnit: null,
            conversionRate: null, openingStock: 0, salePriceUnit: null, purchasePriceUnit: null,
            isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare('UPDATE products SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id/permanent', (req, res) => {
  const del = db.transaction(() => {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    db.prepare('DELETE FROM inventory WHERE productId=?').run(req.params.id);
  });
  del();
  res.json({ success: true });
});

app.post('/api/products/:id/restore', (req, res) => {
  db.prepare('UPDATE products SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────

app.get('/api/inventory', (req, res) => {
  const rows = db.prepare('SELECT * FROM inventory').all();
  res.json(rows.map(toJS));
});

app.put('/api/inventory', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    INSERT INTO inventory (id,productId,quantity,minStockLevel,lastUpdated,isDeleted,deletedAt)
    VALUES (@id,@productId,@quantity,@minStockLevel,@lastUpdated,@isDeleted,@deletedAt)
    ON CONFLICT(id) DO UPDATE SET
      productId=excluded.productId, quantity=excluded.quantity,
      minStockLevel=excluded.minStockLevel, lastUpdated=excluded.lastUpdated,
      isDeleted=excluded.isDeleted, deletedAt=excluded.deletedAt
  `).run({ quantity: 0, minStockLevel: 5, isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true });
});

// ─── SALES ────────────────────────────────────────────────────────────────────

app.get('/api/sales', (req, res) => {
  const rows = db.prepare('SELECT * FROM sales').all();
  res.json(rows.map(toJS));
});

app.get('/api/sales/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id);
  res.json(row ? toJS(row) : null);
});

app.put('/api/sales', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    INSERT INTO sales (id,billNumber,customerId,customerName,items,subtotal,packageLoaderAmt,
      roundOff,total,freight_charges,grand_total,type,paymentType,status,remainingBalance,
      date,paymentDate,payments,createdAt,isDeleted,deletedAt)
    VALUES (@id,@billNumber,@customerId,@customerName,@items,@subtotal,@packageLoaderAmt,
      @roundOff,@total,@freight_charges,@grand_total,@type,@paymentType,@status,@remainingBalance,
      @date,@paymentDate,@payments,@createdAt,@isDeleted,@deletedAt)
    ON CONFLICT(id) DO UPDATE SET
      billNumber=excluded.billNumber, customerId=excluded.customerId,
      customerName=excluded.customerName, items=excluded.items, subtotal=excluded.subtotal,
      packageLoaderAmt=excluded.packageLoaderAmt, roundOff=excluded.roundOff, total=excluded.total,
      freight_charges=excluded.freight_charges, grand_total=excluded.grand_total,
      type=excluded.type, paymentType=excluded.paymentType, status=excluded.status,
      remainingBalance=excluded.remainingBalance, date=excluded.date, paymentDate=excluded.paymentDate,
      payments=excluded.payments, createdAt=excluded.createdAt,
      isDeleted=excluded.isDeleted, deletedAt=excluded.deletedAt
  `).run({ billNumber: null, items: '[]', subtotal: 0, packageLoaderAmt: 0, roundOff: 0,
            total: 0, freight_charges: null, grand_total: null, paymentDate: null,
            payments: '[]', createdAt: new Date().toISOString(), isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true });
});

app.delete('/api/sales/:id', (req, res) => {
  db.prepare('UPDATE sales SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/sales/:id/permanent', (req, res) => {
  db.prepare('DELETE FROM sales WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/sales/:id/restore', (req, res) => {
  db.prepare('UPDATE sales SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── PURCHASES ────────────────────────────────────────────────────────────────

app.get('/api/purchases', (req, res) => {
  const rows = db.prepare('SELECT * FROM purchases').all();
  res.json(rows.map(toJS));
});

app.put('/api/purchases', (req, res) => {
  const row = toRow(req.body);
  const id = row.id || randomUUID();
  db.prepare(`
    INSERT INTO purchases (id,vendorId,vendorName,billNumber,billDate,items,subtotal,roundOff,
      total,freight_charges,grand_total,paymentType,status,remainingBalance,paymentDate,
      payments,createdAt,isDeleted,deletedAt)
    VALUES (@id,@vendorId,@vendorName,@billNumber,@billDate,@items,@subtotal,@roundOff,
      @total,@freight_charges,@grand_total,@paymentType,@status,@remainingBalance,@paymentDate,
      @payments,@createdAt,@isDeleted,@deletedAt)
    ON CONFLICT(id) DO UPDATE SET
      vendorId=excluded.vendorId, vendorName=excluded.vendorName, billNumber=excluded.billNumber,
      billDate=excluded.billDate, items=excluded.items, subtotal=excluded.subtotal,
      roundOff=excluded.roundOff, total=excluded.total, freight_charges=excluded.freight_charges,
      grand_total=excluded.grand_total, paymentType=excluded.paymentType, status=excluded.status,
      remainingBalance=excluded.remainingBalance, paymentDate=excluded.paymentDate,
      payments=excluded.payments, isDeleted=excluded.isDeleted, deletedAt=excluded.deletedAt
  `).run({ billNumber: null, items: '[]', subtotal: 0, roundOff: 0, total: 0,
            freight_charges: null, grand_total: null, remainingBalance: 0,
            paymentDate: null, payments: '[]', isDeleted: 0, deletedAt: null, ...row, id });
  res.json({ success: true, id });
});

app.delete('/api/purchases/:id', (req, res) => {
  db.prepare('UPDATE purchases SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/purchases/:id/permanent', (req, res) => {
  db.prepare('DELETE FROM purchases WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/purchases/:id/restore', (req, res) => {
  db.prepare('UPDATE purchases SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── EXPENSE CATEGORIES ───────────────────────────────────────────────────────

app.get('/api/expenseCategories', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenseCategories').all());
});

app.post('/api/expenseCategories', (req, res) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO expenseCategories (id,name,createdAt) VALUES (?,?,?)')
    .run(id, req.body.name, createdAt);
  res.json({ success: true, id });
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

app.get('/api/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses').all();
  res.json(rows.map(toJS));
});

app.get('/api/expenses/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  res.json(row ? toJS(row) : null);
});

app.post('/api/expenses', (req, res) => {
  const id = randomUUID();
  const row = toRow({ ...req.body, id });
  db.prepare(`
    INSERT INTO expenses (id,category,categoryId,vendorId,vendorName,expenseNo,date,items,
      subtotal,total,roundOff,paymentType,status,remainingBalance,payments,createdAt,isDeleted,deletedAt)
    VALUES (@id,@category,@categoryId,@vendorId,@vendorName,@expenseNo,@date,@items,
      @subtotal,@total,@roundOff,@paymentType,@status,@remainingBalance,@payments,@createdAt,@isDeleted,@deletedAt)
  `).run({ categoryId: null, vendorId: null, vendorName: null, items: '[]',
            subtotal: 0, total: 0, roundOff: 0, remainingBalance: 0,
            payments: '[]', isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true, id });
});

app.put('/api/expenses/:id', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    UPDATE expenses SET category=@category, categoryId=@categoryId, vendorId=@vendorId,
      vendorName=@vendorName, expenseNo=@expenseNo, date=@date, items=@items,
      subtotal=@subtotal, total=@total, roundOff=@roundOff, paymentType=@paymentType,
      status=@status, remainingBalance=@remainingBalance, payments=@payments,
      isDeleted=@isDeleted, deletedAt=@deletedAt
    WHERE id=@id
  `).run({ categoryId: null, vendorId: null, vendorName: null, isDeleted: 0,
            deletedAt: null, ...row, id: req.params.id });
  res.json({ success: true });
});

app.delete('/api/expenses/:id', (req, res) => {
  db.prepare('UPDATE expenses SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/expenses/:id/permanent', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/expenses/:id/restore', (req, res) => {
  db.prepare('UPDATE expenses SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── REMINDERS ────────────────────────────────────────────────────────────────

app.get('/api/reminders', (req, res) => {
  const rows = db.prepare('SELECT * FROM reminders').all();
  res.json(rows.map(toJS));
});

app.post('/api/reminders', (req, res) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const row = toRow({ ...req.body, id, createdAt });
  db.prepare(`
    INSERT INTO reminders (id,title,description,dateTime,category,isCompleted,createdAt,isDeleted,deletedAt)
    VALUES (@id,@title,@description,@dateTime,@category,@isCompleted,@createdAt,@isDeleted,@deletedAt)
  `).run({ description: null, category: null, isCompleted: 0, isDeleted: 0, deletedAt: null, ...row });
  res.json({ success: true, id });
});

app.put('/api/reminders/:id', (req, res) => {
  const row = toRow(req.body);
  db.prepare(`
    UPDATE reminders SET title=@title, description=@description, dateTime=@dateTime,
      category=@category, isCompleted=@isCompleted, isDeleted=@isDeleted, deletedAt=@deletedAt
    WHERE id=@id
  `).run({ description: null, category: null, isDeleted: 0, deletedAt: null, ...row, id: req.params.id });
  res.json({ success: true });
});

app.delete('/api/reminders/:id', (req, res) => {
  db.prepare('UPDATE reminders SET isDeleted=1, deletedAt=? WHERE id=?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

app.delete('/api/reminders/:id/permanent', (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/reminders/:id/restore', (req, res) => {
  db.prepare('UPDATE reminders SET isDeleted=0, deletedAt=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── USERS ────────────────────────────────────────────────────────────────────

app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users').all());
});

app.put('/api/users', (req, res) => {
  const row = req.body;
  db.prepare(`
    INSERT INTO users (id,username,password,phone,role,createdAt)
    VALUES (@id,@username,@password,@phone,@role,@createdAt)
    ON CONFLICT(id) DO UPDATE SET
      username=excluded.username, password=excluded.password,
      phone=excluded.phone, role=excluded.role
  `).run({ phone: null, ...row });
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM settings LIMIT 1').get();
  if (!row) return res.json(null);
  const obj = { ...row };
  obj.resetSequenceOnFY = obj.resetSequenceOnFY === 1;
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const s = req.body;
  db.prepare(`
    INSERT INTO settings (id,shopName,shopSubtext,shopAddress,shopPhone,shopGstin,
      invoicePrefix,estimatePrefix,printFormat,backupMode,autoBackupEmail,lastBackupDate,
      lastBackupStatus,resetSequenceOnFY,ownerName,ownerPhone,ownerUsername,ownerPassword,updatedAt)
    VALUES (@id,@shopName,@shopSubtext,@shopAddress,@shopPhone,@shopGstin,
      @invoicePrefix,@estimatePrefix,@printFormat,@backupMode,@autoBackupEmail,@lastBackupDate,
      @lastBackupStatus,@resetSequenceOnFY,@ownerName,@ownerPhone,@ownerUsername,@ownerPassword,@updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      shopName=excluded.shopName, shopSubtext=excluded.shopSubtext, shopAddress=excluded.shopAddress,
      shopPhone=excluded.shopPhone, shopGstin=excluded.shopGstin, invoicePrefix=excluded.invoicePrefix,
      estimatePrefix=excluded.estimatePrefix, printFormat=excluded.printFormat,
      backupMode=excluded.backupMode, autoBackupEmail=excluded.autoBackupEmail,
      lastBackupDate=excluded.lastBackupDate, lastBackupStatus=excluded.lastBackupStatus,
      resetSequenceOnFY=excluded.resetSequenceOnFY, ownerName=excluded.ownerName,
      ownerPhone=excluded.ownerPhone, ownerUsername=excluded.ownerUsername,
      ownerPassword=excluded.ownerPassword, updatedAt=excluded.updatedAt
  `).run({ shopName: null, shopSubtext: null, shopAddress: null, shopPhone: null,
            shopGstin: null, invoicePrefix: null, estimatePrefix: null, printFormat: 'A4',
            backupMode: 'manual', autoBackupEmail: null, lastBackupDate: null,
            lastBackupStatus: null, resetSequenceOnFY: 0, ownerName: null,
            ownerPhone: null, ownerUsername: null, ownerPassword: null, ...s,
            resetSequenceOnFY: s.resetSequenceOnFY ? 1 : 0 });
  res.json({ success: true });
});

// ─── SYNC (Full recalculation — called after any write) ───────────────────────

app.post('/api/sync', (req, res) => {
  try {
    const allProducts = db.prepare('SELECT * FROM products').all().map(toJS);
    const allSales = db.prepare('SELECT * FROM sales WHERE isDeleted=0').all().map(toJS);
    const allPurchases = db.prepare('SELECT * FROM purchases WHERE isDeleted=0').all().map(toJS);
    const allExpenses = db.prepare('SELECT * FROM expenses WHERE isDeleted=0').all().map(toJS);
    const allCustomers = db.prepare('SELECT * FROM customers WHERE isDeleted=0').all().map(toJS);
    const allInventory = db.prepare('SELECT * FROM inventory').all().map(toJS);

    const syncAll = db.transaction(() => {
      // Recalculate sale totals and status
      for (const sale of allSales) {
        const itemsSum = sale.items.reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = (sale.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
        let status = sale.status;
        let remainingBalance = 0;
        if (sale.status !== 'estimate') {
          remainingBalance = Math.max(0, itemsSum + (sale.packageLoaderAmt || 0) + (sale.roundOff || 0) - totalPaid);
          if (remainingBalance <= 0) status = 'paid';
          else if (totalPaid > 0) status = 'settled';
          else status = 'pending';
        }
        db.prepare(`UPDATE sales SET subtotal=?, total=?, remainingBalance=?, status=? WHERE id=?`)
          .run(itemsSum, itemsSum + (sale.packageLoaderAmt || 0) + (sale.roundOff || 0), remainingBalance, status, sale.id);
      }

      // Recalculate purchase totals
      for (const pur of allPurchases) {
        const itemsSum = pur.items.reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = (pur.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
        const remainingBalance = Math.max(0, itemsSum + (pur.roundOff || 0) - totalPaid);
        const status = remainingBalance <= 0 ? 'paid' : totalPaid > 0 ? 'settled' : 'unpaid';
        db.prepare(`UPDATE purchases SET subtotal=?, total=?, remainingBalance=?, status=? WHERE id=?`)
          .run(itemsSum, itemsSum + (pur.roundOff || 0), remainingBalance, status, pur.id);
      }

      // Party balance recalculation
      const salesByCustomer = new Map();
      allSales.filter(s => s.type !== 'estimate').forEach(s => {
        salesByCustomer.set(s.customerId, (salesByCustomer.get(s.customerId) || 0) + (s.remainingBalance || 0));
      });
      const purchasesByVendor = new Map();
      allPurchases.forEach(p => {
        purchasesByVendor.set(p.vendorId, (purchasesByVendor.get(p.vendorId) || 0) + (p.remainingBalance || 0));
      });
      const expensesByVendor = new Map();
      allExpenses.forEach(e => {
        if (e.vendorId) {
          expensesByVendor.set(e.vendorId, (expensesByVendor.get(e.vendorId) || 0) + (e.remainingBalance || 0));
        }
      });
      for (const customer of allCustomers) {
        const balance = (salesByCustomer.get(customer.id) || 0)
          - (purchasesByVendor.get(customer.id) || 0)
          - (expensesByVendor.get(customer.id) || 0);
        db.prepare('UPDATE customers SET balance=? WHERE id=?').run(balance, customer.id);
      }

      // Stock recalculation
      for (const product of allProducts) {
        if (product.isDeleted) continue;
        let stock = Number(product.openingStock) || 0;
        allPurchases.forEach(p => p.items?.forEach(item => {
          if (item.productId === product.id) {
            let qty = Number(item.quantity) || 0;
            if (item.unit === product.secondaryUnit && product.conversionRate) qty *= Number(product.conversionRate) || 1;
            stock += qty;
          }
        }));
        allSales.filter(s => s.type === 'invoice').forEach(s => s.items?.forEach(item => {
          if (item.productId === product.id) {
            let qty = Number(item.quantity) || 0;
            if (item.unit === product.secondaryUnit && product.conversionRate) qty *= Number(product.conversionRate) || 1;
            stock -= qty;
          }
        }));
        const existing = allInventory.find(i => i.productId === product.id);
        if (existing) {
          db.prepare('UPDATE inventory SET quantity=?, lastUpdated=? WHERE productId=?')
            .run(isNaN(stock) ? 0 : stock, new Date().toISOString(), product.id);
        } else {
          db.prepare('INSERT INTO inventory (id,productId,quantity,minStockLevel,lastUpdated) VALUES (?,?,?,?,?)')
            .run(randomUUID(), product.id, isNaN(stock) ? 0 : stock, 5, new Date().toISOString());
        }
      }
    });

    syncAll();
    res.json({ success: true });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────

app.get('/api/export', (req, res) => {
  const stores = ['customers','partyGroups','products','inventory','sales',
                  'purchases','expenses','expenseCategories','reminders','users','settings'];
  const exportData = {};
  for (const store of stores) {
    exportData[store] = db.prepare(`SELECT * FROM ${store}`).all().map(toJS);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=barakath-backup.json');
  res.json(exportData);
});

app.post('/api/import', (req, res) => {
  const data = req.body;
  const stores = ['customers','partyGroups','products','inventory','sales',
                  'purchases','expenses','expenseCategories','reminders','users','settings'];
  const importAll = db.transaction(() => {
    for (const store of stores) {
      if (!data[store] || !Array.isArray(data[store])) continue;
      db.prepare(`DELETE FROM ${store}`).run();
      const items = data[store];
      if (items.length === 0) continue;
      // Use the PUT /api/:store endpoint logic inline
      items.forEach(item => {
        const row = toRow(item);
        const cols = Object.keys(row).join(',');
        const placeholders = Object.keys(row).map(k => `@${k}`).join(',');
        try {
          db.prepare(`INSERT OR REPLACE INTO ${store} (${cols}) VALUES (${placeholders})`).run(row);
        } catch (e) {
          console.warn(`Import skip ${store}:`, e.message);
        }
      });
    }
  });
  importAll();
  res.json({ success: true });
});

// ─── REF NUMBER ───────────────────────────────────────────────────────────────

app.get('/api/nextRef/:type', (req, res) => {
  const { type } = req.params;
  const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
  let prefix = '';
  if (type === 'invoice') prefix = `${settings?.invoicePrefix || 'INV'}-`;
  else if (type === 'estimate') prefix = `${settings?.estimatePrefix || 'ES'}-`;
  else prefix = 'EXP-';

  let items = [];
  if (type === 'invoice' || type === 'estimate') {
    items = db.prepare(`SELECT billNumber as ref, date FROM sales WHERE isDeleted=0 AND type=? AND billNumber LIKE ?`)
      .all(type, `${prefix}%`);
  } else {
    items = db.prepare(`SELECT expenseNo as ref, date FROM expenses WHERE isDeleted=0 AND expenseNo LIKE ?`)
      .all(`${prefix}%`);
  }

  if (settings?.resetSequenceOnFY) {
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(fyYear, 3, 1).toISOString();
    items = items.filter(i => i.date >= fyStart);
  }

  if (items.length === 0) return res.json({ ref: `${prefix}001` });
  const nums = items.map(i => parseInt((i.ref || '').split('-')[1]) || 0);
  const next = Math.max(...nums) + 1;
  res.json({ ref: `${prefix}${String(next).padStart(3, '0')}` });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Barakath Agencies API running on http://localhost:${PORT}`);
  console.log(`📦 Database: barakath-agencies.db`);
  console.log(`🌐 Frontend: http://localhost:3000\n`);
});
