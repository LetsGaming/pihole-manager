/**
 * Component Tests — BlockListsView (refactored)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BlockListsView from '@/views/BlockListsView.vue';
import { useInstanceStore } from '@/stores/instanceStore';

// vi.mock is hoisted — all mock data MUST be inlined here, not referencing outer consts
vi.mock('@/services/piholeApi', () => ({
  default: {
    getSummary:       vi.fn().mockResolvedValue({ status: 'enabled', dns_queries_today: 0, ads_blocked_today: 0, ads_percentage_today: 0, domains_being_blocked: 0, unique_clients: 0 }),
    getAdlists:       vi.fn().mockResolvedValue([
      { id: 1, address: 'https://hosts.file/list.txt', enabled: 1, comment: 'StevenBlack' },
      { id: 2, address: 'https://another.list/ads.txt', enabled: 0, comment: '' },
    ]),
    addAdlist:        vi.fn().mockResolvedValue({ success: true }),
    removeAdlist:     vi.fn().mockResolvedValue({ success: true }),
    setAdlistEnabled: vi.fn().mockResolvedValue({ success: true }),
    getList:          vi.fn().mockImplementation((_inst: unknown, type: string) => {
      if (type === 'black') return Promise.resolve([{ id: 1, domain: 'evil.com', enabled: 1, comment: '' }]);
      if (type === 'white') return Promise.resolve([{ id: 2, domain: 'safe.example.com', enabled: 1, comment: '' }]);
      return Promise.resolve([]);
    }),
    addToList:        vi.fn().mockResolvedValue({ success: true }),
    removeFromList:   vi.fn().mockResolvedValue({ success: true }),
    updateGravity:    vi.fn().mockResolvedValue({}),
    errorMessage:     (e: unknown) => (e as Error)?.message ?? 'Error',
  },
}));

import PiholeApiService from '@/services/piholeApi';

const STUBS = {
  'ion-page':       { template: '<div class="ion-page"><slot /></div>' },
  'ion-header':     { template: '<div><slot /></div>' },
  'ion-toolbar':    { template: '<div><slot /></div>' },
  'ion-content':    { template: '<div class="ion-content"><slot /></div>' },
  'ion-buttons':    { template: '<div><slot /></div>' },
  'ion-menu-button':{ template: '<button />' },
  'ion-icon':       { template: '<span />' },
  'ion-alert':      { template: '<div v-if="isOpen"><slot /></div>', props: ['isOpen','header','message','buttons'], emits: ['did-dismiss'] },
  'PageHeader':     { template: '<div><slot name="actions" /></div>' },
  'EmptyState':     { template: '<div class="empty-state">{{ title }}</div>', props: ['icon','title'] },
  'InstanceTabBar': { template: '<div class="instance-tabs" />', props: ['instances','selectedId'], emits: ['select'] },
  'AddDomainForm':  { template: '<div class="add-form" />', props: ['placeholder','loading'], emits: ['add'] },
  'DomainListTable':{ template: '<div class="domain-table">{{ title }}</div>', props: ['title','entries','searchQuery','loading'], emits: ['update:searchQuery','refresh','remove','copy'] },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(BlockListsView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe('BlockListsView', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows empty state when no instances configured', async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find('.empty-state').exists()).toBe(true);
  });

  it('renders instance tabs when instances exist', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    await w.vm.$nextTick();
    expect(w.find('.instance-tabs').exists()).toBe(true);
  });

  it('loads adlists for the selected instance on mount', async () => {
    // Add instance FIRST, then mount — so onMounted fires with selectedInstanceId set
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const w = mount(BlockListsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 50));
    expect(PiholeApiService.getAdlists).toHaveBeenCalled();
  });

  it('stores adlists after successful load', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    const w = mount(BlockListsView, { global: { plugins: [pinia], stubs: STUBS } });
    await new Promise((r) => setTimeout(r, 100));
    expect(w.vm.adlists.length).toBeGreaterThan(0);
  });

  it('activeTab starts as adlists', () => {
    const w = createWrapper();
    expect(w.vm.activeTab).toBe('adlists');
  });

  it('switchTab changes activeTab', () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    w.vm.selectedInstanceId = store.instances[0].id;
    w.vm.switchTab('black');
    expect(w.vm.activeTab).toBe('black');
  });

  it('selectInstance updates selectedInstanceId', () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'A', url: 'http://pi.a', apiToken: 'tok', apiVersion: 'v5' });
    store.addInstance({ name: 'B', url: 'http://pi.b', apiToken: 'tok', apiVersion: 'v5' });
    const idB = store.instances[1].id;
    w.vm.selectInstance(idB);
    expect(w.vm.selectedInstanceId).toBe(idB);
  });

  it('addAdlist calls API with correct params', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    w.vm.selectedInstanceId = store.instances[0].id;
    w.vm.newAdlistUrl = 'https://example.com/list.txt';
    await w.vm.addAdlist();
    expect(PiholeApiService.addAdlist).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://pi.hole' }),
      'https://example.com/list.txt',
      '',
    );
  });

  it('removeAdlist calls API', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    w.vm.selectedInstanceId = store.instances[0].id;
    await w.vm.removeAdlist('https://old.list/hosts.txt');
    expect(PiholeApiService.removeAdlist).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://pi.hole' }),
      'https://old.list/hosts.txt',
    );
  });

  it('triggerGravityUpdate calls updateGravity API', async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({ name: 'Test', url: 'http://pi.hole', apiToken: 'tok', apiVersion: 'v5' });
    w.vm.selectedInstanceId = store.instances[0].id;
    await w.vm.triggerGravityUpdate();
    expect(PiholeApiService.updateGravity).toHaveBeenCalled();
  });
});
