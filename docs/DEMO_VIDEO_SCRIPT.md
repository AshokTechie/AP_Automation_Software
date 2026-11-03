# Demo Video Walkthrough Script & Recording Guide
**Project:** Accounts Payable (AP) Automation Software with OCR  
**Client / Assessment:** Templegate Technologies & Services Pvt. Ltd.  
**Target Video Duration:** 5 – 7 Minutes  
**Stack:** React.js (Frontend) + Django / DRF (Backend) + PostgreSQL (Database)  

---

## 1. Video Objectives & Scoring Criteria

Evaluators at Templegate look for:
1. **Architectural Understanding:** Clean explanation of React + Django + PostgreSQL separation.
2. **Business Workflow Mastery:** Clear demonstration of the 9 modules and the 16 exception categories.
3. **Core Highlights:**
   * Drag & drop invoice intake + Email webhook simulation.
   * Split-screen OCR review with confidence scoring.
   * Sensitive change detection (Rule 3) requiring AP review.
   * 3-Way matching against PO & GRN with partial delivery support.
   * Multi-tier approval matrix with rejection notes.
   * Reliable payment settlement with UTR & Payment Advice PDF generation.

---

## 2. Minute-by-Minute Demo Script

### Minute 0:00 – 1:00 | Introduction & Architectural Overview
* **Screen:** Open the application at `http://localhost:5173`.
* **Narrative:**
  > *"Hello everyone! My name is [Your Name], and today I am excited to demonstrate my Accounts Payable Automation Software with OCR, built for Templegate Technologies & Services Pvt. Ltd.
  >
  > As mandated in the technical requirements, the application is built using:
  > - **React.js** with Tailwind CSS on the frontend for high-speed responsiveness.
  > - **Django & Django REST Framework** in Python on the backend for clean domain services and robust business logic.
  > - **PostgreSQL** as the relational database, enforcing ACID transactional integrity and fixed-precision decimals for all financial calculations.
  >
  > The system automates the 9 core modules: from multi-channel invoice capture to OCR extraction, validation, 3-way matching, approval workflows, payment processing, and audit reporting."*

---

### Minute 1:00 – 2:15 | Module 1 & 2: Ingestion, OCR & The Side-by-Side Verification Screen
* **Screen:** Navigate to **"Invoice Capture"**, then click **"Simulate Email Inbound"** or drag & drop an invoice.
* **Narrative:**
  > *"Let's start with Module 1: Invoice Capture. We support drag-and-drop file uploads for PDF, JPG, PNG, and TIFF formats, as well as bulk upload queues and automated email ingestion webhooks.
  >
  > Notice that as soon as an invoice is uploaded, the system computes a cryptographic SHA-256 hash to immediately prevent duplicate re-uploads.
  >
  > Now, let's open the **Side-by-Side OCR Verification Viewer**.
  > On the left, we display the original document evidence. On the right, we display the extracted header fields, vendor identification, and line-item materials table.
  >
  > In compliance with **Templegate Rule 2**, we never treat OCR output as verified financial data. Each field has a confidence score indicator. Notice how the user can verify each value."*

---

### Minute 2:15 – 3:30 | Module 3 & Section 2.3: Sensitive Field Changes & AP Review Gate
* **Screen:** In the Side-by-Side Reviewer, click **Edit** on a line item quantity (e.g., change from 100 to 150).
* **Narrative:**
  > *"Here is one of the most critical security controls requested in Section 2.3: **Distinguishing an OCR correction from suspicious financial manipulation**.
  >
  > When I click to edit the quantity, notice two things:
  > 1. An explanation reason is strictly mandatory. The system refuses to save without an explanation.
  > 2. Because quantity is configured as a **Sensitive Field**, the system automatically flags this invoice as 'PENDING_AP_REVIEW' and logs an entry in the immutable `InvoiceChangeLog` recording the user, old value, new value, timestamp, and reason.
  >
  > Notice the amber banner: The invoice is locked and cannot proceed to manager approval until an AP Specialist independently reviews the source document and clicks 'AP Approve Changes'."*

---

### Minute 3:30 – 4:45 | Module 4: 3-Way PO & GRN Matching with Partial Deliveries
* **Screen:** Navigate to **"PO / GRN Matching"** and select `INV-2026-TATA-99`.
* **Narrative:**
  > *"Now let's examine Module 4: PO and Goods Receipt Note (GRN) Matching.
  >
  > In real-world enterprise procurement, orders are frequently delivered in partial shipments. Here, Purchase Order #PO-2026-001 ordered 100 chairs. The warehouse recorded Goods Receipt Note #GRN-2026-101 with only 80 chairs accepted.
  >
  > When the supplier billed for 100 chairs, our matching engine immediately detected the discrepancy:
  > - Invoiced quantity: 100
  > - Warehouse accepted quantity: 80
  >
  > The system held the invoice and routed an exception to the **Central Exception Queue**. The invoice cannot be approved for payment until the discrepancy is resolved or authorized by an approved manager override."*

---

### Minute 4:45 – 5:45 | Module 5: Approval Matrix & Separation of Duties
* **Screen:** Navigate to **"Approval Inbox"** using the top navbar persona switcher (switch to Ananya Roy - Finance Manager).
* **Narrative:**
  > *"Now, let's look at Module 5: The Workflow & Approval Engine.
  >
  > Approvals are dynamically routed through a configurable matrix:
  > - Tier 1: Invoices up to ₹50,000 require Department Head approval.
  > - Tier 2: Invoices between ₹50,001 and ₹5,00,000 route to the Financial Controller.
  > - Tier 3: Invoices above ₹5,00,000 route to the CFO.
  >
  > Notice that we enforce **Separation of Duties**: a user cannot approve an invoice that they uploaded themselves.
  > When approving, one click advances the invoice. If rejecting, a mandatory rejection reason is required, which automatically notifies the AP team."*

---

### Minute 5:45 – 6:45 | Module 6 & 7: Vendor Master, Banking Penny Drop & Reliable Payments
* **Screen:** Navigate to **"Payment Processing"** and click **"Simulate Settle (UTR)"** on an approved payment.
* **Narrative:**
  > *"Let's examine Module 6 & 7: Vendor Management and Payment Processing.
  >
  > In the Vendor Master, all bank accounts feature masking for privacy (`XXXXXX1234`), and vendors can be verified via automated **Penny Drop simulation**.
  >
  > For payments, we strictly adhere to **Templegate Rule 11**: An invoice is *never* marked paid simply because a user clicked a button.
  > The status transitions from `Pending Approval` $\rightarrow$ `Processing with Bank Gateway` $\rightarrow$ and only marks `Completed` when the core bank issues a verified Unique Transaction Reference (UTR).
  >
  > Upon settlement, Django automatically generates this professional, downloadable **Payment Advice PDF** using ReportLab, detailing the settled invoice, bank UTR, and statutory TDS deduction under Section 194Q."*

---

### Minute 6:45 – 7:30 | Module 8 & 9: Dashboard KPIs, MSME 45-Day Tracker & Conclusion
* **Screen:** Navigate back to **"Executive Dashboard"** and then **"Reports & Audit Logs"**.
* **Narrative:**
  > *"Finally, Modules 8 & 9: Real-time Analytics & Statutory Reporting.
  >
  > Our dashboard aggregates live PostgreSQL data:
  > - Total AP Outstanding and cash flow projections.
  > - AP Aging breakdown (0-30, 31-60, 61-90, 90+ days).
  > - **Statutory MSME Compliance Tracker:** Proactive alerts for invoices approaching 35+ days under Section 43B(h) of the Income Tax Act.
  > - Full immutable Audit Log recording every single event.
  >
  > In conclusion, this application provides an end-to-end, resilient, and enterprise-compliant Accounts Payable automation platform built strictly on React.js, Django, and PostgreSQL.
  > Thank you for your time, and I look forward to the next steps with Templegate Technologies!"*
