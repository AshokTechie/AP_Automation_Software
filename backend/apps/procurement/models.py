import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from apps.vendors.models import Vendor


class POStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    OPEN = 'OPEN', 'Open (Awaiting Delivery)'
    PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', 'Partially Received'
    FULLY_RECEIVED = 'FULLY_RECEIVED', 'Fully Received'
    CLOSED = 'CLOSED', 'Closed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class GRNStatus(models.TextChoices):
    RECEIVED = 'RECEIVED', 'Goods Received'
    INSPECTED_ACCEPTED = 'INSPECTED_ACCEPTED', 'Inspected & Accepted'
    PARTIAL_REJECTED = 'PARTIAL_REJECTED', 'Partially Rejected'
    REJECTED = 'REJECTED', 'Fully Rejected'


class PurchaseOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=50, unique=True, db_index=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='purchase_orders')
    issue_date = models.DateField()
    expected_delivery_date = models.DateField(blank=True, null=True)
    payment_terms = models.CharField(max_length=100, default='Net 30 Days')
    currency = models.CharField(max_length=3, default='INR')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=30, choices=POStatus.choices, default=POStatus.OPEN)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']

    def update_totals(self):
        """Recalculates subtotal, tax and grand total from line items"""
        items = self.items.all()
        sub = sum(item.line_total for item in items)
        tax = sum((item.line_total * (item.tax_rate_percent / Decimal('100.00'))) for item in items)
        self.subtotal = sub
        self.tax_amount = tax
        self.total_amount = sub + tax
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'updated_at'])

    def __str__(self):
        return f"{self.po_number} - {self.vendor.name} ({self.currency} {self.total_amount})"


class POLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    line_number = models.PositiveIntegerField()
    material_code = models.CharField(max_length=50, db_index=True)
    description = models.CharField(max_length=255)
    hsn_sac_code = models.CharField(max_length=10, blank=True, null=True)
    ordered_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    received_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'))
    invoiced_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'))
    uom = models.CharField(max_length=20, default='NOS')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('18.00'))
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['line_number']
        unique_together = ['po', 'line_number']

    def save(self, *args, **kwargs):
        self.line_total = Decimal(str(self.ordered_quantity)) * Decimal(str(self.unit_price))
        super().save(*args, **kwargs)

    @property
    def remaining_receipt_quantity(self):
        return max(Decimal('0.000'), self.ordered_quantity - self.received_quantity)

    @property
    def remaining_invoice_quantity(self):
        return max(Decimal('0.000'), self.ordered_quantity - self.invoiced_quantity)

    def __str__(self):
        return f"{self.po.po_number} Item #{self.line_number}: {self.description} ({self.ordered_quantity} {self.uom})"


class GoodsReceiptNote(models.Model):
    """
    GRN / MRN: Material receipt voucher recorded by the Warehouse team.
    Crucial for 3-Way Matching (PO vs GRN vs Invoice).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grn_number = models.CharField(max_length=50, unique=True, db_index=True)
    po = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name='grns')
    receipt_date = models.DateField()
    delivery_note_number = models.CharField(max_length=100, blank=True, null=True, help_text="Vendor Challan/Delivery Note #")
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    warehouse_location = models.CharField(max_length=100, default='Central Warehouse')
    status = models.CharField(max_length=30, choices=GRNStatus.choices, default=GRNStatus.INSPECTED_ACCEPTED)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-receipt_date', '-created_at']

    def __str__(self):
        return f"{self.grn_number} (PO: {self.po.po_number}) - {self.receipt_date}"


class GRNLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.CASCADE, related_name='items')
    po_item = models.ForeignKey(POLineItem, on_delete=models.PROTECT, related_name='grn_items')
    material_code = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    received_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    accepted_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    rejected_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'))
    uom = models.CharField(max_length=20, default='NOS')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Automatically update PO Line item received_quantity
        total_accepted = sum(item.accepted_quantity for item in self.po_item.grn_items.all())
        self.po_item.received_quantity = total_accepted
        self.po_item.save(update_fields=['received_quantity'])
        
        # Update PO overall status if all items received
        po = self.po_item.po
        all_items = po.items.all()
        if all_items.exists():
            if all(item.received_quantity >= item.ordered_quantity for item in all_items):
                po.status = POStatus.FULLY_RECEIVED
            elif any(item.received_quantity > 0 for item in all_items):
                po.status = POStatus.PARTIALLY_RECEIVED
            po.save(update_fields=['status'])

    def __str__(self):
        return f"{self.grn.grn_number} - {self.description}: Accepted {self.accepted_quantity} {self.uom}"


class ImportBatch(models.Model):
    """
    Tracks Excel and CSV bulk uploads for PO and GRN datasets.
    Templegate Challenge 2.6: Row-level error reporting, preview before commit.
    """
    BATCH_TYPE = [
        ('PO', 'Purchase Orders Bulk Import'),
        ('GRN', 'Goods Receipts Bulk Import'),
    ]
    STATUS = [
        ('PREVIEW', 'Preview / Validated'),
        ('COMMITTED', 'Committed to Database'),
        ('REJECTED', 'Rejected / Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch_type = models.CharField(max_length=10, choices=BATCH_TYPE)
    file_name = models.CharField(max_length=255)
    uploaded_file = models.FileField(upload_to='imports/')
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    invalid_rows = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS, default='PREVIEW')
    preview_data = models.JSONField(blank=True, null=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.batch_type} Batch #{self.file_name} ({self.valid_rows}/{self.total_rows} Valid)"


class ImportRowError(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='row_errors')
    row_number = models.IntegerField()
    field_name = models.CharField(max_length=100)
    rejected_value = models.TextField(blank=True, null=True)
    error_message = models.TextField()

    def __str__(self):
        return f"Row {self.row_number} [{self.field_name}]: {self.error_message}"
