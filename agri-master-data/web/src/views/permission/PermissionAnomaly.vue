<template>
  <div class="mds-page">
    <PageHeader
      title="异常权限检测"
      subtitle="权限过大、互斥角色、过期权限、重复与幽灵权限的巡检结果。每条结论都由库里的授权关系算出，判定依据写在描述里，不做模拟造数。"
      source="角色权限 · 巡检接口"
    >
      <template #actions>
        <button class="mds-btn mds-btn--ghost" :disabled="loading" @click="toggleStatus">
          {{ statusFilter === 'OPEN' ? '查看已处置' : '查看未处置' }}
        </button>
        <button v-point="'POST /admin/masterdata/permission/anomaly/scan'" class="mds-btn" :disabled="scanning" @click="rescan">
          {{ scanning ? '检测中…' : '重新检测' }}
        </button>
      </template>
    </PageHeader>

    <StatGrid :items="stats" />

    <!-- 上次扫描时间来自结果表，从未扫描过时如实说"尚未扫描"，不拿当前时间冒充 -->
    <NoticeBar :tone="openCount > 0 ? 'danger' : 'success'" :title="scanBannerTitle">
      {{ scanBannerBody }}
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">{{ statusFilter === 'OPEN' ? '未处置异常' : '已处置异常（历史）' }}</h2>
          <p class="mds-card-sub">
            按等级排序；本轮扫描没有再复现的记录会自动转为已处置，改完授权不会一直挂着
          </p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ anomalies.length }} 条</span>
      </div>
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>等级</th>
              <th>异常类型</th>
              <th>对象</th>
              <th>判定依据</th>
              <th>归属主体</th>
              <th>规则</th>
              <th>发现时间</th>
              <th>最近仍成立</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在读取巡检结果…</td>
            </tr>
            <tr v-else-if="!anomalies.length">
              <td colspan="8">
                <EmptyState
                  icon="🛡️"
                  :title="statusFilter === 'OPEN' ? '本次扫描未发现权限异常' : '还没有已处置的异常'"
                  :description="statusFilter === 'OPEN'
                    ? '四条规则都跑过了：没有达到阈值的账号、没有互斥角色、没有过期未撤销的绑定、也没有重复或幽灵绑定。'
                    : '异常被修复后，下一次扫描会把它转成已处置并留在这里。'"
                />
              </td>
            </tr>
            <tr v-for="(item, index) in anomalies" :key="`${item.ruleCode}-${item.targetId}-${index}`">
              <td><StatusTag :text="severityText(item.severity)" :tone="severityTone(item.severity)" /></td>
              <td>{{ anomalyTypeText(item.anomalyType) }}</td>
              <td>
                <span class="mds-name">{{ item.targetName || item.targetId || '—' }}</span>
              </td>
              <td>{{ item.description || '—' }}</td>
              <td>{{ item.tenantName || item.tenantId || '平台级' }}</td>
              <td class="mds-muted">{{ item.ruleCode || '—' }}</td>
              <td class="mds-muted">{{ formatDate(item.firstSeen || item.createTime) }}</td>
              <td class="mds-muted">{{ formatDate(item.createTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">检测规则口径</h2>
          <p class="mds-card-sub">
            直接读规则表 <code>agri_md_permission_rule</code>：阈值改在库里，页面立刻跟着变，
            不再是模板里写死的四行说明
          </p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ rules.length }} 条生效</span>
      </div>
      <div class="mds-card-body mds-card-body--flush">
        <table class="mds-table">
          <thead>
            <tr>
              <th>异常类型</th>
              <th>判定口径</th>
              <th>阈值</th>
              <th>处置建议</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rules.length">
              <td colspan="4" class="mds-empty">
                规则表是空的 —— 没有规则就没有结论。请先执行
                <code>agri-master-data/db/20261102-permission-anomaly.sql</code>
              </td>
            </tr>
            <tr v-for="rule in rules" :key="rule.ruleCode">
              <td><StatusTag :text="rule.ruleName" :tone="severityTone(rule.severity)" /></td>
              <td>{{ rule.remark || '—' }}</td>
              <td class="mds-muted">{{ rule.threshold ?? '—' }}</td>
              <td>{{ ADVICE[rule.ruleCode ?? ''] ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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

function toggleStatus() {
  statusFilter.value = statusFilter.value === 'OPEN' ? 'RESOLVED' : 'OPEN'
  void load()
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
