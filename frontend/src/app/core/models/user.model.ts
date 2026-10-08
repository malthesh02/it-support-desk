export type UserRole = 'EMPLOYEE' | 'SUPPORT_AGENT' | 'AGENT' | 'ADMIN';

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: Department | null;
  department_name?: string;
  phone_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
