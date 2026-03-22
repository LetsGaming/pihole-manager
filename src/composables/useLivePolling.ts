/**
 * useLivePolling
 *
 * Manages a setInterval-based live polling loop.
 * Components call start()/stop() and the interval is always cleared on unmount.
 */

import { ref, onBeforeUnmount } from 'vue';

export function useLivePolling(callback: () => void | Promise<void>, intervalMs: number) {
  const isLive = ref(true);
  let handle: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    stop();
    if (isLive.value) {
      handle = setInterval(() => void callback(), intervalMs);
    }
  }

  function stop(): void {
    if (handle !== null) {
      clearInterval(handle);
      handle = null;
    }
  }

  function toggle(): void {
    isLive.value = !isLive.value;
    isLive.value ? start() : stop();
  }

  onBeforeUnmount(() => stop());

  return { isLive, start, stop, toggle };
}
