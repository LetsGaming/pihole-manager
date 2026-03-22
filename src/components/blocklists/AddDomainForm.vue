<template>
  <div class="card mb-3">
    <div class="card-header">
      <span class="card-title">ADD DOMAIN</span>
    </div>
    <div class="flex gap-2" style="flex-wrap: wrap">
      <input
        class="field-input"
        style="flex: 1; min-width: 200px"
        v-model="domain"
        :placeholder="placeholder"
        @keyup.enter="submit"
      />
      <input
        class="field-input"
        style="width: 200px"
        v-model="comment"
        placeholder="Comment (optional)"
      />
      <button
        class="btn btn-primary"
        :disabled="!domain || loading"
        @click="submit"
      >
        <ion-icon :icon="addOutline" />
        Add
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { IonIcon } from "@ionic/vue";
import { addOutline } from "ionicons/icons";

export default defineComponent({
  name: "AddDomainForm",
  components: { IonIcon },

  props: {
    placeholder: { type: String, default: "e.g. ads.example.com" },
    loading: { type: Boolean, default: false },
  },

  emits: ["add"],

  setup(_, { emit }) {
    const domain = ref("");
    const comment = ref("");

    function submit() {
      if (!domain.value.trim()) return;
      emit("add", domain.value.trim(), comment.value.trim());
      domain.value = "";
      comment.value = "";
    }

    return { domain, comment, submit, addOutline };
  },
});
</script>
