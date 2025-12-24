
import React, { useState, useEffect, useRef } from 'react';
import { createExpenseClaim, getExpenseClaims, getCurrentUser, getMyBusinessTrips, getCurrentEmployee, updateExpenseStatus, createVehicleLog, getVehicles, getVehicleBookings, updateVehicleMileage, submitExpenseClaim } from '../services/supabaseService';
import { ExpenseClaim, LeaveRequest, Employee, Vehicle, VehicleBooking } from '../types';
import { Receipt, Globe, Plus, Utensils, BedDouble, Briefcase, CalendarClock, Info, Printer, ArrowRightCircle, CheckCircle, Trash2, Fuel, ChevronLeft, Download, FileText, ChevronRight, Send } from 'lucide-react';

const ExpenseClaims: React.FC = () => {
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [selectedTrip, setSelectedTrip] = useState<LeaveRequest | null>(null);
    const [tripExpenses, setTripExpenses] = useState<ExpenseClaim[]>([]);
    const [myTrips, setMyTrips] = useState<LeaveRequest[]>([]);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);

    // Form Input State
    const [date, setDate] = useState('');
    const [category, setCategory] = useState('Travel');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('TWD');
    const [description, setDescription] = useState('');

    // Fuel Specific
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<string>('');
    const [mileage, setMileage] = useState('');

    // Print Ref
    const printRef = useRef<HTMLDivElement>(null);

    const refreshData = async () => {
        try {
            const user = await getCurrentUser();
            if (user) {
                setCurrentUserId(user.id);
                const emp = await getCurrentEmployee();
                setCurrentEmp(emp);

                // Fetch approved business trips
                const trips = await getMyBusinessTrips(user.id);
                setMyTrips(trips);
            }

            const vs = await getVehicles();
            setVehicles(vs);
        } catch (e: any) {
            console.error(e.message);
        }
    };

    const fetchTripExpenses = async (tripId: number) => {
        try {
            const expenses = await getExpenseClaims(tripId);
            setTripExpenses(expenses);
        } catch (e: any) {
            console.error(e);
        }
    }

    useEffect(() => { refreshData(); }, []);

    const handleSelectTrip = async (trip: LeaveRequest) => {
        setSelectedTrip(trip);
        await fetchTripExpenses(trip.id);

        // Auto-set date to trip start
        setDate(trip.start_time.split('T')[0]);
        setViewMode('detail');
    }

    const handleSubmitExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUserId || !selectedTrip) return;

        try {
            // 1. Create Expense
            // Note: services/supabaseService.ts handles the missing column by tagging description
            await createExpenseClaim({
                employee_id: currentUserId,
                leave_request_id: selectedTrip.id,
                claim_date: date,
                category,
                amount: Math.floor(parseFloat(amount)),
                currency,
                description,
                status: 'pending' // Auto-approved logic could be here if needed
            });

            // 2. Handle Fuel Logic
            if (category === 'Fuel' && selectedVehicle && mileage) {
                const vehicleId = parseInt(selectedVehicle);
                const mileageNum = parseInt(mileage);
                await createVehicleLog({
                    vehicle_id: vehicleId,
                    employee_id: currentUserId,
                    log_type: 'refuel',
                    cost: Math.floor(parseFloat(amount)),
                    description: `[出差報銷] ${description}`,
                    mileage_at_log: mileageNum
                });
                await updateVehicleMileage(vehicleId, mileageNum);
            }

            // Reset form
            setAmount(''); setDescription(''); setCategory('Travel');
            setSelectedVehicle(''); setMileage('');

            // Refresh list
            await fetchTripExpenses(selectedTrip.id);
            alert("✅ 費用已新增至此出差單");
        } catch (e: any) {
            alert(e.message);
        }
    }

    const handleDeleteExpense = async (id: number) => {
        if (!confirm("確定要刪除此筆費用嗎？")) return;
        try {
            await updateExpenseStatus(id, 'cancelled');
            if (selectedTrip) await fetchTripExpenses(selectedTrip.id);
        } catch (e: any) {
            alert(e.message);
        }
    }

    const handleSubmitAll = async () => {
        if (!selectedTrip) return;
        if (!confirm("確定要送出這些費用進行審核嗎？送出後將無法修改。")) return;

        try {
            await submitExpenseClaim(selectedTrip.id);
            await fetchTripExpenses(selectedTrip.id); // Refresh to see updated status
            alert("✅ 費用申請已送出至總務部門！");
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printContent = printRef.current.innerHTML;
            const originalContents = document.body.innerHTML;

            document.body.innerHTML = printContent;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // Reload to restore event listeners
        }
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'Travel': return <Globe size={16} />;
            case 'Meal': return <Utensils size={16} />;
            case 'Accommodation': return <BedDouble size={16} />;
            case 'Fuel': return <Fuel size={16} />;
            default: return <Briefcase size={16} />;
        }
    };

    const totalAmount = tripExpenses
        .filter(e => e.status !== 'cancelled' && e.status !== 'rejected')
        .reduce((sum, e) => sum + e.amount, 0);

    // -- RENDER: List View --
    if (viewMode === 'list') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                            <Briefcase size={28} className="text-accent" /> 出差費用報銷
                        </h2>
                        <p className="text-stone-500 text-sm mt-1">請選擇下方的「已核准出差單」來進行費用申報</p>
                    </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="p-4 text-xs font-bold text-stone-500 uppercase">單號</th>
                                <th className="p-4 text-xs font-bold text-stone-500 uppercase">申請人/部門</th>
                                <th className="p-4 text-xs font-bold text-stone-500 uppercase">日期區間</th>
                                <th className="p-4 text-xs font-bold text-stone-500 uppercase">事由</th>
                                <th className="p-4 text-xs font-bold text-stone-500 uppercase text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {myTrips.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-stone-400">
                                        目前沒有已核准的出差紀錄可供報銷
                                    </td>
                                </tr>
                            ) : (
                                myTrips.map(trip => (
                                    <tr key={trip.id} onClick={() => handleSelectTrip(trip)} className="hover:bg-stone-50 cursor-pointer transition-colors group">
                                        <td className="p-4 font-mono font-bold text-stone-800">#{trip.id}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-stone-800">{(trip.employees as any)?.full_name || '未知'}</div>
                                            <div className="text-xs text-stone-400">{(trip.employees as any)?.department || '-'}</div>
                                        </td>
                                        <td className="p-4 text-sm text-stone-600">
                                            {new Date(trip.start_time).toLocaleDateString()} ~ {new Date(trip.end_time).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-sm text-stone-600 max-w-xs truncate">{trip.reason}</td>
                                        <td className="p-4 text-right">
                                            <button className="text-sm font-bold text-accent hover:text-accent-dark flex items-center justify-end gap-1 px-3 py-1.5 rounded-lg border border-transparent hover:bg-white hover:border-stone-200 transition-all">
                                                填寫明細 <ArrowRightCircle size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    // -- RENDER: Detail View --
    return (
        <div className="space-y-6">
            <button onClick={() => setViewMode('list')} className="flex items-center gap-1 text-stone-500 hover:text-stone-800 font-bold transition-colors">
                <ChevronLeft size={20} /> 返回列表
            </button>

            {selectedTrip && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Trip Info & Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                            <h3 className="font-bold text-lg text-stone-800 mb-4 flex items-center gap-2">
                                <Info size={20} className="text-accent" /> 出差資訊
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div><span className="text-stone-500 block text-xs uppercase font-bold">單號</span> <span className="font-mono font-bold text-stone-800">#{selectedTrip.id}</span></div>
                                <div><span className="text-stone-500 block text-xs uppercase font-bold">申請人</span> <span className="font-bold text-stone-800">{(selectedTrip.employees as any)?.full_name}</span></div>
                                <div><span className="text-stone-500 block text-xs uppercase font-bold">日期</span> <span className="font-bold text-stone-800">{new Date(selectedTrip.start_time).toLocaleDateString()} ~ {new Date(selectedTrip.end_time).toLocaleDateString()}</span></div>
                                <div><span className="text-stone-500 block text-xs uppercase font-bold">事由</span> <span className="font-bold text-stone-800">{selectedTrip.reason}</span></div>
                            </div>
                        </div>

                        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                            <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-accent" /> 新增費用
                            </h3>
                            <form onSubmit={handleSubmitExpense} className="space-y-4">
                                <div><label className="block text-xs font-bold text-stone-500 mb-1">日期</label><input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-accent/50 outline-none" /></div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">類別</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-accent/50 outline-none">
                                        <option value="Travel">交通費</option>
                                        <option value="Meal">誤餐費</option>
                                        <option value="Accommodation">住宿費</option>
                                        <option value="Fuel">公務車加油</option>
                                        <option value="Office Supplies">雜支</option>
                                    </select>
                                </div>
                                {category === 'Fuel' && (
                                    <div className="bg-amber-100 p-3 rounded-lg border border-amber-200 space-y-2">
                                        <div><label className="block text-xs font-bold text-amber-800">車輛</label><select required value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} className="w-full p-1.5 border border-amber-300 rounded text-sm"><option value="">- 請選擇 -</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}</select></div>
                                        <div><label className="block text-xs font-bold text-amber-800">當前里程 (km)</label><input required type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full p-1.5 border border-amber-300 rounded text-sm" /></div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">說明</label>
                                    <input required type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-accent/50 outline-none" placeholder="例：高鐵台北-高雄" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-stone-500 mb-1">幣別</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm bg-white"><option value="TWD">TWD</option><option value="USD">USD</option><option value="JPY">JPY</option></select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-stone-500 mb-1">金額</label>
                                        <input required type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-accent/50 outline-none" placeholder="0" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-stone-800 text-white py-2.5 rounded-xl font-bold hover:bg-stone-700 shadow-md transition-colors mt-2">加入費用</button>
                            </form>
                        </div>
                    </div>

                    {/* Right: Expenses List & Print Preview */}
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col h-full overflow-hidden">
                            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                                <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                    <FileText size={20} className="text-stone-400" /> 費用明細 ({tripExpenses.length})
                                </h3>
                                <button onClick={handlePrint} disabled={tripExpenses.length === 0} className="flex items-center gap-2 bg-white text-stone-700 px-3 py-1.5 rounded-lg border border-stone-300 text-sm font-bold hover:bg-stone-50 disabled:opacity-50">
                                    <Printer size={16} /> 列印
                                </button>
                                {tripExpenses.some(e => e.status === 'pending') && (
                                    <button onClick={handleSubmitAll} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg border border-emerald-700 text-sm font-bold hover:bg-emerald-700 shadow-sm ml-2">
                                        <Send size={16} /> 送出至總務
                                    </button>
                                )}
                            </div>

                            {/* UI List View */}
                            <div className="flex-1 overflow-auto p-4">
                                {tripExpenses.length === 0 ? (
                                    <div className="text-center text-stone-400 py-12">尚未新增任何費用</div>
                                ) : (
                                    <div className="space-y-3">
                                        {tripExpenses.map(exp => (
                                            <div key={exp.id} className="flex items-center justify-between p-3 border border-stone-100 rounded-xl hover:bg-stone-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${exp.category === 'Fuel' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-600'}`}>
                                                        {getCategoryIcon(exp.category)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-stone-800 text-sm">{exp.description}</div>
                                                        <div className="text-xs text-stone-400">{exp.claim_date} • {exp.category}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-mono font-bold text-stone-800">{exp.currency} {exp.amount.toLocaleString()}</span>
                                                    {exp.status !== 'cancelled' && (
                                                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-rose-300 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                                                    )}
                                                    {exp.status === 'cancelled' && <span className="text-xs text-stone-400 font-bold">已刪除</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-stone-100 bg-stone-50 text-right">
                                <span className="text-sm font-bold text-stone-500 mr-2">總計金額:</span>
                                <span className="text-2xl font-mono font-bold text-accent">TWD {totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Template */}
            <div className="hidden">
                <div ref={printRef} className="p-10 font-serif text-black bg-white max-w-[210mm] mx-auto">
                    <style>{`
                        @media print {
                            @page { size: A4; margin: 20mm; }
                            body { background: white; -webkit-print-color-adjust: exact; }
                            .print-hidden { display: none !important; }
                        }
                    `}</style>

                    <div className="text-center border-b-2 border-black pb-4 mb-6">
                        <h1 className="text-3xl font-bold tracking-widest mb-2">出差旅費報告書</h1>
                        <h2 className="text-lg">Expense Report</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div>
                            <p className="mb-2"><span className="font-bold w-24 inline-block">申請日期:</span> {new Date().toLocaleDateString()}</p>
                            {/* Updated to show Trip Applicant Info correctly */}
                            <p className="mb-2"><span className="font-bold w-24 inline-block">申請部門:</span> {(selectedTrip?.employees as any)?.department || currentEmp?.department}</p>
                            <p className="mb-2"><span className="font-bold w-24 inline-block">申請人:</span> {(selectedTrip?.employees as any)?.full_name || currentEmp?.full_name} ({(selectedTrip?.employees as any)?.job_title || currentEmp?.job_title})</p>
                        </div>
                        <div className="text-right">
                            <p className="mb-2"><span className="font-bold w-24 inline-block">出差單號:</span> #{selectedTrip?.id}</p>
                            <p className="mb-2"><span className="font-bold w-24 inline-block">出差期間:</span> {selectedTrip ? `${new Date(selectedTrip.start_time).toLocaleDateString()} ~ ${new Date(selectedTrip.end_time).toLocaleDateString()}` : ''}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="font-bold mb-1">出差事由 / 地點:</p>
                        <div className="border border-black p-2 min-h-[40px]">{selectedTrip?.reason}</div>
                    </div>

                    <table className="w-full border-collapse border border-black text-sm mb-6">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2">日期</th>
                                <th className="border border-black p-2">類別</th>
                                <th className="border border-black p-2">摘要說明</th>
                                <th className="border border-black p-2 text-right">金額 (TWD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tripExpenses.filter(e => e.status !== 'cancelled').map(exp => (
                                <tr key={exp.id}>
                                    <td className="border border-black p-2 text-center">{exp.claim_date}</td>
                                    <td className="border border-black p-2 text-center">{exp.category === 'Travel' ? '交通' : exp.category === 'Meal' ? '誤餐' : exp.category === 'Fuel' ? '加油' : exp.category}</td>
                                    <td className="border border-black p-2">{exp.description}</td>
                                    <td className="border border-black p-2 text-right font-mono">{exp.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                            {tripExpenses.length === 0 && (
                                <tr><td colSpan={4} className="border border-black p-4 text-center">無費用</td></tr>
                            )}
                            <tr className="bg-gray-100 font-bold">
                                <td colSpan={3} className="border border-black p-2 text-right">總計 Total:</td>
                                <td className="border border-black p-2 text-right">{totalAmount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mt-12 grid grid-cols-4 gap-4 text-center">
                        <div className="border-t border-black pt-2">
                            <p className="mb-8">申請人</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="mb-8">部門主管</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="mb-8">財務審核</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="mb-8">總經理</p>
                        </div>
                    </div>

                    <div className="mt-8 text-xs text-gray-500 text-center">
                        * 本單據由 EnterpriseOps 系統自動生成，請檢附相關發票或收據憑證。
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseClaims;
