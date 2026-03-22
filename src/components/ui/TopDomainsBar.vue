<template>
  <div class="top-domain-row">
    <div class="top-domain-bar-wrap">
      <div class="top-domain-name truncate" :title="domain">{{ domain }}</div>
      <div class="top-domain-bar-bg">
        <div
          class="top-domain-bar-fill"
          :class="variant"
          :style="{ width: `${width}%` }"
        />
      </div>
    </div>
    <span class="top-domain-count">{{ count.toLocaleString() }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TopDomainsBar',
  props: {
    domain:  { type: String,  required: true },
    count:   { type: Number,  required: true },
    /** Width percentage (0–100) */
    width:   { type: Number,  required: true },
    /** CSS modifier class: 'blocked' | 'green' | '' */
    variant: { type: String,  default: '' },
  },
});
</script>
