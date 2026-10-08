import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  TicketDetail,
  TicketListItem,
  TicketCreatePayload,
  TicketMetrics,
  TicketComment,
  TicketAttachment,
  TicketHistory,
  PaginatedResponse,
} from '../models/ticket.model';

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  // private readonly API_URL = 'http://127.0.0.1:8000/api/v1/tickets';

  private readonly API_URL = 'https://it-support-desk-api-1hj1.onrender.com/api/v1/tickets';

  constructor(private http: HttpClient) { }

  getTickets(filters?: {
    status?: string;
    priority?: string;
    category?: number;
    assigned_agent?: string;
    is_overdue?: boolean;
    search?: string;
    ordering?: string;
  }): Observable<TicketListItem[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.category) params = params.set('category', filters.category.toString());
    if (filters?.assigned_agent) params = params.set('assigned_agent', filters.assigned_agent);
    if (filters?.is_overdue !== undefined) params = params.set('is_overdue', filters.is_overdue.toString());
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.ordering) params = params.set('ordering', filters.ordering);

    return this.http
      .get<{ results: TicketListItem[] } | TicketListItem[]>(`${this.API_URL}/`, { params })
      .pipe(map((res) => (Array.isArray(res) ? res : res.results || [])));
  }

  getTicketsPaginated(filters?: {
    status?: string;
    priority?: string;
    category?: number;
    assigned_agent?: string;
    is_overdue?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  }): Observable<PaginatedResponse<TicketListItem>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.category) params = params.set('category', filters.category.toString());
    if (filters?.assigned_agent) params = params.set('assigned_agent', filters.assigned_agent);
    if (filters?.is_overdue !== undefined) params = params.set('is_overdue', filters.is_overdue.toString());
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.page_size) params = params.set('page_size', filters.page_size.toString());
    if (filters?.ordering) params = params.set('ordering', filters.ordering);

    return this.http.get<PaginatedResponse<TicketListItem>>(`${this.API_URL}/`, { params });
  }

  getAssignedToMe(page: number = 1, pageSize: number = 20): Observable<PaginatedResponse<TicketListItem>> {
    const params = new HttpParams().set('page', page.toString()).set('page_size', pageSize.toString());
    return this.http.get<PaginatedResponse<TicketListItem>>(`${this.API_URL}/assigned-to-me/`, { params });
  }

  getUnassigned(page: number = 1, pageSize: number = 20): Observable<PaginatedResponse<TicketListItem>> {
    const params = new HttpParams()
      .set('assigned_agent', 'unassigned')
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    return this.http.get<PaginatedResponse<TicketListItem>>(`${this.API_URL}/`, { params });
  }

  getTicketById(id: number): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${this.API_URL}/${id}/`);
  }

  createTicket(payload: TicketCreatePayload): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${this.API_URL}/`, payload);
  }

  updateTicket(ticketId: number, payload: Partial<TicketCreatePayload> | any): Observable<TicketDetail> {
    return this.http.patch<TicketDetail>(`${this.API_URL}/${ticketId}/`, payload);
  }

  changeStatus(ticketId: number, status: string, comment?: string): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${this.API_URL}/${ticketId}/status/`, {
      status,
      comment: comment || '',
    });
  }

  assignAgent(ticketId: number, agentId: number | null): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${this.API_URL}/${ticketId}/assign/`, {
      agent_id: agentId,
    });
  }

  addComment(ticketId: number, body: string, isInternal: boolean = false): Observable<TicketComment> {
    return this.http.post<TicketComment>(`${this.API_URL}/${ticketId}/comments/`, {
      body,
      is_internal: isInternal,
    });
  }

  uploadAttachment(ticketId: number, file: File): Observable<TicketAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TicketAttachment>(`${this.API_URL}/${ticketId}/attachments/`, formData);
  }

  downloadAttachment(ticketId: number, attachmentId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${ticketId}/attachments/${attachmentId}/download/`, {
      responseType: 'blob',
    });
  }

  getTicketHistory(ticketId: number): Observable<TicketHistory[]> {
    return this.http.get<TicketHistory[]>(`${this.API_URL}/${ticketId}/history/`);
  }

  getMetrics(): Observable<TicketMetrics> {
    return this.http.get<TicketMetrics>(`${this.API_URL}/metrics/`);
  }
}
