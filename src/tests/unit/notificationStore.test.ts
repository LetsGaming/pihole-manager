import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNotificationStore } from '@/stores/notificationStore';

beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('notificationStore', () => {
  it('adds a toast with show()', () => {
    const store = useNotificationStore();
    const id = store.show('info', 'Hello world');
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].type).toBe('info');
    expect(store.toasts[0].message).toBe('Hello world');
    expect(id).toBe(store.toasts[0].id);
  });

  it('auto-dismisses after duration', () => {
    const store = useNotificationStore();
    store.show('info', 'Temporary', 1000);
    expect(store.toasts).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(store.toasts).toHaveLength(0);
  });

  it('does not auto-dismiss when duration=0', () => {
    const store = useNotificationStore();
    store.show('info', 'Permanent', 0);
    vi.advanceTimersByTime(99999);
    expect(store.toasts).toHaveLength(1);
  });

  it('dismiss() removes by id', () => {
    const store = useNotificationStore();
    const id = store.show('info', 'To dismiss', 0);
    store.dismiss(id);
    expect(store.toasts).toHaveLength(0);
  });

  it('success() creates a success toast', () => {
    const store = useNotificationStore();
    store.success('All good');
    expect(store.toasts[0].type).toBe('success');
  });

  it('error() creates an error toast', () => {
    const store = useNotificationStore();
    store.error('Something broke');
    expect(store.toasts[0].type).toBe('error');
  });

  it('warning() creates a warning toast', () => {
    const store = useNotificationStore();
    store.warning('Be careful');
    expect(store.toasts[0].type).toBe('warning');
  });

  it('increments id for each toast', () => {
    const store = useNotificationStore();
    const id1 = store.show('info', 'First', 0);
    const id2 = store.show('info', 'Second', 0);
    expect(id2).toBeGreaterThan(id1);
  });

  it('can hold multiple toasts', () => {
    const store = useNotificationStore();
    store.show('success', 'A', 0);
    store.show('error',   'B', 0);
    store.show('warning', 'C', 0);
    expect(store.toasts).toHaveLength(3);
  });

  it('dismissing non-existent id is a no-op', () => {
    const store = useNotificationStore();
    store.show('info', 'Hello', 0);
    store.dismiss(9999);
    expect(store.toasts).toHaveLength(1);
  });
});
