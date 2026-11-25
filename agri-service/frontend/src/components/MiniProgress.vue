<template>
  <a-progress :percent="value" size="small" :show-info="false" stroke-color="#159a5e" trail-color="#e9f0eb" />
</template>

<script setup lang="ts">
defineProps<{ value: number }>()
</script>
