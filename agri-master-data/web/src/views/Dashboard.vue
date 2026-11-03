<!--
  运营大盘。

  硬规矩：只显示查回来的数 —— 有数据就显示，没有数据来源的区块明确写「未接入」并说明原因，
  接口失败直接显示失败原因。空态比假数据有用：假数据会让人基于它做决策。
-->
<template>
  <div class="mds-page">
    <PageHeader
      title="运营大盘"
      subtitle="平台主数据运营全景：主体、用户、组织与待办；数据全部来自主数据后端实时查询。"
      source="主数据后端 · 实时"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
        <button class="mds-btn mds-btn--primary" @click="router.push('/subject/audit')">主体生命周期</button>
      </template>
    </PageHeader>

    <NoticeBar v-if="loadError" tone="danger" title="总览数据加载失败：">
      {{ loadError }}。下方显示的都是空值，不是真实统计结果，请检查后端与登录态。
    </NoticeBar>

    <StatGrid :items="stats" />

    <div class="overview-grid">
      <div class="mds-card">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">主体活跃度排行</h2>
            <p class="mds-card-sub">按启用状态经营主体，展示各主体下的启用用户数</p>
          </div>
          <button class="mds-btn mds-btn--link" @click="router.push('/subject/list')">全部主体</button>
        </div>
        <div v-if="!activities.length" class="mds-card-body">
          <EmptyState title="暂无主体数据" description="主体主档由统一认证注册产生；没有数据时这里不会用示例填充。" />
        </div>
        <div v-else class="rank-list">
          <div v-for="item in activities" :key="item.tenantId" class="rank-item">
            <span class="rank-no" :class="{ 'rank-no--top': Number(item.rank) <= 3 }">{{ item.rank }}</span>
            <span class="rank-name">{{ item.tenantName || '未命名主体' }}</span>
            <span class="rank-type">{{ item.tenantType || '—' }}</span>
            <span class="rank-value">{{ item.userCount ?? '—' }} 用户</span>
          </div>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">待办事项</h2>
            <p class="mds-card-sub">认证状态为 pending 的记录与未建模事项分开标注</p>
          </div>
        </div>
        <div class="mds-card-body mds-card-body--flush">
          <button
            v-for="item in pendingAudits"
            :key="item.label"
            class="todo-item"
            @click="item.to && router.push(item.to)"
          >
            <span class="todo-icon">{{ item.icon }}</span>
            <span class="todo-info">
              <span class="todo-title">{{ item.label }}</span>
              <span class="todo-hint">{{ item.hint }}</span>
            </span>
            <span v-if="item.value === null" class="mds-tag mds-tag--plain">未接入</span>
            <span v-else class="todo-count">{{ item.value }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">数据质量</h2>
            <p class="mds-card-sub">来自质量统计接口的实时聚合</p>
          </div>
          <button class="mds-btn mds-btn--link" @click="router.push('/quality/dashboard')">质量稽核</button>
        </div>
        <div class="mds-card-body">
          <div v-if="!quality.loaded" class="mds-empty">正在加载质量统计…</div>
          <template v-else>
            <div class="quality-row">
              <div><span>问题总数</span><strong>{{ quality.total }}</strong></div>
              <div><span>待闭环</span><strong class="is-warn">{{ quality.open }}</strong></div>
              <div><span>严重</span><strong class="is-danger">{{ quality.high }}</strong></div>
              <div><span>解决率</span><strong class="is-ok">{{ quality.rate }}</strong></div>
            </div>
            <div v-if="quality.domains.length" class="domain-list">
              <div v-for="item in quality.domains" :key="item.name" class="domain-row">
                <span class="domain-name">{{ item.name }}</span>
                <div class="mds-progress">
                  <div class="mds-progress__bar" :style="{ width: item.percent + '%' }" />
                </div>
                <span class="domain-count">{{ item.count }}</span>
              </div>
            </div>
            <p v-else class="mds-hint">暂无数据域分布（质量问题表为空）。</p>
          </template>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">系统告警</h2>
          <span class="mds-card-sub">告警需要监控阈值规则作为来源</span>
        </div>
        <div v-if="!alerts.length" class="mds-card-body">
          <EmptyState
            icon="🔔"
            title="暂无告警数据"
            description="告警来源尚未接入；这里不会用示例告警填充。"
          />
        </div>
        <div v-else class="mds-table-wrap">
          <table class="mds-table">
            <thead>
              <tr>
                <th>级别</th>
                <th>标题</th>
                <th>内容</th>
                <th>经营主体</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(alert, index) in alerts" :key="index">
                <td><StatusTag :text="alert.level || '提示'" :tone="alert.level === '紧急' ? 'danger' : 'warning'" /></td>
                <td class="mds-name">{{ alert.title }}</td>
                <td>{{ alert.content }}</td>
                <td>{{ alert.tenantName || '—' }}</td>
                <td class="mds-muted">{{ alert.createTime || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getDashboard, getQualityStatistics, getTenantActivity } from '../utils/api'

const router = useRouter()
const metrics = ref(null)
const audit = ref(null)
const activities = ref([])
const alerts = ref([])
const loadError = ref('')
const loading = ref(false)
const quality = ref({ loaded: false, total: '—', open: '—', high: '—', rate: '—', domains: [] })

/** null / undefined 显示 "—"，不显示 0（0 是"查到了 0 条"，含义完全不同） */
const show = (value) => (value === null || value === undefined ? '—' : value)

const stats = computed(() => [
  // 口径：主数据本地表（agri_md_tenant）的启用数，不是统一认证的主体主档总数。
  // 两个数会不一样（本地表只收已同步过来的主体），标签必须写清，否则会以为是同一个数。
  { label: '启用主体（本地表）', value: show(metrics.value?.tenantCount), hint: '统一认证主体主档见「入驻与生命周期」' },
  { label: '用户总数', value: show(metrics.value?.userCount), hint: '平台统一账号' },
  { label: '组织总数', value: show(metrics.value?.orgCount), hint: '主数据本地组织表启用数' },
  {
    label: '待认证用户',
    value: show(audit.value?.userCertCount),
    hint: '认证状态为 pending',
    tone: Number(audit.value?.userCertCount ?? 0) > 0 ? 'warning' : undefined,
  },
])

const pendingAudits = computed(() => [
  {
    label: '用户认证审核',
    value: audit.value?.userCertCount ?? null,
    hint: '认证状态为 pending 的用户 · 在用户中心办理',
    icon: '👤',
    to: '/user/audit',
  },
  {
    label: '组织资质审核',
    value: audit.value?.orgCertCount ?? null,
    hint: '认证状态为 pending 的组织',
    icon: '🏠',
    to: '/org/list',
  },
  {
    label: '标准变更审批',
    value: audit.value?.standardChangeCount ?? null,
    hint: '标准变更表尚未建立',
    icon: '📋',
    to: '/datastandard/metadata',
  },
  {
    label: '质量问题工单',
    value: audit.value?.qualityIssueCount ?? null,
    hint: '待处理 + 处理中的质量问题',
    icon: '⚠️',
    to: '/quality/issue',
  },
])

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const dashboard = await getDashboard()
    if (dashboard.code !== 200) {
      loadError.value = dashboard.message || '后端返回业务失败'
      return
    }
    metrics.value = dashboard.data?.coreMetrics ?? null
    audit.value = dashboard.data?.pendingAudit ?? null
    alerts.value = dashboard.data?.alerts ?? []

    const [activity, qualityRes] = await Promise.all([
      getTenantActivity(10),
      getQualityStatistics().catch(() => null),
    ])
    if (activity.code === 200) {
      activities.value = activity.data ?? []
    }
    applyQuality(qualityRes)
  } catch (error) {
    // 不"回落到演示数据"：失败就说失败，否则页面满屏数字却全是假的
    loadError.value = error instanceof Error ? error.message : '请求失败'
  } finally {
    loading.value = false
  }
}

function applyQuality(response) {
  if (!response || response.code !== 200 || !response.data) {
    quality.value = { loaded: true, total: '—', open: '—', high: '—', rate: '—', domains: [] }
    return
  }
  const data = response.data
  const statusMap = {}
  ;(data.statusStatistics ?? []).forEach((item) => {
    statusMap[item.status] = Number(item.issueCount ?? 0)
  })
  const total = Number(data.totalIssues ?? 0)
  const domains = (data.domainStatistics ?? [])
    .map((item) => ({
      name: item.domainName || item.domainCode || '未命名域',
      count: Number(item.issueCount ?? 0),
      percent: total > 0 ? Math.round((Number(item.issueCount ?? 0) / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  quality.value = {
    loaded: true,
    total,
    open: (statusMap.pending ?? 0) + (statusMap.processing ?? 0),
    high: Number(data.highSeverityCount ?? 0),
    rate: data.resolutionRate == null ? '—' : `${data.resolutionRate}%`,
    domains,
  }
}

onMounted(loadData)
</script>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.rank-list {
  padding: 4px 0;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--mds-line-soft);
  font-size: 13px;
}

.rank-item:last-child {
  border-bottom: 0;
}

.rank-no {
  width: 24px;
  height: 24px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--mds-gray-soft);
  color: var(--mds-text-2);
  font-family: var(--mds-mono);
  font-size: 12px;
}

.rank-no--top {
  background: var(--mds-brand-soft);
  color: var(--mds-brand-deep);
  font-weight: 700;
}

.rank-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.rank-type {
  flex: none;
  color: var(--mds-text-3);
  font-size: var(--agri-font-size-micro);
}

.rank-value {
  flex: none;
  width: 78px;
  text-align: right;
  font-family: var(--mds-mono);
  color: var(--mds-text-2);
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 18px;
  border: 0;
  border-bottom: 1px solid var(--mds-line-soft);
  background: none;
  text-align: left;
  cursor: pointer;
}

.todo-item:last-child {
  border-bottom: 0;
}

.todo-item:hover {
  background: #f7fbf9;
}

.todo-icon {
  width: 26px;
  text-align: center;
}

.todo-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.todo-title {
  font-size: 13px;
  font-weight: 600;
}

.todo-hint {
  font-size: var(--agri-font-size-micro);
  color: var(--mds-text-3);
}

.todo-count {
  font-family: var(--mds-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--mds-brand-deep);
}

.quality-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.quality-row div {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8faf9;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quality-row span {
  font-size: var(--agri-font-size-micro);
  color: var(--mds-text-3);
}

.quality-row strong {
  font-family: var(--mds-mono);
  font-size: 18px;
}

.quality-row .is-warn {
  color: var(--mds-warning);
}

.quality-row .is-danger {
  color: var(--mds-danger);
}

.quality-row .is-ok {
  color: var(--mds-success);
}

.domain-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
}

.domain-name {
  width: 96px;
  flex: none;
  color: var(--mds-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-row .mds-progress {
  flex: 1;
}

.domain-count {
  width: 32px;
  flex: none;
  text-align: right;
  font-family: var(--mds-mono);
  color: var(--mds-text-2);
}

@media (max-width: 1100px) {
  .overview-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
