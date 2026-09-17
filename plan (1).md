# StoreSathi — Project Plan

Track 1 · Merchant Growth AI · Team pink_code

Goal: deliver every element shown in the pitch deck (Integrate → Identify → Explain → Execute, across extension + portal + WhatsApp) cleanly and without last-minute breakage. Work is split into 6 phases, each with a clear exit criterion — do not start a phase until the previous one's exit criterion is met.

---

## Phase 0 — Foundations & Setup
**Objective:** everyone can run the project locally before any feature work starts.

- [ ] Repo structure agreed: `/extension`, `/portal`, `/backend`, `/data`, `/docs`
- [ ] Node.js backend skeleton boots with a health-check route
- [ ] React portal skeleton boots with routing scaffold (Overview / Opportunities / History / Settings)
- [ ] Chrome extension skeleton loads (Manifest V3) with a placeholder content script
- [ ] DuckDB initialized locally with a placeholder table
- [ ] Meta WhatsApp Cloud API sandbox account created and test message sent successfully
- [ ] `.env` / secrets convention agreed (never committed)

**Exit criterion:** a "hello world" flows end-to-end — extension sends a dummy payload → backend logs it to DuckDB → dashboard shows it → a WhatsApp test message is received.

---

## Phase 1 — Integrate (Data Capture)
**Objective:** reliably read real store data off a page with zero merchant setup.

- [ ] Define the normalized listing schema (product name, price, stock signal, reviews, timestamps)
- [ ] Build DOM-reading logic for at least 2 reference site types (e.g., a Shopify demo store + a generic custom site)
- [ ] Extension sends structured snapshots to `POST /ingest`
- [ ] Backend validates and persists snapshots into DuckDB
- [ ] Handle graceful failure when a page doesn't match expected structure (no crashes, no silent bad data)

**Exit criterion:** running the extension on 2+ different real/demo storefronts produces clean, correctly-shaped data in DuckDB every time.

---

## Phase 2 — Identify (Opportunity Engine)
**Objective:** turn raw data into real, correct opportunity flags.

- [ ] Rule: underpriced item detection (vs. category baseline / comparable items)
- [ ] Rule: response gap detection (unanswered reviews/messages)
- [ ] Rule: slow-moving stock detection (low/no sales velocity over a window)
- [ ] Explicitly decide, per opportunity type: Tier A (draft & guide) vs Tier B (direct execute) — see architecture.md §5
- [ ] Opportunity state machine implemented: `detected → drafted → sent_for_approval → approved/rejected → executed → verified`
- [ ] Unit tests for each rule against sample data (including edge cases: no data, one data point, conflicting signals)

**Exit criterion:** feeding Phase 1's captured data through the engine produces opportunities that a human reviewer agrees are sensible — no false positives on obvious edge cases.

---

## Phase 3 — Explain (Plain-Language Drafting)
**Objective:** every opportunity becomes a clear, trustworthy, non-technical explanation.

- [ ] Drafting logic (template-based and/or LLM-assisted) converts an opportunity into: a plain-language reason + a concrete suggested action
- [ ] Tone guidelines applied consistently (simple, respectful, no jargon, no "black box" language — matches the deck's trust promise)
- [ ] Drafts stored and linked to their source opportunity for traceability
- [ ] Review pass: 10+ sample drafts checked for clarity by someone outside the dev team

**Exit criterion:** a non-technical reader can understand the suggestion and why it was made in under 10 seconds, with zero dashboards required.

---

## Phase 4 — Execute (WhatsApp Action Loop)
**Objective:** the merchant can act on a suggestion with one tap, and it actually happens.

- [ ] WhatsApp interactive message template built (Approve / Reject buttons)
- [ ] Outbound send pipeline: drafted action → WhatsApp message
- [ ] Inbound webhook: button tap → correct opportunity updated → correct next step triggered
- [ ] Idempotency handled (double-taps, delayed webhooks don't cause duplicate actions)
- [ ] Tier A actions: merchant is guided to the change (clear instructions/pre-filled text)
- [ ] Tier B actions (where feasible): action applied automatically, with a confirmation sent back
- [ ] Failure paths handled and communicated back to merchant (e.g., "couldn't apply this, here's why")

**Exit criterion:** full loop demoable — a real detected opportunity is sent to WhatsApp, approved with one tap, executed, and confirmed, with the dashboard reflecting the final state.

---

## Phase 5 — Command Center Portal (Frontend Polish)
**Objective:** the portal is a coherent, good-looking oversight layer — pastel, light theme, glassmorphism, per architecture.md §6.

- [ ] Design tokens (colors, spacing, radius, typography) implemented as a shared theme
- [ ] Overview screen: health snapshot, opportunity count, pending approvals
- [ ] Opportunities feed: card-based, status chips (mint/peach/pink), plain-language text surfaced
- [ ] Action history/log screen with clear state trail
- [ ] Settings: connect extension, link WhatsApp number, plan tier display
- [ ] Responsive check (works on a standard laptop screen at minimum; mobile nice-to-have)
- [ ] Accessibility pass: sufficient text contrast even within the pastel palette

**Exit criterion:** portal visually matches the intended pastel/glassmorphism direction and every screen reflects live backend data with no placeholder/mock content left in.

---

## Phase 6 — Integration, QA & Demo Readiness
**Objective:** everything works together, reliably, under demo conditions.

- [ ] Full end-to-end run-through: fresh merchant → extension install → data capture → opportunity detected → WhatsApp approval → execution → portal reflects it
- [ ] Error handling audit: no unhandled crashes anywhere in the loop
- [ ] Seed a clean demo dataset/storefront so the live demo isn't dependent on flaky real-world data
- [ ] Record a backup demo video in case of live network/WhatsApp sandbox issues
- [ ] Pitch alignment check: walk the deck's 4-step flow (Integrate/Identify/Explain/Execute) against the actual product and confirm every claim in the deck is true of the build
- [ ] Freemium vs Premium boundary reflected in the UI (even if just visually gated) — supports the Business Model slide
- [ ] Final README with setup + run instructions

**Exit criterion:** the product can be demoed live, start to finish, without the presenter needing to explain away a broken step.

---

## Sequencing Notes
- Phases 1–2 (Integrate, Identify) can start in parallel with Phase 0's later steps once the backend skeleton exists.
- Phase 5 (Portal polish) can begin visually in parallel with Phase 2–3, but should only wire to *real* data once Phase 2 is stable — avoid polishing a UI around data shapes that will change.
- Do not start Phase 4 (WhatsApp execution) until Phase 3's drafts are trustworthy — sending bad suggestions to a real approval channel is worse than a delayed feature.
- Phase 6 is not "buffer time" — treat it as mandatory QA, not a place to cram unfinished features.
