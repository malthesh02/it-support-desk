from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    LOGIN = 'LOGIN', 'User Login'
    LOGOUT = 'LOGOUT', 'User Logout'
    CREATE = 'CREATE', 'Resource Created'
    UPDATE = 'UPDATE', 'Resource Updated'
    DELETE = 'DELETE', 'Resource Deleted'
    STATUS_CHANGE = 'STATUS_CHANGE', 'Status Changed'
    PERMISSION_CHANGE = 'PERMISSION_CHANGE', 'Permission Changed'


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        db_index=True
    )
    action = models.CharField(
        max_length=50,
        choices=AuditAction.choices,
        db_index=True
    )
    resource_type = models.CharField(max_length=100, db_index=True)
    resource_id = models.CharField(max_length=100, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, null=True, blank=True)
    payload_before = models.JSONField(null=True, blank=True)
    payload_after = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_auditlog'
        ordering = ['-created_at']

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'System'
        return f"[{self.action}] {self.resource_type}:{self.resource_id} by {actor_name} at {self.created_at}"
