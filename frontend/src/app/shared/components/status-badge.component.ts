import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketStatus } from '../../core/models/ticket.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [ngClass]="getBadgeClass()">
      {{ getDisplayLabel() }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .status-open { background-color: #dbeafe; color: #1e40af; }
    .status-assigned { background-color: #e0e7ff; color: #3730a3; }
    .status-in_progress { background-color: #fef3c7; color: #92400e; }
    .status-waiting_for_user, .status-pending_user { background-color: #f3e8ff; color: #6b21a8; }
    .status-resolved { background-color: #ccfbf1; color: #115e59; }
    .status-closed { background-color: #dcfce7; color: #166534; }
    .status-reopened { background-color: #fee2e2; color: #991b1b; }
    .status-cancelled { background-color: #f3f4f6; color: #4b5563; }
  `],
})
export class StatusBadgeComponent {
  @Input() status: TicketStatus | string = 'OPEN';

  getBadgeClass(): string {
    return `status-${(this.status || 'open').toLowerCase()}`;
  }

  getDisplayLabel(): string {
    switch (this.status) {
      case 'WAITING_FOR_USER':
      case 'PENDING_USER':
        return 'Waiting User';
      case 'IN_PROGRESS':
        return 'In Progress';
      default:
        return this.status ? this.status.replace('_', ' ') : 'Open';
    }
  }
}
