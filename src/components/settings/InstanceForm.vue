<template>
  <ion-modal :is-open="isOpen" @did-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title style="font-family:var(--font-mono);font-size:16px">
          {{ isEditing ? 'Edit Instance' : 'Add Instance' }}
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form class="instance-form" @submit.prevent="submit">

        <div class="form-field">
          <label class="form-label">Instance Name *</label>
          <input v-model="local.name" class="input-field w-full" placeholder="e.g. Home Pi-hole" required />
        </div>

        <div class="form-field">
          <label class="form-label">Pi-hole URL *</label>
          <input v-model="local.url" class="input-field w-full" type="url" placeholder="http://192.168.1.100" required />
          <div class="form-hint text-muted text-xs mt-1">
            Base URL without trailing slash. Include port if needed (e.g. <code>http://pi.hole:8080</code>)
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">{{ local.apiVersion === 'v6' ? 'Web Password *' : 'API Token *' }}</label>
          <div class="input-with-action">
            <input
              v-model="local.apiToken"
              class="input-field w-full"
              :type="showToken ? 'text' : 'password'"
              :placeholder="local.apiVersion === 'v6' ? 'Your Pi-hole web password' : 'Paste your Pi-hole API token'"
              required
            />
            <button type="button" class="btn btn-ghost btn-sm" @click="showToken = !showToken">
              <ion-icon :icon="showToken ? eyeOffOutline : eyeOutline" style="font-size:16px" />
            </button>
          </div>
          <div class="form-hint text-muted text-xs mt-1">
            <span v-if="local.apiVersion === 'v6'">Pi-hole v6: use your web UI password (Settings → General)</span>
            <span v-else>Found in Pi-hole admin → Settings → API / Web Interface → Show API token</span>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">API Version</label>
          <select v-model="local.apiVersion" class="input-field w-full">
            <option value="v5">v5 (legacy, most installs)</option>
            <option value="v6">v6 (Pi-hole v6+)</option>
          </select>
        </div>

        <div v-if="error" class="alert-error mt-2">
          <ion-icon :icon="warningOutline" /> {{ error }}
        </div>

        <!-- Test result -->
        <div v-if="testResult" class="form-test-result mt-2" :class="testResult.ok ? 'ok' : 'err'">
          <ion-icon :icon="testResult.ok ? checkmarkCircleOutline : closeCircleOutline" />
          {{ testResult.message }}
          <span v-if="testResult.latencyMs" class="text-xs text-muted ml-auto">{{ testResult.latencyMs }}ms</span>
        </div>

        <div class="modal-actions mt-3">
          <button type="button" class="btn btn-ghost" :disabled="testing" @click="runTest">
            <ion-icon :icon="testing ? syncOutline : pulseOutline" style="font-size:14px" />
            {{ testing ? 'Testing…' : 'Test Connection' }}
          </button>
          <div class="flex gap-2">
            <button type="button" class="btn btn-ghost" @click="$emit('close')">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (isEditing ? 'Update' : 'Add Instance') }}
            </button>
          </div>
        </div>

      </form>
    </ion-content>
  </ion-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import type { PropType } from 'vue';
import {
  IonModal, IonHeader, IonToolbar, IonTitle,
  IonButtons, IonButton, IonContent, IonIcon,
} from '@ionic/vue';
import {
  eyeOutline, eyeOffOutline, warningOutline,
  checkmarkCircleOutline, closeCircleOutline,
  syncOutline, pulseOutline,
} from 'ionicons/icons';
import PiholeApiService from '@/services/piholeApi';
import type { PiholeInstance, NewInstanceConfig } from '@/types/instance';
import type { ConnectionTestResult } from '@/types/api';

export default defineComponent({
  name: 'InstanceForm',
  components: {
    IonModal, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonButton, IonContent, IonIcon,
  },

  props: {
    isOpen:    { type: Boolean,  required: true },
    /** Pass an instance to edit; null/undefined = add mode */
    editing:   { type: Object as PropType<PiholeInstance | null>, default: null },
  },

  emits: ['close', 'save'],

  setup(props, { emit }) {
    const local = ref<NewInstanceConfig>({ name: '', url: '', apiToken: '', apiVersion: 'v5' });
    const showToken  = ref(false);
    const testing    = ref(false);
    const saving     = ref(false);
    const error      = ref<string | null>(null);
    const testResult = ref<ConnectionTestResult | null>(null);

    const isEditing = ref(false);

    // Populate form when switching to edit mode
    watch(() => props.editing, (inst) => {
      if (inst) {
        isEditing.value = true;
        local.value = { name: inst.name, url: inst.url, apiToken: inst.apiToken, apiVersion: inst.apiVersion };
      } else {
        isEditing.value = false;
        local.value = { name: '', url: '', apiToken: '', apiVersion: 'v5' };
      }
      error.value      = null;
      testResult.value = null;
      showToken.value  = false;
    }, { immediate: true });

    async function runTest() {
      if (!local.value.url || !local.value.apiToken) {
        testResult.value = { ok: false, message: 'Fill in URL and API Token first', latencyMs: 0 };
        return;
      }
      testing.value    = true;
      testResult.value = null;
      try {
        testResult.value = await PiholeApiService.testConnection({
          id: '_test', status: 'unknown' as const, addedAt: '',
          ...local.value,
          url: local.value.url.replace(/\/$/, ''),
        });
      } finally {
        testing.value = false;
      }
    }

    async function submit() {
      saving.value = true;
      error.value  = null;
      try {
        emit('save', { ...local.value, url: local.value.url.replace(/\/$/, '') }, props.editing?.id ?? null);
      } catch (err) {
        error.value = (err as Error).message ?? 'Failed to save';
      } finally {
        saving.value = false;
      }
    }

    return {
      local, showToken, testing, saving, error, testResult, isEditing,
      runTest, submit,
      eyeOutline, eyeOffOutline, warningOutline,
      checkmarkCircleOutline, closeCircleOutline, syncOutline, pulseOutline,
    };
  },
});
</script>

<style scoped>
.instance-form { display: flex; flex-direction: column; gap: 4px; min-height: 100%; padding: 8px 0; }
.form-field { margin-bottom: 16px; }
.form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
.form-hint  { line-height: 1.5; }
.input-with-action { display: flex; align-items: center; gap: 6px; }
.modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.form-test-result {
  display: flex; align-items: center; gap: 6px; font-size: 13px;
  padding: 10px 12px; border-radius: var(--radius-md);
}
.form-test-result.ok  { background: rgba(74,222,128,0.1);  color: var(--accent-green); }
.form-test-result.err { background: rgba(248,113,113,0.1); color: var(--accent-red);   }
.alert-error {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3);
  border-radius: var(--radius-md); color: var(--accent-red); font-size: 13px;
}
</style>
