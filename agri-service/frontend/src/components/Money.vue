<template>
  <span class="money">¥{{ amount }}<small>{{ suffix }}</small></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ value: number | string; suffix?: string }>(), { suffix: '元' })
const amount = computed(() => (typeof props.value === 'number' ? props.value.toLocaleString('zh-CN') : props.value))
</script>
