import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Car, Receipt, UserCircle, LogOut, ShieldCheck, CloudSun, Clock, Users, RefreshCw, Settings, Menu, X, Package } from 'lucide-react';
import { getCurrentEmployee, signOut } from '../services/supabaseService';
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

  // Mobile Sidebar State (Keep specifically for Tablet/Desktop resize events if needed, but mainly replaced by Bottom Nav on phone)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  return (
    <div className="flex h-screen bg-[#fafaf9] font-sans overflow-hidden">

      {/* Mobile Header (Simplified) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white text-stone-800 z-30 flex items-center justify-between px-4 shadow-sm border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white text-xs shadow-sm">EO</div>
          <h1 className="text-lg font-bold tracking-tight text-stone-800">EnterpriseOps</h1>
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
          <h1 className="text-xl font-bold tracking-tight text-stone-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white text-sm shadow-md shadow-orange-200">
              EO
            </div>
            <span className="text-stone-700">企業營運</span>
          </h1>
        </div>

        {/* Weather & Time Widget */}
        {/* Weather & Time Widget - Enhanced */}
        <div className="relative overflow-hidden p-6 border-b border-white/40 bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl shadow-xl group transition-all duration-300 hover:shadow-2xl">
          {/* Animated Background Blob */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-300/10 rounded-full blur-3xl group-hover:bg-amber-300/20 transition-all duration-1000 animate-pulse"></div>

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
                <div className="flex items-center gap-1.5 transition-transform duration-500 group-hover:scale-110 origin-right">
                  <CloudSun size={32} className="text-amber-500 drop-shadow-sm" />
                  <span className="text-3xl font-black text-stone-700 tracking-tighter shadow-stone-200 drop-shadow-sm">
                    {weatherTemp !== null ? Math.round(weatherTemp) : '--'}°
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">Taipei</span>
              </div>
            </div>

            {/* Character Animation */}
            <div className="mt-4 border-t border-stone-200/50 pt-2 flex justify-center h-12">
              <div className="animate-character-cycle text-3xl select-none">
                🏃
              </div>
              <style>{`
                 @keyframes characterCycle {
                   0%, 25% { content: "🏃"; opacity: 1; transform: translateX(-10px); }
                   26%, 50% { content: "😓"; opacity: 1; transform: translateX(0px); }
                   51%, 75% { content: "💨"; opacity: 1; transform: translateX(0px); }
                   76%, 100% { content: "🚶"; opacity: 1; transform: translateX(10px); }
                 }
                 .animate-character-cycle::after {
                    content: "🏃";
                    animation: characterCycle 4s infinite steps(1);
                 }
                 .animate-character-cycle {
                    font-size: 2rem;
                 }
               `}</style>
            </div>
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
                <p className="text-xs text-stone-400 flex items-center animate-pulse">載入資料中...</p>
              ) : currentUser ? (
                <>
                  <p className="text-sm font-bold text-stone-700 truncate">{currentUser.full_name}</p>
                  <div className="flex items-center gap-1">
                    {currentUser.role === 'admin' ?
                      <ShieldCheck size={12} className="text-amber-500" /> : null
                    }
                    <p className="text-[10px] text-stone-500 truncate uppercase font-bold tracking-wider">
                      {currentUser.job_title || (currentUser.role === 'admin' ? '系統管理員' : '一般員工')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-start">
                  <p className="text-xs text-rose-500 font-bold">無法讀取</p>
                  <button onClick={fetchUser} className="text-[10px] text-stone-400 hover:text-accent flex items-center gap-1 mt-1">
                    <RefreshCw size={10} /> 重試
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs text-stone-500 hover:text-rose-500 hover:bg-rose-50 py-2.5 rounded-lg transition-colors font-bold"
          >
            <LogOut size={16} /> 登出系統
          </button>
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
    </div>
  );
};

export default Layout;