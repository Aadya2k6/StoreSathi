# 🚀 StoreSathi - Action Plan (Final Addendum)

*Note: The following plan reflects the final implemented state of the platform:*
- **Multi-Tenant Authentication:** Completely isolated tenant dashboard. New merchants can sign up, generating a unique `store_id`, and log into both the Portal and Chrome Extension.
- **Database Backend:** Switched to DuckDB running inside a Node.js orchestration backend (`/backend`).
- **Intelligence Engine:** Implemented using Gemini-Flash with a robust fallback to Groq (`qwen3.8-27b`) when API limits are hit.
- **Plugin Synchronization & Auto-Ingestion:** 
  - The Chrome Plugin provides a full login flow synced with the portal.
  - **Live Auto-Ingestion:** When a merchant scrapes a product from their own website and clicks "Approve", the item is automatically ingested into their portal's DuckDB inventory.
- **Competitor Tracking & Auto-Email:** 
  - If a merchant visits a competitor's website, the plugin generates AI alerts based on pricing, stock urgency, and ratings. 
  - An automatic email notification via Nodemailer is dispatched instantly upon analysis.
- **Automation:** Added `cronService.js` in the backend that periodically triggers `opportunityEngine.js` to detect `low_stock`, `underpriced`, and `slow_moving` items, generating actionable campaign recommendations.

# 🚀 StoreSathi - Action Plan (Refined)

**Team:** pink_code · **Track:** Merchant Growth AI

## 0. Non-negotiable framing

The judging moment is the **golden path**:
```
    → SIGNUP → PLUGIN LOGIN → LIVE SCRAPE → AUTO-EMAIL → APPROVE/INGEST → CAMPAIGN GENERATOR → COPILOT
```

Everything in this plan has been built to make this exact story work live, on real data, without a network hiccup killing it.

---

## 1. Final Implemented Architecture

### Backend & Orchestration (Port 3000)
- **Node.js/Express:** Serves API endpoints for auth, intelligence, cron, and copilot.
- **DuckDB:** In-memory lightning-fast analytics database (`data/store.db`).
- **Gemini / Groq Integration:** Fallback routing ensures 100% uptime for AI Copilot and rules engine.

### Frontend Portal (Port 5173)
- **React + Vite:** Handles the merchant dashboard.
- **Authentication:** Tenant isolation enforced via `localStorage` and `portal_token`. No store-switcher.
- **Actions & Campaigns:** UI fully wired to backend `/actions` and `/campaigns` tables.

### Chrome Extension
- **Sidebar UI:** A floating FAB injects the copilot and recommendation sidebar into any website.
- **Message Passing:** `content.js` talks to `background.js` to bypass CORS, securely authenticating via `POST /api/auth/login`.

---

## 2. The Final Golden Path Demo

### Step 1: The New Merchant
- Open Portal Login. Click **"Sign Up"**.
- Create a new merchant account. The dashboard loads empty for this tenant.

### Step 2: The Store Ingestion (Data Feeding)
- Merchant opens their storefront/website (e.g. `demo.html` or online shop).
- StoreSathi plugin automatically scrapes all products visible on the website.
- In the plugin, an ingestion card appears: **"📦 Live Store Data Detected: Found X products on your website"**.
- The merchant clicks **"📥 Approve & Feed to Portal"**.
- Products are bulk-synced live via `POST /api/catalogue/bulk-sync` into DuckDB for this merchant's `store_id`.
- The merchant opens the Portal: the inventory and metrics are now populated dynamically with live store data!

### Step 3: AI Alerts & Live Website Modification on "Approve Action"
- Merchant receives AI recommendations on their storefront (Price drops, Restock, Trend campaigns).
- When the merchant clicks **"Approve Action"** in the plugin:
  1. **Live Website DOM Update**: The merchant's live storefront modifies immediately (e.g. price strikethrough to AI discount price, stock badge turning green, or top campaign banner appearing).
  2. **Database Execution**: Action logged to `actions` & `recommendations` table in DuckDB.
  3. **Notification**: Automated email dispatched to merchant confirming execution.
  4. **Portal Sync**: Action History screen (`/actions`) updates in real time.

### Step 4: Competitor Browsing & Automated Email Alerts
- Merchant browses any external/competitor website.
- Plugin scrapes live competitor pricing & stock status.
- Automated email alert is fired directly to merchant's Gmail highlighting the market shift.

### Step 5: AI Copilot & Campaigns
- Merchant uses the manual Campaign Generator in the portal.
- Merchant chats with Copilot (in portal or plugin) asking about live stock, sales velocity, or recommended discounts.

---

## 3. Judging narrative (keep this on an index card)

> "StoreSathi transforms the merchant workflow. Sign up with an empty dashboard, open your store website, and click 'Approve & Feed' to ingest your catalog live. When AI generates pricing or restock recommendations, clicking 'Approve Action' dynamically alters your storefront in real time, sends automated email alerts, and syncs your portal. Pure live automation with zero hardcoding."