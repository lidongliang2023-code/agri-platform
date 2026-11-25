<template>
  <div style="width: 100%">
    <p>申请登记不代表执行；结果来自设备或网关接入端回执。超时须人工核实，不自动重发。接入端须按指令编号幂等执行。</p>
    <button type="button" :disabled="busy" @click="refresh">{{ busy ? '读取中…' : '刷新回执' }}</button>
    <p v-if="error" role="alert" style="color: #cf1322">{{ error }}</p>
    <div style="overflow-x: auto; margin-top: 12px">
      <table style="width: 100%; min-width: 1100px; border-collapse: collapse">
        <thead>
          <tr>
            <th v-for="label in headers" :key="label" style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd">
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.commandNo || index">
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.commandNo || '历史记录' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.action || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ labels[row.status] || row.status || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.operator || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.createdAt || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.sentAt || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.receiptAt || '—' }}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">
              {{ row.progress === undefined ? '—' : `${row.progress}% · ${row.installedVersion || '未报告版本'}` }}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-word">{{ row.result || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!busy && !error && rows.length === 0">暂无指令记录</p>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 12px">
      <button type="button" :disabled="page === 1 || busy" @click="page -= 1">上一页</button>
      <span>第 {{ page }} 页</span>
      <button type="button" :disabled="rows.length < 20 || busy" @click="page += 1">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type CommandReceipt = {
  commandNo: string | null
  status: string
  action: string
  operator: string
  result: string
  createdAt: string
  sentAt: string | null
  receiptAt: string | null
  expiresAt: string | null
  progress?: number
  installedVersion?: string | null
}

const props = defineProps<{
  deviceId: number
  load: (id: number, page: number) => Promise<CommandReceipt[]>
}>()

const headers = ['指令编号', '动作', '状态', '申请人', '申请时间', '领取时间', '回执时间', '进度/安装版本', '执行结果']
const labels: Record<string, string> = {
  PENDING: '待接入端领取',
  SENT: '已领取待回执',
  RUNNING: '升级执行中',
  SUCCEEDED: '接入端报告成功',
  FAILED: '接入端报告失败',
  TIMEOUT: '超时结果未知',
  EXPIRED: '未领取已过期',
  LEGACY: '历史未采集回执',
}

const rows = ref<CommandReceipt[]>([])
const page = ref(1)
const busy = ref(false)
const error = ref('')
let timer: number | null = null
let running = false

async function refresh() {
  if (running) return
  running = true
  busy.value = true
  try {
    rows.value = await props.load(props.deviceId, page.value)
    error.value = ''
  } catch (e) {
    rows.value = []
    error.value = e instanceof Error ? e.message : '回执查询失败'
  } finally {
    running = false
    busy.value = false
  }
}

watch(() => [props.deviceId, page.value] as const, () => {
  void refresh()
})

onMounted(() => {
  void refresh()
  timer = window.setInterval(() => void refresh(), 10000)
})

onBeforeUnmount(() => {
  if (timer != null) window.clearInterval(timer)
})
</script>
