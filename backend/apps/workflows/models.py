import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from apps.invoices.models import Invoice
from apps.core.models import UserRole


class ApprovalStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    ESCALATED = 'ESCALATED', 'Escalated'


class ApprovalMatrixRule(models.Model):
    """
    Configurable Approval Matrix (Module 5 & Point 5.2).
    Maps invoice amount thresholds and criteria to required approver roles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    min_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    max_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('999999999.00'))
    required_role = models.CharField(max_length=30, choices=UserRole.choices, default=UserRole.FINANCE_MANAGER)
    department = models.CharField(max_length=100, blank=True, null=True, help_text="Specific department or all if blank")
    tier_order = models.PositiveIntegerField(default=1, help_text="1 = First tier approval, 2 = Second tier, etc.")
    sla_hours = models.PositiveIntegerField(default=48, help_text="Hours before escalation")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['tier_order', 'min_amount']

    def __str__(self):
        return f"[{self.tier_order}] {self.name}: ₹{self.min_amount:,.0f} - ₹{self.max_amount:,.0f} -> {self.get_required_role_display()}"


class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='approvals')
    rule = models.ForeignKey(ApprovalMatrixRule, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_role = models.CharField(max_length=30, choices=UserRole.choices)
    assigned_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approval_tasks')
    tier_order = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING, db_index=True)
    comments = models.TextField(blank=True, null=True)
    actioned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='actioned_approvals')
    actioned_at = models.DateTimeField(null=True, blank=True)
    escalation_deadline = models.DateTimeField(null=True, blank=True)
    is_escalated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tier_order', 'created_at']

    def is_overdue(self):
        if self.status == ApprovalStatus.PENDING and self.escalation_deadline:
            return timezone.now() > self.escalation_deadline
        return False

    def __str__(self):
        return f"{self.invoice.invoice_number} Tier {self.tier_order} [{self.get_status_display()}] - {self.assigned_role}"
