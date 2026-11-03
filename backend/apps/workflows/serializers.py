from rest_framework import serializers
from apps.workflows.models import ApprovalMatrixRule, ApprovalRequest


class ApprovalMatrixRuleSerializer(serializers.ModelSerializer):
    required_role_display = serializers.CharField(source='get_required_role_display', read_only=True)

    class Meta:
        model = ApprovalMatrixRule
        fields = '__all__'


class ApprovalRequestSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    vendor_name = serializers.CharField(source='invoice.vendor.name', read_only=True)
    invoice_total = serializers.DecimalField(source='invoice.grand_total', max_digits=14, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_role_display = serializers.CharField(source='get_assigned_role_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'invoice', 'invoice_number', 'vendor_name', 'invoice_total',
            'rule', 'assigned_role', 'assigned_role_display', 'assigned_user',
            'tier_order', 'status', 'status_display', 'comments',
            'actioned_by', 'actioned_at', 'escalation_deadline',
            'is_escalated', 'is_overdue', 'created_at'
        ]
