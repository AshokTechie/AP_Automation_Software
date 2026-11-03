import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from apps.vendors.models import Vendor
from apps.procurement.models import PurchaseOrder


class InvoiceStatus(models.TextChoices):
    UPLOADED = 'UPLOADED', 'Uploaded'
    EXTRACTED = 'EXTRACTED', 'OCR Extracted'
    NEEDS_VERIFICATION = 'NEEDS_VERIFICATION', 'Needs Human Verification'
    VALIDATED = 'VALIDATED', 'Validation Passed'
    PENDING_AP_REVIEW = 'PENDING_AP_REVIEW', 'Pending AP Sensitive Review'
    MATCH_FAILED = 'MATCH_FAILED', 'PO Matching Discrepancy'
    MATCH_PASSED = 'MATCH_PASSED', 'Matching Passed'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Manager Approval'
    APPROVED = 'APPROVED', 'Approved for Payment'
    PAYMENT_QUEUED = 'PAYMENT_QUEUED', 'Payment Queued'
    PAID = 'PAID', 'Payment Completed'
    REJECTED = 'REJECTED', 'Invoice Rejected'


class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=100, db_index=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    po = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    invoice_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, default='INR')
    
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    # Raw File Evidence (Templegate Rule 1: Never discard the original uploaded invoice)
    file_attachment = models.FileField(upload_to='invoices/')
    file_hash_sha256 = models.CharField(max_length=64, db_index=True, help_text="SHA256 hash to detect exact duplicate uploads")
    file_size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=100, default='application/pdf')
    
    # OCR Data & Evidence (Templegate Rule 2: Never treat OCR output as verified data)
    ocr_raw_payload = models.JSONField(blank=True, null=True, help_text="Complete extracted OCR structure with coordinates")
    ocr_initial_values = models.JSONField(blank=True, null=True, help_text="Unaltered initial values directly extracted from OCR")
    ocr_confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    
    status = models.CharField(max_length=30, choices=InvoiceStatus.choices, default=InvoiceStatus.UPLOADED)
    match_type = models.CharField(max_length=20, default='THREE_WAY', choices=[('TWO_WAY', '2-Way (PO vs Invoice)'), ('THREE_WAY', '3-Way (PO vs GRN vs Invoice)'), ('NON_PO', 'Non-PO Expense')])
    
    # Sensitive change control (Templegate Section 2.3)
    has_sensitive_edits = models.BooleanField(default=False)
    
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_invoices')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def update_totals_from_items(self):
        items = self.items.all()
        if items.exists():
            sub = sum(item.line_total for item in items)
            tax = sum(item.tax_amount for item in items)
            self.subtotal = sub
            self.tax_amount = tax
            self.grand_total = sub + tax
            self.save(update_fields=['subtotal', 'tax_amount', 'grand_total', 'updated_at'])

    def __str__(self):
        v_name = self.vendor.name if self.vendor else "Unknown Vendor"
        return f"{self.invoice_number} - {v_name} ({self.currency} {self.grand_total}) [{self.status}]"


class InvoiceLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    line_number = models.PositiveIntegerField()
    material_code = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=255)
    hsn_sac_code = models.CharField(max_length=15, blank=True, null=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    uom = models.CharField(max_length=20, default='NOS')
    tax_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=14, decimal_places=2)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.95'))

    class Meta:
        ordering = ['line_number']

    def save(self, *args, **kwargs):
        self.line_total = Decimal(str(self.quantity)) * Decimal(str(self.unit_price))
        if not self.tax_amount:
            self.tax_amount = self.line_total * (Decimal(str(self.tax_rate_percent)) / Decimal('100.00'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice.invoice_number} Line {self.line_number}: {self.description} (Qty: {self.quantity})"


class InvoiceChangeLog(models.Model):
    """
    Audit trail for human modifications to invoice values.
    Templegate Section 2.3 & Rule 3:
    - Distinguish OCR correction from suspicious manipulation.
    - Records user, timestamp, field, old_value, new_value, reason.
    - Sensitive fields trigger mandatory AP review.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='change_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    user_display = models.CharField(max_length=150)
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    reason = models.TextField(help_text="Mandatory explanation required for every manual edit")
    is_sensitive = models.BooleanField(default=False)
    reviewed_by_ap = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_changes')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        sens = " [SENSITIVE]" if self.is_sensitive else ""
        return f"Edit by {self.user_display} on {self.invoice.invoice_number}.{self.field_name}: '{self.old_value}' -> '{self.new_value}'{sens}"
