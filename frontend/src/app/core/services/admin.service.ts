import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserRole, Department } from '../models/user.model';
import { Category, SubCategory, SlaPolicy } from '../models/category.model';

export interface AuditLogItem {
  id: number;
  actor_name: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload_before?: any;
  payload_after?: any;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly API_BASE = 'https://it-support-desk-api-1hj1.onrender.com/api/v1';

  constructor(private http: HttpClient) { }

  // User Management
  getUsers(params?: { search?: string; role?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.role) httpParams = httpParams.set('role', params.role);
    return this.http.get<any>(`${this.API_BASE}/users/`, { params: httpParams });
  }

  updateUser(userId: number, data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.API_BASE}/users/${userId}/`, data);
  }

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.API_BASE}/departments/`);
  }

  // Categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.API_BASE}/categories/`);
  }

  createCategory(data: { name: string; description?: string }): Observable<Category> {
    return this.http.post<Category>(`${this.API_BASE}/categories/`, data);
  }

  createSubCategory(data: { category: number; name: string; default_priority: string }): Observable<SubCategory> {
    return this.http.post<SubCategory>(`${this.API_BASE}/subcategories/`, data);
  }

  // SLA Policies
  getSlaPolicies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(`${this.API_BASE}/sla-policies/`);
  }

  updateSlaPolicy(id: number, data: Partial<SlaPolicy>): Observable<SlaPolicy> {
    return this.http.patch<SlaPolicy>(`${this.API_BASE}/sla-policies/${id}/`, data);
  }

  // Audit Logs
  getAuditLogs(page: number = 1): Observable<any> {
    const params = new HttpParams().set('page', page.toString());
    return this.http.get<any>(`${this.API_BASE}/audit-logs/`, { params });
  }
}
