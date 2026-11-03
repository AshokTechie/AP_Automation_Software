from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.payments.views import PaymentRequestViewSet

router = DefaultRouter()
router.register(r'requests', PaymentRequestViewSet, basename='payment-request')

urlpatterns = [
    path('', include(router.urls)),
]
