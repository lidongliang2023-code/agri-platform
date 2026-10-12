<template>
  <div class="tenant-detail">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回</span>
      </button>
      <div class="header-left">
        <h1>租户详情</h1>
        <p>查看租户详细信息</p>
      </div>

    </div>

    <p v-if="loadError" class="load-error">{{ loadError }}</p>
    <div class="detail-card" v-else-if="!tenantData">
      <p class="section-empty">正在加载租户详情…</p>
    </div>

    <div v-else class="detail-card">
      <div class="detail-section">
        <h3 class="section-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">租户编码</span>
            <span class="value">{{ tenantData.tenantCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">租户名称</span>
            <span class="value">{{ tenantData.tenantName }}</span>
          </div>
          <div class="info-item">
            <span class="label">租户类型</span>
            <!-- 原先只认小写 'enterprise'，而库里存的是 'ENTERPRISE'，
                 于是所有企业租户都被显示成"个人"；合作社/系统租户更是直接没有对应文案。 -->
            <span class="value">{{ tenantTypeLabel(tenantData.tenantType) }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系人</span>
            <span class="value">{{ tenantData.contactName }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系电话</span>
            <span class="value">{{ tenantData.phone }}</span>
          </div>
          <div class="info-item">
            <span class="label">邮箱</span>
            <span class="value">{{ tenantData.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value">{{ tenantData.address }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <!-- 状态判断原先写反了：库口径是 1=启用 / 0=停用（StatusEnum），
                 页面却按 0=正常 判断，于是每个启用中的租户都显示"禁用"。 -->
            <span class="status-badge" :class="tenantData.status === 1 ? 'active' : 'inactive'">
              {{ tenantData.status === 1 ? '启用中' : '已停用' }}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">配额信息</h3>
        <div v-if="tenantData.quotaInfo" class="quota-grid">
          <div class="quota-item">
            <div class="quota-header">
              <span>用户配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedUsers }} / {{ tenantData.quotaInfo.userLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: quotaPercent(tenantData.quotaInfo.usedUsers, tenantData.quotaInfo.userLimit) + '%' }"></div>
            </div>
          </div>
          <div class="quota-item">
            <div class="quota-header">
              <span>组织配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedOrgs }} / {{ tenantData.quotaInfo.orgLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: quotaPercent(tenantData.quotaInfo.usedOrgs, tenantData.quotaInfo.orgLimit) + '%' }"></div>
            </div>
          </div>
          <div class="quota-item">
            <div class="quota-header">
              <span>商品配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedProducts }} / {{ tenantData.quotaInfo.productLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: quotaPercent(tenantData.quotaInfo.usedProducts, tenantData.quotaInfo.productLimit) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">质量评分</h3>
        <div v-if="hasQualityScore" class="quality-score">
          <div class="score-circle">
            <span class="score-value">{{ scoreText(tenantData.qualityScore.overallScore) }}</span>
            <span class="score-label">综合评分</span>
          </div>
          <div class="score-details">
            <div class="score-item">
              <span>用户主数据</span>
              <span>{{ scoreText(tenantData.qualityScore.userMasterData) }}</span>
            </div>
            <div class="score-item">
              <span>组织主数据</span>
              <span>{{ scoreText(tenantData.qualityScore.orgMasterData) }}</span>
            </div>
            <div class="score-item">
              <span>商品主数据</span>
              <span>{{ scoreText(tenantData.qualityScore.productMasterData) }}</span>
            </div>
            <div class="score-item">
              <span>权限主数据</span>
              <span>{{ scoreText(tenantData.qualityScore.permissionMasterData) }}</span>
            </div>
          </div>
        </div>
        <!-- 没有数据来源时如实说明。原先这里显示的是后端写死的 99.2 / 99.5 / …，
             换个租户点进来数字纹丝不动，却是页面上最显眼的一块。 -->
        <p v-else class="section-empty">
          未接入：没有"按租户汇总主数据质量得分"的数据。需要先有质量得分汇总表
          （数据质量模块目前只有问题工单），并在每次检测后回写，才能给出真实评分。
        </p>
      </div>

      <div class="detail-section">
        <h3 class="section-title">用户与组织</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">用户数</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.totalUsers) }}</span>
          </div>
          <div class="info-item">
            <span class="label">已实名认证用户</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.verifiedUsers) }}</span>
          </div>
          <div class="info-item">
            <span class="label">待认证用户</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.pendingUsers) }}</span>
          </div>
          <div class="info-item">
            <span class="label">组织数</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.totalOrgs) }}</span>
          </div>
          <div class="info-item">
            <span class="label">已认证组织</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.verifiedOrgs) }}</span>
          </div>
          <div class="info-item">
            <span class="label">待审核组织</span>
            <span class="value">{{ countText(tenantData.userOrgStats?.pendingOrgs) }}</span>
          </div>
        </div>
        <p class="section-note">
          用户与组织按租户编码统计；"已实名认证 / 待认证"取用户认证记录，"已认证 / 待审核"取组织认证状态。
          0 表示该租户确实没有对应记录。
        </p>
      </div>

      <div class="detail-section">
        <h3 class="section-title">操作记录</h3>
        <table v-if="tenantData.operationLogs && tenantData.operationLogs.length" class="op-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作</th>
              <th>操作人</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, index) in tenantData.operationLogs" :key="index">
              <td>{{ log.time }}</td>
              <td>{{ log.operationType }}</td>
              <td>{{ log.operator }}</td>
              <td>{{ log.content }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="section-empty">
          这个租户还没有操作记录。留痕从运营端"操作日志"接入后开始产生：
          对该租户的每一次写操作（改资料 / 停启用 / 调配额 / 换套餐）都会记在这里。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTenantDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const tenantData = ref(null)
const loadError = ref('')

const goBack = () => {
  router.push('/tenant/list')
}

const loadDetail = async () => {
  const id = route.params.id
  try {
    const response = await getTenantDetail(id)
    if (response.code !== 200) {
      throw new Error(response.message || '接口返回失败')
    }
    tenantData.value = response.data
    loadError.value = ''
  } catch (error) {
    console.error('加载租户详情失败', error)
    // 这里原先会退回一份 mockTenantData（"阳光农场 / 张三 / 13800138001"这些编好的值）。
    // 接口一挂就显示一份看着很正常的假资料，比报错危险得多 —— 没人会去核对一个"能打开的页面"。
    tenantData.value = null
    loadError.value =
      '加载租户详情失败：' + (error instanceof Error ? error.message : String(error))
  }
}

/** 质量评分里任何一项为空都算"没有来源"，整块显示未接入说明而不是给 0 或 85 这种数字。 */
const hasQualityScore = computed(() => {
  const score = tenantData.value?.qualityScore
  if (!score) {
    return false
  }
  return [score.overallScore, score.userMasterData, score.orgMasterData,
    score.productMasterData, score.permissionMasterData].some((item) => item !== null && item !== undefined)
})

const scoreText = (value) => (value === null || value === undefined ? '—' : value)

/** 计数显示：null / undefined → "—"（没有数据），其余按千分位显示。 */
const countText = (value) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString()

const TENANT_TYPE_LABELS = {
  ENTERPRISE: '企业租户',
  INDIVIDUAL: '个人租户',
  COOPERATIVE: '合作社',
  SYSTEM: '系统租户'
}

const tenantTypeLabel = (type) =>
  TENANT_TYPE_LABELS[String(type || '').toUpperCase()] || type || '—'

/** 配额进度百分比。上限为 0 或缺失时返回 0，避免算出 NaN% / Infinity% 这种脏显示。 */
const quotaPercent = (used, limit) => {
  const total = Number(limit)
  if (!total) {
    return 0
  }
  return Math.min(100, Math.round(((Number(used) || 0) / total) * 100))
}

onMounted(loadDetail)
</script>

<style scoped>
.tenant-detail {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #f8fafc;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.detail-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

.detail-section {
  margin-bottom: 30px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.label {
  font-size: 13px;
  color: #a0aec0;
  margin-bottom: 6px;
}

.value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.quota-item {
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.quota-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.quota-value {
  font-weight: 600;
  color: #238636;
}

.quota-progress {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636 0%, #2ea043 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 60px;
}

.score-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.score-value {
  font-size: 36px;
  font-weight: 700;
}

.score-label {
  font-size: 12px;
  opacity: 0.9;
}

.score-details {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
}

.score-item span:first-child {
  color: #a0aec0;
}

.score-item span:last-child {
  font-weight: 500;
  color: #2d3748;
}

/* 说明文字：解释哪一项没有数据来源、缺的是什么 */
.section-note {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #a0aec0;
}

.section-empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #a0aec0;
}

/* 加载失败横幅：比"显示一份假资料"诚实得多 */
.load-error {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(218, 54, 51, 0.08);
  color: #da3633;
  font-size: 13px;
}

.op-table {
  width: 100%;
  border-collapse: collapse;
}

.op-table th,
.op-table td {
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
}

.op-table th {
  color: #4a5568;
  font-weight: 600;
  background: #f8fafc;
}

.op-table td {
  color: #2d3748;
}
</style>
