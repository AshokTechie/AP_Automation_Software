import uuid
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserRole(models.TextChoices):
    EMPLOYEE = 'EMPLOYEE', 'Employee (Uploader/Editor)'
    AP_CLERK = 'AP_CLERK', 'AP Specialist / Reviewer'
    PURCHASING = 'PURCHASING', 'Purchasing Officer'
    WAREHOUSE = 'WAREHOUSE', 'Warehouse Officer'
    FINANCE_MANAGER = 'FINANCE_MANAGER', 'Finance Manager (Approver)'
    CONTROLLER = 'CONTROLLER', 'Financial Controller'
    CFO = 'CFO', 'Chief Financial Officer'
    ADMIN = 'ADMIN', 'System Administrator'


class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, choices=UserRole.choices, default=UserRole.EMPLOYEE)
    department = models.CharField(max_length=100, default='Finance')
    approval_limit_inr = models.DecimalField(max_digits=14, decimal_places=2, default=50000.00)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()}) - {self.department}"


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        if hasattr(instance, 'profile'):
            instance.profile.save()


class AuditLog(models.Model):
    """
    Centralized immutable audit trail.
    Templegate Rule 10 & Section 12:
    - Never delete or alter audit history.
    - Records user, action, affected entity, timestamp, old and new values.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    user_display = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=80)  # e.g., 'INVOICE_UPLOAD', 'OCR_EXTRACT', 'FIELD_EDITED', 'APPROVAL'
    entity_type = models.CharField(max_length=60)  # e.g., 'Invoice', 'PurchaseOrder', 'Vendor'
    entity_id = models.CharField(max_length=100)
    old_values = models.JSONField(blank=True, null=True)
    new_values = models.JSONField(blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    details = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.user and not self.user_display:
            self.user_display = f"{self.user.get_full_name() or self.user.username} ({getattr(self.user.profile, 'role', 'USER')})"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {self.user_display} -> {self.action} on {self.entity_type}:{self.entity_id}"
