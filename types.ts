
export type EmployeeStatus = 'in_office' | 'meeting' | 'out' | 'abroad' | 'leave';
export type LeaveType = 'annual' | 'sick' | 'business' | 'overtime' | 'other';
// Updated to support multi-stage approval and cancellation
export type RequestStatus = 'pending' | 'pending_dept' | 'pending_gm' | 'approved' | 'rejected' | 'returned' | 'cancelled';
export type UserRole = 'admin' | 'employee';

export interface Employee {
  id: string; // UUID
  employee_id: string; // e.g., EMP001
  full_name: string;
  department: string;
  job_title: string | null;
  email: string;
  phone?: string; // New: Phone number for quick contact
  role: UserRole;
  current_status: EmployeeStatus;
  location_detail: string | null;
  expected_return: string | null;
  avatar_url: string | null;
  
  // New: Hire Date for Annual Leave Calculation
  hire_date: string; // YYYY-MM-DD
  
  // Quotas
  annual_leave_quota: number;   // days
  sick_leave_quota: number;     // days
  personal_leave_quota: number; // days
  
  created_at?: string;
}

export interface RequestLog {
  action: string;
  actor_name: string;
  timestamp: string;
  comment?: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: string;
  leave_type: LeaveType;
  start_time: string;
  end_time: string;
  reason: string | null;
  status: RequestStatus;
  
  // New: Overtime & Business Trip
  is_overtime?: boolean;
  overtime_hours?: number;
  meal_allowance?: boolean;
  
  transport_mode?: 'personal_car' | 'hs_rail' | 'company_car' | null;
  approval_level?: 'dept_manager' | 'general_manager';
  
  logs?: RequestLog[]; // JSONB column for approval history

  created_at?: string;
  employees?: Employee;
}

export interface Vehicle {
  id: number;
  name: string;
  plate_number: string;
  is_available: boolean;
  current_mileage: number;
  image_url?: string;
}

export interface VehicleBooking {
  id: number;
  vehicle_id: number;
  employee_id: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  start_mileage: number | null;
  end_mileage: number | null;
  status: RequestStatus;
  return_condition?: string;
  returned_at?: string;
  vehicles?: Vehicle;
  employees?: Employee;
}

export interface VehicleLog {
  id: number;
  vehicle_id: number;
  employee_id: string;
  log_type: 'refuel' | 'maintenance' | 'repair';
  cost: number;
  description: string;
  mileage_at_log: number;
  image_url?: string;
  created_at: string;
  employees?: Employee;
}

export interface ExpenseClaim {
  id: number;
  employee_id: string;
  claim_date: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  status: RequestStatus;
}

export interface Visitor {
  id: number;
  visit_date: string; // YYYY-MM-DD
  visit_time: string; // HH:mm:ss
  visitor_name: string;
  company_name: string | null;
  visitor_count: number;
  host_employee_id: string | null;
  purpose: string | null;
  status: 'expected' | 'arrived' | 'left' | 'cancelled'; // Added cancelled
  
  // New: Accommodation & Pickup
  needs_accommodation?: boolean;
  hotel_name?: string;
  accommodation_budget?: number;
  needs_pickup?: boolean;
  pickup_location?: string;
  
  // New: GA Mgmt
  booking_ref?: string;
  ga_notified?: boolean;
  
  created_at?: string;
  employees?: Employee; // Host info
}
