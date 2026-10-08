import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'my-tickets',
    canActivate: [authGuard],
    data: { isMyTickets: true },
    loadComponent: () =>
      import('./features/tickets/ticket-list.component').then(
        (m) => m.TicketListComponent
      ),
  },
  {
    path: 'tickets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-list.component').then(
        (m) => m.TicketListComponent
      ),
  },
  {
    path: 'tickets/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-create.component').then(
        (m) => m.TicketCreateComponent
      ),
  },
  {
    path: 'tickets/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-detail.component').then(
        (m) => m.TicketDetailComponent
      ),
  },
  {
    path: 'agent/tickets',
    canActivate: [authGuard, roleGuard(['SUPPORT_AGENT', 'ADMIN'])],
    loadComponent: () =>
      import('./features/agent/agent-tickets.component').then(
        (m) => m.AgentTicketsComponent
      ),
  },
  {
    path: 'admin/management',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () =>
      import('./features/admin/admin-management.component').then(
        (m) => m.AdminManagementComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];

