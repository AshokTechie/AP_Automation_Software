from rest_framework import serializers, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.exceptions_mgmt.models import APException
from apps.core.audit import log_event


class APExceptionSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    vendor_name = serializers.CharField(source='invoice.vendor.name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True)

    class Meta:
        model = APException
        fields = [
            'id', 'category', 'category_display', 'severity', 'severity_display',
            'invoice', 'invoice_number', 'vendor_name', 'po', 'grn',
            'description', 'assigned_role', 'assigned_user', 'resolved',
            'resolved_by', 'resolved_by_name', 'resolution_notes',
            'resolved_at', 'created_at', 'updated_at'
        ]


class APExceptionViewSet(viewsets.ModelViewSet):
    """
    Exception Queue ViewSet (Module 3, 4, 5 & Point 11).
    Provides central dashboard queue for all 16 business & technical exception types.
    """
    queryset = APException.objects.all().select_related('invoice', 'invoice__vendor', 'resolved_by')
    serializer_class = APExceptionSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['resolved', 'category', 'severity', 'assigned_role']
    search_fields = ['description', 'invoice__invoice_number', 'invoice__vendor__name']

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve_exception(self, request, pk=None):
        exception_obj = self.get_object()
        notes = request.data.get('resolution_notes', '')

        if not notes:
            return Response({"error": "Resolution notes explaining the correction are required."}, status=status.HTTP_400_BAD_REQUEST)

        exception_obj.resolved = True
        exception_obj.resolution_notes = notes
        exception_obj.resolved_by = request.user if request.user.is_authenticated else None
        exception_obj.resolved_at = timezone.now()
        exception_obj.save()

        log_event(
            action='EXCEPTION_RESOLVED',
            entity_type='APException',
            entity_id=str(exception_obj.id),
            user=request.user,
            details={
                'category': exception_obj.category,
                'resolution_notes': notes,
                'invoice_id': str(exception_obj.invoice.id) if exception_obj.invoice else None
            }
        )

        # Trigger re-validation on affected invoice if applicable
        if exception_obj.invoice:
            from apps.invoices.services.validator import InvoiceValidationEngine
            InvoiceValidationEngine.validate_invoice(exception_obj.invoice)

        return Response({
            "message": "Exception resolved successfully.",
            "exception": APExceptionSerializer(exception_obj).data
        })
