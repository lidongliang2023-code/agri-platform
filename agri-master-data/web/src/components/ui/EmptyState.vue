<template>
  <div class="mds-empty">
    <div class="mds-empty__icon">{{ icon }}</div>
    <div class="mds-empty__title">{{ title }}</div>
    <div v-if="description" class="mds-empty__desc">{{ description }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
  }>(),
  { icon: '📭' },
)
</script>
