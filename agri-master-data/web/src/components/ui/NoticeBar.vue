<template>
  <div class="mds-notice" :class="tone === 'brand' ? '' : `mds-notice--${tone}`">
    <div>
      <span v-if="title" class="mds-notice__title">{{ title }}</span>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'brand' | 'info' | 'warning' | 'danger' | 'ai'
    title?: string
  }>(),
  { tone: 'brand' },
)
</script>
