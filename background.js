// EC2 Proxy - Background Service Worker

// Apply proxy settings on startup if previously enabled
chrome.runtime.onStartup.addListener(async () => {
  const { enabled, host, port } = await chrome.storage.local.get(['enabled', 'host', 'port']);
  if (enabled && host && port) {
    applyProxy(host, parseInt(port));
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'enable') {
    applyProxy(msg.host, msg.port, () => {
      chrome.storage.local.set(
        { enabled: true, host: msg.host, port: msg.port },
        () => sendResponse({ success: true })
      );
    });
    return true; // async: sendResponse happens in applyProxy callback
  } else if (msg.action === 'disable') {
    clearProxy(() => {
      chrome.storage.local.set({ enabled: false }, () => sendResponse({ success: true }));
    });
    return true; // async: sendResponse happens in clearProxy callback
  } else if (msg.action === 'getStatus') {
    chrome.storage.local.get(['enabled', 'host', 'port'], (data) => {
      sendResponse(data);
    });
    return true; // async
  }
});

function applyProxy(host, port, onApplied) {
  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'socks5',
        host: host,
        port: port
      },
      // Geo/IP providers sometimes block requests that originate from EC2.
      // We still want "General IP" to be fetched via the proxy, so we do NOT
      // bypass the IP provider (ipify). Instead, we bypass geo lookup hosts.
      bypassList: [
        'localhost',
        '127.0.0.1',
        'ipapi.co',
        'ip-api.com',
        'ipwho.is'
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
