from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.workflows.models import ApprovalMatrixRule, ApprovalRequest, ApprovalStatus
from apps.workflows.serializers import ApprovalMatrixRuleSerializer, ApprovalRequestSerializer
from apps.workflows.services.engine import WorkflowApprovalEngine
from apps.invoices.models import Invoice
from apps.core.models import UserProfile, UserRole


class ApprovalMatrixRuleViewSet(viewsets.ModelViewSet):
    queryset = ApprovalMatrixRule.objects.all().order_by('tier_order', 'min_amount')
    serializer_class = ApprovalMatrixRuleSerializer
    permission_classes = [permissions.AllowAny]


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    """
    Approval Inbox ViewSet (Module 5).
    Filter by status, role, overdue.
    """
    queryset = ApprovalRequest.objects.all().select_related('invoice', 'invoice__vendor').order_by('-created_at')
    serializer_class = ApprovalRequestSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['status', 'assigned_role', 'tier_order']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())
        role_param = self.request.query_params.get('assigned_role')
        if role_param:
            qs = qs.filter(assigned_role=role_param)
        return qs


class InitiateApprovalView(APIView):
    """
    Routes an invoice into the approval matrix.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, invoice_id):
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        success, message = WorkflowApprovalEngine.initiate_workflow(invoice)
        if success:
            return Response({
                "message": message,
                "approvals": ApprovalRequestSerializer(invoice.approvals.all(), many=True).data
            })
        else:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)


class ActionApprovalView(APIView):
    """
    Approver decision endpoint: APPROVE or REJECT.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, approval_id):
        decision = request.data.get('decision', '').upper()
        comments = request.data.get('comments', '')

        if decision not in ['APPROVE', 'REJECT']:
            return Response({"error": "decision must be 'APPROVE' or 'REJECT'"}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        role_header = request.headers.get('X-Persona-Role')
        if role_header:
            profile = UserProfile.objects.filter(role=role_header).first()
            if profile:
                user = profile.user
        
        if not user and request.user and request.user.is_authenticated:
            user = request.user
        
        if not user:
            # Default to an approver user e.g. FINANCE_MANAGER or ADMIN
            profile = UserProfile.objects.filter(role__in=[UserRole.FINANCE_MANAGER, UserRole.CFO, UserRole.ADMIN]).first()
            if profile:
                user = profile.user

        success, message = WorkflowApprovalEngine.process_decision(approval_id, user, decision, comments)

        if success:
            approval = ApprovalRequest.objects.get(id=approval_id)
            return Response({
                "message": message,
                "approval": ApprovalRequestSerializer(approval).data
            })
        else:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
