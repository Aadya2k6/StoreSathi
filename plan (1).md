# StoreSathi — Plan

Track: Merchant Growth AI · Team pink_code

## 1. Goal

Give small merchants an AI copilot that finds inventory and growth problems, explains them with real numbers, and fixes them in one click, plus flags market trends while they browse the web.

## 2. The demo (golden path)

**Signup → Feed the store → Alerts → Approve (live storefront change) → Campaign → Copilot → Market trends**

| # | Step | What the audience sees |
|---|---|---|
| 1 | Sign up on the portal | Empty dashboard for a new store |
| 2 | Open `demo.html`, click **Approve & Feed to Portal** | Products appear in the portal |
| 3 | Show alerts in the sidebar | Low stock, slow-moving clearance, weather, each with exact numbers |
| 4 | **Approve** an alert | Storefront price/stock changes live; Action History updates; email/SMS arrive |
| 5 | Campaigns → Generate → Broadcast | AI-written message; the result lists the channels that really delivered |
| 6 | Ask the copilot "Which product should I restock first?" | Answer using real stock, prices and alerts |
| 7 | Open a floral-dress page on another site | Only the matching trend card; approving it launches a campaign; the page is not modified |

## 3. What is built

- **Ingest:** extension scrapes the storefront and syncs the catalogue per store.
- **Rules engine:** low stock, slow-moving, demand spike, growth, weather, trend; every alert carries a structured action.
- **Approve executes:** updates the product in the database, logs the action, mirrors the change on the live page, creates campaigns, and notifies.
- **Notifications:** WhatsApp, SMS and email, with honest per-channel delivery reporting; automatic email digest for urgent alerts; hourly cron.
- **AI:** Gemini primary, Groq fallback, deterministic rules if both fail; copilot grounded in real store data.
- **Trends mode:** on non-store sites the sidebar shows only relevant market trends.
- **Portal:** login/signup, overview, alerts, action history, campaigns, copilot.
- **Shared login:** portal login carries into the extension on every site.
- **Billing:** sales with idempotency key and PDF receipts.

## 4. Test checklist

1. Start the backend and portal; reload the extension; serve and open `demo.html`.
2. Sign up, log in to the portal once, then run **Approve & Feed** and confirm the portal shows the products.
3. Confirm low-stock alerts appear first and their text matches the data.
4. Approve a restock and a price cut; confirm the page, the portal and Action History all agree, and that approving again is blocked.
5. Confirm the notification arrives on each configured channel.
6. Generate and broadcast a campaign; confirm the message names the delivering channels.
7. Ask the five copilot questions; confirm answers match the data.
8. Open a trend-relevant page and an unrelated page on another site; confirm trend card vs. "No new trends", and no inventory alerts.
9. Reset between rehearsals: `POST /api/intelligence/reset-demo?store_id=<id>` (`&products=true` for a full wipe), then feed again.

## 5. Before the demo

- Regenerate the Meta WhatsApp token and send "hi" to the test number (needed every 24 hours).
- Keep `DEMO_FORCE_COLD_SNAP=true` so the weather alert shows.
- Log in to the portal once so the extension picks up the account.
- Record a backup video of a clean run.

## 6. Next steps (after the hackathon)

1. Token-based authentication and per-store access control.
2. Shared database (Postgres) and hosted deployment with configurable URLs.
3. Real trend sources (search/social trend APIs) in place of the simulated feed.
4. Paytm sales and payments data as the input to the rules.
5. Production WhatsApp Business account with approved templates and button approvals.
6. Register each merchant's real store URL instead of the `STORE_PAGES` list.
