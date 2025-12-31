import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
/* New Import Line */
import { LayoutDashboard, CalendarDays, Car, Receipt, UserCircle, LogOut, ShieldCheck, CloudSun, Clock, Users, RefreshCw, Settings, Menu, X, Package, Sun, Cloud, CloudRain, CloudLightning, Snowflake } from 'lucide-react';

/* Inside Component */
const [weatherCode, setWeatherCode] = useState<number | null>(null);

/* Updated fetchWeather */
const fetchWeather = async () => {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&current_weather=true');
    const data = await res.json();
    if (data.current_weather) {
      setWeatherTemp(data.current_weather.temperature);
      setWeatherCode(data.current_weather.weathercode);
    }
  } catch (e) {
    console.warn('Weather fetch failed', e);
  }
};

/* Helper to render animated icon */
const renderWeatherIcon = () => {
  if (weatherCode === null) return <CloudSun size={32} className="text-amber-500" />;

  // WMO Weather interpretation codes (WW)
  // 0: Clear sky
  // 1, 2, 3: Cloudy
  // 45, 48: Fog
  // 51, 53, 55, 56, 57: Drizzle
  // 61, 63, 65, 66, 67: Rain
  // 71, 73, 75, 77: Snow
  // 80, 81, 82: Rain showers
  // 85, 86: Snow showers
  // 95, 96, 99: Thunderstorm

  const iconClass = "transition-transform duration-500 group-hover:scale-110 drop-shadow-sm";

  if (weatherCode === 0) {
    return <Sun size={32} className={`${iconClass} text-amber-500 animate-[spin_10s_linear_infinite]`} />;
  } else if ([1, 2, 3, 45, 48].includes(weatherCode)) {
    return <Cloud size={32} className={`${iconClass} text-stone-400 animate-[pulse_4s_ease-in-out_infinite]`} />;
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return (
      <div className="relative">
        <CloudRain size={32} className={`${iconClass} text-sky-500`} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-full h-full flex justify-center pointer-events-none">
          <span className="animate-[rain_1s_infinite] text-sky-400 text-xs absolute top-2 left-1">💧</span>
          <span className="animate-[rain_1.5s_infinite] text-sky-400 text-xs absolute top-3 right-1">💧</span>
        </div>
      </div>
    );
  } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return <Snowflake size={32} className={`${iconClass} text-sky-200 animate-[spin_3s_linear_infinite]`} />;
  } else if ([95, 96, 99].includes(weatherCode)) {
    return <CloudLightning size={32} className={`${iconClass} text-purple-600 animate-[bounce_0.5s_infinite]`} />;
  }

  return <CloudSun size={32} className={`${iconClass} text-amber-500`} />;
};

/* In Render - Replace icon mapping */
<div className="flex flex-col items-end">
  <div className="flex items-center gap-1.5 origin-right">
    {renderWeatherIcon()}
    <span className="text-3xl font-black text-stone-700 tracking-tighter shadow-stone-200 drop-shadow-sm">
      {weatherTemp !== null ? Math.round(weatherTemp) : '--'}°
    </span>
  </div>
  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">Taipei</span>
</div>
            </div >

            <style>{`
                @keyframes rain {
                    0% { opacity: 0; transform: translateY(-5px); }
                    50% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(10px); }
                }
            `}</style>

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
      </aside >

  {/* Mobile Bottom Navigation */ }
  < div className = "md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around items-center px-2 py-2 z-40 pb-safe" >
  {
    navItems.map((item) => {
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
    })
  }
      </div >

  {/* Main Content */ }
  < main className = "flex-1 overflow-auto bg-[#fafaf9] scroll-smooth pt-14 pb-20 md:pt-0 md:pb-0" >
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in min-h-full">
      {children}
    </div>
      </main >
    </div >
  );
};

export default Layout;