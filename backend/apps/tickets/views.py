from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from rest_framework.exceptions import PermissionDenied
from apps.accounts.models import UserRole
from apps.accounts.permissions import IsAgentOrAdminRole
from apps.audit.models import AuditAction, AuditLog
from apps.tickets.models import Ticket, TicketAttachment, TicketHistory, TicketStatus
from apps.tickets.permissions import IsTicketParticipantOrStaff
from apps.tickets.serializers import (
    TicketAssignSerializer,
    TicketAttachmentSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketHistorySerializer,
    TicketListSerializer,
    TicketStatusTransitionSerializer,
    TicketUpdateSerializer,
)
from apps.tickets.services.ticket_service import TicketService


class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsTicketParticipantOrStaff]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['ticket_number', 'title', 'description', 'requester__username', 'requester__email']
    ordering_fields = [
        'created_at', 'updated_at', 'priority', 'status',
        'resolution_due_at', 'response_due_at', 'ticket_number'
    ]
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Ticket.objects.select_related(
            'requester', 'assigned_agent', 'category', 'subcategory', 'sla_policy'
        ).prefetch_related(
            'comments', 'attachments', 'history_records'
        )

        # Scoping QuerySet based on user role (RBAC)
        if user.role == UserRole.EMPLOYEE and not user.is_staff:
            qs = qs.filter(requester=user)

        # Optional query filters
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        priority_param = self.request.query_params.get('priority')
        if priority_param:
            qs = qs.filter(priority=priority_param)

        category_param = self.request.query_params.get('category')
        if category_param:
            qs = qs.filter(category_id=category_param)

        subcategory_param = self.request.query_params.get('subcategory')
        if subcategory_param:
            qs = qs.filter(subcategory_id=subcategory_param)

        assigned_agent_param = self.request.query_params.get('assigned_agent')
        if assigned_agent_param:
            if assigned_agent_param.lower() == 'unassigned':
                qs = qs.filter(assigned_agent__isnull=True)
            elif assigned_agent_param.lower() == 'me':
                qs = qs.filter(assigned_agent=user)
            else:
                qs = qs.filter(assigned_agent_id=assigned_agent_param)

        is_overdue_param = self.request.query_params.get('is_overdue')
        if is_overdue_param is not None:
            now = timezone.now()
            overdue_q = (
                (~Q(status__in=[TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED]) & Q(resolution_due_at__lt=now)) |
                (~Q(status__in=[TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED]) & Q(first_responded_at__isnull=True, response_due_at__lt=now)) |
                Q(is_sla_breached=True)
            )
            if is_overdue_param.lower() in ('true', '1'):
                qs = qs.filter(overdue_q)
            elif is_overdue_param.lower() in ('false', '0'):
                qs = qs.exclude(overdue_q)

        is_sla_breached_param = self.request.query_params.get('is_sla_breached')
        if is_sla_breached_param is not None:
            if is_sla_breached_param.lower() in ('true', '1'):
                qs = qs.filter(is_sla_breached=True)
            elif is_sla_breached_param.lower() in ('false', '0'):
                qs = qs.filter(is_sla_breached=False)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        if self.action == 'create':
            return TicketCreateSerializer
        if self.action in ['update', 'partial_update']:
            return TicketUpdateSerializer
        return TicketDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(TicketDetailSerializer(instance, context={'request': request}).data)

    def perform_update(self, serializer):
        TicketService.update_ticket(
            ticket=serializer.instance,
            validated_data=serializer.validated_data,
            actor=self.request.user
        )

    def destroy(self, request, *args, **kwargs):
        if not (request.user.role == UserRole.ADMIN or request.user.is_superuser):
            raise PermissionDenied("Only administrators can delete tickets.")
        instance = self.get_object()
        AuditLog.objects.create(
            actor=request.user,
            action=AuditAction.DELETE,
            resource_type='Ticket',
            resource_id=str(instance.id),
            payload_before={'ticket_number': instance.ticket_number, 'title': instance.title}
        )
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = TicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ticket = TicketService.create_ticket(
            requester=request.user,
            title=data['title'],
            description=data['description'],
            category=data['category'],
            subcategory=data.get('subcategory'),
            priority=data.get('priority'),
        )

        detail_serializer = TicketDetailSerializer(ticket, context={'request': request})
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='status')
    def change_status(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_ticket = TicketService.transition_status(
            ticket=ticket,
            new_status=serializer.validated_data['status'],
            actor=request.user,
            comment_text=serializer.validated_data.get('comment')
        )
        return Response(TicketDetailSerializer(updated_ticket, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='assign', permission_classes=[IsAuthenticated, IsAgentOrAdminRole])
    def assign_agent(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_ticket = TicketService.assign_agent(
            ticket=ticket,
            agent=serializer.validated_data.get('agent'),
            actor=request.user
        )
        return Response(TicketDetailSerializer(updated_ticket, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        ticket = self.get_object()

        if request.method == 'GET':
            qs = ticket.comments.select_related('author').all()
            if request.user.role == UserRole.EMPLOYEE and not request.user.is_staff:
                qs = qs.filter(is_internal=False)
            serializer = TicketCommentSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)

        # POST comment
        serializer = TicketCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = TicketService.add_comment(
            ticket=ticket,
            author=request.user,
            body=serializer.validated_data['body'],
            is_internal=serializer.validated_data.get('is_internal', False)
        )
        return Response(TicketCommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='attachments',
        parser_classes=[MultiPartParser, FormParser, JSONParser]
    )
    def attachments(self, request, pk=None):
        ticket = self.get_object()

        if request.method == 'GET':
            qs = ticket.attachments.select_related('uploaded_by').all()
            return Response(TicketAttachmentSerializer(qs, many=True, context={'request': request}).data)

        # POST attachment
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"file": ["No file attached in request."]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TicketAttachmentSerializer(data={'file': file_obj, 'ticket': ticket.id})
        serializer.is_valid(raise_exception=True)

        attachment = TicketService.add_attachment(
            ticket=ticket,
            uploaded_by=request.user,
            file_obj=file_obj
        )
        return Response(TicketAttachmentSerializer(attachment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['get'],
        url_path=r'attachments/(?P<attachment_id>\d+)/download'
    )
    def download_attachment(self, request, pk=None, attachment_id=None):
        ticket = self.get_object()
        try:
            attachment = ticket.attachments.get(id=attachment_id)
        except TicketAttachment.DoesNotExist:
            return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        if not attachment.file:
            return Response({"detail": "File not found on storage."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(attachment.file.open('rb'), content_type=attachment.content_type)
        response['Content-Disposition'] = f'inline; filename="{attachment.file_name}"'
        return response

    @action(detail=False, methods=['get'], url_path='assigned-to-me')
    def assigned_to_me(self, request):
        if request.user.role not in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') and not request.user.is_staff:
            raise PermissionDenied("Only support agents or administrators can view assigned tickets.")
        qs = self.filter_queryset(self.get_queryset().filter(assigned_agent=request.user))
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = TicketListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = TicketListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        ticket = self.get_object()
        records = ticket.history_records.select_related('changed_by').all().order_by('-created_at')
        serializer = TicketHistorySerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='metrics')
    def metrics(self, request):
        user = self.request.user
        qs = Ticket.objects.all()
        if user.role == UserRole.EMPLOYEE and not user.is_staff:
            qs = qs.filter(requester=user)

        now = timezone.now()
        overdue_count = qs.filter(
            (~Q(status__in=[TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED]) & Q(resolution_due_at__lt=now)) |
            (~Q(status__in=[TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED]) & Q(first_responded_at__isnull=True, response_due_at__lt=now)) |
            Q(is_sla_breached=True)
        ).count()

        data = {
            'total': qs.count(),
            'open': qs.filter(status=TicketStatus.OPEN).count(),
            'assigned': qs.filter(status=TicketStatus.ASSIGNED).count(),
            'in_progress': qs.filter(status=TicketStatus.IN_PROGRESS).count(),
            'waiting_for_user': qs.filter(status=TicketStatus.WAITING_FOR_USER).count(),
            'resolved': qs.filter(status=TicketStatus.RESOLVED).count(),
            'closed': qs.filter(status=TicketStatus.CLOSED).count(),
            'reopened': qs.filter(status=TicketStatus.REOPENED).count(),
            'high_critical': qs.filter(priority__in=['HIGH', 'CRITICAL']).count(),
            'sla_breached': qs.filter(is_sla_breached=True).count(),
            'overdue': overdue_count,
        }
        return Response(data)

