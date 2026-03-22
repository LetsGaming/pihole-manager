# Getting Started

Orbital is a multi-instance Pi-hole management dashboard. Manage all your Pi-hole instances from one place — no server, no account, no data leaving your browser.

## Requirements

- A running **Pi-hole v5 or v6** instance reachable from your browser
- Your Pi-hole **API token** (v5) or **web password** (v6)
- The Pi-hole admin UI accessible from the same network

## Quick Setup

1. Open **Settings** in the sidebar
2. Click **Add Instance**
3. Fill in *Name*, *URL*, and *API Token / Password*
4. Click **Test Connection** to verify
5. Click **Save** — the dashboard appears immediately

## URL Format

Use the bare host — no trailing slash, no `/admin` path:

```
http://192.168.1.100
http://pi.hole:8080
https://pihole.home.arpa
```

## API Token vs. Password

| Pi-hole version | Credential | Where to find it |
|---|---|---|
| v5 | API Token (hex string) | Admin → Settings → API / Web Interface → Show API token |
| v6 | Web Password | The password you use to log in to the admin UI |

Select the correct version in the instance form — the label updates automatically.

## Data Storage

All instance configurations (URLs, credentials) are stored in your **browser's localStorage**. Nothing is sent to any server. Use **Settings → Export Config** to back up or transfer your setup.
