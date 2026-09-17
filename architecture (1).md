# StoreSathi — Architecture

Track 1 · Merchant Growth AI · Team pink_code

## 1. Overview

StoreSathi is a two-sided system:

1. **Command Center Portal** — a React web dashboard where a merchant sees flagged opportunities (underpriced items, response gaps, slow-moving stock) and can approve or configure actions.
2. **Universal Browser Extension** — a Chrome extension that reads store data directly off any storefront page (custom sites, Shopify, WooCommerce) with zero integration, so the system works even for merchants with no centralized dashboard.

Both feed a shared backend that identifies opportunities, drafts plain-language suggestions, and executes approved actions — with **WhatsApp** as the primary interaction and approval channel, since that's where Indian merchants already live.

The core product loop is: **Integrate → Identify → Explain → Execute.**

## 2. Component Map

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Browser Extension   │        │   Command Center Portal   │
│  (Chrome, JS/DOM)     │        │   (React, glassmorphism)  │
│  - Scrapes listings,  │        │   - Merchant dashboard     │
│    prices, reviews    │        │   - Opportunity feed       │
│  - Zero setup         │        │   - Action approvals       │
└──────────┬───────────┘        └───────────┬───────────────┘
           │  POST /ingest                   │  REST/WS
           ▼                                 ▼
┌─────────────────────────────────────────────────────────┐
│                Backend Orchestration (Node.js)            │
│  - Ingestion API        - Opportunity engine               │
│  - Auth & merchant mgmt - Suggestion drafting (LLM)         │
│  - Webhooks              - Action execution / state machine │
└───────────┬───────────────────────┬───────────────────────┘
            │                       │
            ▼                       ▼
   ┌────────────────┐     ┌───────────────────────┐
   │  Data Engine     │     │  Messaging Layer        │
   │  DuckDB          │     │  Meta WhatsApp Cloud API │
   │  local-first,     │     │  Interactive one-tap     │
   │  private storage  │     │  approval buttons         │
   └────────────────┘     └───────────────────────┘
```

## 3. Components in Detail

### 3.1 Browser Extension (Universal Fallback)
- **Purpose:** Read store data off the page for merchants who have no API/integration.
- **Tech:** JavaScript, Chrome Extension (Manifest V3), content scripts + DOM parsing.
- **Responsibilities:**
  - Detect page type (product listing, product detail, reviews section).
  - Extract structured fields: product name, price, stock/availability signal, review text/rating, response time signals where visible.
  - Normalize into a common schema regardless of source platform.
  - Send periodic/triggered snapshots to the backend ingestion endpoint.
  - No credentials or write-access to the merchant's store — read-only observation.
- **Design constraint:** must degrade gracefully on unfamiliar page structures (heuristic + fallback selectors, not hard-coded per-platform scraping only).

### 3.2 Command Center Portal (Frontend Dashboard)
- **Tech:** React (web app).
- **Visual direction:** light theme, pastel palette, glassmorphism (soft translucent cards, subtle blur, rounded corners) — see Section 6.
- **Core screens:**
  - **Overview:** health snapshot — sales trend, flagged opportunity count, pending approvals.
  - **Opportunities feed:** cards per opportunity (underpriced item, slow-moving stock, response gap) with plain-language explanation and a suggested action.
  - **Action history/log:** what was suggested, what was approved, what was executed, outcome.
  - **Settings:** connect extension, WhatsApp number linking, plan tier (Free / Premium).
- **Role:** oversight and configuration — the deep-dive companion to the WhatsApp one-tap flow, not the primary action surface.

### 3.3 Backend Orchestration (Node.js)
- **Responsibilities:**
  - **Ingestion API** — receives extension snapshots and (optionally) direct store data.
  - **Opportunity Engine** — rules + heuristics (and optionally an LLM pass) over ingested data to detect: underpriced items (vs. category/competitor signal), response gaps (unanswered reviews/messages), slow-moving stock (no sales velocity over a window).
  - **Suggestion Drafting** — turns a detected opportunity into a plain-language explanation and a concrete drafted action (e.g., "Drop price of X by 8% — similar items are outselling it at this price").
  - **Action/State Machine** — tracks each opportunity through states: `detected → drafted → sent_for_approval → approved/rejected → executed → verified`.
  - **Webhooks** — inbound from WhatsApp (button taps), outbound to trigger messaging.
  - **Auth & merchant management** — merchant accounts, plan tier, linked extension/WhatsApp identity.

### 3.4 Data Engine (DuckDB)
- **Why DuckDB:** efficient local-first/embedded analytical storage — no heavy server-side DB ops needed for a hackathon-scale merchant dataset, and keeps merchant data private/local rather than shipping it to a heavy external warehouse.
- **Stores:**
  - Raw ingested snapshots (listings, prices, reviews) with timestamps.
  - Derived opportunity records and their state history.
  - Aggregated metrics for the dashboard (sales trend, price position, review velocity).

### 3.5 Messaging Layer (Meta WhatsApp Cloud API)
- **Purpose:** the primary action surface. Sends the plain-language suggestion with an **interactive one-tap approval button**.
- **Flow:** backend drafts action → sends WhatsApp template/interactive message → merchant taps Approve/Reject → webhook fires → backend executes (or discards) the action → confirmation message sent back.

### 3.6 Command Center as integration hub
The portal doesn't just visualize — it ties dashboard, extension, and messaging into one merchant identity so the same opportunity is consistent whether the merchant looks at WhatsApp or the dashboard.

## 4. Data Flow (End-to-End)

1. Extension reads a store page → sends normalized snapshot to `/ingest`.
2. Backend stores raw snapshot in DuckDB.
3. Opportunity Engine runs (on ingest or on schedule) → detects candidate opportunities.
4. Suggestion Drafting turns each opportunity into plain language + a concrete action payload.
5. Action queued → WhatsApp message sent with one-tap buttons.
6. Merchant taps **Approve** → webhook → backend executes action (e.g., calls extension to relist/update, or just logs a merchant-side manual step if direct write isn't possible) → state updated → confirmation sent.
7. Dashboard reflects updated state in the opportunity feed / action log in real time.

## 5. Execution Model — What "Execute" Actually Means

Because the extension is read-only by design (see 3.1), "execution" has two tiers, to be decided explicitly per opportunity type rather than assumed:
- **Tier A — Draft & Guide:** backend drafts the message/listing text; merchant approves via WhatsApp; extension/portal shows merchant exactly what to paste/change (for platforms without write access).
- **Tier B — Direct Execute:** for platforms where the extension (or a partnered API, e.g. Shopify/WooCommerce) has write permission, the approved action is applied automatically.

This distinction should be made explicit in Phase 2 of the plan — don't silently assume every action is auto-executable.

## 6. Frontend Design System (Light, Pastel Theme)

Light theme only, no dark mode, glassmorphism-friendly.

**Palette**
| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#FAF7FB` | App background (soft lavender-white) |
| `--surface-glass` | `rgba(255,255,255,0.55)` | Glass cards (with backdrop-blur) |
| `--primary` | `#B39DDB` | Primary actions, active states (soft lavender) |
| `--primary-deep` | `#8E7CC3` | Primary hover/pressed |
| `--accent-mint` | `#A8E6CF` | Positive signals (growth, approved) |
| `--accent-peach` | `#FFD3B4` | Warnings, "needs attention" |
| `--accent-pink` | `#FFB6C1` | Highlights, WhatsApp CTA accents |
| `--text-primary` | `#3A3550` | Headings, body text |
| `--text-muted` | `#7A748F` | Secondary text |
| `--border-glass` | `rgba(255,255,255,0.6)` | Card borders |

**Typography:** a clean geometric sans (e.g., Inter or Poppins) — friendly, rounded letterforms suit the "business partner" tone rather than a cold enterprise-dashboard feel.

**Component language:**
- Cards: translucent white glass, `backdrop-filter: blur(12px)`, soft shadow, 16–20px radius.
- Buttons: pill-shaped, primary lavender fill, soft pastel hover glow.
- Status chips: mint (good), peach (attention), pink (action needed) — never harsh red/green.
- Charts: soft pastel gradient fills, rounded bar caps, no harsh gridlines.

## 7. Non-Functional Notes
- **Privacy:** merchant store data processed locally-first via DuckDB where possible; only what's needed for suggestions leaves the boundary.
- **Reliability:** WhatsApp webhook handling must be idempotent (merchant may double-tap).
- **Extensibility:** opportunity engine should be rule-pluggable so new opportunity types (e.g., new pricing signals) can be added without rewriting the pipeline.

## 8. Open Design Decisions (resolve early in Phase 1)
- Exact schema for "normalized listing snapshot" from the extension.
- Whether opportunity detection is pure heuristic/rules or LLM-assisted for v1.
- Which store platforms get Tier B (direct execute) vs Tier A (draft & guide) in the hackathon build.
- WhatsApp Business number provisioning/sandbox setup timeline (Meta approval lead time).
