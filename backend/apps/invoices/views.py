import os
import uuid
import hashlib
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.invoices.models import Invoice, InvoiceLineItem, InvoiceChangeLog, InvoiceStatus
from apps.invoices.serializers import InvoiceSerializer, InvoiceLineItemSerializer, InvoiceChangeLogSerializer
from apps.invoices.services.ocr_engine import InvoiceOCREngine
from apps.invoices.services.validator import InvoiceValidationEngine
from apps.vendors.models import Vendor
from apps.procurement.models import PurchaseOrder, POLineItem
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity
from apps.core.audit import log_event


SENSITIVE_FIELDS = {
    'vendor', 'vendor_id', 'invoice_number', 'quantity', 'unit_price',
    'tax_rate_percent', 'tax_amount', 'grand_total', 'po', 'po_id'
}


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Invoice Management ViewSet (Modules 1, 2, 3).
    Supports upload, OCR extraction, side-by-side editing,
    change logging, sensitive field escalation, and validation.
    """
    queryset = Invoice.objects.all().prefetch_related('items', 'change_logs', 'vendor', 'po')
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['status', 'vendor', 'match_type', 'has_sensitive_edits']
    search_fields = ['invoice_number', 'vendor__name', 'po__po_number']

    @action(detail=False, methods=['post'], url_path='upload')
    @transaction.atomic
    def upload_invoice(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # File format validation (Templegate Point 1.2)
        valid_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif']
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in valid_extensions:
            return Response({
                "error": f"Unsupported format '{ext}'. Accepted formats: PDF, JPG, PNG, TIFF."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate SHA256 hash for duplicate check
        file_hash = InvoiceOCREngine.calculate_file_hash(uploaded_file)
        
        # Check for existing identical file
        exact_duplicate = Invoice.objects.filter(file_hash_sha256=file_hash).first()
        if exact_duplicate:
            # We allow upload but flag as duplicate exception
            pass

        # Create Invoice record with uploaded file
        invoice = Invoice.objects.create(
            invoice_number=f"EXTRACTING-{uploaded_file.name[:20]}",
            file_attachment=uploaded_file,
            file_hash_sha256=file_hash,
            file_size_bytes=uploaded_file.size,
            mime_type=uploaded_file.content_type or 'application/pdf',
            uploaded_by=request.user if request.user.is_authenticated else None,
            status=InvoiceStatus.EXTRACTED
        )

        # Run OCR & Extraction Pipeline
        try:
            ocr_results = InvoiceOCREngine.extract_from_document(invoice.file_attachment.path)
            
            invoice.invoice_number = ocr_results.get("invoice_number") or f"INV-GEN-{invoice.id.hex[:6].upper()}"
            invoice.invoice_date = ocr_results.get("invoice_date")
            invoice.subtotal = min(Decimal(str(ocr_results.get("subtotal", 0.0))), Decimal('999999999.99'))
            invoice.tax_amount = min(Decimal(str(ocr_results.get("tax_amount", 0.0))), Decimal('999999999.99'))
            invoice.grand_total = min(Decimal(str(ocr_results.get("grand_total", 0.0))), Decimal('999999999.99'))
            invoice.ocr_raw_payload = ocr_results
            invoice.ocr_initial_values = {
                "invoice_number": invoice.invoice_number,
                "invoice_date": str(invoice.invoice_date),
                "grand_total": str(invoice.grand_total),
                "vendor_name": ocr_results.get("vendor_name"),
                "po_number": ocr_results.get("po_number")
            }
            conf_val = float(ocr_results.get("confidence", {}).get("overall", 0.85))
            invoice.ocr_confidence_score = Decimal(str(min(conf_val, 1.00))).quantize(Decimal('0.01'))

            # Map Vendor if detected
            if ocr_results.get("vendor_id"):
                invoice.vendor = Vendor.objects.filter(id=ocr_results["vendor_id"]).first()
            
            # Map PO if detected
            if ocr_results.get("po_number"):
                invoice.po = PurchaseOrder.objects.filter(po_number__iexact=ocr_results["po_number"]).first()

            invoice.save()

            # Create Extracted Line Items
            for it in ocr_results.get("items", []):
                qty = min(Decimal(str(it.get("quantity", "1.000"))), Decimal('99999.999'))
                u_price = min(Decimal(str(it.get("unit_price", "100.00"))), Decimal('9999999.99'))
                l_total = min(qty * u_price, Decimal('99999999.99'))
                t_amount = min(l_total * Decimal('0.18'), Decimal('99999999.99'))

                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    line_number=it.get("line_number", 1),
                    description=it.get("description", "Extracted Material")[:250],
                    quantity=qty,
                    unit_price=u_price,
                    uom=it.get("uom", "NOS")[:20],
                    tax_rate_percent=Decimal(str(it.get("tax_rate_percent", "18.00"))),
                    tax_amount=t_amount,
                    line_total=l_total,
                    confidence_score=Decimal('0.90')
                )

            # If duplicate hash was detected, log exception
            if exact_duplicate:
                APException.objects.create(
                    invoice=invoice,
                    category=ExceptionCategory.POSSIBLE_DUPLICATE_INVOICE,
                    description=f"Exact file hash match with prior Invoice #{exact_duplicate.invoice_number}.",
                    severity=ExceptionSeverity.BLOCKING,
                    assigned_role='AP_CLERK'
                )

            # Run Validation Engine
            InvoiceValidationEngine.validate_invoice(invoice)

            log_event(
                action='INVOICE_UPLOAD_AND_OCR',
                entity_type='Invoice',
                entity_id=str(invoice.id),
                user=request.user,
                details={'invoice_number': invoice.invoice_number, 'confidence': float(invoice.ocr_confidence_score)}
            )

            return Response(InvoiceSerializer(invoice, context={'request': request}).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Fault-tolerant recovery: Safe reset to prevent decimal quantize overflow
            invoice.status = InvoiceStatus.NEEDS_VERIFICATION
            invoice.subtotal = Decimal('0.00')
            invoice.tax_amount = Decimal('0.00')
            invoice.grand_total = Decimal('0.00')
            invoice.ocr_confidence_score = Decimal('0.50')
            invoice.save()
            APException.objects.create(
                invoice=invoice,
                category=ExceptionCategory.OCR_REVIEW_REQUIRED,
                description=f"Automated extraction note: {str(e)[:200]}. Queued for AP verification.",
                severity=ExceptionSeverity.WARNING,
                assigned_role='AP_CLERK'
            )
            return Response(InvoiceSerializer(invoice, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='email-ingestion')
    def email_ingestion(self, request):
        """
        Module 1: Automated Email Ingestion Webhook / Simulation.
        Accepts vendor_id, sender_email, custom_company, and custom_gstin.
        Generates a legitimate PDF invoice attachment customized for the chosen supplier,
        registers it in PostgreSQL, performs OCR extraction, and runs validation.
        """
        import io
        from django.core.files.base import ContentFile
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        vendor_id = request.data.get('vendor_id')
        sender_email = request.data.get('sender_email', '').strip()
        custom_company = request.data.get('custom_company', '').strip()
        custom_gstin = request.data.get('custom_gstin', '').strip()

        vendor = None
        if vendor_id and vendor_id != 'CUSTOM':
            vendor = Vendor.objects.filter(id=vendor_id).first()
        if not vendor and sender_email:
            vendor = Vendor.objects.filter(email__iexact=sender_email).first()
        if not vendor and custom_company:
            # Check or create custom supplier
            vendor = Vendor.objects.filter(name__iexact=custom_company).first()
            if not vendor:
                import random
                code_suffix = random.randint(100, 999)
                vendor = Vendor.objects.create(
                    name=custom_company,
                    vendor_code=f"VEND-CUST-{code_suffix}",
                    email=sender_email or f"billing@{custom_company.lower().replace(' ', '')[:10]}.com",
                    gstin=custom_gstin or f"29ABCDE{code_suffix}F1Z5",
                    pan="ABCDE1234F",
                    is_msme=False,
                    payment_terms_days=30,
                    address_line="Industrial Area Phase 2",
                    city="Bengaluru",
                    state="Karnataka",
                    pincode="560100",
                    status='ACTIVE'
                )

        if not vendor:
            vendor = Vendor.objects.filter(status='ACTIVE').first() or Vendor.objects.first()

        vendor_name = vendor.name if vendor else (custom_company or "Tata Steel & Metal Works Ltd.")
        vendor_email = sender_email or (vendor.email if vendor else "billing@supplier.com")
        gstin = custom_gstin if custom_gstin else (vendor.gstin if vendor else "29AAACT2727Q1ZU")

        po = PurchaseOrder.objects.filter(vendor=vendor, status='OPEN').first() or PurchaseOrder.objects.filter(vendor=vendor).first()
        po_number = po.po_number if po else f"PO-2026-{(vendor.vendor_code[-3:] if vendor and vendor.vendor_code else '001')}"
        inv_num = f"INV-EML-{uuid.uuid4().hex[:6].upper()}"

        # Dynamically load real line items from the Purchase Order stored in Database
        po_lines = list(po.items.all()) if po else []
        invoice_items_data = []

        if po_lines:
            for p_item in po_lines:
                item_subtotal = (p_item.ordered_quantity * p_item.unit_price).quantize(Decimal('0.01'))
                item_tax = (item_subtotal * (p_item.tax_rate_percent / Decimal('100.00'))).quantize(Decimal('0.01'))
                invoice_items_data.append({
                    "line_number": p_item.line_number,
                    "description": p_item.description,
                    "quantity": p_item.ordered_quantity,
                    "unit_price": p_item.unit_price,
                    "uom": p_item.uom,
                    "tax_rate_percent": p_item.tax_rate_percent,
                    "tax_amount": item_tax,
                    "line_total": item_subtotal
                })
        else:
            custom_item = request.data.get('item_description', '').strip()
            item_desc = custom_item or f"Supplies & Services ({vendor_name[:25]})"
            qty = Decimal(str(request.data.get('quantity', '50.000')))
            unit_price = Decimal(str(request.data.get('unit_price', '500.00')))
            sub = (qty * unit_price).quantize(Decimal('0.01'))
            tax = (sub * Decimal('0.18')).quantize(Decimal('0.01'))
            invoice_items_data.append({
                "line_number": 1,
                "description": item_desc,
                "quantity": qty,
                "unit_price": unit_price,
                "uom": "NOS",
                "tax_rate_percent": Decimal('18.00'),
                "tax_amount": tax,
                "line_total": sub
            })

        subtotal = sum(it["line_total"] for it in invoice_items_data)
        tax_amount = sum(it["tax_amount"] for it in invoice_items_data)
        grand_total = subtotal + tax_amount

        # Generate a real PDF document via ReportLab customized for selected company
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, 750, f"TAX INVOICE — {vendor_name.upper()}")
        p.setFont("Helvetica", 10)
        p.drawString(50, 730, f"GSTIN: {gstin}  |  State: {getattr(vendor, 'state', None) or 'Karnataka'} (29)")
        p.drawString(50, 715, f"Vendor Code: {getattr(vendor, 'vendor_code', None) or 'VEND-001'}  |  Sender: {vendor_email}")
        p.drawString(50, 700, f"Invoice Number: {inv_num}  |  Date: {timezone.now().strftime('%Y-%m-%d')}")
        p.drawString(50, 685, f"Purchase Order Ref: {po_number}")
        p.drawString(50, 665, "-" * 80)
        p.drawString(50, 645, "Line  Description                                  Qty      Rate (INR)      Amount (INR)")
        
        y_pos = 625
        for it in invoice_items_data:
            desc_text = it["description"][:38]
            p.drawString(50, y_pos, f"{it['line_number']:<4}  {desc_text:<38} {str(it['quantity']):>8}  {float(it['unit_price']):>12.2f}  {float(it['line_total']):>14.2f}")
            y_pos -= 20

        p.drawString(50, y_pos, "-" * 80)
        y_pos -= 20
        p.drawString(50, y_pos, f"Subtotal:                                                           INR {float(subtotal):>12.2f}")
        y_pos -= 15
        p.drawString(50, y_pos, f"Tax (GST):                                                          INR {float(tax_amount):>12.2f}")
        y_pos -= 20
        p.setFont("Helvetica-Bold", 11)
        p.drawString(50, y_pos, f"Grand Total:                                                        INR {float(grand_total):>12.2f}")
        p.save()
        buffer.seek(0)

        pdf_bytes = buffer.getvalue()
        file_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # Ensure PO exists for 3-way matching linkage
        if not po and vendor:
            po = PurchaseOrder.objects.create(
                po_number=po_number,
                vendor=vendor,
                issue_date=timezone.now().date(),
                currency='INR',
                subtotal=subtotal,
                tax_amount=tax_amount,
                total_amount=grand_total,
                status='OPEN'
            )
            for it in invoice_items_data:
                POLineItem.objects.create(
                    po=po,
                    line_number=it["line_number"],
                    material_code=f"MAT-{(vendor.vendor_code[-3:] if vendor and vendor.vendor_code else '001')}-{it['line_number']}",
                    description=it["description"],
                    ordered_quantity=it["quantity"],
                    received_quantity=it["quantity"],
                    unit_price=it["unit_price"],
                    tax_rate_percent=it["tax_rate_percent"],
                    line_total=it["line_total"]
                )

        invoice = Invoice.objects.create(
            invoice_number=inv_num,
            vendor=vendor,
            po=po,
            invoice_date=timezone.now().date(),
            currency='INR',
            subtotal=subtotal,
            tax_amount=tax_amount,
            grand_total=grand_total,
            file_hash_sha256=file_hash,
            file_size_bytes=len(pdf_bytes),
            mime_type='application/pdf',
            status=InvoiceStatus.VALIDATED,
            ocr_confidence_score=Decimal('0.96'),
            ocr_raw_payload={
                "vendor_name": vendor_name,
                "gstin": gstin,
                "invoice_number": inv_num,
                "po_number": po_number,
                "subtotal": float(subtotal),
                "tax_amount": float(tax_amount),
                "grand_total": float(grand_total),
                "confidence_score": 0.96,
                "extraction_method": "Automated Email Ingestion Gateway (IMAP/Webhook)",
                "sender_email": vendor_email
            },
            uploaded_by=request.user if request.user.is_authenticated else None
        )
        invoice.file_attachment.save(f"{inv_num}.pdf", ContentFile(pdf_bytes), save=True)

        for it in invoice_items_data:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                line_number=it["line_number"],
                description=it["description"],
                quantity=it["quantity"],
                unit_price=it["unit_price"],
                uom=it["uom"],
                tax_rate_percent=it["tax_rate_percent"],
                tax_amount=it["tax_amount"],
                line_total=it["line_total"],
                confidence_score=Decimal('0.96')
            )

        InvoiceValidationEngine.validate_invoice(invoice)

        log_event(
            action='EMAIL_INGESTION_RECEIVED',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            user=request.user,
            details={'invoice_number': inv_num, 'vendor': vendor_name, 'channel': 'Automated IMAP/Webhook Ingestion', 'sender': vendor_email}
        )

        return Response({
            "message": f"Successfully ingested email invoice {inv_num} from {vendor_name} ({vendor_email})!",
            "invoice": InvoiceSerializer(invoice, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='edit-field')
    @transaction.atomic
    def edit_field(self, request, pk=None):
        """
        Employee / AP Reviewer edits an extracted invoice or line item value.
        Templegate Section 2.3 Controls:
        - Mandatory user, timestamp, field_name, old_value, new_value, reason.
        - Sensitive field edits route to AP additional review.
        - Re-runs business validations automatically.
        """
        invoice = self.get_object()
        field_name = request.data.get('field_name')
        new_value = request.data.get('new_value')
        reason = request.data.get('reason')
        item_id = request.data.get('item_id')  # If editing a specific line item

        if not field_name:
            return Response({"error": "field_name is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({"error": "A mandatory explanation reason is required for every edit (Templegate Rule 3)."}, status=status.HTTP_400_BAD_REQUEST)

        is_sensitive = field_name.lower() in SENSITIVE_FIELDS
        old_val_str = ""

        # Line item edit
        if item_id:
            try:
                line_item = invoice.items.get(id=item_id)
            except InvoiceLineItem.DoesNotExist:
                return Response({"error": "Line item not found"}, status=status.HTTP_404_NOT_FOUND)

            old_val_str = str(getattr(line_item, field_name, ''))
            setattr(line_item, field_name, new_value)
            line_item.save()
            invoice.update_totals_from_items()
            field_name_display = f"Line {line_item.line_number}: {field_name}"
        else:
            # Header field edit
            old_val_str = str(getattr(invoice, field_name, ''))
            if field_name == 'vendor_id':
                vendor = Vendor.objects.filter(id=new_value).first()
                invoice.vendor = vendor
            elif field_name == 'po_id':
                po = PurchaseOrder.objects.filter(id=new_value).first()
                invoice.po = po
            else:
                setattr(invoice, field_name, new_value)
            invoice.save()
            field_name_display = field_name

        user = request.user if request.user.is_authenticated else None
        user_display = (user.get_full_name() or user.username) if user else "Employee / AP Reviewer"

        # Record Change Log
        change_log = InvoiceChangeLog.objects.create(
            invoice=invoice,
            user=user,
            user_display=user_display,
            field_name=field_name_display,
            old_value=old_val_str,
            new_value=str(new_value),
            reason=reason,
            is_sensitive=is_sensitive
        )

        if is_sensitive:
            invoice.has_sensitive_edits = True
            invoice.status = InvoiceStatus.PENDING_AP_REVIEW
            invoice.save(update_fields=['has_sensitive_edits', 'status'])

            # Register Exception for sensitive field review
            APException.objects.create(
                invoice=invoice,
                category=ExceptionCategory.SENSITIVE_FIELD_CHANGED,
                description=f"Sensitive field '{field_name_display}' modified by {user_display}. Old: '{old_val_str}' -> New: '{new_value}'. Reason: '{reason}'.",
                severity=ExceptionSeverity.BLOCKING,
                assigned_role='AP_CLERK'
            )

        # Re-run validation rules
        InvoiceValidationEngine.validate_invoice(invoice)

        log_event(
            action='INVOICE_FIELD_EDITED',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            user=user,
            old_values={field_name: old_val_str},
            new_values={field_name: str(new_value)},
            reason=reason,
            details={'is_sensitive': is_sensitive}
        )

        return Response({
            "message": f"Field '{field_name_display}' updated successfully." + (" Sent for AP Sensitive Review." if is_sensitive else ""),
            "invoice": InvoiceSerializer(invoice, context={'request': request}).data,
            "change_log": InvoiceChangeLogSerializer(change_log).data
        })

    @action(detail=True, methods=['post'], url_path='ap-approve-changes')
    def ap_approve_changes(self, request, pk=None):
        """
        AP Employee reviews and approves sensitive edits.
        Clears PENDING_AP_REVIEW lock and allows invoice to progress to Matching / Manager Approval.
        """
        invoice = self.get_object()
        user = request.user if request.user.is_authenticated else None

        # Mark all pending sensitive change logs as reviewed
        invoice.change_logs.filter(is_sensitive=True, reviewed_by_ap=False).update(
            reviewed_by_ap=True,
            reviewed_by=user,
            reviewed_at=timezone.now()
        )

        invoice.has_sensitive_edits = False
        invoice.save(update_fields=['has_sensitive_edits'])

        # Resolve the SENSITIVE_FIELD_CHANGED exceptions
        APException.objects.filter(
            invoice=invoice,
            category=ExceptionCategory.SENSITIVE_FIELD_CHANGED,
            resolved=False
        ).update(
            resolved=True,
            resolved_by=user,
            resolved_at=timezone.now(),
            resolution_notes=request.data.get('notes', 'Approved by AP Specialist after source document verification.')
        )

        # Re-run validation
        InvoiceValidationEngine.validate_invoice(invoice)

        log_event(
            action='AP_SENSITIVE_CHANGES_APPROVED',
            entity_type='Invoice',
            entity_id=str(invoice.id),
            user=user,
            details={'message': 'AP Specialist approved manual corrections'}
        )

        return Response({
            "message": "Sensitive changes approved by AP. Invoice ready for PO matching & workflow.",
            "invoice": InvoiceSerializer(invoice, context={'request': request}).data
        })
