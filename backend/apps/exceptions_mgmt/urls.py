from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.exceptions_mgmt.views import APExceptionViewSet

router = DefaultRouter()
router.register(r'exceptions', APExceptionViewSet, basename='exception')

urlpatterns = [
    path('', include(router.urls)),
]
