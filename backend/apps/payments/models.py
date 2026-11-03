import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from apps.invoices.models import Invoice
from apps.vendors.models import Vendor, VendorBankAccount


class PaymentStatus(models.TextChoices):
    NOT_REQUESTED = 'NOT_REQUESTED', 'Not Requested'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Treasury Approval'
    PROCESSING = 'PROCESSING', 'Processing with Bank Gateway'
    COMPLETED = 'COMPLETED', 'Payment Settled (Confirmed)'
    FAILED = 'FAILED', 'Bank Payment Rejected'
    ON_HOLD = 'ON_HOLD', 'On Hold (Bank Details Issue)'


class PaymentMode(models.TextChoices):
    NEFT = 'NEFT', 'NEFT (National Electronic Funds Transfer)'
    RTGS = 'RTGS', 'RTGS (Real Time Gross Settlement)'
    IMPS = 'IMPS', 'IMPS (Immediate Payment Service)'
    NACH = 'NACH', 'NACH Corporate Direct Debit'


class PaymentRequest(models.Model):
    """
    Payment Request & Banking Settlement Entity (Module 7 & Point 7).
    Follows Templegate Rule 11: Do not mark payment complete without bank confirmation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.OneToOneField(Invoice, on_delete=models.PROTECT, related_name='payment')
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='payments')
    bank_account = models.ForeignKey(VendorBankAccount, on_delete=models.PROTECT, related_name='payments')
    
    # Financials & Withholding Tax (TDS Section 194Q / 194C)
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2)
    tds_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.10'), help_text="e.g. 0.1% TDS on Goods u/s 194Q")
    tds_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    net_payable_amount = models.DecimalField(max_digits=14, decimal_places=2)
    
    payment_mode = models.CharField(max_length=10, choices=PaymentMode.choices, default=PaymentMode.NEFT)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING_APPROVAL, db_index=True)
    
    # Bank Confirmation Evidence (Templegate Point 7.3)
    utr_number = models.CharField(max_length=50, blank=True, null=True, unique=True, help_text="Unique Transaction Reference issued by RBI / Core Bank")
    bank_reference = models.CharField(max_length=100, blank=True, null=True)
    bank_response_code = models.CharField(max_length=20, blank=True, null=True)
    bank_response_message = models.TextField(blank=True, null=True)
    
    # Payment Advice Document
    advice_pdf = models.FileField(upload_to='payment_advices/', blank=True, null=True)
    
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_payments')
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-requested_at']

    def calculate_totals(self):
        self.gross_amount = self.invoice.grand_total
        self.tds_amount = (self.gross_amount * (self.tds_rate_percent / Decimal('100.00'))).quantize(Decimal('0.01'))
        self.net_payable_amount = self.gross_amount - self.tds_amount

    def save(self, *args, **kwargs):
        if not self.net_payable_amount:
            self.calculate_totals()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment #{self.id.hex[:8].upper()} for {self.invoice.invoice_number} - ₹{self.net_payable_amount} [{self.status}]"
