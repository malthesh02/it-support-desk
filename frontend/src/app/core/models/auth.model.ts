import { UserRole } from './user.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department?: string | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUserInfo;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  department_id?: number | null;
}

