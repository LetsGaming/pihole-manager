<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Block Lists" />

    <ion-content class="page-content">
      <EmptyState
        v-if="!instanceStore.instances.length"
        :icon="shieldOutline"
        title="No instances configured"
      />

      <template v-else>
        <InstanceTabBar
          :instances="instanceStore.instances"
          :selected-id="selectedInstanceId ?? ''"
          @select="selectInstance"
        />

        <!-- List-type tabs -->
        <div class="list-type-tabs mb-3">
          <button
            v-for="tab in LIST_TABS"
            :key="tab.key"
            class="list-tab"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
            <span v-if="counts[tab.key] != null" class="tab-count">
              {{ counts[tab.key] }}
            </span>
          </button>
        </div>

        <!-- ── Adlists panel ──────────────────────────────────────────────── -->
        <template v-if="activeTab === 'adlists'">
          <div class="card mb-3">
            <div class="card-header">
              <span class="card-title">ADD ADLIST</span>
            </div>
            <div class="flex gap-2" style="flex-wrap: wrap">
              <input
                v-model="newAdlistUrl"
                class="field-input"
                style="flex: 1; min-width: 200px"
                placeholder="https://hosts.example.com/adlist.txt"
                @keyup.enter="addAdlist"
              />
              <input
                v-model="newAdlistComment"
                class="field-input"
                style="width: 200px"
                placeholder="Comment (optional)"
              />
              <button
                class="btn btn-primary"
                :disabled="!newAdlistUrl || isLoading"
                @click="addAdlist"
              >
                <ion-icon :icon="addOutline" /> Add
              </button>
            </div>
            <div class="suggested-lists mt-3">
              <div class="text-xs text-muted mb-2">Quick add popular lists:</div>
              <div class="flex gap-2" style="flex-wrap: wrap">
                <button
                  v-for="l in SUGGESTED_LISTS"
                  :key="l.url"
                  class="btn btn-ghost btn-sm"
                  @click="newAdlistUrl = l.url; newAdlistComment = l.name"
                >
                  + {{ l.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">ADLISTS ({{ sortedAdlists.length }})</span>
              <div class="flex gap-2">
                <button class="btn btn-ghost btn-sm" @click="triggerGravityUpdate">
                  <ion-icon :icon="cloudDownloadOutline" /> Update Gravity
                </button>
                <button class="btn btn-ghost btn-sm" @click="loadAdlists">
                  <ion-icon :icon="refreshOutline" />
                </button>
              </div>
            </div>

            <!-- Active sort pills for adlists -->
            <div v-if="adlistSortKey" class="sort-pills sort-pills--in-card">
              <span class="text-xs text-muted" style="line-height: 24px">Sort:</span>
              <span
                v-for="(level, idx) in adlistSort.levels"
                :key="level.col"
                class="sort-pill"
              >
                <span class="sort-pill-priority">{{ idx + 1 }}</span>
                {{ ADLIST_LABELS[level.col] ?? level.col }}
                {{ level.dir === 'asc' ? '↑' : '↓' }}
                <button class="sort-pill-remove" @click="onAdlistSortRemove(level.col)">×</button>
              </span>
              <button class="btn btn-ghost btn-sm" style="padding: 2px 8px; font-size: 11px" @click="onAdlistSortClear">
                Clear sort
              </button>
            </div>

            <div v-if="isLoading" class="p-3">
              <div v-for="i in 4" :key="i" class="skeleton" style="height: 44px; margin-bottom: 6px" />
            </div>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <SortableHeader col="address" label="URL" :sort="adlistSort" :sort-key="adlistSortKey" @sort-changed="onAdlistSortChanged" />
                  <SortableHeader col="comment" label="Comment" :sort="adlistSort" :sort-key="adlistSortKey" @sort-changed="onAdlistSortChanged" />
                  <SortableHeader col="enabled" label="Enabled" :sort="adlistSort" :sort-key="adlistSortKey" @sort-changed="onAdlistSortChanged" />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="list in sortedAdlists" :key="list.id">
                  <td class="mono" style="max-width: 300px">
                    <span class="truncate" :title="list.address">{{ list.address }}</span>
                  </td>
                  <td style="color: var(--text-muted); font-size: 12px">
                    {{ list.comment || "—" }}
                  </td>
                  <td>
                    <span class="badge" :class="list.enabled ? 'badge-green' : 'badge-gray'">
                      {{ list.enabled ? "On" : "Off" }}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-ghost btn-sm btn-icon" title="Copy" @click="copyToClipboard(list.address)">
                        <ion-icon :icon="copyOutline" />
                      </button>
                      <button class="btn btn-danger btn-sm btn-icon" title="Remove" @click="removeAdlist(list.address)">
                        <ion-icon :icon="trashOutline" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!sortedAdlists.length && !isLoading">
                  <td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted)">
                    No adlists configured
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── Domain list panels ─────────────────────────────────────────── -->
        <template v-else>
          <AddDomainForm
            :placeholder="domainPlaceholder"
            :loading="isLoading"
            @add="addDomain"
          />
          <DomainListTable
            v-model:search-query="domainSearch"
            :title="currentTabLabel"
            :entries="domainList"
            :loading="isLoading"
            @refresh="loadDomainList"
            @remove="removeDomain"
            @copy="copyToClipboard"
          />
        </template>
      </template>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import {
  shieldOutline, addOutline, cloudDownloadOutline,
  refreshOutline, copyOutline, trashOutline,
} from "ionicons/icons";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import SortableHeader from "@/components/ui/SortableHeader.vue";
import InstanceTabBar from "@/components/blocklists/InstanceTabBar.vue";
import AddDomainForm from "@/components/blocklists/AddDomainForm.vue";
import DomainListTable from "@/components/blocklists/DomainListTable.vue";

import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useClipboard } from "@/composables/useClipboard";
import { useMultiSort } from "@/composables/useMultiSort";
import type { MultiSort } from "@/composables/useMultiSort";
import PiholeApiService from "@/services/piholeApi";
import type { Adlist, DomainEntry, DomainListType } from "@/types/api";

const LIST_TABS = [
  { key: "adlists",     label: "Adlists" },
  { key: "black",       label: "Blacklist" },
  { key: "white",       label: "Whitelist" },
  { key: "regex_black", label: "Regex Block" },
  { key: "regex_white", label: "Regex Allow" },
] as const;

const SUGGESTED_LISTS = [
  { name: "StevenBlack",  url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts" },
  { name: "Disconnect.me", url: "https://s3.amazonaws.com/lists.disconnect.me/simple_ad.txt" },
  { name: "abuse.ch",     url: "https://urlhaus.abuse.ch/downloads/hostfile/" },
  { name: "NoTrack",      url: "https://gitlab.com/quidsup/notrack-blocklists/raw/master/notrack-blocklist.txt" },
];

const ADLIST_LABELS: Record<string, string> = {
  address: "URL",
  comment: "Comment",
  enabled: "Enabled",
};
const ADLIST_ACCESSORS: Partial<Record<string, (e: Adlist) => string | number>> = {
  address: (e) => e.address,
  comment: (e) => e.comment || "",
  enabled: (e) => e.enabled,
};

export default defineComponent({
  name: "BlockListsView",
  components: {
    IonPage, IonContent, IonIcon,
    PageHeader, EmptyState, SortableHeader,
    InstanceTabBar, AddDomainForm, DomainListTable,
  },

  data() {
    const { copyToClipboard } = useClipboard();
    return {
      selectedInstanceId: null as string | null,
      activeTab:          "adlists" as string,
      isLoading:          false as boolean,
      rawAdlists:        markRaw([] as Adlist[]),
      sortedAdlists:      [] as Adlist[],
      adlistSortKey:      "" as string,
      domainList:        markRaw([] as DomainEntry[]),
      domainSearch:       "" as string,
      newAdlistUrl:       "" as string,
      newAdlistComment:   "" as string,
      counts:             {} as Record<string, number>,
      adlistSort:         markRaw(useMultiSort()) as MultiSort,
      ADLIST_LABELS,
      LIST_TABS,
      SUGGESTED_LISTS,
      copyToClipboard,
      shieldOutline, addOutline, cloudDownloadOutline,
      refreshOutline, copyOutline, trashOutline,
    };
  },

  computed: {
    instanceStore() {
      return useInstanceStore();
    },

    currentInstance() {
      return (
        this.instanceStore.instances.find(
          (i) => i.id === this.selectedInstanceId,
        ) ?? null
      );
    },

    currentTabLabel(): string {
      return LIST_TABS.find((t) => t.key === this.activeTab)?.label ?? "";
    },

    domainPlaceholder(): string {
      return this.activeTab.includes("regex")
        ? "e.g. .*\\.ads\\..*"
        : "e.g. ads.example.com";
    },


  },

  mounted() {
    this.instanceStore.loadFromStorage();
    this.selectedInstanceId =
      this.instanceStore.activeInstanceId ??
      this.instanceStore.instances[0]?.id ??
      null;
    if (this.selectedInstanceId) void this.loadAdlists();
  },

  methods: {
    // ── Adlist sort ───────────────────────────────────────────────────────────
    onAdlistSortChanged(): void {
      this.adlistSortKey = this.adlistSort.levels.map((l) => `${l.col}:${l.dir}`).join(",");
      this.rebuildAdlists();
    },

    onAdlistSortRemove(col: string): void {
      this.adlistSort.remove(col);
      this.onAdlistSortChanged();
    },

    onAdlistSortClear(): void {
      this.adlistSort.clear();
      this.onAdlistSortChanged();
    },

    rebuildAdlists(): void {
      if (this.adlistSort.levels.length) {
        this.sortedAdlists = this.adlistSort.apply(this.rawAdlists as Adlist[], ADLIST_ACCESSORS);
      } else {
        this.sortedAdlists = [...(this.rawAdlists as Adlist[])];
      }
    },

    selectInstance(id: string): void {
      this.selectedInstanceId = id;
      void this.loadAdlists();
    },

    switchTab(key: string): void {
      this.activeTab    = key;
      this.domainSearch = "";
      key === "adlists" ? void this.loadAdlists() : void this.loadDomainList();
    },

    async loadAdlists(): Promise<void> {
      if (!this.currentInstance) return;
      this.isLoading = true;
      try {
        const fetched = await PiholeApiService.getAdlists(this.currentInstance);
        this.rawAdlists = markRaw(fetched);
        this.counts = { ...this.counts, adlists: fetched.length };
        this.rebuildAdlists();
      } catch (err) {
        useNotificationStore().error(`Failed to load adlists: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
    },

    async loadDomainList(): Promise<void> {
      if (!this.currentInstance) return;
      this.isLoading = true;
      try {
        const raw = await PiholeApiService.getList(
          this.currentInstance,
          this.activeTab as DomainListType,
        );
        this.domainList = markRaw(raw);
        this.counts = { ...this.counts, [this.activeTab]: raw.length };
      } catch (err) {
        useNotificationStore().error(`Failed to load list: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
    },

    async addAdlist(): Promise<void> {
      if (!this.newAdlistUrl || !this.currentInstance) return;
      try {
        await PiholeApiService.addAdlist(
          this.currentInstance,
          this.newAdlistUrl,
          this.newAdlistComment,
        );
        useNotificationStore().success("Adlist added");
        this.newAdlistUrl     = "";
        this.newAdlistComment = "";
        await this.loadAdlists();
      } catch (err) {
        useNotificationStore().error(`Failed: ${(err as Error).message}`);
      }
    },

    async removeAdlist(url: string): Promise<void> {
      if (!this.currentInstance) return;
      try {
        await PiholeApiService.removeAdlist(this.currentInstance, url);
        useNotificationStore().success("Adlist removed");
        await this.loadAdlists();
      } catch (err) {
        useNotificationStore().error(`Failed: ${(err as Error).message}`);
      }
    },

    async addDomain(domain: string, comment: string): Promise<void> {
      if (!this.currentInstance) return;
      try {
        await PiholeApiService.addToList(
          this.currentInstance,
          this.activeTab as DomainListType,
          domain,
          comment,
        );
        useNotificationStore().success(`Added to ${this.currentTabLabel}: ${domain}`);
        await this.loadDomainList();
      } catch (err) {
        useNotificationStore().error(`Failed: ${(err as Error).message}`);
      }
    },

    async removeDomain(domain: string): Promise<void> {
      if (!this.currentInstance) return;
      try {
        await PiholeApiService.removeFromList(
          this.currentInstance,
          this.activeTab as DomainListType,
          domain,
        );
        useNotificationStore().success(`Removed: ${domain}`);
        await this.loadDomainList();
      } catch (err) {
        useNotificationStore().error(`Failed: ${(err as Error).message}`);
      }
    },

    async triggerGravityUpdate(): Promise<void> {
      if (!this.currentInstance) return;
      try {
        await PiholeApiService.updateGravity(this.currentInstance);
        useNotificationStore().info("Gravity update triggered (runs in background)");
      } catch (err) {
        useNotificationStore().error(`Failed: ${(err as Error).message}`);
      }
    },
  },
});
</script>

<style scoped>
.list-type-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 4px;
  flex-wrap: wrap;
}
.list-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.15s;
  font-family: var(--font-sans);
}
.list-tab:hover  { background: var(--bg-hover); color: var(--text-primary); }
.list-tab.active { background: var(--bg-base); color: var(--accent-cyan); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
.tab-count {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
  color: var(--text-muted);
}
.suggested-lists { padding-top: 8px; border-top: 1px solid var(--border-subtle); }

</style>
