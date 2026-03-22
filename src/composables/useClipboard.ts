/**
 * useClipboard
 *
 * Wrapper around navigator.clipboard.writeText with notification feedback.
 */

import { useNotificationStore } from "@/stores/notificationStore";

export function useClipboard() {
  const notifications = useNotificationStore();

  async function copyToClipboard(text: string, label = text): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      notifications.info(`Copied: ${label}`);
    } catch {
      notifications.error("Could not copy to clipboard");
    }
  }

  return { copyToClipboard };
}
