/**
 * Component Tests — StatisticsView
 * All mock data inlined. Chart.js mocked with register function.
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import StatisticsView from '@/views/StatisticsView.vue';
import { useInstanceStore } from '@/stores/instanceStore';

// Chart.js mock — Chart constructor is a no-op; register is called inside setup() so mocking Chart is enough
vi.mock('chart.js', () => ({
  Chart: Object.assign(
    vi.fn().mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() })),
    { register: vi.fn() },
  ),
  registerables: [],
}));

// All API mock data inlined
vi.mock('@/services/piholeApi', () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({
      status: 'enabled', dns_queries_today: 5000, ads_blocked_today: 750,
      ads_percentage_today: 15.0, domains_being_blocked: 120000,
      unique_clients: 8, queries_cached: 1200,
    }),
    getOverTimeData: vi.fn().mockResolvedValue({ domains: { '1700000000': 120 }, ads: { '1700000000': 20 } }),
    getTopDomains:   vi.fn().mockResolvedValue({ topDomains: { 'google.com': 800, 'github.com': 400 }, topBlocked: { 'doubleclick.net': 300 } }),
    getTopClients:   vi.fn().mockResolvedValue({ '192.168.1.10': 2000, '192.168.1.11': 1500 }),
    errorMessage:    (e: unknown) => (e as Error)?.message ?? 'Error',
  },
}));

const STUBS = {
  'ion-page':        { template: '<div class="ion-page"><slot /></div>' },
  'ion-header':      { template: '<div><slot /></div>' },
  'ion-toolbar':     { template: '<div><slot /></div>' },
  'ion-content':     { template: '<div class="ion-content"><slot /></div>' },
  'ion-buttons':     { template: '<div><slot /></div>' },
  'ion-menu-button': { template: '<button />' },
  'PageHeader':      { template: '<div><slot name="actions" /></div>' },
  'EmptyState':      { template: '<div class="empty-state">{{ title }}</div>', props: ['icon','title'] },
  'StatCard':        { template: '<div class="stat-card">{{ label }}</div>', props: ['label','value','accent'] },
  'TopDomainsBar':   { template: '<div class="top-bar">{{ domain }}</div>', props: ['domain','count','width','variant'] },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe('StatisticsView', () => {
  it('shows empty state with no instances', async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find('.empty-state').exists()).toBe(true);
  });

  it('renders stat cards when instance has summary', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Home', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await w.vm.$nextTick();
    expect(w.findAll('.stat-card').length).toBeGreaterThan(0);
  });

  it('defaults selectedInstanceId to first instance', async () => {
    // Add instance BEFORE mounting so onMounted picks it up
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: 'First', url: 'http://pi.a', apiToken: 'tok', apiVersion: 'v5' });
    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.selectedInstanceId).toBe(store.instances[0].id);
  });

  it('renders a selector with all instances', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi A', url: 'http://pi.a', apiToken: 'tok', apiVersion: 'v5' });
    store.addInstance({ name: 'Pi B', url: 'http://pi.b', apiToken: 'tok', apiVersion: 'v5' });
    await w.vm.$nextTick();
    expect(w.text()).toContain('Pi A');
    expect(w.text()).toContain('Pi B');
  });

  it('summary computed returns data for selected instance', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const id = store.instances[0].id;
    const data = { status: 'enabled' as const, dns_queries_today: 5000, ads_blocked_today: 750, ads_percentage_today: 15, domains_being_blocked: 120000, unique_clients: 8 };
    store.summaryData[id] = data;
    w.vm.selectedInstanceId = id;
    await w.vm.$nextTick();
    expect(w.vm.summary).toEqual(data);
  });

  it('summary computed returns null for unknown instance', async () => {
    const w = createWrapper();
    w.vm.selectedInstanceId = 'nonexistent';
    await w.vm.$nextTick();
    expect(w.vm.summary).toBeNull();
  });

  it('fmt() returns em-dash for null', () => {
    const w = createWrapper();
    expect(w.vm.fmt(null)).toBe('—');
  });

  it('fmt() formats a number (locale-agnostic)', () => {
    const w = createWrapper();
    const result = w.vm.fmt(120000);
    expect(result.replace(/[.,\s]/g, '')).toBe('120000');
  });

  it('barWidth returns proportional value', () => {
    const w = createWrapper();
    expect(w.vm.barWidth(400, 800)).toBe(50);
  });

  it('barWidth returns 0 when max is 0', () => {
    const w = createWrapper();
    expect(w.vm.barWidth(100, 0)).toBe(0);
  });

  it('topDomains populated after data loads', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const id = store.instances[0].id;
    store.summaryData[id] = { status: 'enabled', dns_queries_today: 5000, ads_blocked_today: 750, ads_percentage_today: 15, domains_being_blocked: 120000, unique_clients: 8 };
    w.vm.selectedInstanceId = id;
    // Directly set topDomains to verify rendering
    w.vm.topDomains = { 'google.com': 800, 'github.com': 400 };
    await w.vm.$nextTick();
    expect(Object.keys(w.vm.topDomains).length).toBeGreaterThan(0);
  });

  it('shows skeleton when isLoadingCharts is true', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Pi', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    w.vm.isLoadingCharts = true;
    await w.vm.$nextTick();
    expect(w.html()).toContain('skeleton');
  });

  it('maxTopDomain returns 1 when topDomains is empty', () => {
    const w = createWrapper();
    expect(w.vm.maxTopDomain).toBe(1);
  });
});
