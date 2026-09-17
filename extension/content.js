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
const sendToBackend = (payload) => {
  if (hasSentData) return;
  hasSentData = true;

  chrome.runtime.sendMessage(
    { action: 'ingest', data: payload },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('StoreSathi: ❌ Background worker error:', chrome.runtime.lastError.message);
        hasSentData = false; // Allow retry
        return;
      }
      if (response && response.ok) {
        console.log(
          `StoreSathi: ✅ Ingested: "${payload.product_name}" | ${payload.currency} ${payload.price} | ${payload.stock_status}`
        );
      } else {
        hasSentData = false; // Allow retry on server error
        console.error('StoreSathi: ❌ Ingest failed:', response ? response.error : 'no response');
      }
    }
  );
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

// ─── Handle popup/background messages ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    // Synchronous response — no need to return true
    const data = extractJSONLD() || extractHeuristic();
    sendResponse(data);
  }
});
