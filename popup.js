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
const ipError      = document.getElementById('ipError');
const toggleBtn    = document.getElementById('toggleBtn');
const noConfig     = document.getElementById('noConfig');

const inputHost = document.getElementById('inputHost');
const inputPort = document.getElementById('inputPort');
const saveBtn   = document.getElementById('saveBtn');
const saveMsg   = document.getElementById('saveMsg');

let isConnected = false;
let currentHost = null;
let currentPort = null;

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
    try {
      // Ensure proxy is actually applied before calling the IP endpoints.
      await chrome.runtime.sendMessage({ action: 'enable', host, port: parseInt(port) });
    } catch (e) {
      console.warn('[EC2 Proxy] enable handshake failed:', e);
    }
    fetchIpInfo();
  } else {
    setConnected(false);
  }
}

// ─── UI State ────────────────────────────────────────────────────────────────

function setConnected(connected, host, port) {
  isConnected = connected;

  if (connected) {
    currentHost = host;
    currentPort = port;
    ipError.classList.remove('show');
    statusRing.classList.add('connected');
    statusLabel.classList.add('connected');
    statusLabel.textContent = 'Connected';
    ipSection.classList.remove('hidden');
    serverDisplay.textContent = `${host}:${port}`;
    toggleBtn.textContent = '';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Disconnect`;
    toggleBtn.classList.add('disconnect');
  } else {
    currentHost = null;
    currentPort = null;
    statusRing.classList.remove('connected');
    statusLabel.classList.remove('connected');
    statusLabel.textContent = 'Not Connected';
    ipSection.classList.add('hidden');
    ipError.classList.remove('show');
    publicIp.textContent = '—';
    ipLocation.textContent = '—';
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M6 8H5a4 4 0 0 0 0 8h1"/>
        <line x1="6" y1="12" x2="18" y2="12"/>
      </svg>
      Connect`;
    toggleBtn.classList.remove('disconnect');
  }
}

// ─── IP Info ─────────────────────────────────────────────────────────────────

async function fetchIpInfo() {
  publicIp.textContent = '...';
  publicIp.classList.add('loading');
  ipLocation.textContent = '...';
  ipLocation.classList.add('loading');
  ipError.classList.remove('show');

  const formatLocation = (data) => {
    const parts = [];

    const city = data?.city;
    const region =
      data?.region ||
      data?.region_name ||
      data?.state ||
      data?.regionName;
    const country =
      data?.country_name ||
      data?.country ||
      data?.countryName;

    if (city) parts.push(city);
    if (region) parts.push(region);
    if (country) parts.push(country);

    if (parts.length) return parts.join(', ');
    return country || '?';
  };

  const defaultHeaders = {
    Accept: 'application/json',
    'User-Agent': 'EC2-Proxy-Extension'
  };

  const fetchJsonWithTimeout = async (url, timeoutMs = 8000, fetchOptions = {}) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: { ...defaultHeaders, ...(fetchOptions.headers || {}) }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  };

  let ip = null;
  try {
    // 1) IP only (avoid providers that may block / return incomplete geo).
    const ipData = await fetchJsonWithTimeout('https://api.ipify.org?format=json');
    ip = ipData?.ip;
    if (!ip) throw new Error('No IP in ipify response');

    publicIp.textContent = ip;

    // 2) Location by IP (provider fallback chain).
    // ipapi/ip-api may return 403 from some EC2 networks, so we try multiple providers.
    let locationText = '—';

    // Provider #1: ipapi.co
    try {
      const locData = await fetchJsonWithTimeout(
        `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      );
      const formatted = formatLocation(locData);
      if (formatted && formatted !== '?') locationText = formatted;
    } catch (e1) {
      console.warn('[EC2 Proxy] Location provider #1 failed:', e1);
    }

    // Provider #2: ip-api.com (no API key)
    if (locationText === '—') {
      try {
        const ipApi = await fetchJsonWithTimeout(
          `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,message`
        );
        if (ipApi?.status !== 'success') throw new Error(ipApi?.message || 'geo lookup failed');

        const parts = [];
        if (ipApi?.city) parts.push(ipApi.city);
        if (ipApi?.regionName) parts.push(ipApi.regionName);
        const country = ipApi?.country;
        locationText = parts.length
          ? `${parts.join(', ')}, ${country || '?'}`
          : (country || '?');
      } catch (e2) {
        console.warn('[EC2 Proxy] Location provider #2 failed:', e2);
      }
    }

    // Provider #3: ipwho.is (no API key)
    if (locationText === '—') {
      try {
        const who = await fetchJsonWithTimeout(
          `https://ipwho.is/${encodeURIComponent(ip)}`
        );
        // ipwho.is returns { success: true/false, city, region, country, ... }
        if (who?.success === false) throw new Error(who?.message || 'geo lookup failed');
        const parts = [];
        if (who?.city) parts.push(who.city);
        if (who?.region) parts.push(who.region);
        if (who?.country) parts.push(who.country);
        locationText = parts.length ? parts.join(', ') : (who?.country || '?');
      } catch (e3) {
        console.warn('[EC2 Proxy] Location provider #3 failed:', e3);
      }
    }

    // Provider #4: reallyfreegeoip.org (no API key)
    if (locationText === '—') {
      try {
        const rf = await fetchJsonWithTimeout(
          `https://reallyfreegeoip.org/json/${encodeURIComponent(ip)}`
        );
        const city = rf?.city || '';
        const region = rf?.region_name || rf?.regionName || '';
        const country = rf?.country_name || rf?.country || '';

        if (city || region || country) {
          const parts = [];
          if (city) parts.push(city);
          if (region) parts.push(region);
          if (country) parts.push(country);
          locationText = parts.length ? parts.join(', ') : '—';
        }
      } catch (e4) {
        console.warn('[EC2 Proxy] Location provider #4 failed:', e4);
      }
    }

    // Provider #5: freeipapi.com (no API key)
    if (locationText === '—') {
      try {
        const fip = await fetchJsonWithTimeout(
          `https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`
        );
        const city = fip?.cityName || '';
        const region = fip?.regionName || '';
        const country = fip?.countryName || '';

        if (city || region || country) {
          const parts = [];
          if (city) parts.push(city);
          if (region) parts.push(region);
          if (country) parts.push(country);
          locationText = parts.length ? parts.join(', ') : '—';
        }
      } catch (e5) {
        console.warn('[EC2 Proxy] Location provider #5 failed:', e5);
      }
    }

    ipLocation.textContent = locationText;

    if (locationText === '?' || locationText === '—') {
      ipError.textContent =
        'Location lookup failed. Geo providers may block EC2 IPs (403). ' +
        'Please try again later, or use an EC2 setup where outbound access is allowed.';
      ipError.classList.add('show');
    }
  } catch (err) {
    console.error('[EC2 Proxy] IP lookup failed:', err);
    publicIp.textContent = 'Could not fetch';
    ipLocation.textContent = '—';

    const hostTxt = currentHost ? `${currentHost}:${currentPort}` : 'EC2 proxy';
    const portTxt = currentPort ?? 1080;
    ipError.textContent =
      `Proxy connection failed: ${hostTxt}. ` +
      `Make sure SOCKS5 (microsocks) is running on EC2 and that TCP ` +
      `${portTxt} is reachable from your machine (Security Group / firewall). ` +
      `Bind microsocks to 0.0.0.0 (e.g. use: -i 0.0.0.0).`;
    ipError.classList.add('show');
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
    setConnected(true, host, port);
    try {
      // Wait until background finishes applying chrome.proxy.settings.
      await chrome.runtime.sendMessage({ action: 'enable', host, port: parseInt(port) });
    } catch (e) {
      console.warn('[EC2 Proxy] enable handshake failed:', e);
    }
    fetchIpInfo();
  } else {
    try {
      await chrome.runtime.sendMessage({ action: 'disable' });
    } catch (e) {
      console.warn('[EC2 Proxy] disable handshake failed:', e);
    }
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
    flash('⚠️ IP address cannot be empty', 'error');
    return;
  }

  if (!port || port < 1 || port > 65535) {
    flash('⚠️ Enter a valid port (1-65535)', 'error');
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

  flash('✓ Settings saved', 'success');

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
