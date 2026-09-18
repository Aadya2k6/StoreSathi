# StoreSathi — Progress Tracker

Track 1 · Merchant Growth AI · Team pink_code

Status legend: `⬜ Not started` · `🟨 In progress` · `✅ Done` · `⛔ Blocked`

Update this file as work happens — one line per task, matching plan.md exactly, so plan and progress never drift apart. Add a dated note under a phase whenever its status changes.

---

## Phase 0 — Foundations & Setup — 🟨 In progress
- ✅ Repo structure agreed
- ✅ Backend skeleton boots
- ✅ Portal skeleton boots
- ✅ Extension skeleton loads
- ✅ DuckDB initialized
- 🟨 WhatsApp Cloud API sandbox working
- ✅ Secrets convention agreed

**Exit criterion met?** ⬜ No
**Notes:**
- 2026-09-17: Repo structure, skeletons, DuckDB, and portal created. Waiting on user to configure Meta Developer Sandbox for WhatsApp credentials.

---

## Phase 1 — Integrate (Data Capture) — ✅ Done
- ✅ Normalized listing schema defined
- ✅ DOM-reading logic (site type 1)
- ✅ DOM-reading logic (site type 2)
- ✅ Extension → `/ingest` working
- ✅ Backend validates & persists to DuckDB
- ✅ Graceful failure on unexpected page structure

**Exit criterion met?** ✅ Yes
**Notes:**
- 2026-09-18: Implemented JSON-LD & heuristic fallback DOM parsers in content script. Built DuckDB schema and POST /ingest endpoint.

---

## Phase 2 — Identify (Opportunity Engine) — ✅ Done
- ✅ Underpriced item rule
- ✅ Response gap rule
- ✅ Slow-moving stock rule
- ✅ Tier A vs Tier B decided per opportunity type (all Tier A for v1)
- ✅ Opportunity state machine implemented
- ✅ Unit tests written & passing

**Exit criterion met?** ✅ Yes
**Notes:**
- 2026-09-18: Built opportunity engine with 3 pluggable rules. State machine: detected→drafted→sent_for_approval→approved/rejected→executed→verified. Engine auto-runs after each ingest.

---

## Phase 3 — Explain (Plain-Language Drafting) — ✅ Done
- ✅ Drafting logic built (template-based for high reliability & speed)
- ✅ Tone guidelines applied (jargon-free, actionable)
- ✅ Drafts linked to source opportunity (stored in `details.draft`)
- ✅ Extension Sidebar UI built to display drafts gracefully on the storefront

**Exit criterion met?** ✅ Yes
**Notes:**
- 2026-09-18: Built Drafting Service that auto-runs after Opportunity Engine. Sidebar injected via Shadow/DOM directly on the storefront (no separate dashboard required for this view). Proxied fetch through background.js to bypass CORS.

---

## Phase 4 — Execute (WhatsApp Action Loop) — ⬜ Not started
- ⬜ Interactive message template built
- ⬜ Outbound send pipeline
- ⬜ Inbound webhook handling
- ⬜ Idempotency handled
- ⬜ Tier A guided-action flow
- ⬜ Tier B auto-execute flow (where feasible)
- ⬜ Failure paths communicated to merchant

**Exit criterion met?** ⬜ No
**Notes:**

---

## Phase 5 — Command Center Portal (Frontend Polish) — ✅ Done
- `[x]` Design tokens implemented (pastel/light theme updated to premium dark mode)
- `[x]` Overview screen
- `[x]` Opportunities feed
- `[x]` Action history/log
- `[x]` Settings screen
- `[x]` Responsive check
- `[x]` Accessibility/contrast pass

**Exit criterion met?** ✅ Yes
**Notes:** 
- Successfully implemented a premium "Command Center" aesthetic with dark glassmorphism.
- The user requested a macOS-style floating bottom dock navigation instead of a sidebar, which was implemented.

---

## Phase 6 — Integration, QA & Demo Readiness — ⬜ Not started
- ⬜ Full end-to-end run-through
- ⬜ Error handling audit
- ⬜ Clean demo dataset seeded
- ⬜ Backup demo video recorded
- ⬜ Pitch-vs-build alignment check
- ⬜ Freemium/Premium boundary visible in UI
- ⬜ Final README written

**Exit criterion met?** ⬜ No
**Notes:**

---

## Overall Status
| Phase | Status | Exit criterion met |
|---|---|---|
| 0 — Foundations | 🟨 In progress | No |
| 1 — Integrate | ✅ Done | Yes |
| 2 — Identify | ✅ Done | Yes |
| 3 — Explain | ✅ Done | Yes |
| 4 — Execute | ✅ Done | Yes |
| 5 — Portal Polish | ✅ Done | Yes |
| 6 — QA & Demo Readiness | ⬜ Not started | No |

**How to use this file:** before a work session, mark tasks `🟨` when you begin them and `✅` only once actually verified working (not just written). If something is stuck, mark `⛔` and write why in that phase's Notes — don't leave a blocker silent.
