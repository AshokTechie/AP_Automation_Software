import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.core.models import UserRole


class ExceptionCategory(models.TextChoices):
    UPLOAD_ERROR = 'UPLOAD_ERROR', 'Upload Error'
    OCR_REVIEW_REQUIRED = 'OCR_REVIEW_REQUIRED', 'OCR Review Required'
    MISSING_INVOICE_INFO = 'MISSING_INVOICE_INFO', 'Missing Invoice Information'
    POSSIBLE_DUPLICATE_INVOICE = 'POSSIBLE_DUPLICATE_INVOICE', 'Possible Duplicate Invoice'
    VENDOR_MASTER_ISSUE = 'VENDOR_MASTER_ISSUE', 'Vendor Master Issue'
    TAX_VALIDATION_ISSUE = 'TAX_VALIDATION_ISSUE', 'Tax Validation Issue'
    AMOUNT_CALCULATION_MISMATCH = 'AMOUNT_CALCULATION_MISMATCH', 'Amount Calculation Mismatch'
    PO_NOT_FOUND = 'PO_NOT_FOUND', 'PO Not Found'
    GRN_NOT_FOUND = 'GRN_NOT_FOUND', 'GRN Not Found'
    QUANTITY_MISMATCH = 'QUANTITY_MISMATCH', 'Quantity Mismatch'
    PRICE_MISMATCH = 'PRICE_MISMATCH', 'Price Mismatch'
    SENSITIVE_FIELD_CHANGED = 'SENSITIVE_FIELD_CHANGED', 'Sensitive Field Changed'
    APPROVAL_OVERDUE = 'APPROVAL_OVERDUE', 'Approval Overdue'
    APPROVAL_REJECTED = 'APPROVAL_REJECTED', 'Approval Rejected'
    PAYMENT_ISSUE = 'PAYMENT_ISSUE', 'Payment Issue'
    IMPORT_ERROR = 'IMPORT_ERROR', 'Excel/CSV Import Error'
    INTEGRATION_FAILURE = 'INTEGRATION_FAILURE', 'Integration Failure'


class ExceptionSeverity(models.TextChoices):
    BLOCKING = 'BLOCKING', 'Blocking (Prevents Approval)'
    WARNING = 'WARNING', 'Warning (Review Recommended)'
    INFO = 'INFO', 'Informational'


class APException(models.Model):
    """
    Unified Exception Management Record (Templegate Section 5 & 11).
    Contains:
    - Exception category
    - Affected record reference (Invoice, PO, GRN)
    - Plain-language description
    - Severity / Blocking status
    - Assigned role or owner
    - Date created & Date resolved
    - Resolution notes
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.CharField(max_length=50, choices=ExceptionCategory.choices, db_index=True)
    severity = models.CharField(max_length=20, choices=ExceptionSeverity.choices, default=ExceptionSeverity.BLOCKING)
    
    # Generic references
    invoice = models.ForeignKey('invoices.Invoice', on_delete=models.CASCADE, null=True, blank=True, related_name='exceptions')
    po = models.ForeignKey('procurement.PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='exceptions')
    grn = models.ForeignKey('procurement.GoodsReceiptNote', on_delete=models.SET_NULL, null=True, blank=True, related_name='exceptions')
    
    description = models.TextField(help_text="Plain-language description of the issue")
    assigned_role = models.CharField(max_length=30, choices=UserRole.choices, default=UserRole.AP_CLERK)
    assigned_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_exceptions')
    
    resolved = models.BooleanField(default=False, db_index=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_exceptions')
    resolution_notes = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['resolved', '-created_at']

    def __str__(self):
        ref = self.invoice.invoice_number if self.invoice else "System"
        return f"[{self.get_severity_display()}] {self.get_category_display()} - {ref}: {self.description[:60]}"
