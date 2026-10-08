import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { TicketListItem } from '../../core/models/ticket.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge.component';

@Component({
  selector: 'app-agent-tickets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatTabsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    StatusBadgeComponent,
    PriorityBadgeComponent,
  ],
  template: `
    <div class="agent-page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Agent Workbench & Queue</h1>
          <p class="page-subtitle">Manage assigned incident workload and claim incoming unassigned tickets</p>
        </div>
        <div class="header-stats" *ngIf="authService.currentUser() as user">
          <span class="agent-badge">
            <mat-icon>support_agent</mat-icon>
            {{ user.first_name || user.username }} (Agent)
          </span>
        </div>
      </div>

      <mat-card class="workbench-card">
        <mat-tab-group (selectedTabChange)="onTabChange($event.index)">
          <!-- Tab 1: Assigned to Me -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">assignment_ind</mat-icon>
              <span>Assigned to Me ({{ assignedTotal() }})</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="isLoadingAssigned()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="assignedTickets()" *ngIf="!isLoadingAssigned()" class="workbench-table">
                <!-- Ticket # -->
                <ng-container matColumnDef="ticket_number">
                  <th mat-header-cell *matHeaderCellDef>Ticket #</th>
                  <td mat-cell *matCellDef="let t">
                    <a [routerLink]="['/tickets', t.id]" class="ticket-link">{{ t.ticket_number }}</a>
                  </td>
                </ng-container>

                <!-- Subject -->
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Subject</th>
                  <td mat-cell *matCellDef="let t">
                    <strong>{{ t.title }}</strong>
                  </td>
                </ng-container>

                <!-- Requester -->
                <ng-container matColumnDef="requester">
                  <th mat-header-cell *matHeaderCellDef>Requester</th>
                  <td mat-cell *matCellDef="let t">{{ t.requester_name }}</td>
                </ng-container>

                <!-- Category -->
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Category</th>
                  <td mat-cell *matCellDef="let t">{{ t.category_name }}</td>
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

                <!-- SLA -->
                <ng-container matColumnDef="sla">
                  <th mat-header-cell *matHeaderCellDef>SLA Health</th>
                  <td mat-cell *matCellDef="let t">
                    <span *ngIf="t.is_sla_breached || t.is_overdue" class="sla-breached">
                      <mat-icon inline>error</mat-icon> Breached
                    </span>
                    <span *ngIf="!t.is_sla_breached && !t.is_overdue && t.status !== 'CLOSED' && t.status !== 'RESOLVED'" class="sla-ok">
                      <mat-icon inline>schedule</mat-icon> Active
                    </span>
                    <span *ngIf="t.status === 'CLOSED' || t.status === 'RESOLVED'" class="sla-done">
                      <mat-icon inline>done</mat-icon> Done
                    </span>
                  </td>
                </ng-container>

                <!-- Actions -->
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let t">
                    <a mat-stroked-button color="primary" [routerLink]="['/tickets', t.id]">
                      Work on Ticket
                    </a>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="assignedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: assignedColumns"></tr>
              </table>

              <div *ngIf="!isLoadingAssigned() && assignedTickets().length === 0" class="empty-state">
                <mat-icon class="empty-icon">task_alt</mat-icon>
                <p>No tickets currently assigned to you. Check the Unassigned Queue to pick up new tickets!</p>
              </div>

              <mat-paginator
                [length]="assignedTotal()"
                [pageSize]="assignedPageSize"
                [pageIndex]="assignedPageIndex"
                [pageSizeOptions]="[10, 20, 50]"
                (page)="onAssignedPageChange($event)"
                showFirstLastButtons
              >
              </mat-paginator>
            </div>
          </mat-tab>

          <!-- Tab 2: Unassigned Tickets Queue -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">inbox</mat-icon>
              <span>Unassigned Pool ({{ unassignedTotal() }})</span>
            </ng-template>

            <div class="tab-content">
              <div *ngIf="isLoadingUnassigned()" class="loading-box">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="unassignedTickets()" *ngIf="!isLoadingUnassigned()" class="workbench-table">
                <!-- Ticket # -->
                <ng-container matColumnDef="ticket_number">
                  <th mat-header-cell *matHeaderCellDef>Ticket #</th>
                  <td mat-cell *matCellDef="let t">
                    <a [routerLink]="['/tickets', t.id]" class="ticket-link">{{ t.ticket_number }}</a>
                  </td>
                </ng-container>

                <!-- Subject -->
                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef>Subject</th>
                  <td mat-cell *matCellDef="let t">
                    <strong>{{ t.title }}</strong>
                  </td>
                </ng-container>

                <!-- Requester -->
                <ng-container matColumnDef="requester">
                  <th mat-header-cell *matHeaderCellDef>Requester</th>
                  <td mat-cell *matCellDef="let t">{{ t.requester_name }}</td>
                </ng-container>

                <!-- Category -->
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Category</th>
                  <td mat-cell *matCellDef="let t">{{ t.category_name }}</td>
                </ng-container>

                <!-- Priority -->
                <ng-container matColumnDef="priority">
                  <th mat-header-cell *matHeaderCellDef>Priority</th>
                  <td mat-cell *matCellDef="let t">
                    <app-priority-badge [priority]="t.priority"></app-priority-badge>
                  </td>
                </ng-container>

                <!-- Created -->
                <ng-container matColumnDef="created_at">
                  <th mat-header-cell *matHeaderCellDef>Submitted</th>
                  <td mat-cell *matCellDef="let t">{{ t.created_at | date:'short' }}</td>
                </ng-container>

                <!-- Claim Action -->
                <ng-container matColumnDef="claim">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let t">
                    <button mat-raised-button color="accent" (click)="claimTicket(t.id)">
                      <mat-icon>add_task</mat-icon> Claim Ticket
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="unassignedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: unassignedColumns"></tr>
              </table>

              <div *ngIf="!isLoadingUnassigned() && unassignedTickets().length === 0" class="empty-state">
                <mat-icon class="empty-icon">sentiment_satisfied</mat-icon>
                <p>All incoming tickets are currently assigned. Great job team!</p>
              </div>

              <mat-paginator
                [length]="unassignedTotal()"
                [pageSize]="unassignedPageSize"
                [pageIndex]="unassignedPageIndex"
                [pageSizeOptions]="[10, 20, 50]"
                (page)="onUnassignedPageChange($event)"
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
    .agent-page-container {
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
    .agent-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 13px;
    }
    .workbench-card {
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
      padding: 16px 0;
    }
    .workbench-table {
      width: 100%;
    }
    .ticket-link {
      color: #2563eb;
      font-weight: 600;
      text-decoration: none;
    }
    .ticket-link:hover {
      text-decoration: underline;
    }
    .sla-breached {
      color: #dc2626;
      font-weight: 600;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sla-ok {
      color: #2563eb;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sla-done {
      color: #16a34a;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .loading-box, .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: #94a3b8;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
  `],
})
export class AgentTicketsComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);

  readonly assignedTickets = signal<TicketListItem[]>([]);
  readonly assignedTotal = signal<number>(0);
  readonly isLoadingAssigned = signal<boolean>(true);
  assignedPageIndex = 0;
  assignedPageSize = 10;

  readonly unassignedTickets = signal<TicketListItem[]>([]);
  readonly unassignedTotal = signal<number>(0);
  readonly isLoadingUnassigned = signal<boolean>(true);
  unassignedPageIndex = 0;
  unassignedPageSize = 10;

  readonly assignedColumns: string[] = [
    'ticket_number',
    'title',
    'requester',
    'category',
    'status',
    'priority',
    'sla',
    'actions',
  ];

  readonly unassignedColumns: string[] = [
    'ticket_number',
    'title',
    'requester',
    'category',
    'priority',
    'created_at',
    'claim',
  ];

  ngOnInit(): void {
    this.loadAssignedQueue();
    this.loadUnassignedQueue();
  }

  onTabChange(index: number): void {
    if (index === 0) {
      this.loadAssignedQueue();
    } else {
      this.loadUnassignedQueue();
    }
  }

  loadAssignedQueue(): void {
    this.isLoadingAssigned.set(true);
    this.ticketService
      .getAssignedToMe(this.assignedPageIndex + 1, this.assignedPageSize)
      .subscribe({
        next: (res) => {
          this.assignedTickets.set(res.results || []);
          this.assignedTotal.set(res.count || 0);
          this.isLoadingAssigned.set(false);
        },
        error: () => {
          this.isLoadingAssigned.set(false);
        },
      });
  }

  loadUnassignedQueue(): void {
    this.isLoadingUnassigned.set(true);
    this.ticketService
      .getUnassigned(this.unassignedPageIndex + 1, this.unassignedPageSize)
      .subscribe({
        next: (res) => {
          this.unassignedTickets.set(res.results || []);
          this.unassignedTotal.set(res.count || 0);
          this.isLoadingUnassigned.set(false);
        },
        error: () => {
          this.isLoadingUnassigned.set(false);
        },
      });
  }

  claimTicket(ticketId: number): void {
    const user = this.authService.currentUser();
    if (!user) return;

    this.ticketService.assignAgent(ticketId, user.id).subscribe({
      next: () => {
        this.notify.success('Ticket successfully claimed and assigned to you.');
        this.loadUnassignedQueue();
        this.loadAssignedQueue();
      },
      error: () => {
        this.notify.error('Could not claim ticket.');
      },
    });
  }

  onAssignedPageChange(event: PageEvent): void {
    this.assignedPageIndex = event.pageIndex;
    this.assignedPageSize = event.pageSize;
    this.loadAssignedQueue();
  }

  onUnassignedPageChange(event: PageEvent): void {
    this.unassignedPageIndex = event.pageIndex;
    this.unassignedPageSize = event.pageSize;
    this.loadUnassignedQueue();
  }
}
