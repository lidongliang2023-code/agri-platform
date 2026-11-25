<template>
  <button type="button" @click="emit('open')">
    <BellOutlined />
    <i v-if="unread > 0">{{ unread }}</i>
  </button>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { BellOutlined } from '@ant-design/icons-vue'
import { iotApi } from '../api/iotExperience'

const emit = defineEmits<{ open: [] }>()
const unread = ref(0)
let alive = true
let timer: number | undefined

function refresh() {
  void iotApi.messages()
    .then((items) => {
      if (alive) unread.value = items.filter((item) => !item.read).length
    })
    .catch(() => {})
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 30000)
  window.addEventListener('iot-messages-updated', refresh)
})

onUnmounted(() => {
  alive = false
  if (timer) window.clearInterval(timer)
  window.removeEventListener('iot-messages-updated', refresh)
})
</script>
