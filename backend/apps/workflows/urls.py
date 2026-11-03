from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.workflows.views import (
    ApprovalMatrixRuleViewSet, ApprovalRequestViewSet,
    InitiateApprovalView, ActionApprovalView
)

router = DefaultRouter()
router.register(r'rules', ApprovalMatrixRuleViewSet, basename='approval-rule')
router.register(r'requests', ApprovalRequestViewSet, basename='approval-request')

urlpatterns = [
    path('initiate/<uuid:invoice_id>/', InitiateApprovalView.as_view(), name='initiate-approval'),
    path('requests/<uuid:approval_id>/action/', ActionApprovalView.as_view(), name='action-approval'),
    path('', include(router.urls)),
]
