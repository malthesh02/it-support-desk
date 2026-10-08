from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    ticket_number = serializers.CharField(source='ticket.ticket_number', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'ticket', 'ticket_number', 'title',
            'message', 'notification_type', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'recipient', 'ticket', 'created_at']
