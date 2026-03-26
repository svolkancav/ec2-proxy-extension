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
    applyProxy(msg.host, msg.port);
    chrome.storage.local.set({ enabled: true, host: msg.host, port: msg.port });
    sendResponse({ success: true });
  } else if (msg.action === 'disable') {
    clearProxy();
    chrome.storage.local.set({ enabled: false });
    sendResponse({ success: true });
  } else if (msg.action === 'getStatus') {
    chrome.storage.local.get(['enabled', 'host', 'port'], (data) => {
      sendResponse(data);
    });
    return true; // async
  }
});

function applyProxy(host, port) {
  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'socks5',
        host: host,
        port: port
      },
      bypassList: ['localhost', '127.0.0.1']
    }
  };
  chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
    console.log(`[EC2 Proxy] Connected → ${host}:${port}`);
  });
}

function clearProxy() {
  chrome.proxy.settings.clear({ scope: 'regular' }, () => {
    console.log('[EC2 Proxy] Disconnected');
  });
}
