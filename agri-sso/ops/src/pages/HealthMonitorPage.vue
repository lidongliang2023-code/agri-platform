<template>
  <div class="health-monitor">
    <header>
      <div>
        <small>平台运维</small>
        <h1>统一健康监控</h1>
        <p>后台持续巡检 · 综合健康、存活、就绪分别判断</p>
      </div>
      <a-button :loading="loading" @click="load()">刷新监控快照</a-button>
    </header>

    <a-alert
      v-if="error"
      type="error"
      show-icon
      message="监控数据读取失败"
      :description="`${error}。当前展示可能是上次成功结果，不代表服务仍然健康。`"
    />
    <a-alert
      v-if="stale"
      type="warning"
      show-icon
      message="巡检结果已超过 90 秒未更新，请检查核心平台监控任务"
    />

    <div class="health-summary">
      <a-card v-for="[name, value] in summaryCards" :key="name">
        <span>{{ name }}</span>
        <strong>{{ value }}</strong>
      </a-card>
    </div>

    <a-alert
      type="info"
      show-icon
      message="健康状态不等于业务闭环验证通过"
      description="核心平台每轮完成后间隔 30 秒巡检；页面每 30 秒读取快照。异常仅在本页及服务日志记录，不自动重启服务，也未接入短信、邮件或外部告警。监控自身不可访问时，本页会提示读取失败。"
    />

    <div class="health-tools">
      <a-input v-model:value="keyword" placeholder="搜索子系统" />
      <a-select v-model:value="filter" :options="filterOptions" />
      <span>最近巡检：{{ data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : '等待首轮巡检' }}</span>
    </div>

    <a-card v-if="!shown.length">
      {{ loading ? '正在读取…' : rows.length ? '没有符合筛选条件的服务' : '后台正在准备首轮巡检，请稍后刷新' }}
    </a-card>

    <div class="health-grid">
      <a-card v-for="s in shown" :key="s.id" :title="s.name">
        <template #extra>
          <a-tag :color="s.status === 'UP' ? 'green' : s.status === 'UNCONFIGURED' ? 'default' : 'orange'">
            {{ label(s.status) }}
          </a-tag>
        </template>
        <p v-if="s.status === 'UNCONFIGURED'">尚未确认独立运行地址。部署时配置对应服务目标后纳入巡检；不计为健康。</p>
        <template v-else>
          <div v-for="p in s.probes" :key="p.name" class="health-probe">
            <div>
              <b>{{ p.name }}</b>
              <a-tag :color="p.status === 'UP' ? 'green' : 'red'">{{ label(p.status) }}</a-tag>
            </div>
            <p>{{ p.message }}</p>
            <small>{{ p.latencyMs }} ms{{ Number(p.httpCode) > 0 ? ` · HTTP ${p.httpCode}` : '' }}</small>
          </div>
        </template>
      </a-card>
    </div>

    <a-collapse>
      <a-collapse-panel key="events" header="最近状态变化（本次服务运行期间最多 100 条）">
        <a-space direction="vertical">
          <div v-for="(e, i) in data?.events ?? []" :key="`${e.at}-${i}`">
            <b>{{ e.name }}</b> · {{ label(e.from) }} → {{ label(e.to) }} <small>{{ new Date(e.at).toLocaleString() }}</small>
          </div>
          <span v-if="!data?.events.length">尚无状态变化记录</span>
        </a-space>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { healthMonitor } from '../api'
import type { HealthSnapshot } from '../types'
import './health-monitor.css'

const STATUS_LABELS: Record<string, string> = {
  UP: '正常',
  ATTENTION: '需要处理',
  UNCONFIGURED: '未配置',
  MISSING: '探针缺失',
  DOWN: '未就绪',
  DENIED: '访问受限',
  TIMEOUT: '超时',
  UNREACHABLE: '无法连接',
  INVALID: '响应异常',
  ERROR: '探测失败',
}
const label = (s: string) => STATUS_LABELS[s] || s

const data = ref<HealthSnapshot | null>(null)
const error = ref('')
const loading = ref(false)
const keyword = ref('')
const filter = ref('all')

const filterOptions = [
  { value: 'all', label: '全部服务' },
  { value: 'issues', label: '只看异常 / 未配置' },
  { value: 'healthy', label: '只看正常' },
]

let active = true
let busy = false
let timer: number | undefined

async function load() {
  if (busy) return
  busy = true
  if (active) loading.value = true
  try {
    const next = await healthMonitor()
    if (active) {
      data.value = next
      error.value = ''
    }
  } catch (e) {
    if (active) error.value = e instanceof Error ? e.message : '监控数据读取失败'
  } finally {
    busy = false
    if (active) loading.value = false
  }
}

function handleVisible() {
  if (!document.hidden) void load()
}

onMounted(() => {
  void load()
  timer = window.setInterval(() => { if (!document.hidden) void load() }, 30000)
  document.addEventListener('visibilitychange', handleVisible)
})

onUnmounted(() => {
  active = false
  if (timer) window.clearInterval(timer)
  document.removeEventListener('visibilitychange', handleVisible)
})

const rows = computed(() => data.value?.services ?? [])
const good = computed(() => rows.value.filter((x) => x.status === 'UP').length)
const missing = computed(() => rows.value.filter((x) => x.status === 'UNCONFIGURED').length)
const stale = computed(() => Boolean(data.value?.checkedAt && Date.now() - Date.parse(data.value.checkedAt) > 90000))
const summaryCards = computed<[string, number][]>(() => [
  ['纳管服务', rows.value.length],
  ['正常', good.value],
  ['需要处理', rows.value.length - good.value - missing.value],
  ['未配置', missing.value],
])
const shown = computed(() =>
  rows.value.filter(
    (x) =>
      x.name.includes(keyword.value.trim()) &&
      (filter.value === 'all' || (filter.value === 'issues' ? x.status !== 'UP' : x.status === 'UP')),
  ),
)
</script>
