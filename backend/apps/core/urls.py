from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views import CurrentUserView, SwitchUserView, AuditLogViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('auth/switch-role/', SwitchUserView.as_view(), name='switch-role'),
    path('', include(router.urls)),
]
