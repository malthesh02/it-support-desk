# Enterprise IT Service Desk Platform

A production-style IT Service Desk and Incident Management application built with **Angular 19** (Frontend), **Django REST Framework / Python 3.10** (Backend), and **MySQL 8.0** (Database).

---

## 1. Technology Stack

- **Frontend**:
  - Angular 19 (Standalone Components, Signals & RxJS)
  - Angular Material 19
  - Chart.js & `ng2-charts`
  - SCSS Design System & Responsive Layout
- **Backend**:
  - Python 3.10 + Django 5.1
  - Django REST Framework (DRF)
  - `djangorestframework-simplejwt` (OAuth2 / JWT Bearer Tokens with Rotation & Blacklisting)
  - `drf-spectacular` (OpenAPI 3.0 & Swagger UI)
  - `PyMySQL` + `cryptography`
- **Database**:
  - MySQL 8.0 (`itsupportdesk_db`)

---

## 2. Default Seed Test Accounts

| Role | Username | Email | Password | Access Capabilities |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin@itsupport.local` | `AdminPassword123!` | System configuration, categories, SLA policies, audit logs, all tickets. |
| **Support Agent** | `agent_john` | `agent.john@itsupport.local` | `AgentPassword123!` | Triage, self-assign tickets, change status, post internal notes & public replies. |
| **Employee** | `emp_alice` | `emp.alice@itsupport.local` | `UserPassword123!` | Create tickets, view own tickets, reply to agent comments, confirm resolution. |

---

## 3. Quick Start Guide

### 3.1 Backend Setup (Django + MySQL)

1. Open PowerShell and navigate to the `backend/` directory:
   ```powershell
   cd d:\ITSUPPORTDESK\backend
   ```
2. Activate the virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
3. Run migrations (already applied to `itsupportdesk_db`):
   ```powershell
   python manage.py migrate
   ```
4. (Optional) Re-seed initial data (departments, categories, SLA rules, test users):
   ```powershell
   python manage.py seed_initial_data
   ```
5. Start the backend development server:
   ```powershell
   python manage.py runserver 127.0.0.1:8000
   ```
   - **Swagger UI API Documentation**: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
   - **OpenAPI Schema**: [http://127.0.0.1:8000/api/schema/](http://127.0.0.1:8000/api/schema/)
   - **ReDoc**: [http://127.0.0.1:8000/api/redoc/](http://127.0.0.1:8000/api/redoc/)
   - **Django Admin**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

---

### 3.2 Frontend Setup (Angular 19)

1. Open a second PowerShell terminal and navigate to `frontend/`:
   ```powershell
   cd d:\ITSUPPORTDESK\frontend
   ```
2. Start the Angular development server:
   ```powershell
   npm start
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:4200
   ```
4. Use the quick test persona buttons on the login screen to sign in as **Admin**, **Agent**, or **Employee**.

---

## 4. REST API Endpoint Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/login/` | Obtain Access + Refresh JWT tokens | No |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh expired access token | Refresh Token |
| `POST` | `/api/v1/auth/logout/` | Blacklist refresh token & sign out | Yes |
| `GET` | `/api/v1/auth/me/` | Get current user profile & role | Yes |
| `GET`, `POST` | `/api/v1/tickets/` | List / Create support tickets | Yes |
| `GET` | `/api/v1/tickets/{id}/` | Ticket details with comments & attachments | Yes (Participant/Staff) |
| `POST` | `/api/v1/tickets/{id}/status/` | Transition ticket state (validated workflow) | Yes |
| `POST` | `/api/v1/tickets/{id}/assign/` | Assign ticket to support technician | Agent / Admin |
| `GET`, `POST` | `/api/v1/tickets/{id}/comments/` | List or post public comments / internal notes | Yes |
| `POST` | `/api/v1/tickets/{id}/attachments/` | Upload incident screenshot / document | Yes |
| `GET` | `/api/v1/tickets/metrics/` | Aggregated dashboard KPI counters | Yes |
| `GET` | `/api/v1/categories/` | List categories and subcategories | Yes |
| `GET` | `/api/v1/sla-policies/` | SLA response and resolution rules | Yes |
| `GET` | `/api/v1/notifications/` | User in-app notifications | Yes |
| `GET` | `/api/v1/audit-logs/` | System audit trail & change tracking | Admin only |

---

## 5. Automated Test Suite

To run the backend test suite:
```powershell
cd d:\ITSUPPORTDESK\backend
.\venv\Scripts\Activate.ps1
python manage.py test apps.accounts apps.tickets
```
