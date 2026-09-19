# 📈 StoreSathi - Progress Tracker (Addendum)
*Note: The following progress has been made since the initial plan:*
- [x] **Database & Backend:** Replaced mock data with a Node.js API layer backed by an embedded DuckDB database. Implemented dynamic schema with real tables for users, products, opportunities, and campaigns.
- [x] **Intelligence & Fallbacks:** Deployed Gemini-Flash model via `@google/generative-ai` with an automated fallback to the `qwen3.8-27b` model via the `Groq` SDK when limits are hit.
- [x] **Automated Notifications & CRON:** Integrated a background job (`cronService.js`) to automatically run the intelligence engine, detect anomalies (including `low_stock`), and dispatch Email alerts via Nodemailer. Added a manual trigger endpoint for demo purposes.
- [x] **Security & Tenant Isolation:** Removed the unauthenticated store selector dropdown and replaced it with a dynamic, DuckDB-backed `Login.jsx` screen for the portal.
- [x] **Chrome Extension IPC:** Migrated extension communication to use direct `fetch` calls to the `localhost:3000` orchestration backend.
- [x] **Auto-Ingestion:** The plugin automatically ingests products into the merchant's portal database upon "Approve".
- [x] **Auto-Email Notifications:** Visiting a competitor website via the plugin automatically triggers a live AI alert and dispatches a Nodemailer Gmail notification.

# 📈 StoreSathi - Progress Tracker

Update this file as you go (check boxes, fill owner/status). Pair with `PLAN.md`.
Legend: ⬜ not started · 🟨 in progress · ✅ done · 🔺 blocked

---

## Block 1 — Foundation (Hours 0–6)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 1.2 | Repository/data-access layer over DuckDB | AI | ✅ | Done |
| 1.3 | Auth (email/password) + merchant/store context middleware | AI | ✅ | Done |
| 1.4 | Seed script skeleton (empty tables, ready for demo data later) | AI | ✅ | Done |
| **CP1** | **Checkpoint: authenticated request reads/writes a scoped row** | AI | ✅ | Done |

### Track A — Billing
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 2.A1 | Product search / catalogue CRUD | AI | ✅ | Done |
| 2.A2 | Create-sale flow: validate → transaction → sale_items | AI | ✅ | Done |
| 2.A3 | Inventory movement on sale + stock decrement | AI | ✅ | Done |
| 2.A4 | Idempotency key enforced on sale creation | AI | ✅ | Done |
| 2.A5 | Receipt generation (basic) | AI | ✅ | Done |
| **CP2** | **Checkpoint: manual sale → stock decrements correctly** | AI | ✅ | Done |

## Block 3 — Intelligence (Hours 14–20)
### Track C — Rules & Forecasting
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3.C1 | Low stock rule | AI | ✅ | Done — `rulesEngine.js` C1 |
| 3.C2 | Stockout risk rule (days_remaining calc) | AI | ✅ | Done — moving avg forecasting |
| 3.C3 | Slow-moving product rule | AI | ✅ | Done — `rulesEngine.js` C3 |
| 3.C4 | Sales anomaly detection | AI | ✅ | Done — spike/drop vs prior 7 days |
| 3.C5 | Growth opportunity rule | AI | ✅ | Done — rising sales campaign prompt |
| 3.C6 | Weather API rule (temperature/stock alert) | AI | ✅ | Done — live Open-Meteo API |
| 3.C7 | Trend Analysis rule | AI | ✅ | Done — Instagram trend simulation |
| 3.C8 | Forecasting: moving avg / day-of-week weighting | AI | ✅ | Done — avgDailySales forecast |

### Track D — Plugin UI
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 3.D1 | Login / onboarding screens | AI | ✅ | Done — Chrome Extension FAB + Sidebar |
| 3.D2 | Plugin Dashboard widget wired to real analytics APIs | AI | ✅ | Done — live analyze-page endpoint |
| **CP3** | **Checkpoint: dashboard shows real low-stock/anomaly cards from seeded data, no LLM involved** | AI | ✅ | Done |

## Block 4 — AI Copilot + Recommendations (Hours 20–26)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 4.1 | AIProvider abstraction (Gemini / Groq) | AI | ✅ | Done |
| 4.2 | Bounded context builder (profile, catalogue, recent aggregates, anomalies) | AI | ✅ | Done |
| 4.3 | Copilot chat endpoint + UI | AI | ✅ | Done (Portal & Plugin) |
| 4.4 | Recommendation object generation (evidence from backend, not LLM) | AI | ✅ | Done |
| 4.5 | Guardrail post-processing (no fabricated metrics/guarantees) | AI | ✅ | Done |
| 4.6 | Fallback: LLM-down path shows deterministic facts only | AI | ✅ | Done (Gemini -> Groq -> RulesEngine) |
| **CP4** | **Checkpoint: copilot answers a real question with real numbers; pulling the API key degrades gracefully** | AI | ✅ | Done |

## Block 5 — Actions + Demo Data (Hours 26–30)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 5.1 | Action state machine (Email fallback gateway) | AI | ✅ | Done |
| 5.2 | Approve/Reject UI on recommendation cards (Triggers auto-ingestion) | AI | ✅ | Done (Glassmorphic Plugin) |
| 5.3 | Action history screen | AI | ✅ | Done (Portal) |
| 5.4 | Automatic Gmail Notifications | AI | ✅ | Done (Triggers on competitor visits) |
| 5.5 | Demo data: Fashion Store merchant | AI | ✅ | Done |
| **CP5** | **Checkpoint: Communications & Action Triggers working** | AI | ✅ | Done |

## Block 6 — Rehearsal & Hardening (Hours 30–36)
| # | Task | Owner | Status | Notes |
|---|---|---|---|---|
| 6.1 | Golden path run #1 — timed | USER | 🟨 | Ready for User |
| 6.2 | Golden path run #2–5 — timed, refine narration | USER | 🟨 | Ready for User |
| 6.3 | Kill-switch test: LLM down | AI | ✅ | Passes with Groq Fallback |
| 6.5 | Kill-switch test: Email down | AI | ✅ | Database logs handle failure |
| 6.6 | Kill-switch test: Mock data path | AI | ✅ | Passes |
| 6.7 | Hide/remove unfinished screens from nav | AI | ✅ | Done |
| 6.8 | Backup recording of golden path | USER | 🟨 | Ready for User |

---

## Cut-list status (mark if cut)
- [x] Live WhatsApp (kept mock/email only)
- [x] Real Paytm integration (kept mock only)
- [ ] Chrome extension live demo (ACTIVELY USED)
- [x] Combo/offer recommendation type
- [x] Multi-store per merchant (Tenant isolated)

## Overall status
- Current block: **Block 6 - Rehearsal & Hardening**
- Biggest risk right now: None, Golden Path is fully functional.
- Golden path last successful run: **2026-09-19**