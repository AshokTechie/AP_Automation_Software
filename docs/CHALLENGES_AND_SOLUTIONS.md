# Technical Challenges & Implemented Solutions
**Project:** Accounts Payable (AP) Automation Software with OCR  
**Client / Assessment:** Templegate Technologies & Services Pvt. Ltd.  
**Role:** Software Engineer Submission  
**Stack:** React.js, Django (Django REST Framework), PostgreSQL  

---

## 1. Executive Summary

During the development of this enterprise Accounts Payable Automation application, several technical and business challenges were encountered across document processing, data validation, workflow orchestration, and regulatory compliance. 

In accordance with Templegate's specifications, this document details the **major challenges encountered, our engineering approach, and the production-grade solutions implemented**.

---

## 2. Challenge 1: OCR Table & Line-Item Misalignment Across Heterogeneous Layouts

### The Challenge
Vendor invoices arrive in vastly different formats (scanned PDFs, raster images, varying table headers, wrapped multi-line material descriptions, and multi-page tables). Traditional rule-based character recognition often:
* Misinterprets character shapes (e.g., `INV-108` read as `1NV-108`).
* Assigns quantity values into unit price columns.
* Drops rows that wrap onto subsequent pages.

### Implemented Solution
1. **Hybrid Extraction Architecture (`pdfplumber` + Heuristic Parsing):**
   * For digital PDFs, we utilize `pdfplumber` to extract vector text objects and bounding-box table grids directly, preserving table row/column boundaries with sub-pixel precision.
   * A regex-driven extraction layer locates standard tax headers (`CGST`, `SGST`, `IGST`, `HSN/SAC`).
2. **Confidence Scoring & Flagging Engine:**
   * Every extracted field is assigned a confidence metric ($0.00$ to $1.00$). Any field scoring $<0.90$ is visually highlighted with an amber border.
3. **Interactive Side-by-Side Verification Screen (React.js):**
   * Designed a split-screen view: Original source document preview on the left; editable form fields on the right.
   * Complies with **Templegate Rule 2**: *Never treat OCR output as verified financial data.* Human review is seamlessly incorporated before business validation.

---

## 3. Challenge 2: Distinguishing Legitimate OCR Corrections from Fraudulent Data Manipulation

### The Challenge
Allowing employees or AP staff to edit extracted fields is essential for correcting OCR misreads. However, this creates a severe financial control vulnerability: a user might manipulate financial numbers (e.g., increasing quantity or changing unit rates) without detection.

### Implemented Solution
1. **Immutable Dual Evidence Storage:**
   * **Rule 1:** The original uploaded file is permanently preserved in storage.
   * **Rule 2:** The initial unaltered OCR payload (`ocr_initial_values` & `ocr_raw_payload`) is stored in PostgreSQL and can never be overwritten.
2. **Mandatory Explanation & Audit Trail (`InvoiceChangeLog`):**
   * Every edit requires a user session, timestamp, field name, old value, new value, and a **mandatory explanation reason** (`reason` text field). Edits cannot be submitted without an explanation.
3. **Sensitive Field Detection & AP Review Gate:**
   * Configured a strict sensitive fields list: `['vendor_id', 'invoice_number', 'quantity', 'unit_price', 'tax_amount', 'grand_total', 'po_id']`.
   * Modifying any sensitive field automatically sets `has_sensitive_edits = True`, transitions the invoice status to `PENDING_AP_REVIEW`, and registers a blocking exception `SENSITIVE_FIELD_CHANGED`.
   * The invoice is blocked from proceeding to manager approval until an AP Specialist independently reviews the source document and approves the change.

---

## 4. Challenge 3: Realistic 3-Way Matching with Partial Deliveries & Tolerance Limits

### The Challenge
In industrial procurement, invoices rarely match Purchase Orders on a 1:1 basis:
* Partial deliveries are common (e.g. 100 units ordered, 80 units delivered in GRN #1, 20 units delivered in GRN #2).
* Minor unit price variations occur due to freight, raw material indexing, or rounding differences.
* Suppliers may submit multiple partial invoices against one PO.

### Implemented Solution
1. **Cumulative Quantity Tracking Across Multiple GRNs:**
   * The matching engine queries all `GoodsReceiptNote` records linked to the PO and computes total accepted quantity:
     $$\text{Accepted Quantity} = \sum \text{GRNLineItem.accepted\_quantity}$$
   * The engine validates that:
     $$\text{Invoiced Quantity} \le \text{Accepted Quantity} \le \text{Ordered Quantity}$$
2. **Configurable Price Tolerance Engine:**
   * Implemented a dynamic price tolerance threshold (default $\pm 1.0\%$). If:
     $$\text{Variance \%} = \frac{|\text{Invoice Price} - \text{PO Price}|}{\text{PO Price}} \times 100 \le \text{Tolerance}$$
     The price is accepted as a valid match.
3. **Documented Manager Override:**
   * When a variance exceeds tolerance, the invoice transitions to `MATCH_FAILED` and is routed to the Exception Queue.
   * Authorized managers can execute an override only by providing a documented justification, which is recorded in `MatchingResult` and the system audit log.

---

## 5. Challenge 4: Multi-Tier Duplicate Invoice Prevention

### The Challenge
Duplicate payments are one of the costliest errors in accounts payable. A simplistic duplicate check on `invoice_number` alone fails because:
* Different suppliers frequently use identical numbering schemes (e.g., two different vendors issuing `INV-001`).
* Minor formatting changes (e.g., `INV-001` vs `INV001`) bypass naive exact matches.
* Accidental re-uploads of identical files waste processing time and compute.

### Implemented Solution
Implemented a **3-tier duplicate detection barrier**:
* **Tier 1 (Binary Hash Check):** Generates a cryptographic SHA-256 hash of the uploaded document stream upon upload. Identical file re-uploads are immediately flagged.
* **Tier 2 (Compound Entity Check):** Checks for existence of the same `vendor_id` + normalized `invoice_number`.
* **Tier 3 (Fuzzy Amount & Date Check):** Detects cases where the same vendor submits an invoice with identical grand total within $\pm 3$ days, flagging it as `POSSIBLE_DUPLICATE_INVOICE` for review.

---

## 6. Challenge 5: Excel & CSV Bulk Import Data Integrity (Challenge 2.6)

### The Challenge
Purchasing and warehouse teams upload batch records via Excel and CSV files. Uploaded spreadsheets frequently contain missing header columns, invalid data types (text in numeric quantity fields), unrecognized vendor codes, or duplicate lines within the spreadsheet. Silently importing partial data corrupts the database.

### Implemented Solution
1. **Pre-Import Validation Pipeline (`BulkDataImporter`):**
   * Uses Pandas to parse the file into a structured DataFrame.
   * Validates mandatory columns (`po_number`, `vendor_code`, `ordered_quantity`, etc.). If headers are missing, rejects immediately with column requirements.
2. **Row-Level Error Isolation (`ImportRowError`):**
   * Iterates through every row and records row numbers, affected field names, rejected values, and specific error reasons in PostgreSQL.
3. **Interactive Preview Before Commit:**
   * The user is shown a summary dashboard: `Total Rows`, `Valid Rows`, `Invalid / Rejected Rows`, along with the error log.
   * Committing data is wrapped in an atomic database transaction (`@transaction.atomic`), ensuring that invalid rows do not corrupt existing procurement records.

---

## 7. Challenge 6: Payment Reliability & Statutory Compliance (Rule 11 & Section 43B(h))

### The Challenge
* **Premature Payment Status:** Many systems mistakenly mark an invoice as "Paid" as soon as a user clicks a button. If the bank gateway rejects the payment, the financial ledger is left inaccurate.
* **Indian Statutory Mandates:** Under Section 43B(h) of the Income Tax Act, payments to registered MSME suppliers must be settled within 45 days, otherwise the buyer faces tax deduction disallowances.

### Implemented Solution
1. **Strict Settlement State Machine:**
   $$\text{Not Requested} \longrightarrow \text{Pending Treasury Approval} \longrightarrow \text{Processing with Bank} \longrightarrow \text{Completed (UTR)} \ / \ \text{Failed}$$
   * An invoice is marked `PAID` **only** after receiving reliable core banking confirmation with an official Unique Transaction Reference (UTR).
2. **Automated Payment Advice Generation:**
   * Upon settlement, Django automatically generates a tamper-evident **Payment Advice PDF** using `reportlab`, detailing settled line items, UTR, bank details, and statutory TDS deductions under Section 194Q.
3. **MSME 45-Day Countdown Tracker:**
   * Invoices from registered MSME vendors feature an active aging countdown. Invoices reaching 35+ days trigger an alert banner on the executive dashboard to guarantee statutory compliance.
