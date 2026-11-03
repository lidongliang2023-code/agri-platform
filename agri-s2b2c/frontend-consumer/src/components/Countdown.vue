<template>
  <span class="m-countdown" :class="{ done }">
    <template v-if="!done">
      <template v-if="parts.d">
        <b>{{ parts.d }}</b><em class="unit">天</em>
      </template>
      <b>{{ parts.h }}</b><i>:</i><b>{{ parts.m }}</b><i>:</i><b>{{ parts.s }}</b>
    </template>
    <span v-else class="end-text">{{ endText }}</span>
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  endTime: { type: [String, Number, Date], default: '' },
  endText: { type: String, default: '已结束' },
})
const emit = defineEmits(['end'])

const remain = ref(0)
let timer = null

function target() {
  if (!props.endTime) return 0
  const value = String(props.endTime).replace(' ', 'T')
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

function tick() {
  const ts = target()
  remain.value = ts ? Math.max(0, ts - Date.now()) : 0
  if (ts && remain.value === 0) {
    emit('end')
    stop()
  }
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.endTime,
  () => {
    stop()
    tick()
    if (remain.value > 0) timer = setInterval(tick, 1000)
  },
  { immediate: true },
)

onBeforeUnmount(stop)

const done = computed(() => !props.endTime || remain.value <= 0)

const parts = computed(() => {
  const total = Math.floor(remain.value / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  // 跨天活动（如秒杀持续到月底）按「天 + 时:分:秒」展示，避免出现 1000 小时这种数字
  const days = Math.floor(total / 86400)
  return {
    d: days > 0 ? String(days) : '',
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  }
})
</script>

<style scoped>
.m-countdown {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #d45b32;
  font-variant-numeric: tabular-nums;
}

.m-countdown b {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 5px;
  background: #2b1a14;
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
}

.m-countdown em.unit {
  margin: 0 2px;
  color: #d45b32;
  font-size: var(--agri-font-size-micro);
  font-style: normal;
  font-weight: 600;
}

.m-countdown i {
  color: #d45b32;
  font-style: normal;
  font-weight: 700;
}

.end-text {
  color: #93a29a;
  font-size: 12.5px;
}
</style>
