import React, { useEffect, useState } from 'react';
import { getEmployees, seedDemoData, getSystemStats, getAdminExpenseClaims, updateAdminExpenseStatus } from '../services/supabaseService';
import { Employee } from '../types';
import { Users, Database, ShieldAlert, RefreshCw, Activity, Layout, Download, Palette, FileJson, CheckCircle, Receipt, Printer, Check, XCircle } from 'lucide-react';
import { ExpenseClaim } from '../types';

const AdminSettings: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [activeTab, setActiveTab] = useState<'system' | 'expenses'>('system');

    // Expense Admin State
    const [pendingExpenses, setPendingExpenses] = useState<ExpenseClaim[]>([]);
    const [printingGroup, setPrintingGroup] = useState<{ tripId: string, items: ExpenseClaim[] } | null>(null);
    const printRef = React.useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
            const sysStats = await getSystemStats();
            setStats(sysStats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getEmployees();
                setEmployees(data);
                const sysStats = await getSystemStats();
                setStats(sysStats);

                const expenses = await getAdminExpenseClaims();
                setPendingExpenses(expenses);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            fetchData();
        }, []);

        const handleApplyDemoData = async () => {
            if (!confirm("確定要將現有用戶資料更新為「10人模擬簽核架構」嗎？\n\n這將會覆蓋現有的職稱與部門設定。")) return;

            setSeeding(true);
            try {
                await seedDemoData();
                await fetchData();
                alert("✅ 模擬架構套用成功！\n請確認下方列表的職稱與部門已更新。");
            } catch (e: any) {
                alert("更新失敗: " + e.message);
            } finally {
                setSeeding(false);
            }
        };

        const handleDownloadConfig = () => {
            const configData = {
                systemName: "EnterpriseOps",
                version: "1.0.0",
                theme: {
                    colors: {
                        primary: '#44403c',
                        secondary: '#78716c',
                        background: '#fafaf9',
                        accent: '#ea580c',
                        accentHover: '#c2410c'
                    }
                },
                modules: [
                    { id: "dashboard", name: "人員動態看板", path: "/", description: "Real-time status monitoring" },
                    { id: "attendance", name: "差勤與請假", path: "/attendance", description: "Leave requests & approvals" },
                    { id: "vehicles", name: "行政資源管理", path: "/vehicles", description: "Vehicle booking & maintenance" },
                    { id: "expenses", name: "費用報銷申請", path: "/expenses", description: "Claims & receipts" },
                    { id: "visitors", name: "來賓訪客登記", path: "/visitors", description: "Visitor log & logistics" },
                    { id: "admin", name: "系統管理", path: "/admin", description: "User & system settings" }
                ],
                currentStats: stats
            };

            const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system_config_${new Date().toISOString().split('T')[0]}.json`;
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
                        <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'expenses' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>費用審核 ({pendingExpenses.length})</button>
                    </div>
                </div>

                {/* EXPENSE TAB */}
                {activeTab === 'expenses' && (
                    <div className="space-y-6">
                        {Object.keys(groupedExpenses).length === 0 ? (
                            <div className="text-center py-20 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 font-bold">目前沒有待審核的費用申請</div>
                        ) : (
                            Object.entries(groupedExpenses).map(([tripId, items]) => {
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
                                                <button onClick={() => handleRejectExpense(items.map(i => i.id))} className="flex items-center gap-1 bg-white border border-rose-200 text-rose-600 px-3 py-2 rounded-lg font-bold hover:bg-rose-50"><XCircle size={18} /> 退回</button>
                                                <button onClick={() => handleApproveExpense(items.map(i => i.id))} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md"><CheckCircle size={18} /> 核准</button>
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
                                                                <span className="text-xs bg-stone-100 px-2 py-1 rounded text-stone-600">{item.category}</span>
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
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-stone-200 text-sm">
                                    <thead className="bg-stone-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-bold text-stone-600">Email</th>
                                            <th className="px-6 py-3 text-left font-bold text-stone-600">姓名</th>
                                            <th className="px-6 py-3 text-left font-bold text-stone-600">部門</th>
                                            <th className="px-6 py-3 text-left font-bold text-stone-600">職稱</th>
                                            <th className="px-6 py-3 text-left font-bold text-stone-600">權限</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {employees.map(emp => (
                                            <tr key={emp.id} className="hover:bg-stone-50">
                                                <td className="px-6 py-3 text-stone-600 font-mono">{emp.email}</td>
                                                <td className="px-6 py-3 font-bold text-stone-800">{emp.full_name}</td>
                                                <td className="px-6 py-3 text-stone-600">{emp.department}</td>
                                                <td className="px-6 py-3 text-stone-600">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.job_title?.includes('經理') || emp.job_title?.includes('總經理') ? 'bg-amber-100 text-amber-800' :
                                                        emp.job_title?.includes('課長') ? 'bg-indigo-100 text-indigo-800' : 'bg-stone-100 text-stone-600'
                                                        }`}>
                                                        {emp.job_title || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
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
                    </>
                )}
            </div>
        );
    };

    export default AdminSettings;