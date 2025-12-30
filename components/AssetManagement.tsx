import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Filter, Edit3, Trash2, MapPin, User, Calendar, Tag, DollarSign, X, Save } from 'lucide-react';
import { Asset, Employee } from '../types';
import { getAssets, createAsset, updateAsset, deleteAsset, getEmployees } from '../services/supabaseService';

const AssetManagement: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('All');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAsset, setCurrentAsset] = useState<Partial<Asset>>({});
    const [isEditing, setIsEditing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetData, empData] = await Promise.all([
                getAssets(),
                getEmployees()
            ]);
            setAssets(assetData);
            setEmployees(empData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async () => {
        if (!currentAsset.purchase_date || !currentAsset.name || !currentAsset.category) {
            alert("請填寫必填欄位 (購買日期, 名稱, 分類)");
            return;
        }

        try {
            if (isEditing && currentAsset.id) {
                await updateAsset(currentAsset.id, currentAsset);
            } else {
                await createAsset(currentAsset as any);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("確定要刪除此資產嗎？")) return;
        try {
            await deleteAsset(id);
            fetchData();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const openCreateModal = () => {
        setCurrentAsset({
            purchase_date: new Date().toISOString().split('T')[0],
            amount: 0,
            category: '一般設備'
        });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (asset: Asset) => {
        setCurrentAsset(asset);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    // Filter Logic
    const filteredAssets = assets.filter(asset => {
        const matchesSearch = asset.name.includes(searchTerm) || asset.model?.includes(searchTerm) || asset.custodian?.includes(searchTerm);
        const matchesDept = filterDept === 'All' || asset.department === filterDept;
        return matchesSearch && matchesDept;
    });

    const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-stone-200 pb-5">
                <div>
                    <h2 className="text-3xl font-bold text-stone-800 tracking-tight flex items-center gap-3">
                        <Package size={32} className="text-emerald-600" />
                        資產管理
                    </h2>
                    <p className="text-stone-500 mt-1">管理公司固定資產、設備與保管紀錄</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                >
                    <Plus size={20} /> 新增資產
                </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="搜尋名稱、型號、保管人..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <select
                        value={filterDept}
                        onChange={e => setFilterDept(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none transition-all cursor-pointer"
                    >
                        <option value="All">所有部門</option>
                        {departments.map(d => <option key={d} value={d!}>{d}</option>)}
                    </select>
                </div>
                <div className="flex items-center justify-end text-stone-500 text-sm font-bold">
                    共 {filteredAssets.length} 筆資產
                </div>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-stone-400">載入中...</div>
                ) : filteredAssets.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl">
                        查無資產資料
                    </div>
                ) : (
                    filteredAssets.map(asset => (
                        <div key={asset.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-shadow group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <Tag size={12} /> {asset.category}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(asset)} className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-emerald-600"><Edit3 size={16} /></button>
                                        <button onClick={() => handleDelete(asset.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-stone-500 hover:text-rose-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-stone-800 mb-1 line-clamp-1">{asset.name}</h3>
                                <p className="text-stone-400 text-sm font-mono mb-4">{asset.model || '無型號'}</p>

                                <div className="space-y-2 text-sm text-stone-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-stone-400" />
                                        <span>購於 {asset.purchase_date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-stone-400" />
                                        <span>{asset.custodian || '未分配'} ({asset.department || '-'})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-stone-400" />
                                        <span>{asset.location || '未指定位置'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-stone-400" />
                                        <span className="font-mono font-bold">NT$ {asset.amount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-stone-800 text-lg flex items-center gap-2">
                                {isEditing ? <Edit3 size={20} /> : <Plus size={20} />}
                                {isEditing ? '編輯資產' : '新增資產'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">購買日期</label>
                                    <input type="date" value={currentAsset.purchase_date} onChange={e => setCurrentAsset({ ...currentAsset, purchase_date: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">資產類別</label>
                                    <input type="text" list="categories" value={currentAsset.category} onChange={e => setCurrentAsset({ ...currentAsset, category: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                                    <datalist id="categories">
                                        <option value="電腦設備" />
                                        <option value="辦公家具" />
                                        <option value="測試儀器" />
                                        <option value="周邊耗材" />
                                    </datalist>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1">資產名稱</label>
                                <input type="text" value={currentAsset.name} onChange={e => setCurrentAsset({ ...currentAsset, name: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" placeholder="例如：MacBook Pro 16" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">廠牌/型號</label>
                                    <input type="text" value={currentAsset.model || ''} onChange={e => setCurrentAsset({ ...currentAsset, model: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">購入金額</label>
                                    <input type="number" value={currentAsset.amount === 0 ? '' : currentAsset.amount} onChange={e => setCurrentAsset({ ...currentAsset, amount: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">保管人</label>
                                    <select value={currentAsset.custodian || ''} onChange={e => {
                                        const emp = employees.find(emp => emp.full_name === e.target.value);
                                        setCurrentAsset({ ...currentAsset, custodian: e.target.value, department: emp?.department || currentAsset.department });
                                    }} className="w-full p-2 border border-stone-200 rounded-lg text-sm">
                                        <option value="">(未分配)</option>
                                        {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-stone-500 mb-1">部門</label>
                                    <input type="text" value={currentAsset.department || ''} onChange={e => setCurrentAsset({ ...currentAsset, department: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-1">存放位置</label>
                                <input type="text" value={currentAsset.location || ''} onChange={e => setCurrentAsset({ ...currentAsset, location: e.target.value })} className="w-full p-2 border border-stone-200 rounded-lg text-sm" placeholder="例如：A棟3F辦公室" />
                            </div>
                        </div>

                        <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-white border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-colors">取消</button>
                            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                                <Save size={18} /> 儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetManagement;
