from rest_framework import serializers
from apps.payments.models import PaymentRequest
from apps.vendors.serializers import VendorSerializer, VendorBankAccountSerializer


class PaymentRequestSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    currency = serializers.CharField(source='invoice.currency', default='INR', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    bank_account_masked = serializers.CharField(source='bank_account.masked_account_number', read_only=True)
    bank_name = serializers.CharField(source='bank_account.bank_name', read_only=True)
    advice_pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRequest
        fields = [
            'id', 'invoice', 'invoice_number', 'currency', 'vendor', 'vendor_name',
            'bank_account', 'bank_name', 'bank_account_masked',
            'gross_amount', 'tds_rate_percent', 'tds_amount',
            'net_payable_amount', 'payment_mode', 'status', 'status_display',
            'utr_number', 'bank_reference', 'bank_response_code',
            'bank_response_message', 'advice_pdf', 'advice_pdf_url',
            'requested_by', 'requested_at', 'completed_at'
        ]

    def get_advice_pdf_url(self, obj):
        if obj.advice_pdf:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.advice_pdf.url)
            return f"http://127.0.0.1:8000{obj.advice_pdf.url}"
        return None
