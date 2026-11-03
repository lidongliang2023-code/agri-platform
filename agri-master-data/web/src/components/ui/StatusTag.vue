<template>
  <span class="mds-tag" :class="[`mds-tag--${tone}`, plain ? 'mds-tag--plain' : '']">{{ text }}</span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'cyan' | 'purple' | 'gray'
    plain?: boolean
  }>(),
  { tone: 'gray', plain: false },
)
</script>
