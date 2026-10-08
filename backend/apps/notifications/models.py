from django.conf import settings
from django.db import models
from apps.tickets.models import Ticket


class NotificationType(models.TextChoices):
    ASSIGNED = 'ASSIGNED', 'Ticket Assigned'
    STATUS_CHANGED = 'STATUS_CHANGED', 'Status Changed'
    COMMENT_ADDED = 'COMMENT_ADDED', 'Comment Added'
    SLA_WARNING = 'SLA_WARNING', 'SLA Warning'
    SLA_BREACHED = 'SLA_BREACHED', 'SLA Breached'
    GENERAL = 'GENERAL', 'General'


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
        db_index=True
    )
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"
