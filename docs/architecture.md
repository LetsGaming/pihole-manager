# Architecture

## Overview

Orbital is a Vue 3 + Ionic + Pinia single-page application for managing multiple Pi-hole instances from a unified dashboard.

```
src/
├── assets/
│   └── global.css          # Design system: tokens, themes, utilities
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
│   ├── querylog/
│   │   ├── QueryLogRow.vue
│   │   └── QueryLogToolbar.vue
│   ├── settings/
│   │   └── InstanceForm.vue
│   ├── statistics/            ← extracted sub-components for Statistics view
│   │   ├── StatsOverviewCards.vue   # 6 stat cards (queries, blocked, etc.)
│   │   ├── StatsChart.vue           # Chart.js 24h over-time chart
│   │   └── TopDomainsCard.vue       # Reusable top-N bar chart card
│   ├── ui/
│   │   ├── EmptyState.vue
│   │   ├── MetricGauge.vue
│   │   ├── PageHeader.vue
│   │   ├── StatCard.vue       # Pi-hole-style stat card with left accent border + icon
│   │   └── TopDomainsBar.vue  # Single domain/client bar row
│   └── ToastContainer.vue
├── composables/
│   ├── useAppSettings.ts      # Poll intervals, log limits (persisted to localStorage)
│   ├── useBlockingControl.ts  # enable/disable blocking with toast feedback
│   ├── useClipboard.ts
│   ├── useFormatting.ts       # fmt, fmtPct, barWidth, date helpers
│   └── useLivePolling.ts
├── router/
│   └── index.ts
├── services/
│   ├── hardwareService.ts
│   └── piholeApi.ts           # Pi-hole v5 + v6 API client
├── stores/
│   ├── instanceStore.ts       # Core store: CRUD, polling, status resilience
│   └── notificationStore.ts
├── tests/
│   ├── components/            # Component-level tests (mount + stubs)
│   ├── integration/           # Multi-instance + router tests
│   ├── unit/                  # Store + service unit tests
│   └── setup.ts
├── types/
│   ├── api.ts
│   ├── hardware.ts
│   ├── index.ts
│   └── instance.ts
└── views/
    ├── BlockListsView.vue
    ├── DashboardView.vue
    ├── DocsView.vue
    ├── HardwareView.vue
    ├── QueryLogView.vue
    ├── SettingsView.vue
    └── StatisticsView.vue
```

## Component API Style

All Vue components use the **Options API** (`defineComponent` with `data()`, `computed`, `methods`, `watch`, lifecycle hooks). This makes component logic easy to read top-to-bottom, straightforward to debug with Vue DevTools, and consistent across the whole codebase.

```ts
export default defineComponent({
  name: "MyComponent",
  components: { ... },
  props: { ... },
  emits: [...],

  data() { return { ... }; },
  computed: { ... },
  watch:    { ... },

  mounted()       { ... },
  beforeUnmount() { ... },

  methods: { ... },
});
```

Composables (`useFormatting`, `useBlockingControl`, etc.) are called inside `data()` or `methods()` — never in `setup()` — to keep the Options API boundary clear.

## State Management — instanceStore

`instanceStore` (Pinia) is the single source of truth for all Pi-hole instance data.

### Reactive-update pattern

All per-instance maps (`summaryData`, `loading`, `errors`, `_failCount`) are updated **immutably** using object spread so Vue's reactivity system always detects the change:

```ts
// ✅ Correct — triggers reactivity
this.summaryData = { ...this.summaryData, [id]: newSummary };
this.loading     = { ...this.loading,     [id]: false };

// ❌ Wrong — Vue may miss the update
this.summaryData[id] = newSummary;
```

The `instances` array is also replaced rather than mutated in-place (`_setStatus`, `updateInstance`, `addInstance`, `removeInstance`).

### Status resilience

An instance is only marked `"offline"` after `OFFLINE_THRESHOLD` (2) **consecutive** failed refreshes. A single transient error keeps the current status. Recovery resets the counter immediately.

```
Fail 1  → keep current status, store error
Fail 2  → mark offline
Success → mark online, reset fail counter
```

### Polling lifecycle

`startPolling()` / `stopPolling()` are called by the view that owns the polling lifecycle (typically `App.vue` or `DashboardView`). Guards prevent double-polling:

```ts
startPolling(): void {
  if (this._pollHandle) return; // already running
  this._pollHandle = setInterval(() => void this.refreshAll(), intervalMs);
}
```

## Design System & Theming

### CSS custom properties

All colours, radii and shadows are CSS custom properties defined in `global.css`. Two themes are supported:

| Attribute | Theme |
|---|---|
| `[data-theme="dark"]` (default) | Dark mission-control |
| `[data-theme="light"]` | Light / accessibility-friendly |

The theme is toggled by setting `data-theme` on `<html>` and persisted to `localStorage` under the key `orbital_theme`.

### StatCard

`StatCard` renders a Pi-hole-style stat card with:
- A **4 px left accent border** coloured by the `accent` prop (`red`, `cyan`, `green`, `amber`, `purple`)
- An optional **icon** (Ionicons) in a tinted icon box
- A large monospaced **number** and a small **label** above it
- An optional **sub-label** below the number

```html
<StatCard
  label="Blocked Today"
  value="1,234"
  accent="red"
  :icon="shieldOutline"
  sub="last 24 h"
/>
```

### Statistics view components

The `StatisticsView` is decomposed into three reusable sub-components:

| Component | Responsibility |
|---|---|
| `StatsOverviewCards` | 6 stat cards (queries, blocked, rate, domains, clients, cached) |
| `StatsChart` | Chart.js 24 h line chart — owns the Chart instance lifecycle |
| `TopDomainsCard` | Generic top-N bar-chart card (queried / blocked / clients) |

The view itself only handles: instance selection, data fetching, aggregate computation, and routing between "all instances" and single-instance layouts.

## Statistics View — All Instances mode

When `selectedInstanceId === "__all__"` the view shows:
1. An **aggregate `StatsOverviewCards`** (sums across all instances)
2. A **per-instance mini grid** showing per-instance query / blocked / rate figures

Switching to a specific instance shows the full single-instance layout (chart + top domain cards).

## Accessibility

- `[data-theme="light"]` provides WCAG-AA compliant colour contrast on white backgrounds
- All interactive elements have `aria-label` or visible text labels
- `focus-visible` outlines are applied globally for keyboard navigation
- `@media (prefers-reduced-motion)` disables all animations
- `.sr-only` utility class for visually-hidden but screen-reader-accessible content
