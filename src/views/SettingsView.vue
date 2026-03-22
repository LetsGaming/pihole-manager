<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Settings">
      <template #actions>
        <button class="btn btn-primary btn-sm" @click="openAdd">
          <ion-icon :icon="addOutline" style="font-size:14px" />
          Add Instance
        </button>
      </template>
    </PageHeader>

    <ion-content class="page-content">
      <!-- Instances -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-label">INSTANCES</div>
          <span class="badge badge-info">{{ instanceStore.instances.length }} configured</span>
        </div>

        <EmptyState v-if="!instanceStore.instances.length" :icon="serverOutline" title="No instances yet"
                  subtitle="Add your first Pi-hole instance to get started." style="padding:40px 20px">
          <button class="btn btn-primary mt-3" @click="openAdd"><ion-icon :icon="addOutline" /> Add Instance</button>
        </EmptyState>

        <div v-else class="instance-list">
          <div v-for="inst in instanceStore.instances" :key="inst.id" class="instance-row">
            <div class="instance-row-left">
              <div class="instance-status-dot" :class="`status-${inst.status}`" />
              <div>
                <div class="instance-row-name">{{ inst.name }}</div>
                <div class="instance-row-url text-mono text-muted text-sm">{{ inst.url }}</div>
                <div class="text-xs text-muted mt-1">API {{ inst.apiVersion }}</div>
              </div>
            </div>
            <div class="instance-row-actions">
              <button class="btn btn-ghost btn-sm" title="Test connection" @click="runQuickTest(inst)">
                <ion-icon :icon="pulseOutline" style="font-size:14px" /> Test
              </button>
              <button class="btn btn-ghost btn-sm" title="Edit" @click="openEdit(inst)">
                <ion-icon :icon="pencilOutline" style="font-size:14px" /> Edit
              </button>
              <button class="btn btn-ghost btn-sm" title="Export config" @click="exportConfig">
                <ion-icon :icon="downloadOutline" style="font-size:14px" />
              </button>
              <button class="btn btn-danger btn-sm" title="Remove" @click="confirmRemove(inst)">
                <ion-icon :icon="trashOutline" style="font-size:14px" />
              </button>
            </div>
          </div>
        </div>

        <!-- Import/export row -->
        <div class="import-export-row mt-3">
          <button class="btn btn-ghost btn-sm" @click="exportConfig">
            <ion-icon :icon="downloadOutline" /> Export Config
          </button>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">
            <ion-icon :icon="cloudUploadOutline" /> Import Config
            <input type="file" accept=".json" style="display:none" @change="importConfig" />
          </label>
        </div>
      </div>

      <!-- App Settings -->
      <div class="settings-section">
        <div class="section-label">APP SETTINGS</div>
        <div class="settings-form-group">
          <label class="settings-label">Poll Interval</label>
          <select v-model.number="settings.pollInterval" class="input-field" style="width:180px" @change="save">
            <option :value="15000">15 seconds</option>
            <option :value="30000">30 seconds</option>
            <option :value="60000">1 minute</option>
            <option :value="300000">5 minutes</option>
          </select>
        </div>
        <div class="settings-form-group">
          <label class="settings-label">Query Log Refresh</label>
          <select v-model.number="settings.logRefreshInterval" class="input-field" style="width:180px" @change="save">
            <option :value="3000">3 seconds</option>
            <option :value="5000">5 seconds</option>
            <option :value="10000">10 seconds</option>
            <option :value="30000">30 seconds</option>
          </select>
        </div>
        <div class="settings-form-group">
          <label class="settings-label">Default Disable Duration</label>
          <select v-model.number="settings.defaultDisableDuration" class="input-field" style="width:180px" @change="save">
            <option :value="0">Indefinite</option>
            <option :value="300">5 minutes</option>
            <option :value="600">10 minutes</option>
            <option :value="1800">30 minutes</option>
            <option :value="3600">1 hour</option>
          </select>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-section danger-section">
        <div class="section-label">DANGER ZONE</div>
        <div class="danger-row">
          <div>
            <div class="danger-title">Clear all data</div>
            <div class="text-muted text-sm">Remove all instances and reset settings. Cannot be undone.</div>
          </div>
          <button class="btn btn-danger btn-sm" @click="clearAll">Clear All Data</button>
        </div>
      </div>
    </ion-content>

    <InstanceForm
      :is-open="showForm"
      :editing="editingInstance"
      @close="closeForm"
      @save="handleSave"
    />

    <ion-alert
      :is-open="showRemoveAlert"
      header="Remove Instance"
      :message="`Remove '${pendingRemove?.name}'? This cannot be undone.`"
      :buttons="removeButtons"
      @did-dismiss="showRemoveAlert = false"
    />
  </ion-page>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { IonPage, IonContent, IonIcon, IonAlert } from '@ionic/vue';
import { addOutline, pencilOutline, trashOutline, pulseOutline, serverOutline, downloadOutline, cloudUploadOutline } from 'ionicons/icons';

import PageHeader    from '@/components/ui/PageHeader.vue';
import EmptyState    from '@/components/ui/EmptyState.vue';
import InstanceForm  from '@/components/settings/InstanceForm.vue';

import { useInstanceStore }    from '@/stores/instanceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAppSettings }      from '@/composables/useAppSettings';
import PiholeApiService        from '@/services/piholeApi';
import type { PiholeInstance, NewInstanceConfig } from '@/types/instance';

export default defineComponent({
  name: 'SettingsView',
  components: { IonPage, IonContent, IonIcon, IonAlert, PageHeader, EmptyState, InstanceForm },

  setup() {
    const instanceStore = useInstanceStore();
    const notifications = useNotificationStore();
    const { settings, load, save } = useAppSettings();

    const showForm       = ref(false);
    const editingInstance = ref<PiholeInstance | null>(null);
    const showRemoveAlert = ref(false);
    const pendingRemove  = ref<PiholeInstance | null>(null);

    function openAdd()  { editingInstance.value = null; showForm.value = true; }
    function openEdit(inst: PiholeInstance) { editingInstance.value = inst; showForm.value = true; }
    function closeForm() { showForm.value = false; editingInstance.value = null; }

    function handleSave(config: NewInstanceConfig, editingId: string | null) {
      if (editingId) {
        instanceStore.updateInstance(editingId, config);
        notifications.success(`Updated "${config.name}"`);
      } else {
        instanceStore.addInstance(config);
        notifications.success(`Added "${config.name}"`);
      }
      closeForm();
    }

    function confirmRemove(inst: PiholeInstance) { pendingRemove.value = inst; showRemoveAlert.value = true; }

    const removeButtons = [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Remove', role: 'destructive', handler: () => {
        if (!pendingRemove.value) return;
        instanceStore.removeInstance(pendingRemove.value.id);
        notifications.info(`Removed "${pendingRemove.value.name}"`);
        pendingRemove.value = null;
      }},
    ];

    async function runQuickTest(inst: PiholeInstance) {
      notifications.info(`Testing ${inst.name}…`);
      const r = await PiholeApiService.testConnection(inst);
      r.ok
        ? notifications.success(`${inst.name}: Connected (${r.latencyMs}ms)`)
        : notifications.error(`${inst.name}: ${r.message}`);
    }

    function exportConfig() {
      const data = {
        version: 2, exportedAt: new Date().toISOString(),
        instances: instanceStore.instances.map(({ id: _id, status: _s, addedAt: _a, ...rest }) => rest),
        settings: { ...settings },
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `orbital-config-${Date.now()}.json` });
      a.click(); URL.revokeObjectURL(url);
    }

    function importConfig(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!data.instances) throw new Error('Invalid config file');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.instances.forEach((cfg: any) => instanceStore.addInstance(cfg));
          if (data.settings) { Object.assign(settings, data.settings); save(); }
          notifications.success(`Imported ${data.instances.length} instances`);
        } catch (err) { notifications.error(`Import failed: ${(err as Error).message}`); }
      };
      reader.readAsText(file);
      (event.target as HTMLInputElement).value = '';
    }

    function clearAll() {
      if (!confirm('Clear ALL data? This cannot be undone.')) return;
      [...instanceStore.instances].forEach((i) => instanceStore.removeInstance(i.id));
      notifications.info('All data cleared');
    }

    onMounted(() => { instanceStore.loadFromStorage(); load(); });

    return {
      instanceStore, settings, showForm, editingInstance, showRemoveAlert, pendingRemove,
      openAdd, openEdit, closeForm, handleSave, confirmRemove, removeButtons,
      runQuickTest, exportConfig, importConfig, clearAll, save,
      addOutline, pencilOutline, trashOutline, pulseOutline, serverOutline, downloadOutline, cloudUploadOutline,
    };
  },
});
</script>

<style scoped>
.settings-section { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
.section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.settings-form-group { margin-bottom: 20px; }
.settings-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
.instance-list { display: flex; flex-direction: column; gap: 4px; }
.instance-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); gap: 12px; }
.instance-row-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.instance-row-name { font-size: 14px; font-weight: 500; }
.instance-row-url { margin-top: 2px; }
.instance-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.import-export-row { display: flex; gap: 8px; }
.danger-section { border-color: rgba(248,113,113,0.2); }
.danger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.danger-title { font-size: 14px; font-weight: 500; color: var(--accent-red); }
@media (max-width: 600px) {
  .instance-row { flex-direction: column; align-items: flex-start; }
  .instance-row-actions { width: 100%; justify-content: flex-end; }
  .danger-row { flex-direction: column; align-items: flex-start; }
}
</style>
