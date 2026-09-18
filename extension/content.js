console.log("StoreSathi: Content script loaded on page:", window.location.href);

// Guard to prevent duplicate sends within one page load
let hasSentData = false;

// ─── Strategy A: JSON-LD (High Fidelity) ─────────────────────────────────────
const extractJSONLD = () => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      // IMPORTANT: Use textContent, not innerText — innerText returns "" on <script> tags
      const raw = script.textContent || script.innerHTML;
      if (!raw || !raw.trim()) continue;
      const data = JSON.parse(raw);

      // Normalize: handle both single object and array
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const candidates = [];

        // Direct Product
        if (item['@type'] === 'Product') {
          candidates.push(item);
        }

        // @graph containing Products
        if (item['@graph']) {
          const graphItems = Array.isArray(item['@graph']) ? item['@graph'] : [item['@graph']];
          graphItems.forEach(g => {
            if (g['@type'] === 'Product') candidates.push(g);
          });
        }

        // ItemList containing Products (common on Shopify / Next.js storefronts)
        if (item['@type'] === 'ItemList' && item.itemListElement) {
          const elements = Array.isArray(item.itemListElement) ? item.itemListElement : [item.itemListElement];
          elements.forEach(el => {
            const inner = el.item || el;
            if (inner && inner['@type'] === 'Product') candidates.push(inner);
          });
        }

        if (candidates.length === 0) continue;

        const product = candidates[0];
        if (!product.name) continue;

        let price = 0;
        let currency = 'INR';
        let stock_status = 'unknown';

        if (product.offers) {
          const offerList = Array.isArray(product.offers) ? product.offers : [product.offers];
          const offer = offerList[0];
          price = parseFloat(offer.price || offer.lowPrice || 0);
          currency = offer.priceCurrency || 'INR';
          if (offer.availability) {
            stock_status = offer.availability.toLowerCase().includes('instock')
              ? 'in_stock'
              : 'out_of_stock';
          }
        }

        let reviews_count = 0;
        let rating = 0;
        if (product.aggregateRating) {
          reviews_count = parseInt(
            product.aggregateRating.reviewCount || product.aggregateRating.ratingCount || 0,
            10
          );
          rating = parseFloat(product.aggregateRating.ratingValue || 0);
        }

        return {
          url: window.location.href,
          product_name: product.name,
          price,
          currency,
          stock_status,
          reviews_count,
          rating,
          platform: 'jsonld',
          timestamp: new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn("StoreSathi: Failed to parse a JSON-LD block:", e.message);
    }
  }
  return null;
};

// ─── Strategy B: OpenGraph + Heuristic Fallback ───────────────────────────────
const extractHeuristic = () => {
  const title =
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('h1')?.innerText?.trim() ||
    document.title;

  let price = 0;
  let currency = 'INR';

  const ogPrice    = document.querySelector('meta[property="product:price:amount"]')?.content;
  const ogCurrency = document.querySelector('meta[property="product:price:currency"]')?.content;

  if (ogPrice) {
    price = parseFloat(ogPrice);
    if (ogCurrency) currency = ogCurrency;
  } else {
    const priceSelectors = [
      '[data-price]',
      '.ProductPrice',
      '.product-price',
      '.woocommerce-Price-amount',
      '[class*="product__price"]',
      '[class*="price--sale"]',
      '[class*="price"]',
      '[id*="price"]'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        const match = text.match(/[\d,]+\.?\d*/);
        if (match) {
          price = parseFloat(match[0].replace(/,/g, ''));
          if      (text.includes('₹') || text.toLowerCase().includes('rs')) currency = 'INR';
          else if (text.includes('€'))  currency = 'EUR';
          else if (text.includes('£'))  currency = 'GBP';
          else if (text.includes('$'))  currency = 'USD';
          break;
        }
      }
    }
  }

  return {
    url: window.location.href,
    product_name: title,
    price,
    currency,
    stock_status: 'unknown',
    reviews_count: 0,
    rating: 0,
    platform: 'heuristic',
    timestamp: new Date().toISOString()
  };
};

// ─── Product page detector ────────────────────────────────────────────────────
// Uses specific signals — avoids false positives from generic JSON-LD on homepages
const isProductPage = () => {
  const hasOgProduct = !!document.querySelector('meta[property="og:type"][content="product"]');
  const hasAddToCart = !!(
    document.querySelector('button[name="add"]') ||
    document.querySelector('[class*="add-to-cart"]') ||
    document.querySelector('[id*="add-to-cart"]') ||
    document.querySelector('[class*="AddToCart"]')
  );
  const hasProductPathPattern = /\/products?\/|\/item\/|\/p\//i.test(window.location.pathname);
  const hasProductJSONLD = (() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const raw = s.textContent || '';
        if (raw.includes('"Product"')) return true;
      } catch (_) { /* ignore */ }
    }
    return false;
  })();

  return hasOgProduct || hasAddToCart || hasProductPathPattern || hasProductJSONLD;
};

// ─── Send to backend via background service worker ──────────────────────────
// Direct fetch from content script is blocked by Chrome's Private Network Access
// policy when the page origin is HTTPS. Route through background.js instead.
// The SW can occasionally be dormant — we retry up to 3 times before giving up.
const sendMessageWithRetry = (message, retries, callback) => {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      if (retries > 0) {
        console.warn(`StoreSathi: SW dormant, retrying in 1s... (${retries} left)`);
        setTimeout(() => sendMessageWithRetry(message, retries - 1, callback), 1000);
      } else {
        callback(null, chrome.runtime.lastError.message);
      }
      return;
    }
    callback(response, null);
  });
};
const sendToBackend = (payload) => {
  if (hasSentData) return;
  hasSentData = true;

  sendMessageWithRetry({ action: 'ingest', data: payload }, 3, (response, err) => {
    if (err) {
      console.error('StoreSathi: ❌ Background worker error:', err);
      hasSentData = false; // Allow retry
      return;
    }
    if (response && response.ok) {
      console.log(
        `StoreSathi: ✅ Ingested: "${payload.product_name}" | ${payload.currency} ${payload.price} | ${payload.stock_status}`
      );
      // After ingestion, poll for opportunities — the engine runs async so retry a few times
      pollForOpportunity(5, 2000);
    } else {
      hasSentData = false; // Allow retry on server error
      console.error('StoreSathi: ❌ Ingest failed:', response ? response.error : 'no response');
    }
  });
};

// ─── Main run function ────────────────────────────────────────────────────────
const run = (label) => {
  if (hasSentData) return; // Already succeeded, skip
  if (!isProductPage()) {
    console.log(`StoreSathi [${label}]: Not a product page — skipping.`);
    return;
  }

  const data = extractJSONLD() || extractHeuristic();

  if (data && data.product_name && data.price > 0) {
    console.log(`StoreSathi [${label}]: 📦 Found: "${data.product_name}" at ${data.currency} ${data.price}`);
    sendToBackend(data);
  } else {
    console.log(`StoreSathi [${label}]: ⚠️ Product page detected but could not extract valid price/name.`);
    if (data) console.log('StoreSathi: Partial data:', JSON.stringify(data));
  }
};

// ─── SPA Navigation Watcher ───────────────────────────────────────────────────
// SPAs like Gymshark (Next.js) change the URL via history.pushState without a
// full page reload. Chrome does NOT re-inject content scripts on pushState.
// We intercept pushState/replaceState and popstate to detect navigations and
// re-run extraction on each new product page.
let lastUrl = window.location.href;
let pendingTimers = [];

const clearPendingTimers = () => {
  pendingTimers.forEach(clearTimeout);
  pendingTimers = [];
};

const onSpaNavigate = () => {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return; // Same URL, ignore
  lastUrl = currentUrl;
  hasSentData = false; // Reset for new page
  clearPendingTimers(); // Clear any pending timers from previous page

  console.log('StoreSathi: 🔄 SPA navigation detected →', currentUrl);

  // Schedule fresh attempts for the new page
  pendingTimers.push(setTimeout(() => run('nav-2s'), 2000));
  pendingTimers.push(setTimeout(() => run('nav-5s'), 5000));
};

// Intercept history.pushState (forward SPA navigation)
const _origPushState = history.pushState.bind(history);
history.pushState = (...args) => {
  _origPushState(...args);
  onSpaNavigate();
};

// Intercept history.replaceState (SPA URL replacement)
const _origReplaceState = history.replaceState.bind(history);
history.replaceState = (...args) => {
  _origReplaceState(...args);
  onSpaNavigate();
};

// Handle browser back/forward button
window.addEventListener('popstate', onSpaNavigate);

// Polling failsafe — catches edge cases where pushState is not intercepted
// (e.g. iframes, some routing libraries). Runs every 1500ms, very cheap.
setInterval(() => {
  if (window.location.href !== lastUrl) {
    onSpaNavigate();
  }
}, 1500);

// ─── Initial page load attempts ───────────────────────────────────────────────
// First attempt at 2s — covers fast SSR pages
pendingTimers.push(setTimeout(() => run('2s'), 2000));
// Second attempt at 5s — covers slow-hydrating Next.js pages
pendingTimers.push(setTimeout(() => run('5s'), 5000));

// ─── Sidebar UI (Phase 3) ─────────────────────────────────────────────────────
let sidebarInjected = false;

const closeSidebar = () => {
  const sidebar = document.getElementById('storesathi-sidebar-root');
  if (sidebar) {
    sidebar.classList.remove('visible');
    setTimeout(() => sidebar.remove(), 400); // Wait for transition
    sidebarInjected = false;
  }
};

const renderSidebar = (opp) => {
  if (sidebarInjected) return;

  // We only care about opportunities that have been drafted
  const draft = opp.details?.draft;
  if (!draft || !draft.headline) {
    console.warn('StoreSathi: Opportunity has no draft yet, skipping sidebar render.');
    return; // Do NOT set sidebarInjected — allow future retries
  }

  sidebarInjected = true; // Lock only after we know we can render

  const typeLabels = {
    underpriced: '📈 Underpriced',
    response_gap: '💬 Response Gap',
    slow_moving: '📦 Slow Moving',
    price_watch: '👁️ Price Watch'
  };

  const el = document.createElement('div');
  el.id = 'storesathi-sidebar-root';
  el.innerHTML = `
    <div class="ss-header">
      <div class="ss-logo">✨ StoreSathi</div>
      <button class="ss-close" id="ss-close-btn">&times;</button>
    </div>
    <div class="ss-opportunity-card">
      <div class="ss-tag ${opp.type}">${typeLabels[opp.type] || opp.type}</div>
      <h3 class="ss-headline">${draft.headline}</h3>
      <p class="ss-reason">${draft.reason}</p>
      <div class="ss-action">${draft.action}</div>
      <button class="ss-button" id="ss-approve-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        Approve via WhatsApp
      </button>
    </div>
  `;

  document.body.appendChild(el);

  // Force reflow before adding visible class for CSS transition
  void el.offsetWidth;
  el.classList.add('visible');

  document.getElementById('ss-close-btn').addEventListener('click', closeSidebar);
  
  document.getElementById('ss-approve-btn').addEventListener('click', () => {
    alert("Phase 4: WhatsApp Integration goes here!");
    closeSidebar();
  });
};

const checkAndDisplayOpportunity = () => {
  const currentUrl = encodeURIComponent(window.location.href);
  console.log('StoreSathi: 🔍 Checking for opportunities for URL:', window.location.href);
  chrome.runtime.sendMessage(
    { action: 'fetch_opportunities', url: currentUrl },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('StoreSathi: ❌ Fetch opportunity error:', chrome.runtime.lastError.message);
        return;
      }
      console.log('StoreSathi: 📊 Opportunity response:', response);
      if (response && response.ok && response.data && response.data.count > 0) {
        // Find the first drafted opportunity for this URL
        const opp = response.data.data.find(o => o.status === 'drafted' || o.status === 'detected');
        if (opp) {
          console.log('StoreSathi: 🎯 Opportunity found, rendering sidebar:', opp.type);
          renderSidebar(opp);
        }
      } else {
        console.log('StoreSathi: ℹ️ No opportunities found for this URL.');
      }
    }
  );
};

// Polls for opportunities with retries — needed because the engine runs async
const pollForOpportunity = (retriesLeft, intervalMs) => {
  if (retriesLeft <= 0 || sidebarInjected) return;
  console.log(`StoreSathi: ⏳ Polling for opportunity (${retriesLeft} retries left)...`);
  sendMessageWithRetry(
    { action: 'fetch_opportunities', url: encodeURIComponent(window.location.href) },
    2,
    (response, err) => {
      if (err) return;
      if (response && response.ok && response.data && response.data.count > 0) {
        const opp = response.data.data.find(o => o.status === 'drafted' || o.status === 'detected');
        if (opp) {
          console.log('StoreSathi: 🎯 Opportunity found on poll, rendering sidebar:', opp.type);
          renderSidebar(opp);
          return;
        }
      }
      // Not found yet — try again
      setTimeout(() => pollForOpportunity(retriesLeft - 1, intervalMs), intervalMs);
    }
  );
};

// Also check for opportunities independently on page load (in case already seeded)
pendingTimers.push(setTimeout(checkAndDisplayOpportunity, 4000));

// ─── Handle popup/background messages ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    // Synchronous response — no need to return true
    const data = extractJSONLD() || extractHeuristic();
    sendResponse(data);
  }
});
