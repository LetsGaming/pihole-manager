/**
 * useBlockingControl
 *
 * Encapsulates enable/disable blocking logic with notification feedback.
 * Used by DashboardView and InstanceCard so the logic lives in one place.
 */

import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";

export function useBlockingControl() {
  const instanceStore = useInstanceStore();
  const notifications = useNotificationStore();

  async function toggleBlocking(id: string, enable: boolean): Promise<void> {
    try {
      if (enable) {
        await instanceStore.enableBlocking(id);
        notifications.success("Blocking enabled");
      } else {
        await instanceStore.disableBlocking(id, 0);
        notifications.warning("Blocking disabled");
      }
    } catch (err) {
      notifications.error(`Failed: ${(err as Error).message}`);
    }
  }

  async function enableAll(): Promise<void> {
    try {
      await instanceStore.enableAllBlocking();
      notifications.success("Blocking enabled on all instances");
    } catch (err) {
      notifications.error(`Error: ${(err as Error).message}`);
    }
  }

  async function disableAll(seconds: number): Promise<void> {
    try {
      await instanceStore.disableAllBlocking(seconds);
      const label = seconds > 0 ? `for ${seconds}s` : "indefinitely";
      notifications.warning(`Blocking disabled ${label} on all instances`);
    } catch (err) {
      notifications.error(`Error: ${(err as Error).message}`);
    }
  }

  return { toggleBlocking, enableAll, disableAll };
}
