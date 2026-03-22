# Architecture

## Project Structure

```
src/
├── env.d.ts                    # Vue SFC + Vite env type declarations
├── main.ts                     # App bootstrap
├── App.vue                     # Root layout: split-pane sidebar + router outlet
│
├── types/                      # Shared TypeScript interfaces (single source of truth)
│   ├── instance.ts             # PiholeInstance, ApiVersion, InstanceStatus
│   ├── api.ts                  # PiholeSummary, QueryEntry, Adlist, DomainEntry, …
│   ├── hardware.ts             # HardwareInfo, SeverityLevel
│   └── index.ts                # Barrel re-export
│
├── services/
│   ├── piholeApi.ts            # All Pi-hole API calls (v5 + v6), typed with generics
│   └── hardwareService.ts      # Hardware data aggregation + formatters
│
├── stores/
│   ├── instanceStore.ts        # Instance CRUD, polling, blocking, localStorage persistence
│   └── notificationStore.ts   # Global toast queue
│
├── composables/
│   ├── useFormatting.ts        # fmt, fmtPct, fmtTime, fmtDate, loadColor, barWidth
│   ├── useClipboard.ts         # copyToClipboard with notification feedback
│   ├── useLivePolling.ts       # setInterval lifecycle management
│   ├── useBlockingControl.ts   # enable/disable blocking with notifications
│   └── useAppSettings.ts      # Load/save app settings to localStorage
│
├── components/
│   ├── ToastContainer.vue      # Renders notification toasts
│   ├── ui/                     # Generic, domain-agnostic components
│   │   ├── EmptyState.vue      # Centered empty-state with icon/title/slot
│   │   ├── PageHeader.vue      # Consistent ion-header toolbar
│   │   ├── StatCard.vue        # Single metric card for stat grids
│   │   ├── MetricGauge.vue     # Value + progress bar (CPU/RAM/Disk/Temp)
│   │   └── TopDomainsBar.vue   # Horizontal bar row for top-N lists
│   ├── dashboard/
│   │   ├── InstanceCard.vue    # Per-instance overview card
│   │   └── DisableBlockingModal.vue
│   ├── querylog/
│   │   ├── QueryLogToolbar.vue # Filters, instance selector, live/pause
│   │   └── QueryLogRow.vue     # Single log entry row
│   ├── hardware/
│   │   └── HardwareCard.vue    # Full hardware info card for one instance
│   ├── blocklists/
│   │   ├── InstanceTabBar.vue  # Per-instance tab switcher
│   │   ├── DomainListTable.vue # Table for black/white/regex lists
│   │   └── AddDomainForm.vue   # Add domain input form
│   └── settings/
│       └── InstanceForm.vue    # Add/edit instance modal (with connection test)
│
├── views/                      # Thin routing shells — compose components
│   ├── DashboardView.vue
│   ├── QueryLogView.vue
│   ├── BlockListsView.vue
│   ├── StatisticsView.vue
│   ├── HardwareView.vue
│   ├── SettingsView.vue
│   └── DocsView.vue
│
├── router/
│   └── index.ts                # Routes + afterEach title hook
│
└── tests/
    ├── setup.ts                # Ionic stubs, localStorage mock, clipboard mock
    ├── unit/                   # Service and store unit tests
    ├── components/             # Component rendering tests
    └── integration/            # Multi-layer workflow tests
```

## Layer Responsibilities

| Layer | Responsibility | Example |
|---|---|---|
| **Types** | Shape definitions only, no logic | `PiholeInstance`, `HardwareInfo` |
| **Services** | API calls, data parsing, formatters | `piholeApi.ts`, `hardwareService.ts` |
| **Stores** | Reactive state, persistence, cross-component data | `instanceStore.ts` |
| **Composables** | Reusable logic that needs reactivity or lifecycle | `useLivePolling`, `useFormatting` |
| **Components** | Isolated UI pieces with typed props/emits | `InstanceCard`, `MetricGauge` |
| **Views** | Compose components, wire up store + composables | `DashboardView` |

## Data Flow

```
Pi-hole API ──► piholeApi.ts (typed) ──► instanceStore / views
                                              │
                                    composables (format, poll, clipboard)
                                              │
                                    components (props/emits)
                                              │
                                           views
```

## State Management

**Pinia** with two stores:

### `instanceStore`
- Source of truth for all Pi-hole instances
- Persists to `localStorage` under key `orbital_instances`
- Runs background polling via `startPolling(intervalMs)`
- Exposes computed: `sortedInstances`, `onlineCount`, `globalBlockingStatus`, `activeSummary`

### `notificationStore`
- Toast queue: `{ id, type, message }`
- `show(type, msg, duration)` / `success()` / `error()` / `warning()` / `info()`
- Auto-dismiss via `setTimeout`

## Adding a New Feature

1. Add types to `src/types/`
2. Add API method to `src/services/piholeApi.ts`
3. Add store action if state is needed across components
4. Extract reusable logic to a composable if it's used in 2+ places
5. Build the smallest possible component that does one thing
6. Compose in the view
7. Add tests at every layer
