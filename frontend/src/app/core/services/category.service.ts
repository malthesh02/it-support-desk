import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Category, SubCategory, SlaPolicy } from '../models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly API_URL = 'http://127.0.0.1:8000/api/v1';

  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<{ results: Category[] } | Category[]>(`${this.API_URL}/categories/`).pipe(
      map((res) => (Array.isArray(res) ? res : res.results || []))
    );
  }

  getSubCategories(categoryId?: number): Observable<SubCategory[]> {
    let params = new HttpParams();
    if (categoryId) {
      params = params.set('category', categoryId.toString());
    }
    return this.http.get<{ results: SubCategory[] } | SubCategory[]>(`${this.API_URL}/subcategories/`, { params }).pipe(
      map((res) => (Array.isArray(res) ? res : res.results || []))
    );
  }

  getSlaPolicies(): Observable<SlaPolicy[]> {
    return this.http.get<{ results: SlaPolicy[] } | SlaPolicy[]>(`${this.API_URL}/sla-policies/`).pipe(
      map((res) => (Array.isArray(res) ? res : res.results || []))
    );
  }
}
