from decimal import Decimal
from django.db import transaction
from apps.matching.models import MatchingResult, MatchStatus
from apps.invoices.models import Invoice, InvoiceStatus
from apps.procurement.models import PurchaseOrder, POLineItem, GoodsReceiptNote, GRNLineItem
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity
from apps.core.audit import log_event


class POMatchingEngine:
    """
    Automated 2-Way and 3-Way Matching Engine (Module 4).
    Validates:
    - 2-Way: PO quantity vs Invoiced quantity, PO price vs Invoiced price.
    - 3-Way: PO vs GRN accepted quantity vs Invoiced quantity.
    - Supports configurable price variance tolerances (e.g. ±1%).
    - Support for multiple GRNs and partial deliveries.
    """

    DEFAULT_PRICE_TOLERANCE_PCT = Decimal('1.00')

    @classmethod
    @transaction.atomic
    def evaluate_invoice_match(cls, invoice, price_tolerance_pct=None):
        if price_tolerance_pct is None:
            price_tolerance_pct = cls.DEFAULT_PRICE_TOLERANCE_PCT

        details = []
        is_passed = True
        overall_status = MatchStatus.MATCHED
        discrepancies = []
        max_variance = Decimal('0.00')

        # 1. PO Existence Check
        if not invoice.po:
            is_passed = False
            overall_status = MatchStatus.MISSING_PO
            discrepancies.append("No Purchase Order linked to this invoice.")
            APException.objects.create(
                invoice=invoice,
                category=ExceptionCategory.PO_NOT_FOUND,
                description=f"Invoice #{invoice.invoice_number} has no linked PO. Purchasing review required.",
                severity=ExceptionSeverity.BLOCKING,
                assigned_role='PURCHASING'
            )
            return cls._save_result(invoice, overall_status, is_passed, price_tolerance_pct, max_variance, discrepancies, details)

        po = invoice.po
        po_items = {item.material_code.upper(): item for item in po.items.all() if item.material_code}
        # Also map by description if material code missing
        po_items_by_desc = {item.description.lower().strip(): item for item in po.items.all()}

        # 2. Iterate each Invoice Line Item
        for inv_item in invoice.items.all():
            item_match_info = {
                "line_number": inv_item.line_number,
                "description": inv_item.description,
                "material_code": inv_item.material_code,
                "invoice_qty": float(inv_item.quantity),
                "invoice_price": float(inv_item.unit_price),
                "po_qty": 0.0,
                "po_price": 0.0,
                "grn_accepted_qty": 0.0,
                "status": "MATCHED",
                "variance_pct": 0.0,
                "errors": []
            }

            # Find matching PO line item
            matched_po_item = None
            if inv_item.material_code and inv_item.material_code.upper() in po_items:
                matched_po_item = po_items[inv_item.material_code.upper()]
            else:
                for po_desc, p_item in po_items_by_desc.items():
                    if po_desc in inv_item.description.lower() or inv_item.description.lower() in po_desc:
                        matched_po_item = p_item
                        break

            if not matched_po_item:
                # Fallback to 1st PO item if single item order
                if po.items.count() == 1:
                    matched_po_item = po.items.first()

            if not matched_po_item:
                item_match_info["status"] = "UNMATCHED_ITEM"
                item_match_info["errors"].append("Material not found in PO line items.")
                is_passed = False
                overall_status = MatchStatus.PO_NOT_FOUND
                discrepancies.append(f"Line {inv_item.line_number} '{inv_item.description}' not found on PO {po.po_number}.")
                details.append(item_match_info)
                continue

            item_match_info["po_qty"] = float(matched_po_item.ordered_quantity)
            item_match_info["po_price"] = float(matched_po_item.unit_price)

            # Price Variance Check
            po_price = matched_po_item.unit_price
            inv_price = inv_item.unit_price
            if po_price > 0:
                variance_pct = abs((inv_price - po_price) / po_price) * Decimal('100.00')
                item_match_info["variance_pct"] = float(round(variance_pct, 2))
                if variance_pct > max_variance:
                    max_variance = variance_pct

                if variance_pct > price_tolerance_pct:
                    is_passed = False
                    item_match_info["status"] = "PRICE_MISMATCH"
                    item_match_info["errors"].append(
                        f"Price ₹{inv_price} differs from PO price ₹{po_price} by {variance_pct:.2f}% (Tolerance: ±{price_tolerance_pct}%)."
                    )
                    discrepancies.append(
                        f"Price discrepancy on '{inv_item.description}': Invoiced ₹{inv_price} vs PO ₹{po_price} (+{variance_pct:.1f}%)."
                    )
                    overall_status = MatchStatus.PRICE_MISMATCH

            # Quantity Check & 3-Way GRN Verification
            if invoice.match_type == 'THREE_WAY':
                # Sum accepted quantities across all GRNs for this PO item
                total_grn_accepted = sum(g.accepted_quantity for g in matched_po_item.grn_items.all())
                item_match_info["grn_accepted_qty"] = float(total_grn_accepted)

                if total_grn_accepted == 0:
                    is_passed = False
                    item_match_info["status"] = "MISSING_GRN"
                    item_match_info["errors"].append(f"No Goods Receipt Note (GRN) recorded for '{inv_item.description}'.")
                    discrepancies.append(f"Missing GRN for '{inv_item.description}'. Goods not yet confirmed as received.")
                    overall_status = MatchStatus.MISSING_GRN
                elif inv_item.quantity > total_grn_accepted:
                    is_passed = False
                    item_match_info["status"] = "QTY_MISMATCH"
                    excess = inv_item.quantity - total_grn_accepted
                    item_match_info["errors"].append(
                        f"Invoiced quantity ({inv_item.quantity}) exceeds warehouse accepted quantity ({total_grn_accepted}) by {excess} {inv_item.uom}."
                    )
                    discrepancies.append(
                        f"Quantity mismatch on '{inv_item.description}': Invoiced {inv_item.quantity} but GRN only received {total_grn_accepted}."
                    )
                    overall_status = MatchStatus.QTY_MISMATCH
            else:
                # 2-Way Match (PO vs Invoice)
                if inv_item.quantity > matched_po_item.ordered_quantity:
                    is_passed = False
                    item_match_info["status"] = "QTY_MISMATCH"
                    item_match_info["errors"].append(
                        f"Invoiced quantity ({inv_item.quantity}) exceeds PO quantity ({matched_po_item.ordered_quantity})."
                    )
                    discrepancies.append(f"Over-invoiced quantity on '{inv_item.description}'.")
                    overall_status = MatchStatus.OVER_INVOICING

            details.append(item_match_info)

        # Create APExceptions for blocking mismatches
        if not is_passed:
            category = ExceptionCategory.PRICE_MISMATCH if overall_status == MatchStatus.PRICE_MISMATCH else (
                ExceptionCategory.GRN_NOT_FOUND if overall_status == MatchStatus.MISSING_GRN else ExceptionCategory.QUANTITY_MISMATCH
            )
            APException.objects.create(
                invoice=invoice,
                category=category,
                description=" | ".join(discrepancies),
                severity=ExceptionSeverity.BLOCKING,
                assigned_role='PROCUREMENT' if category == ExceptionCategory.PRICE_MISMATCH else 'WAREHOUSE'
            )

        return cls._save_result(invoice, overall_status, is_passed, price_tolerance_pct, max_variance, discrepancies, details)

    @classmethod
    def _save_result(cls, invoice, status, is_passed, tolerance_pct, max_variance, discrepancies, details):
        result, _ = MatchingResult.objects.get_or_create(invoice=invoice)
        result.match_type = invoice.match_type
        result.status = status
        result.is_passed = is_passed
        result.price_tolerance_percent = tolerance_pct
        result.max_price_variance_found = max_variance
        result.discrepancy_summary = "\n".join(discrepancies) if discrepancies else "All line items, quantities, and prices matched within acceptable tolerances."
        result.item_matching_details = details
        result.save()

        # Update invoice workflow status
        if is_passed:
            invoice.status = InvoiceStatus.MATCH_PASSED
        else:
            invoice.status = InvoiceStatus.MATCH_FAILED
        invoice.save(update_fields=['status'])

        log_event(
            action='MATCHING_EVALUATED',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            details={'is_passed': is_passed, 'status': status, 'discrepancies': discrepancies}
        )

        return result
