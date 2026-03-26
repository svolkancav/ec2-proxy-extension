// EC2 Proxy — Popup Logic

const mainView     = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');
const settingsBtn  = document.getElementById('settingsToggle');
const statusRing   = document.getElementById('statusRing');
const statusLabel  = document.getElementById('statusLabel');
const ipSection    = document.getElementById('ipSection');
const serverDisplay= document.getElementById('serverDisplay');
const publicIp     = document.getElementById('publicIp');
const ipLocation   = document.getElementById('ipLocation');
const toggleBtn    = document.getElementById('toggleBtn');
const noConfig     = document.getElementById('noConfig');

const inputHost = document.getElementById('inputHost');
const inputPort = document.getElementById('inputPort');
const saveBtn   = document.getElementById('saveBtn');
const saveMsg   = document.getElementById('saveMsg');

let isConnected = false;

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const { host, port, enabled } = await chrome.storage.local.get(['host', 'port', 'enabled']);

  // Pre-fill settings fields
  if (host) inputHost.value = host;
  if (port) inputPort.value = port;

  // No config yet
  if (!host || !port) {
    noConfig.style.display = 'block';
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = '0.4';
    toggleBtn.style.cursor = 'not-allowed';
    return;
  }

  if (enabled) {
    setConnected(true, host, port);
    fetchIpInfo();
  } else {
    setConnected(false);
  }
}

// ─── UI State ────────────────────────────────────────────────────────────────

function setConnected(connected, host, port) {
  isConnected = connected;

  if (connected) {
    statusRing.classList.add('connected');
    statusLabel.classList.add('connected');
    statusLabel.textContent = 'Bağlı';
    ipSection.classList.remove('hidden');
    serverDisplay.textContent = `${host}:${port}`;
    toggleBtn.textContent = '';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Bağlantıyı Kes`;
    toggleBtn.classList.add('disconnect');
  } else {
    statusRing.classList.remove('connected');
    statusLabel.classList.remove('connected');
    statusLabel.textContent = 'Bağlı Değil';
    ipSection.classList.add('hidden');
    publicIp.textContent = '—';
    ipLocation.textContent = '—';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M6 8H5a4 4 0 0 0 0 8h1"/>
        <line x1="6" y1="12" x2="18" y2="12"/>
      </svg>
      Bağlan`;
    toggleBtn.classList.remove('disconnect');
  }
}

// ─── IP Info ─────────────────────────────────────────────────────────────────

async function fetchIpInfo() {
  publicIp.textContent = '...';
  publicIp.classList.add('loading');
  ipLocation.textContent = '...';
  ipLocation.classList.add('loading');

  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    publicIp.textContent = data.ip || '?';
    ipLocation.textContent = `${data.city || ''}, ${data.country_name || '?'}`;
  } catch {
    publicIp.textContent = 'Alınamadı';
    ipLocation.textContent = '—';
  } finally {
    publicIp.classList.remove('loading');
    ipLocation.classList.remove('loading');
  }
}

// ─── Toggle Connect ───────────────────────────────────────────────────────────

toggleBtn.addEventListener('click', async () => {
  const { host, port } = await chrome.storage.local.get(['host', 'port']);
  if (!host || !port) return;

  if (!isConnected) {
    chrome.runtime.sendMessage({ action: 'enable', host, port: parseInt(port) });
    setConnected(true, host, port);
    fetchIpInfo();
  } else {
    chrome.runtime.sendMessage({ action: 'disable' });
    setConnected(false);
  }
});

// ─── Settings Toggle ──────────────────────────────────────────────────────────

settingsBtn.addEventListener('click', () => {
  const onSettings = settingsView.classList.contains('active');
  mainView.classList.toggle('active', onSettings);
  settingsView.classList.toggle('active', !onSettings);
});

// ─── Save Settings ────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const host = inputHost.value.trim();
  const port = parseInt(inputPort.value.trim());

  if (!host) {
    flash('⚠️ IP adresi boş olamaz', 'error');
    return;
  }

  if (!port || port < 1 || port > 65535) {
    flash('⚠️ Geçerli bir port gir (1-65535)', 'error');
    return;
  }

  await chrome.storage.local.set({ host, port, enabled: false });

  // Reset connection state if settings changed
  chrome.runtime.sendMessage({ action: 'disable' });
  setConnected(false);

  // Hide no-config warning
  noConfig.style.display = 'none';
  toggleBtn.disabled = false;
  toggleBtn.style.opacity = '1';
  toggleBtn.style.cursor = 'pointer';

  flash('✓ Ayarlar kaydedildi', 'success');

  setTimeout(() => {
    settingsView.classList.remove('active');
    mainView.classList.add('active');
  }, 900);
});

function flash(msg, type) {
  saveMsg.textContent = msg;
  saveMsg.style.color = type === 'error' ? '#ff4d6a' : 'var(--accent)';
  setTimeout(() => { saveMsg.textContent = ''; }, 2500);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
