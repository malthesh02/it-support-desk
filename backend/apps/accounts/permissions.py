from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsAdmin(BasePermission):
    """Allows access only to users with the ADMIN role or superusers."""
    message = "Administrator privileges are required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == UserRole.ADMIN or request.user.is_superuser)
        )


class IsSupportAgent(BasePermission):
    """Allows access to Support Agents and Administrators."""
    message = "Support Agent or Administrator privileges are required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') or request.user.is_staff)
        )


class IsEmployee(BasePermission):
    """Allows access to Employees."""
    message = "Employee privileges are required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == UserRole.EMPLOYEE
        )


# Backward compatibility aliases
IsAdminUserRole = IsAdmin
IsAgentOrAdminRole = IsSupportAgent
IsEmployeeRole = IsEmployee
