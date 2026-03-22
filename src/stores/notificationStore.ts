import { defineStore } from 'pinia';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id:      number;
  type:    ToastType;
  message: string;
}

interface NotificationState {
  toasts:  Toast[];
  _nextId: number;
}

export const useNotificationStore = defineStore('notifications', {
  state: (): NotificationState => ({
    toasts:  [],
    _nextId: 1,
  }),

  actions: {
    show(type: ToastType, message: string, duration = 4_000): number {
      const id = this._nextId++;
      this.toasts.push({ id, type, message });
      if (duration > 0) setTimeout(() => this.dismiss(id), duration);
      return id;
    },

    success(message: string, duration?: number): number { return this.show('success', message, duration); },
    error  (message: string, duration?: number): number { return this.show('error',   message, duration); },
    warning(message: string, duration?: number): number { return this.show('warning', message, duration); },
    info   (message: string, duration?: number): number { return this.show('info',    message, duration); },

    dismiss(id: number): void {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
  },
});
