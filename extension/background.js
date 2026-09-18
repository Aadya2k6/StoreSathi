console.log("StoreSathi: Background service worker loaded.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("StoreSathi: Extension installed.");
});

// ─── Keep the service worker alive ───────────────────────────────────────────
// MV3 service workers go dormant after 30s of inactivity. We keep it awake
// by scheduling a periodic no-op via the chrome.alarms API.
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // No-op: just prevents service worker from going dormant
  }
});

// ─── Handle ingest requests from content scripts ─────────────────────────────
// Content scripts cannot fetch localhost from HTTPS page origins due to Chrome's
// Private Network Access policy. The background service worker (extension context)
// does NOT have this restriction, so we proxy the request through here.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ingest' && request.data) {
    fetch('http://localhost:3000/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data)
    })
      .then(res => {
        if (res.ok) {
          return res.json().then(json => sendResponse({ ok: true, data: json }));
        } else {
          return res.json().catch(() => ({})).then(err => {
            sendResponse({ ok: false, error: `HTTP ${res.status}`, details: err });
          });
        }
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    // CRITICAL: return true to keep the message channel open for async sendResponse
    return true;
  }
  
  if (request.action === 'fetch_opportunities' && request.url) {
    fetch(`http://localhost:3000/opportunities?url=${request.url}`)
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

    return true;
  }
  if (request.action === 'send_opportunity' && request.id) {
    fetch(`http://localhost:3000/opportunities/${request.id}/send`, {
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

    return true;
  }
});
