from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from apps.workflows.models import ApprovalMatrixRule, ApprovalRequest, ApprovalStatus
from apps.invoices.models import Invoice, InvoiceStatus
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity
from apps.core.models import UserRole
from apps.core.audit import log_event


class WorkflowApprovalEngine:
    """
    Workflow & Approval Engine (Module 5 & Point 5).
    Evaluates dynamic rules, initiates tiered approvals, enforces separation of duties,
    and manages SLA escalations.
    """

    @classmethod
    @transaction.atomic
    def initiate_workflow(cls, invoice):
        """
        Creates approval tasks according to invoice grand total and configured matrix.
        """
        # Ensure blocking exceptions are resolved first (Templegate Rule 6)
        blocking_exceptions = APException.objects.filter(invoice=invoice, resolved=False, severity=ExceptionSeverity.BLOCKING)
        if blocking_exceptions.exists():
            return False, "Cannot route for approval while blocking exceptions remain unresolved (Templegate Rule 6)."

        # Clear old pending approvals if any
        invoice.approvals.filter(status=ApprovalStatus.PENDING).delete()

        # Find matching approval rules based on amount
        rules = ApprovalMatrixRule.objects.filter(
            is_active=True,
            min_amount__lte=invoice.grand_total,
            max_amount__gte=invoice.grand_total
        ).order_by('tier_order')

        if not rules.exists():
            # Fallback default rule: Finance Manager approval
            rule, _ = ApprovalMatrixRule.objects.get_or_create(
                name="Default Manager Approval",
                defaults={
                    'min_amount': Decimal('0.00'),
                    'max_amount': Decimal('999999999.00'),
                    'required_role': UserRole.FINANCE_MANAGER,
                    'tier_order': 1,
                    'sla_hours': 48
                }
            )
            rules = [rule]

        created_approvals = []
        for r in rules:
            deadline = timezone.now() + timedelta(hours=r.sla_hours)
            approval = ApprovalRequest.objects.create(
                invoice=invoice,
                rule=r,
                assigned_role=r.required_role,
                tier_order=r.tier_order,
                status=ApprovalStatus.PENDING,
                escalation_deadline=deadline
            )
            created_approvals.append(approval)

        invoice.status = InvoiceStatus.PENDING_APPROVAL
        invoice.save(update_fields=['status'])

        log_event(
            action='APPROVAL_WORKFLOW_INITIATED',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            details={'tier_count': len(created_approvals), 'grand_total': str(invoice.grand_total)}
        )

        return True, f"Approval workflow initiated with {len(created_approvals)} tier(s)."

    @classmethod
    @transaction.atomic
    def process_decision(cls, approval_id, user, decision, comments=None):
        """
        Processes APPROVE or REJECT decision.
        Enforces separation of duties and tier progression.
        """
        try:
            approval = ApprovalRequest.objects.select_related('invoice').get(id=approval_id)
        except ApprovalRequest.DoesNotExist:
            return False, "Approval request not found."

        if approval.status != ApprovalStatus.PENDING:
            return False, f"Approval request is already in '{approval.get_status_display()}' status."

        invoice = approval.invoice

        # Separation of duties (Templegate Section 2.7: Prevent self-approval)
        if user and user.is_authenticated and invoice.uploaded_by == user:
            return False, "Separation of duties violation: You cannot approve an invoice that you uploaded yourself."

        # Rejection handling
        if decision == 'REJECT':
            if not comments:
                return False, "A rejection reason is mandatory (Templegate Section 2.7)."

            approval.status = ApprovalStatus.REJECTED
            approval.comments = comments
            approval.actioned_by = user if user and user.is_authenticated else None
            approval.actioned_at = timezone.now()
            approval.save()

            invoice.status = InvoiceStatus.REJECTED
            invoice.save(update_fields=['status'])

            # Log rejection exception
            APException.objects.create(
                invoice=invoice,
                category=ExceptionCategory.APPROVAL_REJECTED,
                description=f"Rejected at Tier {approval.tier_order} by {user.get_full_name() or 'Approver'}. Reason: {comments}",
                severity=ExceptionSeverity.BLOCKING,
                assigned_role='AP_CLERK'
            )

            log_event(
                action='INVOICE_REJECTED',
                entity_type='ApprovalRequest',
                entity_id=str(approval.id),
                user=user,
                reason=comments
            )
            return True, "Invoice rejected successfully."

        # Approval handling
        elif decision == 'APPROVE':
            approval.status = ApprovalStatus.APPROVED
            approval.comments = comments or "Approved"
            approval.actioned_by = user if user and user.is_authenticated else None
            approval.actioned_at = timezone.now()
            approval.save()

            log_event(
                action='INVOICE_APPROVED',
                entity_type='ApprovalRequest',
                entity_id=str(approval.id),
                user=user,
                details={'tier': approval.tier_order}
            )

            # Check if all tiers approved
            remaining_tiers = invoice.approvals.filter(status=ApprovalStatus.PENDING)
            if not remaining_tiers.exists():
                invoice.status = InvoiceStatus.APPROVED
                invoice.save(update_fields=['status'])
                return True, "Final approval completed! Invoice is approved and ready for payment."
            else:
                return True, f"Tier {approval.tier_order} approved. Forwarded to Tier {remaining_tiers.first().tier_order}."

        return False, "Invalid decision type."
