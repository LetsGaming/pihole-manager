# Orbital — Pi-hole Multi-Instance Manager

A multi-instance Pi-hole dashboard built with **Ionic Vue 8**, **TypeScript**, **Pinia**, and **Vite**.

## Quick Start

```bash
git clone https://github.com/your-org/pihole-manager.git
cd pihole-manager
npm install
npm run dev          # → http://localhost:5173
```

Then open **Settings**, add your first Pi-hole instance (URL + API token), and you're running.

## Features

- **Manage unlimited instances** — switch between them in the sidebar
- **Live query log** — filterable, pauseable, with one-click block/whitelist from entries
- **Global blocking control** — enable/disable all instances at once with optional timer
- **Block lists** — adlists, blacklist, whitelist, regex lists, gravity update
- **Statistics** — 24h charts, top queried/blocked domains, top clients
- **Hardware monitor** — CPU, RAM, disk, temperature (hidden in VMs), uptime, versions
- **Settings** — add/edit/test instances, export/import config, adjustable poll intervals
- **Persistent** — everything stored in `localStorage`, no server or account needed

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Run 250 tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Coverage report in `coverage/` |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint (warnings only) |
| `npm run lint:fix` | ESLint with auto-fix |

## Pi-hole Requirements

- Pi-hole v5 or v6 running on your local network
- API token: Pi-hole admin → Settings → API / Web Interface → Show API token
- Browser must be able to reach the Pi-hole admin URL — see [CORS setup](./docs/cors-and-proxy.md)

## Documentation

| Doc | Contents |
|---|---|
| [Architecture](./docs/architecture.md) | File structure, layers, data flow, how to add features |
| [API Compatibility](./docs/api-compatibility.md) | v5/v6 support matrix, auth, hardware data availability |
| [CORS & Proxy](./docs/cors-and-proxy.md) | Nginx, Caddy, Vite proxy, multi-instance setups |
| [Testing](./docs/testing.md) | Test structure, patterns, writing new tests |
| [Troubleshooting](./docs/troubleshooting.md) | Common problems and fixes |

## License

MIT
