<template>
  <div class="empty-state">
    <ion-icon v-if="icon" :icon="icon" class="empty-state-icon" />
    <div class="empty-state-title">{{ title }}</div>
    <div v-if="subtitle" class="empty-state-sub">{{ subtitle }}</div>
    <slot />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { IonIcon } from '@ionic/vue';

export default defineComponent({
  name: 'EmptyState',
  components: { IonIcon },
  props: {
    icon:     { type: String, default: null },
    title:    { type: String, required: true },
    subtitle: { type: String, default: null },
  },
});
</script>
