export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubCategory {
  id: number;
  category: number;
  category_name?: string;
  name: string;
  default_priority: PriorityLevel;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  subcategories: SubCategory[];
  created_at: string;
  updated_at: string;
}

export interface SlaPolicy {
  id: number;
  name: string;
  priority: PriorityLevel;
  priority_display: string;
  response_time_minutes: number;
  resolution_time_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
