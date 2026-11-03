from rest_framework import serializers
from apps.matching.models import MatchingResult


class MatchingResultSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    vendor_name = serializers.CharField(source='invoice.vendor.name', read_only=True)
    po_number = serializers.CharField(source='invoice.po.po_number', read_only=True)

    class Meta:
        model = MatchingResult
        fields = [
            'id', 'invoice', 'invoice_number', 'vendor_name', 'po_number',
            'match_type', 'status', 'status_display', 'is_passed',
            'price_tolerance_percent', 'max_price_variance_found',
            'discrepancy_summary', 'item_matching_details',
            'override_approved', 'override_reason', 'evaluated_at'
        ]
