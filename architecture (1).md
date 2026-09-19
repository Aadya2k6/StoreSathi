# StoreSathi — Architecture

Track: Merchant Growth AI · Team pink_code

## 1. What it is

StoreSathi is an AI copilot for small retail merchants. It reads the merchant's storefront, finds inventory and growth problems with a rules engine, explains them with concrete numbers, and executes the fix in one click. Core loop: **Integrate → Identify → Explain → Execute.**

Three parts share one backend:

| Part | Tech | Role |
|---|---|---|
| Chrome extension | Manifest V3, plain JS | Reads storefront pages, shows alerts/trends in a sidebar, applies approved changes to the live page |
| Merchant portal | React + Vite (port 5173) | Dashboard: inventory, alerts, action history, campaigns, copilot |
| Backend API | Node.js + Express (port 3000) | Rules engine, AI calls, notifications, database |

## 2. System diagram

```
 Merchant's storefront (demo.html)         Any other website
        │                                         │
        ▼                                         ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Chrome extension  (content.js sidebar + background.js)   │
 │  store mode: sync catalogue, inventory alerts, Approve   │
 │  trends mode: market trends relevant to the page only    │
 └───────────────────────────┬──────────────────────────────┘
                             │ fetch  http://localhost:3000/api/*
 ┌───────────────────────────▼──────────────────────────────┐
 │ Backend (Express)                                        │
 │  routes → engine / services → repositories → DuckDB      │
 │                                                          │
 │  Rules engine     alerts + structured actions            │
 │  Opportunity eng. snapshot-based market rules            │
 │  Trend service    simulated trend feed matched to page   │
 │  AI               Gemini → Groq fallback                 │
 │  Notifications    WhatsApp · SMS · Email                 │
 │  Cron (hourly)    rules + urgent email digest            │
 └───────┬───────────────────────┬──────────────────────────┘
         │                       │
   Portal (React) via       External: Gemini, Groq, Open-Meteo,
   Vite proxy /api          Gmail SMTP, Twilio, Meta WhatsApp API
```

## 3. Backend layout (`backend/src`)

| Path | Responsibility |
|---|---|
| `server.js` | Express app, mounts routers, `/webhook`, `/api/trigger-cron`, starts cron |
| `db/index.js` | DuckDB connection, schema creation, migrations, demo seed |
| `routes/auth.js` | Signup (creates merchant + store + user) and login |
| `routes/catalogue.js` | Product list, create, `bulk-sync` (ingest from extension) |
| `routes/intelligence.js` | Alerts, analyze-page, trends, approve, stats, copilot, reset-demo |
| `routes/campaigns.js` | Audience, AI campaign generation, broadcast, history |
| `routes/opportunities.js` | Snapshot-based opportunities and their state machine |
| `routes/billing.js` | Sales with idempotency key, PDF receipts |
| `routes/webhook.js` | Meta WhatsApp webhook (verification + button taps) |
| `engine/rulesEngine.js` | Inventory/growth rules, alert ordering |
| `engine/opportunityEngine.js`, `draftingService.js` | Market rules over page snapshots, plain-language drafts |
| `services/trendService.js` | Matches a browsed page to trends and the merchant's stock |
| `services/snapshotService.js` | Stores scraped pages; robust price parsing |
| `services/notificationService.js` | One call → WhatsApp + SMS + email, reports real delivery per channel |
| `services/urgentAlertService.js` | Automated digest email for urgent alerts, de-duplicated for 24h |
| `services/cronService.js` | Hourly engine + rules run and notifications |
| `services/gemini.js`, `groq.js` | AI providers and shared copilot context formatting |
| `services/emailService.js`, `sms.js`, `whatsapp.js` | Channel senders |
| `repositories/` | Data access for products, sales, inventory, merchants |

## 4. Data model (DuckDB, file `data/store.db`)

| Table | Purpose |
|---|---|
| `merchants`, `stores`, `users` | Tenants and logins (a store id per signup) |
| `products` | Catalogue: name, category, price, cost, stock |
| `sales`, `sale_items`, `inventory_movements` | Billing and stock history (restocks are logged here) |
| `recommendations` | Alerts. `evidence_data` JSON holds `priority`, `entity_id`, and the structured `action` |
| `actions` | Approved-action history; payload records exactly what changed |
| `snapshots` | Latest scraped page per store and URL |
| `opportunities` | Market-rule findings with a state machine (detected → drafted → approved …) |
| `alert_emails` | Which urgent alerts were already emailed |
| `campaigns`, `customers` | Marketing campaigns and audience tiers |
| `chat_messages` | Copilot history |

## 5. Intelligence

**Rules engine (`rulesEngine.js`)**, run per store:

| Rule | Fires when | Action on approval |
|---|---|---|
| Low stock | stock < 20 (Urgent at ≤ 10) | Restock +40 units |
| Slow moving | stock ≥ 30 and ≤ 1 sold in 14 days, not restocked recently | Price −15% |
| Demand spike | ≥ 3 sold in 7 days and above the previous week | Feature product |
| Growth opportunity | Sets, Outerwear, or price ≥ ₹2,000 | Feature product + WhatsApp campaign |
| Weather | Cold snap or heavy rain (Open-Meteo); outerwear only | Feature product |
| Trend | Simulated trend feed matches a product | Feature product |

Every alert carries a structured `action`, so the numbers in the text are exactly what gets applied. Alerts are ordered stock-first and capped at two per type.

**AI (`gemini.js`, `groq.js`)**
- Gemini (`gemini-flash-latest`) is primary; Groq (`qwen/qwen3.8-27b`) is the automatic fallback; the deterministic rules alone work if both are down.
- The copilot receives every product (stock, price, 14-day sales) and every open alert with its recommended action, so answers use real data.
- AI writes copy and explanations; it does not produce the alert numbers.

**Opportunity engine**: rules over scraped snapshots (underpriced, response gap, slow-moving, low stock, price watch) feeding the cron and WhatsApp approval flow.

## 6. Key flows

**Ingest** — extension scrapes the store page → `POST /api/catalogue/bulk-sync` → products upserted for the logged-in store.

**Alert** — page opened → `POST /api/intelligence/analyze-page` → snapshot saved, rules run, alerts returned (prioritised) → urgent alerts trigger the digest email.

**Approve** — `POST /api/intelligence/recommendations/:id/approve` → applies the action to the product row (price or stock, plus a movement record) → logs it in `actions` → creates a campaign if relevant → notifies via WhatsApp/SMS/email → returns what changed → the extension edits only the matching rows on the storefront page. Approving twice is blocked.

**Trends** — on any non-store site the extension calls `POST /api/intelligence/trends`; only trends relevant to the page are returned, matched against the merchant's stock. The extension never edits the other site's page.

**Notifications** — `notifyMerchant` tries WhatsApp, SMS and email and reports which channels actually delivered. Urgent alerts are also emailed automatically as one digest (each alert at most once per 24h).

## 7. Extension behaviour

- **Store vs other site:** pages listed in `STORE_PAGES` (currently `demo.html`) run the full engine; every other site shows trends only.
- **Shared login:** the login is stored in `chrome.storage.local`, so signing in on the portal signs the sidebar in on every site. Logging out of the portal logs it out everywhere.
- **Live storefront update:** approved price and stock changes are mirrored on the page by matching the exact product row; the low-stock counter is recomputed.

## 8. Portal pages

Login/Signup · Overview (inventory, opportunity and action counts) · Opportunities (alerts with Approve) · Action History · Campaigns (generate, audience, broadcast, history) · Copilot chat.

## 9. Configuration (`backend/.env`)

`PORT`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `RECIPIENT_PHONE`, `WEBHOOK_VERIFY_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_TEMPLATE_TEXT`, `DEMO_FORCE_COLD_SNAP` (forces the cold-snap weather alert for demos).

## 10. Running locally

- Backend: `npm run dev` in `backend/` (port 3000)
- Portal: `npm run dev` in `portal/` (port 5173, proxies `/api` to the backend)
- Extension: load `extension/` unpacked at `chrome://extensions`
- Demo storefront: serve `extension/` (e.g. `python -m http.server 8080`) and open `demo.html`
- Reset a store for a fresh run: `POST /api/intelligence/reset-demo?store_id=<id>` (add `&products=true` to also clear the catalogue)

## 11. Known limitations

- No token-based authentication: the API trusts the `store_id` it is given.
- The trend feed is simulated.
- Some page content on `demo.html` (7-day sales, revenue card) is static.
- The Meta WhatsApp test token expires every 24 hours, and free-text messages need the recipient to have messaged the business number within 24 hours.
- DuckDB is a single-node file database; the backend must run as one instance with a persistent disk.
- The extension and portal use `localhost` addresses; hosting needs them made configurable.
