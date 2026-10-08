import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { AdminService } from '../../core/services/admin.service';
import { CategoryService } from '../../core/services/category.service';
import { NotificationService } from '../../core/services/notification.service';
import { TicketDetail, TicketStatus, TicketHistory } from '../../core/models/ticket.model';
import { Category, PriorityLevel } from '../../core/models/category.model';
import { User } from '../../core/models/user.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge.component';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    StatusBadgeComponent,
    PriorityBadgeComponent,
  ],
  template: `
    <div class="ticket-detail-container" *ngIf="ticket() as t">
      <!-- Top Bar: Back & Ticket Header -->
      <div class="detail-header">
        <div>
          <a mat-button routerLink="/tickets" class="back-link">
            <mat-icon>arrow_back</mat-icon> Back to Tickets
          </a>
          <div class="title-row">
            <h1 class="ticket-heading">[{{ t.ticket_number }}] {{ t.title }}</h1>
            <div class="badge-group">
              <app-status-badge [status]="t.status"></app-status-badge>
              <app-priority-badge [priority]="t.priority"></app-priority-badge>
              <span *ngIf="t.is_sla_breached || t.is_overdue" class="sla-breach-badge">
                <mat-icon inline>error</mat-icon> SLA Breached
              </span>
            </div>
          </div>
          <p class="created-meta">
            Reported by <strong>{{ t.requester_name }}</strong> ({{ t.requester_email }}) on {{ t.created_at | date:'medium' }}
          </p>
        </div>

        <!-- Edit Permitted Fields Action Button -->
        <div class="header-actions" *ngIf="canEditTicket()">
          <button mat-stroked-button color="primary" *ngIf="!isEditing()" (click)="enableEditMode()">
            <mat-icon>edit</mat-icon> Edit Details
          </button>
        </div>
      </div>

      <!-- Inline Edit Form (When Active) -->
      <mat-card class="edit-card" *ngIf="isEditing()">
        <mat-card-header>
          <mat-card-title>Edit Ticket Fields</mat-card-title>
        </mat-card-header>
        <mat-card-content class="edit-form-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title / Subject</mat-label>
            <input matInput [(ngModel)]="editTitle" required />
          </mat-form-field>

          <div class="form-row" *ngIf="authService.isAgent() || authService.isAdmin()">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="editCategoryId">
                <mat-option *ngFor="let cat of categories()" [value]="cat.id">
                  {{ cat.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Priority</mat-label>
              <mat-select [(ngModel)]="editPriority">
                <mat-option value="LOW">Low</mat-option>
                <mat-option value="MEDIUM">Medium</mat-option>
                <mat-option value="HIGH">High</mat-option>
                <mat-option value="CRITICAL">Critical</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput rows="4" [(ngModel)]="editDescription" required></textarea>
          </mat-form-field>

          <div class="edit-actions">
            <button mat-button (click)="cancelEdit()">Cancel</button>
            <button mat-raised-button color="primary" (click)="saveTicketEdits()" [disabled]="isSavingEdits()">
              <mat-spinner diameter="18" *ngIf="isSavingEdits()"></mat-spinner>
              <span *ngIf="!isSavingEdits()">Save Changes</span>
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Main Layout: 2 Columns -->
      <div class="layout-grid">
        <!-- Left: Details, Attachments, Comments -->
        <div class="main-column">
          <!-- Description Card -->
          <mat-card class="content-card">
            <mat-card-header>
              <mat-card-title>Problem Description</mat-card-title>
            </mat-card-header>
            <mat-card-content class="description-body">
              <p>{{ t.description }}</p>
            </mat-card-content>
          </mat-card>

          <!-- Attachments Card -->
          <mat-card class="content-card">
            <div class="attachments-header">
              <mat-card-title>Attachments ({{ t.attachments ? t.attachments.length : 0 }})</mat-card-title>
              <!-- Upload Attachment -->
              <label class="upload-btn-label">
                <input type="file" (change)="onAttachmentUpload($event)" style="display:none;" />
                <button mat-stroked-button type="button" (click)="triggerFileInput($event)" [disabled]="isUploadingAttachment()">
                  <mat-icon>upload_file</mat-icon>
                  <span *ngIf="!isUploadingAttachment()">Add Attachment</span>
                  <span *ngIf="isUploadingAttachment()">Uploading...</span>
                </button>
              </label>
            </div>
            <mat-card-content class="attachments-list">
              <div *ngFor="let att of t.attachments" class="attachment-item">
                <mat-icon class="att-icon">description</mat-icon>
                <div class="att-info">
                  <a href="javascript:void(0)" (click)="downloadAttachment(att.id, att.file_name)" class="att-name">
                    {{ att.file_name }}
                  </a>
                  <span class="att-meta">
                    ({{ formatFileSize(att.file_size) }}) &bull; Uploaded by {{ att.uploaded_by_name }} on {{ att.created_at | date:'short' }}
                  </span>
                </div>
                <button mat-icon-button color="primary" (click)="downloadAttachment(att.id, att.file_name)" title="Download file">
                  <mat-icon>download</mat-icon>
                </button>
              </div>

              <div *ngIf="!t.attachments || t.attachments.length === 0" class="empty-notice">
                No attachments uploaded for this ticket.
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Conversation & Activity Thread -->
          <mat-card class="content-card">
            <mat-card-header>
              <mat-card-title>Discussion & Updates</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="comments-thread">
                <div *ngFor="let c of t.comments" class="comment-card" [class.internal-note]="c.is_internal">
                  <div class="comment-header">
                    <div class="comment-author">
                      <mat-icon class="author-icon">account_circle</mat-icon>
                      <strong>{{ c.author_name || c.author_username }}</strong>
                      <span class="author-role-tag">{{ c.author_role }}</span>
                    </div>
                    <div class="comment-meta">
                      <span *ngIf="c.is_internal" class="internal-tag">INTERNAL NOTE</span>
                      <span>{{ c.created_at | date:'medium' }}</span>
                    </div>
                  </div>
                  <div class="comment-body">
                    {{ c.body }}
                  </div>
                </div>

                <div *ngIf="!t.comments || t.comments.length === 0" class="no-comments">
                  No comments yet. Start the conversation below.
                </div>
              </div>

              <!-- Add Comment Form -->
              <div class="reply-section" *ngIf="t.status !== 'CLOSED' && t.status !== 'CANCELLED'">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Post a comment or update...</mat-label>
                  <textarea matInput rows="3" [(ngModel)]="newCommentText" placeholder="Type your message here..."></textarea>
                </mat-form-field>

                <div class="reply-actions">
                  <mat-checkbox *ngIf="authService.isAgent() || authService.isAdmin()" [(ngModel)]="isInternalNote">
                    Internal Note (Visible to agents & admins only)
                  </mat-checkbox>
                  <span *ngIf="!authService.isAgent() && !authService.isAdmin()"></span>

                  <button mat-raised-button color="primary" (click)="submitComment()" [disabled]="!newCommentText.trim() || isSubmittingComment()">
                    <mat-spinner diameter="18" *ngIf="isSubmittingComment()"></mat-spinner>
                    <span *ngIf="!isSubmittingComment()">Post Reply</span>
                  </button>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Right Sidebar: Workflow Actions, Assignment, Properties, History -->
        <div class="sidebar-column">
          <!-- State Transition Actions Card -->
          <mat-card class="sidebar-card">
            <mat-card-header>
              <mat-card-title>Workflow Status Actions</mat-card-title>
            </mat-card-header>
            <mat-card-content class="actions-content">
              <!-- Optional Reason Input for Resolution or Reopening -->
              <div *ngIf="showTransitionReason" class="transition-reason-box">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Resolution / Reopen Reason (Optional)</mat-label>
                  <input matInput [(ngModel)]="transitionReason" placeholder="Reason for this status change..." />
                </mat-form-field>
              </div>

              <!-- OPEN Transitions -->
              <button
                *ngIf="t.status === 'OPEN' && (authService.isAgent() || authService.isAdmin())"
                mat-flat-button
                color="primary"
                class="action-btn"
                (click)="performTransition('IN_PROGRESS')"
              >
                <mat-icon>play_arrow</mat-icon> Start Progress
              </button>

              <!-- ASSIGNED Transitions -->
              <button
                *ngIf="t.status === 'ASSIGNED' && (authService.isAgent() || authService.isAdmin())"
                mat-flat-button
                color="primary"
                class="action-btn"
                (click)="performTransition('IN_PROGRESS')"
              >
                <mat-icon>play_arrow</mat-icon> Start Progress
              </button>

              <!-- IN_PROGRESS Transitions -->
              <button
                *ngIf="t.status === 'IN_PROGRESS' && (authService.isAgent() || authService.isAdmin())"
                mat-stroked-button
                class="action-btn"
                (click)="performTransition('WAITING_FOR_USER')"
              >
                <mat-icon>hourglass_empty</mat-icon> Await Requester Info
              </button>

              <button
                *ngIf="t.status === 'IN_PROGRESS' && (authService.isAgent() || authService.isAdmin())"
                mat-flat-button
                color="accent"
                class="action-btn resolve-btn"
                (click)="performTransition('RESOLVED')"
              >
                <mat-icon>check_circle</mat-icon> Mark Resolved
              </button>

              <!-- WAITING_FOR_USER Transitions -->
              <button
                *ngIf="t.status === 'WAITING_FOR_USER'"
                mat-flat-button
                color="primary"
                class="action-btn"
                (click)="performTransition('IN_PROGRESS')"
              >
                <mat-icon>replay</mat-icon> Resume Working (In Progress)
              </button>

              <!-- REOPENED Transitions -->
              <button
                *ngIf="t.status === 'REOPENED' && (authService.isAgent() || authService.isAdmin())"
                mat-flat-button
                color="primary"
                class="action-btn"
                (click)="performTransition('IN_PROGRESS')"
              >
                <mat-icon>play_arrow</mat-icon> Resume Working
              </button>

              <!-- RESOLVED Transitions -->
              <button
                *ngIf="t.status === 'RESOLVED'"
                mat-flat-button
                color="primary"
                class="action-btn close-btn"
                (click)="performTransition('CLOSED')"
              >
                <mat-icon>done_all</mat-icon> Confirm & Close
              </button>

              <button
                *ngIf="t.status === 'RESOLVED'"
                mat-stroked-button
                color="warn"
                class="action-btn"
                (click)="performTransition('REOPENED')"
              >
                <mat-icon>refresh</mat-icon> Reopen Ticket
              </button>

              <!-- CLOSED Notice -->
              <div *ngIf="t.status === 'CLOSED'" class="closed-notice">
                <mat-icon>check_circle</mat-icon>
                <span>This ticket is closed and archived.</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Agent Assignment Card -->
          <mat-card class="sidebar-card" *ngIf="authService.isAdmin() || authService.isAgent()">
            <mat-card-header>
              <mat-card-title>Assignment</mat-card-title>
            </mat-card-header>
            <mat-card-content class="assign-content">
              <!-- Admin: Assign to any agent -->
              <div *ngIf="authService.isAdmin()" class="admin-assign-box">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Assign to Support Agent</mat-label>
                  <mat-select [value]="t.assigned_agent" (selectionChange)="onAdminAssignAgent($event.value)">
                    <mat-option [value]="null">-- Unassigned --</mat-option>
                    <mat-option *ngFor="let agent of agentsList()" [value]="agent.id">
                      {{ agent.first_name ? agent.first_name + ' ' + agent.last_name : agent.username }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Agent: Claim / Assign to Me -->
              <div *ngIf="authService.isAgent() && !authService.isAdmin() && t.status !== 'CLOSED'">
                <button
                  mat-stroked-button
                  color="primary"
                  class="action-btn"
                  (click)="assignToSelf()"
                  [disabled]="t.assigned_agent === authService.currentUser()?.id"
                >
                  <mat-icon>person_add</mat-icon>
                  {{ t.assigned_agent === authService.currentUser()?.id ? 'Assigned to You' : 'Assign to Me' }}
                </button>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Ticket Properties & SLA Card -->
          <mat-card class="sidebar-card">
            <mat-card-header>
              <mat-card-title>Ticket Properties</mat-card-title>
            </mat-card-header>
            <mat-card-content class="properties-list">
              <div class="prop-item">
                <span class="prop-label">Category:</span>
                <span class="prop-value">{{ t.category ? t.category.name : 'None' }}</span>
              </div>
              <div class="prop-item" *ngIf="t.subcategory">
                <span class="prop-label">Subcategory:</span>
                <span class="prop-value">{{ t.subcategory.name }}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Assigned Agent:</span>
                <span class="prop-value">{{ t.assigned_agent_name || 'Unassigned' }}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Response Due:</span>
                <span class="prop-value">{{ t.response_due_at ? (t.response_due_at | date:'short') : 'N/A' }}</span>
              </div>
              <div class="prop-item">
                <span class="prop-label">Resolution Due:</span>
                <span class="prop-value">{{ t.resolution_due_at ? (t.resolution_due_at | date:'short') : 'N/A' }}</span>
              </div>
              <div class="prop-item" *ngIf="t.resolved_at">
                <span class="prop-label">Resolved At:</span>
                <span class="prop-value">{{ t.resolved_at | date:'short' }}</span>
              </div>
              <div class="prop-item" *ngIf="t.closed_at">
                <span class="prop-label">Closed At:</span>
                <span class="prop-value">{{ t.closed_at | date:'short' }}</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Timeline / History Card -->
          <mat-card class="sidebar-card" *ngIf="ticketHistory().length > 0">
            <mat-card-header>
              <mat-card-title>History & Audit Timeline</mat-card-title>
            </mat-card-header>
            <mat-card-content class="history-list">
              <div *ngFor="let h of ticketHistory()" class="history-item">
                <mat-icon class="history-dot">circle</mat-icon>
                <div class="history-text">
                  <span class="history-field">
                    <strong>{{ h.changed_by_name || 'System' }}</strong>: {{ h.field_name }}
                  </span>
                  <span class="history-delta" *ngIf="h.old_value || h.new_value">
                    {{ h.old_value || 'None' }} &rarr; <strong>{{ h.new_value }}</strong>
                  </span>
                  <small class="history-time">{{ h.created_at | date:'medium' }}</small>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ticket-detail-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .back-link {
      margin-bottom: 8px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .ticket-heading {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }
    .badge-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .sla-breach-badge {
      background-color: #fee2e2;
      color: #b91c1c;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .created-meta {
      color: #64748b;
      font-size: 13px;
      margin-top: 6px;
    }
    .edit-card {
      margin-bottom: 24px;
      border-radius: 12px;
      padding: 16px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .edit-form-content {
      margin-top: 12px;
    }
    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .half-width {
      flex: 1;
    }
    .layout-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
    }
    @media (max-width: 960px) {
      .layout-grid {
        grid-template-columns: 1fr;
      }
    }
    .content-card, .sidebar-card {
      border-radius: 12px;
      margin-bottom: 20px;
      padding: 16px;
    }
    .description-body {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }
    .attachments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .attachment-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: #f1f5f9;
      padding: 10px 14px;
      border-radius: 8px;
    }
    .att-icon {
      color: #64748b;
    }
    .att-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .att-name {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
    .att-name:hover {
      text-decoration: underline;
    }
    .att-meta {
      color: #64748b;
      font-size: 12px;
    }
    .comments-thread {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }
    .comment-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: white;
    }
    .internal-note {
      background-color: #fffbeb;
      border-color: #fde68a;
    }
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .comment-author {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .author-icon {
      font-size: 20px;
      height: 20px;
      width: 20px;
      color: #64748b;
    }
    .author-role-tag {
      font-size: 10px;
      background-color: #e2e8f0;
      padding: 2px 6px;
      border-radius: 6px;
      font-weight: 600;
    }
    .internal-tag {
      background-color: #f59e0b;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 8px;
    }
    .comment-body {
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      white-space: pre-wrap;
    }
    .full-width {
      width: 100%;
    }
    .reply-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }
    .actions-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .action-btn {
      width: 100%;
      height: 42px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .resolve-btn {
      background-color: #0d9488 !important;
      color: white !important;
    }
    .close-btn {
      background-color: #16a34a !important;
      color: white !important;
    }
    .closed-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background-color: #f0fdf4;
      color: #166534;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .properties-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .prop-item {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .prop-label {
      color: #64748b;
      font-weight: 500;
    }
    .prop-value {
      font-weight: 600;
      color: #1e293b;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 380px;
      overflow-y: auto;
    }
    .history-item {
      display: flex;
      gap: 8px;
      font-size: 12px;
    }
    .history-dot {
      font-size: 8px;
      height: 8px;
      width: 8px;
      color: #3b82f6;
      margin-top: 4px;
    }
    .history-text {
      display: flex;
      flex-direction: column;
    }
    .history-delta {
      color: #475569;
      font-size: 11px;
    }
    .history-time {
      color: #94a3b8;
      font-size: 11px;
    }
    .no-comments, .empty-notice {
      text-align: center;
      padding: 16px;
      color: #94a3b8;
    }
  `],
})
export class TicketDetailComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly ticketService = inject(TicketService);
  private readonly adminService = inject(AdminService);
  private readonly categoryService = inject(CategoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);

  readonly ticket = signal<TicketDetail | null>(null);
  readonly ticketHistory = signal<TicketHistory[]>([]);
  readonly agentsList = signal<User[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly isSubmittingComment = signal<boolean>(false);
  readonly isUploadingAttachment = signal<boolean>(false);
  readonly isSavingEdits = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);

  newCommentText = '';
  isInternalNote = false;

  // Edit fields
  editTitle = '';
  editDescription = '';
  editPriority: PriorityLevel = 'MEDIUM';
  editCategoryId: number | null = null;

  // Status transition reason
  showTransitionReason = false;
  transitionReason = '';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadTicket(id);
      this.loadHistory(id);
    }

    if (this.authService.isAdmin()) {
      this.adminService.getUsers({ role: 'SUPPORT_AGENT' }).subscribe({
        next: (res) => {
          const agents = Array.isArray(res) ? res : res.results || [];
          this.agentsList.set(agents);
        },
        error: () => {},
      });
    }

    this.categoryService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadTicket(id: number): void {
    this.ticketService.getTicketById(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.editTitle = t.title;
        this.editDescription = t.description;
        this.editPriority = t.priority;
        this.editCategoryId = t.category?.id || null;
      },
      error: () => {
        this.notify.error('Could not load ticket details.');
      },
    });
  }

  loadHistory(id: number): void {
    this.ticketService.getTicketHistory(id).subscribe({
      next: (history) => this.ticketHistory.set(history),
      error: () => {},
    });
  }

  canEditTicket(): boolean {
    const t = this.ticket();
    if (!t) return false;
    if (t.status === 'CLOSED') return false;

    // Admin and Agent can always edit permitted fields
    if (this.authService.isAdmin() || this.authService.isAgent()) return true;

    // Requester employee can edit if ticket is still OPEN
    return t.status === 'OPEN' && t.requester === this.authService.currentUser()?.id;
  }

  enableEditMode(): void {
    const t = this.ticket();
    if (!t) return;
    this.editTitle = t.title;
    this.editDescription = t.description;
    this.editPriority = t.priority;
    this.editCategoryId = t.category?.id || null;
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveTicketEdits(): void {
    const t = this.ticket();
    if (!t) return;

    this.isSavingEdits.set(true);
    const payload: any = {
      title: this.editTitle,
      description: this.editDescription,
    };

    if (this.authService.isAgent() || this.authService.isAdmin()) {
      payload.priority = this.editPriority;
      if (this.editCategoryId) {
        payload.category_id = this.editCategoryId;
      }
    }

    this.ticketService.updateTicket(t.id, payload).subscribe({
      next: (updated) => {
        this.isSavingEdits.set(false);
        this.isEditing.set(false);
        this.ticket.set(updated);
        this.notify.success('Ticket updated successfully.');
        this.loadHistory(t.id);
      },
      error: (err) => {
        this.isSavingEdits.set(false);
        const msg = err.error?.detail || 'Failed to update ticket.';
        this.notify.error(msg);
      },
    });
  }

  performTransition(newStatus: string): void {
    const t = this.ticket();
    if (!t) return;

    this.ticketService.changeStatus(t.id, newStatus, this.transitionReason).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.transitionReason = '';
        this.notify.success(`Status updated to ${newStatus.replace('_', ' ')}.`);
        this.loadHistory(t.id);
      },
      error: (err) => {
        const msg = err.error?.detail || 'Cannot perform this status transition.';
        this.notify.error(msg);
      },
    });
  }

  assignToSelf(): void {
    const t = this.ticket();
    const user = this.authService.currentUser();
    if (!t || !user) return;

    this.ticketService.assignAgent(t.id, user.id).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.notify.success('Ticket assigned to you.');
        this.loadHistory(t.id);
      },
      error: () => {
        this.notify.error('Failed to assign ticket.');
      },
    });
  }

  onAdminAssignAgent(agentId: number | null): void {
    const t = this.ticket();
    if (!t) return;

    this.ticketService.assignAgent(t.id, agentId).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.notify.success(agentId ? 'Agent assigned successfully.' : 'Ticket unassigned.');
        this.loadHistory(t.id);
      },
      error: () => {
        this.notify.error('Failed to reassign agent.');
      },
    });
  }

  triggerFileInput(event: Event): void {
    const button = event.currentTarget as HTMLElement;
    const input = button.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.click();
  }

  onAttachmentUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
      this.notify.error('File exceeds maximum size of 10MB.');
      input.value = '';
      return;
    }

    const t = this.ticket();
    if (!t) return;

    this.isUploadingAttachment.set(true);
    this.ticketService.uploadAttachment(t.id, file).subscribe({
      next: () => {
        this.isUploadingAttachment.set(false);
        this.notify.success('Attachment uploaded.');
        input.value = '';
        this.loadTicket(t.id);
        this.loadHistory(t.id);
      },
      error: () => {
        this.isUploadingAttachment.set(false);
        this.notify.error('Failed to upload attachment.');
      },
    });
  }

  downloadAttachment(attachmentId: number, fileName: string): void {
    const t = this.ticket();
    if (!t) return;

    this.ticketService.downloadAttachment(t.id, attachmentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.notify.error('Could not download attachment.');
      },
    });
  }

  submitComment(): void {
    const t = this.ticket();
    if (!t || !this.newCommentText.trim()) return;

    this.isSubmittingComment.set(true);

    this.ticketService
      .addComment(t.id, this.newCommentText.trim(), this.isInternalNote)
      .subscribe({
        next: () => {
          this.isSubmittingComment.set(false);
          this.newCommentText = '';
          this.isInternalNote = false;
          this.notify.success('Comment posted.');
          this.loadTicket(t.id);
          this.loadHistory(t.id);
        },
        error: () => {
          this.isSubmittingComment.set(false);
          this.notify.error('Failed to post comment.');
        },
      });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

