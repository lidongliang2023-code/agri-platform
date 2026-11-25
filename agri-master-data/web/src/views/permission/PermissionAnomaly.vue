<template>
  <div class="mds-page">
    <PageHeader
      title="异常权限检测"
      subtitle="权限过大、互斥角色、过期权限、重复与幽灵权限的巡检结果。每条结论都由库里的授权关系算出，判定依据写在描述里，不做模拟造数。"
      source="角色权限 · 巡检接口"
    />

    <StatGrid :items="stats" />

    <!-- 上次扫描时间来自结果表，从未扫描过时如实说"尚未扫描"，不拿当前时间冒充 -->
    <NoticeBar :tone="openCount > 0 ? 'danger' : 'success'" :title="scanBannerTitle">
      {{ scanBannerBody }}
    </NoticeBar>

    <AgriVueTable
      :columns="anomalyColumns"
      :data="anomalies"
      :row-key="(row, idx) => `${row.ruleCode ?? ''}-${row.targetId ?? ''}-${idx}`"
      :loading="loading"
      loading-text="正在读取巡检结果…"
      column-settings-storage-key="mds:cols:permission-anomaly"
      client-pagination
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="load" @reset="resetAnomalyFilter">
          <div class="agri-vue-filter-field">
            <label>处置状态</label>
            <select v-model="statusFilter" class="mds-select" @change="load">
              <option value="OPEN">未处置异常</option>
              <option value="RESOLVED">已处置异常（历史）</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button v-point="'POST /admin/masterdata/permission/anomaly/scan'" class="mds-btn mds-btn--primary" :disabled="scanning" @click="rescan">
          {{ scanning ? '检测中…' : '重新检测' }}
        </button>
        <span class="mds-hint">{{ statusFilter === 'OPEN' ? '未处置异常' : '已处置异常（历史）' }} · 按等级排序</span>
      </template>

      <template #empty>
        <EmptyState
          class="mds-empty--compact"
          icon="🛡️"
          :title="statusFilter === 'OPEN' ? '本次扫描未发现权限异常' : '还没有已处置的异常'"
          :description="statusFilter === 'OPEN'
            ? '四条规则都跑过了：没有达到阈值的账号、没有互斥角色、没有过期未撤销的绑定、也没有重复或幽灵绑定。'
            : '异常被修复后，下一次扫描会把它转成已处置并留在这里。'"
        />
      </template>

      <template #cell-severity="{ row }">
        <StatusTag :text="severityText(row.severity)" :tone="severityTone(row.severity)" />
      </template>
      <template #cell-anomalyType="{ row }">
        {{ anomalyTypeText(row.anomalyType) }}
      </template>
      <template #cell-targetName="{ row }">
        <span class="mds-name">{{ row.targetName || row.targetId || '—' }}</span>
      </template>
      <template #cell-tenantName="{ row }">
        {{ row.tenantName || row.tenantId || '平台级' }}
      </template>
      <template #cell-ruleCode="{ row }">
        <span class="mds-muted mds-mono">{{ row.ruleCode || '—' }}</span>
      </template>
      <template #cell-firstSeen="{ row }">
        <span class="mds-muted">{{ formatDate(row.firstSeen || row.createTime) }}</span>
      </template>
      <template #cell-createTime="{ row }">
        <span class="mds-muted">{{ formatDate(row.createTime) }}</span>
      </template>
    </AgriVueTable>

    <AgriVueTable
      :columns="ruleColumns"
      :data="rules"
      row-key="ruleCode"
      :loading="loading"
      column-settings-storage-key="mds:cols:permission-anomaly-rules"
      client-pagination
      @refresh="load"
    >
      <template #toolbar-left>
        <strong style="font-size: 14px">检测规则口径</strong>
        <span class="mds-tag mds-tag--plain">{{ rules.length }} 条生效</span>
        <span class="mds-hint">直接读规则表 agri_md_permission_rule</span>
      </template>

      <template #empty>
        规则表是空的 —— 没有规则就没有结论。请先执行
        <code>agri-master-data/db/20261102-permission-anomaly.sql</code>
      </template>

      <template #cell-ruleName="{ row }">
        <StatusTag :text="row.ruleName" :tone="severityTone(row.severity)" />
      </template>
      <template #cell-threshold="{ row }">
        <span class="mds-muted">{{ row.threshold ?? '—' }}</span>
      </template>
      <template #cell-advice="{ row }">
        <div class="mds-cell-main" :title="ADVICE[row.ruleCode ?? ''] ?? '—'">{{ ADVICE[row.ruleCode ?? ''] ?? '—' }}</div>
      </template>
    </AgriVueTable>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { AgriVueFilterBar, AgriVueTable, type VueListColumn } from '@agri/shared/vue/list'

const anomalyColumns: VueListColumn[] = [
  { prop: 'severity', label: '等级', width: 92, kind: 'status' },
  { prop: 'anomalyType', label: '异常类型', width: 120 },
  { prop: 'targetName', label: '对象', width: 150, locked: true },
  { prop: 'description', label: '判定依据', minWidth: 220 },
  { prop: 'tenantName', label: '归属主体', width: 140 },
  { prop: 'ruleCode', label: '规则', width: 140, kind: 'code' },
  { prop: 'firstSeen', label: '发现时间', width: 145 },
  { prop: 'createTime', label: '最近仍成立', width: 145 },
]

const ruleColumns: VueListColumn[] = [
  { prop: 'ruleName', label: '异常类型', width: 150, locked: true, ellipsis: false },
  { prop: 'remark', label: '判定口径', minWidth: 260 },
  { prop: 'threshold', label: '阈值', width: 96, kind: 'number' },
  { key: 'advice', label: '处置建议', minWidth: 240 },
]

function resetAnomalyFilter() {
  statusFilter.value = 'OPEN'
  void load()
}
import {
  getPermissionAnomaly,
  getPermissionRules,
  getPermissionStatistics,
  scanPermissionAnomaly,
} from '@/utils/api'

interface AnomalyItem {
  anomalyType?: string
  description?: string
  severity?: string
  targetId?: string
  targetName?: string
  tenantId?: string
  tenantName?: string
  /** 最近一次仍成立的时间 */
  createTime?: string
  ruleCode?: string
  status?: string
  firstSeen?: string
  targetType?: string
}

interface RuleItem {
  ruleCode?: string
  ruleName?: string
  anomalyType?: string
  severity?: string
  metric?: string
  threshold?: number | null
  remark?: string
  enabled?: number
}

const loading = ref(false)
const scanning = ref(false)
const anomalies = ref<AnomalyItem[]>([])
const rules = ref<RuleItem[]>([])
const statusFilter = ref<'OPEN' | 'RESOLVED'>('OPEN')
const summary = ref<{
  totalRoles?: number | string
  totalPermissions?: number | string
  totalRoleAssignments?: number | string
  anomalyCount?: number | string
  lastScanAt?: string | null
}>({})

const openCount = computed(() => numeric(summary.value.anomalyCount))

const stats = computed<StatItem[]>(() => [
  { label: '巡检角色', value: numeric(summary.value.totalRoles) },
  { label: '权限点', value: numeric(summary.value.totalPermissions) },
  { label: '授权关系', value: numeric(summary.value.totalRoleAssignments), tone: 'brand' },
  {
    label: '未处置异常',
    value: openCount.value,
    tone: openCount.value > 0 ? 'danger' : 'success',
  },
])

// 扫描时间如实说：库里一条结果都没有时不拿"现在"冒充"刚扫过"
const scanBannerTitle = computed(() =>
  openCount.value > 0
    ? `检测到 ${openCount.value} 条未处置权限异常：`
    : '本轮巡检未发现问题：',
)
const scanBannerBody = computed(() => {
  const last = summary.value.lastScanAt
  const base = last
    ? `上次扫描 ${String(last).replace('T', ' ').slice(0, 19)}，规则 ${rules.value.length} 条全部跑完。`
    : '尚未扫描过：结果表是空的。点右上角「重新检测」立刻扫一次（每日 03:30 也会自动扫）。'
  return openCount.value > 0
    ? `${base}每条结论的判定依据都在下面的描述里，可回到规则表复核口径。`
    : `${base}没有达到阈值的账号、没有互斥角色、没有过期未撤销的绑定、也没有重复或幽灵绑定。`
})

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function load() {
  loading.value = true
  try {
    const [anomalyResponse, statsResponse, ruleResponse] = await Promise.all([
      getPermissionAnomaly({ status: statusFilter.value }),
      getPermissionStatistics(),
      getPermissionRules(),
    ])
    if (anomalyResponse.code !== 200) throw new Error(anomalyResponse.message || '读取巡检结果失败')
    anomalies.value = Array.isArray(anomalyResponse.data)
      ? (anomalyResponse.data as AnomalyItem[])
      : ((anomalyResponse.data as { anomalies?: AnomalyItem[] })?.anomalies ?? [])
    if (statsResponse.code === 200) {
      summary.value = (statsResponse.data ?? {}) as typeof summary.value
    }
    if (ruleResponse.code === 200) {
      rules.value = Array.isArray(ruleResponse.data) ? (ruleResponse.data as RuleItem[]) : []
    }
  } catch (error) {
    anomalies.value = []
    message.error(error instanceof Error ? error.message : '读取巡检结果失败')
  } finally {
    loading.value = false
  }
}

/** 「重新检测」真的调扫描接口，再读结果 —— 与每日定时任务共用后端同一处实现 */
async function rescan() {
  scanning.value = true
  try {
    const response = await scanPermissionAnomaly()
    if (response.code !== 200) throw new Error(response.message || '巡检任务执行失败')
    const data = (response.data ?? {}) as { findings?: number; resolved?: number; rules?: number }
    message.success(
      `巡检完成：${data.rules ?? 0} 条规则，命中 ${data.findings ?? 0} 条，`
      + `本轮未复现自动转已处置 ${data.resolved ?? 0} 条`,
    )
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '巡检任务执行失败')
  } finally {
    scanning.value = false
  }
}

// 等级词表与规则表一致（HIGH / MEDIUM / LOW）；大小写都吃，库里改了大小写不会显示成英文
const SEVERITY_TEXT: Record<string, string> = { HIGH: '高危', MEDIUM: '中危', LOW: '低危' }
const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'gray'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'gray',
}
const severityKey = (value?: string) => (value ?? '').trim().toUpperCase()
const severityText = (value?: string) => SEVERITY_TEXT[severityKey(value)] ?? value ?? '—'
const severityTone = (value?: string) => SEVERITY_TONE[severityKey(value)] ?? 'gray'

const ANOMALY_TYPE_TEXT: Record<string, string> = {
  OVER_PRIVILEGE: '权限过大',
  MUTEX_ROLE: '互斥角色',
  EXPIRED_GRANT: '过期权限',
  BINDING_INTEGRITY: '重复 / 幽灵',
}
const anomalyTypeText = (value?: string) => ANOMALY_TYPE_TEXT[value ?? ''] ?? value ?? '—'

/** 处置建议是页面文案（怎么修是人定的），判定口径与阈值才是库里的数据 */
const ADVICE: Record<string, string> = {
  OVER_PRIVILEGE: '按最小权限原则回收，改用岗位角色继承',
  MUTEX_ROLE: '拆分账号，或调整到不同审批链',
  EXPIRED_GRANT: '撤销到期绑定；授权到期应自动失效',
  BINDING_INTEGRITY: '合并重复绑定、清理孤儿绑定',
}

const formatDate = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

onMounted(load)
</script>
