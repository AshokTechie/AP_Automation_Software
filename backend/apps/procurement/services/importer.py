import os
import pandas as pd
from decimal import Decimal
from django.utils.dateparse import parse_date
from django.db import transaction
from apps.procurement.models import (
    PurchaseOrder, POLineItem, GoodsReceiptNote, GRNLineItem,
    ImportBatch, ImportRowError, POStatus, GRNStatus
)
from apps.vendors.models import Vendor
from apps.core.audit import log_event


class BulkDataImporter:
    """
    Production-grade Excel & CSV importer for Purchasing and Warehouse teams.
    Handles:
    - Pre-validation of required columns
    - Row-level format & master-data verification
    - Preview generation before commit
    - Atomic database transaction commit
    """

    PO_REQUIRED_COLUMNS = ['po_number', 'vendor_code', 'issue_date', 'material_code', 'description', 'ordered_quantity', 'unit_price']
    GRN_REQUIRED_COLUMNS = ['grn_number', 'po_number', 'receipt_date', 'material_code', 'accepted_quantity']

    @classmethod
    def read_file_dataframe(cls, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path, dtype=str)
        elif ext == '.csv':
            return pd.read_csv(file_path, dtype=str)
        else:
            raise ValueError(f"Unsupported import file extension: {ext}. Only .xlsx, .xls, and .csv are supported.")

    @classmethod
    def validate_po_batch(cls, batch):
        df = cls.read_file_dataframe(batch.uploaded_file.path)
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

        missing_cols = [c for c in cls.PO_REQUIRED_COLUMNS if c not in df.columns]
        if missing_cols:
            ImportRowError.objects.create(
                batch=batch,
                row_number=1,
                field_name="Header",
                error_message=f"Missing mandatory columns: {', '.join(missing_cols)}"
            )
            batch.status = 'REJECTED'
            batch.save()
            return

        total_rows = len(df)
        valid_count = 0
        preview_rows = []
        seen_po_lines = set()

        for idx, row in df.iterrows():
            row_num = idx + 2
            errors = []

            po_number = str(row.get('po_number', '')).strip()
            vendor_code = str(row.get('vendor_code', '')).strip()
            issue_date_raw = str(row.get('issue_date', '')).strip()
            material_code = str(row.get('material_code', '')).strip()
            desc = str(row.get('description', '')).strip()
            qty_raw = str(row.get('ordered_quantity', '')).strip()
            price_raw = str(row.get('unit_price', '')).strip()
            uom = str(row.get('uom', 'NOS')).strip() or 'NOS'

            if not po_number:
                errors.append(("po_number", "PO Number cannot be empty"))
            if not vendor_code:
                errors.append(("vendor_code", "Vendor code cannot be empty"))
            elif not Vendor.objects.filter(vendor_code__iexact=vendor_code).exists():
                errors.append(("vendor_code", f"Vendor with code '{vendor_code}' does not exist in Vendor Master"))

            line_key = (po_number, material_code)
            if line_key in seen_po_lines:
                errors.append(("material_code", f"Duplicate PO item: {material_code} appears twice for PO {po_number}"))
            else:
                seen_po_lines.add(line_key)

            parsed_date = parse_date(issue_date_raw)
            if not parsed_date:
                try:
                    parsed_date = pd.to_datetime(issue_date_raw).date()
                except Exception:
                    errors.append(("issue_date", f"Invalid date format '{issue_date_raw}'. Expected YYYY-MM-DD or standard date"))

            try:
                qty = Decimal(qty_raw)
                if qty <= 0:
                    errors.append(("ordered_quantity", "Quantity must be greater than zero"))
            except Exception:
                errors.append(("ordered_quantity", f"Quantity '{qty_raw}' is not a valid number"))

            try:
                price = Decimal(price_raw)
                if price <= 0:
                    errors.append(("unit_price", "Unit price must be greater than zero"))
            except Exception:
                errors.append(("unit_price", f"Unit price '{price_raw}' is not a valid number"))

            if errors:
                for field, msg in errors:
                    ImportRowError.objects.create(
                        batch=batch,
                        row_number=row_num,
                        field_name=field,
                        rejected_value=str(row.get(field, '')),
                        error_message=msg
                    )
            else:
                valid_count += 1

            preview_rows.append({
                "row": row_num,
                "po_number": po_number,
                "vendor_code": vendor_code,
                "material_code": material_code,
                "description": desc,
                "quantity": qty_raw,
                "unit_price": price_raw,
                "is_valid": len(errors) == 0,
                "errors": [e[1] for e in errors]
            })

        batch.total_rows = total_rows
        batch.valid_rows = valid_count
        batch.invalid_rows = total_rows - valid_count
        batch.preview_data = preview_rows[:100]
        batch.status = 'PREVIEW'
        batch.save()

    @classmethod
    @transaction.atomic
    def commit_po_batch(cls, batch, user=None):
        if batch.status == 'COMMITTED':
            return False, "Batch has already been committed."

        df = cls.read_file_dataframe(batch.uploaded_file.path)
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

        created_pos = {}

        for idx, row in df.iterrows():
            row_num = idx + 2
            if batch.row_errors.filter(row_number=row_num).exists():
                continue

            po_number = str(row['po_number']).strip()
            vendor_code = str(row['vendor_code']).strip()
            issue_date = pd.to_datetime(str(row['issue_date'])).date()
            material_code = str(row['material_code']).strip()
            desc = str(row['description']).strip()
            qty = Decimal(str(row['ordered_quantity']).strip())
            price = Decimal(str(row['unit_price']).strip())
            uom = str(row.get('uom', 'NOS')).strip() or 'NOS'

            vendor = Vendor.objects.get(vendor_code__iexact=vendor_code)

            if po_number not in created_pos:
                po, _ = PurchaseOrder.objects.get_or_create(
                    po_number=po_number,
                    defaults={
                        'vendor': vendor,
                        'issue_date': issue_date,
                        'status': POStatus.OPEN,
                        'created_by': user
                    }
                )
                created_pos[po_number] = po
            else:
                po = created_pos[po_number]

            next_line_num = po.items.count() + 1
            POLineItem.objects.create(
                po=po,
                line_number=next_line_num,
                material_code=material_code,
                description=desc,
                ordered_quantity=qty,
                unit_price=price,
                uom=uom
            )

        for po in created_pos.values():
            po.update_totals()

        batch.status = 'COMMITTED'
        batch.save()

        log_event(
            action='PO_BATCH_COMMITTED',
            entity_type='ImportBatch',
            entity_id=str(batch.id),
            user=user,
            details={'created_po_count': len(created_pos), 'file_name': batch.file_name}
        )

        return True, f"Successfully committed {len(created_pos)} Purchase Orders with {batch.valid_rows} line items."

    @classmethod
    def validate_grn_batch(cls, batch):
        df = cls.read_file_dataframe(batch.uploaded_file.path)
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

        missing_cols = [c for c in cls.GRN_REQUIRED_COLUMNS if c not in df.columns]
        if missing_cols:
            ImportRowError.objects.create(
                batch=batch,
                row_number=1,
                field_name="Header",
                error_message=f"Missing mandatory GRN columns: {', '.join(missing_cols)}"
            )
            batch.status = 'REJECTED'
            batch.save()
            return

        total_rows = len(df)
        valid_count = 0
        preview_rows = []

        for idx, row in df.iterrows():
            row_num = idx + 2
            errors = []

            grn_number = str(row.get('grn_number', '')).strip()
            po_number = str(row.get('po_number', '')).strip()
            receipt_date_raw = str(row.get('receipt_date', '')).strip()
            material_code = str(row.get('material_code', '')).strip()
            qty_raw = str(row.get('accepted_quantity', '')).strip()

            if not grn_number:
                errors.append(("grn_number", "GRN Number cannot be empty"))
            
            po = PurchaseOrder.objects.filter(po_number__iexact=po_number).first()
            if not po:
                errors.append(("po_number", f"Purchase Order '{po_number}' does not exist"))
            else:
                po_item = po.items.filter(material_code__iexact=material_code).first()
                if not po_item:
                    errors.append(("material_code", f"Material '{material_code}' does not belong to PO {po_number}"))

            try:
                parsed_date = pd.to_datetime(receipt_date_raw).date()
            except Exception:
                errors.append(("receipt_date", f"Invalid receipt date '{receipt_date_raw}'"))

            try:
                qty = Decimal(qty_raw)
                if qty <= 0:
                    errors.append(("accepted_quantity", "Accepted quantity must be > 0"))
            except Exception:
                errors.append(("accepted_quantity", f"Quantity '{qty_raw}' is not a valid number"))

            if errors:
                for field, msg in errors:
                    ImportRowError.objects.create(
                        batch=batch,
                        row_number=row_num,
                        field_name=field,
                        rejected_value=str(row.get(field, '')),
                        error_message=msg
                    )
            else:
                valid_count += 1

            preview_rows.append({
                "row": row_num,
                "grn_number": grn_number,
                "po_number": po_number,
                "material_code": material_code,
                "accepted_quantity": qty_raw,
                "is_valid": len(errors) == 0,
                "errors": [e[1] for e in errors]
            })

        batch.total_rows = total_rows
        batch.valid_rows = valid_count
        batch.invalid_rows = total_rows - valid_count
        batch.preview_data = preview_rows[:100]
        batch.status = 'PREVIEW'
        batch.save()

    @classmethod
    @transaction.atomic
    def commit_grn_batch(cls, batch, user=None):
        if batch.status == 'COMMITTED':
            return False, "Batch already committed."

        df = cls.read_file_dataframe(batch.uploaded_file.path)
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

        created_grns = {}

        for idx, row in df.iterrows():
            row_num = idx + 2
            if batch.row_errors.filter(row_number=row_num).exists():
                continue

            grn_number = str(row['grn_number']).strip()
            po_number = str(row['po_number']).strip()
            receipt_date = pd.to_datetime(str(row['receipt_date'])).date()
            material_code = str(row['material_code']).strip()
            qty = Decimal(str(row['accepted_quantity']).strip())

            po = PurchaseOrder.objects.get(po_number__iexact=po_number)
            po_item = po.items.get(material_code__iexact=material_code)

            if grn_number not in created_grns:
                grn, _ = GoodsReceiptNote.objects.get_or_create(
                    grn_number=grn_number,
                    defaults={
                        'po': po,
                        'receipt_date': receipt_date,
                        'status': GRNStatus.INSPECTED_ACCEPTED,
                        'received_by': user
                    }
                )
                created_grns[grn_number] = grn
            else:
                grn = created_grns[grn_number]

            GRNLineItem.objects.create(
                grn=grn,
                po_item=po_item,
                material_code=material_code,
                description=po_item.description,
                received_quantity=qty,
                accepted_quantity=qty,
                uom=po_item.uom
            )

        batch.status = 'COMMITTED'
        batch.save()

        log_event(
            action='GRN_BATCH_COMMITTED',
            entity_type='ImportBatch',
            entity_id=str(batch.id),
            user=user,
            details={'created_grn_count': len(created_grns), 'file_name': batch.file_name}
        )

        return True, f"Successfully committed {len(created_grns)} GRNs."
