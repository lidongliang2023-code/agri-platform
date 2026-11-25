<template>
  <div class="empty-state">
    <span>{{ icon }}</span>
    <strong>{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), { icon: '🗂️' })
</script>
