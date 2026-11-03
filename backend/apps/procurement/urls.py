from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.procurement.views import (
    PurchaseOrderViewSet, GoodsReceiptNoteViewSet,
    ImportUploadView, ImportCommitView
)

router = DefaultRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'goods-receipts', GoodsReceiptNoteViewSet, basename='goods-receipt')

urlpatterns = [
    path('imports/upload/', ImportUploadView.as_view(), name='import-upload'),
    path('imports/<uuid:batch_id>/commit/', ImportCommitView.as_view(), name='import-commit'),
    path('', include(router.urls)),
]
