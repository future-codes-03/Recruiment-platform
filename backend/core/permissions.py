from rest_framework.permissions import BasePermission

from accounts.models import UserRole


class IsCandidate(BasePermission):
    """Restricts a view to authenticated users with role == 'candidate'."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == UserRole.CANDIDATE
        )
