from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsTicketParticipantOrStaff(BasePermission):
    """
    Employees can only view and interact with their own tickets.
    Support Agents and Administrators have access to all tickets.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Support Agents and Admins have full access to ticket details and workflow
        if request.user.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') or request.user.is_staff:
            return True

        # Employees only have access to tickets they requested
        if hasattr(obj, 'requester_id'):
            return obj.requester_id == request.user.id
        elif hasattr(obj, 'ticket'):
            return obj.ticket.requester_id == request.user.id

        return False
