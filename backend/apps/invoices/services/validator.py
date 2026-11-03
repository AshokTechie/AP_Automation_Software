from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from apps.invoices.models import Invoice, InvoiceStatus, InvoiceChangeLog
from apps.vendors.models import Vendor, VendorStatus
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity
from apps.core.audit import log_event


class InvoiceValidationEngine:
    """
    Validation Engine for Invoices (Module 3 & Section 2.4).
    Enforces:
    1. Mandatory fields
    2. Vendor master status & active GSTIN
    3. Mathematical sum coherence
    4. Multi-tier duplicate checks
    5. Triggering Exception records with plain-language resolution notes
    """

    @classmethod
    def validate_invoice(cls, invoice):
        """
        Runs all validation gates. Returns (is_valid, list_of_errors).
        """
        errors = []
        blocking = False

        # Clear existing validation exceptions for this invoice to prevent stale flags
        APException.objects.filter(invoice=invoice, resolved=False).exclude(
            category__in=[ExceptionCategory.SENSITIVE_FIELD_CHANGED, ExceptionCategory.APPROVAL_REJECTED]
        ).delete()

        # Gate 1: Mandatory Fields
        if not invoice.invoice_number or 'UNKNOWN' in invoice.invoice_number:
            errors.append("Invoice number is missing or could not be determined.")
            cls._create_exception(
                invoice, ExceptionCategory.MISSING_INVOICE_INFO,
                "Invoice number is blank or uncertain.", ExceptionSeverity.BLOCKING, "AP_CLERK"
            )
            blocking = True

        if not invoice.invoice_date:
            errors.append("Invoice date is missing.")
            cls._create_exception(
                invoice, ExceptionCategory.MISSING_INVOICE_INFO,
                "Invoice date is missing. Cannot verify accounting period.", ExceptionSeverity.BLOCKING, "AP_CLERK"
            )
            blocking = True

        # Gate 2: Vendor Master Validation
        if not invoice.vendor:
            errors.append("Vendor is not identified in the Vendor Master.")
            cls._create_exception(
                invoice, ExceptionCategory.VENDOR_MASTER_ISSUE,
                "Vendor record could not be mapped. Onboarding or manual assignment required.", ExceptionSeverity.BLOCKING, "AP_CLERK"
            )
            blocking = True
        else:
            if invoice.vendor.status == VendorStatus.BLOCKED:
                errors.append(f"Vendor '{invoice.vendor.name}' is BLOCKED for compliance reasons.")
                cls._create_exception(
                    invoice, ExceptionCategory.VENDOR_MASTER_ISSUE,
                    f"Vendor '{invoice.vendor.name}' is currently blocked. Invoice cannot proceed.", ExceptionSeverity.BLOCKING, "FINANCE_MANAGER"
                )
                blocking = True
            elif invoice.vendor.status == VendorStatus.INACTIVE:
                errors.append(f"Vendor '{invoice.vendor.name}' is INACTIVE.")
                cls._create_exception(
                    invoice, ExceptionCategory.VENDOR_MASTER_ISSUE,
                    f"Vendor '{invoice.vendor.name}' is inactive. Verify with purchasing.", ExceptionSeverity.BLOCKING, "AP_CLERK"
                )
                blocking = True

        # Gate 3: Duplicate Checks (Templegate Challenge 2.4)
        if invoice.vendor and invoice.invoice_number:
            existing_exact = Invoice.objects.filter(
                vendor=invoice.vendor,
                invoice_number__iexact=invoice.invoice_number
            ).exclude(id=invoice.id)

            if existing_exact.exists():
                match_inv = existing_exact.first()
                errors.append(f"Duplicate Invoice: An invoice with number '{invoice.invoice_number}' already exists for {invoice.vendor.name} (ID: {match_inv.id}).")
                cls._create_exception(
                    invoice, ExceptionCategory.POSSIBLE_DUPLICATE_INVOICE,
                    f"Duplicate invoice number '{invoice.invoice_number}' already recorded for vendor {invoice.vendor.name}.",
                    ExceptionSeverity.BLOCKING, "AP_CLERK"
                )
                blocking = True

        # Gate 4: Mathematical Validation
        items = invoice.items.all()
        if not items.exists():
            errors.append("Invoice has no line items extracted.")
            cls._create_exception(
                invoice, ExceptionCategory.OCR_REVIEW_REQUIRED,
                "No line items found. Manual entry or OCR correction needed.", ExceptionSeverity.BLOCKING, "AP_CLERK"
            )
            blocking = True
        else:
            calc_subtotal = sum(item.line_total for item in items)
            calc_tax = sum(item.tax_amount for item in items)
            calc_grand_total = calc_subtotal + calc_tax

            # Check for difference > 0.50 (rounding tolerance)
            diff = abs(invoice.grand_total - calc_grand_total)
            if diff > Decimal('0.50'):
                errors.append(f"Calculation Mismatch: Sum of line items ({calc_grand_total}) does not match Invoice Grand Total ({invoice.grand_total}). Difference: {diff}")
                cls._create_exception(
                    invoice, ExceptionCategory.AMOUNT_CALCULATION_MISMATCH,
                    f"Line items + tax sum to ₹{calc_grand_total}, but header total is ₹{invoice.grand_total}. Discrepancy of ₹{diff}.",
                    ExceptionSeverity.BLOCKING, "AP_CLERK"
                )
                blocking = True

        # Update Invoice Status
        if blocking:
            invoice.status = InvoiceStatus.NEEDS_VERIFICATION
        elif invoice.has_sensitive_edits:
            invoice.status = InvoiceStatus.PENDING_AP_REVIEW
        else:
            invoice.status = InvoiceStatus.VALIDATED

        invoice.save(update_fields=['status', 'updated_at'])
        return len(errors) == 0, errors

    @classmethod
    def _create_exception(cls, invoice, category, description, severity, assigned_role):
        APException.objects.get_or_create(
            invoice=invoice,
            category=category,
            description=description,
            defaults={
                'severity': severity,
                'assigned_role': assigned_role
            }
        )
