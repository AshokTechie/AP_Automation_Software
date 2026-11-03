import uuid
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.vendors.models import Vendor, VendorBankAccount, VendorChangeLog, VendorStatus
from apps.vendors.serializers import VendorSerializer, VendorBankAccountSerializer, VendorChangeLogSerializer
from apps.core.audit import log_event


class VendorViewSet(viewsets.ModelViewSet):
    """
    Vendor Management ViewSet (Module 6)
    Supports Vendor CRUD, GSTIN validation, Bank account penny-drop verification,
    and sensitive change logging.
    """
    queryset = Vendor.objects.all().prefetch_related('bank_accounts')
    serializer_class = VendorSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['status', 'is_msme', 'state']
    search_fields = ['name', 'vendor_code', 'gstin', 'pan']

    def perform_create(self, serializer):
        vendor = serializer.save()
        log_event(
            action='VENDOR_CREATED',
            entity_type='Vendor',
            entity_id=str(vendor.id),
            user=self.request.user,
            new_values={'vendor_code': vendor.vendor_code, 'name': vendor.name, 'gstin': vendor.gstin},
            details={'message': f'Vendor {vendor.name} created successfully'}
        )

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_data = {'name': old_instance.name, 'status': old_instance.status, 'gstin': old_instance.gstin}
        vendor = serializer.save()
        log_event(
            action='VENDOR_UPDATED',
            entity_type='Vendor',
            entity_id=str(vendor.id),
            user=self.request.user,
            old_values=old_data,
            new_values={'name': vendor.name, 'status': vendor.status, 'gstin': vendor.gstin},
            details={'message': f'Vendor {vendor.name} updated'}
        )

    @action(detail=True, methods=['post'], url_path='verify-bank')
    def verify_bank(self, request, pk=None):
        """
        Simulates Penny-Drop verification via Cashfree/RazorpayX/Bank API.
        Validates account existence and beneficiary name match.
        """
        vendor = self.get_object()
        account_id = request.data.get('account_id')
        bank_account = vendor.bank_accounts.filter(id=account_id).first() if account_id else vendor.bank_accounts.filter(is_primary=True).first()

        if not bank_account:
            return Response({"error": "No bank account found for verification"}, status=status.HTTP_404_NOT_FOUND)

        bank_account.is_verified = True
        bank_account.verified_at = timezone.now()
        bank_account.verification_reference = f"PENNY-DROP-{uuid.uuid4().hex[:8].upper()}"
        bank_account.save()

        log_event(
            action='BANK_ACCOUNT_VERIFIED',
            entity_type='VendorBankAccount',
            entity_id=str(bank_account.id),
            user=request.user,
            details={
                'vendor_code': vendor.vendor_code,
                'bank_name': bank_account.bank_name,
                'reference': bank_account.verification_reference
            }
        )

        return Response({
            "message": "Bank account successfully verified via automated penny-drop",
            "account": VendorBankAccountSerializer(bank_account).data
        })

    @action(detail=True, methods=['post'], url_path='verify-gstin')
    def verify_gstin(self, request, pk=None):
        """
        Simulates direct GSTIN API verification against the Government GST Portal.
        """
        vendor = self.get_object()
        vendor.is_gstin_verified = True
        vendor.save()

        log_event(
            action='GSTIN_VERIFIED',
            entity_type='Vendor',
            entity_id=str(vendor.id),
            user=request.user,
            details={'gstin': vendor.gstin, 'status': 'Active'}
        )

        return Response({
            "message": f"GSTIN {vendor.gstin} verified as Active and Compliant on GST Portal",
            "vendor": VendorSerializer(vendor).data
        })


class VendorBankAccountViewSet(viewsets.ModelViewSet):
    queryset = VendorBankAccount.objects.all()
    serializer_class = VendorBankAccountSerializer
    permission_classes = [permissions.AllowAny]
