from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.accounts.permissions import IsAdminUserRole
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('actor').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUserRole]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['resource_type', 'resource_id', 'action', 'actor__username']
    ordering_fields = ['created_at', 'action', 'resource_type']
    ordering = ['-created_at']
