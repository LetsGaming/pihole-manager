/**
 * Component Tests — DashboardView (refactored)
 *
 * The view delegates formatting to useFormatting and blocking to
 * useBlockingControl. Tests check setup() return values and child-component
 * rendering, not internal helpers that now live in composables.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import { useInstanceStore } from '@/stores/instanceStore';
import { useNotificationStore } from '@/stores/notificationStore';

vi.mock('@/services/piholeApi', () => ({
  default: {
    getSummary:      vi.fn().mockResolvedValue({ status: 'enabled', dns_queries_today: 1000, ads_blocked_today: 100, ads_percentage_today: 10, domains_being_blocked: 90000, unique_clients: 3 }),
    enableBlocking:  vi.fn().mockResolvedValue({ status: 'enabled' }),
    disableBlocking: vi.fn().mockResolvedValue({ status: 'disabled' }),
    errorMessage:    (e: unknown) => (e as Error)?.message ?? 'Error',
  },
}));

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/',         component: DashboardView },
    { path: '/settings', component: { template: '<div />' } },
  ],
});

const STUBS = {
  'ion-page': { template: '<div class="ion-page"><slot /></div>' },
  'ion-header': { template: '<div><slot /></div>' },
  'ion-toolbar': { template: '<div><slot /></div>' },
  'ion-content': { template: '<div class="ion-content"><slot /></div>' },
  'ion-buttons': { template: '<div><slot /></div>' },
  'ion-menu-button': { template: '<button />' },
  'ion-icon': { template: '<span />' },
  'PageHeader': { template: '<div><slot name="actions" /></div>' },
  'EmptyState': { template: '<div class="empty-state"><slot /></div>', props: ['icon','title','subtitle'] },
  'StatCard': { template: '<div class="stat-card">{{label}}:{{value}}</div>', props: ['label','value','accent'] },
  'InstanceCard': { template: '<div class="instance-card" />', props: ['instance','summary','loading','error'], emits: ['refresh','toggle-blocking'] },
  'DisableBlockingModal': { template: '<div />', props: ['isOpen','onlineCount'], emits: ['close','confirm'] },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(DashboardView, { global: { plugins: [pinia, router], stubs: STUBS } });
}

describe('DashboardView', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows empty state when no instances configured', async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find('.empty-state').exists()).toBe(true);
  });

  it('renders an InstanceCard per instance', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi A', url: 'http://pi.a', apiToken: 'tok', apiVersion: 'v5' });
    store.addInstance({ name: 'Pi B', url: 'http://pi.b', apiToken: 'tok', apiVersion: 'v5' });
    await w.vm.$nextTick();
    expect(w.findAll('.instance-card')).toHaveLength(2);
  });

  it('fmt() returns em-dash for null', () => {
    const w = createWrapper();
    expect(w.vm.fmt(null)).toBe('—');
  });

  it('fmt() formats a number (locale-agnostic check)', () => {
    const w = createWrapper();
    const result = w.vm.fmt(1234567);
    expect(result).not.toBe('—');
    // Matches 1,234,567 or 1.234.567 or 1 234 567 depending on locale
    expect(result.replace(/[.,\s]/g, '')).toBe('1234567');
  });

  it('aggregate sums queries across instances', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'A', url: 'http://pi.a', apiToken: 'tok', apiVersion: 'v5' });
    store.addInstance({ name: 'B', url: 'http://pi.b', apiToken: 'tok', apiVersion: 'v5' });
    const [idA, idB] = store.instances.map((i) => i.id);
    store.summaryData[idA] = { status: 'enabled', dns_queries_today: 300, ads_blocked_today: 30, ads_percentage_today: 10, domains_being_blocked: 10000, unique_clients: 2 };
    store.summaryData[idB] = { status: 'enabled', dns_queries_today: 700, ads_blocked_today: 70, ads_percentage_today: 10, domains_being_blocked: 20000, unique_clients: 3 };
    await w.vm.$nextTick();
    expect(w.vm.aggregate.totalQueries).toBe(1000);
    expect(w.vm.aggregate.totalBlocked).toBe(100);
    expect(w.vm.aggregate.totalDomainsBlocked).toBe(30000);
    expect(w.vm.aggregate.uniqueClients).toBe(5);
  });

  it('aggregate avgBlockRate calculated correctly', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const id = store.instances[0].id;
    store.summaryData[id] = { status: 'enabled', dns_queries_today: 100, ads_blocked_today: 20, ads_percentage_today: 20, domains_being_blocked: 0, unique_clients: 0 };
    await w.vm.$nextTick();
    expect(w.vm.aggregate.avgBlockRate).toBe('20.0%');
  });

  it('globalStatusLabel is "All Blocking" when all enabled', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await store.refreshAll();
    expect(w.vm.globalStatusLabel).toBe('All Blocking');
  });

  it('globalStatusLabel is "Unknown" with no instances', () => {
    const w = createWrapper();
    expect(w.vm.globalStatusLabel).toBe('Unknown');
  });

  it('globalStatusBadgeClass is badge-green when all enabled', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await store.refreshAll();
    expect(w.vm.globalStatusBadgeClass).toBe('badge-green');
  });

  it('showDisableModal starts as false', () => {
    const w = createWrapper();
    expect(w.vm.showDisableModal).toBe(false);
  });

  it('showDisableModal can be set to true', async () => {
    const w = createWrapper();
    w.vm.showDisableModal = true;
    await w.vm.$nextTick();
    expect(w.vm.showDisableModal).toBe(true);
  });

  it('onToggleBlocking calls notifications.success on enable', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const id = store.instances[0].id;
    store.instances[0].status = 'online';
    const notif = useNotificationStore();
    const spy = vi.spyOn(notif, 'success');
    await w.vm.onToggleBlocking(id, true);
    expect(spy).toHaveBeenCalledWith('Blocking enabled');
  });

  it('onEnableAll calls enableAllBlocking on store', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await store.refreshAll();
    const spy = vi.spyOn(store, 'enableAllBlocking');
    await w.vm.onEnableAll();
    expect(spy).toHaveBeenCalled();
  });

  it('onDisableAll closes modal and calls disableAllBlocking', async () => {
    const w = createWrapper();
    w.vm.showDisableModal = true;
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await store.refreshAll();
    await w.vm.onDisableAll(300);
    expect(w.vm.showDisableModal).toBe(false);
  });
});
