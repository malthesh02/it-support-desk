from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from apps.accounts.models import Department, UserRole
from apps.categories.models import Category, PriorityLevel
from apps.tickets.models import Ticket, TicketComment, TicketStatus

User = get_user_model()


class AuthenticationAndAuthorizationTests(APITestCase):
    def setUp(self):
        self.dept_it = Department.objects.create(name="IT Support", code="IT")
        self.dept_eng = Department.objects.create(name="Engineering", code="ENG")

        # 1. Administrator
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@test.local",
            password="AdminPassword123!",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            department=self.dept_it,
            is_staff=True,
            is_superuser=True
        )

        # 2. Support Agent
        self.agent = User.objects.create_user(
            username="agent_user",
            email="agent@test.local",
            password="AgentPassword123!",
            first_name="Support",
            last_name="Agent",
            role=UserRole.SUPPORT_AGENT,
            department=self.dept_it,
            is_staff=True
        )

        # 3. Employee 1
        self.employee1 = User.objects.create_user(
            username="emp1_user",
            email="emp1@test.local",
            password="EmpPassword123!",
            first_name="Alice",
            last_name="Smith",
            role=UserRole.EMPLOYEE,
            department=self.dept_eng
        )

        # 4. Employee 2
        self.employee2 = User.objects.create_user(
            username="emp2_user",
            email="emp2@test.local",
            password="EmpPassword123!",
            first_name="Bob",
            last_name="Jones",
            role=UserRole.EMPLOYEE,
            department=self.dept_eng
        )

        # Category for ticket tests
        self.category = Category.objects.create(name="Hardware")

    # ==========================================
    # 1. REGISTRATION TESTS
    # ==========================================
    def test_user_registration_success(self):
        url = reverse('auth_register')
        payload = {
            'username': 'new_hire',
            'email': 'newhire@test.local',
            'first_name': 'New',
            'last_name': 'Hire',
            'password': 'SecurePassword123!',
            'password_confirm': 'SecurePassword123!',
            'department_id': self.dept_eng.id,
            'role': 'ADMIN'  # Attempting privilege escalation
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

        # Verify password hashing
        created_user = User.objects.get(username='new_hire')
        self.assertTrue(created_user.check_password('SecurePassword123!'))
        self.assertNotEqual(created_user.password, 'SecurePassword123!')

        # Verify role is strictly forced to EMPLOYEE (prevents privilege escalation)
        self.assertEqual(created_user.role, UserRole.EMPLOYEE)

    def test_registration_password_mismatch_fails(self):
        url = reverse('auth_register')
        payload = {
            'username': 'mismatch_user',
            'email': 'mismatch@test.local',
            'password': 'SecurePassword123!',
            'password_confirm': 'DifferentPassword123!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data['error']['details'])

    def test_registration_duplicate_email_fails(self):
        url = reverse('auth_register')
        payload = {
            'username': 'another_alice',
            'email': 'emp1@test.local',  # Duplicate email
            'password': 'SecurePassword123!',
            'password_confirm': 'SecurePassword123!',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ==========================================
    # 2. LOGIN & DUAL IDENTIFIER AUTH TESTS
    # ==========================================
    def test_login_with_username(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'username': 'emp1_user',
            'password': 'EmpPassword123!'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['email'], 'emp1@test.local')
        self.assertEqual(response.data['user']['role'], UserRole.EMPLOYEE)

    def test_login_with_email(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'username': 'emp1@test.local',  # Login using email
            'password': 'EmpPassword123!'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], 'emp1_user')

    def test_login_invalid_password_fails(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'username': 'emp1_user',
            'password': 'WrongPassword!'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'AUTHENTICATION_FAILED')

    # ==========================================
    # 3. LOGOUT & TOKEN INVALIDATION TESTS
    # ==========================================
    def test_logout_blacklists_token(self):
        # 1. Login to obtain tokens
        login_resp = self.client.post(reverse('token_obtain_pair'), {
            'username': 'emp1_user',
            'password': 'EmpPassword123!'
        }, format='json')
        access = login_resp.data['access']
        refresh = login_resp.data['refresh']

        # 2. Logout with access token authorization
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        logout_resp = self.client.post(reverse('auth_logout'), {'refresh': refresh}, format='json')
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

        # 3. Refreshing with blacklisted token must fail with 401
        self.client.credentials()  # Clear authorization
        refresh_resp = self.client.post(reverse('token_refresh'), {'refresh': refresh}, format='json')
        self.assertEqual(refresh_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # ==========================================
    # 4. CURRENT USER & PASSWORD CHANGE TESTS
    # ==========================================
    def test_current_user_profile_and_partial_update(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('auth_me')

        # GET Profile
        get_resp = self.client.get(url)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['username'], 'emp1_user')
        self.assertEqual(get_resp.data['role'], UserRole.EMPLOYEE)

        # PATCH Profile
        patch_resp = self.client.patch(url, {
            'first_name': 'Alicia',
            'phone_number': '+1-555-0199'
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['first_name'], 'Alicia')
        self.assertEqual(patch_resp.data['phone_number'], '+1-555-0199')

    def test_change_password_success_and_relogin(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('auth_change_password')
        payload = {
            'old_password': 'EmpPassword123!',
            'new_password': 'BrandNewPassword789!',
            'new_password_confirm': 'BrandNewPassword789!'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Clear credentials and verify login with new password
        self.client.credentials()
        login_resp = self.client.post(reverse('token_obtain_pair'), {
            'username': 'emp1_user',
            'password': 'BrandNewPassword789!'
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)

    # ==========================================
    # 5. ROLE-BASED AUTHORIZATION RULES
    # ==========================================
    def test_employee_can_create_and_view_own_ticket(self):
        self.client.force_authenticate(user=self.employee1)

        # Create ticket
        create_resp = self.client.post(reverse('ticket-list'), {
            'title': 'Keyboard issue',
            'description': 'Spacebar sticking',
            'category_id': self.category.id,
            'priority': PriorityLevel.LOW
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        ticket_id = create_resp.data['id']

        # View own ticket
        detail_resp = self.client.get(reverse('ticket-detail', kwargs={'pk': ticket_id}))
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data['title'], 'Keyboard issue')

    def test_employee_cannot_access_other_employee_ticket(self):
        # Employee 1 creates a ticket
        self.client.force_authenticate(user=self.employee1)
        ticket_resp = self.client.post(reverse('ticket-list'), {
            'title': 'Confidential Payroll Laptop Issue',
            'description': 'Encrypted drive fault',
            'category_id': self.category.id,
            'priority': PriorityLevel.HIGH
        }, format='json')
        ticket_id = ticket_resp.data['id']

        # Employee 2 attempts to view Employee 1's ticket
        self.client.force_authenticate(user=self.employee2)
        unauthorized_resp = self.client.get(reverse('ticket-detail', kwargs={'pk': ticket_id}))
        # Returns 404 because QuerySet is scoped to requester for employees
        self.assertEqual(unauthorized_resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_can_update_permitted_fields_on_open_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        ticket_resp = self.client.post(reverse('ticket-list'), {
            'title': 'Initial Title',
            'description': 'Initial Description',
            'category_id': self.category.id,
            'priority': PriorityLevel.LOW
        }, format='json')
        ticket_id = ticket_resp.data['id']

        # Permitted update: title & description while OPEN
        patch_resp = self.client.patch(
            reverse('ticket-detail', kwargs={'pk': ticket_id}),
            {'title': 'Updated Title', 'description': 'Updated Description'},
            format='json'
        )
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['title'], 'Updated Title')

        # Disallowed update: employee trying to change priority
        illegal_resp = self.client.patch(
            reverse('ticket-detail', kwargs={'pk': ticket_id}),
            {'priority': PriorityLevel.CRITICAL},
            format='json'
        )
        self.assertEqual(illegal_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_support_agent_workflow_and_resolution(self):
        # Employee creates ticket
        self.client.force_authenticate(user=self.employee1)
        ticket_resp = self.client.post(reverse('ticket-list'), {
            'title': 'Network Failure',
            'description': 'No connectivity in office',
            'category_id': self.category.id,
            'priority': PriorityLevel.HIGH
        }, format='json')
        ticket_id = ticket_resp.data['id']

        # Support Agent views ticket and assigns to self
        self.client.force_authenticate(user=self.agent)
        assign_resp = self.client.post(
            reverse('ticket-assign-agent', kwargs={'pk': ticket_id}),
            {'agent_id': self.agent.id},
            format='json'
        )
        self.assertEqual(assign_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(assign_resp.data['status'], TicketStatus.ASSIGNED)

        # Agent starts work: ASSIGNED -> IN_PROGRESS
        status_url = reverse('ticket-change-status', kwargs={'pk': ticket_id})
        progress_resp = self.client.post(
            status_url,
            {'status': TicketStatus.IN_PROGRESS, 'comment': 'Starting investigation.'},
            format='json'
        )
        self.assertEqual(progress_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(progress_resp.data['status'], TicketStatus.IN_PROGRESS)

        # Agent comments (both public and internal)
        comments_url = reverse('ticket-comments', kwargs={'pk': ticket_id})
        public_comm = self.client.post(comments_url, {'body': 'Working on router.'}, format='json')
        self.assertEqual(public_comm.status_code, status.HTTP_201_CREATED)

        # Agent resolves ticket
        status_url = reverse('ticket-change-status', kwargs={'pk': ticket_id})
        resolve_resp = self.client.post(
            status_url,
            {'status': TicketStatus.RESOLVED, 'comment': 'Router rebooted, traffic normalized.'},
            format='json'
        )
        self.assertEqual(resolve_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resolve_resp.data['status'], TicketStatus.RESOLVED)

    def test_support_agent_cannot_manage_users(self):
        # Support agent trying to access admin users endpoint
        self.client.force_authenticate(user=self.agent)
        users_resp = self.client.get(reverse('user-list'))
        self.assertEqual(users_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(users_resp.data['success'])
        self.assertEqual(users_resp.data['error']['code'], 'PERMISSION_DENIED')

    def test_admin_has_full_management_access(self):
        self.client.force_authenticate(user=self.admin)

        # Admin can view all users
        users_resp = self.client.get(reverse('user-list'))
        self.assertEqual(users_resp.status_code, status.HTTP_200_OK)

        # Admin can create categories
        cat_resp = self.client.post(reverse('category-list'), {'name': 'Cloud Infrastructure'}, format='json')
        self.assertEqual(cat_resp.status_code, status.HTTP_201_CREATED)

        # Admin can view audit logs
        audit_resp = self.client.get(reverse('audit-log-list'))
        self.assertEqual(audit_resp.status_code, status.HTTP_200_OK)
