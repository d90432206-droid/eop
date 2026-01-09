import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { getEmployees, seedDemoData, getSystemStats, getAdminExpenseClaims, updateAdminExpenseStatus, getAdminHistoryExpenseClaims, getLeaveRequests, updateLeaveRequestDetails, getCurrentEmployee, updateMyPassword, updateLeaveQuotas } from '../services/supabaseService';
import { Employee, ExpenseClaim, LeaveRequest, RequestStatus, LeaveType } from '../types';
import { Users, Database, ShieldAlert, RefreshCw, Activity, Layout, Download, Palette, FileJson, CheckCircle, Receipt, Printer, Check, XCircle, Edit3, Save, X } from 'lucide-react';

const AdminSettings: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [activeTab, setActiveTab] = useState<'system' | 'expenses' | 'leaves'>('system');

    // Leave Correction State
    const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
    const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
    const [editForm, setEditForm] = useState<{ start: string, end: string, status: RequestStatus, leaveType: LeaveType, isOvertime: boolean }>({ 
        start: '', 
        end: '', 
        status: 'pending', 
        leaveType: 'annual', 
        isOvertime: false 
    });

    // Expense Admin State
    const [pendingExpenses, setPendingExpenses] = useState<ExpenseClaim[]>([]);
    const [historyExpenses, setHistoryExpenses] = useState<ExpenseClaim[]>([]);
    const [expenseView, setExpenseView] = useState<'pending' | 'history'>('pending');

    // History Filter
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10)); // 1st of month
    const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10)); // Today

    const [printingGroup, setPrintingGroup] = useState<{ tripId: string, items: ExpenseClaim[] } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
            const sysStats = await getSystemStats();
            setStats(sysStats);

            const expenses = await getAdminExpenseClaims();
            setPendingExpenses(expenses);

            const history = await getAdminHistoryExpenseClaims(startDate, endDate);
            setHistoryExpenses(history);

            const leaves = await getLeaveRequests();
            setAllLeaves(leaves);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Specific fetch for history when dates or view changes
    useEffect(() => {
        if (activeTab === 'expenses' && expenseView === 'history') {
            getAdminHistoryExpenseClaims(startDate, endDate).then(setHistoryExpenses);
        }
    }, [startDate, endDate, activeTab, expenseView]);

    const handleApplyDemoData = async () => {
        if (!confirm("確定要套用 10 人模擬架構嗎？\n這將更新現有人員的職稱與部門。")) return;
        setSeeding(true);
        try {
            // 先嘗試同步一次
            const { error: syncError } = await supabase.from('employees').insert([{}]).select(); 
            // 如果您在 SQL Editor 執行了補救指令，這裡也可以手動觸發更強力的同步
            await seedDemoData();
            await fetchData();
            alert("模擬架構套用成功！");
        } catch (e) {
            console.error(e);
            alert("套用失敗，請查看 Console。請確保您已在 SQL Editor 執行過『補救指令』。");
        } finally {
            setSeeding(false);
        }
    };

    const handleRepairSync = async () => {
        setLoading(true);
        try {
            // 執行 SQL 補救指令的功能（透過 RPC 或簡單的 ping）
            const { error } = await supabase.rpc('sync_auth_users_to_employees');
            if (error) {
                // 如果 RPC 沒設好，提醒使用者去 SQL Editor 執行
                alert("請在 Supabase SQL Editor 執行以下指令：\n\nINSERT INTO public.employees (id, email, full_name, role) \nSELECT id, email, email, 'employee' \nFROM auth.users \nON CONFLICT (id) DO NOTHING;");
            } else {
                alert("同步完成！");
            }
            await fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadConfig = () => {
        const config = {
            version: "1.0.0",
            modules: ["dashboard", "attendance", "vehicles", "expenses", "visitors", "admin"],
            theme: { primary: "#44403c", accent: "#ea580c" }
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'eop-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleApproveExpense = async (ids: number[]) => {
        if (!confirm("確定核准這些費用申請嗎？")) return;
        try {
            await updateAdminExpenseStatus(ids, 'approved');
            await fetchData();
            alert("✅ 費用已核准");
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleRejectExpense = async (ids: number[]) => {
        const reason = prompt("請輸入退回/拒絕原因：");
        if (reason === null) return;
        try {
            // In a real app we'd log the reason. For now just reject status.
            await updateAdminExpenseStatus(ids, 'rejected');
            await fetchData();
            alert("已退回");
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handlePrintGroup = (tripId: string, items: ExpenseClaim[]) => {
        setPrintingGroup({ tripId, items });
        // Use timeout to allow DOM to render
        setTimeout(() => {
            if (printRef.current) {
                const printContent = printRef.current.innerHTML;
                const originalContents = document.body.innerHTML;
                document.body.innerHTML = printContent;
                window.print();
                document.body.innerHTML = originalContents;
                window.location.reload();
            }
        }, 300);
    };

    // Group expenses by [TRIP-ID]
    const groupedExpenses = pendingExpenses.reduce((acc, expense) => {
        const match = expense.description?.match(/^\[TRIP-(\d+)\]/);
        const tripId = match ? match[1] : 'Unknown';
        if (!acc[tripId]) acc[tripId] = [];
        acc[tripId].push(expense);
        return acc;
    }, {} as Record<string, ExpenseClaim[]>);

    // Group history expenses
    const groupedHistory = historyExpenses.reduce((acc, expense) => {
        const match = expense.description?.match(/^\[TRIP-(\d+)\]/);
        const tripId = match ? match[1] : 'Unknown';
        if (!acc[tripId]) acc[tripId] = [];
        acc[tripId].push(expense);
        return acc;
    }, {} as Record<string, ExpenseClaim[]>);

    const activeGroupedExpenses = expenseView === 'pending' ? groupedExpenses : groupedHistory;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-stone-200 pb-5">
                <div>
                    <h2 className="text-3xl font-bold text-stone-800 tracking-tight flex items-center gap-3">
                        <ShieldAlert size={32} className="text-rose-500" />
                        系統管理後台
                    </h2>
                    <p className="text-stone-500 mt-1">管理員專用功能、系統診斷與配置</p>
                </div>
                <div className="flex bg-stone-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('system')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'system' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>系統設定</button>
                    <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'expenses' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>費用審核</button>
                    <button onClick={() => setActiveTab('leaves')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'leaves' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>假單維護</button>
                </div>
            </div>

            {/* LEAVE CORRECTION TAB */}
            {activeTab === 'leaves' && (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
                        <h3 className="font-bold text-stone-800 flex items-center gap-2">
                            <Edit3 size={20} className="text-accent" /> 員工假單/公出維護 (Admin Only)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-stone-200 text-sm">
                            <thead className="bg-stone-100">
                                <tr>
                                    <th className="px-4 py-3 text-left">單號</th>
                                    <th className="px-4 py-3 text-left">姓名</th>
                                    <th className="px-4 py-3 text-left">類別</th>
                                    <th className="px-4 py-3 text-left">時間</th>
                                    <th className="px-4 py-3 text-left">狀態</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {allLeaves.map(req => (
                                    <tr key={req.id} className="hover:bg-stone-50">
                                        <td className="px-4 py-3 font-mono text-stone-500">#{req.id}</td>
                                        <td className="px-4 py-3 font-bold text-stone-700">{(req as any).employees?.full_name}</td>
                                        <td className="px-4 py-3">
                                            {req.is_overtime ? '加班' : 
                                             req.leave_type === 'annual' ? '特休' :
                                             req.leave_type === 'sick' ? '病假' :
                                             req.leave_type === 'business' ? '公出' :
                                             req.leave_type === 'other' ? '事假/其他' : req.leave_type}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-stone-600">
                                            {new Date(req.start_time).toLocaleString()} <br /> ~ {new Date(req.end_time).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs border font-bold ${
                                                req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                req.status === 'completed' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                req.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                req.status === 'cancelled' ? 'bg-stone-50 text-stone-500 border-stone-200' :
                                                'bg-amber-50 text-amber-600 border-amber-200'
                                            }`}>
                                                {req.status === 'pending_dept' ? '部門審核' :
                                                 req.status === 'pending_gm' ? 'GM審核' :
                                                 req.status === 'approved' ? '已核准' :
                                                 req.status === 'rejected' ? '已退回' :
                                                 req.status === 'cancelled' ? '已取消' :
                                                 req.status === 'completed' ? '已核銷' : req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setEditingLeave(req);
                                                    setEditForm({
                                                        start: new Date(req.start_time).toISOString().slice(0, 16),
                                                        end: new Date(req.end_time).toISOString().slice(0, 16),
                                                        status: req.status,
                                                        leaveType: req.leave_type,
                                                        isOvertime: req.is_overtime || false
                                                    });
                                                }}
                                                className="text-accent hover:bg-orange-50 p-1.5 rounded transition-colors"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Edit Modal */}
                    {editingLeave && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-stone-800">修改假單 #{editingLeave.id}</h3>
                                    <button onClick={() => setEditingLeave(null)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 mb-1">開始時間</label>
                                        <input
                                            type="datetime-local"
                                            value={editForm.start}
                                            onChange={e => setEditForm({ ...editForm, start: e.target.value })}
                                            className="w-full border-stone-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 mb-1">結束時間</label>
                                        <input
                                            type="datetime-local"
                                            value={editForm.end}
                                            onChange={e => setEditForm({ ...editForm, end: e.target.value })}
                                            className="w-full border-stone-300 rounded-lg"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">假別</label>
                                            <select
                                                value={editForm.leaveType}
                                                onChange={e => setEditForm({ ...editForm, leaveType: e.target.value as LeaveType })}
                                                className="w-full border-stone-300 rounded-lg text-sm"
                                            >
                                                <option value="annual">特休 (Annual)</option>
                                                <option value="sick">病假 (Sick)</option>
                                                <option value="business">公出 (Business)</option>
                                                <option value="other">事假/其他 (Other)</option>
                                                <option value="overtime">加班 (Overtime)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">加班標記</label>
                                            <select
                                                value={editForm.isOvertime ? 'true' : 'false'}
                                                onChange={e => setEditForm({ ...editForm, isOvertime: e.target.value === 'true' })}
                                                className="w-full border-stone-300 rounded-lg text-sm"
                                            >
                                                <option value="false">否</option>
                                                <option value="true">是 (Overtime)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 mb-1">狀態</label>
                                        <select
                                            value={editForm.status}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value as RequestStatus })}
                                            className="w-full border-stone-300 rounded-lg text-sm font-bold"
                                        >
                                            <option value="pending_dept">⏳ 部門審核中 (Pending Dept)</option>
                                            <option value="pending_gm">⏳ 總經理審核中 (Pending GM)</option>
                                            <option value="approved">✅ 已核准 (Approved)</option>
                                            <option value="completed">💰 已核銷 (Completed / Settled)</option>
                                            <option value="rejected">❌ 已退回 (Rejected)</option>
                                            <option value="cancelled">✖ 已取消 (Cancelled)</option>
                                        </select>
                                    </div>

                                    <div className="pt-6 flex gap-4">
                                        <button 
                                            onClick={() => setEditingLeave(null)} 
                                            className="flex-1 py-3 rounded-xl bg-stone-100 font-bold text-stone-600 hover:bg-stone-200 transition-colors"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!confirm("確定要修改此假單嗎？這將會留下記錄。")) return;
                                                try {
                                                    await updateLeaveRequestDetails(
                                                        editingLeave.id,
                                                        {
                                                            start_time: new Date(editForm.start).toISOString(),
                                                            end_time: new Date(editForm.end).toISOString(),
                                                            status: editForm.status,
                                                            leave_type: editForm.leaveType,
                                                            is_overtime: editForm.isOvertime
                                                        },
                                                        'Admin'
                                                    );
                                                    alert("✅ 已更新假單內容");
                                                    setEditingLeave(null);
                                                    fetchData();
                                                } catch (e: any) {
                                                    alert(`更新失敗: ${e.message}`);
                                                }
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-[#ea580c] text-white font-bold hover:bg-[#c2410c] shadow-lg shadow-orange-200 transition-all active:scale-95"
                                        >
                                            儲存變更
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* EXPENSE TAB */}
            {activeTab === 'expenses' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex bg-stone-100 p-1 rounded-lg w-fit">
                            <button onClick={() => setExpenseView('pending')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${expenseView === 'pending' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>待審核</button>
                            <button onClick={() => setExpenseView('history')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${expenseView === 'history' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>歷史紀錄</button>
                        </div>

                        {expenseView === 'history' && (
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200 shadow-sm text-sm">
                                <span className="text-stone-500 font-bold">區間:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border border-stone-200 rounded px-2 py-1 text-stone-700"
                                />
                                <span className="text-stone-400">~</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="border border-stone-200 rounded px-2 py-1 text-stone-700"
                                />
                                <button onClick={() => getAdminHistoryExpenseClaims(startDate, endDate).then(setHistoryExpenses)} className="ml-2 p-1 text-stone-400 hover:text-accent">
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {Object.keys(activeGroupedExpenses).length === 0 ? (
                        <div className="text-center py-20 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">
                            {expenseView === 'pending' ? "目前沒有待審核的費用申請" : "尚無歷史紀錄"}
                        </div>
                    ) : (
                        Object.entries(activeGroupedExpenses).map(([tripId, items]: [string, ExpenseClaim[]]) => {
                            const total = items.reduce((sum, i) => sum + i.amount, 0);
                            const firstItem = items[0];
                            const employeeName = (firstItem.employees as any)?.full_name || 'Unknown';
                            const employeeDept = (firstItem.employees as any)?.department || 'Unknown';

                            return (
                                <div key={tripId} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="bg-stone-50 p-4 border-b border-stone-100 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-orange-100 text-orange-600 p-2 rounded-lg font-bold font-mono">#{tripId}</div>
                                            <div>
                                                <div className="font-bold text-stone-800 text-lg">{employeeName} <span className="text-sm font-normal text-stone-500">({employeeDept})</span></div>
                                                <div className="text-xs text-stone-400">申請 {items.length} 筆項目</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-bold font-mono text-stone-800 mr-4">TWD {total.toLocaleString()}</span>
                                            <button onClick={() => handlePrintGroup(tripId, items)} className="p-2 text-stone-500 hover:bg-white rounded-lg border border-transparent hover:border-stone-200 transition-all"><Printer size={20} /></button>
                                            {expenseView === 'pending' && (
                                                <>
                                                    <button onClick={() => handleRejectExpense(items.map(i => i.id))} className="flex items-center gap-1 bg-white border border-rose-200 text-rose-600 px-3 py-2 rounded-lg font-bold hover:bg-rose-50"><XCircle size={18} /> 退回</button>
                                                    <button onClick={() => handleApproveExpense(items.map(i => i.id))} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md"><CheckCircle size={18} /> 核准</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-0">
                                        <table className="w-full text-sm">
                                            <thead className="bg-stone-50/50 text-stone-500">
                                                <tr>
                                                    <th className="p-3 text-left pl-6">日期</th>
                                                    <th className="p-3 text-left">類別</th>
                                                    <th className="p-3 text-left">說明</th>
                                                    <th className="p-3 text-right pr-6">金額</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {items.map(item => (
                                                    <tr key={item.id}>
                                                        <td className="p-3 pl-6 font-mono text-stone-500">{item.claim_date}</td>
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs bg-stone-100 px-2 py-1 rounded text-stone-600">{item.category}</span>
                                                                {expenseView === 'history' && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                                                                        item.status === 'rejected' || item.status === 'cancelled' ? 'bg-rose-50 border-rose-200 text-rose-600' :
                                                                            'bg-stone-50 border-stone-200 text-stone-500'
                                                                        }`}>
                                                                        {item.status === 'approved' ? '已核准' :
                                                                            item.status === 'rejected' ? '已退回' :
                                                                                item.status === 'cancelled' ? '已取消' : item.status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-stone-800">{item.description?.replace(/^\[TRIP-\d+\]\s*/, '')}</td>
                                                        <td className="p-3 text-right pr-6 font-mono font-bold">{item.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Hidden Print Template for Admin */}
            <div className="hidden">
                <div ref={printRef} className="p-10 font-serif text-black bg-white max-w-[210mm] mx-auto">
                    <style>{`
                        @media print {
                            @page { size: A4; margin: 20mm; }
                            body { background: white; -webkit-print-color-adjust: exact; }
                        }
                    `}</style>
                    {printingGroup && (
                        <>
                            <div className="text-center border-b-2 border-black pb-4 mb-6">
                                <h1 className="text-3xl font-bold tracking-widest mb-2">出差旅費報銷單 (收據)</h1>
                                <h2 className="text-lg text-gray-500">Expense Reimbursement Receipt</h2>
                            </div>
                            <div className="flex justify-between mb-6 text-sm">
                                <div>
                                    <p><span className="font-bold">申請人:</span> {(printingGroup.items[0].employees as any)?.full_name}</p>
                                    <p><span className="font-bold">部門:</span> {(printingGroup.items[0].employees as any)?.department}</p>
                                </div>
                                <div className="text-right">
                                    <p><span className="font-bold">歸屬出差單:</span> #{printingGroup.tripId}</p>
                                    <p><span className="font-bold">列印日期:</span> {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                            <table className="w-full border-collapse border border-black text-sm mb-6">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-2">日期</th>
                                        <th className="border border-black p-2">項目分類</th>
                                        <th className="border border-black p-2">詳細說明</th>
                                        <th className="border border-black p-2 text-right">金額 (TWD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printingGroup.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="border border-black p-2 text-center">{item.claim_date}</td>
                                            <td className="border border-black p-2 text-center">{item.category}</td>
                                            <td className="border border-black p-2">{item.description?.replace(/^\[TRIP-\d+\]\s*/, '')}</td>
                                            <td className="border border-black p-2 text-right">{item.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-bold text-lg">
                                        <td colSpan={3} className="border border-black p-2 text-right">總計 Total:</td>
                                        <td className="border border-black p-2 text-right">{printingGroup.items.reduce((a, b) => a + b.amount, 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="mt-12 grid grid-cols-3 gap-8 text-center pt-8">
                                <div className="border-t border-black"><p className="mt-2">經辦人</p></div>
                                <div className="border-t border-black"><p className="mt-2">會計覆核</p></div>
                                <div className="border-t border-black"><p className="mt-2">核決</p></div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'system' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. Health Stats */}
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <Activity size={20} className="text-accent" /> 系統數據狀態
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">員工總數</div>
                                    <div className="text-2xl font-mono font-bold text-stone-800">{stats?.employees || 0}</div>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">假單紀錄</div>
                                    <div className="text-2xl font-mono font-bold text-amber-600">{stats?.leave_requests || 0}</div>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">車輛資源</div>
                                    <div className="text-2xl font-mono font-bold text-sky-600">{stats?.vehicles || 0}</div>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">車輛預約</div>
                                    <div className="text-2xl font-mono font-bold text-stone-600">{stats?.vehicle_bookings || 0}</div>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">報銷單據</div>
                                    <div className="text-2xl font-mono font-bold text-emerald-600">{stats?.expense_claims || 0}</div>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
                                    <div className="text-xs text-stone-500 font-bold uppercase">訪客紀錄</div>
                                    <div className="text-2xl font-mono font-bold text-purple-600">{stats?.visitors || 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Configuration & Site Map */}
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col">
                            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <Layout size={20} className="text-accent" /> 畫面配置與架構
                            </h3>
                            <div className="flex-1 overflow-auto max-h-48 mb-4 custom-scrollbar">
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span> <span className="font-mono font-bold text-stone-700">/</span> 人員動態看板 (Dashboard)</li>
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span> <span className="font-mono font-bold text-stone-700">/attendance</span> 差勤與請假 (Leave/Overtime)</li>
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span> <span className="font-mono font-bold text-stone-700">/vehicles</span> 車輛管理 (Booking/Logs)</li>
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span> <span className="font-mono font-bold text-stone-700">/expenses</span> 費用報銷 (Claims/Cart)</li>
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span> <span className="font-mono font-bold text-stone-700">/visitors</span> 訪客登記 (Log/Reception)</li>
                                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span> <span className="font-mono font-bold text-stone-700">/admin</span> 系統管理 (Settings)</li>
                                </ul>
                            </div>
                            <div className="flex items-center justify-between border-t border-stone-100 pt-4 mt-auto">
                                <div className="flex items-center gap-2">
                                    <Palette size={16} className="text-stone-400" />
                                    <div className="flex gap-1">
                                        <div className="w-6 h-6 rounded bg-[#44403c] shadow-sm" title="Primary Text"></div>
                                        <div className="w-6 h-6 rounded bg-[#ea580c] shadow-sm" title="Accent: Orange"></div>
                                        <div className="w-6 h-6 rounded bg-[#fafaf9] border border-stone-200 shadow-sm" title="Background"></div>
                                    </div>
                                </div>
                                <button onClick={handleDownloadConfig} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                    <Download size={14} /> 下載配置 (JSON)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Database size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-stone-800 mb-1">快速套用 10 人模擬簽核架構</h3>
                                <p className="text-stone-500 text-sm mb-4">
                                    此功能會根據 Email 自動更新員工的「部門」、「職稱」與「權限」，以符合測試腳本的需求。<br />
                                    包含：總經理、總務經理、業務部(3人)、品保部(3人)、ATS部(3人)。
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleApplyDemoData}
                                        disabled={seeding}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2"
                                    >
                                        {seeding ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                        {seeding ? '資料更新中...' : '套用模擬架構設定'}
                                    </button>
                                    <button
                                        onClick={handleRepairSync}
                                        className="bg-stone-800 hover:bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2"
                                    >
                                        <RefreshCw size={18} />
                                        修復 Auth 同步 (補救資料)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Account Security */}
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                            <h3 className="text-lg font-bold text-stone-800 mb-2 flex items-center gap-2">
                                <ShieldAlert size={20} className="text-accent" /> 個人帳號安全
                            </h3>
                            <p className="text-sm text-stone-500 mb-6">修改您目前的登入密碼，確保帳號安全。</p>
                            
                            <div className="space-y-4 max-w-sm">
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 mb-1">新密碼 (至少 6 位數)</label>
                                    <input 
                                        type="password" 
                                        placeholder="請輸入新密碼"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full border-stone-200 rounded-xl focus:ring-accent focus:border-accent"
                                    />
                                </div>
                                <button 
                                    onClick={async () => {
                                        if (newPassword.length < 6) {
                                            alert("密碼長度至少需要 6 位數");
                                            return;
                                        }
                                        setUpdatingPassword(true);
                                        try {
                                            await updateMyPassword(newPassword);
                                            alert("✅ 密碼已更新成功！");
                                            setNewPassword('');
                                        } catch (e: any) {
                                            alert("更換失敗: " + e.message);
                                        } finally {
                                            setUpdatingPassword(false);
                                        }
                                    }}
                                    disabled={updatingPassword || !newPassword}
                                    className="w-full py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {updatingPassword ? '更新中...' : '確認修改密碼'}
                                </button>
                            </div>
                        </div>

                    {/* Employee List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <Users size={20} /> 目前員工列表 ({employees.length})
                            </h3>
                            <button onClick={fetchData} className="text-stone-400 hover:text-stone-600">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-stone-200 text-sm">
                                <thead className="bg-stone-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-stone-400 uppercase tracking-widest">員工資訊</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-stone-400 uppercase tracking-widest">到職日 / 制度</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-stone-400 uppercase tracking-widest">特休 / 病 / 事</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-stone-400 uppercase tracking-widest">角色</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {employees.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-stone-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-500 border border-white shadow-sm overflow-hidden">
                                                        {emp.avatar_url ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" /> : emp.full_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-stone-800">{emp.full_name} <span className="text-xs font-mono text-stone-400 ml-1">#{emp.employee_id}</span></div>
                                                        <div className="text-xs text-stone-500">{emp.department} · {emp.job_title}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-mono text-stone-600">{emp.hire_date || '未設定'}</div>
                                                <div className="text-[10px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{emp.leave_system || '週年制'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1.5">
                                                    <button 
                                                        onClick={async () => {
                                                            const newVal = prompt(`修改 ${emp.full_name} 的特休額度`, String(emp.annual_leave_quota));
                                                            if (newVal !== null) {
                                                                await updateLeaveQuotas(emp.id, { annual_leave_quota: Number(newVal) });
                                                                fetchData();
                                                            }
                                                        }}
                                                        className="text-center"
                                                    >
                                                        <div className="text-[11px] font-black w-8 h-7 flex items-center justify-center text-orange-600 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-all cursor-pointer shadow-sm" title="特休：點擊修改">{emp.annual_leave_quota}</div>
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            const newVal = prompt(`修改 ${emp.full_name} 的病假額度`, String(emp.sick_leave_quota));
                                                            if (newVal !== null) {
                                                                await updateLeaveQuotas(emp.id, { sick_leave_quota: Number(newVal) });
                                                                fetchData();
                                                            }
                                                        }}
                                                        className="text-center"
                                                    >
                                                        <div className="text-[11px] font-black w-8 h-7 flex items-center justify-center text-stone-600 bg-stone-50 rounded-lg border border-stone-100 font-mono hover:bg-stone-100 transition-all cursor-pointer shadow-sm" title="病假：點擊修改">{emp.sick_leave_quota}</div>
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            const newVal = prompt(`修改 ${emp.full_name} 的事假額度`, String(emp.personal_leave_quota));
                                                            if (newVal !== null) {
                                                                await updateLeaveQuotas(emp.id, { personal_leave_quota: Number(newVal) });
                                                                fetchData();
                                                            }
                                                        }}
                                                        className="text-center"
                                                    >
                                                        <div className="text-[11px] font-black w-8 h-7 flex items-center justify-center text-stone-600 bg-stone-50 rounded-lg border border-stone-100 font-mono hover:bg-stone-100 transition-all cursor-pointer shadow-sm" title="事假：點擊修改">{emp.personal_leave_quota}</div>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {emp.role === 'admin' ?
                                                    <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">Admin</span> :
                                                    <span className="text-stone-500">Employee</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;