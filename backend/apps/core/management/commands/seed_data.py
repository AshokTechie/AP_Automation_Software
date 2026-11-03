import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from apps.core.models import UserProfile, UserRole
from apps.vendors.models import Vendor, VendorBankAccount, VendorStatus
from apps.procurement.models import PurchaseOrder, POLineItem, GoodsReceiptNote, GRNLineItem, POStatus, GRNStatus
from apps.invoices.models import Invoice, InvoiceLineItem, InvoiceStatus, InvoiceChangeLog
from apps.matching.services.matcher import POMatchingEngine
from apps.workflows.models import ApprovalMatrixRule, ApprovalRequest, ApprovalStatus
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentMode
from apps.payments.services.advice_generator import PaymentAdviceGenerator
from apps.exceptions_mgmt.models import APException, ExceptionCategory, ExceptionSeverity


class Command(BaseCommand):
    help = "Seeds database with comprehensive, realistic test cases for AP Automation evaluation."

    def handle(self, *args, **kwargs):
        self.stdout.write("Clearing existing data...")
        # Clear tables cleanly
        PaymentRequest.objects.all().delete()
        ApprovalRequest.objects.all().delete()
        ApprovalMatrixRule.objects.all().delete()
        APException.objects.all().delete()
        InvoiceChangeLog.objects.all().delete()
        InvoiceLineItem.objects.all().delete()
        Invoice.objects.all().delete()
        GRNLineItem.objects.all().delete()
        GoodsReceiptNote.objects.all().delete()
        POLineItem.objects.all().delete()
        PurchaseOrder.objects.all().delete()
        VendorBankAccount.objects.all().delete()
        Vendor.objects.all().delete()

        today = timezone.now().date()

        # 1. Seed Personas / Users
        self.stdout.write("Seeding user personas...")
        users_data = [
            ("admin", "admin@templegate.co.in", "Admin", "User", UserRole.ADMIN, "IT / Management", Decimal('999999999.00')),
            ("ap_clerk", "priya.sharma@templegate.co.in", "Priya", "Sharma", UserRole.AP_CLERK, "Accounts Payable", Decimal('25000.00')),
            ("purchasing", "rahul.verma@templegate.co.in", "Rahul", "Verma", UserRole.PURCHASING, "Procurement", Decimal('100000.00')),
            ("warehouse", "suresh.kumar@templegate.co.in", "Suresh", "Kumar", UserRole.WAREHOUSE, "Logistics & Store", Decimal('50000.00')),
            ("finance_mgr", "ananya.roy@templegate.co.in", "Ananya", "Roy", UserRole.FINANCE_MANAGER, "Finance", Decimal('500000.00')),
            ("cfo", "vikram.malhotra@templegate.co.in", "Vikram", "Malhotra", UserRole.CFO, "Executive Board", Decimal('10000000.00')),
        ]

        created_users = {}
        for username, email, first, last, role, dept, limit in users_data:
            user, created = User.objects.get_or_create(username=username, defaults={'email': email, 'first_name': first, 'last_name': last})
            user.set_password("password123")
            user.save()
            profile = user.profile
            profile.role = role
            profile.department = dept
            profile.approval_limit_inr = limit
            profile.save()
            created_users[username] = user

        # 2. Seed Approval Matrix Rules
        self.stdout.write("Seeding Approval Matrix Rules...")
        r1 = ApprovalMatrixRule.objects.create(
            name="Tier 1: Up to ₹50,000 (Department / Finance Manager)",
            min_amount=Decimal('0.00'),
            max_amount=Decimal('50000.00'),
            required_role=UserRole.FINANCE_MANAGER,
            tier_order=1,
            sla_hours=48
        )
        r2 = ApprovalMatrixRule.objects.create(
            name="Tier 2: ₹50,001 - ₹5,00,000 (Financial Controller)",
            min_amount=Decimal('50000.01'),
            max_amount=Decimal('500000.00'),
            required_role=UserRole.CONTROLLER,
            tier_order=2,
            sla_hours=48
        )
        r3 = ApprovalMatrixRule.objects.create(
            name="Tier 3: Above ₹5,00,000 (Chief Financial Officer)",
            min_amount=Decimal('500000.01'),
            max_amount=Decimal('999999999.00'),
            required_role=UserRole.CFO,
            tier_order=3,
            sla_hours=72
        )

        # 3. Seed Vendors
        self.stdout.write("Seeding Vendors...")
        v1 = Vendor.objects.create(
            vendor_code="VEND-101",
            name="Tata Steel & Metal Works Ltd.",
            trade_name="Tata Steel Industrial",
            gstin="29AAACT2727Q1ZU",
            pan="AAACT2727Q",
            is_msme=False,
            contact_person="Rajesh Gupta",
            email="supplies@tatasteel.com",
            phone="+91 9876543210",
            address_line="Plot 45, Peenya Industrial Area 2nd Stage",
            city="Bengaluru",
            state="Karnataka",
            pincode="560058",
            payment_terms_days=30,
            status=VendorStatus.ACTIVE,
            is_gstin_verified=True
        )
        VendorBankAccount.objects.create(
            vendor=v1,
            account_number="50200012345678",
            account_holder_name="Tata Steel & Metal Works Ltd.",
            ifsc_code="HDFC0000123",
            bank_name="HDFC Bank",
            branch_name="Peenya Branch",
            is_primary=True,
            is_verified=True,
            verified_at=timezone.now(),
            verification_reference="PENNY-HDFC-9912"
        )

        v2 = Vendor.objects.create(
            vendor_code="VEND-102",
            name="Apex Precision Fasteners & Tools",
            trade_name="Apex Fasteners",
            gstin="29AABCA1234B1Z5",
            pan="AABCA1234B",
            is_msme=True,  # MSME registered! Section 43B(h) compliance applies
            msme_reg_number="UDYAM-KR-03-0012948",
            contact_person="Mahesh Bhat",
            email="sales@apexfasteners.in",
            phone="+91 9845012345",
            address_line="22/4, Bommasandra Industrial Area",
            city="Bengaluru",
            state="Karnataka",
            pincode="560099",
            payment_terms_days=45,
            status=VendorStatus.ACTIVE,
            is_gstin_verified=True
        )
        VendorBankAccount.objects.create(
            vendor=v2,
            account_number="000205001234",
            account_holder_name="Apex Precision Fasteners",
            ifsc_code="ICIC0000002",
            bank_name="ICICI Bank",
            branch_name="Koramangala Branch",
            is_primary=True,
            is_verified=True,
            verified_at=timezone.now(),
            verification_reference="PENNY-ICIC-8821"
        )

        v3 = Vendor.objects.create(
            vendor_code="VEND-103",
            name="Delta Logistics & Heavy Haulage",
            trade_name="Delta Cargo",
            gstin="29AACCD9876E1Z2",
            pan="AACCD9876E",
            is_msme=False,
            contact_person="Ramesh Patel",
            email="billing@deltalogistics.com",
            phone="+91 9900112233",
            address_line="Ring Road Goods Terminal",
            city="Bengaluru",
            state="Karnataka",
            pincode="560022",
            payment_terms_days=30,
            status=VendorStatus.BLOCKED,  # BLOCKED vendor for testing
            is_gstin_verified=False
        )

        # 4. Seed Purchase Orders & Line Items
        self.stdout.write("Seeding Purchase Orders...")
        po1 = PurchaseOrder.objects.create(
            po_number="PO-2026-001",
            vendor=v1,
            issue_date=today - timedelta(days=20),
            expected_delivery_date=today - timedelta(days=10),
            status=POStatus.PARTIALLY_RECEIVED,
            created_by=created_users["purchasing"],
            notes="Annual furniture & fabrication materials"
        )
        po1_item1 = POLineItem.objects.create(
            po=po1,
            line_number=1,
            material_code="MAT-CHAIR-101",
            description="High-Back Ergonomic Office Chairs",
            hsn_sac_code="9401",
            ordered_quantity=Decimal('100.000'),
            unit_price=Decimal('500.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00')
        )
        po1_item2 = POLineItem.objects.create(
            po=po1,
            line_number=2,
            material_code="MAT-DESK-202",
            description="Modular Workstation Desks 4x2 ft",
            hsn_sac_code="9403",
            ordered_quantity=Decimal('20.000'),
            unit_price=Decimal('2500.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00')
        )
        po1.update_totals()

        po2 = PurchaseOrder.objects.create(
            po_number="PO-2026-002",
            vendor=v2,
            issue_date=today - timedelta(days=15),
            expected_delivery_date=today - timedelta(days=5),
            status=POStatus.FULLY_RECEIVED,
            created_by=created_users["purchasing"],
            notes="MSME Fasteners order"
        )
        po2_item1 = POLineItem.objects.create(
            po=po2,
            line_number=1,
            material_code="FST-BOLT-M8",
            description="Grade 8.8 Hex Bolts M8 x 50mm",
            hsn_sac_code="7318",
            ordered_quantity=Decimal('1000.000'),
            unit_price=Decimal('25.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00')
        )
        po2.update_totals()

        # 5. Seed Goods Receipt Notes (GRN)
        self.stdout.write("Seeding Goods Receipt Notes (GRN)...")
        # GRN 1: Partial delivery for PO1 (80 chairs received out of 100)
        grn1 = GoodsReceiptNote.objects.create(
            grn_number="GRN-2026-101",
            po=po1,
            receipt_date=today - timedelta(days=8),
            delivery_note_number="DC-TATA-8841",
            warehouse_location="Peenya Central Store",
            received_by=created_users["warehouse"],
            status=GRNStatus.INSPECTED_ACCEPTED,
            remarks="Partial delivery of 80 chairs. Desks yet to arrive."
        )
        GRNLineItem.objects.create(
            grn=grn1,
            po_item=po1_item1,
            material_code=po1_item1.material_code,
            description=po1_item1.description,
            received_quantity=Decimal('80.000'),
            accepted_quantity=Decimal('80.000'),
            rejected_quantity=Decimal('0.000'),
            uom="NOS"
        )

        # GRN 2: Full delivery for PO2
        grn2 = GoodsReceiptNote.objects.create(
            grn_number="GRN-2026-102",
            po=po2,
            receipt_date=today - timedelta(days=4),
            delivery_note_number="DC-APEX-4412",
            warehouse_location="Electronics City Warehouse",
            received_by=created_users["warehouse"],
            status=GRNStatus.INSPECTED_ACCEPTED,
            remarks="All 1000 bolts received and tested for tensile strength."
        )
        GRNLineItem.objects.create(
            grn=grn2,
            po_item=po2_item1,
            material_code=po2_item1.material_code,
            description=po2_item1.description,
            received_quantity=Decimal('1000.000'),
            accepted_quantity=Decimal('1000.000'),
            rejected_quantity=Decimal('0.000'),
            uom="NOS"
        )

        # 6. Seed Realistic Invoices covering each business scenario
        self.stdout.write("Seeding Invoices with realistic test cases...")

        # Test Case 1: Clean 3-Way Match (Passed & Approved)
        inv1 = Invoice.objects.create(
            invoice_number="INV-2026-APEX-01",
            vendor=v2,
            po=po2,
            invoice_date=today - timedelta(days=3),
            due_date=today + timedelta(days=42),
            file_hash_sha256=uuid.uuid4().hex,
            ocr_confidence_score=Decimal('0.96'),
            status=InvoiceStatus.APPROVED,
            match_type='THREE_WAY',
            uploaded_by=created_users["ap_clerk"]
        )
        InvoiceLineItem.objects.create(
            invoice=inv1,
            line_number=1,
            material_code="FST-BOLT-M8",
            description="Grade 8.8 Hex Bolts M8 x 50mm",
            quantity=Decimal('1000.000'),
            unit_price=Decimal('25.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00'),
            tax_amount=Decimal('4500.00'),
            line_total=Decimal('25000.00'),
            confidence_score=Decimal('0.98')
        )
        inv1.update_totals_from_items()
        POMatchingEngine.evaluate_invoice_match(inv1)
        # Seed pending approval for Test Case 1 (Ready for reviewer to approve)
        ApprovalRequest.objects.create(
            invoice=inv1,
            rule=r1,
            assigned_role=UserRole.FINANCE_MANAGER,
            status=ApprovalStatus.PENDING,
            escalation_deadline=timezone.now() + timedelta(hours=48),
            comments=""
        )

        # Test Case 2: Quantity Discrepancy (Billed 100 chairs, but GRN only received 80)
        inv2 = Invoice.objects.create(
            invoice_number="INV-2026-TATA-99",
            vendor=v1,
            po=po1,
            invoice_date=today - timedelta(days=5),
            due_date=today + timedelta(days=25),
            file_hash_sha256=uuid.uuid4().hex,
            ocr_confidence_score=Decimal('0.92'),
            status=InvoiceStatus.MATCH_FAILED,
            match_type='THREE_WAY',
            uploaded_by=created_users["ap_clerk"]
        )
        InvoiceLineItem.objects.create(
            invoice=inv2,
            line_number=1,
            material_code="MAT-CHAIR-101",
            description="High-Back Ergonomic Office Chairs",
            quantity=Decimal('100.000'),  # Billed for 100, but only 80 received!
            unit_price=Decimal('500.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00'),
            tax_amount=Decimal('9000.00'),
            line_total=Decimal('50000.00'),
            confidence_score=Decimal('0.94')
        )
        inv2.update_totals_from_items()
        POMatchingEngine.evaluate_invoice_match(inv2)

        # Test Case 3: Sensitive Field Edit (Quantity manually changed from 100 to 150)
        inv3 = Invoice.objects.create(
            invoice_number="INV-2026-TATA-88",
            vendor=v1,
            po=po1,
            invoice_date=today - timedelta(days=2),
            due_date=today + timedelta(days=28),
            file_hash_sha256=uuid.uuid4().hex,
            ocr_confidence_score=Decimal('0.89'),
            status=InvoiceStatus.PENDING_AP_REVIEW,
            match_type='THREE_WAY',
            has_sensitive_edits=True,
            uploaded_by=created_users["ap_clerk"]
        )
        InvoiceLineItem.objects.create(
            invoice=inv3,
            line_number=1,
            material_code="MAT-CHAIR-101",
            description="High-Back Ergonomic Office Chairs",
            quantity=Decimal('150.000'),
            unit_price=Decimal('500.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00'),
            tax_amount=Decimal('13500.00'),
            line_total=Decimal('75000.00'),
            confidence_score=Decimal('0.85')
        )
        inv3.update_totals_from_items()
        InvoiceChangeLog.objects.create(
            invoice=inv3,
            user=created_users["ap_clerk"],
            user_display="Priya Sharma (AP Specialist)",
            field_name="Line 1: quantity",
            old_value="100.000",
            new_value="150.000",
            reason="Corrected line item quantity to reflect revised vendor invoice packing list.",
            is_sensitive=True,
            reviewed_by_ap=False
        )
        APException.objects.create(
            invoice=inv3,
            category=ExceptionCategory.SENSITIVE_FIELD_CHANGED,
            description="Sensitive field 'Line 1: quantity' was modified from 100 to 150. Mandatory AP review required.",
            severity=ExceptionSeverity.BLOCKING,
            assigned_role='AP_CLERK'
        )

        # Test Case 4: Settled / Paid Invoice with UTR & Payment Advice PDF
        inv4 = Invoice.objects.create(
            invoice_number="INV-2026-PAID-01",
            vendor=v1,
            po=po1,
            invoice_date=today - timedelta(days=25),
            due_date=today + timedelta(days=5),
            file_hash_sha256=uuid.uuid4().hex,
            ocr_confidence_score=Decimal('0.97'),
            status=InvoiceStatus.PAID,
            match_type='THREE_WAY',
            uploaded_by=created_users["ap_clerk"]
        )
        InvoiceLineItem.objects.create(
            invoice=inv4,
            line_number=1,
            material_code="MAT-DESK-202",
            description="Modular Workstation Desks 4x2 ft",
            quantity=Decimal('10.000'),
            unit_price=Decimal('2500.00'),
            uom="NOS",
            tax_rate_percent=Decimal('18.00'),
            tax_amount=Decimal('4500.00'),
            line_total=Decimal('25000.00'),
            confidence_score=Decimal('0.99')
        )
        inv4.update_totals_from_items()
        
        # Create completed payment record with UTR
        p4 = PaymentRequest.objects.create(
            invoice=inv4,
            vendor=v1,
            bank_account=v1.bank_accounts.first(),
            gross_amount=inv4.grand_total,
            tds_rate_percent=Decimal('0.10'),
            tds_amount=Decimal('29.50'),
            net_payable_amount=Decimal('29470.50'),
            payment_mode=PaymentMode.NEFT,
            status=PaymentStatus.COMPLETED,
            utr_number="RBI20261025HDFC99812",
            bank_reference="TXN-HDFC-881923",
            bank_response_code="00_SUCCESS",
            bank_response_message="NEFT Funds Transfer Successful",
            requested_by=created_users["finance_mgr"],
            completed_at=timezone.now() - timedelta(days=2)
        )
        PaymentAdviceGenerator.generate_pdf(p4)

        self.stdout.write(self.style.SUCCESS("Database seeded successfully with all roles, vendors, POs, GRNs, invoices, and test cases!"))
