# StoreSathi — Execution Plan (Refined)

**Source:** `architecture__1_.md` (v2) — kept as-is; this file sequences it to actually win.
**Team:** pink_code · **Track:** Merchant Growth AI

This plan does not change the architecture. It fixes three gaps in it:
1. build order didn't match demo order,
2. no time-boxing / parallel tracks for a team,
3. no explicit cut-list for when time runs out.

---

## 0. Non-negotiable framing

The judging moment is the **golden path** (arch doc §32):

```
BILL PHOTO → OCR → CATALOGUE → SALE → INVENTORY UPDATE
    → AI INSIGHT → PREDICTION → RECOMMENDATION → APPROVAL → COPILOT Q&A
```

Everything in this plan exists to make that ~3-minute story work live, on real
(seeded) data, without a network hiccup killing it. Anything that doesn't
serve that story is P1/P2 and gets cut first.

**Hard rule:** freeze the DuckDB schema (§15 of arch doc) by end of Block 1.
Every track below depends on it — changing it late re-breaks everyone.

---

## 1. Tracks (run in parallel, not serially)

Assign these to people/pairs on day 1 morning, right after schema freeze:

| Track | Owns | Arch doc phases |
|---|---|---|
| **A — Core Data & Billing** | merchant/store/product schema, sale flow, inventory ledger, idempotency | Phase 1, 2 |
| **B — OCR** | upload, Tesseract pipeline, parser, review UI, confirm→commit | Phase 3 |
| **C — Intelligence & AI** | rules engine, forecasting math, LLM provider, copilot, recommendation objects | Phase 4, 5 |
| **D — Frontend Shell** | Command Center screens, dashboard, billing UI, OCR review UI, copilot UI | §6 screens |
| **E — Actions, Demo Data & Polish** | action state machine, WhatsApp mock, demo data for 3 merchant types, rehearsal | Phase 6, 7 (mock), demo data |

One person should float as integrator — nobody merges into `main` without the
schema contract holding.

---

## 2. Time-boxed phases (assumes a ~30–36 hr hackathon; scale as needed)

### Block 1 — Foundation (Hours 0–6) — **everyone**
- Freeze schema: merchant, store, user, product, inventory_movement, sale,
  sale_item, ocr_document, recommendation, action, daily_metric (arch §15).
- Repository/data-access layer over DuckDB (arch §16) — do this now, not later;
  it's what lets you swap DuckDB → Postgres without panic if a demo laptop dies.
- Auth (email/password is enough — arch §6.1), merchant/store context, seed script skeleton.
- **Checkpoint:** a authenticated request can read/write a scoped row. If not, nothing else can start.

### Block 2 — Billing + OCR in parallel (Hours 6–14) — Tracks A & B
- **A:** create-sale flow end-to-end (validate → transaction → items →
  inventory movement → stock update), idempotency key enforced (arch §7.2).
- **B:** Tesseract pipeline (upload → preprocess → OCR → parser → structured
  candidate → confidence → review UI → confirm → commit to catalogue/sale).
- These can go fully parallel because both only touch the Block 1 schema, not each other.
- **Checkpoint:** a photographed bill becomes real catalogue rows; a manual sale
  correctly decrements stock. Do this checkpoint together — it's the demo's first half.

### Block 3 — Intelligence (Hours 14–20) — Track C, D starts UI shell
- Deterministic rules engine first (low stock, stockout risk, slow-moving,
  anomaly, growth — arch §10): **build and demo this before touching the LLM.**
  It's real signal with zero API dependency and zero hallucination risk.
- Forecasting: moving average / day-of-week weighting (arch §11) — simple, not ML.
- **D (parallel):** dashboard, billing screen, OCR review screen wired to real APIs as they land.
- **Checkpoint:** dashboard shows real low-stock/anomaly cards computed from seeded data, no LLM yet.

### Block 4 — AI Copilot + Recommendations (Hours 20–26) — Track C
- LLM provider abstraction (arch §9.2), context builder (§9.4 — bounded context,
  never the whole DB), copilot chat, recommendation drafting on top of the
  Block 3 facts (never let the LLM compute numbers — arch §9.3).
- Guardrails from arch §25 — implement as a thin post-processing check, not vibes.
- Failure fallback (arch §35): if `OPENAI_API_KEY` call fails, dashboard must
  still show the deterministic facts. **Test this by literally pulling the key.**
- **Checkpoint:** copilot answers a real question using real numbers; unplugging
  the API key degrades gracefully instead of crashing the demo.

### Block 5 — Actions + Demo Data (Hours 26–30) — Track E, A helps
- Action state machine (detected→drafted→awaiting_approval→approved→executed→verified, arch §22).
- Approve/reject UI wired to recommendation cards.
- WhatsApp: **build the mock adapter only** unless live Meta credentials are
  already provisioned and tested by hour 20. Live WhatsApp is P1, not P0.
- Generate demo data for all 3 merchant types (Kirana/Restaurant/Salon —
  arch §31) with enough history to actually trigger the rules engine's
  thresholds (trend, slow movers, stockout). Fake-looking flat data kills the demo.
- **Checkpoint:** the full 12-step golden path (arch §32) runs start to finish, twice, without a human fixing anything mid-run.

### Block 6 — Rehearsal & Hardening (Hours 30–36) — everyone
- Run the golden path 5+ times. Time it. Cut narration, not steps.
- Kill-switch check: LLM down, OCR down, WhatsApp down — does the rest still work? (arch §35 is your checklist, literally test each row.)
- Remove/hide any half-built screen from the demo nav so nobody clicks into a broken state live.
- Prepare 1 backup device/recording of the golden path in case of live-demo Wi-Fi failure.

---

## 3. Cut-list — cut in this order if you're behind schedule

1. **Live WhatsApp integration** → keep mock adapter, it demos identically.
2. **Real Paytm integration** → mock data only (arch §20 explicitly allows this — just label it "DEMO DATA" on screen, never claim it's live).
3. **Google Cloud Vision fallback OCR** → Tesseract-only is fine for printed bills.
4. **Chrome extension re-integration** → mention it's "kept, optional connector" in the narrative; don't demo it live unless Track A/B are already done early.
5. **Combo/offer recommendation type** → keep restock + anomaly only; still a full story.
6. **Multi-store per merchant** → single store per merchant for the demo.

Never cut: idempotent sale creation, inventory ledger (not a bare counter),
merchant isolation on every query, the LLM-never-calculates rule, and the
graceful-degradation fallback. These are exactly what separates this from "a
ChatGPT wrapper with a dashboard" — which is the one thing the architecture
doc explicitly says not to look like.

---

## 4. Judging narrative (keep this on an index card)

> "StoreSathi turns a photo of a bill into a running business: real
> inventory, real sales, real predictions — and the AI never invents a
> number, it explains numbers the backend already calculated."

Say this once, early, then let the golden path prove it.