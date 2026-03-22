# Testing

## Running Tests

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # HTML coverage report in coverage/
npm run typecheck         # TypeScript type check (no emit)
```

## Test Structure

```
src/tests/
├── setup.ts                        # Ionic stubs, localStorage + clipboard mocks
├── unit/
│   ├── instanceStore.test.js       # Store CRUD, polling, getters, persistence
│   ├── notificationStore.test.js   # Toast queue, auto-dismiss
│   ├── piholeApi.test.js           # Core API methods (axios mocked)
│   ├── piholeApiExtended.test.js   # Query log, lists, auth headers, formatters
│   └── hardwareService.test.js     # Parsers, formatters, severity helpers
├── components/
│   ├── DashboardView.test.js
│   ├── QueryLogView.test.js
│   ├── BlockListsView.test.js
│   ├── StatisticsView.test.js
│   ├── HardwareView.test.js
│   ├── SettingsView.test.js
│   └── DocsView.test.js
└── integration/
    ├── multiInstance.test.js       # Realistic multi-instance workflows
    └── router.test.js              # Route definitions, redirects, titles
```

**267 tests** across 14 files, three layers:

| Layer | Strategy |
|---|---|
| Unit — stores | Pinia store isolated; `piholeApi` mocked with `vi.mock` |
| Unit — services | `axios` mocked; all API paths exercised |
| Component | Ionic stubs global; real Pinia; test rendering + interactions |
| Integration | `axios` mocked at HTTP boundary; full store+service workflows |

## Writing New Tests

### Unit test (store action)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useInstanceStore } from '../../stores/instanceStore';

vi.mock('../../services/piholeApi', () => ({
  default: { getSummary: vi.fn() },
}));

describe('myNewAction', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('does what it says', async () => {
    const store = useInstanceStore();
    // arrange → act → assert
  });
});
```

### Component test

```ts
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MyView from '../../views/MyView.vue';

function createWrapper() {
  setActivePinia(createPinia());
  // Ionic stubs are applied globally via setup.ts
  return mount(MyView, { global: { plugins: [createPinia()] } });
}

it('renders something', async () => {
  const w = createWrapper();
  await w.vm.$nextTick();
  expect(w.text()).toContain('Expected text');
});
```

### Testing composables

Composables that use `onBeforeUnmount` need to run inside a component:

```ts
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useLivePolling } from '../../composables/useLivePolling';

it('stops on unmount', () => {
  const cb = vi.fn();
  const Wrapper = defineComponent({
    setup() { return useLivePolling(cb, 100); },
    template: '<div />',
  });
  const w = mount(Wrapper);
  w.unmount();
  vi.advanceTimersByTime(300);
  expect(cb).not.toHaveBeenCalledAfter(/* unmount */);
});
```
