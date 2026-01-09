import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { LogIn, Building2, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [inputValue, setInputValue] = useState(''); // 可以是代號或 Email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [attemptedEmail, setAttemptedEmail] = useState<string>('');
  const navigate = useNavigate();

  // 預設公司網域
  const DEFAULT_DOMAIN = 'chuyi.com.tw';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const trimmedInput = inputValue.trim();
      let emailToLogin = trimmedInput;

      // 判斷邏輯：如果沒有輸入 @，自動補上預設網域
      if (!trimmedInput.includes('@')) {
        emailToLogin = `${trimmedInput}@${DEFAULT_DOMAIN}`;
      }
      
      setAttemptedEmail(emailToLogin);

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      let msg = err.message;
      if (msg === 'Invalid login credentials') msg = '帳號或密碼錯誤';
      if (msg.includes('Email not confirmed')) msg = '帳號尚未啟用，請聯繫管理員';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-[#e7e5e4]">
        {/* Header */}
        <div className="bg-[#fff7ed] p-8 text-center relative overflow-hidden border-b border-orange-100">
          <div className="inline-flex items-center justify-center mb-4 transform hover:scale-105 transition-transform duration-300">
            <img src="/logo.png" alt="Company Logo" className="w-24 h-auto drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-black text-[#44403c] tracking-tight">CHU YI 人事管理系統</h1>
          <p className="text-[#a8a29e] text-sm mt-1 font-medium italic">Integrated Enterprise Management System</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-[#44403c] mb-6 flex items-center gap-2">
            <LogIn size={24} className="text-[#ea580c]" />
            員工登入
          </h2>

          {message && (
            <div className={`p-3 rounded-lg text-sm mb-5 flex items-start gap-2 ${
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">{message.text}</p>
                {message.type === 'error' && attemptedEmail && (
                   <p className="text-xs mt-1 opacity-80">嘗試登入帳號: {attemptedEmail}</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#78716c] uppercase mb-1">員工代號 或 完整 Email</label>
              <input
                type="text"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#d6d3d1] focus:ring-2 focus:ring-[#ea580c] focus:border-transparent outline-none transition-all bg-white tracking-wide font-medium text-stone-700"
                placeholder="例如：joe8250 或 boss@gmail.com"
              />
              <p className="text-[10px] text-stone-400 mt-1 pl-1">
                * 若只輸入代號，系統預設為 @{DEFAULT_DOMAIN}。若您的信箱網域不同，請輸入完整 Email。
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#78716c] uppercase mb-1">密碼</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d6d3d1] focus:ring-2 focus:ring-[#ea580c] focus:border-transparent outline-none transition-all bg-white pr-10"
                  placeholder="請輸入密碼"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? '驗證身分中...' : '登入系統'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#a8a29e] bg-[#f5f5f4] p-3 rounded-xl border border-[#e7e5e4]">
            首次使用或忘記密碼，請聯繫管理部。
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;