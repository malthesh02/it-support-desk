import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TicketService } from '../../core/services/ticket.service';
import { CategoryService } from '../../core/services/category.service';
import { Category, SubCategory } from '../../core/models/category.model';

import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="create-ticket-container">
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Create Support Ticket</mat-card-title>
          <mat-card-subtitle>Report an incident, request equipment, or ask for IT assistance</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div *ngIf="errorMessage()" class="error-box">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>

          <form [formGroup]="ticketForm" (ngSubmit)="onSubmit()">
            <!-- Title -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Issue Summary / Subject</mat-label>
              <input matInput formControlName="title" placeholder="Brief summary of the issue..." required />
              <mat-error *ngIf="ticketForm.get('title')?.hasError('required')">
                Subject is required.
              </mat-error>
            </mat-form-field>

            <div class="form-row">
              <!-- Category -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Category</mat-label>
                <mat-select formControlName="category_id" (selectionChange)="onCategoryChange($event.value)" required>
                  <mat-option *ngFor="let cat of categories()" [value]="cat.id">
                    {{ cat.name }}
                  </mat-option>
                </mat-select>
                <mat-error *ngIf="ticketForm.get('category_id')?.hasError('required')">
                  Category is required.
                </mat-error>
              </mat-form-field>

              <!-- SubCategory -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Subcategory</mat-label>
                <mat-select formControlName="subcategory_id" (selectionChange)="onSubcategoryChange($event.value)">
                  <mat-option [value]="null">-- Select Subcategory --</mat-option>
                  <mat-option *ngFor="let sub of availableSubcategories()" [value]="sub.id">
                    {{ sub.name }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- Priority -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Priority Level</mat-label>
              <mat-select formControlName="priority" required>
                <mat-option value="LOW">Low - Minor inconvenience</mat-option>
                <mat-option value="MEDIUM">Medium - Normal workflow affected</mat-option>
                <mat-option value="HIGH">High - Significant work stoppage</mat-option>
                <mat-option value="CRITICAL">Critical - Complete outage / Urgent</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Description -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Detailed Description</mat-label>
              <textarea
                matInput
                rows="6"
                formControlName="description"
                placeholder="Explain what happened, steps to reproduce, or any error messages received..."
                required
              ></textarea>
              <mat-error *ngIf="ticketForm.get('description')?.hasError('required')">
                Description is required.
              </mat-error>
            </mat-form-field>

            <!-- Attachments -->
            <div class="file-picker-section">
              <label class="file-picker-label">Optional Attachment (Max 10MB - logs, screenshots, error files):</label>
              <input type="file" (change)="onFileSelected($event)" class="file-input" />
              <div *ngIf="selectedFile()" class="selected-file-row">
                <mat-icon class="file-icon">attach_file</mat-icon>
                <span class="selected-file-name">{{ selectedFile()?.name }} ({{ formatFileSize(selectedFile()!.size) }})</span>
                <button mat-icon-button type="button" color="warn" (click)="clearFile()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <p *ngIf="fileError()" class="file-error">{{ fileError() }}</p>
            </div>

            <!-- Form Action Buttons -->
            <div class="form-actions">
              <button mat-button type="button" routerLink="/tickets">
                Cancel
              </button>
              <button mat-raised-button color="primary" type="submit" [disabled]="ticketForm.invalid || isSubmitting()">
                <mat-spinner diameter="20" *ngIf="isSubmitting()"></mat-spinner>
                <span *ngIf="!isSubmitting()">Submit Ticket</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .create-ticket-container {
      padding: 32px 16px;
      max-width: 800px;
      margin: 0 auto;
    }
    .form-card {
      padding: 24px;
      border-radius: 12px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .half-width {
      flex: 1;
      margin-bottom: 12px;
    }
    .file-picker-section {
      margin: 16px 0 24px 0;
      padding: 16px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background-color: #f8fafc;
    }
    .file-picker-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      margin-bottom: 8px;
    }
    .file-input {
      display: block;
      margin-bottom: 8px;
    }
    .selected-file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .selected-file-name {
      font-size: 13px;
      color: #2563eb;
      font-weight: 500;
    }
    .file-error {
      color: #dc2626;
      font-size: 12px;
      margin-top: 4px;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
  `],
})
export class TicketCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly categories = signal<Category[]>([]);
  readonly availableSubcategories = signal<SubCategory[]>([]);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly ticketForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    category_id: [null, [Validators.required]],
    subcategory_id: [null],
    priority: ['MEDIUM', [Validators.required]],
    description: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
      },
    });
  }

  onCategoryChange(categoryId: number): void {
    const cat = this.categories().find((c) => c.id === categoryId);
    if (cat && cat.subcategories) {
      this.availableSubcategories.set(cat.subcategories);
    } else {
      this.availableSubcategories.set([]);
    }
    this.ticketForm.patchValue({ subcategory_id: null });
  }

  onSubcategoryChange(subcategoryId: number): void {
    const sub = this.availableSubcategories().find((s) => s.id === subcategoryId);
    if (sub && sub.default_priority) {
      this.ticketForm.patchValue({ priority: sub.default_priority });
    }
  }

  onFileSelected(event: Event): void {
    this.fileError.set(null);
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        this.fileError.set('File size exceeds 10MB limit.');
        this.selectedFile.set(null);
        input.value = '';
        return;
      }
      this.selectedFile.set(file);
    }
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  onSubmit(): void {
    if (this.ticketForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload = this.ticketForm.value;

    this.ticketService.createTicket(payload).subscribe({
      next: (ticket) => {
        const file = this.selectedFile();
        if (file) {
          this.ticketService.uploadAttachment(ticket.id, file).subscribe({
            next: () => {
              this.isSubmitting.set(false);
              this.notify.success(`Ticket #${ticket.ticket_number} created with attachment.`);
              this.router.navigate(['/tickets', ticket.id]);
            },
            error: () => {
              this.isSubmitting.set(false);
              this.notify.info(`Ticket created, but attachment upload failed.`);
              this.router.navigate(['/tickets', ticket.id]);
            },
          });
        } else {
          this.isSubmitting.set(false);
          this.notify.success(`Ticket #${ticket.ticket_number} created successfully.`);
          this.router.navigate(['/tickets', ticket.id]);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || 'Could not create ticket. Please check your inputs.';
        this.errorMessage.set(msg);
        this.notify.error(msg);
      },
    });
  }
}
