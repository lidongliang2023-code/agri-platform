<template>
  <div :class="`stat-tile tone-${tone}`">
    <span class="stat-label">{{ label }}</span>
    <b class="stat-value">{{ value }}<small v-if="unit">{{ unit }}</small></b>
    <span v-if="note || $slots.note" class="stat-note"><slot name="note">{{ note }}</slot></span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; value: string | number; unit?: string; note?: string; tone?: string }>(), { tone: 'default' })
</script>
