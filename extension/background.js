console.log("StoreSathi: Background service worker loaded.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("StoreSathi: Extension installed.");
});

// ─── Keep the service worker alive ───────────────────────────────────────────
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // No-op
  }
});

// ─── Handle API requests from content scripts ─────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'fetch_recommendations') {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/intelligence/recommendations?store_id=${storeId}`)
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, data: json }));
        } else {
          sendResponse({ ok: false, error: `HTTP ${res.status}` });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep channel open
  }

  if (request.action === 'analyze_page' && request.data) {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/intelligence/analyze-page?store_id=${storeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data)
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, data: json }));
        } else {
          sendResponse({ ok: false, error: `HTTP ${res.status}` });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep channel open
  }

  if (request.action === 'ingest_catalog' && request.products) {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/catalogue/bulk-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: storeId, products: request.products })
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, data: json }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: err.error || `HTTP ${res.status}` });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep channel open
  }

  if (request.action === 'approve_recommendation' && request.id) {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/intelligence/recommendations/${request.id}/approve?store_id=${storeId}`, {
      method: 'POST'
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, data: json }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: err.error || `HTTP ${res.status}` });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep channel open
  }

  if (request.action === 'ask_copilot' && request.message) {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/intelligence/copilot/chat?store_id=${storeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: request.message })
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, reply: json.reply }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: err.error || `HTTP ${res.status}` });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'fetch_chat_history') {
    const storeId = request.storeId || 'store_1';
    fetch(`http://localhost:3000/api/intelligence/copilot/history?store_id=${storeId}`)
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, history: json }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: err.error || `HTTP ${res.status}` });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'ext_login') {
    fetch(`http://localhost:3000/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password })
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, user: json.user }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: err.error || `HTTP ${res.status}` });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }
});
