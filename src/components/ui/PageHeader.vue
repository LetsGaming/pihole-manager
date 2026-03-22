<template>
  <ion-header>
    <ion-toolbar class="page-header-toolbar">
      <ion-buttons slot="start">
        <ion-menu-button />
      </ion-buttons>
      <div slot="start" class="page-title" style="margin-left: 8px">
        {{ title }}
      </div>
      <ion-buttons slot="end">
        <slot name="actions" />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton } from "@ionic/vue";

export default defineComponent({
  name: "PageHeader",
  components: { IonHeader, IonToolbar, IonButtons, IonMenuButton },
  props: {
    title: { type: String, required: true },
  },
});
</script>
