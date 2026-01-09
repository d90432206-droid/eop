
import React, { useEffect, useState } from 'react';
import { getVehicles, getVehicleBookings, getCurrentUser, returnVehicle, getVehicleLogs, cancelVehicleBooking, downloadCSV, getCurrentEmployee } from '../services/supabaseService';
import { Vehicle, VehicleBooking, VehicleLog, Employee } from '../types';
import { Car, Wrench, ArrowLeftRight, CheckCircle, RefreshCw, XCircle, Calendar, FileSpreadsheet, ArrowLeft, History, Navigation, Info, Clock } from 'lucide-react';

const VehicleMgmt: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [bookings, setBookings] = useState<VehicleBooking[]>([]);
    const [logs, setLogs] = useState<VehicleLog[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);

    const [activeTab, setActiveTab] = useState<'booking' | 'logs'>('booking');

    // Logs View State
    const [logViewMode, setLogViewMode] = useState<'list' | 'detail'>('list');
    const [selectedLogVehicle, setSelectedLogVehicle] = useState<number | null>(null);

    const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
    const [returnBookingId, setReturnBookingId] = useState<number | null>(null);
    const [returnMileage, setReturnMileage] = useState('');
    const [returnCondition, setReturnCondition] = useState('');
    const [returnLoading, setReturnLoading] = useState(false);

    const refreshData = async () => {
        try {
            const user = await getCurrentUser();
            if (user) setCurrentUserId(user.id);
            const emp = await getCurrentEmployee();
            setCurrentEmp(emp);

            const v = await getVehicles();
            setVehicles(v);
            const b = await getVehicleBookings();
            setBookings(b);
            const l = await getVehicleLogs();
            setLogs(l);
        } catch (e: any) {
            console.error(e.message);
        }
    };

    useEffect(() => { refreshData(); }, []);

    const handleReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnBookingId || !selectedVehicle) return;
        const vehicle = vehicles.find(v => v.id === selectedVehicle);
        const newMileage = parseInt(returnMileage) || 0;

        if (!vehicle) return;

        if (newMileage < vehicle.current_mileage) {
            alert(`❌ 錯誤：歸還里程 (${newMileage}) 不可小於出發前里程 (${vehicle.current_mileage})`);
            return;
        }

        if (newMileage - vehicle.current_mileage > 1000) {
            const confirmed = window.confirm(`⚠️ 警示：單次行駛里程超過 1000 公里 (行駛 ${newMileage - vehicle.current_mileage} km)。\n\n確定里程數輸入正確嗎？`);
            if (!confirmed) return;
        }

        if (!returnCondition.trim()) { alert("請填寫車況備註"); return; }

        setReturnLoading(true);
        try {
            await returnVehicle(returnBookingId, selectedVehicle, newMileage, returnCondition);
            setReturnBookingId(null); setReturnMileage(''); setReturnCondition(''); setSelectedVehicle(null);
            await refreshData();
            alert("歸還成功！");
        } catch (err: any) { alert(err.message); }
        finally { setReturnLoading(false); }
    }

    const handleCancelBooking = async (id: number) => {
        if (!confirm("確定要取消此預約嗎？")) return;
        try {
            await cancelVehicleBooking(id);
            refreshData();
        } catch (e: any) { alert(e.message); }
    }

    const exportBookingsCSV = () => {
        const data = bookings.map(b => ({
            單號: b.id,
            車輛: (b as any).vehicles?.name,
            申請人: (b as any).employees?.full_name,
            開始時間: new Date(b.start_time).toLocaleString('zh-TW', { hour12: false }),
            結束時間: new Date(b.end_time).toLocaleString('zh-TW', { hour12: false }),
            用途: b.purpose,
            狀態: b.status,
            歸還車況: b.return_condition || ''
        }));
        downloadCSV(data, 'Vehicle_Bookings');
    }

    const exportLogsCSV = () => {
        const filteredLogs = selectedLogVehicle ? logs.filter(l => l.vehicle_id === selectedLogVehicle) : logs;

        const data = filteredLogs.map(l => ({
            日期: new Date(l.created_at).toLocaleString('zh-TW', { hour12: false }),
            車輛: vehicles.find(v => v.id === l.vehicle_id)?.name || '',
            類型: l.log_type === 'refuel' ? '加油' : l.log_type === 'maintenance' ? '保養' : '維修',
            金額: l.cost,
            里程: l.mileage_at_log,
            說明: l.description,
            經手人: (l as any).employees?.full_name || ''
        }));
        downloadCSV(data, 'Vehicle_Logs');
    }

    // Determine the *Current Active* booking for the logged-in user to show "Return" button
    const getCurrentActiveBooking = (vid: number) => {
        const now = new Date();
        return bookings.find(b =>
            b.vehicle_id === vid &&
            b.status === 'approved' &&
            b.employee_id === currentUserId &&
            !b.returned_at &&
            new Date(b.start_time) <= now
        );
    }

    const getBorrowerName = (vid: number) => {
        const now = new Date();
        const booking = bookings.find(b =>
            b.vehicle_id === vid &&
            b.status === 'approved' &&
            !b.returned_at &&
            new Date(b.start_time) <= now
        );
        if (booking) return (booking as any).employees?.full_name || '未知';
        return null;
    }

    const getWeeklySchedule = (vid: number) => {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return bookings.filter(b => {
            if (b.vehicle_id !== vid) return false;
            if (b.status !== 'approved') return false; // Only show confirmed bookings
            if (b.returned_at) return false;

            const start = new Date(b.start_time);
            const end = new Date(b.end_time);

            // Check if overlap with next 7 days
            return start < weekFromNow && end > now;
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    };

    const myUpcomingBookings = bookings.filter(b => {
        if ((b.status !== 'approved' && !b.status.includes('pending')) || b.returned_at) return false;

        if (currentEmp?.role === 'admin') {
            return new Date(b.end_time) > new Date();
        } else {
            return b.employee_id === currentUserId && new Date(b.end_time) > new Date();
        }
    });

    const displayedLogs = selectedLogVehicle ? logs.filter(l => l.vehicle_id === selectedLogVehicle) : logs;
    const selectedLogVehicleName = selectedLogVehicle ? vehicles.find(v => v.id === selectedLogVehicle)?.name : '';

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200 gap-4 md:gap-0 pb-2">
                <div className="flex gap-4">
                    <button onClick={() => setActiveTab('booking')} className={`pb-2 px-2 font-bold flex items-center gap-2 border-b-4 transition-all rounded-t-lg ${activeTab === 'booking' ? 'border-accent text-accent bg-accent-soft' : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}><Car size={20} /> 車輛租借與歸還</button>
                    <button onClick={() => { setActiveTab('logs'); setLogViewMode('list'); setSelectedLogVehicle(null); }} className={`pb-2 px-2 font-bold flex items-center gap-2 border-b-4 transition-all rounded-t-lg ${activeTab === 'logs' ? 'border-accent text-accent bg-accent-soft' : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}><Wrench size={20} /> 維護與加油紀錄</button>
                </div>

                {/* Export Buttons */}
                {activeTab === 'booking' ? (
                    <button onClick={exportBookingsCSV} className="text-xs bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg mb-2 flex items-center gap-1 font-bold text-stone-600 transition-colors">
                        <FileSpreadsheet size={16} /> 匯出預約
                    </button>
                ) : (
                    <button onClick={exportLogsCSV} className="text-xs bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg mb-2 flex items-center gap-1 font-bold text-stone-600 transition-colors">
                        <FileSpreadsheet size={16} /> 匯出紀錄
                    </button>
                )}
            </div>

            {activeTab === 'booking' && (
                <>
                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 text-sky-800 text-sm font-bold flex items-center gap-2 mb-6">
                        <Info size={18} className="shrink-0" />
                        提示：若需預約公務車，請前往「差勤與請假」頁面，申請「公出/出差」時一併勾選車輛，經主管核准後將自動排入行程。
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map(car => {
                            const activeBooking = getCurrentActiveBooking(car.id);
                            const borrower = getBorrowerName(car.id);
                            const weeklySchedule = getWeeklySchedule(car.id);

                            return (
                                <div key={car.id} className={`relative overflow-hidden border rounded-2xl shadow-sm transition-all duration-300 group flex flex-col ${selectedVehicle === car.id ? 'ring-2 ring-accent border-transparent' : 'bg-white hover:border-accent hover:shadow-md'}`}>
                                    {/* 車輛大圖區 */}
                                    <div className="w-full h-44 overflow-hidden relative bg-stone-100 group">
                                        {car.image_url ? (
                                            <img src={car.image_url} alt={car.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                                                <Car size={48} strokeWidth={1.5} />
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-widest shadow-lg">
                                            {car.plate_number}
                                        </div>
                                    </div>

                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-black text-xl text-stone-800 tracking-tight leading-none">{car.name}</h3>
                                                <p className="text-xs text-stone-400 mt-2 font-medium">CHUYI 公務車輛</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-stone-500 bg-stone-50 rounded-xl p-3 mb-4 border border-stone-100">
                                            <div className="flex items-center gap-2"><Navigation size={14} className="text-accent" /><span className="font-mono font-bold">{car.current_mileage.toLocaleString()}</span> km</div>
                                            {borrower && <div className="text-xs text-amber-600 font-bold bg-amber-100 px-2.5 py-1 rounded-full">{borrower} 使用中</div>}
                                            {!borrower && <div className="text-xs text-emerald-600 font-bold bg-emerald-100 px-2.5 py-1 rounded-full">可借用</div>}
                                        </div>

                                        {activeBooking ? (
                                            <button onClick={() => { setSelectedVehicle(car.id); setReturnBookingId(activeBooking.id); }} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors">
                                                <ArrowLeftRight size={16} /> 歸還車輛
                                            </button>
                                        ) : (
                                            <button disabled className="w-full py-3 text-sm font-bold rounded-xl bg-stone-100 text-stone-400 cursor-not-allowed">
                                                {borrower ? '車輛使用中' : '請至差勤系統預約'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Weekly Schedule Preview */}
                                    <div className="bg-stone-50 border-t border-stone-100 p-4">
                                        <h4 className="text-xs font-bold text-stone-500 uppercase mb-2 flex items-center gap-1">
                                            <Calendar size={12} /> 未來 7 天預約狀況
                                        </h4>
                                        <div className="space-y-2">
                                            {weeklySchedule.length === 0 ? (
                                                <div className="text-xs text-stone-400 text-center py-2">無已核准預約</div>
                                            ) : (
                                                weeklySchedule.slice(0, 3).map(sch => (
                                                    <div key={sch.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-stone-100">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono font-bold text-stone-600">
                                                                {new Date(sch.start_time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} {new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            </span>
                                                            <span className="text-[10px] text-stone-400">
                                                                ~ {new Date(sch.end_time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} {new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                                                            {(sch as any).employees?.full_name}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                            {weeklySchedule.length > 3 && (
                                                <div className="text-[10px] text-center text-stone-400">+ 還有 {weeklySchedule.length - 3} 筆...</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedVehicle && returnBookingId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xl animate-fade-in mt-6">
                            <h3 className="text-lg font-bold mb-4 text-amber-800 flex items-center gap-2"><CheckCircle size={20} /> 歸還車輛確認</h3>
                            <form onSubmit={handleReturn} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase">歸還時里程數 (Km)</label><input required type="number" min="0" value={returnMileage} onChange={e => setReturnMileage(e.target.value)} className="w-full p-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white outline-none" /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase">車況備註</label><input required type="text" value={returnCondition} onChange={e => setReturnCondition(e.target.value)} className="w-full p-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white outline-none" /></div>
                                <div className="md:col-span-3 flex justify-end gap-3">
                                    <button type="button" onClick={() => { setReturnBookingId(null); setSelectedVehicle(null); }} className="px-5 py-2 text-stone-500 font-bold hover:bg-stone-200 rounded-lg">取消</button>
                                    <button type="submit" disabled={returnLoading} className="bg-amber-500 text-white px-8 py-2 rounded-lg font-bold hover:bg-amber-600 shadow-md flex items-center gap-2">{returnLoading ? <RefreshCw className="animate-spin" size={16} /> : '確認歸還'}</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Bookings List */}
                    {myUpcomingBookings.length > 0 && (
                        <div className="mt-8 bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
                                <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                    <Calendar size={20} /> {currentEmp?.role === 'admin' ? '全廠預約/借用狀態 (管理員可強制取消)' : '我的預約狀態'}
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-stone-200">
                                    <thead className="bg-stone-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">車輛</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">申請人</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">時間</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">目的</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">審核狀態</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-stone-100">
                                        {myUpcomingBookings.map(b => (
                                            <tr key={b.id}>
                                                <td className="px-6 py-4 font-bold text-stone-700">{(b as any).vehicles?.name}</td>
                                                <td className="px-6 py-4 text-sm text-stone-600">{(b as any).employees?.full_name}</td>
                                                <td className="px-6 py-4 text-sm text-stone-600 whitespace-nowrap">
                                                    {new Date(b.start_time).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    <span className="text-stone-300 mx-1">→</span>
                                                    {new Date(b.end_time).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-stone-600">{b.purpose}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            b.status.includes('pending') ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-stone-50 text-stone-600 border-stone-100'
                                                        }`}>
                                                        {b.status === 'approved' ? '已核准' : '簽核中'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleCancelBooking(b.id)} className={`text-xs font-bold flex items-center gap-1 ml-auto px-3 py-1.5 rounded-full border transition-all ${currentEmp?.role === 'admin' ? 'text-rose-500 border-rose-300 hover:bg-rose-50' : 'text-stone-400 border-stone-200 hover:text-rose-500 hover:bg-rose-50'}`}>
                                                        <XCircle size={14} /> {currentEmp?.role === 'admin' ? '強制取消' : '取消'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* NEW: Logs Tab Card View */}
            {activeTab === 'logs' && (
                <div className="w-full">
                    <div className="bg-sky-50 border-l-4 border-sky-400 p-4 rounded-r-xl mb-6 text-sm text-sky-800 font-medium flex items-center justify-between shadow-sm">
                        <span>💡 提示：如需新增加油或維修紀錄，請前往「費用報銷申請」頁面填寫，核准後將自動同步至此。</span>
                    </div>

                    {logViewMode === 'list' ? (
                        // Card View for Selecting Vehicle
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                            {vehicles.map(car => (
                                <div
                                    key={car.id}
                                    onClick={() => { setSelectedLogVehicle(car.id); setLogViewMode('detail'); }}
                                    className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-accent cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-stone-100 group-hover:bg-accent group-hover:text-white rounded-full transition-colors">
                                            <Car size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-stone-800">{car.name}</h3>
                                            <p className="text-xs font-mono text-stone-500">{car.plate_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-stone-500 pt-4 border-t border-stone-100">
                                        <span className="flex items-center gap-1"><History size={14} /> 歷史紀錄</span>
                                        <span className="font-bold bg-stone-100 px-2 py-1 rounded-full text-stone-600 group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                            {logs.filter(l => l.vehicle_id === car.id).length} 筆
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Detail Table View for Selected Vehicle
                        <div className="animate-fade-in">
                            <div className="flex items-center gap-4 mb-4">
                                <button onClick={() => { setLogViewMode('list'); setSelectedLogVehicle(null); }} className="p-2 bg-white border border-stone-200 shadow-sm rounded-full hover:bg-stone-50 text-stone-600 transition-colors">
                                    <ArrowLeft size={20} />
                                </button>
                                <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                                    <Car size={24} className="text-accent" />
                                    {selectedLogVehicleName} 維護歷史紀錄
                                </h3>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                                        <thead className="bg-stone-50"><tr><th className="px-6 py-3 text-left font-bold text-stone-500 uppercase">日期</th><th className="px-6 py-3 text-left font-bold text-stone-500 uppercase">類型</th><th className="px-6 py-3 text-left font-bold text-stone-500 uppercase">金額/里程</th><th className="px-6 py-3 text-left font-bold text-stone-500 uppercase">說明/經手人</th></tr></thead>
                                        <tbody className="bg-white divide-y divide-stone-100">
                                            {displayedLogs.length === 0 ? (
                                                <tr><td colSpan={4} className="p-8 text-center text-stone-400">尚無維護紀錄</td></tr>
                                            ) : displayedLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-stone-50">
                                                    <td className="px-6 py-4 text-stone-600 whitespace-nowrap">{new Date(log.created_at).toLocaleDateString('zh-TW', { hour12: false })}</td>
                                                    <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${log.log_type === 'refuel' ? 'bg-green-50 text-green-700 border-green-100' : log.log_type === 'maintenance' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{log.log_type === 'refuel' ? '加油' : log.log_type === 'maintenance' ? '保養' : '維修'}</span></td>
                                                    <td className="px-6 py-4"><div className="font-mono font-bold">${log.cost}</div><div className="text-xs text-stone-500">{log.mileage_at_log.toLocaleString()} km</div></td>
                                                    <td className="px-6 py-4"><div className="text-stone-800">{log.description}</div><div className="text-xs text-stone-400">by {(log as any).employees?.full_name}</div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default VehicleMgmt;
