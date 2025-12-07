
import React, { useEffect, useState } from 'react';
import { getVisitors, createVisitor, updateVisitorStatus, cancelVisitor, getCurrentEmployee, downloadCSV } from '../services/supabaseService';
import { Visitor, Employee } from '../types';
import { Users, Calendar, Plus, Clock, Building2, BedDouble, Car, Mail, CheckCircle2, LogOut, ArrowRight, User, XCircle, X, FileSpreadsheet, Trash2 } from 'lucide-react';

const VisitorLog: React.FC = () => {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Modal State
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Form
    const [visitDate, setVisitDate] = useState('');
    const [visitTime, setVisitTime] = useState('09:00');
    const [visitorName, setVisitorName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [count, setCount] = useState(1);
    const [purpose, setPurpose] = useState('');
    
    // New Fields
    const [needsAccommodation, setNeedsAccommodation] = useState(false);
    const [hotelName, setHotelName] = useState('');
    const [budget, setBudget] = useState('');
    const [needsPickup, setNeedsPickup] = useState(false);

    // Time Slots for Dropdown (07:00 to 20:00)
    const timeSlots = [];
    for(let i=7; i<=20; i++) {
        const h = i.toString().padStart(2, '0');
        timeSlots.push(`${h}:00`);
        timeSlots.push(`${h}:30`);
    }

    const refreshData = async () => {
        try {
            const data = await getVisitors();
            setVisitors(data);
            const emp = await getCurrentEmployee();
            setCurrentEmp(emp);
        } catch (e: any) {
            console.error(e.message);
        }
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createVisitor({
                visit_date: visitDate,
                visit_time: visitTime,
                visitor_name: visitorName,
                company_name: companyName,
                visitor_count: count,
                purpose,
                status: 'expected',
                needs_accommodation: needsAccommodation,
                hotel_name: needsAccommodation ? hotelName : undefined,
                accommodation_budget: needsAccommodation ? parseFloat(budget) : undefined,
                needs_pickup: needsPickup,
                host_employee_id: currentEmp?.id || null 
            });
            setIsFormOpen(false);
            setVisitorName(''); setCompanyName(''); setPurpose(''); 
            setNeedsAccommodation(false); setNeedsPickup(false); setHotelName(''); setBudget('');
            refreshData();
            
            // Mock Email Notification
            if (needsAccommodation || needsPickup) {
                alert(`訪客登記成功！\n\n系統已自動發送 Email 通知總務部門：\n• 需求：${needsAccommodation ? '安排住宿' : ''} ${needsPickup ? '安排接送' : ''}\n• 訪客：${visitorName} (${companyName})`);
            } else {
                alert("訪客登記成功！");
            }
        } catch (err: any) { alert(err.message); }
    }

    const handleStatusChange = async (id: number, status: 'arrived' | 'left') => {
        try {
            await updateVisitorStatus(id, status);
            refreshData();
        } catch (err: any) { alert(err.message); }
    }

    const handleCancel = async (id: number) => {
        if(!confirm("確定要取消/刪除此訪客預約嗎？")) return;
        try {
            await cancelVisitor(id);
            // Wait slightly for DB update
            setTimeout(() => {
                refreshData();
                alert("✅ 已成功取消");
            }, 300);
        } catch(err: any) { alert(err.message); }
    }

    const handleExportCSV = () => {
        const data = visitors.map(v => ({
            預約日期: v.visit_date,
            預約時間: v.visit_time,
            訪客姓名: v.visitor_name,
            公司名稱: v.company_name,
            人數: v.visitor_count,
            事由: v.purpose,
            接待人: (v as any).employees?.full_name,
            狀態: v.status,
            住宿需求: v.needs_accommodation ? '有' : '無',
            接送需求: v.needs_pickup ? '有' : '無'
        }));
        downloadCSV(data, 'Visitor_Logs');
    }

    const getVisitorsForDate = (dateStr: string) => {
        return visitors.filter(v => v.visit_date === dateStr);
    };

    const renderCalendar = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-stone-50 border border-stone-100"></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const daysVisitors = getVisitorsForDate(dateStr);
            const isToday = dateStr === today.toISOString().split('T')[0];

            days.push(
                <div 
                    key={d} 
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-36 border border-stone-100 p-2 flex flex-col cursor-pointer transition-colors hover:bg-stone-50 ${isToday ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white'}`}
                >
                    <div className={`font-bold text-xs mb-1 flex justify-between ${isToday ? 'text-amber-600' : 'text-stone-400'}`}>
                        <span>{d}</span>
                        {daysVisitors.length > 0 && <span className="text-[10px] bg-stone-200 text-stone-600 px-1 rounded-full">{daysVisitors.length}</span>}
                    </div>
                    
                    <div className="space-y-1 overflow-hidden flex-1">
                        {daysVisitors.slice(0, 3).map(v => (
                            <div key={v.id} className={`text-[10px] p-0.5 px-1 rounded border-l-2 truncate leading-tight ${
                                v.status === 'cancelled' ? 'bg-stone-50 border-stone-300 text-stone-400 line-through' :
                                v.status === 'arrived' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 
                                v.status === 'left' ? 'bg-stone-100 border-stone-300 text-stone-400' : 'bg-sky-50 border-sky-300 text-sky-700'
                            }`}>
                                {v.visit_time.slice(0,5)} {v.visitor_name}
                            </div>
                        ))}
                        {daysVisitors.length > 3 && (
                             <div className="text-[10px] text-stone-400 text-center font-bold">
                                 + {daysVisitors.length - 3} 更多...
                             </div>
                        )}
                    </div>
                </div>
            );
        }
        return (
            <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <div className="grid grid-cols-7 bg-stone-100 border-b border-stone-200 min-w-[700px]">
                        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                            <div key={d} className="py-2 text-center text-xs font-bold text-stone-500">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-stone-200 min-w-[700px]">
                        {days}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-10 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <Users size={28} className="text-accent" />
                        來賓訪客登記
                    </h2>
                    <p className="text-stone-500 text-sm mt-1">管理訪客預約、進出記錄與行政接待需求</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-white text-stone-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-50 border border-stone-200 shadow-sm transition-colors">
                        <FileSpreadsheet size={14} /> 匯出 CSV
                    </button>
                    <div className="bg-stone-100 p-1 rounded-xl flex border border-stone-200">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>列表</button>
                        <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>日曆</button>
                    </div>
                    <button 
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-xl hover:bg-accent-hover transition font-bold shadow-md shadow-orange-200 text-sm"
                    >
                        <Plus size={16} /> 登記訪客
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-accent mb-8 animate-fade-in ring-1 ring-stone-100">
                    <h3 className="font-bold text-lg mb-4 text-stone-800 flex items-center gap-2">
                        <Plus size={20} className="text-accent" /> 新增預約訪客
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Basic Info */}
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">日期</label>
                            <input required type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">預計抵達時段</label>
                            <select required value={visitTime} onChange={e => setVisitTime(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent bg-white outline-none">
                                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">訪客姓名</label>
                            <input required type="text" value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" placeholder="王小明" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">公司名稱</label>
                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" placeholder="ABC 科技" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">人數</label>
                            <input required type="number" min="1" value={count} onChange={e => setCount(parseInt(e.target.value))} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-500 mb-1">訪問事由</label>
                            <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" placeholder="業務洽談" />
                        </div>
                        
                        {/* Logistic Requirements */}
                        <div className="md:col-span-2 lg:col-span-3 bg-stone-50 p-4 rounded-xl border border-stone-200 mt-2">
                            <h4 className="font-bold text-stone-700 mb-3 flex items-center gap-2">
                                <Car size={16} /> 行政支援需求
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all ${needsAccommodation ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300' : 'bg-white border-stone-200 hover:border-amber-300'}`}>
                                    <input type="checkbox" checked={needsAccommodation} onChange={e => setNeedsAccommodation(e.target.checked)} className="w-4 h-4 text-amber-500 focus:ring-amber-500 rounded" />
                                    <div className="flex items-center gap-2">
                                        <BedDouble size={18} className={needsAccommodation ? 'text-amber-600' : 'text-stone-400'} />
                                        <span className={`font-bold ${needsAccommodation ? 'text-amber-800' : 'text-stone-600'}`}>需要安排住宿</span>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all ${needsPickup ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300' : 'bg-white border-stone-200 hover:border-sky-300'}`}>
                                    <input type="checkbox" checked={needsPickup} onChange={e => setNeedsPickup(e.target.checked)} className="w-4 h-4 text-sky-500 focus:ring-sky-500 rounded" />
                                    <div className="flex items-center gap-2">
                                        <Car size={18} className={needsPickup ? 'text-sky-600' : 'text-stone-400'} />
                                        <span className={`font-bold ${needsPickup ? 'text-sky-800' : 'text-stone-600'}`}>需要安排接送</span>
                                    </div>
                                </label>
                                
                                {needsAccommodation && (
                                    <>
                                        <div className="animate-fade-in">
                                            <label className="block text-xs font-bold text-stone-500 mb-1">指定飯店名稱 (選填)</label>
                                            <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-amber-500 focus:border-amber-500 outline-none" placeholder="例：喜來登飯店" />
                                        </div>
                                        <div className="animate-fade-in">
                                            <label className="block text-xs font-bold text-stone-500 mb-1">每晚預算金額</label>
                                            <div className="relative">
                                                <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full p-2.5 pl-6 border border-stone-300 rounded-xl focus:ring-amber-500 focus:border-amber-500 outline-none" placeholder="3000" />
                                                <span className="absolute left-2.5 top-2.5 text-stone-400 text-xs">$</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-xl transition-colors">取消</button>
                            <button type="submit" className="bg-stone-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-stone-700 shadow-md transition-all flex items-center gap-2">
                                <span>確認登記</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {viewMode === 'calendar' ? renderCalendar() : (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-stone-200">
                            <thead className="bg-stone-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/5">時間/訪客</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/4">公司與事由</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/5">行政需求</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-1/5">總務作業</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-stone-500 uppercase tracking-wider w-1/6">狀態操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {visitors.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-stone-400">目前尚無訪客預約</td>
                                    </tr>
                                ) : visitors.map(v => {
                                    // Permission Logic: Admin OR Host can cancel
                                    const canCancel = currentEmp?.role === 'admin' || currentEmp?.id === v.host_employee_id;
                                    
                                    return (
                                    <tr key={v.id} className="hover:bg-stone-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-stone-800 flex items-center gap-2">
                                                <Calendar size={14} className="text-stone-400"/> {v.visit_date}
                                            </div>
                                            <div className="text-sm text-stone-500 pl-6 mb-1 flex items-center gap-1">
                                                <Clock size={12}/> {v.visit_time.slice(0,5)}
                                            </div>
                                            <div className={`text-lg font-bold pl-6 truncate max-w-[150px] ${v.status === 'cancelled' ? 'text-stone-400 line-through' : 'text-primary'}`} title={v.visitor_name}>{v.visitor_name}</div>
                                            <div className="text-xs text-stone-400 pl-6 mt-1 flex items-center gap-1">
                                                <User size={10} /> 登記人: {(v as any).employees?.full_name || '未知'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-stone-700 flex items-center gap-1 truncate max-w-[180px]" title={v.company_name || '無公司'}>
                                                <Building2 size={12}/> {v.company_name || '無公司'}
                                            </div>
                                            <div className="text-xs text-stone-500 mt-1 bg-stone-100 px-1.5 py-0.5 rounded inline-block truncate max-w-[150px]" title={v.purpose || '一般拜訪'}>{v.purpose || '一般拜訪'}</div>
                                            <div className="text-xs text-stone-400 mt-1">人數: {v.visitor_count}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1.5">
                                                {v.needs_accommodation && (
                                                    <div className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 w-fit font-medium truncate max-w-[150px]" title={v.hotel_name}>
                                                        <BedDouble size={12} /> 住宿: {v.hotel_name || '未指定'}
                                                        {v.accommodation_budget && <span className="text-amber-600">(${v.accommodation_budget})</span>}
                                                    </div>
                                                )}
                                                {v.needs_pickup && (
                                                    <div className="text-xs bg-sky-50 text-sky-800 px-2 py-1 rounded border border-sky-100 flex items-center gap-1 w-fit font-medium">
                                                        <Car size={12} /> 需要接送
                                                    </div>
                                                )}
                                                {!v.needs_accommodation && !v.needs_pickup && <span className="text-stone-300 text-xs">- 無需求 -</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {v.needs_accommodation ? (
                                                <div className="text-xs">
                                                    {v.booking_ref ? (
                                                        <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                            <CheckCircle2 size={12}/> 已訂房: {v.booking_ref}
                                                        </span>
                                                    ) : (
                                                        <div className="flex gap-2 items-center">
                                                            <input type="text" placeholder="輸入訂房編號" className="border border-stone-300 text-[10px] p-1.5 rounded w-28 focus:border-stone-500 focus:ring-0" />
                                                            <button 
                                                                onClick={() => alert("已儲存訂房編號並發送通知信給申請人！")}
                                                                className="bg-stone-700 text-white p-1.5 rounded hover:bg-stone-600" title="儲存並通知"
                                                            >
                                                                <Mail size={12}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : <span className="text-stone-300 text-xs">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-4 py-1.5 text-sm font-bold rounded-full border shadow-sm ${
                                                    v.status === 'arrived' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                    v.status === 'left' ? 'bg-stone-100 text-stone-500 border-stone-200' : 
                                                    v.status === 'cancelled' ? 'bg-stone-200 text-stone-400 border-stone-300' : 'bg-amber-100 text-amber-800 border-amber-200'
                                                }`}>
                                                    {v.status === 'arrived' ? '已入廠' : v.status === 'left' ? '已離開' : v.status === 'cancelled' ? '已取消' : '預計來訪'}
                                                </span>
                                                
                                                {v.status === 'expected' && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(v.id, 'arrived')} className="text-sm text-emerald-700 font-bold border border-emerald-200 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 flex items-center gap-1 transition-colors shadow-sm">
                                                            <CheckCircle2 size={16} /> 標記已到
                                                        </button>
                                                        {canCancel && (
                                                            <button onClick={() => handleCancel(v.id)} className="text-sm text-stone-400 font-bold hover:text-rose-500 flex items-center gap-1 mt-1 px-2 py-1">
                                                                <XCircle size={16} /> 取消
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {v.status === 'arrived' && (
                                                    <button onClick={() => handleStatusChange(v.id, 'left')} className="text-sm text-stone-600 font-bold border border-stone-200 bg-stone-50 px-4 py-2 rounded-xl hover:bg-stone-100 flex items-center gap-1 transition-colors shadow-sm">
                                                        <LogOut size={16} /> 標記離開
                                                    </button>
                                                )}
                                                {v.status === 'cancelled' && (
                                                     <span className="text-xs text-stone-300">--</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Calendar Detail Modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-200">
                        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                                <Calendar size={20} className="text-accent" />
                                {selectedDate} 訪客名單
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {getVisitorsForDate(selectedDate).length === 0 ? (
                                <div className="text-center text-stone-400 py-8">本日無訪客預約</div>
                            ) : (
                                <div className="space-y-3">
                                    {getVisitorsForDate(selectedDate).map(v => (
                                        <div key={v.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${
                                            v.status === 'cancelled' ? 'bg-stone-50 border-stone-200 opacity-60' :
                                            v.status === 'arrived' ? 'bg-emerald-50 border-emerald-200' : 
                                            v.status === 'left' ? 'bg-stone-50 border-stone-200' : 'bg-sky-50 border-sky-200'
                                        }`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-stone-800 flex items-center gap-2">
                                                        {v.visitor_name}
                                                        <span className="text-xs font-normal text-stone-500">({v.company_name})</span>
                                                    </div>
                                                    <div className="text-xs text-stone-500 mt-0.5">{v.purpose} | {v.visitor_count} 人</div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    v.status === 'arrived' ? 'bg-emerald-200 text-emerald-800' :
                                                    v.status === 'left' ? 'bg-stone-200 text-stone-600' : 
                                                    v.status === 'cancelled' ? 'bg-red-100 text-red-600 line-through' : 'bg-sky-200 text-sky-800'
                                                }`}>
                                                    {v.status === 'arrived' ? '已到' : v.status === 'left' ? '已離' : v.status === 'cancelled' ? '取消' : '預計'}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 text-xs text-stone-600 pt-2 border-t border-stone-200/50 mt-1">
                                                <div className="flex items-center gap-1"><Clock size={12}/> {v.visit_time.slice(0,5)}</div>
                                                <div className="flex items-center gap-1"><User size={12}/> 接待: {(v as any).employees?.full_name}</div>
                                            </div>
                                            
                                            {(v.needs_accommodation || v.needs_pickup) && (
                                                <div className="flex gap-2 mt-1">
                                                    {v.needs_accommodation && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded">需住宿</span>}
                                                    {v.needs_pickup && <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 rounded">需接送</span>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-stone-50 border-t border-stone-100 text-center">
                            <button onClick={() => setSelectedDate(null)} className="text-stone-500 font-bold text-sm hover:text-stone-800">關閉</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisitorLog;
