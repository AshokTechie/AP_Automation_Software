import os
from decimal import Decimal
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


class PaymentAdviceGenerator:
    """
    Generates professional Payment Advice PDF vouchers using ReportLab.
    Itemizes settled invoices, statutory TDS deductions, bank UTR, and accounts.
    """

    @classmethod
    def generate_pdf(cls, payment_request):
        output_dir = os.path.join(settings.MEDIA_ROOT, 'payment_advices')
        os.makedirs(output_dir, exist_ok=True)
        filename = f"PaymentAdvice_{payment_request.invoice.invoice_number}_{payment_request.id.hex[:6].upper()}.pdf"
        file_path = os.path.join(output_dir, filename)

        doc = SimpleDocTemplate(
            file_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=6
        )

        subtitle_style = ParagraphStyle(
            'SubTitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#64748b'),
            spaceAfter=15
        )

        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor('#1e293b')
        )

        # 1. Header
        elements.append(Paragraph("TEMPLEGATE AP AUTOMATION SYSTEM", title_style))
        elements.append(Paragraph("OFFICIAL PAYMENT ADVICE / REMITTANCE VOUCHER", subtitle_style))
        elements.append(Spacer(1, 10))

        # 2. Metadata Grid
        v = payment_request.vendor
        bank = payment_request.bank_account

        meta_data = [
            [
                Paragraph("<b>Payment Ref / Advice No:</b>", body_style),
                Paragraph(f"ADV-{payment_request.id.hex[:8].upper()}", body_style),
                Paragraph("<b>Payment Date:</b>", body_style),
                Paragraph(payment_request.completed_at.strftime('%Y-%m-%d') if payment_request.completed_at else "Processing", body_style),
            ],
            [
                Paragraph("<b>Bank UTR Number:</b>", body_style),
                Paragraph(f"<b>{payment_request.utr_number or 'PENDING'}</b>", body_style),
                Paragraph("<b>Payment Mode:</b>", body_style),
                Paragraph(payment_request.get_payment_mode_display(), body_style),
            ],
            [
                Paragraph("<b>Beneficiary Name:</b>", body_style),
                Paragraph(v.name, body_style),
                Paragraph("<b>Beneficiary GSTIN:</b>", body_style),
                Paragraph(v.gstin, body_style),
            ],
            [
                Paragraph("<b>Bank Name:</b>", body_style),
                Paragraph(bank.bank_name, body_style),
                Paragraph("<b>Beneficiary Account:</b>", body_style),
                Paragraph(bank.masked_account_number, body_style),
            ],
            [
                Paragraph("<b>Bank IFSC:</b>", body_style),
                Paragraph(bank.ifsc_code, body_style),
                Paragraph("<b>Settlement Status:</b>", body_style),
                Paragraph(f"<b>{payment_request.get_status_display()}</b>", body_style),
            ]
        ]

        meta_table = Table(meta_data, colWidths=[130, 140, 130, 140])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 15))

        # 3. Itemized Invoice Settlement Table
        inv = payment_request.invoice
        settlement_data = [
            ["Invoice #", "Invoice Date", "PO Reference", "Gross Amount", "TDS Deducted", "Net Paid (INR)"],
            [
                inv.invoice_number,
                str(inv.invoice_date or '-'),
                inv.po.po_number if inv.po else "Non-PO",
                f"INR {payment_request.gross_amount:,.2f}",
                f"INR {payment_request.tds_amount:,.2f} ({payment_request.tds_rate_percent}%)",
                f"INR {payment_request.net_payable_amount:,.2f}"
            ]
        ]

        settlement_table = Table(settlement_data, colWidths=[100, 80, 90, 90, 90, 90])
        settlement_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(settlement_table)
        elements.append(Spacer(1, 20))

        # 4. Certification & Audit Note
        cert_text = (
            "This is a computer-generated remittance advice confirmed via core banking gateway. "
            "Statutory TDS has been credited to the Income Tax Department on behalf of the PAN registered with GSTIN. "
            "For reconciliation queries, contact accounts-payable@templegate.co.in."
        )
        elements.append(Paragraph(cert_text, subtitle_style))

        doc.build(elements)
        relative_path = os.path.join('payment_advices', filename)
        payment_request.advice_pdf = relative_path
        payment_request.save(update_fields=['advice_pdf'])
        return relative_path
