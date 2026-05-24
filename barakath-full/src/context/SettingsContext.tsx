import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, AppSettings } from '../lib/db';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  settings: AppSettings;
  updatePrintFormat: (format: 'A4' | 'A5') => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
  isSynced: boolean;
  markSynced: () => void;
  resetSync: () => void;
}

const defaultSettings: AppSettings = {
  id: 'global-settings',
  shopName: 'BARAKATH AGENCIES',
  shopSubtext: 'AUTOMOBILE ELECTRICAL SPARES',
  shopAddress: '',
  shopPhone: '',
  shopGstin: '',
  invoicePrefix: 'INV',
  estimatePrefix: 'ES',
  printFormat: 'A4',
  backupMode: 'manual',
  ownerName: 'asraf',
  ownerPhone: '8870551144',
  ownerUsername: 'Asraf',
  ownerPassword: 'xyz12345',
  updatedAt: new Date().toISOString()
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const { user } = useAuth();

  // Reset sync state on logout or user change
  useEffect(() => {
    setIsSynced(false);
  }, [user]);

  const markSynced = () => setIsSynced(true);
  const resetSync = () => setIsSynced(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await db.getSettings();
      let updated: AppSettings;
      if (savedSettings) {
        updated = {
          ...savedSettings,
          ownerName: 'asraf',
          ownerPhone: '8870551144',
          ownerUsername: 'Asraf',
          ownerPassword: 'xyz12345',
          updatedAt: new Date().toISOString()
        };
        await db.saveSettings(updated);
        setSettings(updated);
      } else {
        updated = {
          ...defaultSettings,
          ownerName: 'asraf',
          ownerPhone: '8870551144',
          ownerUsername: 'Asraf',
          ownerPassword: 'xyz12345'
        };
        await db.saveSettings(updated);
        setSettings(updated);
      }

      // Automatically erase all staff credentials
      const allUsers = await db.getUsers();
      for (const u of allUsers) {
        if (u.role === 'staff') {
          await db.deleteUser(u.id);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrintFormat = async (format: 'A4' | 'A5') => {
    const newSettings: AppSettings = {
      ...settings,
      printFormat: format,
      updatedAt: new Date().toISOString()
    };
    try {
      await db.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save print format:', error);
      throw error;
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const newSettings: AppSettings = {
      ...settings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    try {
      await db.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updatePrintFormat, 
      updateSettings, 
      isLoading, 
      isSynced, 
      markSynced, 
      resetSync 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
