# Accounts Payable (AP) Automation Software with OCR
## The Complete Master Guide & Technical Handbook (Kannada & English)

**Project for:** Templegate Technologies & Services Pvt. Ltd.  
**Tech Stack:** React.js (Frontend) + Django / DRF (Backend) + PostgreSQL (Database)  
**Project Path:** `C:\Users\thero\.gemini\antigravity\scratch\ap-automation-system`  

---

## 📑 TABLE OF CONTENTS
1. [The Big Picture (Bird's Eye View)](#1-the-big-picture)
2. [Database Architecture & Integration (DB yav tara connect aagide?)](#2-database-architecture--integration)
3. [The 9 Core Modules Breakdown](#3-the-9-core-modules-breakdown)
4. [The 16 Standardized Exception Categories](#4-the-16-standardized-exception-categories)
5. [The Critical Security Controls (Rule 2.3 Sensitive Edits)](#5-the-critical-security-controls)
6. [2-Way vs 3-Way PO Matching Deep Dive](#6-2-way-vs-3-way-po-matching-deep-dive)
7. [Payment State Machine & ReportLab PDF Advice](#7-payment-state-machine--reportlab-pdf-advice)
8. [Complete API Catalog](#8-complete-api-catalog)
9. [How to Run the Application (Step-by-Step)](#9-how-to-run-the-application)
10. [Top 10 Technical Interview Questions & Answers](#10-top-10-technical-interview-questions--answers)

---

## 1. THE BIG PICTURE

Our system is structured into 3 distinct, decoupled layers:

```
+-----------------------------------------------------------------------+
|                       FRONTEND: React.js (Port 5173)                   |
|  - Dropzone File Ingestion (PDF, JPG, PNG, TIFF)                      |
|  - Side-by-Side OCR Verification Viewer with Bounding Box Overlay     |
|  - 3-Way PO & GRN Match Variance Matrix                               |
|  - Central 16-Category Exception Queue                                |
|  - Multi-Tier Approval Inbox & Persona Switcher                       |
+-----------------------------------------------------------------------+
                                   ▲
                                   │  HTTP / JSON REST APIs (Axios)
                                   ▼
+-----------------------------------------------------------------------+
|                BACKEND: Django 5 + Django REST Framework (Port 8000)   |
|  - apps/core: RBAC, User Profiles, Central Immutable Audit Logs       |
|  - apps/vendors: Vendor Master, GSTIN Checksum, Bank Masking & Penny  |
|  - apps/procurement: PO, GRN, Line Items, Excel/CSV Importer Engine   |
|  - apps/invoices: OCR Engine (pdfplumber), Line Items, Change Logs   |
|  - apps/matching: 2-Way & 3-Way Matcher with Tolerances               |
|  - apps/exceptions_mgmt: 16 Standardized Exception Gateways           |
|  - apps/workflows: Dynamic Tier Rules (<50k, 50k-5L, >5L), SLA Timers|
|  - apps/payments: Settlement Gateway, RBI UTR, ReportLab PDF Advice   |
|  - apps/analytics: Aging Brackets, Turnaround TAT, MSME 45-Day Alert  |
+-----------------------------------------------------------------------+
                                   ▲
                                   │  psycopg2 / Django ORM (SQL)
                                   ▼
+-----------------------------------------------------------------------+
|                    DATABASE: PostgreSQL 16 (Port 5432)                |
|  - 14 Normalized Relational Tables                                    |
|  - Fixed-Precision Numeric(14, 2) Decimals (No floating-point math)   |
|  - JSONB for Semi-Structured OCR Payloads & Line Variance Grids       |
|  - Foreign Keys, Cascade Protections, Unique Indexes                  |
+-----------------------------------------------------------------------+
```

---

## 2. DATABASE ARCHITECTURE & INTEGRATION

### How does Django connect to the Database?
Instead of writing raw SQL scripts manually, Django uses an **ORM (Object-Relational Mapping)**.

1. **`settings.py` Configuration:**
   We configure the database parameters in `backend/ap_project/settings.py`:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': 'ap_automation_db',
           'USER': 'postgres',
           'PASSWORD': 'password',
           'HOST': 'localhost',
           'PORT': '5432',
       }
   }
   ```
2. **Models $\rightarrow$ Tables:**
   Each class in `models.py` represents a database table.
3. **`makemigrations`:**
   Django scans your Python classes and writes migration blueprints in `apps/<name>/migrations/0001_initial.py`.
4. **`migrate`:**
   Django executes the SQL statements in PostgreSQL to create the actual physical tables, indexes, and constraints.

### Why Numeric(14, 2) DecimalField instead of FloatField?
* **Interview Alert:** In financial ledgers, floating-point numbers cause binary representation rounding errors (`0.1 + 0.2 = 0.30000000000000004`).
* `DecimalField(max_digits=14, decimal_places=2)` stores exact fixed-point decimal values so that not even a single paise is miscalculated.

---

## 3. THE 9 CORE MODULES BREAKDOWN

### Module 1: Invoice Capture Module
* **Location:** `backend/apps/invoices/views.py` & `frontend/src/pages/InvoiceCapture.jsx`
* **Features:**
  * Multi-format support: PDF, JPG, PNG, TIFF.
  * Drag & Drop zone with client-side & server-side format validation.
  * Bulk upload queue with per-file progress and outcome isolation.
  * SHA-256 cryptographic file hashing to immediately catch identical re-uploads.
  * Automated Email Ingestion simulation button (`invoices@company.com`).

### Module 2: OCR & AI Extraction Module
* **Location:** `backend/apps/invoices/services/ocr_engine.py` & `frontend/src/pages/OCRReview.jsx`
* **Features:**
  * Uses `pdfplumber` to extract vector coordinates, text, and tables.
  * Regex extraction for Invoice Number, GSTIN, Dates, and PO References.
  * Confidence score calculated for each field ($0.00$ to $1.00$). Fields with $<0.90$ are flagged with an amber border.
  * Split-screen UI: Source PDF preview on the left; editable form fields on the right.

### Module 3: Invoice Validation Engine
* **Location:** `backend/apps/invoices/services/validator.py`
* **Features:**
  * Gate 1: Mandatory Fields (Invoice # and Date presence).
  * Gate 2: Vendor Master status (checks if active vs blocked).
  * Gate 3: Duplicate detection (Vendor ID + Invoice #).
  * Gate 4: Mathematical coherence:
    $$\sum (\text{Line Items}) + \text{Taxes} == \text{Invoice Grand Total} \ (\pm ₹0.50 \text{ tolerance})$$

### Module 4: PO Matching Module (2-Way & 3-Way)
* **Location:** `backend/apps/matching/services/matcher.py` & `frontend/src/pages/MatchingInspection.jsx`
* **Features:**
  * 2-Way Match: PO vs Invoice (for services/repairs).
  * 3-Way Match: PO vs GRN vs Invoice (for physical materials).
  * Configurable price variance tolerance (default $\pm 1.0\%$).
  * Supports multiple GRNs per PO and partial deliveries.
  * Documented Manager Override for acceptable discrepancies.

### Module 5: Workflow & Approval Engine
* **Location:** `backend/apps/workflows/services/engine.py` & `frontend/src/pages/ApprovalInbox.jsx`
* **Features:**
  * Configurable approval matrix:
    * Tier 1 ($\le ₹50,000$): Finance Manager
    * Tier 2 ($₹50,001 - ₹5,00,000$): Financial Controller
    * Tier 3 ($> ₹5,00,000$): Chief Financial Officer (CFO)
  * Separation of Duties: Uploader cannot approve their own invoice.
  * Mandatory rejection explanation comment.
  * SLA escalation timers.

### Module 6: Vendor Management Module
* **Location:** `backend/apps/vendors/models.py` & `frontend/src/pages/VendorManagement.jsx`
* **Features:**
  * Vendor profile CRUD with Indian GSTIN regex validation (`[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`).
  * Bank account masking (`XXXXXX1234`) for data privacy.
  * Simulated Penny-Drop bank verification.
  * MSME Section 43B(h) compliance flag.

### Module 7: Payment Processing Module
* **Location:** `backend/apps/payments/views.py` & `apps/payments/services/advice_generator.py`
* **Features:**
  * Templegate Rule 11: Invoices are never marked "PAID" without bank UTR confirmation.
  * Section 194Q TDS deduction ($0.10\%$).
  * State Machine: `Pending Approval` $\rightarrow$ `Processing` $\rightarrow$ `Completed (UTR)` / `Failed`.
  * Automated ReportLab PDF Payment Advice generation.

### Module 8: Executive Dashboard
* **Location:** `backend/apps/analytics/services/kpi_engine.py` & `frontend/src/pages/Dashboard.jsx`
* **Features:**
  * AP Aging buckets: 0-30, 31-60, 61-90, 90+ days.
  * Turnaround Time (TAT) in days.
  * OCR Accuracy percentage & STP (Straight-Through Processing) rate.
  * Statutory MSME 45-day overdue warning countdown banner.
  * Top suppliers spend concentration table.

### Module 9: Reports & Central Audit Trail
* **Location:** `frontend/src/pages/Reports.jsx`
* **Features:**
  * AP Aging schedule.
  * Indian GST tax reconciliation report (for GSTR-2B matching).
  * Central immutable audit trail (`AuditLog`) tracking user, action, timestamp, old value, new value, and reason.

---

## 4. THE 16 STANDARDIZED EXCEPTION CATEGORIES

Defined in `backend/apps/exceptions_mgmt/models.py`:

| # | Exception Category | Real-Life Trigger | Severity | Assigned Role |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `UPLOAD_ERROR` | Unsupported file format or corrupted file upload | BLOCKING | AP_CLERK |
| 2 | `OCR_REVIEW_REQUIRED` | Extraction confidence score $< 90\%$ | BLOCKING | AP_CLERK |
| 3 | `MISSING_INVOICE_INFO` | Invoice number or invoice date is blank | BLOCKING | AP_CLERK |
| 4 | `POSSIBLE_DUPLICATE_INVOICE` | Exact file hash match or same vendor + invoice # | BLOCKING | AP_CLERK |
| 5 | `VENDOR_MASTER_ISSUE` | Vendor unmapped or status is BLOCKED | BLOCKING | FINANCE_MANAGER |
| 6 | `TAX_VALIDATION_ISSUE` | Invalid GSTIN structure or missing tax rate | BLOCKING | AP_CLERK |
| 7 | `AMOUNT_CALCULATION_MISMATCH`| Sum of line items + tax differs from header total | BLOCKING | AP_CLERK |
| 8 | `PO_NOT_FOUND` | Invoice references an unknown or closed PO | BLOCKING | PURCHASING |
| 9 | `GRN_NOT_FOUND` | No goods received record found in warehouse | BLOCKING | WAREHOUSE |
| 10 | `QUANTITY_MISMATCH` | Invoiced quantity exceeds warehouse accepted quantity | BLOCKING | WAREHOUSE |
| 11 | `PRICE_MISMATCH` | Invoiced unit price exceeds PO price by $> 1.0\%$ | BLOCKING | PURCHASING |
| 12 | `SENSITIVE_FIELD_CHANGED` | User manually altered quantity, price, tax, or vendor | BLOCKING | AP_CLERK |
| 13 | `APPROVAL_OVERDUE` | Approval task exceeded SLA deadline (e.g. 48h) | WARNING | FINANCE_MANAGER |
| 14 | `APPROVAL_REJECTED` | Approver rejected invoice with mandatory comments | BLOCKING | AP_CLERK |
| 15 | `PAYMENT_ISSUE` | Missing bank details or bank rejected payment | BLOCKING | FINANCE_MANAGER |
| 16 | `IMPORT_ERROR` | Excel/CSV bulk import contained row-level invalid data | WARNING | PURCHASING |

---

## 5. THE CRITICAL SECURITY CONTROLS (SECTION 2.3 SENSITIVE EDITS)

### The Core Problem:
Employees must be allowed to correct OCR mistakes. However, allowing unrestricted edits introduces fraud risk: an employee could collude with a supplier and increase the billed quantity or price!

### The Solution:
1. **Sensitive Field Detection:**
   `SENSITIVE_FIELDS = {'vendor', 'vendor_id', 'invoice_number', 'quantity', 'unit_price', 'tax_amount', 'grand_total', 'po_id'}`
2. **Immutable Audit Record (`InvoiceChangeLog`):**
   Every edit mandates a user explanation reason. The system permanently saves:
   * `field_name`: "Line 1: quantity"
   * `old_value`: "100.000"
   * `new_value`: "150.000"
   * `user_display`: "Priya Sharma (AP Clerk)"
   * `reason`: "Vendor revised delivery packing slip"
3. **The Security Lock (`has_sensitive_edits = True` & `PENDING_AP_REVIEW`):**
   * The invoice status immediately becomes `PENDING_AP_REVIEW`.
   * **The Manager cannot approve this invoice!** The "Approve" button is locked.
   * An independent AP Specialist must inspect the original PDF evidence side-by-side with the edit history and click **"AP Approve Changes"** to unlock the workflow.

---

## 6. 2-WAY VS 3-WAY PO MATCHING DEEP DIVE

### 2-Way Match (Services / Non-Physical Purchases):
* **Documents:** **PO** vs **Invoice**
* **When used:** AC repair, legal consulting, software licenses, cleaning services. No goods arrive at a warehouse.
* **Logic:** Does the agreed PO price match the billed invoice price? If yes $\rightarrow$ Pass.

### 3-Way Match (Physical Goods / Inventory):
* **Documents:** **PO** vs **GRN** vs **Invoice**
* **When used:** Physical materials (steel, chairs, cables, cement, bolts).
* **The Formula:**
  $$\text{Invoice Qty} \le \min(\text{PO Balance Qty}, \text{GRN Accepted Qty})$$
  $$\Delta_{\text{Price}} = \frac{|\text{Invoice Price} - \text{PO Price}|}{\text{PO Price}} \times 100 \le \text{Tolerance (1.0\%) }$$
* **Real Example:**
  * PO ordered: 100 chairs @ ₹500
  * GRN received: 80 chairs (truck arrived with 20 chairs shortage)
  * Invoice billed: 100 chairs @ ₹500
  * **Result:** **3-Way Match FAILS!** Invoiced quantity (100) exceeds received quantity (80). System holds the bill for 20 shortage.

---

## 7. PAYMENT STATE MACHINE & REPORTLAB PDF ADVICE

### Templegate Rule 11:
Never mark an invoice as paid merely because a user clicked a button.

```
+------------------+       Dispatch to Bank        +---------------+
| PENDING_APPROVAL |  -------------------------->  |   PROCESSING  |
+------------------+                               +---------------+
                                                           │
                                   ┌───────────────────────┴───────────────────────┐
                                   │ Bank Confirms (UTR)                           │ Bank Rejects
                                   ▼                                               ▼
                         +-------------------+                           +-------------------+
                         |     COMPLETED     |                           |       FAILED      |
                         | (Invoice = PAID)  |                           |  (PAYMENT_ISSUE)  |
                         +-------------------+                           +-------------------+
                                   │
                                   ▼
                 [ Generate Payment Advice PDF (ReportLab) ]
```

* **Statutory TDS Deduction (Section 194Q):**
  * Gross Amount: ₹50,000.00
  * Less: 0.1% TDS on Goods: ₹50.00
  * Net Disbursed to Supplier: **₹49,950.00**
* **Branded PDF Generation:**
  Uses Python's `reportlab` library to compile vector tables, bank UTR, GSTIN metadata, and compliance disclaimers into a downloadable PDF voucher.

---

## 8. COMPLETE API CATALOG

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/core/auth/me/` | Retrieves active user profile and permission role. |
| `POST`| `/api/v1/core/auth/switch-role/` | Switches persona (AP Clerk, Manager, CFO, etc.) for testing. |
| `GET` | `/api/v1/core/audit-logs/` | Retrieves immutable audit log records. |
| `GET` | `/api/v1/invoices/invoices/` | Lists invoices with status, confidence, and search filters. |
| `POST`| `/api/v1/invoices/invoices/upload/` | Multi-format upload, SHA-256 check & OCR extraction pipeline. |
| `POST`| `/api/v1/invoices/invoices/{id}/edit-field/` | Edits a field with mandatory reason and sensitive locking. |
| `POST`| `/api/v1/invoices/invoices/{id}/ap-approve-changes/` | AP Specialist clears review lock. |
| `POST`| `/api/v1/matching/evaluate/{invoice_id}/` | Runs 2-way or 3-way matching with tolerance check. |
| `POST`| `/api/v1/matching/override/{invoice_id}/` | Manager overrides a matching discrepancy with justification. |
| `GET` | `/api/v1/exceptions-mgmt/exceptions/` | Central queue of the 16 exception categories. |
| `POST`| `/api/v1/exceptions-mgmt/exceptions/{id}/resolve/` | Resolves exception and re-runs validation. |
| `GET` | `/api/v1/workflows/requests/` | Lists pending approval tasks for the active role. |
| `POST`| `/api/v1/workflows/initiate/{invoice_id}/` | Routes an invoice into the approval matrix. |
| `POST`| `/api/v1/workflows/requests/{id}/action/` | Executes `APPROVE` or `REJECT` decision with mandatory comments. |
| `GET` | `/api/v1/vendors/vendors/` | Lists vendor master records with masked bank accounts. |
| `POST`| `/api/v1/vendors/vendors/{id}/verify-bank/` | Simulates penny-drop bank account verification. |
| `POST`| `/api/v1/procurement/imports/upload/` | Excel/CSV pre-validation with row-level error reporting. |
| `POST`| `/api/v1/procurement/imports/{batch_id}/commit/`| Atomic commit of valid rows into PostgreSQL. |
| `POST`| `/api/v1/payments/requests/generate-request/` | Creates payment request with TDS deduction. |
| `POST`| `/api/v1/payments/requests/{id}/confirm-settlement/` | Reconciles bank UTR, marks `PAID`, generates PDF. |
| `GET` | `/api/v1/analytics/dashboard-summary/` | Aggregates aging brackets, turnaround TAT, and MSME alerts. |

---

## 9. HOW TO RUN THE APPLICATION

### Step 1: Start Backend (Terminal 1)
```powershell
cd C:\Users\thero\.gemini\antigravity\scratch\ap-automation-system\backend
.\venv\Scripts\python.exe manage.py runserver 8000
```
Backend will be live at: `http://127.0.0.1:8000`

### Step 2: Start Frontend (Terminal 2)
```powershell
cd C:\Users\thero\.gemini\antigravity\scratch\ap-automation-system\frontend
pnpm run dev
```
Frontend will be live at: `http://localhost:5173`

---

## 10. TOP 10 TECHNICAL INTERVIEW QUESTIONS & ANSWERS

**Q1: How do you handle OCR misreads versus deliberate financial fraud?**  
*Answer:* We follow Templegate Section 2.3. We permanently preserve the raw invoice file and initial OCR extraction. When an employee edits a sensitive field (quantity, unit price, tax, or total), the system mandates an explanation reason, writes an entry into `InvoiceChangeLog`, flags `has_sensitive_edits = True`, and locks the invoice in `PENDING_AP_REVIEW`. A manager cannot approve it until an AP Specialist verifies the change against the source PDF.

**Q2: What is the difference between 2-Way and 3-Way Matching?**  
*Answer:* 2-Way matching compares the Purchase Order (PO) with the Invoice; it is used for services where no physical delivery note exists. 3-Way matching compares the PO, the Goods Receipt Note (GRN) from the warehouse, and the Invoice. It ensures the company only pays for materials physically accepted at the warehouse.

**Q3: How does your system support partial deliveries?**  
*Answer:* We sum all accepted quantities across all Goods Receipt Notes linked to the PO line item (`sum(g.accepted_quantity)`). The matching engine validates that invoiced quantity is less than or equal to total received quantity, allowing multiple shipments against a single purchase order.

**Q4: Why did you choose DecimalField over FloatField in Django?**  
*Answer:* Floating-point numbers introduce binary approximation errors (`0.1 + 0.2 = 0.30000000000000004`). In financial accounting, calculations must be exact to the cent or paise. `DecimalField(max_digits=14, decimal_places=2)` enforces fixed-point arithmetic.

**Q5: How do you prevent duplicate invoice payments?**  
*Answer:* We implement a 3-tier check: Tier 1 computes a cryptographic SHA-256 hash of the uploaded document stream. Tier 2 checks for identical `vendor_id` and normalized `invoice_number`. Tier 3 checks for identical vendor, amount, and date within $\pm 3$ days.

**Q6: What is the statutory significance of MSME in your application?**  
*Answer:* Under Section 43B(h) of the Indian Income Tax Act, payments to registered Micro and Small enterprises must be settled within 45 days; failure to do so results in tax deduction disallowances. Our dashboard features a proactive 35-day countdown warning to prevent penalties.

**Q7: How do you enforce separation of duties in approvals?**  
*Answer:* In `WorkflowApprovalEngine`, we verify that `user != invoice.uploaded_by`. If an employee uploads an invoice, they are programmatically barred from approving it, preventing unauthorized self-approvals.

**Q8: What is your payment settlement workflow (Templegate Rule 11)?**  
*Answer:* Invoices are never marked "PAID" simply upon clicking a payment button. The status transitions through `Pending Treasury Approval` $\rightarrow$ `Processing with Bank` $\rightarrow$ and only marks `Completed` after reconciliation against a verified Unique Transaction Reference (UTR).

**Q9: How do you handle bad data during Excel/CSV procurement imports?**  
*Answer:* `BulkDataImporter` parses spreadsheets using Pandas, verifies mandatory columns, and isolates row-level errors into `ImportRowError` records. Users are presented with a preview of valid versus invalid rows, and committing data is wrapped in an atomic database transaction (`@transaction.atomic`).

**Q10: Why did you choose ReactJS and Django REST Framework?**  
*Answer:* Django REST Framework provides robust enterprise domain modeling, built-in security, ORM transactions, and clean service layers. React.js delivers a responsive, modular UI essential for split-screen OCR verification and real-time dashboard analytics.
