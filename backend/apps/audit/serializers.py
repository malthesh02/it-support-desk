from rest_framework import serializers
from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_username', 'actor_name',
            'action', 'resource_type', 'resource_id',
            'ip_address', 'user_agent',
            'payload_before', 'payload_after', 'created_at'
        ]
