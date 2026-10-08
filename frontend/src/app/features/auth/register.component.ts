import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Department } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
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
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="register-wrapper">
      <mat-card class="register-card">
        <mat-card-header class="register-header">
          <div class="logo-box">
            <mat-icon class="large-icon">person_add</mat-icon>
          </div>
          <mat-card-title>Create an Account</mat-card-title>
          <mat-card-subtitle>Join the IT Service Desk to submit & track requests</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="error-banner" *ngIf="errorMessage()">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="first_name" placeholder="John" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="last_name" placeholder="Doe" />
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" placeholder="johndoe" required />
              <mat-icon matPrefix>person</mat-icon>
              <mat-error *ngIf="registerForm.get('username')?.hasError('required')">Username is required</mat-error>
              <mat-error *ngIf="registerForm.get('username')?.hasError('minlength')">Minimum 3 characters required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="john@example.com" required />
              <mat-icon matPrefix>email</mat-icon>
              <mat-error *ngIf="registerForm.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="registerForm.get('email')?.hasError('email')">Invalid email format</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="departments().length > 0">
              <mat-label>Department</mat-label>
              <mat-select formControlName="department_id">
                <mat-option [value]="null">-- Select Department (Optional) --</mat-option>
                <mat-option *ngFor="let dept of departments()" [value]="dept.id">
                  {{ dept.name }} ({{ dept.code }})
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" required />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword.set(!hidePassword())"
              >
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="registerForm.get('password')?.hasError('required')">Password is required</mat-error>
              <mat-error *ngIf="registerForm.get('password')?.hasError('minlength')">Minimum 8 characters required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm Password</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password_confirm" required />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <mat-error *ngIf="registerForm.hasError('passwordMismatch')">Passwords do not match</mat-error>
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="submit-button"
              [disabled]="registerForm.invalid || isLoading()"
            >
              <mat-spinner diameter="20" *ngIf="isLoading()"></mat-spinner>
              <span *ngIf="!isLoading()">Register Account</span>
            </button>
          </form>

          <div class="footer-links">
            <span>Already have an account?</span>
            <a routerLink="/auth/login" class="link">Sign In</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .register-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 32px 16px;
      background: #f1f5f9;
    }
    .register-card {
      width: 100%;
      max-width: 520px;
      border-radius: 16px;
      background-color: #ffffff !important;
      color: #1e293b !important;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      padding: 32px 28px;
    }
    .register-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
    }
    .register-header mat-card-title {
      color: #0f172a !important;
      font-size: 24px !important;
      font-weight: 700 !important;
      margin-bottom: 6px;
    }
    .register-header mat-card-subtitle {
      color: #475569 !important;
      font-size: 14px !important;
    }
    .logo-box {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .large-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .form-row {
      display: flex;
      gap: 12px;
    }
    .half-width {
      flex: 1;
    }
    .full-width {
      width: 100%;
      margin-bottom: 4px;
    }
    .submit-button {
      width: 100%;
      height: 48px;
      font-size: 15px;
      font-weight: 600;
      margin-top: 12px;
      border-radius: 8px;
      background-color: #2563eb !important;
      color: #ffffff !important;
    }
    .submit-button:hover:not(:disabled) {
      background-color: #1d4ed8 !important;
    }
    .submit-button:disabled {
      background-color: #94a3b8 !important;
      color: #f1f5f9 !important;
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
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly hidePassword = signal(true);
  readonly departments = signal<Department[]>([]);

  registerForm: FormGroup = this.fb.group(
    {
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      first_name: [''],
      last_name: [''],
      department_id: [null],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirm: ['', Validators.required],
    },
    { validators: this.passwordMatchValidator }
  );

  ngOnInit(): void {
    this.http.get<any>('http://127.0.0.1:8000/api/v1/departments/').subscribe({
      next: (depts) => {
        const list = Array.isArray(depts) ? depts : depts?.results || [];
        this.departments.set(list);
      },
      error: (err) => {
        console.warn('Could not load departments:', err);
      },
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('password_confirm')?.value
      ? null
      : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const formValue = this.registerForm.value;
    this.authService.register(formValue).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.notify.success('Account registered successfully! Welcome aboard.');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        let detail = 'Registration failed. Please check inputs.';
        const errObj = err.error;
        if (errObj?.error?.details) {
          const details = errObj.error.details;
          const firstKey = Object.keys(details)[0];
          const firstVal = details[firstKey];
          detail = Array.isArray(firstVal) ? firstVal[0] : String(firstVal);
        } else if (errObj?.error?.message) {
          detail = errObj.error.message;
        } else if (errObj?.detail) {
          detail = errObj.detail;
        } else if (errObj?.username) {
          detail = Array.isArray(errObj.username) ? errObj.username[0] : errObj.username;
        } else if (errObj?.email) {
          detail = Array.isArray(errObj.email) ? errObj.email[0] : errObj.email;
        }
        this.errorMessage.set(detail);
        this.notify.error(detail);
      },
    });
  }
}
