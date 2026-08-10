# T-Link — Teleos Studies Module Implementation Plan

**Status:** Approved for build (Milestone 1 first)
**Scope:** Internal T-Link application only. Not exposed through the Manufacturer Portal.
**Source documents:** `Studies/T-Link Teleos Study Development Plan .docx`, `Studies/Study Workbook Integration and Inventory Tracking.docx`

---

## Guiding Principles (confirmed decisions)

1. **Two separate releases.** Study management ships independently of inventory automation. The inventory migration is the highest-risk work and must not delay the useful Study module.
2. **Never guess on ambiguous inventory.** Legacy quantity conversion is best-effort automatic parsing **plus a manual review queue**. Anything ambiguous is flagged and left unchanged until verified.
3. **`aal_id` is a formal inventory field** and the primary identifier for standards. Workbook `Std Prep!D` matches `aal_id`; chemical name (`Std Prep!C`) is a secondary verification check only.
4. **Excel workbook is the v1 source of truth** for preparation data. No web prep-forms in v1 — analysts keep their existing workflow.
5. **Signed GLP protocols are immutable.** Once a document is designated the signed protocol, the underlying file is read-only. Amendments/replacements are new versioned records, never overwrites.
6. **Study permissions start conservative.** Creation and GLP administrative editing are limited to **Study Administrator**. Editors work within assigned studies and upload permitted working documents. Viewers are read-only. Can be loosened later without a schema redesign.
7. **Duplicate-prevention uses a persistent entry UUID**, not a worksheet row number. When T-Link first detects a preparation entry it assigns an immutable `entry_uid`. Worksheet/row are recorded for audit only.

---

## Confirmed v1 Workbook Mapping (contract)

| Worksheet | Column | Field | T-Link purpose |
|-----------|--------|-------|----------------|
| `1. Std Prep` | C | Chemical Name | Secondary verification of the matched standard |
| `1. Std Prep` | D | AAL ID | **Primary** inventory match for reference standards (`samples.aal_id`) |
| `1. Std Prep` | E | Weight Added (g) | Amount deducted from standard inventory |
| `2. Sample Prep` | C | Sample ID | **Primary** inventory match for samples (`samples.sample_id`) |
| `2. Sample Prep` | E | Amount of Sample Added (g) | Amount deducted from sample inventory |

---

## Milestones

### Milestone 1 — Teleos Studies (study management, no inventory risk)

Sequence:
`Database → permissions → Studies API → dashboard → workspace → documents/versioning → signed protocol controls → seed existing studies → upload existing protocols`

**Stage A — Database schema** *(current coding target)*
- `study_programs`, `studies`, `study_users`, `study_documents`, `study_document_versions`, `study_activity`, `study_samples` (read-only link table).
- No changes to production inventory quantities.

**Stage B — Study permissions & API**
- Per-study permission middleware layered on top of the existing global `role`.
- Study roles: `study_admin`, `study_editor`, `study_viewer`, plus implicit no-access.
- `routes/studies.ts` mounted at `/api/studies` (internal only — never registered in the Manufacturer Portal).

**Stage C — Study workspace UI**
- New internal nav item **"Teleos Studies"** (hidden from manufacturers).
- Studies dashboard: search/filter by number, title, GLP/Non-GLP, program, status; sort by dates; active vs. completed/archived views.
- Individual Study Workspace tabs: **Overview**, **Documents**, **Samples & Standards** (read-only in M1), **Activity History**.
- Document management: upload → Cloudinary, versioning, statuses, signed-protocol lock (immutable file, amendments as new records), full activity logging.

**Milestone 1 data population**
- Seed the 7 current studies:

  | Study Number | Study | Type | Status |
  |--------------|-------|------|--------|
  | 2026-TLN-01 | Yichang 5-Batch | GLP | Ongoing |
  | 2026-TLN-02 | Kashima 5-Batch | GLP | Upcoming |
  | 2026-TELEOS-01 | Analysis and Re-Certification of Analytical Reference Standards | GLP | Complete |
  | 2026-TELEOS-02 | Analysis and Re-Certification of Analytical Reference Standards | GLP | Complete |
  | 2026-TELEOS-03 | Analysis and Re-Certification of Analytical Reference Standards | GLP | Upcoming |
  | 2026-CMO-01 | Oxirane Stability in Water | Non-GLP | Ongoing |
  | 2026-CMO-02 | Oxirane Formation in Telone | Non-GLP | Ongoing |

- Group the `2026-TELEOS-*` studies under a parent program: **Analytical Reference Standard Re-Certification**.
- Upload the available signed protocol PDFs (in `Studies/`) to their study records and mark them as signed/immutable.

### Milestone 2 — Inventory Automation (higher risk, validated separately)

See `Studies/INVENTORY_MIGRATION.md` for the migration checklist and sign-off.

**Milestone 2A — Inventory normalization**
`available_quantity DECIMAL → unit → low_quantity_limit → aal_id → migration script → exception/review report → human verification`

**Milestone 2B — Workbook automation**
`controlled workbook template → auto-copy on study creation → Excel parser → Std Prep/Sample Prep mapping → validation → transaction engine → adjustment handling → low-inventory alerts`

- Add an Excel parser dependency (`exceljs`).
- Persistent `entry_uid` per preparation entry is the duplicate-prevention key.
- Edited quantities create difference-adjustment transactions; originals never disappear.
- Insufficient inventory blocks the transaction and raises a validation alert (no negative balances).
- Every deduction writes to `sample_transactions` + `study_activity` and re-evaluates low-quantity limits.

**Milestone 2C — Inventory lockdown**
`shipment deductions + workbook deductions + audited admin corrections only`
- Disable routine manual quantity editing.
- Retain a tightly controlled, fully audited admin-correction path (reason required).

---

## Proposed Tables (overview)

| Table | Milestone | Purpose |
|-------|-----------|---------|
| `study_programs` | 1A | Optional grouping for related/recurring studies |
| `studies` | 1A | Primary study record |
| `study_users` | 1A | Per-study permission assignments |
| `study_documents` | 1A | Document records + metadata + signed-protocol flag |
| `study_document_versions` | 1A | Immutable version history per document |
| `study_activity` | 1A | Study-level audit trail |
| `study_samples` | 1A | Read-only link between studies and inventory items |
| `study_form_transactions` | 2B | Links workbook prep entries to inventory transactions (holds `entry_uid`) |

The existing `sample_transactions` and `notifications` tables are **reused** for Milestone 2 rather than duplicated.

---

## Open Items Deferred (not blocking Milestone 1)

- Final low-inventory email recipient list (configurable, decided during Milestone 2B).
- QA review/approval workflow (Priority 6 / future).
- Electronic signatures, milestone tracking, inventory forecasting (future).
- Document retention policy duration (to be confirmed before Milestone 2 lockdown).
