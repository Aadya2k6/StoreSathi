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
# StoreSathi — Architecture v2

**Track:** Merchant Growth AI  
**Team:** pink_code  
**Purpose:** AI Business Partner for Paytm merchants

> **Architecture goal:** Turn everyday merchant activity into a continuous loop of **Capture → Understand → Predict → Recommend → Act → Learn**.

---

## 0. What changed from the old architecture

The original StoreSathi architecture had a strong foundation: a React Command Center, a Chrome extension, a Node.js backend, DuckDB, an opportunity engine, an action state machine, and WhatsApp approvals.

The main problem was product alignment: the original center of gravity was **online storefront observation**. The new center of gravity is **the merchant's complete business**.

### Keep

- React merchant dashboard / Command Center
- Node.js backend
- DuckDB for hackathon-scale analytics
- Opportunity/rules engine
- LLM suggestion drafting
- Action state machine
- WhatsApp approval workflow
- Chrome extension
- Existing online-store scraping capability

### Add

- Merchant accounts and strict `merchant_id` isolation
- Merchant onboarding
- Product catalogue
- In-app billing / POS-like sale entry
- Receipt/invoice generation
- Bill/invoice OCR
- OCR review and correction step
- Sales ledger
- Inventory ledger
- Customer/transaction aggregates
- AI Business Partner / copilot
- Proactive daily insights
- Inventory forecasting
- Growth/offer recommendations
- Action center
- Optional Paytm integration adapter
- Optional cloud OCR provider
- Provider abstraction for AI/OCR so the system is not tied to one vendor

### Reposition

The Chrome extension is **not removed**.

It becomes an **optional connector** for online merchants. It is no longer the primary source of merchant data.

### New product story

```text
OLD

Store Website
    ↓
Chrome Extension
    ↓
Scrape
    ↓
Opportunity
    ↓
WhatsApp


NEW

Merchant
  ├── Create Sale / Bill
  ├── Upload Existing Bill
  ├── Upload Inventory Sheet
  ├── Optional Paytm Data
  └── Optional Chrome Extension
              ↓
       Merchant Data Layer
              ↓
       Sales + Inventory Engine
              ↓
        Intelligence Layer
              ↓
        AI Business Partner
              ↓
     Recommendation / Action
              ↓
        Merchant Approval
              ↓
          Outcome
              ↓
       Learning / Re-analysis
```

---

# 1. Product Definition

StoreSathi is a merchant-specific AI business partner.

It should not feel like:

> "ChatGPT + a dashboard + OCR."

It should feel like:

> "My store already has an assistant that understands my sales, stock and customers and tells me what I should do next."

The system should answer four questions continuously:

1. **What happened?**
2. **Why did it happen?**
3. **What is likely to happen next?**
4. **What should I do about it?**

The AI must be grounded in the merchant's actual structured data. It should never invent sales, inventory, prices or transaction facts.

---

# 2. Primary User

The primary user is an Indian small-business merchant:

- Kirana / general store
- Restaurant / cafe
- Salon
- Clothing / retail store
- Electronics shop
- Pharmacy
- Other small retail/service businesses

The architecture is merchant-type agnostic.

A merchant can have:

- one account
- one or more stores
- one catalogue
- sales transactions
- inventory
- customers/aggregates
- AI insights
- recommendations
- actions
- optional connected channels

Every business object must be scoped to a store/merchant.

---

# 3. Core Product Loop

## 3.1 Capture

Data can enter through:

1. **Create Sale** in StoreSathi
2. **Upload bill/receipt image**
3. **Upload inventory sheet**
4. **Optional Paytm integration**
5. **Chrome extension** for online storefronts
6. **Manual product/inventory entry**
7. Future POS/import integrations

## 3.2 Understand

Normalize raw inputs into:

- products
- categories
- prices
- quantities
- sales
- revenue
- payment method
- inventory movements
- customer/transaction aggregates

## 3.3 Predict

Calculate:

- stockout risk
- expected sales
- sales trend
- unusual drops/spikes
- slow-moving products
- high-growth products
- demand patterns
- peak hours/days
- reorder suggestions

## 3.4 Recommend

Generate actionable suggestions:

- restock
- reduce/adjust inventory
- create a combo
- create an offer
- change timing of an offer
- focus on a high-performing product
- investigate a sales drop
- identify slow-moving stock
- follow up on customer feedback
- prepare for expected demand

## 3.5 Act

The merchant can:

- approve
- reject
- edit
- create a bill
- create an offer
- mark inventory received
- follow a restock recommendation
- send/approve a WhatsApp action

## 3.6 Learn

After the action:

- record the action
- record its outcome when available
- compare before/after metrics
- feed outcome back into future recommendations

---

# 4. High-Level Architecture

```text
                           ┌──────────────────────────┐
                           │       MERCHANT            │
                           │  Web / Mobile Browser     │
                           └────────────┬─────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
                 ▼                      ▼                      ▼
        ┌────────────────┐     ┌────────────────┐    ┌─────────────────┐
        │ Command Center │     │ Billing / POS  │    │ OCR Upload      │
        │ React Web App  │     │ Create Sale    │    │ Bill / Sheet    │
        └───────┬────────┘     └───────┬────────┘    └────────┬────────┘
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       ▼
                           ┌────────────────────────┐
                           │      API / BACKEND     │
                           │       Node.js          │
                           ├────────────────────────┤
                           │ Auth / Merchant Mgmt   │
                           │ Ingestion              │
                           │ Billing                │
                           │ Inventory              │
                           │ OCR Orchestration      │
                           │ AI Orchestration       │
                           │ Recommendations        │
                           │ Actions / State Machine│
                           │ Webhooks               │
                           └───────────┬────────────┘
                                       │
             ┌─────────────────────────┼─────────────────────────┐
             │                         │                         │
             ▼                         ▼                         ▼
   ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
   │ Merchant Data    │     │ Intelligence     │     │ External         │
   │ Layer            │     │ Layer            │     │ Integrations     │
   ├──────────────────┤     ├──────────────────┤     ├──────────────────┤
   │ Products         │     │ Rules Engine     │     │ Paytm Adapter    │
   │ Sales            │     │ Analytics        │     │ WhatsApp         │
   │ Inventory        │     │ Forecasting      │     │ Chrome Extension │
   │ Customers/Aggr.  │     │ LLM              │     │ OCR Provider     │
   │ Actions          │     │ Recommendation   │     │                  │
   │ OCR documents    │     │ Engine           │     │                  │
   └────────┬─────────┘     └────────┬─────────┘     └──────────────────┘
            │                        │
            └──────────────┬─────────┘
                           ▼
                  ┌─────────────────────┐
                  │ AI BUSINESS PARTNER │
                  │ Insights + Actions  │
                  └──────────┬──────────┘
                             ▼
                    Merchant sees:
              "Here's what happened.
               Here's why.
               Here's what to do."
```

---

# 5. Frontend Architecture

## 5.1 Technology

- React
- Existing frontend stack can be retained
- React Router
- Query/cache layer such as TanStack Query
- Charting library
- Existing light pastel/glassmorphism design system

The frontend must not contain provider secrets.

---

# 6. Core Screens

Do not build dozens of screens. The hackathon MVP should have a small number of connected screens.

## 6.1 Login / Merchant Entry

Fields:

- phone/email
- password or OTP-style login
- merchant/store selection after authentication

For the prototype, normal email/password authentication is sufficient.

---

## 6.2 Onboarding

```text
Welcome to StoreSathi

What kind of business do you run?

[ Kirana ]
[ Restaurant ]
[ Salon ]
[ Retail ]
[ Other ]

        ↓

Set up your business

[ Scan a bill ]
[ Scan inventory ]
[ Import data ]
[ Add products manually ]
```

The onboarding should minimize typing.

---

## 6.3 Dashboard

Show:

- today's sales
- today's transaction count
- average order value
- weekly sales
- change vs previous comparable period
- low-stock items
- stockout risks
- slow-moving products
- top products
- AI recommendations

Example:

```text
Good morning, Rajesh 👋

₹18,420             96
Today's sales       Transactions

AI noticed 3 things

⚠ Milk may run out tomorrow
📈 Evening sales are 18% stronger
🐢 4 products have been slow this week

[View recommendations]
```

---

## 6.4 Billing / New Sale

This is one of the most important additions.

```text
NEW SALE

Search product
--------------------------------
Milk                 ₹50    [ + ]
Bread                ₹40    [ + ]
Biscuits             ₹10    [ + ]

Cart
Milk × 2                    ₹100
Bread × 1                    ₹40

TOTAL                       ₹140

Payment:
( ) Paytm
( ) Cash
( ) UPI
( ) Other

[CREATE BILL]
```

When a sale is completed:

1. create transaction
2. create transaction line items
3. decrement inventory
4. update aggregates
5. trigger intelligence jobs if needed
6. optionally generate/share a receipt

This removes the need for the merchant to separately update inventory.

---

## 6.5 OCR Import

Two primary use cases:

### A. Existing bill

```text
Upload bill/photo
       ↓
OCR
       ↓
Extracted fields
       ↓
Merchant review
       ↓
Confirm
       ↓
Transaction / inventory update
```

### B. Inventory/product sheet

```text
Upload image
       ↓
OCR
       ↓
Product + price + quantity extraction
       ↓
Merchant review
       ↓
Create/update catalogue
```

Never automatically commit uncertain OCR output.

---

## 6.6 Inventory

Show:

- current stock
- low stock
- stockout risk
- average daily sales
- estimated days remaining
- recent movement
- suggested reorder quantity

Example:

```text
Milk       8 left     ⚠
Bread     21 left     ✓
Rice      42 left     ✓
Biscuits   6 left     ⚠

AI:
"Milk may run out tomorrow evening."

[See restock suggestion]
```

---

## 6.7 AI Business Partner

Hero screen.

```text
StoreSathi AI

Ask:
"Why were my sales lower yesterday?"

AI:
"Sales were 9% below your usual Wednesday.

The largest drop was between 2 PM–5 PM.
Snacks also sold 17% less than normal.

I can investigate category and time patterns."

[Investigate]
```

The AI should also provide proactive cards without being asked.

---

## 6.8 Recommendations / Actions

Every recommendation should explain:

1. observation
2. reason
3. suggested action
4. expected/possible impact
5. confidence
6. supporting data
7. action button

Example:

```text
RESTOCK RECOMMENDATION

Milk is selling faster than usual.

Current stock: 8
Average daily sales: 11
Estimated stockout: tomorrow

Suggested action:
Order 25 units.

[Approve] [Edit] [Ignore]
```

Avoid unsupported claims such as guaranteed revenue increases.

---

## 6.9 Action History

Show:

- recommendation
- timestamp
- merchant decision
- execution status
- outcome if measurable

States:

```text
detected
→ drafted
→ awaiting_approval
→ approved / rejected
→ executed
→ verified
```

---

# 7. Billing and Transaction Engine

The billing system is not just a convenience feature.

It becomes the cleanest structured source of truth for sales.

## 7.1 Sale flow

```text
Merchant creates sale
        ↓
Validate product + price + quantity
        ↓
Create transaction
        ↓
Create transaction items
        ↓
Create inventory movement
        ↓
Update stock
        ↓
Update analytics
        ↓
Generate receipt
        ↓
Trigger AI/rules
```

## 7.2 Important invariant

A completed sale must not update inventory twice.

Use an idempotency key for sale creation.

Example:

```text
sale_id = UUID
idempotency_key = client_generated_unique_value
```

If the same request arrives twice, return the original sale rather than creating another one.

---

# 8. OCR Architecture

## 8.1 GPU requirement

**No GPU is required.**

OCR and AI are designed to run through CPU-friendly libraries and/or external APIs.

## 8.2 Provider abstraction

Create:

```text
interface OCRProvider {
  extractText(document): OCRResult
}
```

Providers:

```text
LocalTesseractProvider
CloudVisionProvider (optional)
```

This lets the hackathon build work without a paid OCR service.

## 8.3 Recommended hackathon strategy

### Default

**Tesseract OCR**

- local
- CPU
- no API key
- no GPU
- free/open-source

### Simplest alternative — Manual/CSV entry (no OCR at all)

If OCR setup risks eating build time, **skip OCR entirely** and let the same
"Upload bill" / "Upload inventory sheet" screens accept:

- a manual line-item entry form (product, qty, price), or
- a CSV/paste-text box that goes straight into the same document parser step (§8.4) that OCR would have fed.

This satisfies the same product contract — "raw input → structured candidate
data → merchant review → commit" — without depending on OCR being installed
or accurate on stage. It becomes the **P0 fallback path**; Tesseract becomes
an enhancement on top of it, not a dependency the demo requires.

### Optional higher-accuracy fallback

**Google Cloud Vision**

Useful when the image is difficult or the local OCR result is poor. Cloud Vision supports `TEXT_DETECTION` and `DOCUMENT_TEXT_DETECTION`; Google documents API-key and application/service-account authentication options.

## 8.4 OCR pipeline

```text
Image/PDF
   ↓
Validate file
   ↓
Preprocess
   ├─ resize
   ├─ grayscale
   ├─ contrast
   ├─ crop/deskew where possible
   └─ orientation detection
   ↓
OCR
   ↓
Raw text + bounding boxes
   ↓
Document parser
   ↓
Structured candidate data
   ↓
Confidence checks
   ↓
Merchant review
   ↓
Commit
```

## 8.5 Structured OCR output

```json
{
  "document_type": "purchase_bill",
  "merchant_name": "Example Store",
  "date": "2026-09-18",
  "items": [
    {
      "name": "Milk",
      "quantity": 2,
      "unit_price": 50,
      "total": 100,
      "confidence": 0.94
    }
  ],
  "subtotal": 100,
  "tax": 0,
  "total": 100,
  "confidence": 0.91
}
```

The parser should never silently convert uncertain text into a financial transaction.

---

# 9. AI Architecture

## 9.1 No local GPU model

Do not design around local model inference.

Use external AI APIs for language/vision tasks.

## 9.2 LLM provider abstraction

```text
interface AIProvider {
  generateInsight(context): Insight
  answerBusinessQuestion(context, question): Answer
  createRecommendation(context): Recommendation
  extractStructuredData(input): StructuredData
}
```

Primary implementation:

```text
OpenAIProvider
```

A second provider can be added later without changing business logic.

## 9.3 AI must not be the calculator

Do not ask the LLM:

> "Calculate my weekly sales."

The backend should calculate it.

Correct:

```text
Database
   ↓
SQL / analytics
   ↓
Structured facts
   ↓
LLM
   ↓
Explanation + recommendation
```

This reduces hallucinations.

## 9.4 AI context

For each merchant question, construct a bounded context:

```text
Merchant profile
Business type
Current catalogue
Recent sales aggregates
Inventory status
Recent anomalies
Relevant recommendations
Relevant historical metrics
```

Do not dump the entire database into the prompt.

---

# 10. Intelligence Layer

The intelligence layer should be mostly deterministic.

## 10.1 Rules engine

Examples:

### Low stock

```text
if current_stock <= reorder_threshold
    → low_stock
```

### Stockout risk

```text
days_remaining =
    current_stock / max(avg_daily_units_sold, 0.1)

if days_remaining <= threshold
    → stockout_risk
```

### Slow-moving product

```text
if units_sold_recently << historical_baseline
    → slow_moving
```

### Sales anomaly

```text
if current_period_sales deviates materially
from comparable historical period
    → sales_anomaly
```

### Growth opportunity

```text
if product/category growth is sustained
and inventory can support demand
    → growth_opportunity
```

Thresholds should be configurable by merchant type.

---

# 11. Forecasting

Do not require a GPU.

For the hackathon, use lightweight statistical methods:

- moving averages
- weighted moving averages
- exponential smoothing
- day-of-week averages
- rolling sales velocity
- simple trend calculations

Example:

```text
expected_daily_sales =
weighted_average(last_7_days, last_14_days, same_weekday_history)
```

Later, a more advanced forecasting service can replace this without changing the API.

---

# 12. Customer Intelligence

Do not require storing unnecessary personally identifiable information.

Prefer transaction-level aggregates where possible:

- repeat purchase rate
- average order value
- purchase frequency
- popular product combinations
- peak transaction periods
- returning-customer share

If customer identity is available and needed:

```text
customer_id
store_id
```

must always be tenant-scoped.

The AI should be able to answer:

- "What do my customers buy together?"
- "When do repeat customers usually come?"
- "Which products bring larger baskets?"

---

# 13. Product Catalogue

Minimum product fields:

```text
product_id
store_id
name
category
sku (optional)
selling_price
cost_price (optional)
current_stock
reorder_level
unit
active
created_at
updated_at
```

Optional later:

- supplier
- barcode
- tax rate
- purchase price history
- expiry date
- batch number

Do not build complex procurement management for the hackathon unless time remains.

---

# 14. Inventory Ledger

Do not store only a mutable `stock = 37` value.

Maintain movements:

```text
inventory_movement
------------------
id
store_id
product_id
type
quantity
reference_type
reference_id
created_at
```

Movement types:

```text
OPENING_BALANCE
SALE
PURCHASE
RESTOCK
ADJUSTMENT
RETURN
DAMAGE
```

Current stock can then be derived or safely maintained from these movements.

This gives the system an audit trail.

---

# 15. Sales Data Model

Core tables/entities:

```text
merchant
store
user
product
inventory_movement
sale
sale_item
customer
ocr_document
ocr_extraction
recommendation
action
action_event
daily_metric
integration
```

## 15.1 Merchant isolation

Every merchant-owned table must contain either:

```text
merchant_id
```

or:

```text
store_id → merchant_id
```

Never trust a client-supplied merchant ID without deriving/validating it from the authenticated session.

---

# 16. Data Storage

## Hackathon

Retain the existing **DuckDB** approach for analytical/demo data.

DuckDB remains useful because the original architecture deliberately chose it for local-first analytical storage.

However, structure the code behind a repository/data-access layer.

```text
Repository
    ↓
DuckDB (hackathon)
```

## Production path

```text
Repository
    ↓
PostgreSQL / managed database
```

This keeps the application code from being tightly coupled to DuckDB.

For a real multi-million-merchant system, do not use a single local DuckDB file as the primary shared transactional database.

---

# 17. Recommended Backend Modules

```text
backend/
├── auth/
├── merchants/
├── stores/
├── products/
├── billing/
├── inventory/
├── sales/
├── ocr/
├── analytics/
├── intelligence/
├── copilot/
├── recommendations/
├── actions/
├── integrations/
│   ├── paytm/
│   ├── whatsapp/
│   └── browser-extension/
├── jobs/
├── webhooks/
├── repositories/
└── shared/
```

---

# 18. API Surface

## Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Merchant/store

```http
GET  /api/store
PATCH /api/store
GET  /api/store/settings
```

## Products

```http
GET    /api/products
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

## Billing

```http
POST /api/sales
GET  /api/sales
GET  /api/sales/:id
POST /api/sales/:id/receipt
```

## Inventory

```http
GET  /api/inventory
POST /api/inventory/movements
GET  /api/inventory/risks
POST /api/inventory/restock-suggestion/:productId
```

## OCR

```http
POST /api/ocr/upload
GET  /api/ocr/:documentId
POST /api/ocr/:documentId/confirm
POST /api/ocr/:documentId/reject
```

## AI

```http
POST /api/copilot/chat
GET  /api/insights
GET  /api/recommendations
POST /api/recommendations/:id/approve
POST /api/recommendations/:id/reject
```

## Integrations

```http
POST /api/integrations/whatsapp/connect
POST /api/integrations/paytm/connect
POST /api/integrations/extension/ingest
```

## Webhooks

```http
POST /api/webhooks/whatsapp
POST /api/webhooks/paytm
```

Exact Paytm endpoints/authentication must be implemented only after the specific Paytm merchant API/product access available to the team is confirmed. Do not invent a Paytm API contract.

---

# 19. Chrome Extension — Keep, But Demote

The extension remains valuable for:

- Shopify merchants
- WooCommerce merchants
- custom online stores
- merchants without an accessible API
- competitive/product-page signals

Its role changes from:

> Primary data source

to:

> Optional connector.

Existing capabilities to preserve:

- Manifest V3
- content scripts
- DOM parsing
- product listing extraction
- prices
- stock/availability signals
- review text/rating
- normalized snapshot
- read-only operation

New relationship:

```text
Online merchant
      ↓
Chrome Extension
      ↓
Normalized ingestion
      ↓
Merchant Data Layer
      ↓
Same AI engine
```

The AI experience should be identical regardless of where data originated.

---

# 20. Paytm Integration

Paytm data should be treated as an integration adapter.

```text
PaytmAdapter
     ↓
NormalizedTransaction
     ↓
Sales Engine
```

Do not make the entire application depend directly on Paytm-specific fields.

The adapter should eventually handle:

- transaction ingestion
- payment status
- settlement-related data where permitted
- merchant identity mapping
- webhook events where available

For the hackathon, use mock Paytm transaction data if actual merchant API access is unavailable.

The demo must clearly distinguish:

```text
REAL INTEGRATION
vs
DEMO / MOCK DATA
```

Do not claim a live Paytm integration if the team has not actually connected one.

---

# 21. WhatsApp Integration

Retain WhatsApp as an important action channel.

Flow:

```text
AI detects opportunity
       ↓
Recommendation created
       ↓
WhatsApp message
       ↓
[Approve] [Reject]
       ↓
Webhook
       ↓
Action state machine
       ↓
Dashboard updated
```

Important:

- webhook processing must be idempotent
- verify webhook authenticity according to provider requirements
- do not store more message content than necessary
- action IDs should be included in callbacks
- every action must be tied to a merchant/store

---

# 22. Action State Machine

```text
DETECTED
   ↓
DRAFTED
   ↓
AWAITING_APPROVAL
   ├──→ REJECTED
   └──→ APPROVED
             ↓
         EXECUTING
             ↓
         EXECUTED
             ↓
         VERIFIED
```

Failure path:

```text
EXECUTING
    ↓
FAILED
    ↓
RETRYABLE / MANUAL_REVIEW
```

Every state transition should be recorded.

---

# 23. Recommendation Object

Example:

```json
{
  "id": "rec_123",
  "store_id": "store_123",
  "type": "RESTOCK",
  "title": "Milk may run out tomorrow",
  "reason": "Average daily sales increased 18%",
  "evidence": {
    "current_stock": 8,
    "avg_daily_sales": 10.7,
    "estimated_days_remaining": 0.75
  },
  "suggested_action": {
    "quantity": 25
  },
  "confidence": 0.89,
  "status": "AWAITING_APPROVAL"
}
```

The numerical evidence is generated by the backend, not invented by the LLM.

---

# 24. Copilot Architecture

The copilot is not a free-floating chatbot.

```text
User question
      ↓
Intent detection
      ↓
Relevant merchant data retrieval
      ↓
Deterministic calculations
      ↓
Structured context
      ↓
LLM
      ↓
Grounded answer
      ↓
Optional action proposal
```

Example:

```text
User:
"How can I increase sales this weekend?"

Backend calculates:
- weekend historical sales
- top products
- slow products
- average order value
- common product combinations
- available inventory

LLM:
explains the findings and proposes an action.

Merchant:
[Create Offer]
```

---

# 25. Guardrails

The AI must:

- use actual merchant data
- distinguish facts from suggestions
- expose relevant evidence
- avoid fabricated metrics
- avoid claiming guaranteed business results
- avoid executing financial/business actions without required approval
- avoid changing inventory without a real transaction/movement
- avoid exposing another merchant's data
- refuse or ask for clarification when data is insufficient

Example:

Bad:

> "Your sales will increase by 30%."

Good:

> "Your bread + milk combination has a higher average basket value than either item alone. You could test a weekend combo."

---

# 26. Security and Multi-Tenancy

Minimum requirements:

- authenticated requests
- merchant/store authorization on every resource
- server-side authorization checks
- secrets only on backend
- `.env` locally
- `.env.example` committed without secrets
- HTTPS in deployment
- webhook signature verification
- upload size/type validation
- filename sanitization
- OCR document access controlled by merchant/store
- audit logs for important actions

Never put:

```text
OPENAI_API_KEY
META_ACCESS_TOKEN
Google credentials
database service keys
```

in React or Chrome extension source.

OpenAI explicitly recommends keeping API keys secret and loading them server-side/environmentally.

---

# 27. API Keys and Credentials

## 27.1 Required for the core AI demo

### `OPENAI_API_KEY`

Use for:

- business copilot
- recommendation explanations
- structured extraction where useful
- optional image understanding fallback

No GPU is needed because inference is remote.

Keep it server-side only.

---

## 27.2 OCR — choose one path

### Path A: zero API key

**Tesseract**

```text
OCR_PROVIDER=tesseract
```

No API key.

Best for:

- demo
- simple printed bills
- local/offline OCR

### Path B: cloud OCR

**Google Cloud Vision**

```text
OCR_PROVIDER=google
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=...
```

or an appropriately secured API-key configuration.

Use this when better OCR accuracy is needed.

Do not require both providers to run the MVP.

---

## 27.3 WhatsApp

If WhatsApp is demonstrated live, you will need Meta/WhatsApp Cloud API credentials/configuration, typically including:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_VERIFY_TOKEN
```

Exact values depend on the Meta app setup.

If WhatsApp approval is not available during the demo, keep a mock messaging adapter rather than blocking the entire product.

---

## 27.4 Paytm

Paytm credentials are required **only for a real Paytm integration**.

Keep them behind:

```text
PAYTM_MERCHANT_ID=...
PAYTM_CLIENT_ID=...
PAYTM_CLIENT_SECRET=...
```

Only define the exact credential names after the Paytm API/product available to the team is confirmed.

For the hackathon, mock Paytm data is acceptable for the integration adapter.

Do not put unverified Paytm credentials/endpoints into the core architecture.

---

## 27.5 Database

If using the current local DuckDB architecture:

```text
No database API key required.
```

If later using a hosted PostgreSQL/Supabase deployment:

```text
DATABASE_URL=...
```

and, if Supabase Auth is chosen:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key must remain backend-only.

This is optional and should not be added merely for the sake of adding another service.

---

## 27.6 Storage

For a local hackathon:

```text
LOCAL_UPLOAD_DIR=./data/uploads
```

No external key.

For production object storage, add a storage provider later.

---

# 28. Recommended `.env.example`

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Authentication
JWT_SECRET=change_me_for_local_development

# AI
OPENAI_API_KEY=

# OCR
OCR_PROVIDER=tesseract

# Optional Google Cloud Vision OCR
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=

# WhatsApp - optional for live integration
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=

# Paytm - optional / only after confirmed API access
PAYTM_MERCHANT_ID=
PAYTM_CLIENT_ID=
PAYTM_CLIENT_SECRET=

# Data
DUCKDB_PATH=./data/storesathi.duckdb
LOCAL_UPLOAD_DIR=./data/uploads

# Optional production database
DATABASE_URL=
```

---

# 29. What You Actually Need to Obtain

## Minimum working demo

```text
1. OpenAI API key
2. Tesseract installed locally
3. No GPU
4. No Paytm credentials if using mock Paytm data
5. No WhatsApp credentials if using dashboard-only actions
```

## Stronger demo

```text
1. OpenAI API key
2. Tesseract
3. WhatsApp Cloud API credentials
4. Mock Paytm dataset
5. Existing Chrome extension
```

## Higher OCR quality

Add:

```text
Google Cloud Vision credentials
```

but make it optional.

---

# 30. What Should NOT Be Built for MVP

Avoid spending hackathon time on:

- training your own ML model
- GPU infrastructure
- custom LLM
- fine-tuning
- complex vector database
- RAG over random documents
- complicated microservices
- full ERP
- full accounting software
- full procurement platform
- real-time stock synchronization with every possible POS
- production-scale Kubernetes
- dozens of integrations
- automatic financial decisions
- complicated customer CRM

The winning story is not technical complexity.

It is the connected business loop.

---

# 31. Demo Data Strategy

Create realistic demo data for at least three merchant types:

### Kirana

Products:

- milk
- bread
- eggs
- biscuits
- rice
- sugar
- snacks
- soft drinks

### Restaurant

Items:

- biryani
- dosa
- burger
- tea
- coffee
- combo meals

### Salon

Services:

- haircut
- beard trim
- facial
- hair spa
- coloring

Use enough historical transactions to demonstrate:

- trends
- seasonality
- slow movers
- fast movers
- stockout predictions
- customer combinations
- anomalies

---

# 32. Winning Demo Flow

The main demo should tell one continuous story.

## Step 1 — Merchant starts

```text
Rajesh General Store
```

## Step 2 — Merchant uploads an old bill

```text
Photo
 ↓
OCR
 ↓
47 products detected
 ↓
Review
 ↓
Confirm
```

## Step 3 — Store catalogue is created

Products and prices now exist.

## Step 4 — Merchant creates a sale

```text
Milk × 2
Bread × 1
Biscuits × 3
```

## Step 5 — Inventory automatically updates

```text
Milk 30 → 28
Bread 21 → 20
Biscuits 15 → 12
```

## Step 6 — Dashboard changes

```text
Sales +₹170
Transaction +1
Inventory updated
```

## Step 7 — AI identifies an opportunity

```text
Milk is selling faster on weekends.
```

## Step 8 — AI predicts risk

```text
Current stock may not cover tomorrow evening.
```

## Step 9 — AI recommends action

```text
Restock 25 units.
```

## Step 10 — Merchant approves

```text
[Approve]
```

## Step 11 — Action is logged

```text
Restock recommendation approved.
```

## Step 12 — Copilot answers a question

```text
"How can I increase weekend sales?"
```

The answer uses the merchant's real demo data.

This is the strongest end-to-end narrative:

```text
BILL → DATA → SALE → INVENTORY → INSIGHT → PREDICTION → ACTION
```

---

# 33. Feature Prioritization

## P0 — Must have

- Merchant login
- Merchant/store context
- Product catalogue
- Create sale
- Inventory update from sale
- Dashboard
- OCR upload
- OCR review/confirmation
- Sales analytics
- Inventory analytics
- Rule-based recommendations
- AI copilot
- Action approval
- Existing Chrome extension retained as optional connector
- Mock Paytm data

## P1 — Strong differentiators

- WhatsApp approval
- Daily proactive summary
- Stockout prediction
- Combo/offer recommendation
- Customer purchase-pattern insights
- Receipt generation
- Action history
- Paytm adapter

## P2 — Future

- Real Paytm production integration
- Supplier ordering
- barcode scanning
- advanced forecasting
- automated offer activation
- multi-store merchant groups
- richer customer segmentation
- production PostgreSQL migration
- object storage
- advanced observability

---

# 34. Implementation Phases

## Phase 1 — Core data foundation

Build:

- merchant/store
- products
- sales
- sale items
- inventory movements
- DuckDB repositories
- authentication
- seed/demo data

Goal:

> A sale can correctly change inventory and analytics.

---

## Phase 2 — Billing

Build:

- product search
- cart
- payment method
- create sale
- receipt
- idempotency
- transaction history

Goal:

> The merchant can run the store from the app.

---

## Phase 3 — OCR

Build:

- upload
- preprocessing
- Tesseract
- extraction parser
- confidence
- review UI
- confirmation
- import into catalogue/transactions

Goal:

> A photo becomes usable business data.

---

## Phase 4 — Intelligence

Build deterministic:

- sales trend
- low stock
- stockout prediction
- slow-moving detection
- top products
- peak time
- anomaly detection

Goal:

> The system understands the store without needing the LLM.

---

## Phase 5 — AI Copilot

Build:

- context builder
- LLM provider
- business Q&A
- insight explanation
- recommendation drafting
- action proposals

Goal:

> The AI understands and explains the merchant's business.

---

## Phase 6 — Actions

Build:

- approve/reject
- action state machine
- action history
- recommendation cards
- mock execution

Goal:

> The AI does not stop at advice.

---

## Phase 7 — WhatsApp

Build:

- message adapter
- interactive approval
- webhook
- idempotency
- confirmation

Goal:

> The merchant can interact outside the dashboard.

---

## Phase 8 — Integrations

Add:

- existing Chrome extension
- Paytm adapter
- optional cloud OCR

Goal:

> Same intelligence engine, multiple data sources.

---

# 35. Failure and Fallback Strategy

The application should continue working if an external AI service fails.

## LLM unavailable

Show:

```text
AI explanation temporarily unavailable.

Here are the calculated facts:
...
```

The dashboard and deterministic analytics still work.

## OCR unavailable

Allow:

- manual entry
- retry
- upload again

## WhatsApp unavailable

Actions remain available in the dashboard.

## Paytm unavailable

Use existing imported/mock transaction data.

## Chrome extension unavailable

Use billing/OCR/manual data.

The product must not have a single external-service failure that destroys the entire demo.

---

# 36. Observability

For the hackathon, log:

- request ID
- merchant/store ID
- operation
- duration
- OCR provider
- AI provider
- recommendation ID
- action ID
- external API failures

Never log:

- API secrets
- passwords
- full access tokens
- unnecessary sensitive customer information

---

# 37. Privacy Model

StoreSathi handles business data.

Principles:

1. collect only what is needed
2. keep merchant data tenant-isolated
3. avoid unnecessary customer PII
4. keep provider credentials server-side
5. make external integrations explicit
6. allow deletion of uploaded documents where practical
7. retain audit history for important actions
8. never use one merchant's data in another merchant's AI context

---

# 38. Architecture Decisions

### Decision: Chrome extension

**Keep.** Optional connector, not core.

### Decision: OCR

**Keep, but not required.** It is the onboarding/data-capture mechanism, not
the headline feature. Manual/CSV entry (§8.3) feeds the exact same review →
commit pipeline and is the P0 fallback if OCR setup or accuracy risks the demo.

### Decision: Billing

**Add.** It creates clean transaction data and automatically drives inventory.

### Decision: Tesseract

**Default local OCR.** No GPU and no API key.

### Decision: Cloud OCR

**Optional fallback.** Use only if needed for accuracy.

### Decision: LLM

**Remote API.** No local GPU model.

### Decision: DuckDB

**Keep for hackathon analytics.** Put it behind repositories so a production database can replace it.

### Decision: WhatsApp

**Keep.** Strong action/approval channel, but must not block the dashboard demo.

### Decision: Paytm

**Adapter + mock data initially.** Do not invent undocumented integration details.

---

# 39. Final Architecture

```text
                         STORE SATHI
                  AI BUSINESS PARTNER
                            │
                            ▼
                 ┌────────────────────┐
                 │  MERCHANT EXPERIENCE│
                 ├────────────────────┤
                 │ Dashboard          │
                 │ Billing / POS      │
                 │ OCR Upload         │
                 │ Inventory         │
                 │ AI Copilot        │
                 │ Recommendations   │
                 │ Actions            │
                 └─────────┬──────────┘
                           │
                           ▼
                ┌────────────────────────┐
                │    NODE.JS BACKEND     │
                ├────────────────────────┤
                │ Auth / Tenant Mgmt     │
                │ Sales / Billing        │
                │ Inventory              │
                │ OCR Orchestration      │
                │ Analytics              │
                │ Intelligence           │
                │ Copilot                │
                │ Recommendations        │
                │ Action State Machine   │
                │ Integrations/Webhooks  │
                └───────────┬────────────┘
                            │
           ┌────────────────┼─────────────────┐
           │                │                 │
           ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │ DATA LAYER  │  │ AI LAYER     │  │ INTEGRATIONS │
    ├─────────────┤  ├──────────────┤  ├──────────────┤
    │ DuckDB      │  │ Rules        │  │ Paytm        │
    │ Products    │  │ Analytics    │  │ WhatsApp     │
    │ Sales       │  │ Forecasting  │  │ Chrome Ext.  │
    │ Inventory   │  │ OpenAI       │  │ OCR          │
    │ Actions     │  │              │  │              │
    └─────────────┘  └──────────────┘  └──────────────┘

                    CORE LOOP

       CAPTURE
          ↓
       UNDERSTAND
          ↓
       PREDICT
          ↓
       RECOMMEND
          ↓
       ACT
          ↓
       MEASURE
          ↓
       LEARN
```

---

# 40. One-Sentence Architecture Summary

> **StoreSathi is a multi-merchant, transaction-first AI business copilot where bills, sales, inventory, optional Paytm data and optional online-store data are normalized into a common merchant data layer; deterministic analytics find what is happening, remote AI explains what it means, and an action system helps the merchant decide what to do next.**

---

# 41. Important Reality Check

This architecture is intentionally designed around the constraints of a hackathon team **without a GPU**.

You do not need:

- a GPU
- a locally trained model
- a custom ML model
- a large Kubernetes deployment
- ten external APIs

For the strongest MVP, the critical dependencies are:

```text
React
Node.js
DuckDB
Tesseract
OpenAI API
```

Then add:

```text
WhatsApp
Paytm
Cloud OCR
```

only when the corresponding integration is actually available.

The technical differentiator should be the **closed business loop**, not the number of APIs.