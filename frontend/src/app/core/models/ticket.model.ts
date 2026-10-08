import { PriorityLevel, Category, SubCategory, SlaPolicy } from './category.model';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_USER'
  | 'PENDING_USER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TicketAttachment {
  id: number;
  ticket: number;
  comment?: number | null;
  uploaded_by: number;
  uploaded_by_name: string;
  file: string;
  file_name: string;
  file_size: number;
  content_type: string;
  download_url?: string;
  created_at: string;
}

export interface TicketComment {
  id: number;
  ticket: number;
  author: number;
  author_username: string;
  author_name: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketHistory {
  id: number;
  ticket: number;
  changed_by?: number | null;
  changed_by_name: string;
  field_name: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface TicketListItem {
  id: number;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  priority: PriorityLevel;
  category: number;
  category_name: string;
  subcategory?: number | null;
  subcategory_name?: string | null;
  requester: number;
  requester_name: string;
  assigned_agent?: number | null;
  assigned_agent_name?: string | null;
  is_sla_breached: boolean;
  is_overdue?: boolean;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketDetail {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: PriorityLevel;
  category: Category;
  subcategory?: SubCategory | null;
  requester: number;
  requester_name: string;
  requester_email: string;
  assigned_agent?: number | null;
  assigned_agent_name?: string | null;
  sla_policy?: SlaPolicy | null;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  first_responded_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  is_sla_breached: boolean;
  is_overdue?: boolean;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  history_records: TicketHistory[];
  created_at: string;
  updated_at: string;
}

export interface TicketCreatePayload {
  title: string;
  description: string;
  category_id: number;
  subcategory_id?: number | null;
  priority: PriorityLevel;
}

export interface TicketMetrics {
  total: number;
  open: number;
  assigned: number;
  in_progress: number;
  waiting_for_user: number;
  pending_user?: number;
  resolved: number;
  closed: number;
  reopened: number;
  high_critical?: number;
  sla_breached: number;
  overdue?: number;
}

