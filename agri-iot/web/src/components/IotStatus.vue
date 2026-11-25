<template>
  <a-tag :class="`iot-status tone-${meta.tone}`">{{ meta.label }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { STATUS } from '../api/iotExperience'

const props = defineProps<{ value: string }>()
const meta = computed(() => STATUS[props.value] ?? { label: props.value, tone: 'gray' })
</script>
