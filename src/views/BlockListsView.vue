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

        <!-- List-type tab bar -->
        <div class="list-type-tabs mb-3">
          <button
            v-for="tab in LIST_TABS"
            :key="tab.key"
            class="list-tab"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
            <span v-if="counts[tab.key] != null" class="tab-count">{{
              counts[tab.key]
            }}</span>
          </button>
        </div>

        <!-- Adlists panel -->
        <template v-if="activeTab === 'adlists'">
          <div class="card mb-3">
            <div class="card-header">
              <span class="card-title">ADD ADLIST</span>
            </div>
            <div class="flex gap-2" style="flex-wrap: wrap">
              <input
                class="field-input"
                v-model="newAdlistUrl"
                style="flex: 1; min-width: 200px"
                placeholder="https://hosts.example.com/adlist.txt"
                @keyup.enter="addAdlist"
              />
              <input
                class="field-input"
                v-model="newAdlistComment"
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
              <div class="text-xs text-muted mb-2">
                Quick add popular lists:
              </div>
              <div class="flex gap-2" style="flex-wrap: wrap">
                <button
                  v-for="l in SUGGESTED_LISTS"
                  :key="l.url"
                  class="btn btn-ghost btn-sm"
                  @click="
                    newAdlistUrl = l.url;
                    newAdlistComment = l.name;
                  "
                >
                  + {{ l.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">ADLISTS ({{ adlists.length }})</span>
              <div class="flex gap-2">
                <button
                  class="btn btn-ghost btn-sm"
                  @click="triggerGravityUpdate"
                >
                  <ion-icon :icon="cloudDownloadOutline" /> Update Gravity
                </button>
                <button class="btn btn-ghost btn-sm" @click="loadAdlists">
                  <ion-icon :icon="refreshOutline" />
                </button>
              </div>
            </div>
            <div v-if="isLoading" class="p-3">
              <div
                v-for="i in 4"
                :key="i"
                class="skeleton"
                style="height: 44px; margin-bottom: 6px"
              />
            </div>
            <table v-else class="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Comment</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="list in adlists" :key="list.id">
                  <td class="mono" style="max-width: 300px">
                    <span class="truncate" :title="list.address">{{
                      list.address
                    }}</span>
                  </td>
                  <td style="color: var(--text-muted); font-size: 12px">
                    {{ list.comment || "—" }}
                  </td>
                  <td>
                    <span
                      class="badge"
                      :class="list.enabled ? 'badge-green' : 'badge-gray'"
                      >{{ list.enabled ? "On" : "Off" }}</span
                    >
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <button
                        class="btn btn-ghost btn-sm btn-icon"
                        title="Copy"
                        @click="copyToClipboard(list.address)"
                      >
                        <ion-icon :icon="copyOutline" />
                      </button>
                      <button
                        class="btn btn-danger btn-sm btn-icon"
                        title="Remove"
                        @click="removeAdlist(list.address)"
                      >
                        <ion-icon :icon="trashOutline" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!adlists.length && !isLoading">
                  <td
                    colspan="4"
                    style="
                      text-align: center;
                      padding: 30px;
                      color: var(--text-muted);
                    "
                  >
                    No adlists configured
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Domain lists panel -->
        <template v-else>
          <AddDomainForm
            :placeholder="domainPlaceholder"
            :loading="isLoading"
            @add="addDomain"
          />
          <DomainListTable
            :title="currentTabLabel"
            v-model:search-query="domainSearch"
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
import { defineComponent, ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import {
  shieldOutline,
  addOutline,
  cloudDownloadOutline,
  refreshOutline,
  copyOutline,
  trashOutline,
} from "ionicons/icons";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import InstanceTabBar from "@/components/blocklists/InstanceTabBar.vue";
import AddDomainForm from "@/components/blocklists/AddDomainForm.vue";
import DomainListTable from "@/components/blocklists/DomainListTable.vue";

import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useClipboard } from "@/composables/useClipboard";
import PiholeApiService from "@/services/piholeApi";
import type { Adlist, DomainEntry, DomainListType } from "@/types/api";

const LIST_TABS = [
  { key: "adlists", label: "Adlists" },
  { key: "black", label: "Blacklist" },
  { key: "white", label: "Whitelist" },
  { key: "regex_black", label: "Regex Block" },
  { key: "regex_white", label: "Regex Allow" },
] as const;

const SUGGESTED_LISTS = [
  {
    name: "StevenBlack",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
  },
  {
    name: "Disconnect.me",
    url: "https://s3.amazonaws.com/lists.disconnect.me/simple_ad.txt",
  },
  { name: "abuse.ch", url: "https://urlhaus.abuse.ch/downloads/hostfile/" },
  {
    name: "NoTrack",
    url: "https://gitlab.com/quidsup/notrack-blocklists/raw/master/notrack-blocklist.txt",
  },
];

export default defineComponent({
  name: "BlockListsView",
  components: {
    IonPage,
    IonContent,
    IonIcon,
    PageHeader,
    EmptyState,
    InstanceTabBar,
    AddDomainForm,
    DomainListTable,
  },

  setup() {
    const instanceStore = useInstanceStore();
    const notifications = useNotificationStore();
    const { copyToClipboard } = useClipboard();

    const selectedInstanceId = ref<string | null>(null);
    const activeTab = ref<string>("adlists");
    const isLoading = ref(false);
    const adlists = ref<Adlist[]>([]);
    const domainList = ref<DomainEntry[]>([]);
    const domainSearch = ref("");
    const newAdlistUrl = ref("");
    const newAdlistComment = ref("");
    const counts = ref<Record<string, number>>({});

    const currentInstance = computed(
      () =>
        instanceStore.instances.find(
          (i) => i.id === selectedInstanceId.value,
        ) ?? null,
    );

    const currentTabLabel = computed(
      () => LIST_TABS.find((t) => t.key === activeTab.value)?.label ?? "",
    );

    const domainPlaceholder = computed(() =>
      activeTab.value.includes("regex")
        ? "e.g. .*\\.ads\\..*"
        : "e.g. ads.example.com",
    );

    async function loadAdlists() {
      if (!currentInstance.value) return;
      isLoading.value = true;
      try {
        adlists.value = await PiholeApiService.getAdlists(
          currentInstance.value,
        );
        counts.value.adlists = adlists.value.length;
      } catch (err) {
        notifications.error(
          `Failed to load adlists: ${(err as Error).message}`,
        );
      } finally {
        isLoading.value = false;
      }
    }

    async function loadDomainList() {
      if (!currentInstance.value) return;
      isLoading.value = true;
      try {
        const raw = await PiholeApiService.getList(
          currentInstance.value,
          activeTab.value as DomainListType,
        );
        domainList.value = raw;
        counts.value[activeTab.value] = raw.length;
      } catch (err) {
        notifications.error(`Failed to load list: ${(err as Error).message}`);
      } finally {
        isLoading.value = false;
      }
    }

    function selectInstance(id: string) {
      selectedInstanceId.value = id;
      void loadAdlists();
    }

    function switchTab(key: string) {
      activeTab.value = key;
      domainSearch.value = "";
      key === "adlists" ? void loadAdlists() : void loadDomainList();
    }

    async function addAdlist() {
      if (!newAdlistUrl.value || !currentInstance.value) return;
      try {
        await PiholeApiService.addAdlist(
          currentInstance.value,
          newAdlistUrl.value,
          newAdlistComment.value,
        );
        notifications.success(`Added adlist`);
        newAdlistUrl.value = "";
        newAdlistComment.value = "";
        await loadAdlists();
      } catch (err) {
        notifications.error(`Failed: ${(err as Error).message}`);
      }
    }

    async function removeAdlist(url: string) {
      if (!currentInstance.value) return;
      try {
        await PiholeApiService.removeAdlist(currentInstance.value, url);
        notifications.success("Adlist removed");
        await loadAdlists();
      } catch (err) {
        notifications.error(`Failed: ${(err as Error).message}`);
      }
    }

    async function addDomain(domain: string, comment: string) {
      if (!currentInstance.value) return;
      try {
        await PiholeApiService.addToList(
          currentInstance.value,
          activeTab.value as DomainListType,
          domain,
          comment,
        );
        notifications.success(`Added to ${currentTabLabel.value}: ${domain}`);
        await loadDomainList();
      } catch (err) {
        notifications.error(`Failed: ${(err as Error).message}`);
      }
    }

    async function removeDomain(domain: string) {
      if (!currentInstance.value) return;
      try {
        await PiholeApiService.removeFromList(
          currentInstance.value,
          activeTab.value as DomainListType,
          domain,
        );
        notifications.success(`Removed: ${domain}`);
        await loadDomainList();
      } catch (err) {
        notifications.error(`Failed: ${(err as Error).message}`);
      }
    }

    async function triggerGravityUpdate() {
      if (!currentInstance.value) return;
      try {
        await PiholeApiService.updateGravity(currentInstance.value);
        notifications.info("Gravity update triggered (runs in background)");
      } catch (err) {
        notifications.error(`Failed: ${(err as Error).message}`);
      }
    }

    onMounted(() => {
      instanceStore.loadFromStorage();
      selectedInstanceId.value =
        instanceStore.activeInstanceId ??
        instanceStore.instances[0]?.id ??
        null;
      if (selectedInstanceId.value) void loadAdlists();
    });

    return {
      instanceStore,
      selectedInstanceId,
      activeTab,
      isLoading,
      adlists,
      domainList,
      domainSearch,
      newAdlistUrl,
      newAdlistComment,
      counts,
      currentTabLabel,
      domainPlaceholder,
      LIST_TABS,
      SUGGESTED_LISTS,
      selectInstance,
      switchTab,
      loadAdlists,
      loadDomainList,
      addAdlist,
      removeAdlist,
      addDomain,
      removeDomain,
      triggerGravityUpdate,
      copyToClipboard,
      shieldOutline,
      addOutline,
      cloudDownloadOutline,
      refreshOutline,
      copyOutline,
      trashOutline,
    };
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
.list-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.list-tab.active {
  background: var(--bg-base);
  color: var(--accent-cyan);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.tab-count {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
  color: var(--text-muted);
}
.suggested-lists {
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
</style>
