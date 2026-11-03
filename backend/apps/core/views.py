from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from apps.core.models import UserProfile, AuditLog
from apps.core.serializers import UserSerializer, UserProfileSerializer, AuditLogSerializer


class CurrentUserView(APIView):
    """
    Returns the currently authenticated user with profile & role,
    supporting session authentication and X-Persona-Role header fallback.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # 1. Prefer explicit role header passed by frontend
        role_header = request.headers.get('X-Persona-Role')
        if role_header:
            user_profile = UserProfile.objects.filter(role=role_header).first()
            if user_profile:
                return Response(UserSerializer(user_profile.user).data)

        # 2. Authenticated user (set by session or PersonaRoleMiddleware)
        if request.user and request.user.is_authenticated:
            return Response(UserSerializer(request.user).data)

        # Default fallback to AP Specialist for frictionless evaluation
        user_profile = UserProfile.objects.filter(role='AP_CLERK').first()
        if user_profile:
            return Response(UserSerializer(user_profile.user).data)

        user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if user:
            return Response(UserSerializer(user).data)
        return Response({"authenticated": False, "message": "No active user found"}, status=status.HTTP_404_NOT_FOUND)


class SwitchUserView(APIView):
    """
    Allows the demo reviewer to seamlessly switch personas:
    e.g. Employee -> AP Clerk -> Finance Manager -> CFO -> Admin
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        role = request.data.get('role')
        if not role:
            return Response({"error": "Role is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        user_profile = UserProfile.objects.filter(role=role).first()
        if not user_profile:
            return Response({"error": f"No user configured with role: {role}"}, status=status.HTTP_404_NOT_FOUND)
        
        user = user_profile.user
        try:
            login(request, user)
        except Exception:
            pass

        return Response({
            "message": f"Switched to user {user.username} ({user_profile.get_role_display()})",
            "user": UserSerializer(user).data
        })


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for immutable audit trail.
    Templegate Rule 10: Keep an audit trail for edits, imports, approvals, and payments.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['entity_type', 'action', 'entity_id']
