from rest_framework import serializers
from apps.accounts.models import User, UserRole
from apps.categories.models import Category, SubCategory, PriorityLevel
from apps.categories.serializers import CategorySerializer, SubCategorySerializer
from apps.tickets.models import (
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketHistory,
    TicketStatus,
)

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'webp', 'gif',
    'pdf', 'txt', 'log', 'doc', 'docx', 'xls', 'xlsx', 'csv'
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class TicketAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = [
            'id', 'ticket', 'comment', 'uploaded_by', 'uploaded_by_name',
            'file', 'file_name', 'file_size', 'content_type', 'download_url', 'created_at'
        ]
        read_only_fields = ['uploaded_by', 'file_name', 'file_size', 'content_type', 'download_url', 'created_at']

    def get_download_url(self, obj):
        request = self.context.get('request')
        url = f"/api/v1/tickets/{obj.ticket_id}/attachments/{obj.id}/download/"
        if request:
            return request.build_absolute_uri(url)
        return url

    def validate_file(self, file_obj):
        if file_obj.size > MAX_FILE_SIZE_BYTES:
            raise serializers.ValidationError(
                f"File size exceeds 10MB limit (size: {file_obj.size / (1024*1024):.2f}MB)."
            )

        ext = file_obj.name.split('.')[-1].lower() if '.' in file_obj.name else ''
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"File extension '.{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )
        return file_obj


class TicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    author_role = serializers.CharField(source='author.role', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = TicketComment
        fields = [
            'id', 'ticket', 'author', 'author_username', 'author_name',
            'author_role', 'body', 'is_internal', 'created_at'
        ]
        read_only_fields = ['author', 'ticket', 'created_at']


class TicketHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketHistory
        fields = [
            'id', 'ticket', 'changed_by', 'changed_by_name',
            'field_name', 'old_value', 'new_value', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return "System"


class TicketListSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    assigned_agent_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_number', 'title', 'status', 'priority',
            'category', 'category_name', 'subcategory', 'subcategory_name',
            'requester', 'requester_name', 'assigned_agent', 'assigned_agent_name',
            'is_sla_breached', 'is_overdue', 'response_due_at', 'resolution_due_at',
            'created_at', 'updated_at'
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_assigned_agent_name(self, obj):
        if obj.assigned_agent:
            return obj.assigned_agent.get_full_name() or obj.assigned_agent.username
        return None


class TicketDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    subcategory = SubCategorySerializer(read_only=True)
    requester_name = serializers.SerializerMethodField()
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    assigned_agent_name = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    history_records = TicketHistorySerializer(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_number', 'title', 'description', 'status', 'priority',
            'category', 'subcategory', 'requester', 'requester_name', 'requester_email',
            'assigned_agent', 'assigned_agent_name', 'sla_policy',
            'response_due_at', 'resolution_due_at', 'first_responded_at',
            'resolved_at', 'closed_at', 'is_sla_breached', 'is_overdue',
            'comments', 'attachments', 'history_records',
            'created_at', 'updated_at'
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_assigned_agent_name(self, obj):
        if obj.assigned_agent:
            return obj.assigned_agent.get_full_name() or obj.assigned_agent.username
        return None

    def get_comments(self, obj):
        request = self.context.get('request')
        qs = obj.comments.all()
        # Non-staff users (EMPLOYEE) must not see internal comments
        if request and request.user.is_authenticated:
            if request.user.role == UserRole.EMPLOYEE:
                qs = qs.filter(is_internal=False)
        return TicketCommentSerializer(qs, many=True, context=self.context).data


class TicketCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField()
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category'
    )
    subcategory_id = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.filter(is_active=True),
        source='subcategory',
        required=False,
        allow_null=True
    )
    priority = serializers.ChoiceField(
        choices=PriorityLevel.choices,
        default=PriorityLevel.MEDIUM
    )

    def validate(self, attrs):
        category = attrs.get('category')
        subcategory = attrs.get('subcategory')
        if subcategory and subcategory.category != category:
            raise serializers.ValidationError({
                'subcategory_id': f"Subcategory '{subcategory.name}' does not belong to category '{category.name}'."
            })
        return attrs


class TicketUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        required=False
    )
    subcategory_id = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.filter(is_active=True),
        source='subcategory',
        required=False,
        allow_null=True
    )
    assigned_agent_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT']),
        source='assigned_agent',
        required=False,
        allow_null=True
    )

    class Meta:
        model = Ticket
        fields = ['title', 'description', 'priority', 'category_id', 'subcategory_id', 'assigned_agent_id']
        extra_kwargs = {
            'title': {'required': False},
            'description': {'required': False},
            'priority': {'required': False},
        }

    def validate(self, attrs):
        user = self.context['request'].user
        instance = self.instance

        if user.role == UserRole.EMPLOYEE and not user.is_staff:
            # Employees can only edit title and description when status is OPEN
            disallowed = set(attrs.keys()) - {'title', 'description'}
            if disallowed:
                raise serializers.ValidationError(
                    f"Employees cannot modify the following fields: {', '.join(disallowed)}"
                )
            if instance and instance.status != TicketStatus.OPEN:
                raise serializers.ValidationError(
                    "Only tickets in OPEN status can be modified by the requester."
                )
        elif user.role in (UserRole.SUPPORT_AGENT, 'AGENT') and not (user.role == UserRole.ADMIN or user.is_superuser):
            # Support agents cannot arbitrarily reassign tickets via standard update
            if 'assigned_agent' in attrs:
                raise serializers.ValidationError("Support Agents must use the assign endpoint to reassign tickets.")

        category = attrs.get('category', instance.category if instance else None)
        subcategory = attrs.get('subcategory', instance.subcategory if instance else None)
        if subcategory and category and subcategory.category != category:
            raise serializers.ValidationError({
                'subcategory_id': f"Subcategory '{subcategory.name}' does not belong to category '{category.name}'."
            })

        return attrs


class TicketStatusTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TicketStatus.choices)
    comment = serializers.CharField(required=False, allow_blank=True, default='')


class TicketAssignSerializer(serializers.Serializer):
    agent_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT']),
        source='agent',
        allow_null=True
    )
