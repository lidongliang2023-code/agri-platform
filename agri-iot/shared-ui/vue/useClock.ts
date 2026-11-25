import { onBeforeUnmount, onMounted, ref } from 'vue'

const pad = (value: number) => String(value).padStart(2, '0')
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function useClock(intervalMs = 30_000) {
  const now = ref(new Date())
  let timer: number | null = null

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = new Date()
    }, intervalMs)
  })

  onBeforeUnmount(() => {
    if (timer != null) window.clearInterval(timer)
  })

  return {
    now,
    date: () =>
      `${now.value.getFullYear()}-${pad(now.value.getMonth() + 1)}-${pad(now.value.getDate())} ${WEEKDAYS[now.value.getDay()]}`,
    time: () => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`,
  }
}
