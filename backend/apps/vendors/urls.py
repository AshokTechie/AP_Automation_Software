from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.vendors.views import VendorViewSet, VendorBankAccountViewSet

router = DefaultRouter()
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'bank-accounts', VendorBankAccountViewSet, basename='bank-account')

urlpatterns = [
    path('', include(router.urls)),
]
