<template>
  <header class="mds-page-head">
    <div>
      <h1 class="mds-page-title">{{ title }}</h1>
      <p v-if="subtitle" class="mds-page-sub">{{ subtitle }}</p>
      <slot />
    </div>
    <div class="mds-head-actions">
      <span v-if="source" class="mds-source">{{ source }}</span>
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  source?: string
}>()
</script>
