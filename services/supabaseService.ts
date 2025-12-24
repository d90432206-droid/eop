
import { supabase } from '../supabaseClient';
import { Employee, LeaveRequest, Vehicle, VehicleBooking, ExpenseClaim, EmployeeStatus, VehicleLog, Visitor, RequestStatus, RequestLog } from '../types';

/**
 * Helper for Error Handling
 */
const handleError = (error: any) => {
  if (error) {
    console.error('Supabase Error Raw:', error);
    let errorMessage = '發生未預期的錯誤';

    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      if ('message' in error) {
        errorMessage = error.message;
      } else if ('error_description' in error) {
        errorMessage = error.error_description;
      } else if ('hint' in error && error.hint) {
        errorMessage = `錯誤: ${error.message} (${error.hint})`;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = '無法解析的錯誤格式';
        }
      }

      if (errorMessage.includes('fetch')) errorMessage = '連線失敗，請檢查網路或 Supabase URL 設定。';
      if (errorMessage.includes('JWT') || errorMessage.includes('Invalid API key')) errorMessage = '憑證無效或過期，請重新登入。';
      if (errorMessage.includes('Invalid login credentials')) errorMessage = '帳號或密碼錯誤。';
      if (errorMessage.includes('PGRST116')) errorMessage = '找不到符合的資料 (PGRST116)。';
      if (errorMessage.includes('Could not find the')) errorMessage = '資料庫欄位不符，請聯繫管理員。';
    }

    throw new Error(errorMessage);
  }
};

// --- Utilities ---

export const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("無資料可匯出");
    return;
  }

  // 取得所有鍵值作為標題
  const headers = Object.keys(data[0]);

  // 建立 CSV 內容
  const csvContent = [
    // 加入 BOM 以解決 Excel 中文亂碼
    '\uFEFF' + headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      let val = row[fieldName];
      if (val === null || val === undefined) val = '';
      // 處理包含逗號或換行的內容，轉為字串並跳脫雙引號
      const stringVal = String(val).replace(/"/g, '""');
      return `"${stringVal}"`;
    }).join(','))
  ].join('\n');

  // 建立下載連結
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Auth ---

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
};

export const getCurrentEmployee = async (): Promise<Employee | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // Return a safe fallback or null, don't throw to avoid white screen on first load
    console.warn("Failed to fetch employee profile:", error);
    return null;
  }
  return data as Employee;
};

export const repairProfile = async (): Promise<void> => {
  const { error } = await supabase.rpc('repair_my_profile');
  if (error) handleError(error);
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) handleError(error);
};

// --- Admin / Demo Data ---

export const seedDemoData = async (): Promise<void> => {
  const updates = [
    { email: 'gm@chuyi.com.tw', full_name: '王大明', department: '管理部', job_title: '總經理', role: 'admin', phone: '0912-345-678' },
    { email: 'admin@chuyi.com.tw', full_name: '林總務', department: '總務部', job_title: '總務經理', role: 'admin', phone: '0922-456-789' },
    { email: 'sales_mgr@chuyi.com.tw', full_name: '陳業務', department: '業務部', job_title: '部門經理', role: 'employee', phone: '0933-567-890' },
    { email: 'sales_01@chuyi.com.tw', full_name: '張小業', department: '業務部', job_title: '業務專員', role: 'employee', phone: '0944-678-901' },
    { email: 'qa_mgr@chuyi.com.tw', full_name: '吳品保', department: '品保部', job_title: '部門經理', role: 'employee', phone: '0955-789-012' },
    { email: 'qa_chief@chuyi.com.tw', full_name: '李課長', department: '品保部', job_title: '課長', role: 'employee', phone: '0966-890-123' },
    { email: 'qa_01@chuyi.com.tw', full_name: '趙小品', department: '品保部', job_title: '品保專員', role: 'employee', phone: '0977-901-234' },
    { email: 'ats_mgr@chuyi.com.tw', full_name: '劉ATS', department: 'ATS部', job_title: '部門經理', role: 'employee', phone: '0988-012-345' },
    { email: 'ats_chief@chuyi.com.tw', full_name: '黃課長', department: 'ATS部', job_title: '課長', role: 'employee', phone: '0999-123-456' },
    { email: 'ats_01@chuyi.com.tw', full_name: '孫小A', department: 'ATS部', job_title: 'ATS專員', role: 'employee', phone: '0910-234-567' },
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from('employees')
      .update({
        full_name: u.full_name,
        department: u.department,
        job_title: u.job_title,
        role: u.role,
        phone: u.phone
      })
      .eq('email', u.email);

    if (error) console.error(`Failed to update ${u.email}:`, error);
  }
};

export const getSystemStats = async () => {
  const tableCounts = {
    employees: 0,
    leave_requests: 0,
    vehicles: 0,
    vehicle_bookings: 0,
    expense_claims: 0,
    visitors: 0
  };

  try {
    const tables = Object.keys(tableCounts);
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        tableCounts[table as keyof typeof tableCounts] = count;
      }
    }
  } catch (e) {
    console.error("Failed to fetch system stats", e);
  }
  return tableCounts;
};

// --- Employees ---

export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('department')
    .order('employee_id');

  if (error) return []; // Fallback empty array
  return data as Employee[];
};

export const updateEmployeeStatus = async (
  id: string,
  status: EmployeeStatus,
  location_detail: string | null,
  expected_return: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('employees')
    .update({
      current_status: status,
      location_detail: location_detail,
      expected_return: expected_return
    })
    .eq('id', id);

  if (error) handleError(error);
};

// --- Leave Requests ---

export const checkLeaveOverlap = async (
  employeeId: string,
  startTime: string,
  endTime: string
): Promise<{ overlap: boolean, message?: string }> => {
  // Check overlapping dates for active requests (not rejected or cancelled)
  const { data, error } = await supabase
    .from('leave_requests')
    .select('start_time, end_time, leave_type, reason')
    .eq('employee_id', employeeId)
    .neq('status', 'rejected')
    .neq('status', 'cancelled');

  if (error) {
    console.error('Check overlap error', error);
    return { overlap: false }; // Fail safe
  }
  if (!data || data.length === 0) return { overlap: false };

  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  // Overlap condition: (StartA < EndB) and (EndA > StartB)
  const conflict = data.find(req => {
    const reqStart = new Date(req.start_time).getTime();
    const reqEnd = new Date(req.end_time).getTime();
    return (newStart < reqEnd && newEnd > reqStart);
  });

  if (conflict) {
    const typeMap: Record<string, string> = { annual: '特休', sick: '病假', business: '公出', overtime: '加班', other: '事假' };
    const cStart = new Date(conflict.start_time).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cEnd = new Date(conflict.end_time).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return {
      overlap: true,
      message: `與已存在的「${typeMap[conflict.leave_type] || conflict.leave_type}」重疊！\n日期: ${cStart} ~ ${cEnd}\n事由: ${conflict.reason}`
    };
  }

  return { overlap: false };
};

export const createLeaveRequest = async (
  request: Omit<LeaveRequest, 'id' | 'created_at' | 'employees'>,
  vehicleIdForBooking?: number
): Promise<void> => {
  // 1. Create Leave Request
  const { error } = await supabase
    .from('leave_requests')
    .insert(request);

  if (error) handleError(error);

  // 2. Create Vehicle Booking if needed (Sync status with Leave Request)
  if (request.transport_mode === 'company_car' && vehicleIdForBooking) {
    await createVehicleBooking({
      vehicle_id: vehicleIdForBooking,
      employee_id: request.employee_id,
      start_time: request.start_time,
      end_time: request.end_time,
      purpose: `公務車連動：${request.reason}`,
      start_mileage: null,
      end_mileage: null,
      status: request.status // Sync status: pending_dept, pending_gm, or approved
    });
  }

  // 3. If auto-approved (e.g. GM), update status
  if (request.status === 'approved') {
    const now = new Date();
    const start = new Date(request.start_time);
    if (start <= now && new Date(request.end_time) > now) {
      const status = request.leave_type === 'business' ? 'out' : 'leave';
      await updateEmployeeStatus(request.employee_id, status, request.reason, request.end_time);
    }
  }
};

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`*, employees (full_name, department, employee_id, job_title)`)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as LeaveRequest[];
};

export const updateLeaveStatus = async (id: number, status: string, newLogEntry?: RequestLog): Promise<void> => {
  // 1. Fetch current data to get times and employee to sync vehicle booking
  const { data: currentData, error: fetchError } = await supabase
    .from('leave_requests')
    .select('logs, start_time, end_time, employee_id, transport_mode')
    .eq('id', id)
    .single();

  if (fetchError) handleError(fetchError);

  const currentLogs = currentData?.logs ? currentData.logs : [];
  if (newLogEntry) {
    currentLogs.push(newLogEntry);
  }

  // 2. Update status and logs for Leave Request
  const { error } = await supabase
    .from('leave_requests')
    .update({
      status,
      logs: currentLogs
    })
    .eq('id', id);

  if (error) handleError(error);

  // 3. Sync Vehicle Booking Status if exists (Company Car)
  if (currentData?.transport_mode === 'company_car' && currentData?.employee_id) {
    // Try to find matching booking. Note: Schema doesn't link ID, so we match by user + time.
    // This is a best-effort sync.
    const { data: bookings } = await supabase
      .from('vehicle_bookings')
      .select('id')
      .eq('employee_id', currentData.employee_id)
      .eq('start_time', currentData.start_time)
      .eq('end_time', currentData.end_time);

    if (bookings && bookings.length > 0) {
      // Update all matching bookings (usually just one)
      const bookingIds = bookings.map(b => b.id);
      await supabase
        .from('vehicle_bookings')
        .update({ status: status })
        .in('id', bookingIds);
    }
  }
};

export const cancelLeaveRequest = async (id: number, employeeName: string): Promise<void> => {
  // Append log for cancellation
  const newLog: RequestLog = {
    action: '取消申請',
    actor_name: employeeName,
    timestamp: new Date().toISOString(),
    comment: '使用者或管理者執行取消'
  };

  // Use the same update logic to preserve logs and sync vehicle cancellation
  await updateLeaveStatus(id, 'cancelled', newLog);
};

export const getMyBusinessTrips = async (employeeId: string): Promise<LeaveRequest[]> => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, employees(full_name, department, job_title)') // Join added
    .eq('employee_id', employeeId)
    .eq('leave_type', 'business')
    .eq('status', 'approved') // Only approved trips can have expenses
    .order('start_time', { ascending: false });

  if (error) return [];
  return data as LeaveRequest[];
};

// --- Vehicles ---

export const getVehicles = async (): Promise<Vehicle[]> => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('name');
  if (error) return [];
  return data as Vehicle[];
};

export const updateVehicleMileage = async (vehicleId: number, newMileage: number): Promise<void> => {
  const { error } = await supabase
    .from('vehicles')
    .update({ current_mileage: newMileage })
    .eq('id', vehicleId);
  if (error) handleError(error);
};

export const createVehicleBooking = async (booking: Omit<VehicleBooking, 'id' | 'created_at' | 'vehicles' | 'employees'>): Promise<void> => {
  const { error } = await supabase
    .from('vehicle_bookings')
    .insert(booking);

  if (error) handleError(error);
};

export const returnVehicle = async (bookingId: number, vehicleId: number, endMileage: number, condition: string): Promise<void> => {
  const { error: bookingError } = await supabase
    .from('vehicle_bookings')
    .update({
      status: 'returned',
      end_mileage: endMileage,
      return_condition: condition,
      returned_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (bookingError) handleError(bookingError);

  const { error: vehicleError } = await supabase
    .from('vehicles')
    .update({
      is_available: true,
      current_mileage: endMileage
    })
    .eq('id', vehicleId);

  if (vehicleError) handleError(vehicleError);
};

export const cancelVehicleBooking = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('vehicle_bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) handleError(error);
};

export const getVehicleBookings = async (): Promise<VehicleBooking[]> => {
  const { data, error } = await supabase
    .from('vehicle_bookings')
    .select('*, vehicles(name, plate_number), employees(full_name)')
    .order('start_time', { ascending: false });

  if (error) return [];
  return data as VehicleBooking[];
};

// --- Vehicle Logs ---

export const createVehicleLog = async (log: Omit<VehicleLog, 'id' | 'created_at' | 'employees'>): Promise<void> => {
  const { error } = await supabase
    .from('vehicle_logs')
    .insert(log);
  if (error) handleError(error);
};

export const getVehicleLogs = async (vehicleId?: number): Promise<VehicleLog[]> => {
  let query = supabase
    .from('vehicle_logs')
    .select('*, employees(full_name)')
    .order('created_at', { ascending: false });

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query;
  if (error) return [];
  return data as VehicleLog[];
};

// --- Expenses ---

export const createExpenseClaim = async (claim: Omit<ExpenseClaim, 'id' | 'created_at'>): Promise<void> => {
  // DB does not have leave_request_id column. We must not send it.
  const tripId = claim.leave_request_id;
  const description = tripId ? `[TRIP-${tripId}] ${claim.description || ''}` : claim.description;

  // Explicitly construct payload with ONLY columns that exist in DB
  const dbPayload = {
    employee_id: claim.employee_id,
    claim_date: claim.claim_date,
    category: claim.category,
    amount: claim.amount,
    currency: claim.currency,
    description: description,
    status: claim.status
  };

  const { error } = await supabase
    .from('expense_claims')
    .insert(dbPayload);

  if (error) handleError(error);
};

export const getExpenseClaims = async (leaveRequestId?: number): Promise<ExpenseClaim[]> => {
  let query = supabase
    .from('expense_claims')
    .select('*, employees(full_name, department, job_title)')
    .order('claim_date', { ascending: false });

  if (leaveRequestId) {
    // Filter by tag in description
    query = query.ilike('description', `[TRIP-${leaveRequestId}]%`);
  }

  const { data, error } = await query;
  if (error) return [];

  // Clean description for UI (remove tag)
  return (data as ExpenseClaim[]).map(item => {
    // Re-attach the ID conceptually if needed
    if (leaveRequestId) item.leave_request_id = leaveRequestId;

    if (item.description && item.description.startsWith(`[TRIP-`)) {
      // Keep raw description for debugging if needed, or clean it. 
      // Here we clean it for display.
      item.description = item.description.replace(/^\[TRIP-\d+\]\s*/, '');
    }
    return item;
  });
};

export const updateExpenseStatus = async (id: number, status: RequestStatus): Promise<void> => {
  const { error } = await supabase
    .from('expense_claims')
    .update({ status })
    .eq('id', id);
  if (error) handleError(error);
};

export const submitExpenseClaim = async (leaveRequestId: number): Promise<void> => {
  const tag = `[TRIP-${leaveRequestId}]%`;
  const { error } = await supabase
    .from('expense_claims')
    .update({ status: 'pending_dept' })
    .ilike('description', tag)
    .eq('status', 'pending');
    
  if (error) handleError(error);
};

// --- Visitors ---

export const getVisitors = async (): Promise<Visitor[]> => {
  const { data, error } = await supabase
    .from('visitors')
    .select('*, employees(full_name)')
    .order('visit_date', { ascending: false })
    .order('visit_time', { ascending: true });

  if (error) return [];
  return data as Visitor[];
};

export const createVisitor = async (visitor: Omit<Visitor, 'id' | 'created_at' | 'employees'>): Promise<void> => {
  const { error } = await supabase
    .from('visitors')
    .insert(visitor);
  if (error) handleError(error);
};

export const updateVisitorStatus = async (id: number, status: 'expected' | 'arrived' | 'left'): Promise<void> => {
  const { error } = await supabase
    .from('visitors')
    .update({ status })
    .eq('id', id);
  if (error) handleError(error);
};

export const cancelVisitor = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('visitors')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) handleError(error);
};
