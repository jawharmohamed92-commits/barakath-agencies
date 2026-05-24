import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/db';

interface User {
  username: string;
  role: 'owner' | 'staff';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role: 'owner' | 'staff') => void;
  logout: () => void;
  sendOTP: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (phone: string, code: string) => Promise<{ success: boolean; user?: User; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [generatedOTP, setGeneratedOTP] = useState<{ [phone: string]: string }>({});

  useEffect(() => {
    const token = localStorage.getItem('jwt_mock_token');
    const savedUser = localStorage.getItem('user_info');
    if (token && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      // Periodically check if staff user still exists in DB
      if (parsedUser.role === 'staff') {
        const interval = setInterval(async () => {
          const allUsers = await db.getUsers();
          const exists = allUsers.some(u => u.username === parsedUser.username);
          if (!exists) {
            logout();
          }
        }, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
      }
    }
  }, []);

  const login = (username: string, role: 'owner' | 'staff') => {
    const mockUser = { username, role };
    setUser(mockUser as any);
    localStorage.setItem('jwt_mock_token', 'mock_jwt_token_' + Date.now());
    localStorage.setItem('user_info', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('jwt_mock_token');
    localStorage.removeItem('user_info');
  };

  const sendOTP = async (phone: string) => {
    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(prev => ({ ...prev, [phone]: code }));
    
    // Log to console for testing purposes (Simulating WhatsApp Delivery)
    console.log(`%c[WHATSAPP OTP DEBUG] OTP for ${phone} is: ${code}`, 'color: #25D366; font-weight: bold; font-size: 14px;');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true };
  };

  const verifyOTP = async (phone: string, code: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (generatedOTP[phone] === code) {
      // Dynamic check for owner from DB settings
      const settings = await db.getSettings();
      const ownerName = settings?.ownerName || 'asraf';
      const ownerPhone = settings?.ownerPhone || '8870551144';

      if (phone === ownerPhone) {
        const ownerUser = { username: ownerName, role: 'owner' };
        login(ownerName, 'owner');
        return { success: true, user: ownerUser as any };
      }

      // Check users in DB
      const allUsers = await db.getUsers();
      const dbUser = allUsers.find(u => u.phone === phone || u.username === phone);
      
      if (dbUser) {
        login(dbUser.username, dbUser.role);
        return { success: true, user: dbUser as any };
      }

      return { success: false, error: 'Mobile number not recognized as staff.' };
    }
    
    return { success: false, error: 'Invalid OTP. Please try again.' };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, sendOTP, verifyOTP }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
