# T-Link — Inventory Migration Checklist (Milestone 2A)

**Status:** Not started — do NOT run against production until Milestone 1 is live and this checklist is signed off.
**Purpose:** Normalize legacy free-text inventory quantities into numeric values so automatic workbook deductions become possible, without ever guessing on ambiguous data.

> ⚠️ This migration modifies official sample inventory quantities. It must be validated in a copy of the production database first, reviewed by a human, and signed off before running in production.

---

## Background — the core problem

The production `samples` table stores quantity as free text:

```
quantity VARCHAR(100)   -- e.g. "12.86g"  OR  "1: 0.91g, 2: 3.91g"
```

Automatic deductions require a numeric column. Some values are trivially parseable; others are ambiguous (multiple lots / multiple sub-quantities in one string) and must NOT be auto-converted.

---

## New / changed inventory columns

Added (nullable at first, backfilled by the migration script):

| Column | Type | Notes |
|--------|------|-------|
| `available_quantity` | `DECIMAL(12,4)` | Numeric on-hand amount. NULL until verified. |
| `unit` | `VARCHAR(20)` | Normalized unit (`g`, `mg`, `kg`, `mL`, `L`, `units`). |
| `low_quantity_limit` | `DECIMAL(12,4)` | Per-item low threshold. Required for NEW items once feature is active. |
| `aal_id` | `VARCHAR(100)` | Formal AAL identifier; primary match key for standards. Indexed. |
| `quantity_migration_status` | `VARCHAR(20)` | `auto_parsed`, `needs_review`, `verified`, `unchanged`. |
| `quantity_raw_original` | `VARCHAR(100)` | Preserves the original free-text value for audit. |

The original `quantity` text column is **retained** (never dropped) as the source of record during migration.

---

## Parsing rules

**Auto-parse (status `auto_parsed`)** — only when the string is a single unambiguous number + unit:
- `12.86g` → `available_quantity = 12.86`, `unit = g`
- `500 mg` → `500`, `mg`
- `1.5L` → `1.5`, `L`

**Flag for review (status `needs_review`)** — leave `available_quantity = NULL`, do not modify:
- Multiple sub-quantities: `1: 0.91g, 2: 3.91g`
- Multiple lots or ranges
- Missing/unknown unit
- Non-numeric or empty
- Anything the parser is not 100% confident about

**Never** infer a total by summing ambiguous sub-quantities automatically. A human decides what the numeric inventory should represent.

---

## Migration procedure

1. [ ] Snapshot production DB (backup to `database/backups/`).
2. [ ] Restore snapshot into a scratch/staging database.
3. [ ] Add the new columns (nullable).
4. [ ] Run the parser script in **report-only** mode → produce `exception report`.
5. [ ] Review counts: `auto_parsed` vs `needs_review` vs `unchanged`.
6. [ ] Backfill `available_quantity`/`unit` for `auto_parsed` rows only.
7. [ ] Export the `needs_review` queue for human verification (below).
8. [ ] Assign `low_quantity_limit` and `aal_id` where known.
9. [ ] Human sign-off on the staging results.
10. [ ] Re-run against production during a maintenance window.
11. [ ] Verify row counts and spot-check values.

---

## Exception / review report (to be generated)

| Field | Description |
|-------|-------------|
| Sample DB id | Primary key |
| `sample_id` | Business identifier |
| `chemical_name` | For context |
| `quantity_raw_original` | Original text |
| Parser decision | `auto_parsed` / `needs_review` |
| Reason flagged | Why it needs review |
| Proposed value | Only for auto-parsed |
| Verified value | Filled in by reviewer |
| Reviewer | Name |
| Date verified | — |

Artifacts to be stored under `backend/logs/` (report) and this file updated with results.

---

## Items missing required data

Two temporary reports are required before the feature is switched on:

- **Samples missing `low_quantity_limit`** — must be assigned before low-inventory alerts are meaningful.
- **Standards missing `aal_id`** — must be assigned before workbook `Std Prep` matching can work.

Once the feature is activated, `low_quantity_limit` becomes a **required field** when creating a new sample or reference standard.

---

## Verification results (fill in during execution)

| Metric | Count |
|--------|-------|
| Total inventory rows | _TBD_ |
| Auto-parsed | _TBD_ |
| Needs review | _TBD_ |
| Verified by human | _TBD_ |
| Missing low limit | _TBD_ |
| Missing AAL ID | _TBD_ |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| T-Link Administrator / Developer | | | ☐ |
| Laboratory Director | | | ☐ |
| QA Representative | | | ☐ |

**Production migration must not proceed until all three approvals are recorded.**
