<template>
  <div class="section-heading compact">
    <div>
      <span v-if="kicker" class="section-kicker">{{ kicker }}</span>
      <h2>{{ title }}</h2>
    </div>
    <button v-if="action" type="button" @click="emit('action')">{{ action }} <ArrowRightOutlined /></button>
  </div>
</template>

<script setup lang="ts">
import { ArrowRightOutlined } from '@ant-design/icons-vue'

defineProps<{ kicker?: string; title: string; action?: string }>()
const emit = defineEmits<{ action: [] }>()
</script>
