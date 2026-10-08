import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { TicketListItem, TicketMetrics } from '../../core/models/ticket.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    StatusBadgeComponent,
    PriorityBadgeComponent,
  ],
  template: `
    <div class="dashboard-page">
      <!-- Welcome Header -->
      <div class="welcome-header" *ngIf="authService.currentUser() as user">
        <div>
          <h1 class="welcome-title">Welcome, {{ user.first_name || user.username }}</h1>
          <p class="welcome-subtitle">
            Role: <strong>{{ user.role }}</strong> | Department: <strong>{{ user.department || 'General' }}</strong>
          </p>
        </div>
        <div class="header-actions">
          <a mat-raised-button color="primary" routerLink="/tickets/new">
            <mat-icon>add</mat-icon> Create New Ticket
          </a>
        </div>
      </div>

      <!-- KPI Metrics Grid (7 Required Metrics + SLA Breaches) -->
      <div class="kpi-grid" *ngIf="metrics() as m">
        <!-- 1. Total Tickets -->
        <mat-card class="kpi-card" routerLink="/tickets">
          <div class="kpi-icon-box bg-slate">
            <mat-icon>confirmation_number</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Tickets</span>
            <span class="kpi-value">{{ m.total }}</span>
          </div>
        </mat-card>

        <!-- 2. Open Tickets -->
        <mat-card class="kpi-card" routerLink="/tickets" [queryParams]="{status: 'OPEN'}">
          <div class="kpi-icon-box bg-blue">
            <mat-icon>lock_open</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Open</span>
            <span class="kpi-value">{{ m.open }}</span>
          </div>
        </mat-card>

        <!-- 3. In Progress -->
        <mat-card class="kpi-card" routerLink="/tickets" [queryParams]="{status: 'IN_PROGRESS'}">
          <div class="kpi-icon-box bg-amber">
            <mat-icon>engineering</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">In Progress</span>
            <span class="kpi-value">{{ m.in_progress }}</span>
          </div>
        </mat-card>

        <!-- 4. Waiting for User -->
        <mat-card class="kpi-card" routerLink="/tickets" [queryParams]="{status: 'WAITING_FOR_USER'}">
          <div class="kpi-icon-box bg-purple">
            <mat-icon>hourglass_empty</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Waiting for User</span>
            <span class="kpi-value">{{ m.waiting_for_user || m.pending_user || 0 }}</span>
          </div>
        </mat-card>

        <!-- 5. Resolved -->
        <mat-card class="kpi-card" routerLink="/tickets" [queryParams]="{status: 'RESOLVED'}">
          <div class="kpi-icon-box bg-teal">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Resolved</span>
            <span class="kpi-value">{{ m.resolved }}</span>
          </div>
        </mat-card>

        <!-- 6. Closed -->
        <mat-card class="kpi-card" routerLink="/tickets" [queryParams]="{status: 'CLOSED'}">
          <div class="kpi-icon-box bg-green">
            <mat-icon>check_circle</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Closed</span>
            <span class="kpi-value">{{ m.closed }}</span>
          </div>
        </mat-card>

        <!-- 7. High / Critical -->
        <mat-card class="kpi-card highlight-urgent" routerLink="/tickets" [queryParams]="{priority: 'HIGH'}">
          <div class="kpi-icon-box bg-rose">
            <mat-icon>priority_high</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">High / Critical</span>
            <span class="kpi-value">{{ m.high_critical || 0 }}</span>
          </div>
        </mat-card>

        <!-- SLA Breaches / Overdue (Bonus) -->
        <mat-card class="kpi-card" [class.alert-breach]="(m.sla_breached || 0) > 0" routerLink="/tickets" [queryParams]="{overdue: 'true'}">
          <div class="kpi-icon-box bg-red">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">SLA Breaches</span>
            <span class="kpi-value">{{ m.sla_breached }}</span>
          </div>
        </mat-card>
      </div>

      <!-- Charts & Recent Tickets Row -->
      <div class="charts-row">
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Ticket Distribution</mat-card-title>
          </mat-card-header>
          <mat-card-content class="chart-content">
            <div style="display: block; max-width: 320px; margin: 16px auto;" *ngIf="hasChartData()">
              <canvas
                baseChart
                [data]="doughnutChartData"
                [type]="doughnutChartType"
                [options]="doughnutChartOptions"
              >
              </canvas>
            </div>
            <p *ngIf="!hasChartData()" class="empty-notice">No ticket activity recorded yet.</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="recent-card">
          <mat-card-header class="recent-header">
            <mat-card-title>Recent Tickets</mat-card-title>
            <a mat-button color="primary" routerLink="/tickets">View All Tickets</a>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="isLoading()" class="loading-box">
              <mat-spinner diameter="32"></mat-spinner>
            </div>

            <table mat-table [dataSource]="recentTickets()" *ngIf="!isLoading()" class="recent-table">
              <!-- Ticket Number -->
              <ng-container matColumnDef="ticket_number">
                <th mat-header-cell *matHeaderCellDef>Ticket #</th>
                <td mat-cell *matCellDef="let element">
                  <a [routerLink]="['/tickets', element.id]" class="ticket-link">
                    {{ element.ticket_number }}
                  </a>
                </td>
              </ng-container>

              <!-- Title -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let element" class="title-cell">
                  {{ element.title }}
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let element">
                  <app-status-badge [status]="element.status"></app-status-badge>
                </td>
              </ng-container>

              <!-- Priority -->
              <ng-container matColumnDef="priority">
                <th mat-header-cell *matHeaderCellDef>Priority</th>
                <td mat-cell *matCellDef="let element">
                  <app-priority-badge [priority]="element.priority"></app-priority-badge>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>

            <div *ngIf="!isLoading() && recentTickets().length === 0" class="empty-notice">
              No tickets recorded yet. Create one to get started!
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .welcome-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .welcome-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }
    .welcome-subtitle {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 20px;
      border-radius: 12px;
      gap: 16px;
    }
    .kpi-icon-box {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .bg-slate { background-color: #64748b; }
    .bg-blue { background-color: #3b82f6; }
    .bg-amber { background-color: #f59e0b; }
    .bg-purple { background-color: #8b5cf6; }
    .bg-teal { background-color: #0d9488; }
    .bg-green { background-color: #10b981; }
    .bg-rose { background-color: #e11d48; }
    .bg-red { background-color: #ef4444; }
    .kpi-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .highlight-urgent {
      border: 1px solid #fecdd3;
      background-color: #fff1f2;
    }
    .kpi-content {
      display: flex;
      flex-direction: column;
    }
    .kpi-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #1e293b;
    }
    .alert-breach {
      border: 1px solid #fca5a5;
      background-color: #fff5f5;
    }
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .charts-row {
        grid-template-columns: 1fr;
      }
    }
    .chart-card, .recent-card {
      border-radius: 12px;
      padding: 16px;
    }
    .recent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .recent-table {
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
    .empty-notice {
      text-align: center;
      padding: 32px;
      color: #94a3b8;
    }
    .loading-box {
      display: flex;
      justify-content: center;
      padding: 32px;
    }
  `],
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly ticketService = inject(TicketService);

  readonly metrics = signal<TicketMetrics | null>(null);
  readonly recentTickets = signal<TicketListItem[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly hasChartData = signal<boolean>(false);

  readonly displayedColumns: string[] = ['ticket_number', 'title', 'status', 'priority'];

  // Chart Configuration
  readonly doughnutChartType: ChartType = 'doughnut';
  doughnutChartData: ChartData<'doughnut'> = {
    labels: ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: ['#38bdf8', '#818cf8', '#fbbf24', '#c084fc', '#2dd4bf', '#4ade80'],
      },
    ],
  };
  readonly doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
    },
  };

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);

    this.ticketService.getMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        const waiting = data.waiting_for_user || data.pending_user || 0;
        const totalActivity = data.open + (data.assigned || 0) + data.in_progress + waiting + data.resolved + data.closed;
        this.hasChartData.set(totalActivity > 0);

        this.doughnutChartData = {
          labels: ['Open', 'Assigned', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'],
          datasets: [
            {
              data: [data.open, data.assigned || 0, data.in_progress, waiting, data.resolved, data.closed],
              backgroundColor: ['#38bdf8', '#818cf8', '#fbbf24', '#c084fc', '#2dd4bf', '#4ade80'],
            },
          ],
        };
      },
      error: () => {},
    });

    this.ticketService.getTickets().subscribe({
      next: (tickets) => {
        this.recentTickets.set(tickets.slice(0, 5));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
