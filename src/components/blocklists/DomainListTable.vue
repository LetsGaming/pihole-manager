<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title">{{ title }} ({{ entries.length }})</span>
      <div class="flex gap-2">
        <input
          class="field-input"
          style="width: 200px"
          :value="searchQuery"
          placeholder="Search domains…"
          @input="
            $emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value,
            )
          "
        />
        <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">
          <ion-icon :icon="refreshOutline" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="p-3">
      <div
        v-for="i in 4"
        :key="i"
        class="skeleton"
        style="height: 40px; margin-bottom: 6px"
      />
    </div>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Comment</th>
          <th>Added</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in filtered" :key="entry.id">
          <td class="mono">{{ entry.domain }}</td>
          <td style="color: var(--text-muted); font-size: 12px">
            {{ entry.comment || "—" }}
          </td>
          <td class="text-xs text-muted">
            {{ fmtDate(entry.date_added ? entry.date_added * 1000 : null) }}
          </td>
          <td>
            <div class="flex gap-2">
              <button
                class="btn btn-ghost btn-sm btn-icon"
                @click="$emit('copy', entry.domain)"
              >
                <ion-icon :icon="copyOutline" />
              </button>
              <button
                class="btn btn-danger btn-sm btn-icon"
                @click="$emit('remove', entry.domain)"
              >
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="filtered.length === 0">
          <td
            colspan="4"
            style="text-align: center; padding: 30px; color: var(--text-muted)"
          >
            {{ searchQuery ? "No matching entries" : "List is empty" }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";
import { refreshOutline, copyOutline, trashOutline } from "ionicons/icons";
import type { DomainEntry } from "@/types/api";
import { useFormatting } from "@/composables/useFormatting";

export default defineComponent({
  name: "DomainListTable",
  components: { IonIcon },

  props: {
    title: { type: String, required: true },
    entries: { type: Array as PropType<DomainEntry[]>, default: () => [] },
    searchQuery: { type: String, default: "" },
    loading: { type: Boolean, default: false },
  },

  emits: ["update:searchQuery", "refresh", "remove", "copy"],

  setup(props) {
    const { fmtDate } = useFormatting();
    const filtered = computed(() => {
      if (!props.searchQuery) return props.entries;
      const q = props.searchQuery.toLowerCase();
      return props.entries.filter((e) => e.domain.toLowerCase().includes(q));
    });
    return { filtered, fmtDate, refreshOutline, copyOutline, trashOutline };
  },
});
</script>
