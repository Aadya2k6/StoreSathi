console.log("StoreSathi: Background service worker loaded.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("StoreSathi: Extension installed.");
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
});
