
import React, { useState, useEffect } from 'react';
import { createLeaveRequest, getLeaveRequests, getCurrentEmployee, getVehicles, getVehicleBookings, updateLeaveStatus, cancelLeaveRequest, checkLeaveOverlap, downloadCSV, getEmployees } from '../services/supabaseService';
import { Employee, LeaveRequest, LeaveType, Vehicle, VehicleBooking, RequestLog } from '../types';
import { PlusCircle, Calendar, FileText, Clock, Briefcase, Car, Utensils, AlertCircle, RefreshCw, CheckCircle, History, User, XCircle, Sun, Moon, FileSpreadsheet, Filter, Check, PieChart, BarChart3, ChevronRight, Calculator, Download, AlertTriangle } from 'lucide-react';

const LeaveRequestPage: React.FC = () => {
    const [currentEmp, setCurrentEmp] = useState<Employee | null>(null);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // For stats mapping
    const [history, setHistory] = useState<LeaveRequest[]>([]); // All requests raw data
    const [filteredHistory, setFilteredHistory] = useState<LeaveRequest[]>([]); // For display table
    const [loading, setLoading] = useState(false);
    const [empLoading, setEmpLoading] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<'form' | 'stats'>('form');

    // Form State
    const [leaveType, setLeaveType] = useState<LeaveType>('annual');
    const [reason, setReason] = useState('');
    const [printingRequest, setPrintingRequest] = useState<LeaveRequest | null>(null); // For printing
    const printRef = useRef<HTMLDivElement>(null);

    // Split Date/Time Inputs
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('17:30');

    // Overtime Specific
    const [isOvertime, setIsOvertime] = useState(false);

    // Other Flags
    const [transportMode, setTransportMode] = useState<'personal_car' | 'hs_rail' | 'company_car'>('personal_car');
    const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
    const [allVehicleBookings, setAllVehicleBookings] = useState<VehicleBooking[]>([]); // New: Store all bookings for check
    const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
    const [vehicleError, setVehicleError] = useState<string | null>(null);

    // Overlap Warning State
    const [overlapError, setOverlapError] = useState<string | null>(null);

    // Filters for History
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Stats Filter
    const [statsDeptFilter, setStatsDeptFilter] = useState('All');
    const [statsYearFilter, setStatsYearFilter] = useState(new Date().getFullYear());

    useEffect(() => {
        const today = new Date();
        const localIsoDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        setStartDate(localIsoDate);
        setEndDate(localIsoDate);
    }, []);

    const init = async () => {
        if (!currentEmp) setEmpLoading(true);
        try {
            const emp = await getCurrentEmployee();
            setCurrentEmp(emp);

            // Fetch all employees for stats name mapping
            const allEmps = await getEmployees();
            setAllEmployees(allEmps);

            const reqs = await getLeaveRequests();
            setHistory(reqs);

            const vs = await getVehicles();
            setAvailableVehicles(vs);

            // New: Fetch bookings to check availability
            const vbs = await getVehicleBookings();
            setAllVehicleBookings(vbs);

        } catch (e: any) {
            console.error(e.message);
        } finally {
            setEmpLoading(false);
        }
    };

    useEffect(() => {
        init();
    }, []);

    // --- Helpers ---

    // Construct full ISO strings from split inputs
    const getStartDateTime = () => `${startDate}T${startTime}`;
    const getEndDateTime = () => `${endDate}T${endTime}`;

    // Overtime Specific Setters
    const setOvertimeShift = (endTimeStr: string) => {
        setStartTime('18:00');
        setEndTime(endTimeStr);
        setEndDate(startDate); // Ensure same day
    };

    // Toggle Overtime Mode with Role Check
    const toggleOvertimeMode = () => {
        if (!isOvertime) {
            // Attempting to enable overtime
            const title = currentEmp?.job_title || '';
            if (title.includes('課長') || title.includes('經理') || title.includes('總經理')) {
                alert("❌ 權限限制：主管職級 (課長/經理/總經理) 責任制，不適用加班申請。");
                return;
            }
        }
        setIsOvertime(!isOvertime);
    };

    const handleQuickTimeSelect = (type: 'am' | 'pm') => {
        if (type === 'am') {
            setStartTime('08:00');
            setEndTime('12:00');
        } else {
            setStartTime('13:00');
            setEndTime('17:30'); // Standard end time
        }
    };

    const handlePrint = (req: LeaveRequest) => {
        setPrintingRequest(req);
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

    // Real-time overlap check
    useEffect(() => {
        const runCheck = async () => {
            if (currentEmp && startDate && startTime && endDate && endTime) {
                const s = getStartDateTime();
                const e = getEndDateTime();
                if (new Date(s) >= new Date(e)) return;

                const result = await checkLeaveOverlap(currentEmp.id, new Date(s).toISOString(), new Date(e).toISOString());
                if (result.overlap) {
                    setOverlapError(result.message || '時段重疊');
                } else {
                    setOverlapError(null);
                }
            }
        };
        const timer = setTimeout(runCheck, 500);
        return () => clearTimeout(timer);
    }, [startDate, startTime, endDate, endTime, currentEmp]);

    useEffect(() => {
        // Apply filters for history list
        if (!filterStartDate || !filterEndDate) {
            setFilteredHistory(history);
            return;
        }
        const start = new Date(filterStartDate).getTime();
        const end = new Date(filterEndDate).getTime() + 86400000;

        const filtered = history.filter(req => {
            const reqTime = new Date(req.start_time).getTime();
            return reqTime >= start && reqTime < end;
        });
        setFilteredHistory(filtered);
    }, [history, filterStartDate, filterEndDate]);

    // --- Quota & Logic ---

    const getCycleRange = (hireDateStr: string) => {
        if (!hireDateStr) {
            const now = new Date();
            return {
                start: new Date(now.getFullYear(), 0, 1),
                end: new Date(now.getFullYear(), 11, 31, 23, 59, 59)
            };
        }
        const hireDate = new Date(hireDateStr);
        const today = new Date();
        let cycleStart = new Date(today.getFullYear(), hireDate.getMonth(), hireDate.getDate());
        if (today < cycleStart) { cycleStart.setFullYear(today.getFullYear() - 1); }
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setFullYear(cycleStart.getFullYear() + 1);
        return { start: cycleStart, end: cycleEnd };
    }

    const calculateAnnualLeaveEntitlement = (hireDateStr: string) => {
        const hireDate = new Date(hireDateStr);
        const today = new Date();
        const diffTime = today.getTime() - hireDate.getTime();
        const yearsOfService = diffTime / (1000 * 60 * 60 * 24 * 365.25);

        let days = 0;
        if (yearsOfService < 0.5) { days = 0; }
        else if (yearsOfService < 1) { days = 3; }
        else if (yearsOfService < 2) { days = 7; }
        else if (yearsOfService < 3) { days = 10; }
        else if (yearsOfService < 5) { days = 14; }
        else if (yearsOfService < 10) { days = 15; }
        else if (yearsOfService >= 10) { days = 15 + Math.floor(yearsOfService - 10); }
        return Math.min(days, 30);
    };

    const calculateUsedLeave = (empId: string, type: LeaveType, hireDateStr: string) => {
        const { start: cycleStart, end: cycleEnd } = getCycleRange(hireDateStr);
        const relevantLeaves = history.filter(req =>
            req.employee_id === empId && req.leave_type === type &&
            (req.status === 'approved' || req.status.includes('pending')) &&
            new Date(req.start_time) >= cycleStart && new Date(req.start_time) < cycleEnd
        );
        let usedDays = 0;
        relevantLeaves.forEach(req => {
            const h = calculateDurationLogic(new Date(req.start_time), new Date(req.end_time), req.is_overtime);
            usedDays += (h / 8);
        });
        return Math.round(usedDays * 100) / 100;
    };

    const calculateDurationLogic = (start: Date, end: Date, isOvertimeCalc: boolean = false) => {
        if (start >= end) return 0;

        // 平日加班 (18:00 - 22:00) 獨立邏輯
        const day = start.getDay();
        const isWeekend = day === 0 || day === 6;

        if (isOvertimeCalc && !isWeekend) {
            const validStart = new Date(start); validStart.setHours(18, 0, 0, 0);
            const validEnd = new Date(start); validEnd.setHours(22, 0, 0, 0);
            const actualStart = start > validStart ? start : validStart;
            const actualEnd = end < validEnd ? end : validEnd;
            if (actualStart >= actualEnd) return 0;
            const ms = actualEnd.getTime() - actualStart.getTime();
            const hours = ms / (1000 * 60 * 60);
            return parseFloat(Math.min(hours, 4).toFixed(1));
        }

        // 標準工時邏輯 (08:00-17:30, 8hr)
        let totalHours = 0;
        let current = new Date(start); current.setHours(0, 0, 0, 0);
        const loopEnd = new Date(end); loopEnd.setHours(0, 0, 0, 0);

        const workBlocks = [
            { sH: 8, sM: 0, eH: 10, eM: 0 },    // 08:00 - 10:00
            { sH: 10, sM: 15, eH: 12, eM: 15 }, // 10:15 - 12:15
            { sH: 13, sM: 15, eH: 15, eM: 15 }, // 13:15 - 15:15
            { sH: 15, sM: 30, eH: 17, eM: 30 }, // 15:30 - 17:30
        ];

        while (current <= loopEnd) {
            const dayOfWeek = current.getDay();
            const currentIsWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (isOvertimeCalc || !currentIsWeekend) {
                for (const block of workBlocks) {
                    const bStart = new Date(current);
                    bStart.setHours(block.sH, block.sM, 0, 0);
                    const bEnd = new Date(current);
                    bEnd.setHours(block.eH, block.eM, 0, 0);

                    const actualStart = start > bStart ? start : bStart;
                    const actualEnd = end < bEnd ? end : bEnd;

                    if (actualStart < actualEnd) {
                        const ms = actualEnd.getTime() - actualStart.getTime();
                        totalHours += ms / 3600000;
                    }
                }
            }
            current.setDate(current.getDate() + 1);
        }
        return parseFloat(totalHours.toFixed(2));
    }

    const validateOvertimeRequest = (start: Date, end: Date, calculatedHours: number): string | null => {
        if (calculatedHours <= 0) return "有效加班時數為 0，請檢查時段是否符合規則";
        // Requirement: Min to 19:00 (Start 18:00) => 1 hour
        if (start.getHours() !== 18 || start.getMinutes() !== 0) return "加班起始時間必須為 18:00";
        if (calculatedHours < 1) return "加班時間至少需到 19:00 (1小時)";

        const day = start.getDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend && calculatedHours > 4) return "平日加班時數上限為 4 小時"; // 18:00 - 22:00
        return null;
    }

    // --- New: Vehicle Availability Logic ---
    const checkVehicleAvailability = (vehicleId: number) => {
        if (!startDate || !startTime || !endDate || !endTime) return { available: true };

        const reqStart = new Date(`${startDate}T${startTime}`).getTime();
        const reqEnd = new Date(`${endDate}T${endTime}`).getTime();

        if (reqStart >= reqEnd) return { available: true }; // Invalid time, assume available (validated elsewhere)

        // Find overlap
        const conflict = allVehicleBookings.find(b => {
            if (b.vehicle_id !== vehicleId) return false;
            if (b.status === 'rejected' || b.status === 'cancelled' || b.status === 'returned') return false;

            const bStart = new Date(b.start_time).getTime();
            const bEnd = new Date(b.end_time).getTime();

            // Overlap condition: (StartA < EndB) and (EndA > StartB)
            return (reqStart < bEnd && reqEnd > bStart);
        });

        if (conflict) {
            const bookerName = (conflict as any).employees?.full_name || '未知';
            return { available: false, booker: bookerName };
        }
        return { available: true };
    };

    const getQuotaDisplay = () => {
        if (!currentEmp) return null;
        if (isOvertime) return null;
        if (leaveType === 'business') return null;

        const hireDate = currentEmp.hire_date || new Date().toISOString();
        const { start, end } = getCycleRange(hireDate);
        const cycleStr = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()} ~ ${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()}`;

        let total = 0; let used = 0; let label = ''; let colorClass = ''; let bgClass = '';

        if (leaveType === 'annual') {
            total = calculateAnnualLeaveEntitlement(hireDate);
            used = calculateUsedLeave(currentEmp.id, 'annual', hireDate);
            label = '特別休假額度'; colorClass = 'text-accent'; bgClass = 'bg-accent';
        } else if (leaveType === 'sick') {
            total = currentEmp.sick_leave_quota || 30;
            used = calculateUsedLeave(currentEmp.id, 'sick', hireDate);
            label = '病假額度'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500';
        } else if (leaveType === 'other') {
            total = currentEmp.personal_leave_quota || 14;
            used = calculateUsedLeave(currentEmp.id, 'other', hireDate);
            label = '事假額度'; colorClass = 'text-stone-600'; bgClass = 'bg-stone-500';
        }

        const remaining = Math.max(0, total - used);
        const percentage = Math.min(100, (remaining / Math.max(total, 1)) * 100);
        return { label, total, used, remaining, percentage, colorClass, bgClass, cycleStr };
    };

    const fullStart = getStartDateTime();
    const fullEnd = getEndDateTime();
    const duration = calculateDurationLogic(new Date(fullStart), new Date(fullEnd), isOvertime);
    // Requirement: Meal allowance if Overtime End >= 19:30
    const mealAllowance = isOvertime && new Date(fullEnd).getHours() * 60 + new Date(fullEnd).getMinutes() >= 19 * 60 + 30; // 19:30
    const quotaInfo = getQuotaDisplay();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentEmp) return;
        setVehicleError(null);

        if (duration <= 0) {
            if (isOvertime) alert("申請無效：有效加班時數為 0。\n平日請選擇 18:00 ~ 22:00 之間的時段。\n假日請注意扣除休息時間 (10:00-10:15, 12:15-13:15, 15:15-15:30)。");
            else alert("時數為 0 或結束時間早於開始時間");
            return;
        }
        if (!reason.trim()) { alert("請填寫事由說明 (必填)"); return; }
        if (overlapError) { alert(`❌ 無法送出：${overlapError}`); return; }

        if (isOvertime) {
            const ovError = validateOvertimeRequest(new Date(fullStart), new Date(fullEnd), duration);
            if (ovError) { alert(`❌ 加班規則錯誤：${ovError}`); return; }
        } else if (leaveType === 'other') {
            // Requirement: Personal leave multiples of 2, 4, 6, 8
            const validHours = [2, 4, 6, 8, 16, 24, 32]; // Accommodate longer leaves too if needed, but strict requirement "2/4/6/8"
            // Let's assume per day or total. Requirement says "2/4/6/8 的倍數" (multiples of 2/4/6/8?? Usually means 2, 4, 6, 8 blocks).
            // Actually "2/4/6/8 的倍數" probably means just even numbers? Or specific blocks?
            // "事假最少的請假時數以 2/4/6/8 的倍數計算" -> likely means steps of 2 hours? Or must be exactly 2, 4, 6, 8?
            // Let's interpret as: Must be divisible by 2? Or specifically one of those chunks?
            // "2/4/6/8 的倍數" might be "multiples of 2" (2, 4, 6, 8, 10...)
            // But 2/4/6/8 explicitly listed suggests chunks. 
            // Common TW HR rule: Min 2 hours? or Half day (4)?
            // Let's stick to "Must be a multiple of 2 hours" as a safe interpretation of "2/4/6/8..."
            if (duration % 2 !== 0) {
                alert("❌ 事假時數必須為 2、4、6、8 小時的倍數 (如 2hr, 4hr...)");
                return;
            }
        }

        if (!isOvertime && leaveType === 'business' && transportMode === 'company_car') {
            if (!selectedVehicleId) {
                setVehicleError("請選擇要預約的公務車輛"); return;
            }
            // Double check availability before submitting
            const check = checkVehicleAvailability(selectedVehicleId);
            if (!check.available) {
                setVehicleError(`此車輛剛被 ${check.booker} 預約走了，請重新選擇`);
                // Refresh bookings
                const vbs = await getVehicleBookings();
                setAllVehicleBookings(vbs);
                return;
            }
        }

        if (!isOvertime && quotaInfo) {
            const requestedDays = duration / 8;
            if (requestedDays > quotaInfo.remaining) {
                alert(`❌ 申請失敗：${quotaInfo.label}不足！\n\n剩餘可用: ${quotaInfo.remaining.toFixed(2)} 天\n本次申請: ${requestedDays.toFixed(2)} 天`);
                return;
            }
        }

        const jobTitle = currentEmp.job_title || '';
        const isGM = jobTitle.includes('總經理') || currentEmp.role === 'admin';
        const isManager = jobTitle.includes('經理') && !isGM;
        const isLongLeave = duration > 24;

        let initialStatus = 'pending_dept';
        let requiredLevel: 'dept_manager' | 'general_manager' = 'dept_manager';

        if (isGM) {
            initialStatus = 'approved'; requiredLevel = 'general_manager';
        } else if (isManager) {
            initialStatus = 'pending_gm'; requiredLevel = 'general_manager';
        } else {
            if (isLongLeave) {
                initialStatus = 'pending_dept'; requiredLevel = 'general_manager';
            } else {
                initialStatus = 'pending_dept'; requiredLevel = 'dept_manager';
            }
        }

        const logs: RequestLog[] = [{
            action: '送出申請',
            actor_name: currentEmp.full_name,
            timestamp: new Date().toISOString(),
            comment: `時數: ${duration}hr ${isLongLeave ? '(超過3天，需經部門及總經理簽核)' : ''}`
        }];

        setLoading(true);
        try {
            await createLeaveRequest({
                employee_id: currentEmp.id,
                leave_type: isOvertime ? 'overtime' : leaveType,
                start_time: new Date(fullStart).toISOString(),
                end_time: new Date(fullEnd).toISOString(),
                reason: reason,
                status: initialStatus as any,
                is_overtime: isOvertime,
                overtime_hours: isOvertime ? duration : undefined,
                meal_allowance: mealAllowance,
                transport_mode: leaveType === 'business' ? transportMode : null,
                approval_level: requiredLevel,
                logs: logs
            }, selectedVehicleId || undefined);

            await init();
            setReason(''); setSelectedVehicleId(null);
            alert(initialStatus === 'approved' ? "✅ 申請單已自動核准" : "✅ 已送出申請");

        } catch (err: any) {
            alert(`申請失敗: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApproval = async (req: LeaveRequest, approved: boolean) => {
        try {
            let newStatus = 'rejected';
            let logAction = approved ? '核准' : '駁回';
            let logComment = '';

            const reqDuration = calculateDurationLogic(new Date(req.start_time), new Date(req.end_time), req.is_overtime);
            const needsGM = req.approval_level === 'general_manager' || reqDuration > 24;

            if (approved) {
                if (req.status === 'pending_dept') {
                    if (needsGM) {
                        newStatus = 'pending_gm';
                        logAction = '部門核准(轉呈GM)';
                        logComment = '時數超過3天或特殊申請，轉呈總經理';
                    } else {
                        newStatus = 'approved';
                    }
                } else if (req.status === 'pending_gm') {
                    newStatus = 'approved';
                }
            }
            const newLog: RequestLog = {
                action: logAction,
                actor_name: currentEmp?.full_name || 'Admin',
                timestamp: new Date().toISOString(),
                comment: logComment
            };
            await updateLeaveStatus(req.id, newStatus, newLog);
            await init();
        } catch (e: any) { alert(e.message); }
    }

    const handleCancel = async (id: number) => {
        if (!window.confirm("確定要取消此申請嗎？")) return;
        setLoading(true);
        try {
            await cancelLeaveRequest(id, currentEmp?.full_name || '未知用戶');
            setTimeout(async () => { await init(); setLoading(false); alert("✅ 已成功取消申請"); }, 300);
        } catch (e: any) { setLoading(false); alert(`❌ 取消失敗: ${e.message}`); }
    }

    const handleExportCSV = () => {
        const dataToExport = history.map(req => ({
            單號: req.id,
            申請人: req.employees?.full_name,
            部門: req.employees?.department,
            假別: req.is_overtime ? '加班' : req.leave_type,
            開始時間: new Date(req.start_time).toLocaleString('zh-TW', { hour12: false }),
            結束時間: new Date(req.end_time).toLocaleString('zh-TW', { hour12: false }),
            時數: req.overtime_hours || calculateDurationLogic(new Date(req.start_time), new Date(req.end_time), false),
            事由: req.reason,
            狀態: req.status,
            交通方式: req.transport_mode || '無'
        }));
        downloadCSV(dataToExport, 'Leave_Requests');
    }

    const handleExportStatsCSV = () => {
        const departments = ['All', ...Array.from(new Set(allEmployees.map(e => e.department)))];
        let targetEmps = allEmployees;
        if (statsDeptFilter !== 'All') {
            targetEmps = targetEmps.filter(e => e.department === statsDeptFilter);
        }

        const csvData = targetEmps.map(emp => {
            const empReqs = history.filter(r => {
                const d = new Date(r.start_time);
                return r.employee_id === emp.id &&
                    d.getFullYear() === statsYearFilter &&
                    (r.status === 'approved' || r.status.includes('pending'));
            });

            const sumHours = (type: LeaveType | 'overtime_flag') => {
                let total = 0;
                empReqs.forEach(r => {
                    if (type === 'overtime_flag') {
                        if (r.is_overtime) total += (r.overtime_hours || 0);
                    } else {
                        if (!r.is_overtime && r.leave_type === type) {
                            total += calculateDurationLogic(new Date(r.start_time), new Date(r.end_time), false);
                        }
                    }
                });
                return total;
            };

            return {
                姓名: emp.full_name,
                部門: emp.department,
                職稱: emp.job_title,
                年度: statsYearFilter,
                特休時數: sumHours('annual'),
                事假時數: sumHours('other'),
                病假時數: sumHours('sick'),
                公出時數: sumHours('business'),
                加班時數: sumHours('overtime_flag')
            };
        });

        downloadCSV(csvData, `Department_Stats_${statsYearFilter}`);
    }

    // --- Statistics Calculation ---
    const renderStats = () => {
        const departments = ['All', ...Array.from(new Set(allEmployees.map(e => e.department)))];
        let targetEmps = allEmployees;
        if (statsDeptFilter !== 'All') {
            targetEmps = targetEmps.filter(e => e.department === statsDeptFilter);
        }

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={24} className="text-accent" />
                        <h3 className="font-bold text-lg text-stone-800">部門工時統計報表</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <select value={statsDeptFilter} onChange={e => setStatsDeptFilter(e.target.value)} className="border border-stone-300 rounded-lg p-2 text-sm font-bold text-stone-700 bg-stone-50">
                            {departments.map(d => <option key={d} value={d}>{d === 'All' ? '全公司' : d}</option>)}
                        </select>
                        <select value={statsYearFilter} onChange={e => setStatsYearFilter(parseInt(e.target.value))} className="border border-stone-300 rounded-lg p-2 text-sm font-bold text-stone-700 bg-stone-50">
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y} 年</option>)}
                        </select>
                        <button onClick={handleExportStatsCSV} className="flex items-center gap-1 bg-stone-100 text-stone-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-stone-200 border border-stone-200">
                            <Download size={14} /> 匯出報表
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-stone-200">
                            <thead className="bg-stone-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">姓名/部門</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-rose-500 uppercase tracking-wider">特休(時)</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-rose-500 uppercase tracking-wider">事假(時)</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-rose-500 uppercase tracking-wider">病假(時)</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-sky-600 uppercase tracking-wider">公出(時)</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-purple-600 uppercase tracking-wider">加班(時)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 bg-white">
                                {targetEmps.map(emp => {
                                    const empReqs = history.filter(r => {
                                        const d = new Date(r.start_time);
                                        return r.employee_id === emp.id && d.getFullYear() === statsYearFilter && (r.status === 'approved' || r.status.includes('pending'));
                                    });
                                    const sumHours = (type: LeaveType | 'overtime_flag') => {
                                        let total = 0;
                                        empReqs.forEach(r => {
                                            if (type === 'overtime_flag') { if (r.is_overtime) total += (r.overtime_hours || 0); }
                                            else { if (!r.is_overtime && r.leave_type === type) { total += calculateDurationLogic(new Date(r.start_time), new Date(r.end_time), false); } }
                                        });
                                        return total;
                                    };
                                    return (
                                        <tr key={emp.id} className="hover:bg-stone-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-stone-800">{emp.full_name}</div>
                                                <div className="text-xs text-stone-500">{emp.department} - {emp.job_title}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-stone-700">{sumHours('annual')}</td>
                                            <td className="px-6 py-4 text-right font-mono text-stone-700">{sumHours('other')}</td>
                                            <td className="px-6 py-4 text-right font-mono text-stone-700">{sumHours('sick')}</td>
                                            <td className="px-6 py-4 text-right font-mono text-stone-700">{sumHours('business')}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-purple-700 bg-purple-50">{sumHours('overtime_flag')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    if (empLoading) return <div className="p-10 text-center text-stone-500 flex justify-center items-center gap-2"><RefreshCw className="animate-spin" /> 載入員工資料中...</div>;

    const isGM = currentEmp?.role === 'admin' || currentEmp?.job_title?.includes('總經理');
    const isManager = currentEmp?.job_title?.includes('經理') && !isGM;
    const isChief = currentEmp?.job_title?.includes('課長');
    const canViewStats = isGM || isManager || isChief || currentEmp?.role === 'admin';

    // Approval List Logic
    const pendingApprovals = history.filter(req => {
        if (req.status !== 'pending_dept' && req.status !== 'pending_gm') return false;
        if (req.employee_id === currentEmp?.id) return false;
        const applicant = (req as any).employees;
        if (!applicant) return false;
        const applicantTitle = applicant.job_title || '';
        const applicantDept = applicant.department?.trim();
        const myDept = currentEmp?.department?.trim();

        if (isGM) return req.status === 'pending_gm';
        if (isManager && req.status === 'pending_dept') return applicantDept === myDept;
        if (isChief && req.status === 'pending_dept') {
            if (applicantDept !== myDept) return false;
            if (applicantTitle.includes('經理') || applicantTitle.includes('課長')) return false;
            return true;
        }
        return false;
    });

    const myHistory = filteredHistory;
    const displayHistory = currentEmp?.role === 'admin' ? myHistory : myHistory.filter(h => h.employee_id === currentEmp?.id);

    const renderWorkflow = (req: LeaveRequest) => { /* Same as before */
        const duration = calculateDurationLogic(new Date(req.start_time), new Date(req.end_time), req.is_overtime);
        const needsGM = duration > 24 || (req as any).employees?.job_title?.includes('經理') || req.approval_level === 'general_manager';
        const steps = [{ name: '申請', status: 'done' }, { name: '部門主管', status: req.status === 'pending_dept' ? 'current' : (req.status === 'approved' || req.status === 'pending_gm') ? 'done' : 'waiting' }];
        if (needsGM) { steps.push({ name: '總經理', status: req.status === 'pending_gm' ? 'current' : req.status === 'approved' ? 'done' : 'waiting' }); }
        if (req.status === 'rejected') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">🚫 已駁回</span>;
        if (req.status === 'cancelled') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 border border-stone-200">✖ 已取消</span>;
        return (
            <div className="flex items-center gap-1 mt-1">
                {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${step.status === 'done' ? 'bg-emerald-500' : step.status === 'current' ? 'bg-amber-500 animate-pulse' : 'bg-stone-300'}`} title={step.name}></div>
                        {idx < steps.length - 1 && <div className={`w-3 h-0.5 ${step.status === 'done' ? 'bg-emerald-300' : 'bg-stone-200'}`}></div>}
                    </div>
                ))}
                <span className="text-[10px] text-stone-400 ml-1">{req.status === 'approved' ? '完成' : '進行中'}</span>
            </div>
        );
    };

    const getCancelType = (req: LeaveRequest) => {
        if (req.status === 'rejected' || req.status === 'cancelled') return null;
        if (currentEmp?.role === 'admin') return 'force';
        if (req.employee_id === currentEmp?.id) { if (new Date(req.end_time) > new Date()) return 'self'; }
        return null;
    }

    // --- Main Render ---

    if (activeTab === 'stats' && canViewStats) {
        return (
            <div>
                <div className="flex gap-2 mb-6 border-b border-stone-200 pb-2">
                    <button onClick={() => setActiveTab('form')} className="px-4 py-2 text-stone-500 hover:text-stone-800 font-bold">申請與簽核</button>
                    <button onClick={() => setActiveTab('stats')} className="px-4 py-2 text-accent border-b-2 border-accent font-bold">部門統計報表</button>
                </div>
                {renderStats()}
            </div>
        );
    }

    return (
        <div>
            {canViewStats && (
                <div className="flex gap-2 mb-6 border-b border-stone-200 pb-2">
                    <button onClick={() => setActiveTab('form')} className="px-4 py-2 text-accent border-b-2 border-accent font-bold">申請與簽核</button>
                    <button onClick={() => setActiveTab('stats')} className="px-4 py-2 text-stone-500 hover:text-stone-800 font-bold">部門統計報表</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {currentEmp && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-12 w-12 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold text-lg border border-accent/10">
                                    {currentEmp.full_name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-stone-800">{currentEmp.full_name}</div>
                                    <div className="text-xs text-stone-500 font-medium">{currentEmp.department} | {currentEmp.job_title}</div>
                                </div>
                            </div>

                            {/* Dynamic Quota Card */}
                            {quotaInfo ? (
                                <div className="animate-fade-in">
                                    <h3 className="font-bold text-stone-700 text-lg mb-3 flex items-center gap-2 tracking-wider">
                                        <PieChart size={20} className={quotaInfo.colorClass} />
                                        {quotaInfo.label}
                                    </h3>
                                    <div className="mb-2">
                                        <div className="flex justify-between mb-1.5 text-xs">
                                            <span className="text-stone-600 font-bold flex items-center gap-1">
                                                {leaveType === 'annual' ? `到職: ${currentEmp.hire_date || '未設定'}` : '目前週期'}
                                            </span>
                                            <span className={`${quotaInfo.remaining === 0 ? 'text-rose-500' : 'text-emerald-600'} font-mono font-bold text-sm`}>
                                                餘 {quotaInfo.remaining.toFixed(1)} / {quotaInfo.total} 天
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-stone-400 mb-2">週期範圍: {quotaInfo.cycleStr}</div>
                                        <div className="h-2.5 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-100">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${quotaInfo.remaining < 1 ? 'bg-rose-400' : quotaInfo.bgClass}`}
                                                style={{ width: `${quotaInfo.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 text-center text-stone-400 text-xs">
                                    {isOvertime ? '加班申請無額度限制' : '此假別無固定額度限制'}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sticky top-6">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
                            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                                <PlusCircle size={24} className="text-accent" />
                                {isOvertime ? '新增加班單' : '新增請假/公出'}
                            </h2>
                            <button onClick={toggleOvertimeMode} className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border ${isOvertime ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'}`}>
                                切換為{isOvertime ? '一般請假' : '加班申請'}
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isOvertime && (
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">假別種類</label>
                                    <div className="relative">
                                        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} className="w-full border-stone-300 rounded-xl shadow-sm focus:ring-2 focus:ring-accent/50 focus:border-accent p-2.5 border bg-white appearance-none transition-shadow">
                                            <option value="annual">特別休假 (Annual)</option>
                                            <option value="sick">病假 (Sick)</option>
                                            <option value="business">公出/出差 (Business)</option>
                                            <option value="other">事假/其他 (Personal)</option>
                                        </select>
                                    </div>
                                    {/* Quick Selection for AM/PM */}
                                    {(leaveType === 'annual' || leaveType === 'other') && (
                                        <div className="flex gap-2 mt-2">
                                            <button type="button" onClick={() => handleQuickTimeSelect('am')} className="flex-1 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-100">上午 (08:00-12:00)</button>
                                            <button type="button" onClick={() => handleQuickTimeSelect('pm')} className="flex-1 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-100">下午 (13:00-17:30)</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isOvertime && (
                                <div className="bg-amber-50 text-amber-900 text-xs p-3 rounded-xl border border-amber-200/60">
                                    <strong className="block mb-1 flex items-center gap-1"><Sun size={12} /> 加班規則說明：</strong>
                                    <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                                        <li>平日：限 18:00 ~ 22:00 (上限 4hr)</li>
                                        <li>假日：比照平日上班規則 (扣除休息時間)</li>
                                        <li>最小申請單位：0.5 小時</li>
                                    </ul>
                                </div>
                            )}

                            {/* Improved Date Time Selection */}
                            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 space-y-3">

                                {/* Overtime Specific UI */}
                                {isOvertime ? (
                                    <div className="animate-fade-in space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">加班日期</label>
                                            <input required type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setEndDate(e.target.value); }} className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 outline-none" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-stone-500 mb-1">快速選擇 (18:00 開始)</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'].map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setOvertimeShift(t)}
                                                        className={`text-xs px-2 py-1.5 rounded-lg border font-mono font-bold transition-all ${startTime === '18:00' && endTime === t
                                                            ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                                                            : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                                                            }`}
                                                    >
                                                        ~{t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200/50">
                                            <div>
                                                <label className="block text-[10px] font-bold text-stone-400 mb-0.5">開始 (24h)</label>
                                                <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-1.5 border border-stone-300 rounded-lg text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-stone-400 mb-0.5">結束 (24h)</label>
                                                <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-1.5 border border-stone-300 rounded-lg text-sm bg-white" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Regular Leave UI
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-stone-500 mb-1">開始日期</label>
                                                <input required type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-stone-500 mb-1">開始時間</label>
                                                <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 outline-none" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-stone-500 mb-1">結束日期</label>
                                                <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-stone-500 mb-1">結束時間</label>
                                                <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 outline-none" />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {overlapError && (
                                <div className="flex items-start gap-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 whitespace-pre-wrap">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{overlapError}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-600"><Clock size={14} /> <span>{isOvertime ? '有效加班' : leaveType === 'business' ? '公出時數' : '請假時數'}: <strong className={`text-lg font-mono ${duration === 0 ? 'text-red-500' : 'text-stone-800'}`}>{duration}</strong> 小時</span></div>
                                {mealAllowance && <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><Utensils size={12} /> 誤餐費 $50</span>}
                            </div>

                            {!isOvertime && leaveType === 'business' && (
                                <div className={`bg-sky-50 p-3 rounded-xl border ${vehicleError ? 'border-red-300' : 'border-sky-100'} space-y-3`}>
                                    <label className="block text-xs font-bold text-sky-800 uppercase">交通方式</label>
                                    <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as any)} className="w-full border-sky-200 rounded-lg text-sm p-2 bg-white focus:ring-sky-500 focus:border-sky-500">
                                        <option value="personal_car">自用車</option>
                                        <option value="hs_rail">高鐵/大眾運輸</option>
                                        <option value="company_car">公務車 (自動預約)</option>
                                    </select>
                                    {transportMode === 'company_car' && (
                                        <div className="space-y-2 mt-2">
                                            <div className="text-xs text-sky-700 font-bold flex items-center gap-1"><Car size={12} /> 選擇車輛 (灰色代表已被預約)</div>
                                            {vehicleError && <div className="text-xs text-red-600 font-bold flex items-center gap-1"><AlertCircle size={12} /> {vehicleError}</div>}
                                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                {availableVehicles.map(v => {
                                                    const availability = checkVehicleAvailability(v.id);
                                                    return (
                                                        <label
                                                            key={v.id}
                                                            className={`flex items-center justify-between p-2.5 border rounded-lg text-xs transition-colors ${!availability.available
                                                                ? 'bg-stone-100 border-stone-200 opacity-70 cursor-not-allowed'
                                                                : selectedVehicleId === v.id
                                                                    ? 'bg-sky-100 border-sky-300 ring-1 ring-sky-300 cursor-pointer'
                                                                    : 'bg-white border-stone-200 hover:border-sky-200 cursor-pointer'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="vehicle"
                                                                    disabled={!availability.available}
                                                                    className="text-sky-600 focus:ring-sky-500"
                                                                    checked={selectedVehicleId === v.id}
                                                                    onChange={() => { setSelectedVehicleId(v.id); setVehicleError(null); }}
                                                                />
                                                                <div>
                                                                    <span className="font-bold text-stone-700 block">{v.name}</span>
                                                                    <span className="text-stone-400 font-mono block">{v.plate_number}</span>
                                                                </div>
                                                            </div>
                                                            {!availability.available && (
                                                                <span className="text-[10px] text-red-500 font-bold">⛔ 已被 {availability.booker} 預約</span>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">事由說明 <span className="text-red-500">*</span></label>
                                <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border-stone-300 rounded-xl p-3 border focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-shadow" placeholder="請簡述說明..." />
                            </div>

                            <button type="submit" disabled={loading || !!overlapError} className={`w-full text-white py-2.5 px-4 rounded-xl shadow-md font-bold disabled:opacity-50 mt-4 flex justify-center items-center gap-2 transition-all active:scale-[0.98] ${!currentEmp || !!overlapError ? 'bg-stone-400 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover shadow-orange-200'}`}>
                                {loading ? <><RefreshCw className="animate-spin" size={16} /> 處理中...</> : <>送出申請 <CheckCircle size={16} /></>}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {/* ... Existing Approvals Table ... */}
                    {(isChief || isManager || isGM) && pendingApprovals.length > 0 && (
                        <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2"><CheckCircle size={20} /> 待簽核單據</h3>
                                <span className="bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">{pendingApprovals.length} 筆</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-amber-200">
                                    <tbody className="divide-y divide-amber-100">
                                        {pendingApprovals.map(req => {
                                            // Calculate monthly accumulated overtime for warning
                                            let overtimeWarning = false;
                                            let accumulatedHours = 0;

                                            if (req.is_overtime) {
                                                const reqDate = new Date(req.start_time);
                                                const reqMonth = reqDate.getMonth();
                                                const reqYear = reqDate.getFullYear();

                                                // Sum up approved overtime for this month
                                                const approvedMonthlyOT = history
                                                    .filter(h =>
                                                        h.employee_id === req.employee_id &&
                                                        h.is_overtime &&
                                                        h.status === 'approved' &&
                                                        new Date(h.start_time).getMonth() === reqMonth &&
                                                        new Date(h.start_time).getFullYear() === reqYear
                                                    )
                                                    .reduce((sum, h) => sum + (h.overtime_hours || 0), 0);

                                                const currentReqHours = req.overtime_hours || 0;
                                                accumulatedHours = approvedMonthlyOT + currentReqHours;

                                                if (accumulatedHours > 40) {
                                                    overtimeWarning = true;
                                                }
                                            }

                                            return (
                                                <tr key={req.id}>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-stone-800">{(req as any).employees?.full_name}</div>
                                                        <div className="text-xs text-stone-500 flex items-center gap-1">{(req as any).employees?.department} <span className="text-stone-300">|</span> {(req as any).employees?.job_title}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold w-fit border ${req.is_overtime ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                                                                {req.is_overtime ? '加班' : req.leave_type === 'business' ? '公出' : '請假'}
                                                            </span>
                                                            {overtimeWarning && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 animate-pulse">
                                                                    <AlertTriangle size={10} />
                                                                    本月累計 {accumulatedHours.toFixed(1)}hr
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-stone-500 mt-2 font-mono">{new Date(req.start_time).toLocaleDateString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-stone-600">{req.reason}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleApproval(req, true)} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm">核准</button>
                                                            <button onClick={() => handleApproval(req, false)} className="bg-white text-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-50">駁回</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-5 gap-4">
                            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                                <FileText size={26} className="text-stone-400" />
                                {currentEmp?.role === 'admin' ? '全體申請紀錄 (Admin)' : '我的申請紀錄'}
                            </h2>

                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-stone-200 shadow-sm flex-1 md:flex-none">
                                    <Filter size={14} className="text-stone-400 ml-1" />
                                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="text-xs border-none bg-transparent focus:ring-0 p-0 text-stone-600 font-mono w-24" />
                                    <span className="text-stone-300 text-xs">~</span>
                                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="text-xs border-none bg-transparent focus:ring-0 p-0 text-stone-600 font-mono w-24" />
                                </div>
                                <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-stone-100 text-stone-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-200 border border-stone-200 transition-colors">
                                    <FileSpreadsheet size={16} /> 匯出 CSV
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-stone-200">
                                    <thead className="bg-stone-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">申請人/類別</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">時間與事由</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">簽核進度</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-stone-100">
                                        {displayHistory.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-stone-400">查無紀錄</td></tr> : displayHistory.map((req) => {
                                            const cancelType = getCancelType(req);
                                            return (
                                                <tr key={req.id} className="hover:bg-stone-50 transition-colors group">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-bold text-stone-800">{(req as any).employees?.full_name}</div>
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1.5 border ${req.is_overtime ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-stone-50 text-stone-600 border-stone-100'}`}>
                                                            {req.is_overtime ? '加班' : req.leave_type === 'business' ? '公出' : req.leave_type === 'annual' ? '特休' : '請假'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-stone-600 flex items-center gap-1.5 whitespace-nowrap font-medium">
                                                            <Calendar size={14} className="text-stone-400" /> {new Date(req.start_time).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            <span className="text-stone-300">→</span> {new Date(req.end_time).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </div>
                                                        <div className="text-xs text-stone-500 mt-1 truncate max-w-[200px]" title={req.reason || ''}>{req.reason}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {renderWorkflow(req)}
                                                        <div className="mt-2 space-y-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            {req.logs?.slice(-1).map((log, i) => (
                                                                <div key={i} className="text-[10px] text-stone-400 flex items-center gap-1 truncate max-w-[200px]">
                                                                    <History size={10} />
                                                                    <span>{log.actor_name} {log.action}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                                        {cancelType && (
                                                            <button
                                                                onClick={() => handleCancel(req.id)}
                                                                className={`text-xs font-bold flex items-center gap-1 ml-auto transition-all px-3 py-1.5 rounded-full border ${cancelType === 'force' ? 'border-rose-300 text-rose-500 hover:bg-rose-50 hover:text-rose-600' : 'text-stone-400 border-stone-200 hover:text-stone-600 hover:bg-stone-50 hover:border-stone-300'}`}
                                                            >
                                                                <XCircle size={14} /> {cancelType === 'force' ? '強制取消' : '取消'}
                                                            </button>
                                                        )}
                                                        {req.is_overtime && ( // Print Button
                                                            <button
                                                                onClick={() => handlePrint(req)}
                                                                className="text-xs font-bold flex items-center gap-1 ml-2 transition-all px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50"
                                                            >
                                                                <Printer size={14} /> 列印憑單
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hidden Print Template for Overtime Voucher */}
                <div className="hidden">
                    <div ref={printRef} className="p-10 font-serif text-black bg-white max-w-[210mm] mx-auto">
                        <style>{`
                            @media print {
                                @page { size: A4; margin: 20mm; }
                                body { background: white; -webkit-print-color-adjust: exact; }
                            }
                            table { border-collapse: collapse; width: 100%; }
                            th, td { border: 1px solid black; padding: 8px; text-align: center; }
                        `}</style>
                        {printingRequest && (
                            <div className="border-2 border-transparent">
                                <div className="flex justify-between items-end mb-4 relative">
                                    <div className="absolute left-[80px] -top-2">
                                        {/* Mimic the paper clip if you really want, or just consistent layout */}
                                    </div>
                                    <h1 className="text-3xl font-normal text-center w-full tracking-[0.5em] mb-4">加班給付憑單</h1>
                                    <div className="absolute right-0 top-0 text-right text-sm">
                                        <p className="mb-2">填寫單位: <span className="underline decoration-1 underline-offset-4 ml-2">{printingRequest.employees?.department || 'Unknown'}</span></p>
                                        <p>填單日期: <span className="underline decoration-1 underline-offset-4 ml-2">{new Date(printingRequest.created_at || '').toLocaleDateString('zh-TW')}</span></p>
                                    </div>
                                </div>

                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="w-24">加班人<br />姓名</th>
                                            <th rowSpan={2} className="w-24">加班<br />日期</th>
                                            <th colSpan={2}>預定加班時間</th>
                                            <th rowSpan={2} className="w-64">加 班 事 由 說 明</th>
                                            <th colSpan={2}>實際加班時間</th>
                                            <th colSpan={2}>核 付 金 額</th>
                                        </tr>
                                        <tr>
                                            <th>起</th>
                                            <th>訖</th>
                                            <th>起</th>
                                            <th>訖</th>
                                            <th>單項</th>
                                            <th>總計</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="h-16">
                                            <td>{printingRequest.employees?.full_name}</td>
                                            <td>{new Date(printingRequest.start_time).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</td>
                                            <td>{new Date(printingRequest.start_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>{new Date(printingRequest.end_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="text-left align-top p-2">{printingRequest.reason}</td>
                                            {/* Actual time is usually same as planned for form unless filled later. We leave blank or fill same? Reference image has it blank. Let's fill it. */}
                                            <td>{new Date(printingRequest.start_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>{new Date(printingRequest.end_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>{printingRequest.meal_allowance ? '$50(誤餐)' : '-'}</td>
                                            <td>{printingRequest.meal_allowance ? '$50' : '-'}</td>
                                        </tr>
                                        {/* Empty rows to mimic form */}
                                        <tr className="h-16">
                                            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="mt-8 flex justify-between text-lg px-8">
                                    <div>部門主管: ________________</div>
                                    <div>單位主管: ________________</div>
                                    <div>人事查核: ________________</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default LeaveRequestPage;
