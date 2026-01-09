import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Car, Receipt, UserCircle, LogOut, ShieldCheck, CloudSun, Clock, Users, RefreshCw, Settings, Menu, X, Package, Sun, Cloud, CloudRain, CloudLightning, Snowflake, Key, Lock, CheckCircle2 } from 'lucide-react';
import { getCurrentEmployee, signOut, updateMyPassword } from '../services/supabaseService';
import { Employee } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null); // Added weatherCode

  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Password Change State
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUser = async () => {
    setIsProfileLoading(true);
    try {
      const emp = await getCurrentEmployee();
      setCurrentUser(emp);
    } catch (e) {
      console.error("Layout fetch user error", e);
    } finally {
      setIsProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Clock Interval
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Weather API (Open-Meteo for Taipei)
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&current_weather=true');
        const data = await res.json();
        if (data.current_weather) {
          setWeatherTemp(data.current_weather.temperature);
          setWeatherCode(data.current_weather.weathercode); // Save weather code
        }
      } catch (e) {
        console.warn('Weather fetch failed', e);
      }
    };
    fetchWeather();

    return () => clearInterval(timer);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: '動態', path: '/', icon: LayoutDashboard },
    { name: '差勤', path: '/attendance', icon: CalendarDays },
    { name: '車輛', path: '/vehicles', icon: Car },
    { name: '報銷', path: '/expenses', icon: Receipt },
    { name: '訪客', path: '/visitors', icon: Users },
    { name: '資產', path: '/assets', icon: Package },
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({ name: '管理', path: '/admin', icon: Settings });
  }

  // Helper to render animated icon
  const renderWeatherIcon = () => {
    if (weatherCode === null) return <CloudSun size={32} className="text-amber-500" />;

    // WMO Weather interpretation codes (WW)
    const iconClass = "transition-transform duration-500 group-hover:scale-110 drop-shadow-sm";

    if (weatherCode === 0) { // Clear sky
      return <Sun size={32} className={`${iconClass} text-amber-500 animate-[spin_10s_linear_infinite]`} />;
    } else if ([1, 2, 3, 45, 48].includes(weatherCode)) { // Cloudy / Fog
      return <Cloud size={32} className={`${iconClass} text-stone-400 animate-[pulse_4s_ease-in-out_infinite]`} />;
    } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) { // Rain / Drizzle
      return (
        <div className="relative">
          <CloudRain size={32} className={`${iconClass} text-sky-500`} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-full h-full flex justify-center pointer-events-none">
            <span className="animate-[rain_1s_infinite] text-sky-400 text-xs absolute top-2 left-1">💧</span>
            <span className="animate-[rain_1.5s_infinite] text-sky-400 text-xs absolute top-3 right-1">💧</span>
          </div>
        </div>
      );
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) { // Snow
      return <Snowflake size={32} className={`${iconClass} text-sky-200 animate-[spin_3s_linear_infinite]`} />;
    } else if ([95, 96, 99].includes(weatherCode)) { // Thunderstorm
      return <CloudLightning size={32} className={`${iconClass} text-purple-600 animate-[bounce_0.5s_infinite]`} />;
    }

    return <CloudSun size={32} className={`${iconClass} text-amber-500`} />;
  };

  return (
    <div className="flex h-screen bg-[#fafaf9] font-sans overflow-hidden">

      {/* Mobile Header (Simplified) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white text-stone-800 z-30 flex items-center justify-between px-4 shadow-sm border-b border-stone-200">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <h1 className="text-lg font-black tracking-tight text-slate-800">CHUYI人事管理系統</h1>
        </div>
        <div className="flex items-center gap-2">
          {currentUser && (
            <button onClick={handleLogout} className="text-stone-400 hover:text-rose-500 transition-colors">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar - Desktop / Tablet Only */}
      <aside className={`
          hidden md:flex
          relative top-0 left-0 h-full w-64 bg-white border-r border-stone-200 flex-col z-30 shrink-0 transition-transform duration-300 ease-in-out shadow-none
      `}>
        <div className="flex p-6 border-b border-stone-100">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-14 h-auto object-contain" />
            <span className="text-slate-700 text-lg font-black tracking-tighter">CHUYI人事管理系統</span>
          </h1>
        </div>

        {/* Weather & Time Widget - Enhanced */}
        <div className="relative overflow-hidden p-6 border-b border-white/40 bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl shadow-xl group transition-all duration-300 hover:shadow-2xl">
          {/* Animated Background Blob */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-sky-300/10 rounded-full blur-3xl group-hover:bg-sky-300/20 transition-all duration-1000 animate-pulse"></div>

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-stone-600 mb-1">
                  <Clock size={14} className="text-accent" />
                  <span className="font-mono font-bold text-xs tracking-wider opacity-80">
                    {currentTime.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-sm font-bold text-stone-600 tracking-wide">
                  {currentTime.toLocaleDateString()}
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 origin-right">
                  {renderWeatherIcon()}
                  <span className="text-3xl font-black text-stone-700 tracking-tighter shadow-stone-200 drop-shadow-sm">
                    {weatherTemp !== null ? Math.round(weatherTemp) : '--'}°
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">Taipei</span>
              </div>
            </div>

            {/* CSS for Rain/etc */}
            <style>{`
                @keyframes rain {
                    0% { opacity: 0; transform: translateY(-5px); }
                    50% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(10px); }
                }
            `}</style>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group font-medium ${isActive
                  ? 'bg-accent-soft text-accent shadow-sm ring-1 ring-accent/20'
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  }`}
              >
                <Icon size={20} className={isActive ? 'text-accent' : 'text-stone-400 group-hover:text-stone-600'} />
                <span className="tracking-wide">{item.name === '動態' ? '人員動態看板' : item.name === '差勤' ? '差勤與請假' : item.name === '車輛' ? '行政資源管理' : item.name === '報銷' ? '費用報銷申請' : item.name === '訪客' ? '來賓訪客登記' : item.name === '管理' ? '系統管理' : item.name === '資產' ? '固定資產管理' : item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-100 bg-stone-50/80">
          <div className="flex items-center gap-3 mb-3 bg-white p-3 rounded-xl border border-stone-100 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold overflow-hidden border border-accent/10 shrink-0">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle size={28} />
              )}
            </div>
            <div className="overflow-hidden w-full">
              {isProfileLoading ? (
                <p className="text-xs text-slate-400 flex items-center animate-pulse">載入資料中...</p>
              ) : currentUser ? (
                <>
                  <p className="text-base font-black text-slate-800 truncate">{currentUser.full_name}</p>
                  <div className="flex items-center gap-1">
                    {currentUser.role === 'admin' ?
                      <ShieldCheck size={14} className="text-sky-500" /> : null
                    }
                    <p className="text-xs text-slate-500 truncate uppercase font-bold tracking-wider">
                      {currentUser.job_title || (currentUser.role === 'admin' ? '系統管理員' : '一般員工')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start">
                  <p className="text-xs text-rose-500 font-bold">無法讀取</p>
                  <button onClick={fetchUser} className="text-[10px] text-slate-400 hover:text-accent flex items-center gap-1 mt-1">
                    <RefreshCw size={10} /> 重試
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
                onClick={() => setIsPwdModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-accent hover:bg-orange-50 py-2.5 rounded-lg transition-colors font-bold border border-transparent hover:border-accent/10"
            >
                <Key size={16} /> 改密碼
            </button>
            <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 py-2.5 rounded-lg transition-colors font-bold"
            >
                <LogOut size={16} /> 登出
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around items-center px-2 py-2 z-40 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-colors ${isActive ? 'text-accent' : 'text-stone-400'
                }`}
            >
              <div className={`p-1.5 rounded-xl ${isActive ? 'bg-accent-soft' : 'bg-transparent'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#fafaf9] scroll-smooth pt-14 pb-20 md:pt-0 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in min-h-full">
          {children}
        </div>
      </main>

      {/* Password Change Modal - Universal for all Employees */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in text-slate-800">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200 animate-slide-up">
                <div className="p-8 pb-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 text-orange-600 shadow-inner">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight mb-2">更新個人登入密碼</h3>
                    <p className="text-stone-500 text-sm font-medium leading-relaxed">請輸入您的新密碼。更新後下次登入請使用新密碼。</p>
                </div>

                <div className="p-8 pt-4 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-stone-400">新密碼 (New Password)</label>
                        <input 
                            type="password"
                            placeholder="請至少輸入 6 位字元"
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            className="w-full bg-stone-50 border-stone-200 rounded-2xl p-4 font-mono focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-stone-300"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setIsPwdModalOpen(false); setNewPwd(''); }}
                            className="flex-1 py-4 px-6 rounded-2xl bg-stone-100 text-stone-500 font-bold hover:bg-stone-200 transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={async () => {
                                if (newPwd.length < 6) {
                                  alert("密碼長度需至少 6 位！");
                                  return;
                                }
                                setIsUpdating(true);
                                try {
                                  await updateMyPassword(newPwd);
                                  alert("✅ 密碼更新成功！下次登入請記得使用新密碼。");
                                  setIsPwdModalOpen(false);
                                  setNewPwd('');
                                } catch (e: any) {
                                  alert("修改失敗: " + e.message);
                                } finally {
                                  setIsUpdating(false);
                                }
                            }}
                            disabled={isUpdating || !newPwd}
                            className="flex-1 py-4 px-6 rounded-2xl bg-accent text-white font-black shadow-lg shadow-accent/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isUpdating ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                            確認更新
                        </button>
                    </div>
                </div>
                
                <div className="bg-stone-50 p-4 text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em]">Security Protocol Layer v2.0</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;