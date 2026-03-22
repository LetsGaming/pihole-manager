<template>
  <div class="stat-card" :class="accent" :aria-label="`${label}: ${value}`" role="group">
    <div class="stat-card-inner">
      <div v-if="icon" class="stat-card-icon" aria-hidden="true">
        <ion-icon :icon="icon" />
      </div>
      <div class="stat-card-body">
        <div class="stat-label">{{ label }}</div>
        <div class="stat-number">{{ value }}</div>
        <div v-if="sub" class="stat-sub">{{ sub }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";

export default defineComponent({
  name: "StatCard",
  components: { IonIcon },
  props: {
    label:  { type: String, required: true },
    value:  { type: String, required: true },
    accent: { type: String as PropType<string | null>, default: null },
    sub:    { type: String as PropType<string | null>, default: null },
    icon:   { type: [Object, String] as PropType<object | string | null>, default: null },
  },
});
</script>
