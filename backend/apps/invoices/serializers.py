from rest_framework import serializers
from apps.invoices.models import Invoice, InvoiceLineItem, InvoiceChangeLog
from apps.vendors.serializers import VendorSerializer
from apps.procurement.serializers import PurchaseOrderSerializer


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = [
            'id', 'line_number', 'material_code', 'description',
            'hsn_sac_code', 'quantity', 'unit_price', 'uom',
            'tax_rate_percent', 'tax_amount', 'line_total',
            'confidence_score'
        ]


class InvoiceChangeLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = InvoiceChangeLog
        fields = [
            'id', 'invoice', 'user', 'user_name', 'user_display',
            'field_name', 'old_value', 'new_value', 'reason',
            'is_sensitive', 'reviewed_by_ap', 'reviewed_at', 'created_at'
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceLineItemSerializer(many=True, read_only=True)
    change_logs = InvoiceChangeLogSerializer(many=True, read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    po_details = PurchaseOrderSerializer(source='po', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'vendor', 'vendor_details',
            'po', 'po_details', 'invoice_date', 'due_date',
            'currency', 'subtotal', 'tax_amount', 'grand_total',
            'file_attachment', 'file_url', 'file_hash_sha256',
            'file_size_bytes', 'mime_type', 'ocr_raw_payload',
            'ocr_initial_values', 'ocr_confidence_score',
            'status', 'status_display', 'match_type',
            'has_sensitive_edits', 'items', 'change_logs',
            'created_at', 'updated_at'
        ]

    def get_file_url(self, obj):
        if obj.file_attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file_attachment.url)
            return obj.file_attachment.url
        return None
