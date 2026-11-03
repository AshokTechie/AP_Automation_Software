import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from apps.invoices.models import Invoice


class MatchStatus(models.TextChoices):
    MATCHED = 'MATCHED', 'Fully Matched (Passed)'
    PRICE_MISMATCH = 'PRICE_MISMATCH', 'Price Discrepancy'
    QTY_MISMATCH = 'QTY_MISMATCH', 'Quantity Discrepancy'
    MISSING_PO = 'MISSING_PO', 'PO Missing or Not Found'
    MISSING_GRN = 'MISSING_GRN', 'GRN Missing (Goods Not Received)'
    OVER_INVOICING = 'OVER_INVOICING', 'Over-Invoicing (Exceeds PO)'


class MatchingResult(models.Model):
    """
    Stores 2-Way and 3-Way matching evaluation results.
    Preserves audit evidence for why an invoice passed or failed matching.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='matching_result')
    match_type = models.CharField(max_length=20, default='THREE_WAY', choices=[('TWO_WAY', '2-Way'), ('THREE_WAY', '3-Way')])
    status = models.CharField(max_length=30, choices=MatchStatus.choices, default=MatchStatus.MATCHED)
    
    # Tolerances applied during evaluation
    price_tolerance_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    max_price_variance_found = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))
    
    # Discrepancy Breakdown
    discrepancy_summary = models.TextField(blank=True, null=True)
    item_matching_details = models.JSONField(blank=True, null=True)
    
    is_passed = models.BooleanField(default=False)
    evaluated_at = models.DateTimeField(auto_now=True)
    override_approved = models.BooleanField(default=False)
    override_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    override_reason = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Match for {self.invoice.invoice_number}: {self.get_status_display()} [Passed: {self.is_passed}]"
