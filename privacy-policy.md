# Privacy Policy (EC2 Proxy)

Last updated: 2026-03-26

This Privacy Policy explains how the “EC2 Proxy” Chrome extension (“Extension”) handles information when you use it.

## What this Extension does

The Extension configures Chrome to route your browsing traffic through an Amazon EC2-hosted SOCKS5 proxy. You enter your EC2 server host and SOCKS5 port in the extension, and then you can connect or disconnect with one click.

## Information we collect

### 1) Data stored locally in your browser

When you save settings, the Extension stores the following values locally in your browser using `chrome.storage.local`:

- EC2 host (IP address or hostname)
- SOCKS5 port
- Enabled/disabled state

This stored data is used only to remember your connection settings on your device. It is not transmitted to the Extension developer.

### 2) Public IP and approximate location (when connected)

When the Extension is enabled/connected, the Extension requests the public IP and approximate location for display in the extension UI by calling `https://ipapi.co/json/`.

This request sends your public IP address to `ipapi.co` so it can return an approximate city and country. The returned information is shown in the Extension popup.

## How we use information

We use the locally stored settings to enable and disable your SOCKS5 proxy connection.

We use the public IP and approximate location (retrieved via `ipapi.co`) only to display a preview in the extension UI while you are connected.

## Sharing

### Third-party service

While connected, the Extension communicates with `ipapi.co` to retrieve public IP and approximate location information for display.

Otherwise, the Extension does not sell, rent, or share personal data with third parties.

## Your choices

- You can disable the proxy at any time from the Extension popup.
- You can remove saved EC2 settings by clearing the extension’s local storage (via Chrome settings or by resetting extension storage).

## Security

The Extension uses Chrome’s built-in storage and proxy APIs. However, no system is completely secure. You should use your own discretion when configuring a proxy server.

## Contact

If you have questions about this Privacy Policy, contact the extension developer at:

- `cavusogluvolkan61@gmail.com`

## Changes to this Privacy Policy

We may update this Privacy Policy from time to time. The “Last updated” date above indicates when the latest changes were made.

