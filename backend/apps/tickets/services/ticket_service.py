from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.accounts.models import UserRole
from apps.audit.models import AuditAction, AuditLog
from apps.categories.models import SlaPolicy, PriorityLevel
from apps.notifications.models import Notification, NotificationType
from apps.tickets.models import (
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketHistory,
    TicketStatus,
)


def generate_ticket_number() -> str:
    """Generates sequential monthly incident ticket identifier (e.g. INC-202609-0001)."""
    now = timezone.now()
    prefix = f"INC-{now.strftime('%Y%m')}"
    latest_ticket = Ticket.objects.filter(
        ticket_number__startswith=prefix
    ).order_by('-ticket_number').first()

    if latest_ticket:
        try:
            last_seq = int(latest_ticket.ticket_number.split('-')[-1])
            new_seq = last_seq + 1
        except ValueError:
            new_seq = 1
    else:
        new_seq = 1

    return f"{prefix}-{new_seq:04d}"


DEFAULT_SLA_TARGETS = {
    PriorityLevel.CRITICAL: {
        'name': 'Critical SLA Policy',
        'response_time_minutes': 15,
        'resolution_time_minutes': 120,  # 2 hours
    },
    PriorityLevel.HIGH: {
        'name': 'High SLA Policy',
        'response_time_minutes': 60,   # 1 hour
        'resolution_time_minutes': 480,  # 8 hours
    },
    PriorityLevel.MEDIUM: {
        'name': 'Medium SLA Policy',
        'response_time_minutes': 240,  # 4 hours
        'resolution_time_minutes': 1440, # 24 hours
    },
    PriorityLevel.LOW: {
        'name': 'Low SLA Policy',
        'response_time_minutes': 480,  # 8 hours
        'resolution_time_minutes': 2880, # 48 hours
    },
}


def get_sla_policy(priority: str) -> SlaPolicy:
    """Retrieves active SLA policy for priority level, auto-provisioning standard defaults if missing."""
    policy = SlaPolicy.objects.filter(priority=priority, is_active=True).first()
    if not policy and priority in DEFAULT_SLA_TARGETS:
        defaults = DEFAULT_SLA_TARGETS[priority]
        policy, _ = SlaPolicy.objects.get_or_create(
            priority=priority,
            defaults={
                'name': defaults['name'],
                'response_time_minutes': defaults['response_time_minutes'],
                'resolution_time_minutes': defaults['resolution_time_minutes'],
                'is_active': True,
            }
        )
    return policy


class TicketService:
    @staticmethod
    @transaction.atomic
    def create_ticket(
        requester,
        title: str,
        description: str,
        category,
        subcategory=None,
        priority: str = PriorityLevel.MEDIUM,
        attachments=None
    ) -> Ticket:
        ticket_number = generate_ticket_number()
        sla_policy = get_sla_policy(priority)
        now = timezone.now()

        response_due = None
        resolution_due = None
        if sla_policy:
            response_due = now + timedelta(minutes=sla_policy.response_time_minutes)
            resolution_due = now + timedelta(minutes=sla_policy.resolution_time_minutes)

        ticket = Ticket.objects.create(
            ticket_number=ticket_number,
            title=title,
            description=description,
            requester=requester,
            category=category,
            subcategory=subcategory,
            priority=priority,
            status=TicketStatus.OPEN,
            sla_policy=sla_policy,
            response_due_at=response_due,
            resolution_due_at=resolution_due,
        )

        # Record Initial History
        TicketHistory.objects.create(
            ticket=ticket,
            changed_by=requester,
            field_name='created',
            old_value=None,
            new_value=f"Ticket created with priority {priority}"
        )

        # Audit Log
        AuditLog.objects.create(
            actor=requester,
            action=AuditAction.CREATE,
            resource_type='Ticket',
            resource_id=str(ticket.id),
            payload_after={'ticket_number': ticket.ticket_number, 'priority': priority, 'title': title}
        )

        # Attachments handling if provided during creation
        if attachments:
            for file_obj in attachments:
                TicketAttachment.objects.create(
                    ticket=ticket,
                    uploaded_by=requester,
                    file=file_obj,
                    file_name=file_obj.name,
                    file_size=file_obj.size,
                    content_type=getattr(file_obj, 'content_type', 'application/octet-stream')
                )

        return ticket

    @staticmethod
    @transaction.atomic
    def update_ticket(ticket: Ticket, validated_data: dict, actor) -> Ticket:
        """
        Updates ticket fields, records history and audit logs,
        and recalculates SLA deadlines if priority is modified.
        """
        changes = {}
        old_data = {}

        if 'priority' in validated_data and validated_data['priority'] != ticket.priority:
            old_priority = ticket.priority
            new_priority = validated_data['priority']
            ticket.priority = new_priority
            sla_policy = get_sla_policy(new_priority)
            ticket.sla_policy = sla_policy
            if sla_policy:
                now = timezone.now()
                if not ticket.first_responded_at:
                    ticket.response_due_at = ticket.created_at + timedelta(minutes=sla_policy.response_time_minutes)
                if ticket.status not in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
                    ticket.resolution_due_at = ticket.created_at + timedelta(minutes=sla_policy.resolution_time_minutes)
            changes['priority'] = (old_priority, new_priority)
            old_data['priority'] = old_priority

        for field, value in validated_data.items():
            if field == 'priority':
                continue
            old_val = getattr(ticket, field, None)
            if old_val != value:
                changes[field] = (old_val, value)
                old_data[field] = str(old_val) if old_val is not None else None
                setattr(ticket, field, value)

        if changes:
            ticket.save()

            for field_name, (old_v, new_v) in changes.items():
                old_str = getattr(old_v, 'name', None) or getattr(old_v, 'username', None) or (str(old_v) if old_v is not None else '')
                new_str = getattr(new_v, 'name', None) or getattr(new_v, 'username', None) or (str(new_v) if new_v is not None else '')
                TicketHistory.objects.create(
                    ticket=ticket,
                    changed_by=actor,
                    field_name=field_name,
                    old_value=str(old_str),
                    new_value=str(new_str)
                )

            AuditLog.objects.create(
                actor=actor,
                action=AuditAction.UPDATE,
                resource_type='Ticket',
                resource_id=str(ticket.id),
                payload_before=old_data,
                payload_after={k: (getattr(v[1], 'name', None) or getattr(v[1], 'username', None) or str(v[1])) for k, v in changes.items()}
            )

        return ticket

    @staticmethod
    @transaction.atomic
    def transition_status(ticket: Ticket, new_status: str, actor, comment_text: str = None) -> Ticket:
        """
        Validates state machine rules and transitions ticket to new status.
        Records previous status, new status, actor, timestamp, and optional comment in TicketHistory.
        """
        old_status = ticket.status
        now = timezone.now()

        if old_status == new_status:
            raise ValidationError(f"Ticket is already in '{old_status}' status.")

        if old_status in (TicketStatus.CLOSED, TicketStatus.CANCELLED):
            raise ValidationError(f"Tickets in '{old_status}' status cannot undergo any further state transitions.")

        # State transition validation matrix (Phase 5 Business Workflow)
        valid_transitions = {
            TicketStatus.OPEN: [TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
            TicketStatus.ASSIGNED: [TicketStatus.IN_PROGRESS, TicketStatus.OPEN, TicketStatus.CANCELLED],
            TicketStatus.IN_PROGRESS: [TicketStatus.WAITING_FOR_USER, TicketStatus.RESOLVED, TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
            TicketStatus.WAITING_FOR_USER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
            TicketStatus.RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED, TicketStatus.CANCELLED],
            TicketStatus.REOPENED: [TicketStatus.IN_PROGRESS, TicketStatus.ASSIGNED, TicketStatus.CANCELLED],
            TicketStatus.CLOSED: [],
            TicketStatus.CANCELLED: [],
        }

        allowed_next = valid_transitions.get(old_status, [])
        if new_status not in allowed_next:
            raise ValidationError(
                f"Invalid transition from '{old_status}' to '{new_status}'. Allowed: {allowed_next}"
            )

        # RBAC checks on transition
        is_admin_or_agent = (
            actor.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') or actor.is_staff or actor.is_superuser
        )
        is_admin = actor.role == UserRole.ADMIN or actor.is_staff or actor.is_superuser
        is_owner = ticket.requester_id == actor.id

        if new_status == TicketStatus.ASSIGNED:
            if not is_admin_or_agent:
                raise PermissionDenied("Only support agents or administrators can assign tickets.")
            if not ticket.assigned_agent and actor.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT'):
                ticket.assigned_agent = actor

        elif new_status == TicketStatus.IN_PROGRESS:
            if old_status == TicketStatus.WAITING_FOR_USER:
                if not (is_owner or is_admin_or_agent):
                    raise PermissionDenied("Only the requester or support agents can resume ticket to In Progress.")
            else:
                if not is_admin_or_agent:
                    raise PermissionDenied("Only support agents or administrators can start work on tickets.")

        elif new_status == TicketStatus.WAITING_FOR_USER:
            if not is_admin_or_agent:
                raise PermissionDenied("Only support agents or administrators can request user information.")

        elif new_status == TicketStatus.RESOLVED:
            if not is_admin_or_agent:
                raise PermissionDenied("Only support agents or administrators can resolve tickets.")

        elif new_status == TicketStatus.CLOSED:
            if not (is_owner or is_admin):
                raise PermissionDenied("Only the requester or an administrator can close this ticket.")

        elif new_status == TicketStatus.REOPENED:
            if not (is_owner or is_admin):
                raise PermissionDenied("Only the requester or an administrator can reopen this ticket.")

        elif new_status == TicketStatus.CANCELLED:
            if not (is_owner or is_admin):
                raise PermissionDenied("Only the requester or an administrator can cancel this ticket.")

        # Update ticket status and timestamps
        ticket.status = new_status

        if new_status == TicketStatus.RESOLVED:
            ticket.resolved_at = now
            if ticket.resolution_due_at and now > ticket.resolution_due_at:
                ticket.is_sla_breached = True
        elif new_status == TicketStatus.CLOSED:
            ticket.closed_at = now
        elif new_status == TicketStatus.REOPENED:
            ticket.resolved_at = None

        ticket.save()

        # Add optional reason/comment if provided
        if comment_text and comment_text.strip():
            TicketComment.objects.create(
                ticket=ticket,
                author=actor,
                body=comment_text.strip(),
                is_internal=False
            )

        # Record TicketHistory
        TicketHistory.objects.create(
            ticket=ticket,
            changed_by=actor,
            field_name='status',
            old_value=old_status,
            new_value=new_status
        )

        # Dispatch In-App Notification
        recipient = ticket.requester if is_admin_or_agent else ticket.assigned_agent
        if recipient and recipient != actor:
            Notification.objects.create(
                recipient=recipient,
                ticket=ticket,
                title=f"Ticket {ticket.ticket_number} Status Updated",
                message=f"Status changed from {old_status} to {new_status} by {actor.get_full_name() or actor.username}.",
                notification_type=NotificationType.STATUS_CHANGED
            )

        # Audit Log
        AuditLog.objects.create(
            actor=actor,
            action=AuditAction.STATUS_CHANGE,
            resource_type='Ticket',
            resource_id=str(ticket.id),
            payload_before={'status': old_status},
            payload_after={'status': new_status, 'comment': comment_text}
        )

        return ticket

    @staticmethod
    @transaction.atomic
    def assign_agent(ticket: Ticket, agent, actor) -> Ticket:
        """Assigns ticket to a support agent and sets status to ASSIGNED if OPEN."""
        is_admin = actor.role == UserRole.ADMIN or actor.is_staff or actor.is_superuser
        is_agent = actor.role in (UserRole.SUPPORT_AGENT, 'AGENT')
        if not (is_admin or is_agent):
            raise PermissionDenied("Only support agents or administrators can assign tickets.")

        # If already assigned to another agent, only admin can reassign
        if ticket.assigned_agent and ticket.assigned_agent != actor and not is_admin:
            raise PermissionDenied("Only administrators can reassign tickets assigned to another agent.")

        old_agent_str = ticket.assigned_agent.username if ticket.assigned_agent else "Unassigned"
        new_agent_str = agent.username if agent else "Unassigned"

        ticket.assigned_agent = agent
        old_status = ticket.status
        status_changed = False

        if agent is not None and ticket.status == TicketStatus.OPEN:
            ticket.status = TicketStatus.ASSIGNED
            status_changed = True
        elif agent is None and ticket.status == TicketStatus.ASSIGNED:
            ticket.status = TicketStatus.OPEN
            status_changed = True

        ticket.save()

        # History for status change if status changed
        if status_changed:
            TicketHistory.objects.create(
                ticket=ticket,
                changed_by=actor,
                field_name='status',
                old_value=old_status,
                new_value=ticket.status
            )

        # History for agent assignment
        TicketHistory.objects.create(
            ticket=ticket,
            changed_by=actor,
            field_name='assigned_agent',
            old_value=old_agent_str,
            new_value=new_agent_str
        )

        # Notify assigned agent
        if agent and agent != actor:
            Notification.objects.create(
                recipient=agent,
                ticket=ticket,
                title=f"Ticket {ticket.ticket_number} Assigned",
                message=f"You have been assigned ticket '{ticket.title}' by {actor.username}.",
                notification_type=NotificationType.ASSIGNED
            )

        # Audit Log
        AuditLog.objects.create(
            actor=actor,
            action=AuditAction.UPDATE,
            resource_type='Ticket',
            resource_id=str(ticket.id),
            payload_before={'assigned_agent': old_agent_str},
            payload_after={'assigned_agent': new_agent_str}
        )

        return ticket

    @staticmethod
    @transaction.atomic
    def add_comment(ticket: Ticket, author, body: str, is_internal: bool = False) -> TicketComment:
        """Adds a comment, tracks initial response SLA, and handles pending user resume."""
        if is_internal and author.role == UserRole.EMPLOYEE:
            raise PermissionDenied("Employees cannot create internal notes.")

        now = timezone.now()
        comment = TicketComment.objects.create(
            ticket=ticket,
            author=author,
            body=body,
            is_internal=is_internal
        )

        # Record TicketHistory for comment added
        TicketHistory.objects.create(
            ticket=ticket,
            changed_by=author,
            field_name='comment_added',
            old_value=None,
            new_value=f"{'Internal note' if is_internal else 'Public comment'} added"
        )

        # Track first response time if comment is from agent/admin and not internal
        is_staff_user = (
            author.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') or author.is_staff
        )
        if is_staff_user and not is_internal and ticket.first_responded_at is None:
            ticket.first_responded_at = now
            if ticket.response_due_at and now > ticket.response_due_at:
                ticket.is_sla_breached = True
            ticket.save(update_fields=['first_responded_at', 'is_sla_breached', 'updated_at'])

        # If requester replied and ticket was WAITING_FOR_USER, resume IN_PROGRESS
        if author == ticket.requester and ticket.status in (TicketStatus.WAITING_FOR_USER, 'PENDING_USER'):
            old_st = ticket.status
            ticket.status = TicketStatus.IN_PROGRESS
            ticket.save(update_fields=['status', 'updated_at'])
            TicketHistory.objects.create(
                ticket=ticket,
                changed_by=author,
                field_name='status',
                old_value=old_st,
                new_value=TicketStatus.IN_PROGRESS
            )

        # Notify other party if public comment
        if not is_internal:
            recipient = ticket.requester if is_staff_user else ticket.assigned_agent
            if recipient and recipient != author:
                Notification.objects.create(
                    recipient=recipient,
                    ticket=ticket,
                    title=f"New Comment on {ticket.ticket_number}",
                    message=f"{author.get_full_name() or author.username} commented: {body[:80]}...",
                    notification_type=NotificationType.COMMENT_ADDED
                )

        return comment

    @staticmethod
    @transaction.atomic
    def add_attachment(ticket: Ticket, uploaded_by, file_obj, comment=None) -> TicketAttachment:
        """Attaches a validated file to the ticket, records history and audit logs."""
        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            comment=comment,
            uploaded_by=uploaded_by,
            file=file_obj,
            file_name=file_obj.name,
            file_size=file_obj.size,
            content_type=getattr(file_obj, 'content_type', 'application/octet-stream')
        )

        # Record TicketHistory
        TicketHistory.objects.create(
            ticket=ticket,
            changed_by=uploaded_by,
            field_name='attachment_added',
            old_value=None,
            new_value=file_obj.name
        )

        # Audit Log
        AuditLog.objects.create(
            actor=uploaded_by,
            action=AuditAction.CREATE,
            resource_type='TicketAttachment',
            resource_id=str(attachment.id),
            payload_after={'file_name': file_obj.name, 'file_size': file_obj.size}
        )

        return attachment

