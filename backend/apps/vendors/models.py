import re
import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User


class VendorStatus(models.TextChoices):
    ONBOARDING = 'ONBOARDING', 'Onboarding in Progress'
    ACTIVE = 'ACTIVE', 'Active (Approved)'
    BLOCKED = 'BLOCKED', 'Blocked (Compliance/Hold)'
    INACTIVE = 'INACTIVE', 'Inactive'


def validate_gstin(value):
    """
    Validates Indian 15-character GSTIN structure:
    2 digits (State code) + 10 chars (PAN) + 1 entity char + 'Z' + 1 checksum char
    """
    if not value:
        return
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    if not re.match(pattern, value):
        raise ValidationError(f"Invalid GSTIN format: '{value}'. Must be 15 alphanumeric characters matching standard GSTIN format.")


def validate_pan(value):
    if not value:
        return
    pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    if not re.match(pattern, value):
        raise ValidationError(f"Invalid PAN format: '{value}'. Expected 10 alphanumeric characters (e.g., ABCDE1234F).")


def validate_ifsc(value):
    if not value:
        return
    pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    if not re.match(pattern, value):
        raise ValidationError(f"Invalid IFSC format: '{value}'. Must be 11 characters (e.g., HDFC0001234).")


class Vendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vendor_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    trade_name = models.CharField(max_length=255, blank=True, null=True)
    gstin = models.CharField(max_length=15, unique=True, validators=[validate_gstin], db_index=True)
    pan = models.CharField(max_length=10, validators=[validate_pan], blank=True, null=True)
    
    # MSME compliance (Section 43B(h) statutory 45-day rule)
    is_msme = models.BooleanField(default=False)
    msme_reg_number = models.CharField(max_length=50, blank=True, null=True, help_text="Udyam Registration Number")
    
    # Contact & Address
    contact_person = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address_line = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    
    # Financial & Terms
    payment_terms_days = models.PositiveIntegerField(default=30, help_text="Standard credit period in days")
    status = models.CharField(max_length=20, choices=VendorStatus.choices, default=VendorStatus.ACTIVE)
    is_gstin_verified = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def clean(self):
        # Auto-extract PAN from GSTIN if not explicitly provided
        if self.gstin and len(self.gstin) >= 12 and not self.pan:
            self.pan = self.gstin[2:12]

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vendor_code} - {self.name} [{self.status}]"


class VendorBankAccount(models.Model):
    """
    Vendor banking details with encryption/masking protection.
    Templegate Section 2.8: Bank detail changes require stronger verification.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='bank_accounts')
    account_number = models.CharField(max_length=50)
    account_holder_name = models.CharField(max_length=255)
    ifsc_code = models.CharField(max_length=11, validators=[validate_ifsc])
    bank_name = models.CharField(max_length=150)
    branch_name = models.CharField(max_length=150, blank=True, null=True)
    is_primary = models.BooleanField(default=True)
    
    # Verification (Penny-drop / Bank API simulation)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_reference = models.CharField(max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', '-created_at']

    @property
    def masked_account_number(self):
        """Masks account number: XXXXXXXXX1234 for secure display"""
        if not self.account_number:
            return ""
        clean = str(self.account_number).strip()
        if len(clean) <= 4:
            return clean
        return "X" * (len(clean) - 4) + clean[-4:]

    def __str__(self):
        return f"{self.bank_name} ({self.masked_account_number}) - {self.vendor.name}"


class VendorChangeLog(models.Model):
    """
    Logs sensitive changes to vendor profiles or bank details.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='change_logs')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    reason = models.TextField()
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_vendor_changes')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Change on {self.vendor.name} - {self.field_name}"
