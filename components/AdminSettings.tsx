import React, { useEffect, useState } from 'react';
import { getEmployees, seedDemoData, getSystemStats } from '../services/supabaseService';
import { Employee } from '../types';
import { Users, Database, ShieldAlert, RefreshCw, Activity, Layout, Download, Palette, FileJson, CheckCircle } from 'lucide-react';

const AdminSettings: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);

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
            </div>

            {/* System Diagnostics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Health Stats */}
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                    <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-accent"/> 系統數據狀態
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
                        <Layout size={20} className="text-accent"/> 畫面配置與架構
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
                            <Palette size={16} className="text-stone-400"/>
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
                            此功能會根據 Email 自動更新員工的「部門」、「職稱」與「權限」，以符合測試腳本的需求。<br/>
                            包含：總經理、總務經理、業務部(3人)、品保部(3人)、ATS部(3人)。
                        </p>
                        <button 
                            onClick={handleApplyDemoData} 
                            disabled={seeding}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2"
                        >
                            {seeding ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                            {seeding ? '資料更新中...' : '套用模擬架構設定'}
                        </button>
                    </div>
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
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            emp.job_title?.includes('經理') || emp.job_title?.includes('總經理') ? 'bg-amber-100 text-amber-800' : 
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
        </div>
    );
};

export default AdminSettings;