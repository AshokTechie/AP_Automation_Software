from rest_framework import serializers
from apps.procurement.models import (
    PurchaseOrder, POLineItem, GoodsReceiptNote, GRNLineItem,
    ImportBatch, ImportRowError
)
from apps.vendors.serializers import VendorSerializer


class POLineItemSerializer(serializers.ModelSerializer):
    remaining_receipt_quantity = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)
    remaining_invoice_quantity = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)

    class Meta:
        model = POLineItem
        fields = [
            'id', 'po', 'line_number', 'material_code', 'description',
            'hsn_sac_code', 'ordered_quantity', 'received_quantity',
            'invoiced_quantity', 'remaining_receipt_quantity',
            'remaining_invoice_quantity', 'uom', 'unit_price',
            'tax_rate_percent', 'line_total'
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = POLineItemSerializer(many=True, read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor', 'vendor_details', 'issue_date',
            'expected_delivery_date', 'payment_terms', 'currency',
            'subtotal', 'tax_amount', 'total_amount', 'status',
            'status_display', 'notes', 'items', 'created_at', 'updated_at'
        ]


class GRNLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GRNLineItem
        fields = '__all__'


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    items = GRNLineItemSerializer(many=True, read_only=True)
    po_number = serializers.CharField(source='po.po_number', read_only=True)
    vendor_name = serializers.CharField(source='po.vendor.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = GoodsReceiptNote
        fields = [
            'id', 'grn_number', 'po', 'po_number', 'vendor_name',
            'receipt_date', 'delivery_note_number', 'warehouse_location',
            'status', 'status_display', 'remarks', 'items', 'created_at'
        ]


class ImportRowErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRowError
        fields = ['id', 'row_number', 'field_name', 'rejected_value', 'error_message']


class ImportBatchSerializer(serializers.ModelSerializer):
    row_errors = ImportRowErrorSerializer(many=True, read_only=True)

    class Meta:
        model = ImportBatch
        fields = [
            'id', 'batch_type', 'file_name', 'uploaded_file',
            'total_rows', 'valid_rows', 'invalid_rows', 'status',
            'preview_data', 'row_errors', 'created_at'
        ]
