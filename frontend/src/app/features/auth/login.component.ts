import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header class="login-header">
          <div class="logo-box">
            <mat-icon class="large-icon">support_agent</mat-icon>
          </div>
          <mat-card-title>IT Service Desk</mat-card-title>
          <mat-card-subtitle>Sign in to manage IT tickets and requests</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="error-banner" *ngIf="errorMessage()">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" placeholder="e.g. admin, agent_john" required />
              <mat-icon matPrefix>person</mat-icon>
              <mat-error *ngIf="loginForm.get('username')?.hasError('required')">
                Username is required
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword() ? 'password' : 'text'"
                formControlName="password"
                required
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword.set(!hidePassword())"
                [attr.aria-label]="'Hide password'"
              >
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                Password is required
              </mat-error>
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="login-button"
              [disabled]="loginForm.invalid || isLoading()"
            >
              <mat-spinner diameter="20" *ngIf="isLoading()"></mat-spinner>
              <span *ngIf="!isLoading()">Sign In</span>
            </button>
          </form>

          <!-- Quick Login Persona Fill Buttons for Testing -->
          <div class="quick-credentials">
            <p class="quick-title">Quick Test Personas:</p>
            <div class="persona-buttons">
              <button mat-stroked-button type="button" (click)="fillCredentials('admin', 'AdminPassword123!')">
                Admin
              </button>
              <button mat-stroked-button type="button" (click)="fillCredentials('agent_john', 'AgentPassword123!')">
                Agent
              </button>
              <button mat-stroked-button type="button" (click)="fillCredentials('emp_alice', 'UserPassword123!')">
                Employee
              </button>
            </div>
          </div>

          <div class="footer-links">
            <span>Don't have an account?</span>
            <a routerLink="/auth/register" class="link">Register here</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #f1f5f9;
      padding: 24px 16px;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 36px 32px;
      border-radius: 16px;
      background-color: #ffffff !important;
      color: #1e293b !important;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    .login-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
    }
    .login-header mat-card-title {
      color: #0f172a !important;
      font-size: 24px !important;
      font-weight: 700 !important;
      margin-bottom: 6px;
    }
    .login-header mat-card-subtitle {
      color: #475569 !important;
      font-size: 14px !important;
      font-weight: 400;
    }
    .logo-box {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.15);
    }
    .large-icon {
      font-size: 36px;
      height: 36px;
      width: 36px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .full-width mat-icon {
      color: #64748b;
    }
    .login-button {
      width: 100%;
      height: 48px;
      font-size: 15px;
      font-weight: 600;
      margin-top: 14px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      background-color: #2563eb !important;
      color: #ffffff !important;
      border-radius: 8px;
    }
    .login-button:hover:not(:disabled) {
      background-color: #1d4ed8 !important;
    }
    .login-button:disabled {
      background-color: #94a3b8 !important;
      color: #f1f5f9 !important;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: #fee2e2;
      color: #991b1b;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .quick-credentials {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
    }
    .quick-title {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 10px;
      text-align: center;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .persona-buttons {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .persona-buttons button {
      flex: 1;
      border: 1px solid #cbd5e1 !important;
      background-color: #f8fafc !important;
      color: #1e293b !important;
      font-weight: 600;
      font-size: 13px;
      border-radius: 8px;
      padding: 0 8px;
    }
    .persona-buttons button:hover {
      background-color: #e2e8f0 !important;
      color: #0f172a !important;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 20px;
      font-size: 14px;
      color: #64748b;
    }
    .link {
      color: #2563eb;
      font-weight: 600;
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly hidePassword = signal<boolean>(true);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  fillCredentials(user: string, pass: string): void {
    this.loginForm.patchValue({
      username: user,
      password: pass,
    });
    this.errorMessage.set(null);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.errorMessage.set('Invalid username or password.');
        } else {
          this.errorMessage.set('Failed to sign in. Please verify your connection.');
        }
      },
    });
  }
}
