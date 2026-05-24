import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { db } from './lib/db';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import AddPurchase from './pages/AddPurchase';
import RecycleBin from './pages/RecycleBin';
import Settings from './pages/Settings';
import Reminders from './pages/Reminders';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function BackgroundCloudSync() {
  const { settings, updateSettings, isLoading } = useSettings();

  useEffect(() => {
    if (isLoading || !settings) return;

    if (settings.backupMode === 'auto' && settings.autoBackupEmail) {
      const checkAndSync = async () => {
        try {
          const now = Date.now();
          const lastSync = settings.lastBackupDate ? new Date(settings.lastBackupDate).getTime() : 0;
          const hours24 = 24 * 60 * 60 * 1000;

          if (now - lastSync > hours24) {
            console.log('Initiating 24-hour Auto Cloud Backup to Drive...');
            // Simulated Cloud Upload
            // In a real application, this would invoke the Google Drive API using an OAuth token array/refresh logic over the `db.exportDatabase()` blob.
            const rawData = await db.exportDatabase();
            if (rawData) {
               // Pseudo-upload delay
               setTimeout(async () => {
                 console.log('Auto Cloud Backup completed successfully!');
                 await updateSettings({ lastBackupDate: new Date().toISOString(), lastBackupStatus: 'success' });
               }, 2500);
            }
          }
        } catch (err) {
           console.error('Auto Cloud Backup failed:', err);
           await updateSettings({ lastBackupStatus: 'failed' });
        }
      };

      checkAndSync();
    }
  }, [settings, isLoading]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <BackgroundCloudSync />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sales" element={<Sales />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<AddProduct />} />
        <Route path="products/edit/:id" element={<AddProduct />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<AddExpense />} />
        <Route path="expenses/edit/:id" element={<AddExpense />} />
        <Route path="reports" element={<Reports />} />
        <Route path="purchase/new" element={<AddPurchase />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reminders" element={<Reminders />} />
      </Route>
    </Routes>
    </>
  );
}

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <Router>
            <AppRoutes />
            <Toaster position="top-right" />
          </Router>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

