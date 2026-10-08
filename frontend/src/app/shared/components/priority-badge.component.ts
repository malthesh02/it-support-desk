import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PriorityLevel } from '../../core/models/category.model';

@Component({
  selector: 'app-priority-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [ngClass]="getBadgeClass()">
      {{ priority }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .p-critical { background-color: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
    .p-high { background-color: #ffedd5; color: #c2410c; }
    .p-medium { background-color: #e0f2fe; color: #0369a1; }
    .p-low { background-color: #f3f4f6; color: #4b5563; }
  `],
})
export class PriorityBadgeComponent {
  @Input() priority: PriorityLevel | string = 'MEDIUM';

  getBadgeClass(): string {
    return `p-${(this.priority || 'medium').toLowerCase()}`;
  }
}
