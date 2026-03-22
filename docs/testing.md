# Testing

Orbital uses **Vitest** as the test runner and **Vue Test Utils** for component mounting.

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npx vitest run src/tests/unit/instanceStore.test.ts
```

## Test Structure

```
src/tests/
├── components/              # Component-level tests (shallow rendering)
│   ├── StatisticsView.test.ts
│   ├── DashboardView.test.ts
│   └── ...
├── integration/
│   ├── multiInstance.test.ts
│   └── router.test.ts
├── unit/
│   ├── instanceStore.test.ts
│   ├── notificationStore.test.ts
│   ├── piholeApi.test.ts
│   └── ...
└── setup.ts                 # Global mocks (localStorage, Ionic stubs)
```

## Mocking Strategy

### API service

`piholeApi` is fully mocked in component tests. Mock data is inlined to avoid shared state:

```ts
vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({
      status: "enabled",
      dns_queries_today: 5000,
      ads_blocked_today: 750,
      ads_percentage_today: 15.0,
      domains_being_blocked: 120000,
      unique_clients: 8,
      queries_cached: 1200,
    }),
    getOverTimeData: vi.fn().mockResolvedValue({ domains: {}, ads: {} }),
    // ...
  },
}));
```

### Chart.js

Chart.js is mocked to avoid canvas errors in jsdom:

```ts
vi.mock("chart.js", () => ({
  Chart: Object.assign(
    vi.fn().mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() })),
    { register: vi.fn() },
  ),
  registerables: [],
}));
```

### Ionic components

All Ionic components are stubbed in component tests:

```ts
const STUBS = {
  "ion-page":    { template: '<div class="ion-page"><slot /></div>' },
  "ion-content": { template: '<div class="ion-content"><slot /></div>' },
  // ...
};
```

### Sub-components

`StatisticsView` tests stub its extracted sub-components to keep tests isolated:

```ts
StatsOverviewCards: { template: '<div class="stats-overview-cards"></div>', props: ["summary"] },
StatsChart:         { template: '<div class="stats-chart"></div>',          props: ["overTimeData", "loading", "instanceName"] },
TopDomainsCard:     { template: '<div class="top-domains-card">{{ title }}</div>', props: ["title", "domains", "loading", "variant", "emptyMessage"] },
```

## instanceStore Tests

The store tests cover:

| Area | Tests |
|---|---|
| `addInstance` | ID generation, active instance, URL trimming, localStorage persistence, reactive map initialisation |
| `updateInstance` | Field updates, fail counter reset, error on unknown ID |
| `removeInstance` | Array removal, cleanup of all reactive maps, active promotion |
| `refreshInstance` | Online status, summary stored reactively, error handling, resilience (threshold), recovery |
| Blocking control | `enableBlocking`, `disableBlocking`, `enableAllBlocking` |
| Getters | `onlineCount`, `offlineCount`, `sortedInstances`, `globalBlockingStatus` |
| Persistence | `loadFromStorage`, transient state init, corrupted data |
| Polling | Interval fires, stop prevents calls, no double-polling |

### Reactive update assertions

Tests verify that `summaryData` is replaced (not mutated) after `refreshInstance`:

```ts
const before = store.summaryData;
await store.refreshInstance(id);
expect(store.summaryData).not.toBe(before); // new object reference
expect(store.summaryData[id]).toBeDefined();
```

## StatisticsView Tests

| Area | Tests |
|---|---|
| Empty state | Shown when no instances |
| Default view | `__all__` selected when multiple instances; single instance selected when only one |
| Selector | "All Instances" option present; instance names rendered |
| `aggregateSummary` | Sums queries/blocked/clients/cached; null when no data; correct block rate |
| `currentSummary` | Returns data for selected instance; null in `__all__` mode |
| Loading states | `isLoadingCharts` forwarded to `StatsChart` |
| Formatting | `fmt(null)` → `"—"`, number formatting, `fmtPct` |

## Writing New Tests

### Component test template

```ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MyView from "@/views/MyView.vue";
import { useInstanceStore } from "@/stores/instanceStore";

vi.mock("@/services/piholeApi", () => ({ default: { /* ... */ } }));

const STUBS = { /* Ionic + child component stubs */ };

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(MyView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe("MyView", () => {
  it("renders correctly", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    // assertions
  });
});
```

### Store test template

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";

vi.mock("@/services/piholeApi", () => ({ default: { getSummary: vi.fn() } }));
import PiholeApiService from "@/services/piholeApi";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.mocked(PiholeApiService.getSummary).mockResolvedValue(/* VALID_SUMMARY */);
});
```
