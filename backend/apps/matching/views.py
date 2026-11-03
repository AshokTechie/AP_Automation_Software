from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from decimal import Decimal
from apps.matching.models import MatchingResult
from apps.matching.serializers import MatchingResultSerializer
from apps.matching.services.matcher import POMatchingEngine
from apps.invoices.models import Invoice, InvoiceStatus
from apps.exceptions_mgmt.models import APException, ExceptionCategory
from apps.core.audit import log_event


class MatchingResultViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MatchingResult.objects.all().select_related('invoice', 'invoice__vendor', 'invoice__po')
    serializer_class = MatchingResultSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['is_passed', 'status', 'match_type']


class EvaluateMatchView(APIView):
    """
    Executes 2-Way or 3-Way matching against PO and GRN records.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, invoice_id):
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        tolerance = request.data.get('price_tolerance_pct')
        tolerance_val = Decimal(str(tolerance)) if tolerance is not None else Decimal('1.00')

        result = POMatchingEngine.evaluate_invoice_match(invoice, tolerance_val)
        return Response(MatchingResultSerializer(result).data)


class OverrideMatchView(APIView):
    """
    Allows authorized Purchasing or AP Manager to approve an invoice with
    a documented price or quantity discrepancy.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, invoice_id):
        reason = request.data.get('reason')
        if not reason:
            return Response({"error": "Override reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(id=invoice_id)
            result = invoice.matching_result
        except Exception:
            return Response({"error": "Matching result not found for this invoice."}, status=status.HTTP_404_NOT_FOUND)

        result.override_approved = True
        result.override_by = request.user if request.user.is_authenticated else None
        result.override_reason = reason
        result.is_passed = True
        result.save()

        invoice.status = InvoiceStatus.MATCH_PASSED
        invoice.save(update_fields=['status'])

        # Resolve the matching exception
        APException.objects.filter(
            invoice=invoice,
            category__in=[ExceptionCategory.PRICE_MISMATCH, ExceptionCategory.QUANTITY_MISMATCH, ExceptionCategory.GRN_NOT_FOUND],
            resolved=False
        ).update(
            resolved=True,
            resolved_by=request.user if request.user.is_authenticated else None,
            resolution_notes=f"Manager Override: {reason}"
        )

        log_event(
            action='MATCHING_DISCREPANCY_OVERRIDDEN',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            user=request.user,
            reason=reason
        )

        return Response({
            "message": "Matching discrepancy successfully overridden by manager.",
            "result": MatchingResultSerializer(result).data
        })
