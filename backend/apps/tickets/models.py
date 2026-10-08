import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.categories.models import Category, SubCategory, SlaPolicy, PriorityLevel


class TicketStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    WAITING_FOR_USER = 'WAITING_FOR_USER', 'Waiting for User'
    RESOLVED = 'RESOLVED', 'Resolved'
    CLOSED = 'CLOSED', 'Closed'
    REOPENED = 'REOPENED', 'Reopened'
    CANCELLED = 'CANCELLED', 'Cancelled'


# Backwards compatibility alias
TicketStatus.PENDING_USER = TicketStatus.WAITING_FOR_USER


def ticket_attachment_path(instance, filename):
    ext = filename.split('.')[-1]
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    date_str = timezone.now().strftime('%Y/%m')
    return f"tickets/{date_str}/{safe_filename}"


class Ticket(models.Model):
    ticket_number = models.CharField(max_length=30, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='requested_tickets',
        db_index=True
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets',
        db_index=True
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='tickets',
        db_index=True
    )
    subcategory = models.ForeignKey(
        SubCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tickets'
    )

    priority = models.CharField(
        max_length=20,
        choices=PriorityLevel.choices,
        default=PriorityLevel.MEDIUM,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
        db_index=True
    )

    sla_policy = models.ForeignKey(
        SlaPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tickets'
    )
    response_due_at = models.DateTimeField(null=True, blank=True)
    resolution_due_at = models.DateTimeField(null=True, blank=True)
    first_responded_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    is_sla_breached = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tickets_ticket'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.ticket_number}] {self.title} ({self.status})"

    @property
    def is_response_overdue(self) -> bool:
        """Returns True if the initial response deadline has been exceeded."""
        if not self.response_due_at:
            return False
        if self.first_responded_at:
            return self.first_responded_at > self.response_due_at
        return timezone.now() > self.response_due_at

    @property
    def is_resolution_overdue(self) -> bool:
        """Returns True if the resolution deadline has been exceeded."""
        if not self.resolution_due_at:
            return False
        if self.resolved_at:
            return self.resolved_at > self.resolution_due_at
        if self.status in (TicketStatus.CLOSED, TicketStatus.CANCELLED):
            return False
        return timezone.now() > self.resolution_due_at

    @property
    def is_overdue(self) -> bool:
        """Returns True if either the response or resolution deadline has breached."""
        if self.is_sla_breached:
            return True
        return self.is_response_overdue or self.is_resolution_overdue


class TicketComment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='comments',
        db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='ticket_comments'
    )
    body = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        help_text="Internal notes are visible only to agents and administrators."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tickets_ticketcomment'
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on {self.ticket.ticket_number}"


class TicketAttachment(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='attachments',
        db_index=True
    )
    comment = models.ForeignKey(
        TicketComment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attachments'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='uploaded_attachments'
    )
    file = models.FileField(upload_to=ticket_attachment_path)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField(help_text="Size in bytes")
    content_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tickets_ticketattachment'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_name} ({self.ticket.ticket_number})"


class TicketHistory(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='history_records',
        db_index=True
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_changes'
    )
    field_name = models.CharField(max_length=50)
    old_value = models.CharField(max_length=255, null=True, blank=True)
    new_value = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tickets_tickethistory'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket.ticket_number}: {self.field_name} changed by {self.changed_by}"
