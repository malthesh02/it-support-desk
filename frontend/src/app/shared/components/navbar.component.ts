import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <mat-toolbar color="primary" class="navbar-container" *ngIf="authService.isAuthenticated()">
      <div class="brand-section" routerLink="/dashboard">
        <mat-icon class="brand-icon">confirmation_number</mat-icon>
        <span class="brand-title">IT Service Desk</span>
      </div>

      <nav class="nav-links">
        <a mat-button routerLink="/dashboard" routerLinkActive="active-link">
          <mat-icon>dashboard</mat-icon> Dashboard
        </a>

        <!-- Employee Link -->
        <a mat-button *ngIf="authService.isEmployee()" routerLink="/my-tickets" routerLinkActive="active-link">
          <mat-icon>inbox</mat-icon> My Tickets
        </a>

        <!-- Agent & Admin Links -->
        <a mat-button *ngIf="authService.isAgent()" routerLink="/agent/tickets" routerLinkActive="active-link">
          <mat-icon>support_agent</mat-icon> Agent Queue
        </a>

        <a mat-button *ngIf="authService.isAgent()" routerLink="/tickets" routerLinkActive="active-link" [routerLinkActiveOptions]="{ exact: true }">
          <mat-icon>list_alt</mat-icon> All Tickets
        </a>

        <!-- Admin Only Link -->
        <a mat-button *ngIf="authService.isAdmin()" routerLink="/admin/management" routerLinkActive="active-link">
          <mat-icon>admin_panel_settings</mat-icon> Admin Console
        </a>

        <a mat-raised-button color="accent" routerLink="/tickets/new" class="create-ticket-btn">
          <mat-icon>add</mat-icon> New Ticket
        </a>
      </nav>

      <span class="spacer"></span>

      <div class="user-section" *ngIf="authService.currentUser() as user">
        <span class="role-chip" [ngClass]="'role-' + user.role.toLowerCase()">
          {{ user.role }}
        </span>

        <button mat-button [matMenuTriggerFor]="userMenu" class="user-profile-button">
          <mat-icon>account_circle</mat-icon>
          <span class="user-name">{{ user.first_name || user.username }}</span>
          <mat-icon>arrow_drop_down</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu">
          <div class="menu-header">
            <strong>{{ user.first_name }} {{ user.last_name }}</strong>
            <small>{{ user.email }}</small>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon color="warn">logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </mat-menu>
      </div>
    </mat-toolbar>
  `,
  styles: [`
    .navbar-container {
      display: flex;
      align-items: center;
      padding: 0 24px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white;
    }
    .brand-section {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 8px;
      margin-right: 32px;
    }
    .brand-icon {
      font-size: 28px;
      height: 28px;
      width: 28px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .nav-links {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .nav-links a {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
    }
    .active-link {
      background-color: rgba(255, 255, 255, 0.15) !important;
      color: #ffffff !important;
    }
    .create-ticket-btn {
      background-color: #10b981 !important;
      color: white !important;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .user-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .role-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.2);
    }
    .role-admin {
      background-color: #ef4444;
    }
    .role-agent, .role-support_agent {
      background-color: #f59e0b;
    }
    .role-employee {
      background-color: #3b82f6;
    }
    .user-profile-button {
      color: white;
      font-weight: 500;
    }
    .user-name {
      margin-left: 6px;
    }
    .menu-header {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class NavbarComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout();
  }
}
