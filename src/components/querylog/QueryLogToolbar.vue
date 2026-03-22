<template>
  <div class="log-toolbar card mb-3">
    <div class="flex items-center gap-2" style="flex-wrap:wrap">
      <!-- Instance selector -->
      <select class="field-input" style="width:160px" :value="instanceId" @change="$emit('update:instanceId', ($event.target as HTMLSelectElement).value)">
        <option value="all">All Instances</option>
        <option v-for="inst in instances" :key="inst.id" :value="inst.id">{{ inst.name }}</option>
      </select>

      <!-- Status filter -->
      <select class="field-input" style="width:120px" :value="statusFilter" @change="$emit('update:statusFilter', ($event.target as HTMLSelectElement).value)">
        <option value="all">All Status</option>
        <option value="blocked">Blocked</option>
        <option value="allowed">Allowed</option>
        <option value="cached">Cached</option>
      </select>

      <!-- Domain/client search -->
      <div style="position:relative;flex:1;min-width:200px">
        <ion-icon :icon="searchOutline" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px" />
        <input
          class="field-input"
          style="padding-left:32px"
          :value="searchQuery"
          placeholder="Filter by domain or client…"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="flex items-center gap-2" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">
      <div class="flex items-center gap-2">
        <div class="log-live-dot" :class="{ paused: !isLive }" />
        <span class="text-xs text-muted">{{ isLive ? 'Live' : 'Paused' }}</span>
        <span class="text-xs text-muted">· {{ entryCount.toLocaleString() }} entries</span>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn btn-ghost btn-sm" @click="$emit('toggle-live')">
          <ion-icon :icon="isLive ? pauseOutline : playOutline" />
          {{ isLive ? 'Pause' : 'Resume' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="$emit('clear')">
          <ion-icon :icon="trashOutline" />
          Clear
        </button>
        <select class="field-input" style="width:80px" :value="fetchCount" @change="$emit('update:fetchCount', Number(($event.target as HTMLSelectElement).value))">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import { IonIcon } from '@ionic/vue';
import { searchOutline, pauseOutline, playOutline, trashOutline } from 'ionicons/icons';
import type { PiholeInstance } from '@/types/instance';

export default defineComponent({
  name: 'QueryLogToolbar',
  components: { IonIcon },

  props: {
    instances:    { type: Array as PropType<PiholeInstance[]>, default: () => [] },
    instanceId:   { type: String, default: 'all' },
    statusFilter: { type: String, default: 'all' },
    searchQuery:  { type: String, default: '' },
    fetchCount:   { type: Number, default: 100 },
    isLive:       { type: Boolean, default: true },
    entryCount:   { type: Number, default: 0 },
  },

  emits: [
    'update:instanceId',
    'update:statusFilter',
    'update:searchQuery',
    'update:fetchCount',
    'toggle-live',
    'clear',
  ],

  setup() {
    return { searchOutline, pauseOutline, playOutline, trashOutline };
  },
});
</script>
