<template>
  <div class="device-empty-state">
    <span>{{ icon }}</span>
    <div>
      <b>{{ title }}</b>
      <small>{{ desc }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; desc: string }>(), { icon: '📡' })
</script>
