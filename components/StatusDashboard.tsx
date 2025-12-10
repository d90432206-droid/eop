
import React, { useEffect, useState } from 'react';
import { getEmployees, updateEmployeeStatus, getLeaveRequests, getCurrentEmployee } from '../services/supabaseService';
import { Employee, EmployeeStatus, LeaveRequest } from '../types';
import { MapPin, Clock, CheckCircle2, AlertCircle, Plane, Coffee, Building2, RefreshCw, Search, Filter, Globe2, Calendar as CalendarIcon, List, ArrowRight, X, Send, Briefcase, ChevronUp, Phone, CloudRain, Utensils, Plus, Users, ShieldCheck } from 'lucide-react';

const StatusDashboard: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('All');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [weatherCode, setWeatherCode] = useState<number | null>(null);

    // Mobile Bottom Sheet State
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

    // Calendar Detail Modal
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Unified Status Update Modal State
    const [statusModal, setStatusModal] = useState<{
        isOpen: boolean;
        targetId: string | null;
        newStatus: EmployeeStatus | null;
        note: string;
        returnTime: string;
    }>({
        isOpen: false,
        targetId: null,
        newStatus: null,
        note: '',
        returnTime: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const me = await getCurrentEmployee();
            setCurrentEmp(me);

            const data = await getEmployees();
            setEmployees(data);
            setFilteredEmployees(data);

            const leaves = await getLeaveRequests();
            setLeaveRequests(leaves);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        // Weather API (Open-Meteo for Taipei)
        const fetchWeather = async () => {
            try {
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&current_weather=true');
                const data = await res.json();
                if (data.current_weather) {
                    setWeatherCode(data.current_weather.weathercode);
                }
            } catch (e) {
                console.warn('Weather fetch failed', e);
            }
        };
        fetchWeather();

        return () => clearInterval(interval);
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = employees;
        if (deptFilter !== 'All') {
            result = result.filter(e => e.department === deptFilter);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.full_name.toLowerCase().includes(lower) ||
                e.employee_id.toLowerCase().includes(lower)
            );
        }
        setFilteredEmployees(result);
    }, [searchTerm, deptFilter, employees]);

    // Status Counts Calculation for Summary Bar
    const statusCounts = employees.reduce((acc, curr) => {
        acc[curr.current_status] = (acc[curr.current_status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const departments = ['All', ...Array.from(new Set(employees.map(e => e.department)))];

    const getStatusConfig = (status: EmployeeStatus) => {
        switch (status) {
            case 'in_office':
                return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Building2, label: '廠內辦公', fullLabel: 'IN OFFICE' };
            case 'meeting':
                return { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: CheckCircle2, label: '會議中', fullLabel: 'MEETING' };
            case 'out':
                return { color: 'bg-stone-200 text-stone-700 border-stone-300', icon: MapPin, label: '外出公務', fullLabel: 'OUT' };
            case 'abroad':
                return { color: 'bg-sky-100 text-sky-800 border-sky-200', icon: Plane, label: '出國考察', fullLabel: 'ABROAD' };
            case 'leave':
                return { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: Coffee, label: '休假中', fullLabel: 'ON LEAVE' };
            default:
                return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle, label: '未知', fullLabel: 'UNKNOWN' };
        }
    };

    // Helper: Smart Status Context
    const isLunchTime = () => {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        // Lunch: 12:15 - 13:15
        if (h === 12 && m >= 15) return true;
        if (h === 13 && m <= 15) return true;
        return false;
    };
    const isRaining = () => {
        // WMO Weather interpretation codes (Rain: 51, 53, 55, 61, 63, 65, 80, 81, 82)
        const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82];
        return weatherCode !== null && rainCodes.includes(weatherCode);
    };

    // Helper: Geolocation
    const getLocation = () => {
        return new Promise<string>((resolve, reject) => {
            if (!navigator.geolocation) reject('此裝置不支援地理位置功能');
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`),
                (err) => reject(err.message)
            );
        });
    };

    const handleQuickStatusUpdate = async (targetId: string, newStatus: EmployeeStatus) => {
        // Close mobile sheet if open
        setIsMobileSheetOpen(false);

        if (!currentEmp) return;

        const canEdit =
            currentEmp.id === targetId || // Self
            currentEmp.role === 'admin' || // Admin
            currentEmp.job_title?.includes('經理'); // Manager

        if (!canEdit) {
            alert("❌ 權限不足：您只能更改自己的狀態");
            return;
        }

        // 1. 如果是「廠內」，直接更新並清空備註與時間
        if (newStatus === 'in_office') {
            try {
                await updateEmployeeStatus(targetId, newStatus, null, null);
                await fetchData();
            } catch (err: any) {
                alert(err.message);
            }
            return;
        }

        // 2. 如果是「會議/外出/出國」，開啟 Modal 填寫詳情
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        const defaultTime = new Date(nextHour.getTime() - (nextHour.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

        setStatusModal({
            isOpen: true,
            targetId: targetId,
            newStatus: newStatus,
            note: '',
            returnTime: defaultTime
        });
    }

    const handleStatusSubmit = async () => {
        const { targetId, newStatus, note, returnTime } = statusModal;
        if (!targetId || !newStatus) return;

        try {
            const formattedTime = returnTime ? new Date(returnTime).toISOString() : null;
            let finalNote = note;

            // GPS Auto-tagging for 'out' or 'abroad' if confirmed
            if (newStatus === 'out' || newStatus === 'abroad') {
                // Only prompt if user hasn't typed a map link already
                if (!note.includes('maps.google.com') && window.confirm("是否自動附加當前 GPS 位置到備註？")) {
                    try {
                        const mapLink = await getLocation();
                        finalNote = note ? `${note} (${mapLink})` : mapLink;
                    } catch (e) {
                        console.warn("GPS failed", e);
                        // Continue without GPS
                    }
                }
            }

            await updateEmployeeStatus(targetId, newStatus, finalNote, formattedTime);
            await fetchData();
            setStatusModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
            alert(err.message);
        }
    }

    const getEventsForDate = (dateStr: string) => {
        return leaveRequests.filter(req => {
            const startStr = req.start_time.split('T')[0];
            const endStr = req.end_time.split('T')[0];
            return (req.status === 'approved' || req.status.includes('pending')) &&
                dateStr >= startStr && dateStr <= endStr;
        });
    }

    const renderCalendar = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) { days.push(<div key={`empty-${i}`} className="h-32 bg-stone-50 border border-stone-100"></div>); }
        for (let d = 1; d <= daysInMonth; d++) {
            const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = d === today.getDate() && month === today.getMonth();
            const dayEvents = getEventsForDate(currentDayStr);
            days.push(
                <div key={d} onClick={() => setSelectedDate(currentDayStr)} className={`h-36 border border-stone-100 p-2 flex flex-col cursor-pointer transition-colors hover:bg-stone-50 ${isToday ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white'}`}>
                    <div className={`font-bold text-xs mb-1 flex justify-between ${isToday ? 'text-amber-600' : 'text-stone-400'}`}>
                        <span>{d}</span> {dayEvents.length > 0 && <span className="text-[10px] bg-stone-200 text-stone-600 px-1 rounded-full">{dayEvents.length}</span>}
                    </div>
                    <div className="space-y-1 overflow-hidden flex-1">
                        {dayEvents.slice(0, 4).map(evt => {
                            const isLeave = evt.leave_type === 'annual' || evt.leave_type === 'sick' || evt.leave_type === 'other';
                            const isPending = evt.status.includes('pending');
                            const empName = (evt as any).employees?.full_name || '未知';
                            return (<div key={evt.id} className={`text-[10px] p-0.5 px-1 rounded border-l-2 truncate leading-tight ${isPending ? 'bg-stone-50 border-stone-300 text-stone-400 border-dashed' : isLeave ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-sky-50 border-sky-300 text-sky-700'}`}>{isPending ? '?' : ''}{empName}</div>)
                        })}
                    </div>
                </div>
            );
        }
        return (
            <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 bg-stone-100 border-b border-stone-200 min-w-[700px] overflow-auto">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (<div key={d} className="py-2 text-center text-xs font-bold text-stone-500">{d}</div>))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-stone-200 min-w-[700px] overflow-auto">{days}</div>
            </div>
        );
    };

    const abroadEmployees = employees.filter(e => e.current_status === 'abroad');
    const normalEmployees = filteredEmployees.filter(e => e.current_status !== 'abroad');
    const myStatus = currentEmp ? employees.find(e => e.id === currentEmp.id)?.current_status : 'in_office';
    const myStatusConfig = getStatusConfig(myStatus as EmployeeStatus);

    if (loading && employees.length === 0) return <div className="flex justify-center items-center h-64 text-stone-500"><RefreshCw className="animate-spin mr-2" /> 載入人員狀態中...</div>;

    // Status Summary Card Component
    const SummaryCard = ({ label, count, icon: Icon, colorClass, bgClass }: any) => (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgClass} ${colorClass} bg-opacity-30 border-opacity-30 flex-1 min-w-[120px]`}>
            <div className={`p-2 rounded-lg bg-white/80 shadow-sm ${colorClass}`}>
                <Icon size={18} />
            </div>
            <div>
                <div className="text-[10px] font-bold opacity-70 uppercase tracking-wider">{label}</div>
                <div className="text-xl font-bold leading-none">{count}</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 relative pb-24 md:pb-0">

            {/* Hero Section: My Status (Collapsed on mobile) */}
            {currentEmp && (
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl shadow-xl shadow-orange-200/50 p-4 md:p-6 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>

                    <div className="relative z-10 flex flex-row items-center justify-between gap-4 md:gap-6">
                        <div className="flex items-center gap-5 w-full md:w-auto">
                            <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl border-4 border-white/20 overflow-hidden bg-white/20 flex items-center justify-center text-xl md:text-3xl font-bold shadow-inner shrink-0 backdrop-blur-sm">
                                {currentEmp.avatar_url ? <img src={currentEmp.avatar_url} className="w-full h-full object-cover" /> : currentEmp.full_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate flex items-center gap-2">
                                    {currentEmp.full_name}
                                    {currentEmp.role === 'admin' && <ShieldCheck size={18} className="text-amber-300" title="管理員" />}
                                </h1>
                                <div className="flex items-center gap-2 text-orange-50 mt-1.5 font-medium text-sm md:text-base truncate opacity-90">
                                    <span className="bg-black/10 px-2 py-0.5 rounded">{currentEmp.department}</span>
                                    <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                                    <span>{currentEmp.job_title}</span>
                                </div>
                                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm bg-white text-orange-700`}>
                                    <myStatusConfig.icon size={16} /> {myStatusConfig.label}
                                </div>
                            </div>
                        </div>

                        {/* Desktop Quick Actions */}
                        <div className="hidden lg:flex flex-col gap-2 w-full md:w-auto">
                            <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-1 text-center md:text-left opacity-80">快速切換狀態</p>
                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'in_office')} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-sm text-white rounded-xl font-bold transition-all border border-white/10 shadow-sm">
                                    <Building2 size={18} /> 廠內
                                </button>
                                <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'meeting')} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-sm text-white rounded-xl font-bold transition-all border border-white/10 shadow-sm">
                                    <CheckCircle2 size={18} /> 會議
                                </button>
                                <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'out')} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-sm text-white rounded-xl font-bold transition-all border border-white/10 shadow-sm">
                                    <MapPin size={18} /> 外出
                                </button>
                                <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'abroad')} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 hover:scale-105 backdrop-blur-sm text-white rounded-xl font-bold transition-all border border-white/10 shadow-sm">
                                    <Plane size={18} /> 出國
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Real-time Status Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in">
                <SummaryCard
                    label="廠內辦公"
                    count={statusCounts['in_office'] || 0}
                    icon={Building2}
                    colorClass="text-emerald-700"
                    bgClass="bg-emerald-50 border-emerald-100"
                />
                <SummaryCard
                    label="會議中"
                    count={statusCounts['meeting'] || 0}
                    icon={CheckCircle2}
                    colorClass="text-amber-700"
                    bgClass="bg-amber-50 border-amber-100"
                />
                <SummaryCard
                    label="外出公務"
                    count={statusCounts['out'] || 0}
                    icon={MapPin}
                    colorClass="text-stone-700"
                    bgClass="bg-stone-100 border-stone-200"
                />
                <SummaryCard
                    label="出國考察"
                    count={statusCounts['abroad'] || 0}
                    icon={Plane}
                    colorClass="text-sky-700"
                    bgClass="bg-sky-50 border-sky-100"
                />
                <SummaryCard
                    label="休假/未到"
                    count={statusCounts['leave'] || 0}
                    icon={Coffee}
                    colorClass="text-rose-700"
                    bgClass="bg-rose-50 border-rose-100"
                />
            </div>

            {/* FAB: Floating Action Button for Mobile/Tablet Status Update */}
            <div className="lg:hidden fixed bottom-20 right-4 z-40">
                <button
                    onClick={() => setIsMobileSheetOpen(true)}
                    className="bg-accent text-white p-4 rounded-full shadow-xl shadow-orange-300 border-4 border-white active:scale-95 transition-transform"
                    aria-label="更新狀態"
                >
                    <Plus size={24} strokeWidth={3} />
                </button>
            </div>

            {/* Mobile Bottom Sheet for Status Selection */}
            {isMobileSheetOpen && currentEmp && (
                <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileSheetOpen(false)}></div>
                    <div className="relative bg-white w-full rounded-t-3xl p-6 pb-safe space-y-4 animate-slide-up shadow-2xl max-w-md mx-auto">
                        <div className="flex justify-center mb-2">
                            <div className="w-12 h-1.5 bg-stone-200 rounded-full"></div>
                        </div>
                        <h3 className="text-lg font-bold text-stone-800 text-center mb-4">選擇新狀態</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'in_office')} className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-bold active:bg-emerald-100">
                                <Building2 size={32} /> 廠內辦公
                            </button>
                            <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'meeting')} className="flex flex-col items-center justify-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 font-bold active:bg-amber-100">
                                <CheckCircle2 size={32} /> 會議中
                            </button>
                            <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'out')} className="flex flex-col items-center justify-center gap-2 p-4 bg-stone-100 text-stone-700 rounded-2xl border border-stone-200 font-bold active:bg-stone-200">
                                <MapPin size={32} /> 外出公務
                            </button>
                            <button onClick={() => handleQuickStatusUpdate(currentEmp.id, 'abroad')} className="flex flex-col items-center justify-center gap-2 p-4 bg-sky-50 text-sky-700 rounded-2xl border border-sky-100 font-bold active:bg-sky-100">
                                <Plane size={32} /> 出國考察
                            </button>
                        </div>
                        <button onClick={() => setIsMobileSheetOpen(false)} className="w-full py-3 text-stone-400 font-bold mt-2">取消</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-stone-200 pb-5 pt-2">
                <div>
                    <h2 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-2">
                        <Users className="text-accent" size={26} /> 全廠人員列表
                    </h2>
                    <p className="text-stone-500 text-sm mt-1">即時監控 {employees.length} 位員工狀態</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    <div className="bg-stone-100 p-1 rounded-xl flex border border-stone-200">
                        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
                            <List size={14} /> 列表
                        </button>
                        <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>
                            <CalendarIcon size={14} /> 日曆
                        </button>
                    </div>
                    {/* Search filters */}
                    <div className="flex gap-2 flex-1 md:flex-none w-full md:w-auto">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
                            <input type="text" placeholder="搜尋姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-accent/50 outline-none bg-white shadow-sm" />
                        </div>
                        <div className="relative w-28 md:w-36">
                            <Filter size={16} className="absolute left-3 top-2.5 text-stone-400" />
                            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full pl-9 pr-2 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-accent/50 bg-white outline-none appearance-none shadow-sm cursor-pointer font-bold text-stone-600">
                                {departments.map(d => <option key={d} value={d}>{d === 'All' ? '所有部門' : d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'list' && abroadEmployees.length > 0 && (
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 mb-6 shadow-sm">
                    <h3 className="text-sky-800 font-bold flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                        <Globe2 size={18} /> 目前出國人員 ({abroadEmployees.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {abroadEmployees.map(emp => (
                            <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3 border border-sky-100 group relative hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-lg border border-sky-200">
                                        {emp.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-stone-800">{emp.full_name}</div>
                                        <div className="text-xs text-stone-500">{emp.department}</div>
                                        <div className="text-xs text-sky-600 font-bold mt-1 flex items-center gap-1">
                                            <Plane size={12} /> {emp.location_detail || '未填寫地點'}
                                        </div>
                                    </div>
                                </div>
                                {emp.phone && (
                                    <a href={`tel:${emp.phone}`} className="absolute top-4 right-4 p-2 bg-stone-50 text-stone-400 hover:text-accent rounded-full border border-stone-100">
                                        <Phone size={16} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'calendar' ? renderCalendar() : (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">

                    {/* Desktop Table View (Hidden on Mobile/Tablet) */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-stone-100">
                            <thead className="bg-stone-50/80">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/4">員工資訊</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/5">部門/職稱</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/6">目前狀態</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/4">備註與時間</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">快速操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-stone-50">
                                {normalEmployees.map(emp => {
                                    const statusCfg = getStatusConfig(emp.current_status);
                                    const StatusIcon = statusCfg.icon;
                                    const isLunch = emp.current_status === 'in_office' && isLunchTime();
                                    const showRain = emp.current_status === 'out' && isRaining();

                                    return (
                                        <tr key={emp.id} className="hover:bg-stone-50/80 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold border border-stone-200 shadow-sm">
                                                        {emp.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                                            {emp.full_name}
                                                            {emp.phone && <a href={`tel:${emp.phone}`} className="text-stone-300 hover:text-accent transition-colors"><Phone size={12} /></a>}
                                                        </div>
                                                        <div className="text-xs text-stone-400 font-mono">{emp.employee_id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-stone-700">{emp.department}</div>
                                                <div className="text-xs text-stone-400">{emp.job_title}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-2 items-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusCfg.color}`}>
                                                        <StatusIcon size={12} className="mr-1.5" />
                                                        {statusCfg.label}
                                                    </span>
                                                    {isLunch && <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"><Utensils size={10} className="mr-1" /> 午休</span>}
                                                    {showRain && <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200 animate-pulse"><CloudRain size={10} className="mr-1" /> 雨天</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-stone-600 space-y-1">
                                                    {emp.location_detail && (<div className="flex items-center gap-1.5 font-medium max-w-xs truncate"><Briefcase size={12} className="text-stone-400" /> <span dangerouslySetInnerHTML={{ __html: emp.location_detail.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-accent hover:underline font-bold">地圖位置</a>') }}></span></div>)}
                                                    {emp.expected_return && (<div className="flex items-center gap-1.5 text-stone-500 text-xs"><Clock size={12} /> {new Date(emp.expected_return).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</div>)}
                                                    {!emp.location_detail && !emp.expected_return && <span className="text-stone-300">-</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleQuickStatusUpdate(emp.id, 'in_office')} className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-xs border border-emerald-100 font-bold transition-colors">廠內</button>
                                                    <button onClick={() => handleQuickStatusUpdate(emp.id, 'meeting')} className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded text-xs border border-amber-100 font-bold transition-colors">會議</button>
                                                    <button onClick={() => handleQuickStatusUpdate(emp.id, 'out')} className="text-stone-600 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded text-xs border border-stone-200 font-bold transition-colors">外出</button>
                                                    <button onClick={() => handleQuickStatusUpdate(emp.id, 'abroad')} className="text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded text-xs border border-sky-100 font-bold transition-colors">出國</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Tablet Card View (Visible on lg and below) */}
                    <div className="lg:hidden">
                        {normalEmployees.map(emp => {
                            const statusCfg = getStatusConfig(emp.current_status);
                            const StatusIcon = statusCfg.icon;
                            const isLunch = emp.current_status === 'in_office' && isLunchTime();
                            const showRain = emp.current_status === 'out' && isRaining();

                            return (
                                <div key={emp.id} className="p-4 border-b border-stone-100 flex items-center justify-between relative bg-white first:rounded-t-2xl last:rounded-b-2xl active:bg-stone-50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold border border-stone-200 shrink-0">
                                            {emp.full_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-stone-800 truncate text-base">{emp.full_name}</div>
                                            <div className="text-xs text-stone-500 mb-1.5 truncate">{emp.department}</div>
                                            <div className="flex gap-1 flex-wrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusCfg.color}`}>
                                                    <StatusIcon size={10} className="mr-1" /> {statusCfg.label}
                                                </span>
                                                {isLunch && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"><Utensils size={10} className="mr-1" /> 午休</span>}
                                                {showRain && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200"><CloudRain size={10} className="mr-1" /> 雨天</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1.5 ml-2">
                                        {emp.location_detail && (
                                            <div className="text-xs font-bold text-stone-600 bg-stone-50 px-2 py-1 rounded max-w-[120px] truncate border border-stone-100" dangerouslySetInnerHTML={{ __html: emp.location_detail.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-accent underline">GPS</a>') }}></div>
                                        )}
                                        {emp.expected_return && (
                                            <div className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                                                <Clock size={10} /> {new Date(emp.expected_return).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </div>
                                        )}
                                        {emp.phone && (
                                            <a href={`tel:${emp.phone}`} className="mt-1 p-2 bg-stone-50 text-stone-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-full border border-stone-200 transition-colors">
                                                <Phone size={14} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            )}

            {/* Calendar Details Modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-200">
                        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                                <CalendarIcon size={20} className="text-accent" />
                                {selectedDate} 人員動態
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {getEventsForDate(selectedDate).length === 0 ? (
                                <div className="text-center text-stone-400 py-8">本日無請假或外出紀錄</div>
                            ) : (
                                <div className="space-y-3">
                                    {getEventsForDate(selectedDate).map(evt => {
                                        const emp = (evt as any).employees;
                                        const isLeave = evt.leave_type === 'annual' || evt.leave_type === 'sick' || evt.leave_type === 'other';
                                        const statusColor = evt.status.includes('pending') ? 'bg-stone-50 border-stone-300' : isLeave ? 'bg-rose-50 border-rose-200' : 'bg-sky-50 border-sky-200';
                                        return (
                                            <div key={evt.id} className={`p-3 rounded-lg border ${statusColor} flex items-start gap-3`}>
                                                <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${isLeave ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                                                    {emp?.full_name?.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div className="font-bold text-stone-800">{emp?.full_name}</div>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${evt.status.includes('pending') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                            {evt.status.includes('pending') ? '待審核' : '已核准'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-stone-500 font-bold mb-1">{emp?.department}</div>
                                                    <div className="text-sm text-stone-700">
                                                        {isLeave ? '請假' : '公出/出差'} - {evt.reason}
                                                    </div>
                                                    <div className="text-xs text-stone-400 mt-2 flex items-center gap-1">
                                                        <Clock size={12} /> {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} ~ {new Date(evt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-stone-50 border-t border-stone-100 text-center">
                            <button onClick={() => setSelectedDate(null)} className="text-stone-500 font-bold text-sm hover:text-stone-800">關閉</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unified Status Update Modal */}
            {statusModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border ${statusModal.newStatus === 'meeting' ? 'border-amber-200' :
                            statusModal.newStatus === 'out' ? 'border-stone-200' : 'border-sky-200'
                        }`}>
                        <div className={`p-4 border-b flex items-center justify-between ${statusModal.newStatus === 'meeting' ? 'bg-amber-50 border-amber-100' :
                                statusModal.newStatus === 'out' ? 'bg-stone-50 border-stone-100' : 'bg-sky-50 border-sky-100'
                            }`}>
                            <h3 className={`font-bold text-lg flex items-center gap-2 ${statusModal.newStatus === 'meeting' ? 'text-amber-800' :
                                    statusModal.newStatus === 'out' ? 'text-stone-800' : 'text-sky-800'
                                }`}>
                                {statusModal.newStatus === 'meeting' && <CheckCircle2 size={24} />}
                                {statusModal.newStatus === 'out' && <MapPin size={24} />}
                                {statusModal.newStatus === 'abroad' && <Globe2 size={24} />}

                                更新狀態為「{
                                    statusModal.newStatus === 'meeting' ? '會議中' :
                                        statusModal.newStatus === 'out' ? '外出公務' : '出國考察'
                                }」
                            </h3>
                            <button onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))} className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-white/50 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-sm text-stone-600 mb-2">請輸入詳細資訊以便同仁知悉您的動向。</p>

                            {/* Note Input */}
                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">
                                    {statusModal.newStatus === 'meeting' ? '會議主題/地點' :
                                        statusModal.newStatus === 'out' ? '外出事由/地點' : '出國地點/備註'}
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={statusModal.note}
                                    onChange={e => setStatusModal(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full border border-stone-300 rounded-xl p-3 text-stone-800 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none shadow-sm transition-shadow"
                                    placeholder={
                                        statusModal.newStatus === 'meeting' ? '例如：產品研發會議 (會議室A)' :
                                            statusModal.newStatus === 'out' ? '例如：拜訪客戶 (內湖科學園區)' : '例如：日本東京參展'
                                    }
                                />
                            </div>

                            {/* Time Input */}
                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase flex items-center gap-1">
                                    <Clock size={12} />
                                    {statusModal.newStatus === 'meeting' ? '預計結束時間' :
                                        statusModal.newStatus === 'out' ? '預計返回時間' : '預計返國日期'}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={statusModal.returnTime}
                                    onChange={e => setStatusModal(prev => ({ ...prev, returnTime: e.target.value }))}
                                    className="w-full border border-stone-300 rounded-xl p-3 text-stone-800 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none shadow-sm transition-shadow bg-white"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                            <button onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-stone-500 font-bold hover:bg-stone-200 rounded-lg transition-colors">取消</button>
                            <button onClick={handleStatusSubmit} className={`px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 text-white transition-colors ${statusModal.newStatus === 'meeting' ? 'bg-amber-500 hover:bg-amber-600' : statusModal.newStatus === 'out' ? 'bg-stone-600 hover:bg-stone-700' : 'bg-sky-600 hover:bg-sky-700'}`}>
                                <Send size={16} /> 確認更新
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusDashboard;
