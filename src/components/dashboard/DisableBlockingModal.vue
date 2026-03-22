<template>
  <ion-modal :is-open="isOpen" @did-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title style="font-family: var(--font-mono); font-size: 16px"
          >Disable All Blocking</ion-title
        >
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="page-content">
      <p style="color: var(--text-secondary); margin-bottom: 20px">
        This will disable ad blocking on all {{ onlineCount }} online instance{{
          onlineCount !== 1 ? "s" : ""
        }}.
      </p>
      <div class="field-group">
        <label class="field-label">Duration</label>
        <select v-model.number="duration" class="field-input">
          <option :value="0">Indefinitely</option>
          <option :value="30">30 seconds</option>
          <option :value="60">1 minute</option>
          <option :value="300">5 minutes</option>
          <option :value="600">10 minutes</option>
          <option :value="1800">30 minutes</option>
          <option :value="3600">1 hour</option>
        </select>
      </div>
      <button class="btn btn-danger w-full mt-2" @click="confirm">
        <ion-icon :icon="shieldOutline" />
        Disable Blocking
      </button>
    </ion-content>
  </ion-modal>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
} from "@ionic/vue";
import { shieldOutline } from "ionicons/icons";

export default defineComponent({
  name: "DisableBlockingModal",
  components: {
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
  },

  props: {
    isOpen: { type: Boolean, required: true },
    onlineCount: { type: Number, default: 0 },
  },

  emits: ["close", "confirm"],

  setup(_, { emit }) {
    const duration = ref(0);
    function confirm() {
      emit("confirm", duration.value);
    }
    return { duration, confirm, shieldOutline };
  },
});
</script>
