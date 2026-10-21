<!--
  运营总览。

  本页有一条硬规矩：**只显示查回来的数**。

  改动前这里写死了四个 KPI（128 / 3,542 / 567 / 8,934）、七天的活跃度柱、四条待审核、
  四条告警 —— 后端一失败就"回落到演示数据"，于是页面永远是满的，
  看起来一切正常，但一个真数都没有。

  现在：有数据就显示数据；没有数据来源的区块显示"未接入"并说明原因；
  接口失败直接把失败原因显示出来。空态比假数据有用 —— 假数据会让人基于它做判断。
-->
<template>
  <div class="dashboard">
    <div class="section-header">
      <h1 class="section-title">运营总览</h1>
      <p class="section-desc">数据概览与统计分析</p>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      class="load-error"
      :message="`总览数据加载失败：${loadError}`"
      description="下面显示的都是空值，不是真实统计结果。请检查后端与登录态是否正常。"
    />

    <div class="stats-cards">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-icon">{{ stat.icon }}</div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="chart-section">
        <div class="section-header small">
          <h3>主体活跃度排行</h3>
          <span class="section-note">按启用状态经营主体，展示各主体下的启用用户数</span>
        </div>
        <div v-if="activities.length === 0" class="empty-state">暂无主体数据</div>
        <div v-else class="rank-list">
          <div v-for="item in activities" :key="item.tenantId" class="rank-item">
            <span class="rank-no">{{ item.rank }}</span>
            <span class="rank-name">{{ item.tenantName || '未命名主体' }}</span>
            <span class="rank-type">{{ item.tenantType || '—' }}</span>
            <span class="rank-value">{{ item.userCount ?? '—' }} 用户</span>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="card">
          <div class="card-header">
            <h3>数据质量</h3>
          </div>
          <!-- 质量评分需要质量规则与检测结果，后端尚未接入，这里如实说明 -->
          <div class="not-wired">
            <p class="not-wired-title">未接入</p>
            <p class="not-wired-desc">
              质量评分与各域分布需要「质量规则 + 检测结果」作为数据来源，
              主数据域目前还没有这两张表，因此不展示任何评分数字。
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>待审核事项</h3>
          </div>
          <div class="audit-list">
            <div v-for="item in pendingAudits" :key="item.label" class="audit-item">
              <span class="audit-icon">{{ item.icon }}</span>
              <div class="audit-info">
                <span class="audit-title">{{ item.label }}</span>
                <span class="audit-time">{{ item.hint }}</span>
              </div>
              <span class="audit-count">{{ item.value === null ? '未接入' : item.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-section">
      <div class="card wide">
        <div class="card-header">
          <h3>系统告警</h3>
          <span class="section-note">告警需要监控阈值规则作为来源</span>
        </div>
        <div v-if="alerts.length === 0" class="empty-state">
          暂无告警数据（告警来源未接入，此处不再用示例告警填充）
        </div>
        <div v-else class="alert-table">
          <table>
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
                <td><span class="alert-badge">{{ alert.level }}</span></td>
                <td>{{ alert.title }}</td>
                <td>{{ alert.content }}</td>
                <td>{{ alert.tenantName || '—' }}</td>
                <td>{{ alert.createTime || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDashboard, getTenantActivity } from '../utils/api'

const metrics = ref(null)
const audit = ref(null)
const activities = ref([])
const alerts = ref([])
const loadError = ref('')

/** 显示规则：null / undefined 一律显示为 "—"，不显示 0（0 是"查到了 0 条"，含义完全不同） */
const show = (value) => (value === null || value === undefined ? '—' : value)

const stats = computed(() => [
  { label: '主体总数', value: show(metrics.value?.tenantCount), icon: '🏢' },
  { label: '用户总数', value: show(metrics.value?.userCount), icon: '👥' },
  { label: '组织总数', value: show(metrics.value?.orgCount), icon: '🏠' },
  { label: '待认证用户', value: show(audit.value?.userCertCount), icon: '🪪' },
])

const pendingAudits = computed(() => [
  {
    label: '用户认证审核',
    value: audit.value?.userCertCount ?? null,
    hint: '认证状态为 pending 的用户',
    icon: '👤',
  },
  {
    label: '组织资质审核',
    value: audit.value?.orgCertCount ?? null,
    hint: '认证状态为 pending 的组织',
    icon: '🏠',
  },
  {
    label: '标准变更审批',
    value: audit.value?.standardChangeCount ?? null,
    hint: '标准变更表尚未建立',
    icon: '📋',
  },
  {
    label: '质量问题工单',
    value: audit.value?.qualityIssueCount ?? null,
    hint: '质量问题表尚未建立',
    icon: '⚠️',
  },
])

async function loadData() {
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

    const activity = await getTenantActivity(10)
    if (activity.code === 200) {
      activities.value = activity.data ?? []
    }
  } catch (error) {
    // 不再"回落到演示数据"：失败就说失败，否则页面满屏数字却全是假的
    loadError.value = error instanceof Error ? error.message : '请求失败'
  }
}

onMounted(loadData)
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.section-header {
  margin-bottom: 24px;
}

.section-header.small {
  margin-bottom: 16px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.section-desc {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.section-note {
  font-size: 12px;
  color: #a0aec0;
}

.load-error {
  margin-bottom: 20px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
}

.stat-label {
  font-size: 13px;
  color: #a0aec0;
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.rank-list {
  display: flex;
  flex-direction: column;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-no {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.rank-name {
  flex: 1;
  color: #2d3748;
  font-weight: 500;
}

.rank-type {
  color: #a0aec0;
}

.rank-value {
  color: #4a5568;
  min-width: 72px;
  text-align: right;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.not-wired {
  padding: 16px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background: #fafafa;
}

.not-wired-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #8c8c8c;
}

.not-wired-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #8c8c8c;
}

.empty-state {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: #a0aec0;
  background: #fafafa;
  border-radius: 8px;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.audit-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(35, 134, 54, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.audit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.audit-title {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}

.audit-time {
  font-size: 11px;
  color: #a0aec0;
}

.audit-count {
  font-size: 16px;
  font-weight: 600;
  color: #238636;
}

.bottom-section {
  display: grid;
  grid-template-columns: 1fr;
}

.alert-table {
  overflow-x: auto;
}

.alert-table table {
  width: 100%;
  border-collapse: collapse;
}

.alert-table th,
.alert-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.alert-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
</style>
