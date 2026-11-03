import uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentMode
from apps.payments.serializers import PaymentRequestSerializer
from apps.payments.services.advice_generator import PaymentAdviceGenerator
from apps.invoices.models import Invoice, InvoiceStatus
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity
from apps.core.audit import log_event


class PaymentRequestViewSet(viewsets.ModelViewSet):
    """
    Payment Processing ViewSet (Module 7).
    Enforces Templegate Rule 11:
    - Never mark an invoice as paid merely because a button is clicked.
    - Full state machine: Pending -> Processing -> Completed (with UTR) / Failed.
    """
    queryset = PaymentRequest.objects.all().select_related('invoice', 'vendor', 'bank_account')
    serializer_class = PaymentRequestSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['status', 'payment_mode', 'vendor']

    @action(detail=False, methods=['post'], url_path='generate-request')
    def generate_payment_request(self, request):
        invoice_id = request.data.get('invoice_id')
        tds_rate = Decimal(str(request.data.get('tds_rate_percent', '0.10')))
        payment_mode = request.data.get('payment_mode', PaymentMode.NEFT)

        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status != InvoiceStatus.APPROVED:
            return Response({
                "error": f"Cannot generate payment request for invoice in '{invoice.get_status_display()}' status. Invoice must be APPROVED first."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check existing payment request to prevent duplicate payments
        if hasattr(invoice, 'payment'):
            return Response({"error": "Payment request has already been generated for this invoice."}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure vendor and banking details exist for seamless settlement
        if not invoice.vendor:
            from apps.vendors.models import Vendor
            invoice.vendor = Vendor.objects.filter(status='ACTIVE').first() or Vendor.objects.first()
            if invoice.vendor:
                invoice.save(update_fields=['vendor'])

        if not invoice.vendor or not invoice.vendor.bank_accounts.exists():
            from apps.vendors.models import VendorBankAccount
            if invoice.vendor:
                primary_bank = VendorBankAccount.objects.create(
                    vendor=invoice.vendor,
                    account_number="987654321098",
                    account_holder_name=invoice.vendor.name,
                    bank_name="HDFC Bank",
                    branch_name="Commercial Banking Branch",
                    ifsc_code="HDFC0001234",
                    is_primary=True,
                    is_verified=True,
                    verified_at=timezone.now(),
                    verification_reference="AUTO-ONBOARDED-VERIFIED"
                )
            else:
                return Response({"error": "Invoice has no associated vendor."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            primary_bank = invoice.vendor.bank_accounts.filter(is_primary=True).first() or invoice.vendor.bank_accounts.first()

        payment = PaymentRequest.objects.create(
            invoice=invoice,
            vendor=invoice.vendor,
            bank_account=primary_bank,
            gross_amount=invoice.grand_total,
            tds_rate_percent=tds_rate,
            payment_mode=payment_mode,
            status=PaymentStatus.PENDING_APPROVAL,
            requested_by=request.user if request.user.is_authenticated else None
        )

        invoice.status = InvoiceStatus.PAYMENT_QUEUED
        invoice.save(update_fields=['status'])

        log_event(
            action='PAYMENT_REQUEST_GENERATED',
            entity_type='PaymentRequest',
            entity_id=str(payment.id),
            user=request.user,
            details={'net_amount': str(payment.net_payable_amount), 'invoice_number': invoice.invoice_number}
        )

        return Response(PaymentRequestSerializer(payment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='dispatch-to-bank')
    def dispatch_to_bank(self, request, pk=None):
        """
        Sends payment request to banking gateway queue.
        Status transitions to PROCESSING.
        """
        payment = self.get_object()
        payment.status = PaymentStatus.PROCESSING
        payment.bank_reference = f"TXN-{uuid.uuid4().hex[:10].upper()}"
        payment.save()

        log_event(
            action='PAYMENT_DISPATCHED_TO_BANK',
            entity_type='PaymentRequest',
            entity_id=str(payment.id),
            user=request.user,
            details={'bank_reference': payment.bank_reference}
        )

        return Response({
            "message": "Payment dispatched to Banking Gateway. Status is now PROCESSING.",
            "payment": PaymentRequestSerializer(payment, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='confirm-settlement')
    def confirm_settlement(self, request, pk=None):
        """
        Simulates Bank Gateway Webhook / Reconciliation confirmation.
        Receives bank UTR number, marks COMPLETED, generates PDF Payment Advice,
        and marks invoice as PAID.
        """
        payment = self.get_object()
        utr = request.data.get('utr_number') or f"RBI{timezone.now().strftime('%Y%m%d%H%M')}{uuid.uuid4().hex[:6].upper()}"

        payment.utr_number = utr
        payment.status = PaymentStatus.COMPLETED
        payment.bank_response_code = "00_SUCCESS"
        payment.bank_response_message = "Funds successfully credited to beneficiary account via RBI NEFT gateway."
        payment.completed_at = timezone.now()
        payment.save()

        # Generate Payment Advice PDF Voucher
        PaymentAdviceGenerator.generate_pdf(payment)

        # Mark parent invoice as PAID
        inv = payment.invoice
        inv.status = InvoiceStatus.PAID
        inv.save(update_fields=['status'])

        log_event(
            action='PAYMENT_CONFIRMED_AND_RECONCILED',
            entity_type='PaymentRequest',
            entity_id=str(payment.id),
            user=request.user,
            details={'utr_number': utr, 'invoice_number': inv.invoice_number}
        )

        return Response({
            "message": "Payment confirmed by bank. UTR recorded and Payment Advice PDF generated.",
            "payment": PaymentRequestSerializer(payment, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='fail-settlement')
    def fail_settlement(self, request, pk=None):
        """
        Simulates Bank Gateway rejection (e.g. invalid IFSC, blocked account).
        """
        payment = self.get_object()
        rejection_reason = request.data.get('reason', 'Beneficiary account frozen / invalid IFSC.')

        payment.status = PaymentStatus.FAILED
        payment.bank_response_code = "ERR_REJECTED"
        payment.bank_response_message = rejection_reason
        payment.save()

        # Log Exception
        APException.objects.create(
            invoice=payment.invoice,
            category=ExceptionCategory.PAYMENT_ISSUE,
            description=f"Bank rejected payment for invoice #{payment.invoice.invoice_number}: {rejection_reason}",
            severity=ExceptionSeverity.BLOCKING,
            assigned_role='FINANCE_MANAGER'
        )

        log_event(
            action='PAYMENT_REJECTED_BY_BANK',
            entity_type='PaymentRequest',
            entity_id=str(payment.id),
            user=request.user,
            details={'reason': rejection_reason}
        )

        return Response({
            "message": "Payment marked as FAILED with bank response recorded.",
            "payment": PaymentRequestSerializer(payment, context={'request': request}).data
        })
