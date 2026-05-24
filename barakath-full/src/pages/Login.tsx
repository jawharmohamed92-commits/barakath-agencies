import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, User } from '../lib/db';
import { Shield, KeyRound, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpStage, setOtpStage] = useState<'phone' | 'verify'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  const { login, sendOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (loginMethod === 'password') {
        const settings = await db.getSettings();
        const ownerUsername = settings?.ownerUsername || 'Asraf';
        const ownerPassword = settings?.ownerPassword || 'xyz12345';
        const ownerName = settings?.ownerName || 'asraf';
        
        // Primary Credentials for Owner (Username is case-insensitive, trimmed)
        if (username.trim().toLowerCase() === ownerUsername.trim().toLowerCase() && password.trim() === ownerPassword.trim()) {
          login(ownerName, 'owner');
          navigate('/');
          return;
        }

        // Check secondary users (Staff) in DB
        const allUsers = await db.getUsers();
        const user = allUsers.find(u => u.username === username && u.password === password);

        if (user) {
          login(user.username, user.role);
          navigate('/');
        } else {
          setError('Invalid username or password.');
        }
      } else {
        if (otpStage === 'phone') {
          const res = await sendOTP(phone);
          if (res.success) {
            setOtpStage('verify');
          } else {
            setError(res.error || 'Failed to send OTP.');
          }
        } else {
          const res = await verifyOTP(phone, otpCode);
          if (res.success) {
            navigate('/');
          } else {
            setError(res.error || 'Invalid OTP.');
          }
        }
      }
    } catch (err) {
      setError('An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f9ff] dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-[16pt] font-bold text-gray-900 dark:text-white tracking-tight">
          BARAKATH AGENCIES
        </h2>
        <p className="mt-1 text-center text-[11pt] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">
          AUTOMOBILE ELECTRICAL SPARES
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-gray-800 py-10 px-8 shadow-2xl sm:rounded-3xl border border-blue-50 dark:border-gray-700 space-y-8 relative overflow-hidden">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-300">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {loginMethod === 'password' ? (
                <>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white text-center font-normal placeholder:text-gray-400 outline-none transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 shadow-sm"
                    placeholder="Username"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white text-center font-normal placeholder:text-gray-400 outline-none transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 shadow-sm"
                    placeholder="Password"
                  />
                </>
              ) : (
                <>
                  {otpStage === 'phone' ? (
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-2">Owner/Staff Mobile Number</label>
                       <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full py-4 px-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white text-center font-normal placeholder:text-gray-400 outline-none transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 shadow-sm text-lg tracking-[2px]"
                        placeholder="Mobile Number"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="text-green-500 mb-2" size={32} />
                        <p className="text-sm font-bold text-gray-900 dark:text-white">OTP Sent to {phone}</p>
                        <button 
                          type="button" 
                          onClick={() => setOtpStage('phone')} 
                          className="text-xs text-blue-500 font-bold hover:underline"
                        >
                          Change Number
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full py-4 px-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white text-center font-bold text-2xl tracking-[10px] outline-none transition-all focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20"
                        placeholder="000000"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-4 bg-[#2a9df4] hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-500/30 active:scale-95 flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {loginMethod === 'otp' && otpStage === 'phone' ? 'SENDING...' : 'SIGNING IN...'}
                  </>
                ) : (
                  <>
                    {loginMethod === 'password' ? 'SIGN IN' : (otpStage === 'phone' ? 'GET OTP' : 'VERIFY & SIGN IN')}
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setLoginMethod(prev => prev === 'password' ? 'otp' : 'password');
                setError('');
                setOtpStage('phone');
              }}
              className="text-[#2a9df4] font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-2"
            >
              {loginMethod === 'password' ? (
                <> <Shield size={14} /> Login using OTP instead </>
              ) : (
                <> <KeyRound size={14} /> Login using Password instead </>
              )}
            </button>
            
            <p className="text-gray-400 font-medium text-[9px] uppercase tracking-[3px]">
              Authorized Personnel Only
            </p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[10px] text-gray-400 font-medium italic">
          B-ERP © 2024 • Protected by Barak-Sec Encryption
        </p>
      </div>
    </div>
  );
}

