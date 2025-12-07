import React, { useState, useEffect } from 'react';
import { createExpenseClaim, getExpenseClaims, getCurrentUser, getMyBusinessTrips, getCurrentEmployee, updateExpenseStatus, createVehicleLog, getVehicles, downloadCSV, getVehicleBookings, updateVehicleMileage } from '../services/supabaseService';
import { ExpenseClaim, LeaveRequest, Employee, Vehicle, VehicleBooking } from '../types';
import { Receipt, Globe, Plus, Utensils, BedDouble, Briefcase, CalendarClock, Info, AlertTriangle, Link as LinkIcon, CheckCircle, Trash2, Fuel, XCircle, FileSpreadsheet } from 'lucide-react';

interface CartItem {
    id: string; // temp id
    date: string;
    category: string;
    amount: number;
    currency: string;
    description: string;
    
    // Fuel specific
    isFuel?: boolean;
    vehicleId?: number;
    mileage?: number;
}

const ExpenseClaims: React.FC = () => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [trips, setTrips] = useState<LeaveRequest[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleBookings, setVehicleBookings] = useState<VehicleBooking[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Form Input State
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [description, setDescription] = useState('');
  
  // Fuel Input State
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [mileage, setMileage] = useState('');

  useEffect(() => {
      if (isFormOpen) {
          setCart([]);
          const today = new Date().toISOString().split('T')[0];
          setDate(today);
      }
  }, [isFormOpen]);

  const refreshData = async () => {
    try {
        const user = await getCurrentUser();
        if (user) {
            setCurrentUserId(user.id);
            const myTrips = await getMyBusinessTrips(user.id);
            setTrips(myTrips);
            const emp = await getCurrentEmployee();
            setCurrentEmp(emp);
        }
        const data = await getExpenseClaims();
        setClaims(data);
        const vs = await getVehicles();
        setVehicles(vs);
        const vbs = await getVehicleBookings();
        setVehicleBookings(vbs);
    } catch (e: any) {
        console.error(e.message);
    }
  };

  useEffect(() => { refreshData(); }, []);

  const handleTripSelect = (tripId: string) => {
      const id = parseInt(tripId);
      setSelectedTripId(id);
      if (!id) return;
      
      const trip = trips.find(t => t.id === id);
      if (trip) {
          const tripDate = trip.start_time.split('T')[0];
          setDate(tripDate);
          setDescription(trip.reason || `出差: ${new Date(trip.start_time).toLocaleDateString()}`);
          setCategory('Travel');

          // Auto-select booked vehicle if any
          if (currentUserId) {
              const matchedBooking = vehicleBookings.find(b => 
                  b.employee_id === currentUserId &&
                  b.status === 'approved' &&
                  new Date(b.start_time).toDateString() === new Date(trip.start_time).toDateString()
              );
              
              if (matchedBooking) {
                  setCategory('Fuel'); // Suggest Fuel since there's a car
                  setSelectedVehicle(matchedBooking.vehicle_id.toString());
              }
          }
      }
  }

  const addToCart = (e: React.FormEvent) => {
      e.preventDefault();
      
      const isFuel = category === 'Fuel';
      if (isFuel) {
          if (!selectedVehicle || !mileage) {
              alert("請選擇車輛並填寫里程"); return;
          }

          // Mileage Warning
          const veh = vehicles.find(v => v.id.toString() === selectedVehicle);
          if (veh) {
             const inputMileage = parseInt(mileage);
             if (inputMileage - veh.current_mileage > 1000) {
                 if (!window.confirm(`⚠️ 警示：輸入里程 (${inputMileage}) 與系統目前里程 (${veh.current_mileage}) 相差超過 1000公里。\n\n確定輸入正確嗎？`)) {
                     return;
                 }
             }
             if (inputMileage < veh.current_mileage) {
                 alert(`❌ 錯誤：輸入里程不可小於當前里程 (${veh.current_mileage})`);
                 return;
             }
          }
      }

      const newItem: CartItem = {
          id: Date.now().toString(),
          date,
          category,
          amount: Math.floor(parseFloat(amount)), // Integer only
          currency,
          description,
          isFuel,
          vehicleId: isFuel ? parseInt(selectedVehicle) : undefined,
          mileage: isFuel ? parseInt(mileage) : undefined
      };
      
      setCart([...cart, newItem]);
      // Reset fields for next item
      setAmount(''); setDescription(''); setCategory('Travel'); 
      if(isFuel) { setSelectedVehicle(''); setMileage(''); }
  }

  const removeCartItem = (id: string) => {
      setCart(cart.filter(c => c.id !== id));
  }

  const handleBatchSubmit = async () => {
    if (!currentUserId || cart.length === 0) return;
    try {
      for (const item of cart) {
          // 1. Create Expense Claim
          await createExpenseClaim({
            employee_id: currentUserId,
            claim_date: item.date,
            category: item.category,
            amount: item.amount,
            currency: item.currency,
            description: item.description,
            status: 'pending'
          });
          
          // 2. If Fuel, create Vehicle Log AND Update Vehicle Mileage
          if (item.isFuel && item.vehicleId && item.mileage) {
              await createVehicleLog({
                  vehicle_id: item.vehicleId,
                  employee_id: currentUserId,
                  log_type: 'refuel',
                  cost: item.amount,
                  description: `[報銷連動] ${item.description}`,
                  mileage_at_log: item.mileage,
                  image_url: ''
              });
              
              // New: Update the master vehicle record
              await updateVehicleMileage(item.vehicleId, item.mileage);
          }
      }
      setIsFormOpen(false);
      refreshData();
      alert('所有報銷申請已送出！待主管簽核。');
    } catch (err: any) { alert(err.message); }
  };

  const handleApproval = async (id: number, approved: boolean) => {
      try {
          await updateExpenseStatus(id, approved ? 'approved' : 'rejected');
          refreshData();
      } catch(e: any) {
          alert(e.message);
      }
  }
  
  const handleCancel = async (id: number) => {
      if(!confirm("確定要取消此報銷申請嗎？")) return;
      try {
          await updateExpenseStatus(id, 'cancelled'); // Reuse update logic to set cancelled
          refreshData();
          alert("✅ 已取消申請");
      } catch (e: any) {
          alert(e.message);
      }
  }

  const handleExportCSV = () => {
      const dataToExport = claims.map(c => ({
          單號: c.id,
          申請人: (c as any).employees?.full_name,
          部門: (c as any).employees?.department,
          消費日期: c.claim_date,
          類別: c.category,
          說明: c.description,
          金額: c.amount,
          幣別: c.currency,
          狀態: c.status
      }));
      downloadCSV(dataToExport, 'Expense_Claims');
  }

  const getCategoryIcon = (cat: string) => {
      switch(cat) {
          case 'Travel': return <Globe size={20} />;
          case 'Meal': return <Utensils size={20} />;
          case 'Accommodation': return <BedDouble size={20} />;
          case 'Fuel': return <Fuel size={20} />;
          default: return <Briefcase size={20} />;
      }
  }

  // --- 簽核邏輯 ---
  const isGM = currentEmp?.role === 'admin' || currentEmp?.job_title?.includes('總經理');
  const isManager = currentEmp?.job_title?.includes('經理') && !isGM;
  const isChief = currentEmp?.job_title?.includes('課長');
  const isAdmin = currentEmp?.role === 'admin';

  const pendingClaims = claims.filter(c => {
      if (c.status !== 'pending') return false;
      if (c.employee_id === currentEmp?.id) return false; // Don't approve own claims
      
      const applicant = (c as any).employees;
      if (!applicant) return false;
      
      const applicantDept = applicant.department;
      const myDept = currentEmp?.department;

      // 1. Admin (總務/總經理) 可以看到所有待審核 (作為最後防線)
      if (isAdmin) return true;

      // 2. 同部門檢核
      if (applicantDept !== myDept) return false;

      // 3. 經理簽核：可以看到同部門所有人的申請 (除了自己跟GM)
      if (isManager) {
          return true; 
      }

      // 4. 課長簽核：只能看到同部門且非經理/非課長的申請
      if (isChief) {
          const title = applicant.job_title || '';
          if (title.includes('經理') || title.includes('課長')) return false;
          return true;
      }

      return false;
  });

  return (
    <div>
      <div className="bg-stone-800 text-stone-200 rounded-2xl p-6 mb-8 shadow-lg border-l-4 border-amber-500">
          <h3 className="text-white font-bold flex items-center gap-2 mb-3"><Info size={20} className="text-amber-500" /> 差旅費申報規範小幫手</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="bg-stone-700/50 p-4 rounded-xl"><span className="block font-bold text-amber-400 mb-2">📅 差旅費/誤餐費</span><ul className="space-y-1 text-stone-300"><li>• 07:00 前出門：補貼 <span className="text-white font-mono">$100</span></li><li>• 13:00 後返回：補貼 <span className="text-white font-mono">$100</span></li><li>• 18:00 後返回：補貼 <span className="text-white font-mono">$100</span></li></ul></div>
              <div className="bg-stone-700/50 p-4 rounded-xl"><span className="block font-bold text-amber-400 mb-2">🏨 住宿與宵夜</span><ul className="space-y-1 text-stone-300"><li>• 一般職員上限：<span className="text-white font-mono">$1,500</span> /日</li><li>• 經理級上限：<span className="text-white font-mono">$1,700</span> /日</li><li>• 住宿宵夜費：<span className="text-white font-mono">$100</span> (定額)</li></ul></div>
              <div className="bg-stone-700/50 p-4 rounded-xl flex items-center gap-3"><AlertTriangle size={24} className="text-rose-400 shrink-0" /><p className="text-xs text-stone-400 leading-relaxed">請務必保留所有單據，金額請填寫整數。需經由直屬主管(課長/經理)簽核。</p></div>
          </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2"><Receipt size={28} className="text-accent" /> 費用報銷管理</h2>
        <div className="flex gap-3">
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white text-stone-600 px-4 py-2.5 rounded-xl hover:bg-stone-50 transition font-bold border border-stone-200 shadow-sm">
                <FileSpreadsheet size={16} /> 匯出 CSV
            </button>
            <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition font-bold shadow-md shadow-orange-200">
                <Plus size={18} /> {isFormOpen ? '取消申請' : '新增報銷單'}
            </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-accent mb-8 animate-fade-in ring-1 ring-stone-100 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 border-r border-stone-100 pr-8">
                <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-2">
                    <h3 className="font-bold text-lg text-stone-800">新增明細</h3>
                    <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-lg"><LinkIcon size={14} className="text-sky-600"/><select className="bg-transparent text-sm text-sky-800 font-bold border-none focus:ring-0 p-0 cursor-pointer w-24" onChange={(e) => handleTripSelect(e.target.value)} value={selectedTripId || ''}><option value="">關聯出差...</option>{trips.map(t => (<option key={t.id} value={t.id}>{new Date(t.start_time).toLocaleDateString()} - {t.reason}</option>))}</select></div>
                </div>

                <form onSubmit={addToCart} className="space-y-4">
                    <div><label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">消費日期</label><input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" /></div>
                    <div><label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">費用類別</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none bg-white"><option value="Travel">交通/差旅費</option><option value="Meal">交際/誤餐費</option><option value="Accommodation">住宿費</option><option value="Fuel">公務車加油</option><option value="Office Supplies">辦公雜支</option></select></div>
                    
                    {category === 'Fuel' && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-3">
                            <div><label className="block text-xs font-bold text-amber-800 mb-1">選擇車輛</label><select required value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} className="w-full p-2 border border-amber-300 rounded-lg bg-white text-sm focus:ring-amber-500"><option value="">-- 請選擇 --</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}</select></div>
                            <div><label className="block text-xs font-bold text-amber-800 mb-1">當前里程</label><input required type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full p-2 border border-amber-300 rounded-lg bg-white text-sm focus:ring-amber-500" placeholder="Km"/></div>
                        </div>
                    )}

                    <div><label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">金額 (整數)</label><div className="relative"><input required type="number" step="1" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2.5 pl-8 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" placeholder="0" /><span className="absolute left-3 top-2.5 text-stone-400 font-bold">$</span></div></div>
                    <div><label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">幣別</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none font-mono bg-white"><option value="TWD">TWD</option><option value="USD">USD</option><option value="JPY">JPY</option><option value="EUR">EUR</option><option value="CNY">CNY</option></select></div>
                    <div><label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">用途/備註說明</label><input type="text" required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none" placeholder="說明..." /></div>
                    <button type="submit" className="w-full bg-stone-700 text-white py-3 rounded-xl font-bold hover:bg-stone-600 shadow-md transition-all flex items-center justify-center gap-2"><Plus size={16}/> 加入清單</button>
                </form>
            </div>
            
            <div className="lg:col-span-2 flex flex-col">
                <h3 className="font-bold text-lg text-stone-800 mb-4 flex items-center gap-2">
                    <Receipt size={20} className="text-accent" /> 申請清單 ({cart.length})
                </h3>
                <div className="flex-1 bg-stone-50 border border-stone-200 rounded-xl overflow-hidden mb-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-stone-400 text-sm">尚未新增項目</div>
                    ) : (
                        <div className="overflow-auto max-h-[400px]">
                            <table className="min-w-full divide-y divide-stone-200">
                                <thead className="bg-stone-100"><tr><th className="px-4 py-3 text-left text-xs font-bold text-stone-500">日期</th><th className="px-4 py-3 text-left text-xs font-bold text-stone-500">類別</th><th className="px-4 py-3 text-left text-xs font-bold text-stone-500">說明</th><th className="px-4 py-3 text-right text-xs font-bold text-stone-500">金額</th><th className="px-4 py-3"></th></tr></thead>
                                <tbody className="divide-y divide-stone-100">{cart.map(item => (
                                    <tr key={item.id} className="bg-white hover:bg-stone-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-stone-600">{item.date}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-stone-700 flex items-center gap-1">{item.isFuel && <Fuel size={14} className="text-amber-500"/>}{item.category === 'Travel' ? '交通' : item.category === 'Meal' ? '誤餐' : item.category === 'Accommodation' ? '住宿' : item.category === 'Fuel' ? '加油' : item.category}</td>
                                        <td className="px-4 py-3 text-sm text-stone-500">{item.description}</td>
                                        <td className="px-4 py-3 text-right text-sm font-mono font-bold">{item.currency} {item.amount}</td>
                                        <td className="px-4 py-3 text-right"><button onClick={() => removeCartItem(item.id)} className="text-rose-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-50 transition-colors"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="flex justify-end items-center gap-4">
                     <div className="text-stone-600 font-bold">總計: <span className="text-xl text-stone-800 font-mono ml-2">TWD {cart.reduce((sum, item) => sum + (item.currency === 'TWD' ? item.amount : 0), 0)}</span></div>
                     <button onClick={handleBatchSubmit} disabled={cart.length === 0} className="bg-accent text-white px-8 py-3 rounded-xl font-bold hover:bg-accent-hover shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">確認送出申請</button>
                </div>
            </div>
        </div>
      )}

      {/* 主管簽核區 (有權限才顯示) */}
      {(isChief || isManager || isAdmin) && pendingClaims.length > 0 && (
          <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2">
                      <CheckCircle size={20} /> 待簽核單據 ({isGM ? '總經理/管理部' : isManager ? '部門經理' : '課長'})
                  </h3>
                  <span className="bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">{pendingClaims.length} 筆待審</span>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-amber-200">
                    <thead className="bg-amber-100/30">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-amber-800">申請人</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-amber-800">類別/日期</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-amber-800">金額</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-amber-800">說明</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-amber-800">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                        {pendingClaims.map(c => (
                            <tr key={c.id} className="hover:bg-amber-100/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-stone-800">{(c as any).employees?.full_name}</div>
                                    <div className="text-xs text-stone-500">{(c as any).employees?.job_title}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-stone-700">{c.category === 'Travel' ? '交通' : c.category}</div>
                                    <div className="text-xs text-stone-500">{new Date(c.claim_date).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono font-bold text-stone-800">{c.currency} {c.amount.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm text-stone-600 truncate max-w-xs">{c.description}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleApproval(c.id, true)} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm">核准</button>
                                        <button onClick={() => handleApproval(c.id, false)} className="bg-white text-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-50">駁回</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                  </table>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {claims.filter(c => currentEmp?.role === 'admin' || c.employee_id === currentEmp?.id).length === 0 && (
             <div className="text-center p-10 text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">尚無您的報銷紀錄</div>
        )}
        
        {claims.filter(c => currentEmp?.role === 'admin' || c.employee_id === currentEmp?.id).map((claim) => (
            <div key={claim.id} className="bg-white p-5 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-5 mb-3 sm:mb-0">
                    <div className={`p-4 rounded-full ${claim.category === 'Travel' ? 'bg-sky-50 text-sky-600' : claim.category === 'Meal' ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-600'}`}>{getCategoryIcon(claim.category)}</div>
                    <div>
                        <div className="font-bold text-stone-800 text-lg flex items-center gap-2">{claim.category === 'Travel' ? '交通/差旅' : claim.category === 'Accommodation' ? '住宿費' : claim.category === 'Meal' ? '誤餐費' : claim.category === 'Fuel' ? '加油' : claim.category}<span className="text-xs text-stone-400 font-normal">by {(claim as any).employees?.full_name}</span></div>
                        <div className="text-sm text-stone-500 mt-1">{claim.description || '無詳細說明'}</div>
                        <div className="text-xs text-stone-400 mt-1 flex items-center gap-1"><CalendarClock size={12}/> {new Date(claim.claim_date).toLocaleDateString()}</div>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 border-stone-100 pt-3 sm:pt-0">
                    <div className="text-right mr-4">
                        <div className="font-bold text-xl text-stone-900 font-mono tracking-tight"><span className="text-sm text-stone-400 font-normal mr-1">{claim.currency}</span>{claim.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                         <span className={`px-3 py-1 text-xs font-bold rounded-full border ${claim.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : claim.status === 'cancelled' ? 'bg-stone-100 text-stone-500 border-stone-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{claim.status === 'pending' ? '審核中' : claim.status === 'approved' ? '已核准' : claim.status === 'cancelled' ? '已取消' : '已退件'}</span>
                         
                         {/* 取消按鈕邏輯：Admin 或者 本人（未被退件/取消） */}
                         {claim.status !== 'rejected' && claim.status !== 'cancelled' && (
                             (currentEmp?.role === 'admin' || claim.employee_id === currentEmp?.id) && (
                                 <button onClick={() => handleCancel(claim.id)} className={`text-xs font-bold flex items-center gap-1 transition-all px-3 py-1 rounded-full border ${currentEmp?.role === 'admin' ? 'text-rose-500 border-rose-300 hover:bg-rose-50' : 'text-stone-400 border-stone-200 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'}`}>
                                     <XCircle size={12}/> {currentEmp?.role === 'admin' ? '強制取消' : '取消'}
                                 </button>
                             )
                         )}
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
export default ExpenseClaims;