<template>
  <div class="iot-title">
    <div>
      <span>IOT ASSET OPERATIONS</span>
      <h1>{{ title }}</h1>
      <p>{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="iot-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; desc: string }>()
</script>
