<template>
  <div class="loading-list">
    <div v-for="idx in rows" :key="idx" class="skeleton-card">
      <i />
      <span />
      <span />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>
