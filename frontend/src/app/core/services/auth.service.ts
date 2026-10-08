import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthUserInfo, LoginRequest, LoginResponse, RegisterRequest, TokenRefreshResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // private readonly API_URL = 'http://127.0.0.1:8000/api/v1/auth';


  private readonly API_URL = 'https://it-support-desk-api-1hj1.onrender.com/api/v1/auth';


  private readonly ACCESS_TOKEN_KEY = 'it_desk_access_token';
  private readonly REFRESH_TOKEN_KEY = 'it_desk_refresh_token';
  private readonly USER_KEY = 'it_desk_user';

  // Reactive State Signals
  readonly currentUser = signal<AuthUserInfo | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  readonly isAgent = computed(
    () =>
      this.currentUser()?.role === 'SUPPORT_AGENT' ||
      this.currentUser()?.role === 'AGENT' ||
      this.currentUser()?.role === 'ADMIN'
  );
  readonly isEmployee = computed(() => this.currentUser()?.role === 'EMPLOYEE');

  constructor(private http: HttpClient, private router: Router) { }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login/`, credentials).pipe(
      tap((response) => {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, response.access);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refresh);
        localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
        this.currentUser.set(response.user);
      })
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/register/`, data).pipe(
      tap((response) => {
        const access = response.access || response.tokens?.access;
        const refresh = response.refresh || response.tokens?.refresh;
        const user = response.user;
        if (access && user) {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, access);
          if (refresh) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, refresh);
          }
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
          this.currentUser.set(user);
        }
      })
    );
  }

  refreshToken(): Observable<TokenRefreshResponse> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<TokenRefreshResponse>(`${this.API_URL}/token/refresh/`, { refresh }).pipe(
      tap((response) => {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, response.access);
        if (response.refresh) {
          localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refresh);
        }
      }),
      catchError((error) => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    const refresh = this.getRefreshToken();
    if (refresh) {
      this.http.post(`${this.API_URL}/logout/`, { refresh }).subscribe({
        next: () => { },
        error: () => { },
      });
    }

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private getStoredUser(): AuthUserInfo | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
