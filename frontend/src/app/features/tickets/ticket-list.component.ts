import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

import { TicketService } from '../../core/services/ticket.service';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { TicketListItem } from '../../core/models/ticket.model';
import { Category } from '../../core/models/category.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatCardModule,
    StatusBadgeComponent,
    PriorityBadgeComponent,
  ],
  template: `
    <div class="tickets-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ isMyTickets ? 'My Support Tickets' : 'Support Tickets' }}</h1>
          <p class="page-subtitle">
            {{ isMyTickets ? 'View and track tickets submitted by you' : 'Track, filter, and manage IT support requests' }}
          </p>
        </div>
        <a mat-raised-button color="primary" routerLink="/tickets/new">
          <mat-icon>add</mat-icon> New Ticket
        </a>
      </div>

      <!-- Filter Controls Bar -->
      <mat-card class="filter-card">
        <div class="filter-grid">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Tickets</mat-label>
            <input matInput [(ngModel)]="searchQuery" (keyup.enter)="applyFilters()" placeholder="Title, ticket #..." />
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="selectedStatus" (selectionChange)="applyFilters()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="OPEN">Open</mat-option>
              <mat-option value="ASSIGNED">Assigned</mat-option>
              <mat-option value="IN_PROGRESS">In Progress</mat-option>
              <mat-option value="WAITING_FOR_USER">Waiting for User</mat-option>
              <mat-option value="RESOLVED">Resolved</mat-option>
              <mat-option value="CLOSED">Closed</mat-option>
              <mat-option value="REOPENED">Reopened</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="selectedPriority" (selectionChange)="applyFilters()">
              <mat-option value="">All Priorities</mat-option>
              <mat-option value="CRITICAL">Critical</mat-option>
              <mat-option value="HIGH">High</mat-option>
              <mat-option value="MEDIUM">Medium</mat-option>
              <mat-option value="LOW">Low</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select" *ngIf="categories().length > 0">
            <mat-label>Category</mat-label>
            <mat-select [(ngModel)]="selectedCategory" (selectionChange)="applyFilters()">
              <mat-option [value]="null">All Categories</mat-option>
              <mat-option *ngFor="let cat of categories()" [value]="cat.id">
                {{ cat.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <div class="checkbox-box">
            <mat-checkbox [(ngModel)]="onlyOverdue" (change)="applyFilters()">
              Overdue / SLA Breached
            </mat-checkbox>
          </div>

          <div class="filter-actions">
            <button mat-flat-button color="primary" (click)="applyFilters()">
              Filter
            </button>
            <button mat-button (click)="resetFilters()">
              Reset
            </button>
          </div>
        </div>
      </mat-card>

      <!-- Tickets Table -->
      <mat-card class="table-card">
        <div *ngIf="isLoading()" class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <table mat-table [dataSource]="tickets()" *ngIf="!isLoading()" class="tickets-table">
          <!-- Ticket Number -->
          <ng-container matColumnDef="ticket_number">
            <th mat-header-cell *matHeaderCellDef>Ticket #</th>
            <td mat-cell *matCellDef="let t">
              <a [routerLink]="['/tickets', t.id]" class="ticket-link">
                {{ t.ticket_number }}
              </a>
            </td>
          </ng-container>

          <!-- Title -->
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Subject</th>
            <td mat-cell *matCellDef="let t" class="subject-cell">
              <span class="ticket-title">{{ t.title }}</span>
              <span class="sub-meta" *ngIf="t.subcategory_name"> > {{ t.subcategory_name }}</span>
            </td>
          </ng-container>

          <!-- Category -->
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category</th>
            <td mat-cell *matCellDef="let t">
              {{ t.category_name }}
            </td>
          </ng-container>

          <!-- Requester -->
          <ng-container matColumnDef="requester" *ngIf="!isMyTickets">
            <th mat-header-cell *matHeaderCellDef>Requester</th>
            <td mat-cell *matCellDef="let t">
              {{ t.requester_name }}
            </td>
          </ng-container>

          <!-- Assigned Agent -->
          <ng-container matColumnDef="assigned_agent">
            <th mat-header-cell *matHeaderCellDef>Agent</th>
            <td mat-cell *matCellDef="let t">
              <span *ngIf="t.assigned_agent_name" class="agent-name">{{ t.assigned_agent_name }}</span>
              <span *ngIf="!t.assigned_agent_name" class="unassigned-text">Unassigned</span>
            </td>
          </ng-container>

          <!-- Status -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let t">
              <app-status-badge [status]="t.status"></app-status-badge>
            </td>
          </ng-container>

          <!-- Priority -->
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let t">
              <app-priority-badge [priority]="t.priority"></app-priority-badge>
            </td>
          </ng-container>

          <!-- SLA Health -->
          <ng-container matColumnDef="sla">
            <th mat-header-cell *matHeaderCellDef>SLA</th>
            <td mat-cell *matCellDef="let t">
              <span *ngIf="t.is_sla_breached || t.is_overdue" class="sla-breached-tag">
                <mat-icon inline>error</mat-icon> Breached
              </span>
              <span *ngIf="!t.is_sla_breached && !t.is_overdue && t.status !== 'CLOSED' && t.status !== 'RESOLVED'" class="sla-ok-tag">
                <mat-icon inline>schedule</mat-icon> On Track
              </span>
              <span *ngIf="t.status === 'CLOSED' || t.status === 'RESOLVED'" class="sla-done-tag">
                <mat-icon inline>done</mat-icon> Done
              </span>
            </td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let t">
              <a mat-icon-button color="primary" [routerLink]="['/tickets', t.id]" title="View Details">
                <mat-icon>visibility</mat-icon>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        <div *ngIf="!isLoading() && tickets().length === 0" class="no-tickets">
          <mat-icon class="large-empty-icon">inbox</mat-icon>
          <p>No tickets found matching the specified filters.</p>
        </div>

        <!-- Mat Paginator for Backend Pagination -->
        <mat-paginator
          [length]="totalCount()"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
          showFirstLastButtons
        >
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .tickets-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
    .filter-card {
      margin-bottom: 20px;
      padding: 16px 20px;
      border-radius: 12px;
    }
    .filter-grid {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .search-field {
      flex: 1 1 240px;
    }
    .filter-select {
      flex: 1 1 140px;
    }
    .checkbox-box {
      display: flex;
      align-items: center;
      padding-top: 4px;
    }
    .filter-actions {
      display: flex;
      gap: 8px;
    }
    .table-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .tickets-table {
      width: 100%;
    }
    .ticket-link {
      font-weight: 600;
      color: #2563eb;
      text-decoration: none;
    }
    .ticket-link:hover {
      text-decoration: underline;
    }
    .ticket-title {
      font-weight: 600;
      color: #1e293b;
    }
    .sub-meta {
      font-size: 12px;
      color: #64748b;
    }
    .agent-name {
      font-size: 13px;
      color: #334155;
    }
    .unassigned-text {
      color: #94a3b8;
      font-style: italic;
      font-size: 13px;
    }
    .sla-breached-tag {
      color: #dc2626;
      font-weight: 600;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sla-ok-tag {
      color: #2563eb;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sla-done-tag {
      color: #16a34a;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .loading-state, .no-tickets {
      text-align: center;
      padding: 48px 16px;
      color: #94a3b8;
    }
    .large-empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
  `],
})
export class TicketListComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly categoryService = inject(CategoryService);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  readonly tickets = signal<TicketListItem[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly totalCount = signal<number>(0);

  isMyTickets = false;
  searchQuery = '';
  selectedStatus = '';
  selectedPriority = '';
  selectedCategory: number | null = null;
  onlyOverdue = false;

  pageSize = 10;
  pageIndex = 0;

  get columns(): string[] {
    const cols = ['ticket_number', 'title', 'category'];
    if (!this.isMyTickets) {
      cols.push('requester');
    }
    cols.push('assigned_agent', 'status', 'priority', 'sla', 'actions');
    return cols;
  }

  ngOnInit(): void {
    // Check if route has data: { isMyTickets: true }
    this.isMyTickets = this.route.snapshot.data['isMyTickets'] || false;

    // Read query params (e.g. from Dashboard cards)
    this.route.queryParams.subscribe((params) => {
      if (params['status']) this.selectedStatus = params['status'];
      if (params['priority']) this.selectedPriority = params['priority'];
      if (params['overdue'] === 'true') this.onlyOverdue = true;
      this.loadTickets();
    });

    this.categoryService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadTickets(): void {
    this.isLoading.set(true);

    this.ticketService
      .getTicketsPaginated({
        status: this.selectedStatus || undefined,
        priority: this.selectedPriority || undefined,
        category: this.selectedCategory ?? undefined,
        is_overdue: this.onlyOverdue ? true : undefined,
        search: this.searchQuery || undefined,
        page: this.pageIndex + 1,
        page_size: this.pageSize,
      })
      .subscribe({
        next: (response) => {
          this.tickets.set(response.results || []);
          this.totalCount.set(response.count || 0);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTickets();
  }

  applyFilters(): void {
    this.pageIndex = 0;
    this.loadTickets();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedPriority = '';
    this.selectedCategory = null;
    this.onlyOverdue = false;
    this.pageIndex = 0;
    this.loadTickets();
  }
}

