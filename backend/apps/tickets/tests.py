from datetime import timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from apps.accounts.models import Department, UserRole
from apps.audit.models import AuditAction, AuditLog
from apps.categories.models import Category, SubCategory, SlaPolicy, PriorityLevel
from apps.tickets.models import Ticket, TicketAttachment, TicketComment, TicketHistory, TicketStatus
from apps.tickets.services.ticket_service import TicketService

User = get_user_model()


class BaseTicketTestCase(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Users
        self.employee1 = User.objects.create_user(
            username="emp_john",
            email="emp_john@example.com",
            password="Password123!",
            role=UserRole.EMPLOYEE,
            department=self.dept
        )
        self.employee2 = User.objects.create_user(
            username="emp_alice",
            email="emp_alice@example.com",
            password="Password123!",
            role=UserRole.EMPLOYEE,
            department=self.dept
        )
        self.agent1 = User.objects.create_user(
            username="agent_sarah",
            email="agent_sarah@example.com",
            password="Password123!",
            role=UserRole.SUPPORT_AGENT,
            department=self.dept
        )
        self.agent2 = User.objects.create_user(
            username="agent_bob",
            email="agent_bob@example.com",
            password="Password123!",
            role=UserRole.SUPPORT_AGENT,
            department=self.dept
        )
        self.admin = User.objects.create_user(
            username="admin_mike",
            email="admin_mike@example.com",
            password="Password123!",
            role=UserRole.ADMIN,
            is_staff=True,
            department=self.dept
        )

        # Categories & Subcategories
        self.category_hardware = Category.objects.create(name="Hardware")
        self.subcategory_laptop = SubCategory.objects.create(
            category=self.category_hardware,
            name="Laptop Repair"
        )
        self.category_software = Category.objects.create(name="Software")
        self.subcategory_email = SubCategory.objects.create(
            category=self.category_software,
            name="Email Client"
        )

        # SLA Policies
        self.sla_low = SlaPolicy.objects.create(
            name="Low SLA",
            priority=PriorityLevel.LOW,
            response_time_minutes=240,
            resolution_time_minutes=1440
        )
        self.sla_medium = SlaPolicy.objects.create(
            name="Medium SLA",
            priority=PriorityLevel.MEDIUM,
            response_time_minutes=120,
            resolution_time_minutes=720
        )
        self.sla_high = SlaPolicy.objects.create(
            name="High SLA",
            priority=PriorityLevel.HIGH,
            response_time_minutes=30,
            resolution_time_minutes=240
        )


class TicketCreateAPITests(BaseTicketTestCase):
    def test_employee_create_ticket_success(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')
        payload = {
            'title': 'Cracked Laptop Screen',
            'description': 'Screen damaged during business commute.',
            'category_id': self.category_hardware.id,
            'subcategory_id': self.subcategory_laptop.id,
            'priority': PriorityLevel.HIGH
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data

        # 1. Unique human-readable ticket number generated
        self.assertTrue(data['ticket_number'].startswith('INC-'))
        # 2. Status initially OPEN
        self.assertEqual(data['status'], TicketStatus.OPEN)
        # 3. Requester is the authenticated employee
        self.assertEqual(data['requester'], self.employee1.id)
        # 4. SLA calculated
        self.assertIsNotNone(data['response_due_at'])
        self.assertIsNotNone(data['resolution_due_at'])

        # Check DB records
        ticket = Ticket.objects.get(id=data['id'])
        self.assertEqual(ticket.title, 'Cracked Laptop Screen')
        self.assertEqual(ticket.requester, self.employee1)
        self.assertFalse(ticket.is_sla_breached)

        # History and Audit Log verified
        self.assertTrue(ticket.history_records.filter(field_name='created').exists())
        self.assertTrue(AuditLog.objects.filter(resource_id=str(ticket.id), action=AuditAction.CREATE).exists())

    def test_create_ticket_ignores_protected_fields(self):
        """User cannot manipulate ticket_number, status, requester, or SLA breach directly."""
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')
        payload = {
            'title': 'Server Down',
            'description': 'Main server is unreachable.',
            'category_id': self.category_hardware.id,
            'priority': PriorityLevel.HIGH,
            'ticket_number': 'INC-999999-9999',
            'status': TicketStatus.RESOLVED,
            'is_sla_breached': True,
            'requester': self.employee2.id,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get(id=response.data['id'])
        # Protected fields must not be influenced by input payload
        self.assertNotEqual(ticket.ticket_number, 'INC-999999-9999')
        self.assertEqual(ticket.status, TicketStatus.OPEN)
        self.assertEqual(ticket.requester, self.employee1)
        self.assertFalse(ticket.is_sla_breached)

    def test_create_ticket_validation_missing_required_fields(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')

        # Empty payload
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data['error']['details']
        self.assertIn('title', details)
        self.assertIn('description', details)
        self.assertIn('category_id', details)

    def test_create_ticket_invalid_subcategory_mismatch(self):
        """Subcategory must belong to the selected Category."""
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')
        payload = {
            'title': 'Misconfigured Category and Subcategory',
            'description': 'Hardware category with Email subcategory.',
            'category_id': self.category_hardware.id,
            'subcategory_id': self.subcategory_email.id,  # belongs to software!
            'priority': PriorityLevel.LOW
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data['error']['details']
        self.assertIn('subcategory_id', details)

    def test_unauthenticated_cannot_create_ticket(self):
        url = reverse('ticket-list')
        response = self.client.post(url, {'title': 'Test'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TicketReadAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket1 = TicketService.create_ticket(
            requester=self.employee1,
            title="Employee 1 Ticket",
            description="Details for emp1 ticket",
            category=self.category_hardware,
            priority=PriorityLevel.MEDIUM
        )
        self.ticket2 = TicketService.create_ticket(
            requester=self.employee2,
            title="Employee 2 Ticket",
            description="Details for emp2 ticket",
            category=self.category_software,
            priority=PriorityLevel.LOW
        )

    def test_employee_only_sees_own_tickets_in_list(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        ticket_ids = [t['id'] for t in results]

        self.assertIn(self.ticket1.id, ticket_ids)
        self.assertNotIn(self.ticket2.id, ticket_ids)
        self.assertEqual(response.data['count'], 1)

    def test_employee_can_retrieve_own_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket1.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.ticket1.id)
        self.assertEqual(response.data['title'], "Employee 1 Ticket")

    def test_employee_cannot_retrieve_other_employee_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket2.id})
        response = self.client.get(url)

        # Scoping query returns 404 because ticket2 does not exist in employee1's queryset
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_support_agent_sees_all_tickets(self):
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        ticket_ids = [t['id'] for t in response.data['results']]
        self.assertIn(self.ticket1.id, ticket_ids)
        self.assertIn(self.ticket2.id, ticket_ids)

    def test_admin_sees_all_tickets(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)


class TicketUpdateAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Original Title",
            description="Original Description",
            category=self.category_hardware,
            priority=PriorityLevel.MEDIUM
        )

    def test_employee_can_update_title_description_on_open_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {
            'title': 'Updated Title by Employee',
            'description': 'Updated Description by Employee'
        }
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, 'Updated Title by Employee')
        self.assertEqual(self.ticket.description, 'Updated Description by Employee')

        # Check TicketHistory
        self.assertTrue(self.ticket.history_records.filter(field_name='title').exists())

    def test_employee_cannot_update_priority_on_open_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {'priority': PriorityLevel.HIGH}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.priority, PriorityLevel.MEDIUM)

    def test_employee_cannot_update_category_on_open_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {'category_id': self.category_software.id}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.category, self.category_hardware)

    def test_employee_cannot_update_ticket_when_not_open(self):
        # Move ticket to ASSIGNED, then IN_PROGRESS
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)
        TicketService.transition_status(self.ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)

        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {'title': 'Trying to update in progress ticket'}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "Original Title")

    def test_support_agent_update_priority_recalculates_sla(self):
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {'priority': PriorityLevel.HIGH}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.priority, PriorityLevel.HIGH)
        self.assertEqual(self.ticket.sla_policy, self.sla_high)

    def test_support_agent_cannot_reassign_via_standard_update(self):
        """Support agents must use the /assign/ action endpoint to reassign."""
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {'assigned_agent_id': self.agent2.id}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.ticket.refresh_from_db()
        self.assertIsNone(self.ticket.assigned_agent)

    def test_admin_can_update_any_editable_field(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        payload = {
            'title': 'Admin Updated Title',
            'priority': PriorityLevel.HIGH,
            'category_id': self.category_software.id,
            'assigned_agent_id': self.agent1.id
        }
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, 'Admin Updated Title')
        self.assertEqual(self.ticket.priority, PriorityLevel.HIGH)
        self.assertEqual(self.ticket.category, self.category_software)
        self.assertEqual(self.ticket.assigned_agent, self.agent1)

    def test_update_ignores_protected_fields(self):
        """Protected fields cannot be manipulated via update payload."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        original_number = self.ticket.ticket_number
        payload = {
            'ticket_number': 'INC-HACKED-0001',
            'status': TicketStatus.CLOSED,
            'is_sla_breached': True,
            'requester': self.employee2.id,
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.ticket_number, original_number)
        self.assertEqual(self.ticket.status, TicketStatus.OPEN)
        self.assertEqual(self.ticket.requester, self.employee1)
        self.assertFalse(self.ticket.is_sla_breached)


class TicketDeleteAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Ticket To Delete",
            description="Details",
            category=self.category_hardware,
            priority=PriorityLevel.LOW
        )

    def test_employee_cannot_delete_ticket(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Ticket.objects.filter(id=self.ticket.id).exists())

    def test_support_agent_cannot_delete_ticket(self):
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Ticket.objects.filter(id=self.ticket.id).exists())

    def test_admin_can_delete_ticket(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-detail', kwargs={'pk': self.ticket.id})
        ticket_id = self.ticket.id
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Ticket.objects.filter(id=ticket_id).exists())
        # Verify Audit Log entry created for deletion
        self.assertTrue(AuditLog.objects.filter(resource_id=str(ticket_id), action=AuditAction.DELETE).exists())


class TicketPaginationAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.tickets = []
        for i in range(5):
            t = TicketService.create_ticket(
                requester=self.employee1,
                title=f"Ticket {i+1}",
                description=f"Description {i+1}",
                category=self.category_hardware,
                priority=PriorityLevel.LOW
            )
            self.tickets.append(t)

    def test_pagination_structure_and_custom_page_size(self):
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-list')
        response = self.client.get(f"{url}?page=1&page_size=2")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 5)
        self.assertEqual(len(response.data['results']), 2)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

        # Page 2
        response_page2 = self.client.get(f"{url}?page=2&page_size=2")
        self.assertEqual(len(response_page2.data['results']), 2)
        self.assertIsNotNone(response_page2.data['next'])
        self.assertIsNotNone(response_page2.data['previous'])

        # Page 3
        response_page3 = self.client.get(f"{url}?page=3&page_size=2")
        self.assertEqual(len(response_page3.data['results']), 1)
        self.assertIsNone(response_page3.data['next'])
        self.assertIsNotNone(response_page3.data['previous'])


class TicketFilterSearchOrderAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.t1 = TicketService.create_ticket(
            requester=self.employee1,
            title="Printer Paper Jam",
            description="Paper jam in 2nd floor laser printer.",
            category=self.category_hardware,
            priority=PriorityLevel.LOW
        )
        self.t2 = TicketService.create_ticket(
            requester=self.employee2,
            title="Outlook Sync Error",
            description="Outlook crashes on startup during email sync.",
            category=self.category_software,
            priority=PriorityLevel.HIGH
        )
        # Assign t2 to agent1 and set to IN_PROGRESS
        TicketService.assign_agent(self.t2, self.agent1, actor=self.admin)
        TicketService.transition_status(self.t2, TicketStatus.IN_PROGRESS, actor=self.agent1)

    def test_filter_by_status(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_open = self.client.get(f"{url}?status=OPEN")
        self.assertEqual(resp_open.data['count'], 1)
        self.assertEqual(resp_open.data['results'][0]['id'], self.t1.id)

        resp_prog = self.client.get(f"{url}?status=IN_PROGRESS")
        self.assertEqual(resp_prog.data['count'], 1)
        self.assertEqual(resp_prog.data['results'][0]['id'], self.t2.id)

    def test_filter_by_priority(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_high = self.client.get(f"{url}?priority=HIGH")
        self.assertEqual(resp_high.data['count'], 1)
        self.assertEqual(resp_high.data['results'][0]['id'], self.t2.id)

    def test_filter_by_category(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_hw = self.client.get(f"{url}?category={self.category_hardware.id}")
        self.assertEqual(resp_hw.data['count'], 1)
        self.assertEqual(resp_hw.data['results'][0]['id'], self.t1.id)

    def test_filter_by_assigned_agent(self):
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-list')

        resp_unassigned = self.client.get(f"{url}?assigned_agent=unassigned")
        self.assertEqual(resp_unassigned.data['count'], 1)
        self.assertEqual(resp_unassigned.data['results'][0]['id'], self.t1.id)

        resp_me = self.client.get(f"{url}?assigned_agent=me")
        self.assertEqual(resp_me.data['count'], 1)
        self.assertEqual(resp_me.data['results'][0]['id'], self.t2.id)

    def test_search_by_title_and_description(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_title = self.client.get(f"{url}?search=Printer")
        self.assertEqual(resp_title.data['count'], 1)
        self.assertEqual(resp_title.data['results'][0]['id'], self.t1.id)

        resp_desc = self.client.get(f"{url}?search=laser")
        self.assertEqual(resp_desc.data['count'], 1)
        self.assertEqual(resp_desc.data['results'][0]['id'], self.t1.id)

    def test_search_by_ticket_number(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_num = self.client.get(f"{url}?search={self.t2.ticket_number}")
        self.assertEqual(resp_num.data['count'], 1)
        self.assertEqual(resp_num.data['results'][0]['id'], self.t2.id)

    def test_ordering(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')

        resp_asc = self.client.get(f"{url}?ordering=created_at")
        results_asc = resp_asc.data['results']
        self.assertEqual(results_asc[0]['id'], self.t1.id)
        self.assertEqual(results_asc[1]['id'], self.t2.id)

        resp_desc = self.client.get(f"{url}?ordering=-created_at")
        results_desc = resp_desc.data['results']
        self.assertEqual(results_desc[0]['id'], self.t2.id)
        self.assertEqual(results_desc[1]['id'], self.t1.id)


class TicketWorkflowActionAPITests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="VPN Connection Failure",
            description="Cannot connect to corporate VPN.",
            category=self.category_software,
            priority=PriorityLevel.HIGH
        )
        self.status_url = reverse('ticket-change-status', kwargs={'pk': self.ticket.id})
        self.assign_url = reverse('ticket-assign-agent', kwargs={'pk': self.ticket.id})

    def test_agent_assignment_transitions_to_assigned(self):
        self.client.force_authenticate(user=self.agent1)
        response = self.client.post(self.assign_url, {'agent_id': self.agent1.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assigned_agent, self.agent1)
        self.assertEqual(self.ticket.status, TicketStatus.ASSIGNED)

        # Check TicketHistory for status change and assignment
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.OPEN,
                new_value=TicketStatus.ASSIGNED
            ).exists()
        )
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='assigned_agent',
                new_value=self.agent1.username
            ).exists()
        )

    def test_valid_full_workflow_state_machine(self):
        """
        Tests the entire end-to-end ITIL lifecycle:
        OPEN -> ASSIGNED -> IN_PROGRESS -> WAITING_FOR_USER -> IN_PROGRESS ->
        RESOLVED -> REOPENED -> IN_PROGRESS -> RESOLVED -> CLOSED
        """
        # 1. Assign agent (OPEN -> ASSIGNED)
        self.client.force_authenticate(user=self.agent1)
        assign_res = self.client.post(self.assign_url, {'agent_id': self.agent1.id}, format='json')
        self.assertEqual(assign_res.status_code, status.HTTP_200_OK)
        self.assertEqual(assign_res.data['status'], TicketStatus.ASSIGNED)

        # 2. Agent starts work (ASSIGNED -> IN_PROGRESS)
        res_progress = self.client.post(
            self.status_url,
            {'status': TicketStatus.IN_PROGRESS, 'comment': 'Starting VPN troubleshooting.'},
            format='json'
        )
        self.assertEqual(res_progress.status_code, status.HTTP_200_OK)
        self.assertEqual(res_progress.data['status'], TicketStatus.IN_PROGRESS)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.IN_PROGRESS)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.ASSIGNED,
                new_value=TicketStatus.IN_PROGRESS,
                changed_by=self.agent1
            ).exists()
        )
        self.assertTrue(self.ticket.comments.filter(body='Starting VPN troubleshooting.').exists())

        # 3. Agent requests user input (IN_PROGRESS -> WAITING_FOR_USER)
        res_wait = self.client.post(
            self.status_url,
            {'status': TicketStatus.WAITING_FOR_USER, 'comment': 'Please provide the router IP and error code.'},
            format='json'
        )
        self.assertEqual(res_wait.status_code, status.HTTP_200_OK)
        self.assertEqual(res_wait.data['status'], TicketStatus.WAITING_FOR_USER)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.WAITING_FOR_USER)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.IN_PROGRESS,
                new_value=TicketStatus.WAITING_FOR_USER
            ).exists()
        )

        # 4. Requester replies (WAITING_FOR_USER -> IN_PROGRESS)
        self.client.force_authenticate(user=self.employee1)
        res_reply = self.client.post(
            self.status_url,
            {'status': TicketStatus.IN_PROGRESS, 'comment': 'Error is ERR_VPN_TIMED_OUT with IP 192.168.1.1.'},
            format='json'
        )
        self.assertEqual(res_reply.status_code, status.HTTP_200_OK)
        self.assertEqual(res_reply.data['status'], TicketStatus.IN_PROGRESS)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.IN_PROGRESS)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.WAITING_FOR_USER,
                new_value=TicketStatus.IN_PROGRESS,
                changed_by=self.employee1
            ).exists()
        )

        # 5. Agent resolves ticket (IN_PROGRESS -> RESOLVED)
        self.client.force_authenticate(user=self.agent1)
        res_resolve = self.client.post(
            self.status_url,
            {'status': TicketStatus.RESOLVED, 'comment': 'Updated subnet route in firewall.'},
            format='json'
        )
        self.assertEqual(res_resolve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_resolve.data['status'], TicketStatus.RESOLVED)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.RESOLVED)
        self.assertIsNotNone(self.ticket.resolved_at)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.IN_PROGRESS,
                new_value=TicketStatus.RESOLVED
            ).exists()
        )

        # 6. Requester reopens ticket (RESOLVED -> REOPENED)
        self.client.force_authenticate(user=self.employee1)
        res_reopen = self.client.post(
            self.status_url,
            {'status': TicketStatus.REOPENED, 'comment': 'Connection dropped again after 10 minutes.'},
            format='json'
        )
        self.assertEqual(res_reopen.status_code, status.HTTP_200_OK)
        self.assertEqual(res_reopen.data['status'], TicketStatus.REOPENED)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.REOPENED)
        self.assertIsNone(self.ticket.resolved_at)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.RESOLVED,
                new_value=TicketStatus.REOPENED
            ).exists()
        )

        # 7. Agent resumes work on reopened ticket (REOPENED -> IN_PROGRESS)
        self.client.force_authenticate(user=self.agent1)
        res_resume = self.client.post(
            self.status_url,
            {'status': TicketStatus.IN_PROGRESS, 'comment': 'Checking session keepalive timers.'},
            format='json'
        )
        self.assertEqual(res_resume.status_code, status.HTTP_200_OK)
        self.assertEqual(res_resume.data['status'], TicketStatus.IN_PROGRESS)

        # 8. Agent resolves ticket again (IN_PROGRESS -> RESOLVED)
        res_resolve2 = self.client.post(
            self.status_url,
            {'status': TicketStatus.RESOLVED, 'comment': 'Keepalive configured to 300s. Stable now.'},
            format='json'
        )
        self.assertEqual(res_resolve2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_resolve2.data['status'], TicketStatus.RESOLVED)
        self.ticket.refresh_from_db()
        self.assertIsNotNone(self.ticket.resolved_at)

        # 9. Requester closes ticket (RESOLVED -> CLOSED)
        self.client.force_authenticate(user=self.employee1)
        res_close = self.client.post(
            self.status_url,
            {'status': TicketStatus.CLOSED, 'comment': 'Working flawlessly now, thank you!'},
            format='json'
        )
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)
        self.assertEqual(res_close.data['status'], TicketStatus.CLOSED)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.CLOSED)
        self.assertIsNotNone(self.ticket.closed_at)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.RESOLVED,
                new_value=TicketStatus.CLOSED
            ).exists()
        )

    def test_invalid_status_transitions_rejected(self):
        # 1. From OPEN: cannot jump directly to RESOLVED, CLOSED, WAITING_FOR_USER, or REOPENED
        self.client.force_authenticate(user=self.admin)
        for invalid_st in [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.WAITING_FOR_USER, TicketStatus.REOPENED]:
            resp = self.client.post(self.status_url, {'status': invalid_st}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400 for OPEN -> {invalid_st}")

        # 2. From ASSIGNED: cannot jump directly to RESOLVED, CLOSED, or REOPENED
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)
        for invalid_st in [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.REOPENED, TicketStatus.WAITING_FOR_USER]:
            resp = self.client.post(self.status_url, {'status': invalid_st}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400 for ASSIGNED -> {invalid_st}")

        # 3. From IN_PROGRESS: cannot jump to CLOSED or REOPENED
        TicketService.transition_status(self.ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)
        for invalid_st in [TicketStatus.CLOSED, TicketStatus.REOPENED]:
            resp = self.client.post(self.status_url, {'status': invalid_st}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400 for IN_PROGRESS -> {invalid_st}")

        # 4. Same status transition (IN_PROGRESS -> IN_PROGRESS)
        same_resp = self.client.post(self.status_url, {'status': TicketStatus.IN_PROGRESS}, format='json')
        self.assertEqual(same_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. From CLOSED: terminal state, no further transitions allowed
        TicketService.transition_status(self.ticket, TicketStatus.RESOLVED, actor=self.agent1)
        TicketService.transition_status(self.ticket, TicketStatus.CLOSED, actor=self.admin)
        for target_st in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED]:
            resp = self.client.post(self.status_url, {'status': target_st}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, f"Expected 400 for CLOSED -> {target_st}")

    def test_role_authorization_on_status_transitions(self):
        # 1. Employee cannot transition OPEN -> ASSIGNED
        self.client.force_authenticate(user=self.employee1)
        resp1 = self.client.post(self.status_url, {'status': TicketStatus.ASSIGNED}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # Assign ticket properly via admin
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)

        # 2. Employee cannot transition ASSIGNED -> IN_PROGRESS
        resp2 = self.client.post(self.status_url, {'status': TicketStatus.IN_PROGRESS}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

        # Agent moves to IN_PROGRESS
        TicketService.transition_status(self.ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)

        # 3. Employee cannot transition IN_PROGRESS -> WAITING_FOR_USER
        resp3 = self.client.post(self.status_url, {'status': TicketStatus.WAITING_FOR_USER}, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Employee cannot transition IN_PROGRESS -> RESOLVED
        resp4 = self.client.post(self.status_url, {'status': TicketStatus.RESOLVED}, format='json')
        self.assertEqual(resp4.status_code, status.HTTP_403_FORBIDDEN)

        # Agent resolves ticket
        TicketService.transition_status(self.ticket, TicketStatus.RESOLVED, actor=self.agent1)

        # 5. Support Agent cannot close ticket (only requester or admin can close)
        self.client.force_authenticate(user=self.agent1)
        resp5 = self.client.post(self.status_url, {'status': TicketStatus.CLOSED}, format='json')
        self.assertEqual(resp5.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Support Agent cannot reopen ticket (only requester or admin can reopen)
        resp6 = self.client.post(self.status_url, {'status': TicketStatus.REOPENED}, format='json')
        self.assertEqual(resp6.status_code, status.HTTP_403_FORBIDDEN)

        # 7. Requester Employee CAN reopen ticket
        self.client.force_authenticate(user=self.employee1)
        resp7 = self.client.post(self.status_url, {'status': TicketStatus.REOPENED, 'comment': 'Still broken'}, format='json')
        self.assertEqual(resp7.status_code, status.HTTP_200_OK)
        self.assertEqual(resp7.data['status'], TicketStatus.REOPENED)
        self.ticket.refresh_from_db()

        # Agent moves REOPENED -> IN_PROGRESS, then IN_PROGRESS -> RESOLVED
        TicketService.transition_status(self.ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)
        TicketService.transition_status(self.ticket, TicketStatus.RESOLVED, actor=self.agent1)

        # 8. Requester Employee CAN close ticket
        self.client.force_authenticate(user=self.employee1)
        resp8 = self.client.post(self.status_url, {'status': TicketStatus.CLOSED, 'comment': 'All good now'}, format='json')
        self.assertEqual(resp8.status_code, status.HTTP_200_OK)
        self.assertEqual(resp8.data['status'], TicketStatus.CLOSED)

    def test_internal_comments_masked_for_employee(self):
        # Agent posts public and internal comment
        self.client.force_authenticate(user=self.agent1)
        url = reverse('ticket-comments', kwargs={'pk': self.ticket.id})
        self.client.post(url, {'body': 'Public: Investigating now.', 'is_internal': False}, format='json')
        self.client.post(url, {'body': 'Internal: Gateway router restart required.', 'is_internal': True}, format='json')

        # Employee reads comments -> only sees public comment
        self.client.force_authenticate(user=self.employee1)
        emp_resp = self.client.get(url)
        self.assertEqual(emp_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(emp_resp.data), 1)
        self.assertEqual(emp_resp.data[0]['body'], 'Public: Investigating now.')

        # Agent reads comments -> sees both
        self.client.force_authenticate(user=self.agent1)
        agent_resp = self.client.get(url)
        self.assertEqual(agent_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(agent_resp.data), 2)


class TicketAssignmentPhase6Tests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Database Connection Latency",
            description="Database pool is timing out on queries.",
            category=self.category_software,
            priority=PriorityLevel.HIGH
        )
        self.assign_url = reverse('ticket-assign-agent', kwargs={'pk': self.ticket.id})

    def test_admin_can_assign_and_reassign_tickets(self):
        # Admin assigns ticket to agent1
        self.client.force_authenticate(user=self.admin)
        res1 = self.client.post(self.assign_url, {'agent_id': self.agent1.id}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assigned_agent, self.agent1)
        self.assertEqual(self.ticket.status, TicketStatus.ASSIGNED)

        # Admin reassigns ticket to agent2
        res2 = self.client.post(self.assign_url, {'agent_id': self.agent2.id}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assigned_agent, self.agent2)

        # Verify TicketHistory recorded reassignment
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='assigned_agent',
                old_value=self.agent1.username,
                new_value=self.agent2.username
            ).exists()
        )

    def test_agent_cannot_reassign_ticket_assigned_to_another_agent(self):
        # Admin assigns to agent1
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)

        # Agent2 tries to reassign to agent2
        self.client.force_authenticate(user=self.agent2)
        res = self.client.post(self.assign_url, {'agent_id': self.agent2.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_agents_can_view_their_assigned_tickets(self):
        # Assign self.ticket to agent1
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)

        # Create ticket 2 and assign to agent2
        t2 = TicketService.create_ticket(
            requester=self.employee2,
            title="Laptop Screen Glitch",
            description="Flickering screen.",
            category=self.category_hardware,
            priority=PriorityLevel.LOW
        )
        TicketService.assign_agent(t2, self.agent2, actor=self.admin)

        self.client.force_authenticate(user=self.agent1)

        # 1. Via ?assigned_agent=me query param
        res_query = self.client.get(f"{reverse('ticket-list')}?assigned_agent=me")
        self.assertEqual(res_query.status_code, status.HTTP_200_OK)
        self.assertEqual(res_query.data['count'], 1)
        self.assertEqual(res_query.data['results'][0]['id'], self.ticket.id)

        # 2. Via dedicated /assigned-to-me/ endpoint
        res_action = self.client.get(reverse('ticket-assigned-to-me'))
        self.assertEqual(res_action.status_code, status.HTTP_200_OK)
        self.assertEqual(res_action.data['count'], 1)
        self.assertEqual(res_action.data['results'][0]['id'], self.ticket.id)


class TicketCommentPhase6Tests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Printer Paper Jam",
            description="Paper jammed in tray 2.",
            category=self.category_hardware,
            priority=PriorityLevel.LOW
        )
        self.comments_url = reverse('ticket-comments', kwargs={'pk': self.ticket.id})

    def test_employee_and_agent_comment_permissions(self):
        # Employee posts comment
        self.client.force_authenticate(user=self.employee1)
        res_emp = self.client.post(
            self.comments_url,
            {'body': 'I checked tray 2, it is empty now.'},
            format='json'
        )
        self.assertEqual(res_emp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_emp.data['author_username'], self.employee1.username)
        self.assertIsNotNone(res_emp.data['created_at'])
        self.assertFalse(res_emp.data['is_internal'])

        # Employee cannot create internal comment
        res_emp_int = self.client.post(
            self.comments_url,
            {'body': 'Trying internal note', 'is_internal': True},
            format='json'
        )
        self.assertEqual(res_emp_int.status_code, status.HTTP_403_FORBIDDEN)

        # Employee2 cannot comment on employee1's ticket
        self.client.force_authenticate(user=self.employee2)
        res_emp2 = self.client.post(
            self.comments_url,
            {'body': 'Hacking comment'},
            format='json'
        )
        self.assertEqual(res_emp2.status_code, status.HTTP_404_NOT_FOUND)

        # Agent posts internal note
        self.client.force_authenticate(user=self.agent1)
        res_agent = self.client.post(
            self.comments_url,
            {'body': 'Internal note: roller replacement needed', 'is_internal': True},
            format='json'
        )
        self.assertEqual(res_agent.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_agent.data['is_internal'])

        # History recorded for comments
        self.assertTrue(
            self.ticket.history_records.filter(field_name='comment_added').exists()
        )

    def test_comment_auto_resumes_waiting_for_user_ticket(self):
        # Move ticket to ASSIGNED -> IN_PROGRESS -> WAITING_FOR_USER
        TicketService.assign_agent(self.ticket, self.agent1, actor=self.admin)
        TicketService.transition_status(self.ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)
        TicketService.transition_status(self.ticket, TicketStatus.WAITING_FOR_USER, actor=self.agent1)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.WAITING_FOR_USER)

        # Requester employee comments on ticket
        self.client.force_authenticate(user=self.employee1)
        res = self.client.post(
            self.comments_url,
            {'body': 'Cleared the tray, error code is still P-01.'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify ticket automatically transitioned to IN_PROGRESS
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, TicketStatus.IN_PROGRESS)
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='status',
                old_value=TicketStatus.WAITING_FOR_USER,
                new_value=TicketStatus.IN_PROGRESS
            ).exists()
        )


class TicketHistoryPhase6Tests(BaseTicketTestCase):
    def test_full_history_timeline_endpoint(self):
        # Create ticket (History: created)
        ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Email Client Freezing",
            description="Client freezes on startup.",
            category=self.category_software,
            priority=PriorityLevel.LOW
        )

        # Assign ticket (History: assigned_agent)
        TicketService.assign_agent(ticket, self.agent1, actor=self.admin)

        # Priority changed (History: priority)
        TicketService.update_ticket(ticket, {'priority': PriorityLevel.HIGH}, actor=self.agent1)

        # Add comment (History: comment_added)
        TicketService.add_comment(ticket, self.agent1, body="Reviewing event logs.")

        # Status transition: IN_PROGRESS -> RESOLVED (History: status)
        TicketService.transition_status(ticket, TicketStatus.IN_PROGRESS, actor=self.agent1)
        TicketService.transition_status(ticket, TicketStatus.RESOLVED, actor=self.agent1)

        # Requester reopens: RESOLVED -> REOPENED (History: status)
        TicketService.transition_status(ticket, TicketStatus.REOPENED, actor=self.employee1)

        # Fetch history via endpoint
        self.client.force_authenticate(user=self.employee1)
        url = reverse('ticket-history', kwargs={'pk': ticket.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        field_names = [record['field_name'] for record in res.data]
        self.assertIn('created', field_names)
        self.assertIn('assigned_agent', field_names)
        self.assertIn('priority', field_names)
        self.assertIn('comment_added', field_names)
        self.assertIn('status', field_names)


class TicketSlaCalculationPhase6Tests(BaseTicketTestCase):
    def test_default_sla_targets_and_overdue_calculation(self):
        # Create critical priority ticket
        ticket_critical = TicketService.create_ticket(
            requester=self.employee1,
            title="Core Router Offline",
            description="Main switch offline.",
            category=self.category_hardware,
            priority=PriorityLevel.CRITICAL
        )
        self.assertIsNotNone(ticket_critical.response_due_at)
        self.assertIsNotNone(ticket_critical.resolution_due_at)

        # Check calculated delta roughly matches 15m and 120m
        now = timezone.now()
        resp_delta = (ticket_critical.response_due_at - now).total_seconds() / 60
        res_delta = (ticket_critical.resolution_due_at - now).total_seconds() / 60
        self.assertAlmostEqual(resp_delta, 15, delta=2)
        self.assertAlmostEqual(res_delta, 120, delta=2)

        # Not overdue yet
        self.assertFalse(ticket_critical.is_overdue)

        # Simulate overdue by backdating resolution_due_at
        ticket_critical.resolution_due_at = now - timedelta(hours=1)
        ticket_critical.save()
        self.assertTrue(ticket_critical.is_overdue)

        # Filter by ?is_overdue=true
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')
        res_overdue = self.client.get(f"{url}?is_overdue=true")
        self.assertEqual(res_overdue.status_code, status.HTTP_200_OK)
        matching_ids = [t['id'] for t in res_overdue.data['results']]
        self.assertIn(ticket_critical.id, matching_ids)

        # Check metrics reports overdue
        res_metrics = self.client.get(reverse('ticket-metrics'))
        self.assertEqual(res_metrics.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_metrics.data['overdue'], 1)


class TicketAttachmentPhase6Tests(BaseTicketTestCase):
    def setUp(self):
        super().setUp()
        self.ticket = TicketService.create_ticket(
            requester=self.employee1,
            title="Blue Screen on Boot",
            description="BSOD error CRITICAL_PROCESS_DIED.",
            category=self.category_hardware,
            priority=PriorityLevel.HIGH
        )
        self.attachments_url = reverse('ticket-attachments', kwargs={'pk': self.ticket.id})

    def test_upload_valid_attachment(self):
        self.client.force_authenticate(user=self.employee1)
        image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        uploaded_file = SimpleUploadedFile("bsod_screenshot.png", image_content, content_type="image/png")

        res = self.client.post(self.attachments_url, {'file': uploaded_file}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['file_name'], "bsod_screenshot.png")
        self.assertIn("download", res.data['download_url'])

        # Check history recorded
        self.assertTrue(
            self.ticket.history_records.filter(
                field_name='attachment_added',
                new_value="bsod_screenshot.png"
            ).exists()
        )

    def test_upload_invalid_extension_rejected(self):
        self.client.force_authenticate(user=self.employee1)
        malicious_file = SimpleUploadedFile("payload.exe", b"binary content", content_type="application/octet-stream")
        res = self.client.post(self.attachments_url, {'file': malicious_file}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_oversized_file_rejected(self):
        self.client.force_authenticate(user=self.employee1)
        # Create a file object with 11MB of data to exceed 10MB limit
        oversized_file = SimpleUploadedFile("huge_log.txt", b"x" * (11 * 1024 * 1024), content_type="text/plain")
        res = self.client.post(self.attachments_url, {'file': oversized_file}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_protected_attachment_access_authorization(self):
        # Requester uploads attachment
        self.client.force_authenticate(user=self.employee1)
        uploaded_file = SimpleUploadedFile("log.txt", b"system error line 42", content_type="text/plain")
        res_upload = self.client.post(self.attachments_url, {'file': uploaded_file}, format='multipart')
        attachment_id = res_upload.data['id']
        download_url = reverse('ticket-download-attachment', kwargs={'pk': self.ticket.id, 'attachment_id': attachment_id})

        # 1. Requester can download
        self.client.force_authenticate(user=self.employee1)
        dl_res1 = self.client.get(download_url)
        self.assertEqual(dl_res1.status_code, status.HTTP_200_OK)

        # 2. Other employee CANNOT download (isolated queryset returns 404/403)
        self.client.force_authenticate(user=self.employee2)
        dl_res2 = self.client.get(download_url)
        self.assertIn(dl_res2.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 3. Support agent can download
        self.client.force_authenticate(user=self.agent1)
        dl_res3 = self.client.get(download_url)
        self.assertEqual(dl_res3.status_code, status.HTTP_200_OK)

        # 4. Admin can download
        self.client.force_authenticate(user=self.admin)
        dl_res4 = self.client.get(download_url)
        self.assertEqual(dl_res4.status_code, status.HTTP_200_OK)

