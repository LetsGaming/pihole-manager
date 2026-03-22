<template>
  <div class="toast-container" aria-live="polite" aria-atomic="false">
    <transition-group name="toast-anim" tag="div" style="display:contents">
      <div
        v-for="toast in notifications.toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
        role="alert"
      >
        <ion-icon :icon="iconFor(toast.type)" class="toast-icon"></ion-icon>
        <span class="toast-msg">{{ toast.message }}</span>
        <button aria-label="Dismiss" class="toast-close" @click="notifications.dismiss(toast.id)">
          <ion-icon :icon="closeOutline"></ion-icon>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import {
  checkmarkCircleOutline, alertCircleOutline,
  warningOutline, informationCircleOutline, closeOutline,
} from 'ionicons/icons';
import { useNotificationStore } from '@/stores/notificationStore';

export default {
  name: 'ToastContainer',

  components: { IonIcon },

  setup() {
    return { notifications: useNotificationStore() };
  },

  data() {
    return { closeOutline };
  },

  methods: {
    iconFor(type) {
      const map = {
        success: checkmarkCircleOutline,
        error:   alertCircleOutline,
        warning: warningOutline,
        info:    informationCircleOutline,
      };
      return map[type] || informationCircleOutline;
    },
  },
};
</script>

<style scoped>
.toast-anim-enter-active { transition: all 0.2s ease; }
.toast-anim-leave-active { transition: all 0.2s ease; }
.toast-anim-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-anim-leave-to     { opacity: 0; transform: translateX(20px); }

.toast-icon { font-size: 16px; flex-shrink: 0; }
.toast.success .toast-icon { color: var(--accent-green); }
.toast.error   .toast-icon { color: var(--accent-red); }
.toast.warning .toast-icon { color: var(--accent-amber); }
.toast.info    .toast-icon { color: var(--accent-cyan); }

.toast-close {
  background: none;
  border: none;
  padding: 0;
  margin-left: auto;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 16px;
  display: flex;
  align-items: center;
  line-height: 1;
}
.toast-close:hover { color: var(--text-primary); }
</style>
