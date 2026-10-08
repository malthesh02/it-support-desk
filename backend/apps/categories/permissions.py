from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.accounts.models import UserRole


class IsAdminOrReadOnly(BasePermission):
    """
    Custom permission to only allow administrators to create or edit records.
    Read permissions are allowed to any authenticated request.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == UserRole.ADMIN or request.user.is_superuser
