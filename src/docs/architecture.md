# Architecture

## Overview

Orbital is a **Vue 3 + Ionic + Pinia** single-page application for managing multiple Pi-hole instances from a unified dashboard. All communication happens directly between your browser and the Pi-hole — there is no backend server.

## File Structure

```
src/
├── assets/
│   └── global.css              # Design system: tokens, themes, utilities
├── components/
│   ├── dashboard/
│   │   ├── DisableBlockingModal.vue
│   │   └── InstanceCard.vue
│   ├── blocklists/
│   │   ├── AddDomainForm.vue
│   │   ├── DomainListTable.vue
│   │   └── InstanceTabBar.vue
│   ├── hardware/
│   │   └── HardwareCard.vue
│   ├── statistics/
│   │   ├── StatsOverviewCards.vue
│   │   ├── StatsChart.vue
│   │   └── TopDomainsCard.vue
│   ├── ui/
│   │   ├── EmptyState.vue
│   │   ├── MetricGauge.vue
│   │   ├── PageHeader.vue
│   │   ├── StatCard.vue
│   │   └── TopDomainsBar.vue
│   └── ToastContainer.vue
├── composables/
│   ├── useAppSettings.ts       # Poll intervals, log limits (persisted)
│   ├── useBlockingControl.ts   # Enable/disable with toast feedback
│   ├── useClipboard.ts
│   ├── useFormatting.ts        # fmt, fmtPct, date helpers
│   └── useLivePolling.ts
├── docs/                       # Markdown files rendered by DocsView
│   ├── getting-started.md
│   ├── dashboard.md
│   ├── query-log.md
│   ├── block-lists.md
│   ├── statistics.md
│   ├── hardware.md
│   ├── api-compatibility.md
│   ├── cors-and-proxy.md
│   ├── troubleshooting.md
│   └── architecture.md         ← this file
├── router/index.ts
├── services/
│   ├── hardwareService.ts
│   └── piholeApi.ts            # Pi-hole v5 + v6 API client
├── stores/
│   ├── instanceStore.ts        # Core store: CRUD, polling, status resilience
│   └── notificationStore.ts
├── tests/
│   ├── components/
│   ├── integration/
│   ├── unit/
│   └── setup.ts
├── types/
│   ├── api.ts
│   ├── hardware.ts
│   ├── index.ts
│   └── instance.ts
└── views/
    ├── BlockListsView.vue
    ├── DashboardView.vue
    ├── DocsView.vue            # Loads & renders docs/*.md at runtime
    ├── HardwareView.vue
    ├── QueryLogView.vue
    ├── SettingsView.vue
    └── StatisticsView.vue
```

## Component API Style

All components use the **Options API** (`defineComponent` with `data()`, `computed`, `methods`). This keeps component logic readable top-to-bottom and consistent across the codebase.

Composables are called inside `data()` or `methods()` — never in `setup()` — to maintain a clear Options API boundary.

## State Management — instanceStore

`instanceStore` (Pinia) is the single source of truth for all Pi-hole instance data.

### Reactive-update pattern

All per-instance maps (`summaryData`, `loading`, `errors`) are updated **immutably** using object spread:

```ts
// ✅ Correct — triggers Vue reactivity
this.summaryData = { ...this.summaryData, [id]: newSummary };

// ❌ Wrong — Vue may miss the mutation
this.summaryData[id] = newSummary;
```

### Status resilience

An instance is only marked `"offline"` after **2 consecutive** failed refreshes. A single transient error keeps the current status.

```
Fail 1  → keep current status, store error message
Fail 2  → mark offline
Success → mark online, reset fail counter
```

### Polling lifecycle

`startPolling()` / `stopPolling()` are called from `App.vue`. Guards prevent double-polling:

```ts
startPolling(): void {
  if (this._pollHandle) return;
  this._pollHandle = setInterval(() => void this.refreshAll(), intervalMs);
}
```

## Design System

All colours, spacing, radii and shadows are CSS custom properties in `global.css`. Two themes are supported:

| Attribute | Theme |
|---|---|
| `[data-theme="dark"]` (default) | Dark mission-control |
| `[data-theme="light"]` | Light / accessible |

The active theme is toggled by setting `data-theme` on `<html>` and persisted to `localStorage` under the key `orbital_theme`.

### Key design tokens

| Token | Purpose |
|---|---|
| `--accent` | Brand colour (single token — change once to retheme) |
| `--space-1` … `--space-6` | Spacing scale (4 px base) |
| `--radius-sm` … `--radius-xl` | Border radius scale |
| `--shadow-sm/md/lg` | Elevation shadows |
| `--color-*` / `--color-*-subtle` / `--color-*-border` | Semantic colours with tinted variants |

### StatCard

`StatCard` renders a stat card with a **2 px top accent stripe**, a tinted icon chip, and a large monospaced number.

```html
<StatCard
  label="Blocked Today"
  value="1,234"
  accent="red"
  :icon="shieldOutline"
  sub="last 24 h"
/>
```

## Documentation System

`DocsView.vue` loads Markdown files from `src/docs/` at runtime using Vite's `import.meta.glob` with `?raw` imports. A lightweight built-in renderer converts Markdown to HTML — no external dependency required.

To add a new documentation page:
1. Create a `.md` file in `src/docs/`
2. Add an entry to the `sections` array in `DocsView.vue`

```ts
{ id: 'my-topic', title: 'My Topic', file: 'my-topic.md' }
```
