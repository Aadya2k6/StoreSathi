# StoreSathi — Progress Tracker

Update this file as you go (check boxes, fill owner/status). Pair with `PLAN.md`.
Legend: ⬜ not started · 🟨 in progress · ✅ done · 🔺 blocked

---

## Block 1 — Foundation (Hours 0–6)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1.1 | Freeze DB schema (merchant, store, user, product, inventory_movement, sale, sale_item, ocr_document, recommendation, action, daily_metric) | | ⬜ | |
| 1.2 | Repository/data-access layer over DuckDB | | ⬜ | |
| 1.3 | Auth (email/password) + merchant/store context middleware | | ⬜ | |
| 1.4 | Seed script skeleton (empty tables, ready for demo data later) | | ⬜ | |
| **CP1** | **Checkpoint: authenticated request reads/writes a scoped row** | | ⬜ | |

## Block 2 — Billing + OCR (Hours 6–14)
### Track A — Billing
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2.A1 | Product search / catalogue CRUD | | ⬜ | |
| 2.A2 | Create-sale flow: validate → transaction → sale_items | | ⬜ | |
| 2.A3 | Inventory movement on sale + stock decrement | | ⬜ | |
| 2.A4 | Idempotency key enforced on sale creation | | ⬜ | |
| 2.A5 | Receipt generation (basic) | | ⬜ | |

### Track B — OCR
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2.B1 | Upload endpoint + file validation | | ⬜ | |
| 2.B2 | Preprocessing (resize/grayscale/contrast) | | ⬜ | |
| 2.B3 | Tesseract integration | | ⬜ | |
| 2.B4 | Document parser → structured candidate JSON | | ⬜ | |
| 2.B5 | Confidence scoring | | ⬜ | |
| 2.B6 | Review UI (merchant confirms/edits before commit) | | ⬜ | |
| 2.B7 | Commit confirmed OCR → catalogue/sale | | ⬜ | |
| **CP2** | **Checkpoint: photographed bill → real catalogue rows; manual sale → stock decrements correctly** | | ⬜ | |

## Block 3 — Intelligence (Hours 14–20)
### Track C — Rules & Forecasting
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3.C1 | Low stock rule | | ⬜ | |
| 3.C2 | Stockout risk rule (days_remaining calc) | | ⬜ | |
| 3.C3 | Slow-moving product rule | | ⬜ | |
| 3.C4 | Sales anomaly detection | | ⬜ | |
| 3.C5 | Growth opportunity rule | | ⬜ | |
| 3.C6 | Forecasting: moving avg / day-of-week weighting | | ⬜ | |

### Track D — Frontend Shell
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3.D1 | Login / onboarding screens | | ⬜ | |
| 3.D2 | Dashboard screen wired to real analytics APIs | | ⬜ | |
| 3.D3 | Billing / New Sale screen | | ⬜ | |
| 3.D4 | OCR upload + review screen | | ⬜ | |
| 3.D5 | Inventory screen | | ⬜ | |
| **CP3** | **Checkpoint: dashboard shows real low-stock/anomaly cards from seeded data, no LLM involved** | | ⬜ | |

## Block 4 — AI Copilot + Recommendations (Hours 20–26)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 4.1 | AIProvider abstraction (OpenAIProvider impl) | | ⬜ | |
| 4.2 | Bounded context builder (profile, catalogue, recent aggregates, anomalies) | | ⬜ | |
| 4.3 | Copilot chat endpoint + UI | | ⬜ | |
| 4.4 | Recommendation object generation (evidence from backend, not LLM) | | ⬜ | |
| 4.5 | Guardrail post-processing (no fabricated metrics/guarantees) | | ⬜ | |
| 4.6 | Fallback: LLM-down path shows deterministic facts only | | ⬜ | |
| **CP4** | **Checkpoint: copilot answers a real question with real numbers; pulling the API key degrades gracefully** | | ⬜ | |

## Block 5 — Actions + Demo Data (Hours 26–30)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 5.1 | Action state machine (detected→...→verified) | | ⬜ | |
| 5.2 | Approve/Reject UI on recommendation cards | | ⬜ | |
| 5.3 | Action history screen | | ⬜ | |
| 5.4 | WhatsApp mock adapter (live only if credentials ready by hr 20) | | ⬜ | |
| 5.5 | Demo data: Kirana merchant, full history | | ⬜ | |
| 5.6 | Demo data: Restaurant merchant, full history | | ⬜ | |
| 5.7 | Demo data: Salon merchant, full history | | ⬜ | |
| **CP5** | **Checkpoint: full 12-step golden path runs twice, no manual fixes mid-run** | | ⬜ | |

## Block 6 — Rehearsal & Hardening (Hours 30–36)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 6.1 | Golden path run #1 — timed | | ⬜ | |
| 6.2 | Golden path run #2–5 — timed, refine narration | | ⬜ | |
| 6.3 | Kill-switch test: LLM down | | ⬜ | |
| 6.4 | Kill-switch test: OCR down | | ⬜ | |
| 6.5 | Kill-switch test: WhatsApp down | | ⬜ | |
| 6.6 | Kill-switch test: Paytm/mock data path | | ⬜ | |
| 6.7 | Hide/remove unfinished screens from nav | | ⬜ | |
| 6.8 | Backup recording of golden path | | ⬜ | |

---

## Cut-list status (mark if cut)
- [ ] Live WhatsApp (kept mock only)
- [ ] Real Paytm integration (kept mock only)
- [ ] Cloud Vision OCR fallback
- [ ] Chrome extension live demo
- [ ] Combo/offer recommendation type
- [ ] Multi-store per merchant

## Overall status
- Current block: ______
- Biggest risk right now: ______
- Golden path last successful run: ______