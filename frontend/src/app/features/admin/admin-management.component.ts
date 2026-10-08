import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { AdminService, AuditLogItem } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { User, UserRole } from '../../core/models/user.model';
import { Category, SubCategory, SlaPolicy } from '../../core/models/category.model';

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="admin-page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">IT Service Desk Administration</h1>
          <p class="page-subtitle">Configure system users, categories, SLA policies, and audit governance</p>
        </div>
      </div>

      <mat-card class="admin-card">
        <mat-tab-group (selectedTabChange)="onTabChange($event.index)">
          <!-- TAB 1: USERS MANAGEMENT -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">people</mat-icon>
              <span>User Accounts ({{ usersList().length }})</span>
            </ng-template>

            <div class="tab-content">
              <div class="tab-filter-bar">
                <mat-form-field appearance="outline" class="search-input">
                  <mat-label>Search Users</mat-label>
                  <input matInput [(ngModel)]="userSearch" (keyup.enter)="loadUsers()" placeholder="Username or email..." />
                  <mat-icon matPrefix>search</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Role Filter</mat-label>
                  <mat-select [(ngModel)]="roleFilter" (selectionChange)="loadUsers()">
                    <mat-option value="">All Roles</mat-option>
                    <mat-option value="EMPLOYEE">Employee</mat-option>
                    <mat-option value="SUPPORT_AGENT">Support Agent</mat-option>
                    <mat-option value="ADMIN">Administrator</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div *ngIf="isLoadingUsers()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="usersList()" *ngIf="!isLoadingUsers()" class="admin-table">
                <!-- Username -->
                <ng-container matColumnDef="username">
                  <th mat-header-cell *matHeaderCellDef>Username</th>
                  <td mat-cell *matCellDef="let u"><strong>{{ u.username }}</strong></td>
                </ng-container>

                <!-- Full Name -->
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Full Name</th>
                  <td mat-cell *matCellDef="let u">{{ u.first_name }} {{ u.last_name }}</td>
                </ng-container>

                <!-- Email -->
                <ng-container matColumnDef="email">
                  <th mat-header-cell *matHeaderCellDef>Email</th>
                  <td mat-cell *matCellDef="let u">{{ u.email }}</td>
                </ng-container>

                <!-- Role -->
                <ng-container matColumnDef="role">
                  <th mat-header-cell *matHeaderCellDef>Role</th>
                  <td mat-cell *matCellDef="let u">
                    <mat-select [value]="u.role" (selectionChange)="updateUserRole(u.id, $event.value)" class="role-select">
                      <mat-option value="EMPLOYEE">EMPLOYEE</mat-option>
                      <mat-option value="SUPPORT_AGENT">SUPPORT_AGENT</mat-option>
                      <mat-option value="ADMIN">ADMIN</mat-option>
                    </mat-select>
                  </td>
                </ng-container>

                <!-- Active -->
                <ng-container matColumnDef="active">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let u">
                    <mat-slide-toggle [checked]="u.is_active" (change)="toggleUserActive(u.id, $event.checked)">
                      {{ u.is_active ? 'Active' : 'Inactive' }}
                    </mat-slide-toggle>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: userColumns"></tr>
              </table>
            </div>
          </mat-tab>

          <!-- TAB 2: CATEGORIES & SUBCATEGORIES -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">category</mat-icon>
              <span>Categories & Subcategories</span>
            </ng-template>

            <div class="tab-content">
              <!-- Add Category Section -->
              <div class="new-category-box">
                <form [formGroup]="categoryForm" (ngSubmit)="addCategory()" class="add-cat-form">
                  <mat-form-field appearance="outline" class="flex-1">
                    <mat-label>Category Name</mat-label>
                    <input matInput formControlName="name" placeholder="e.g., Software, Hardware, Network" required />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="flex-2">
                    <mat-label>Description</mat-label>
                    <input matInput formControlName="description" placeholder="Brief scope..." />
                  </mat-form-field>
                  <button mat-raised-button color="primary" type="submit" [disabled]="categoryForm.invalid">
                    <mat-icon>add</mat-icon> Add Category
                  </button>
                </form>
              </div>

              <div *ngIf="isLoadingCategories()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <div class="categories-list" *ngIf="!isLoadingCategories()">
                <mat-card *ngFor="let cat of categoriesList()" class="category-item-card">
                  <div class="cat-header">
                    <div>
                      <h3 class="cat-title">{{ cat.name }}</h3>
                      <p class="cat-desc">{{ cat.description || 'No description provided' }}</p>
                    </div>
                  </div>

                  <div class="subcategories-section">
                    <span class="sub-heading">Subcategories:</span>
                    <div class="sub-chips">
                      <span *ngFor="let sub of cat.subcategories" class="sub-chip">
                        {{ sub.name }} <span class="priority-tag">{{ sub.default_priority }}</span>
                      </span>
                      <span *ngIf="!cat.subcategories || cat.subcategories.length === 0" class="empty-subs">
                        None configured
                      </span>
                    </div>
                  </div>
                </mat-card>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: SLA POLICIES -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">timelapse</mat-icon>
              <span>SLA Policies</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="isLoadingSla()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="slaPolicies()" *ngIf="!isLoadingSla()" class="admin-table">
                <!-- Priority -->
                <ng-container matColumnDef="priority">
                  <th mat-header-cell *matHeaderCellDef>Priority</th>
                  <td mat-cell *matCellDef="let sla">
                    <strong>{{ sla.priority }}</strong>
                  </td>
                </ng-container>

                <!-- Policy Name -->
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Policy Name</th>
                  <td mat-cell *matCellDef="let sla">{{ sla.name }}</td>
                </ng-container>

                <!-- Response Time -->
                <ng-container matColumnDef="response_time">
                  <th mat-header-cell *matHeaderCellDef>Response Target</th>
                  <td mat-cell *matCellDef="let sla">
                    <input
                      matInput
                      type="number"
                      [value]="sla.response_time_minutes"
                      (change)="updateSlaTarget(sla, 'response_time_minutes', $event)"
                      class="num-input"
                    />
                    mins ({{ (sla.response_time_minutes / 60).toFixed(1) }}h)
                  </td>
                </ng-container>

                <!-- Resolution Time -->
                <ng-container matColumnDef="resolution_time">
                  <th mat-header-cell *matHeaderCellDef>Resolution Target</th>
                  <td mat-cell *matCellDef="let sla">
                    <input
                      matInput
                      type="number"
                      [value]="sla.resolution_time_minutes"
                      (change)="updateSlaTarget(sla, 'resolution_time_minutes', $event)"
                      class="num-input"
                    />
                    mins ({{ (sla.resolution_time_minutes / 60).toFixed(1) }}h)
                  </td>
                </ng-container>

                <!-- Active -->
                <ng-container matColumnDef="active">
                  <th mat-header-cell *matHeaderCellDef>Active</th>
                  <td mat-cell *matCellDef="let sla">
                    <mat-slide-toggle [checked]="sla.is_active" (change)="toggleSlaActive(sla.id, $event.checked)">
                      {{ sla.is_active ? 'Active' : 'Disabled' }}
                    </mat-slide-toggle>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="slaColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: slaColumns"></tr>
              </table>
            </div>
          </mat-tab>

          <!-- TAB 4: SYSTEM AUDIT LOGS -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">security</mat-icon>
              <span>Security & Audit Logs</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="isLoadingAudit()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="auditLogs()" *ngIf="!isLoadingAudit()" class="admin-table">
                <!-- Timestamp -->
                <ng-container matColumnDef="created_at">
                  <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                  <td mat-cell *matCellDef="let a">{{ a.created_at | date:'medium' }}</td>
                </ng-container>

                <!-- Actor -->
                <ng-container matColumnDef="actor">
                  <th mat-header-cell *matHeaderCellDef>Actor</th>
                  <td mat-cell *matCellDef="let a">
                    <strong>{{ a.actor_name || a.actor_email }}</strong>
                  </td>
                </ng-container>

                <!-- Action -->
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef>Action</th>
                  <td mat-cell *matCellDef="let a">
                    <span class="audit-action-tag">{{ a.action }}</span>
                  </td>
                </ng-container>

                <!-- Resource -->
                <ng-container matColumnDef="resource">
                  <th mat-header-cell *matHeaderCellDef>Resource</th>
                  <td mat-cell *matCellDef="let a">{{ a.resource_type }} #{{ a.resource_id }}</td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="auditColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: auditColumns"></tr>
              </table>

              <div *ngIf="!isLoadingAudit() && auditLogs().length === 0" class="empty-box">
                No audit entries recorded yet.
              </div>

              <mat-paginator
                [length]="auditTotal()"
                [pageSize]="15"
                [pageIndex]="auditPage - 1"
                [pageSizeOptions]="[15, 30, 50]"
                (page)="onAuditPageChange($event)"
                showFirstLastButtons
              >
              </mat-paginator>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .admin-page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .page-header {
      margin-bottom: 20px;
    }
    .page-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }
    .page-subtitle {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }
    .admin-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .tab-icon {
      margin-right: 6px;
      font-size: 18px;
      height: 18px;
      width: 18px;
    }
    .tab-content {
      padding: 20px 0;
    }
    .tab-filter-bar {
      display: flex;
      gap: 16px;
      padding: 0 16px 12px 16px;
    }
    .search-input {
      flex: 1 1 300px;
    }
    .admin-table {
      width: 100%;
    }
    .role-select {
      font-weight: 600;
      width: 150px;
    }
    .new-category-box {
      padding: 0 16px 20px 16px;
    }
    .add-cat-form {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .categories-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
      padding: 0 16px;
    }
    .category-item-card {
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .cat-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
    .cat-desc {
      margin: 4px 0 12px 0;
      font-size: 13px;
      color: #64748b;
    }
    .subcategories-section {
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    .sub-heading {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      display: block;
      margin-bottom: 6px;
    }
    .sub-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sub-chip {
      background: #f1f5f9;
      color: #334155;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .priority-tag {
      font-size: 10px;
      font-weight: 700;
      color: #2563eb;
    }
    .empty-subs {
      color: #94a3b8;
      font-size: 12px;
      font-style: italic;
    }
    .num-input {
      width: 70px;
      display: inline-block;
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      margin-right: 6px;
      font-weight: 600;
    }
    .audit-action-tag {
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .loading-box, .empty-box {
      text-align: center;
      padding: 32px;
      color: #94a3b8;
    }
  `],
})
export class AdminManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  // Users Tab
  readonly usersList = signal<User[]>([]);
  readonly isLoadingUsers = signal<boolean>(true);
  userSearch = '';
  roleFilter = '';
  readonly userColumns = ['username', 'name', 'email', 'role', 'active'];

  // Categories Tab
  readonly categoriesList = signal<Category[]>([]);
  readonly isLoadingCategories = signal<boolean>(true);
  readonly categoryForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  // SLA Tab
  readonly slaPolicies = signal<SlaPolicy[]>([]);
  readonly isLoadingSla = signal<boolean>(true);
  readonly slaColumns = ['priority', 'name', 'response_time', 'resolution_time', 'active'];

  // Audit Tab
  readonly auditLogs = signal<AuditLogItem[]>([]);
  readonly auditTotal = signal<number>(0);
  readonly isLoadingAudit = signal<boolean>(true);
  auditPage = 1;
  readonly auditColumns = ['created_at', 'actor', 'action', 'resource'];

  ngOnInit(): void {
    this.loadUsers();
  }

  onTabChange(index: number): void {
    if (index === 0) this.loadUsers();
    else if (index === 1) this.loadCategories();
    else if (index === 2) this.loadSlaPolicies();
    else if (index === 3) this.loadAuditLogs();
  }

  loadUsers(): void {
    this.isLoadingUsers.set(true);
    this.adminService
      .getUsers({
        search: this.userSearch || undefined,
        role: this.roleFilter || undefined,
      })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res) ? res : res.results || [];
          this.usersList.set(list);
          this.isLoadingUsers.set(false);
        },
        error: () => {
          this.isLoadingUsers.set(false);
        },
      });
  }

  updateUserRole(userId: number, role: UserRole): void {
    this.adminService.updateUser(userId, { role }).subscribe({
      next: () => {
        this.notify.success('User role updated successfully.');
        this.loadUsers();
      },
      error: () => {
        this.notify.error('Failed to update user role.');
      },
    });
  }

  toggleUserActive(userId: number, isActive: boolean): void {
    this.adminService.updateUser(userId, { is_active: isActive }).subscribe({
      next: () => {
        this.notify.success(`User ${isActive ? 'activated' : 'deactivated'}.`);
        this.loadUsers();
      },
      error: () => {
        this.notify.error('Failed to update user status.');
      },
    });
  }

  loadCategories(): void {
    this.isLoadingCategories.set(true);
    this.adminService.getCategories().subscribe({
      next: (cats) => {
        this.categoriesList.set(cats);
        this.isLoadingCategories.set(false);
      },
      error: () => {
        this.isLoadingCategories.set(false);
      },
    });
  }

  addCategory(): void {
    if (this.categoryForm.invalid) return;
    this.adminService.createCategory(this.categoryForm.value).subscribe({
      next: () => {
        this.notify.success('Category created.');
        this.categoryForm.reset();
        this.loadCategories();
      },
      error: () => {
        this.notify.error('Failed to create category.');
      },
    });
  }

  loadSlaPolicies(): void {
    this.isLoadingSla.set(true);
    this.adminService.getSlaPolicies().subscribe({
      next: (policies) => {
        this.slaPolicies.set(policies);
        this.isLoadingSla.set(false);
      },
      error: () => {
        this.isLoadingSla.set(false);
      },
    });
  }

  updateSlaTarget(sla: SlaPolicy, field: 'response_time_minutes' | 'resolution_time_minutes', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!value || value <= 0) return;

    this.adminService.updateSlaPolicy(sla.id, { [field]: value }).subscribe({
      next: () => {
        this.notify.success('SLA target updated.');
        this.loadSlaPolicies();
      },
      error: () => {
        this.notify.error('Failed to update SLA target.');
      },
    });
  }

  toggleSlaActive(slaId: number, isActive: boolean): void {
    this.adminService.updateSlaPolicy(slaId, { is_active: isActive }).subscribe({
      next: () => {
        this.notify.success(`SLA policy ${isActive ? 'enabled' : 'disabled'}.`);
        this.loadSlaPolicies();
      },
      error: () => {
        this.notify.error('Failed to update SLA policy.');
      },
    });
  }

  loadAuditLogs(): void {
    this.isLoadingAudit.set(true);
    this.adminService.getAuditLogs(this.auditPage).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res.results || [];
        this.auditLogs.set(list);
        this.auditTotal.set(res.count || list.length);
        this.isLoadingAudit.set(false);
      },
      error: () => {
        this.isLoadingAudit.set(false);
      },
    });
  }

  onAuditPageChange(event: PageEvent): void {
    this.auditPage = event.pageIndex + 1;
    this.loadAuditLogs();
  }
}
