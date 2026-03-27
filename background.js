// EC2 Proxy - Background Service Worker

// ─── Core: re-apply proxy whenever the SW wakes up ───────────────────────────
// Chrome MV3 terminates the service worker after ~30s of inactivity.
// When it wakes again (new request, alarm, etc.) we must re-apply the proxy.
async function restoreProxyIfNeeded() {
  const { enabled, host, port } = await chrome.storage.local.get(['enabled', 'host', 'port']);
  if (enabled && host && port) {
    applyProxy(host, parseInt(port));
  }
}

// Runs on browser startup (cold start)
chrome.runtime.onStartup.addListener(() => {
  restoreProxyIfNeeded();
});

// Runs every time the service worker is instantiated (handles SW termination/wake)
restoreProxyIfNeeded();

// ─── Keep-alive alarm: wake SW every ~1min so proxy stays applied ────────────
// We check first — recreating on every SW wake would reset the timer,
// making the alarm fire unreliably. Chrome's minimum period is 1 minute.
chrome.alarms.get('keepAlive', (existing) => {
  if (!existing) {
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    restoreProxyIfNeeded();
  }
});

// ─── Detect external proxy changes and re-apply ───────────────────────────────
// If the OS, another extension, or a network change resets proxy settings,
// this listener fires and we immediately restore ours.
chrome.proxy.settings.onChange.addListener(async (details) => {
  // Only act if we control 'regular' scope and extension is supposed to be on
  if (details.levelOfControl !== 'controlled_by_this_extension') {
    const { enabled, host, port } = await chrome.storage.local.get(['enabled', 'host', 'port']);
    if (enabled && host && port) {
      console.warn('[EC2 Proxy] Proxy was changed externally — restoring...');
      applyProxy(host, parseInt(port));
    }
  }
});

// ─── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'enable') {
    applyProxy(msg.host, msg.port, () => {
      chrome.storage.local.set(
        { enabled: true, host: msg.host, port: msg.port },
        () => sendResponse({ success: true })
      );
    });
    return true;
  } else if (msg.action === 'disable') {
    clearProxy(() => {
      chrome.storage.local.set({ enabled: false }, () => sendResponse({ success: true }));
    });
    return true;
  } else if (msg.action === 'getStatus') {
    chrome.storage.local.get(['enabled', 'host', 'port'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});

// ─── Proxy helpers ────────────────────────────────────────────────────────────
function applyProxy(host, port, onApplied) {
  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'socks5',
        host: host,
        port: port
      },
      bypassList: [
        'localhost',
        '127.0.0.1'
      ]
    }
  };
  chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
    console.log(`[EC2 Proxy] Connected → ${host}:${port}`);
    if (typeof onApplied === 'function') onApplied();
  });
}

function clearProxy(onCleared) {
  chrome.proxy.settings.clear({ scope: 'regular' }, () => {
    console.log('[EC2 Proxy] Disconnected');
    if (typeof onCleared === 'function') onCleared();
  });
}
