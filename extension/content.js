console.log("StoreSathi: Plugin Widget loaded on page:", window.location.href);

// Auto-sync portal store login if on localhost:5173
if (window.location.origin.includes('localhost:5173')) {
  const portalStoreId = localStorage.getItem('portal_storeId');
  const portalUser = localStorage.getItem('portal_user');
  if (portalStoreId) {
    localStorage.setItem('storeSathi_token', 'true');
    localStorage.setItem('storeSathi_storeId', portalStoreId);
    if (portalUser) {
      try {
        const u = JSON.parse(portalUser);
        localStorage.setItem('storeSathi_storeName', u.store_name || u.email);
      } catch(e) {}
    }
  }
}

let isSidebarOpen = false;
let recommendations = [];

// Inject the floating FAB
function injectFAB() {
  const fab = document.createElement('div');
  fab.id = 'storesathi-fab';
  fab.innerHTML = '✨';
  
  fab.addEventListener('click', toggleSidebar);
  document.body.appendChild(fab);
}

// Inject the Sidebar container
function injectSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'storesathi-sidebar';
  
  sidebar.innerHTML = `
    <div class="ss-header">
      <div class="ss-logo">✨ StoreSathi</div>
      <div>
        <button class="ss-close-btn">&times;</button>
      </div>
    </div>
    <div class="ss-content">
      <div id="ss-login-view" style="display: none; padding: 20px;">
        <h3>Login to StoreSathi</h3>
        <form id="ss-ext-login-form" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
          <input type="email" id="ss-ext-email" placeholder="Email (demo@storesathi.com)" required style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
          <input type="password" id="ss-ext-password" placeholder="Password (hashed / demo123)" required style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
          <button type="submit" style="padding: 10px; background: #7C3AED; color: white; border: none; border-radius: 4px; cursor: pointer;">Login</button>
          <div id="ss-ext-login-error" style="color: red; font-size: 12px; margin-top: 5px;"></div>
        </form>
      </div>

      <div id="ss-main-view" style="display: none;">
        <div class="ss-greeting">
          <h2 id="ss-store-name">Welcome back.</h2>
          <p>Here are your smart alerts for today.</p>
        </div>

        <!-- Live Store Ingestion Card -->
        <div id="ss-ingest-container" class="ss-ingest-box" style="display: none;">
          <div class="ss-ingest-badge">LIVE STORE SYNC</div>
          <div class="ss-ingest-title">Found <span id="ss-ingest-count">0</span> products on your website</div>
          <p class="ss-ingest-sub">Feed these live store details directly into your StoreSathi portal dashboard.</p>
          <button type="button" id="ss-ingest-btn" class="ss-btn-primary">📥 Approve & Feed to Portal</button>
          <div id="ss-ingest-status" style="display: none; font-size: 0.78rem; margin-top: 8px;"></div>
        </div>

        <div id="ss-recommendations-list">
          <div class="ss-loading">Running intelligence engine...</div>
        </div>

        <div class="ss-copilot-section">
          <h3>💬 Ask Copilot</h3>
          <div id="ss-chat-history"></div>
          <form id="ss-chat-form">
            <input type="text" id="ss-chat-input" placeholder="Ask about sales, stock, or alerts..." autocomplete="off">
            <button type="submit">Ask</button>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  document.querySelector('.ss-close-btn').addEventListener('click', toggleSidebar);

  document.getElementById('ss-ext-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('ss-ext-email').value;
    const password = document.getElementById('ss-ext-password').value;
    const errEl = document.getElementById('ss-ext-login-error');
    errEl.innerText = 'Logging in...';

    chrome.runtime.sendMessage({ action: 'ext_login', email, password }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        errEl.innerText = response?.error || 'Login failed.';
      } else {
        localStorage.setItem('storeSathi_token', 'true');
        localStorage.setItem('storeSathi_storeId', response.user.store_id);
        localStorage.setItem('storeSathi_storeName', response.user.store_name || response.user.email);
        showMainView();
      }
    });
  });

  document.getElementById('ss-chat-form').addEventListener('submit', handleChatSubmit);

  if (localStorage.getItem('storeSathi_token')) {
    showMainView();
  } else {
    document.getElementById('ss-login-view').style.display = 'block';
  }
}

// The merchant's own storefront gets the full inventory engine. Every other website only gets
// market trends. For the demo the storefront is identified by the demo page; add more pages here.
const STORE_PAGES = ['demo.html'];
function isMerchantStore() {
  const path = window.location.pathname.toLowerCase();
  return STORE_PAGES.some(p => path.endsWith(p));
}

function refreshPanel() {
  const greeting = document.querySelector('.ss-greeting p');
  if (isMerchantStore()) {
    if (greeting) greeting.innerText = 'Here are your smart alerts for today.';
    checkAndRenderCatalogIngestion();
    fetchRecommendations();
  } else {
    // Not the merchant's store: no catalogue sync, no inventory alerts — trends only
    const ingest = document.getElementById('ss-ingest-container');
    if (ingest) ingest.style.display = 'none';
    if (greeting) greeting.innerText = 'Market trends spotted on this page.';
    fetchTrends();
  }
  fetchChatHistory();
}

function fetchTrends() {
  const listEl = document.getElementById('ss-recommendations-list');
  listEl.innerHTML = '<div class="ss-loading">Scanning this page for market trends...</div>';
  const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';

  chrome.runtime.sendMessage({ action: 'fetch_trends', data: scrapeProductInfo(), storeId }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      listEl.innerHTML = '<div class="ss-error">Could not reach the StoreSathi backend.<br><small>Make sure it is running on port 3000.</small></div>';
      return;
    }
    recommendations = (response.data && response.data.data) || [];
    if (recommendations.length === 0) {
      listEl.innerHTML = '<div class="ss-empty">No new trends spotted on this page.</div>';
      return;
    }
    renderRecommendations();
  });
}

function showMainView() {
  document.getElementById('ss-login-view').style.display = 'none';
  document.getElementById('ss-main-view').style.display = 'block';
  updateStoreNameUI();
  refreshPanel();
}

// Scrapes entire product catalog from page (tables, grids, cards)
function scrapeCatalog() {
  const products = [];
  
  // 1. Check for table rows (e.g. inventory or admin tables)
  const rows = document.querySelectorAll('table tbody tr');
  if (rows && rows.length > 0) {
    rows.forEach(row => {
      const nameEl = row.querySelector('.product-name') || row.children[0];
      const catEl = row.querySelector('.category-pill') || row.children[1];
      const stockEl = row.querySelector('.stock-ok, .stock-low') || row.children[2];
      const priceText = row.innerText;

      if (nameEl) {
        const rawName = nameEl.innerText.replace(/LOW STOCK|TRENDING|SALE/gi, '').trim();
        const priceMatch = priceText.match(/₹\s*([0-9,]+)/);
        const stockMatch = (stockEl ? stockEl.innerText : priceText).match(/\b(\d{1,4})\b/);
        
        // Skip rows with no readable price rather than inventing one
        if (rawName && rawName.length > 2 && priceMatch) {
          products.push({
            name: rawName,
            category: catEl ? catEl.innerText.trim() : 'Apparel',
            stock_quantity: stockMatch ? parseInt(stockMatch[1]) : 30,
            price: parseFloat(priceMatch[1].replace(/,/g, ''))
          });
        }
      }
    });
  }

  // 2. Fallback: Check single product section
  if (products.length === 0) {
    const pInfo = scrapeProductInfo();
    if (pInfo && pInfo.name && pInfo.price > 0 && pInfo.name !== 'Unknown Product' && !pInfo.name.includes('Store Admin')) {
      products.push({
        name: pInfo.name,
        category: pInfo.category || 'Apparel',
        stock_quantity: 45,
        price: pInfo.price
      });
    }
  }

  return products;
}

// Detects store catalog on current page and offers 1-click Ingestion to Portal
function checkAndRenderCatalogIngestion() {
  const detected = scrapeCatalog();
  const container = document.getElementById('ss-ingest-container');
  const countEl = document.getElementById('ss-ingest-count');
  const btn = document.getElementById('ss-ingest-btn');
  const statusEl = document.getElementById('ss-ingest-status');

  if (!container || !btn) return;

  if (detected.length > 0) {
    container.style.display = 'block';
    countEl.innerText = detected.length;

    // Reset button state
    btn.onclick = () => {
      const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';
      btn.innerText = 'Feeding to Portal...';
      btn.disabled = true;

      chrome.runtime.sendMessage({ action: 'ingest_catalog', products: detected, storeId }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          btn.innerText = 'Sync Failed';
          btn.style.background = '#EF4444';
          statusEl.style.display = 'block';
          statusEl.style.color = '#F87171';
          statusEl.innerText = res?.error || 'Could not connect to StoreSathi backend';
          setTimeout(() => {
            btn.innerText = '📥 Approve & Feed to Portal';
            btn.disabled = false;
            btn.style.background = '';
          }, 2500);
        } else {
          btn.innerText = '✓ Fed to Portal!';
          btn.style.background = '#10B981';
          statusEl.style.display = 'block';
          statusEl.style.color = '#34D399';
          statusEl.innerHTML = `<strong>${res.count || detected.length} products</strong> synced live into your StoreSathi portal!`;
          showLiveToast(`✨ ${res.count || detected.length} products ingested into your portal!`);
        }
      });
    };
  } else {
    container.style.display = 'none';
  }
}

function fetchChatHistory() {
  const historyEl = document.getElementById('ss-chat-history');
  const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';
  
  chrome.runtime.sendMessage({ action: 'fetch_chat_history', storeId: storeId }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      return;
    }
    
    if (response.history && response.history.length > 0) {
      historyEl.innerHTML = '';
      response.history.forEach(msg => {
        const roleClass = msg.role === 'user' ? 'user' : 'ai';
        historyEl.innerHTML += `<div class="ss-chat-msg ${roleClass}">${msg.content}</div>`;
      });
      historyEl.scrollTop = historyEl.scrollHeight;
    }
  });
}

function handleChatSubmit(e) {
  e.preventDefault();
  const inputEl = document.getElementById('ss-chat-input');
  const msg = inputEl.value.trim();
  if (!msg) return;

  const historyEl = document.getElementById('ss-chat-history');
  historyEl.innerHTML += `<div class="ss-chat-msg user">${msg}</div>`;
  inputEl.value = '';
  
  const loadingId = 'loading-' + Date.now();
  historyEl.innerHTML += `<div id="${loadingId}" class="ss-chat-msg ai loading">Thinking...</div>`;
  historyEl.scrollTop = historyEl.scrollHeight;

  const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';
  chrome.runtime.sendMessage({ action: 'ask_copilot', message: msg, storeId: storeId }, (response) => {
    document.getElementById(loadingId)?.remove();
    if (response && response.ok) {
      historyEl.innerHTML += `<div class="ss-chat-msg ai">${response.reply}</div>`;
    } else {
      historyEl.innerHTML += `<div class="ss-chat-msg ai error">Error: ${response ? response.error : 'Network fail'}</div>`;
    }
    historyEl.scrollTop = historyEl.scrollHeight;
  });
}

function updateStoreNameUI() {
  const storeName = localStorage.getItem('storeSathi_storeName') || localStorage.getItem('storeSathi_storeId') || 'Merchant';
  document.getElementById('ss-store-name').innerText = `Welcome back, ${storeName}.`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('storesathi-sidebar');
  isSidebarOpen = !isSidebarOpen;
  
  if (isSidebarOpen) {
    sidebar.classList.add('open');
    if (localStorage.getItem('storeSathi_token')) {
      refreshPanel();
    }
  } else {
    sidebar.classList.remove('open');
  }
}

// Scrapes rich product context from page
function scrapeProductInfo() {
  const bodyText = document.body.innerText || '';

  const titleEl = document.querySelector('h1');
  const name = titleEl
    ? (titleEl.innerText || titleEl.textContent || '').trim()
    : document.title || 'Unknown Product';

  let price = 0;

  // 1. Try finding dedicated product price element near the title or in the product container
  const priceSelectorEl = document.querySelector('.product-price, .price, .product__price, [data-price], [itemprop="price"]');
  if (priceSelectorEl) {
    const pMatch = priceSelectorEl.innerText.match(/([0-9,]+(\.[0-9]{1,2})?)/);
    if (pMatch && pMatch[1]) {
      price = parseFloat(pMatch[1].replace(/,/g, ''));
    }
  }

  // 2. If titleEl is present, look within its parent container
  if (!price && titleEl) {
    const parent = titleEl.closest('.product-page-section, .product-details, article, [class*="product"]');
    if (parent) {
      const parentMatch = parent.innerText.match(/₹\s*([0-9,]+(\.[0-9]{1,2})?)/);
      if (parentMatch && parentMatch[1]) {
        price = parseFloat(parentMatch[1].replace(/,/g, ''));
      }
    }
  }

  // 3. If still not found, check table rows matching name
  if (!price && name) {
    const rows = document.querySelectorAll('table tbody tr');
    rows.forEach(r => {
      if (r.innerText.toLowerCase().includes(name.toLowerCase())) {
        const rMatch = r.innerText.match(/₹\s*([0-9,]+(\.[0-9]{1,2})?)/);
        if (rMatch && rMatch[1]) {
          price = parseFloat(rMatch[1].replace(/,/g, ''));
        }
      }
    });
  }

  // 4. Fallback regex, but strictly exclude Revenue/Sales/Total/Turnover
  if (!price) {
    const cleanBody = bodyText.replace(/(?:today\s+)?revenue[^\n\r]*|sales[^\n\r]*|total\s+amount[^\n\r]*/gi, '');
    const pricePatterns = [
      /₹\s*([0-9,]+(\.[0-9]{1,2})?)/,
      /Rs\.?\s*([0-9,]+(\.[0-9]{1,2})?)/i,
      /\$\s*([0-9,]+(\.[0-9]{1,2})?)/,
      /([0-9,]+)\s*\/-(?: rupees?)?/i,
    ];
    for (const p of pricePatterns) {
      const m = cleanBody.match(p);
      if (m && m[1]) { price = parseFloat(m[1].replace(/,/g, '')); break; }
    }
  }

  let rating = null;
  const ratingMatch = bodyText.match(/(\d\.\d)\s*(?:\/\s*5|out of 5|★)/i)
    || bodyText.match(/(?:rated|rating)[:\s]+(\d\.\d)/i);
  if (ratingMatch) rating = ratingMatch[1];

  let reviewsSummary = null;
  const reviewMatch = bodyText.match(/([0-9,]+)\s*(?:ratings?|reviews?|customers? reviewed)/i);
  if (reviewMatch) reviewsSummary = reviewMatch[0];

  let stockStatus = null;
  const stockPatterns = [
    /only\s+(\d+)\s+left/i,
    /(\d+)\s+in stock/i,
    /hurry[,!]?\s+only/i,
    /out of stock/i,
    /in stock/i,
    /limited stock/i,
  ];
  for (const sp of stockPatterns) {
    const sm = bodyText.match(sp);
    if (sm) { stockStatus = sm[0]; break; }
  }

  const tLower = name.toLowerCase();
  let category = 'Apparel';
  if (tLower.includes('jacket') || tLower.includes('coat') || tLower.includes('bomber')) category = 'Outerwear';
  else if (tLower.includes('dress')) category = 'Dresses';
  else if (tLower.includes('shirt') || tLower.includes('top') || tLower.includes('polo')) category = 'Tops';
  else if (tLower.includes('trouser') || tLower.includes('pant') || tLower.includes('jeans') || tLower.includes('chino')) category = 'Bottoms';
  else if (tLower.includes('co-ord') || tLower.includes('set')) category = 'Sets';
  else if (tLower.includes('kurta') || tLower.includes('saree') || tLower.includes('salwar')) category = 'Ethnic';

  const pageExcerpt = bodyText.replace(/\s+/g, ' ').substring(0, 800);

  return { name, price, category, rating, reviewsSummary, stockStatus, pageExcerpt, pageUrl: window.location.href };
}

function fetchRecommendations() {
  const listEl = document.getElementById('ss-recommendations-list');
  
  // Instant fast-render from cache if available, but discard stale corrupted alerts
  const cached = localStorage.getItem('storeSathi_cached_recs');
  if (cached && !cached.includes('28340')) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) {
        recommendations = parsed;
        renderRecommendations();
      }
    } catch(e) {}
  } else {
    localStorage.removeItem('storeSathi_cached_recs');
    listEl.innerHTML = '<div class="ss-loading">Running intelligence engine...</div>';
  }

  const scrapedData = scrapeProductInfo();
  const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';

  chrome.runtime.sendMessage({ action: 'analyze_page', data: scrapedData, storeId: storeId }, (response) => {
    if (chrome.runtime.lastError) {
      if (recommendations.length === 0) {
        listEl.innerHTML = '<div class="ss-error">Connection error: ' + chrome.runtime.lastError.message + '<br><small>Make sure the StoreSathi backend is running on port 3000.</small></div>';
      }
      return;
    }

    if (response && response.ok && response.data) {
      recommendations = response.data.data;
      if (!recommendations || recommendations.length === 0) {
        listEl.innerHTML = '<div class="ss-error">No alerts right now. Your store looks healthy!</div>';
      } else {
        localStorage.setItem('storeSathi_cached_recs', JSON.stringify(recommendations));
        renderRecommendations();
      }
    } else {
      if (recommendations.length === 0) {
        listEl.innerHTML = '<div class="ss-error">Could not connect to backend.<br><small>Ensure backend is running: npm run dev</small></div>';
      }
    }
  });
}

function getIconForType(type) {
  if (type === 'growth_opportunity') return '🚀';
  if (type === 'weather_restock') return '☁️';
  if (type === 'trend_promotion') return '🔥';
  if (type === 'discount') return '📉';
  if (type === 'restock') return '📦';
  return '💡';
}

function renderRecommendations() {
  const listEl = document.getElementById('ss-recommendations-list');
  listEl.innerHTML = '';
  
  if (recommendations.length === 0) {
    listEl.innerHTML = '<div class="ss-empty">No new alerts today.</div>';
    return;
  }
  
  recommendations.forEach(rec => {
    const card = document.createElement('div');
    card.className = 'ss-rec-card';
    
    let priorityStr = 'Medium';
    try {
      const ev = JSON.parse(rec.evidence_data || '{}');
      if (ev.priority) priorityStr = ev.priority;
    } catch(e) {}
    
    const icon = getIconForType(rec.type);
    
    card.innerHTML = `
      <div class="ss-rec-header">
        <span class="ss-rec-icon">${icon}</span>
        <span class="ss-rec-title">${rec.title}</span>
      </div>
      <div class="ss-rec-desc">${rec.description}</div>
      <div class="ss-rec-footer">
        <span class="ss-badge ss-badge-${priorityStr.toLowerCase()}">${priorityStr} Priority</span>
        <button class="ss-approve-btn" data-id="${rec.id}">Approve Action</button>
      </div>
    `;
    
    listEl.appendChild(card);
  });
  
  document.querySelectorAll('.ss-approve-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      approveAction(id, e.target);
    });
  });
}

// ─── Storefront DOM helpers ─────────────────────────────────────────────────
const fmtINR = (n) => '₹' + Math.round(Number(n)).toLocaleString('en-IN');

// Index of a table column by its header text (Price, Stock, Status...), or -1
function columnIndex(label) {
  const ths = Array.from(document.querySelectorAll('table thead th'));
  return ths.findIndex(th => th.innerText.trim().toLowerCase() === label.toLowerCase());
}

// Table rows whose product name matches exactly (ignoring badges like "LOW STOCK")
function findProductRows(name) {
  const want = (name || '').trim().toLowerCase();
  return Array.from(document.querySelectorAll('table tbody tr')).filter(row => {
    const nameEl = row.querySelector('.product-name') || row.children[0];
    if (!nameEl) return false;
    const rowName = nameEl.innerText.replace(/LOW STOCK|TRENDING|SALE/gi, '').trim().toLowerCase();
    return rowName === want;
  });
}

function setStatusBadge(row, text, bg, fg) {
  const idx = columnIndex('Status');
  const cell = idx >= 0 ? row.children[idx] : null;
  if (cell) cell.innerHTML = `<span class="badge" style="background:${bg};color:${fg}">${text}</span>`;
}

// The single-product section on the page (h1 + .product-price + stock chip), if it shows this product
function productSectionFor(name) {
  const h1 = document.querySelector('h1');
  if (h1 && h1.innerText.trim().toLowerCase() === (name || '').trim().toLowerCase()) return h1.closest('.product-page-section') || document;
  return null;
}

function refreshLowStockKpi() {
  const lowCount = document.querySelectorAll('table tbody tr .stock-low').length;
  document.querySelectorAll('.card').forEach(card => {
    const label = card.querySelector('label');
    if (label && /low stock/i.test(label.innerText)) {
      const val = card.querySelector('.value');
      if (val) val.innerText = lowCount;
    }
  });
}

// Mirrors on the live storefront exactly what the backend just applied to the product.
// `applied` comes from the approve endpoint: { kind, product_name, old/new price or stock, ... }
function applyActionToPage(rec, applied) {
  if (!isMerchantStore()) {
    // We're on someone else's website — never modify its page
    showLiveToast(`✅ Trend action approved: ${applied ? applied.summary : rec.title}`);
    return;
  }
  if (!applied) {
    // Recommendation without a structured action (e.g. AI-written) — nothing concrete to change
    showLiveBanner(`🔥 StoreSathi AI Action Active: ${rec.title}`);
    showLiveToast(`✅ Action approved`);
    return;
  }

  const rows = findProductRows(applied.product_name);
  const section = productSectionFor(applied.product_name);

  if (applied.kind === 'price') {
    const idx = columnIndex('Price');
    rows.forEach(row => {
      const cell = idx >= 0 ? row.children[idx] : null;
      if (cell) {
        cell.innerHTML = `<span style="text-decoration: line-through; color: #9ca3af; font-size: 0.8em;">${fmtINR(applied.old_price)}</span> <strong style="color: #10B981;">${fmtINR(applied.new_price)}</strong>`;
        cell.classList.add('ss-updated-pulse');
      }
      setStatusBadge(row, `${applied.discount_pct}% OFF`, '#d1fae5', '#065f46');
    });
    const priceEl = section && section.querySelector('.product-price');
    if (priceEl) {
      priceEl.innerHTML = `<span style="text-decoration: line-through; color: #9ca3af; font-size: 0.65em; margin-right: 8px;">${fmtINR(applied.old_price)}</span><span style="color: #10B981; font-weight: 700;">${fmtINR(applied.new_price)}</span> <span style="background: #10B981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.45em; vertical-align: middle;">AI OPTIMIZED</span>`;
      priceEl.classList.add('ss-updated-pulse');
    }
    showLiveBanner(`⚡ ${applied.product_name}: price ${fmtINR(applied.old_price)} → ${fmtINR(applied.new_price)} (${applied.discount_pct}% off) is now live on your storefront`);
  }

  else if (applied.kind === 'restock') {
    const idx = columnIndex('Stock');
    rows.forEach(row => {
      const cell = idx >= 0 ? row.children[idx] : null;
      if (cell) {
        cell.className = 'stock-ok';
        cell.innerText = applied.new_stock;
      }
      row.querySelectorAll('.badge-low').forEach(b => b.remove()); // drop the LOW STOCK tag
      setStatusBadge(row, `Restocked +${applied.added}`, '#d1fae5', '#065f46');
    });
    if (section) {
      section.querySelectorAll('.meta-chip').forEach(chip => {
        if (/in stock/i.test(chip.innerText)) {
          chip.innerHTML = `<strong>${applied.new_stock} in stock</strong>`;
          chip.style.background = '#d1fae5';
          chip.style.color = '#065f46';
        }
      });
    }
    refreshLowStockKpi();
    showLiveBanner(`📦 ${applied.product_name}: stock ${applied.old_stock} → ${applied.new_stock} units (+${applied.added} restocked)`);
  }

  else {
    // promo: feature the product
    rows.forEach(row => setStatusBadge(row, applied.label || 'FEATURED', '#ede9fe', '#5b21b6'));
    showLiveBanner(`🔥 ${applied.product_name} is now featured on your storefront (${applied.label || 'promotion'})`);
  }

  showLiveToast(`✅ ${applied.summary}`);
}

function showLiveBanner(text) {
  let banner = document.getElementById('storesathi-live-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storesathi-live-banner';
    document.body.prepend(banner);
  }
  banner.innerHTML = `<span>✨ ${text}</span> <button style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 0.8rem; margin-left: 10px;" onclick="this.parentElement.remove()">✕</button>`;
}

function showLiveToast(text) {
  const existing = document.querySelector('.ss-live-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'ss-live-toast';
  toast.innerText = text;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

function approveAction(id, btnElement) {
  btnElement.innerText = 'Approving...';
  btnElement.disabled = true;
  
  const rec = recommendations.find(r => r.id === id) || { id, title: 'Optimized Action', type: 'discount' };
  const storeId = localStorage.getItem('storeSathi_storeId') || 'store_1';

  chrome.runtime.sendMessage({ action: 'approve_recommendation', id, storeId }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      btnElement.innerText = 'Failed';
      btnElement.style.background = '#EF4444';
      btnElement.style.color = '#fff';
      setTimeout(() => {
        btnElement.innerText = 'Approve Action';
        btnElement.disabled = false;
        btnElement.style.background = '';
      }, 2000);
      return;
    }
    
    btnElement.innerText = 'Approved ✓';
    btnElement.style.background = '#10B981';
    btnElement.style.color = '#fff';

    if (response.data && response.data.alreadyApproved) {
      showLiveToast('ℹ️ This action was already applied');
      return;
    }
    // Mirror the change the backend really made onto the merchant's live page
    applyActionToPage(rec, response.data && response.data.applied);
  });
}

// Initialize
if (!document.getElementById('storesathi-fab')) {
  injectFAB();
  injectSidebar();
}
