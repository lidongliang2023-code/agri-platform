<template>
  <div v-if="loadError" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ loadError }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回租户列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!tenantData" class="agri-detail-page">
    <div class="mds-detail-state">正在加载主体详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="tenantData.tenantCode || `SUB-${route.params.id}`"
    :title="value(tenantData.tenantName)"
    :status="verifyStatusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回租户列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="loadDetail">刷新</a-button>
      <a-button @click="viewQuota">配额管理</a-button>
      <a-button type="primary" @click="editSubject">编辑资料</a-button>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="注册档案">
        <template #extra>
          <span class="detail-section-hint">{{ isPersonal ? '个人主体' : '企业主体' }}</span>
        </template>
        <MdsDetailInfoGrid :items="profileItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="联系信息">
        <MdsDetailInfoGrid :items="contactItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="资源与成员概览">
        <template #extra>
          <button type="button" class="detail-section-link" @click="activeTab = 'quota'">
            查看详细配额 →
          </button>
        </template>
        <div class="detail-kpi-strip">
          <div class="detail-kpi-cell">
            <span>成员总数</span>
            <strong>{{ countText(tenantData.userOrgStats?.totalUsers) }}</strong>
            <small>已实名 {{ countText(tenantData.userOrgStats?.verifiedUsers) }}</small>
          </div>
          <div class="detail-kpi-cell">
            <span>待认证成员</span>
            <strong>{{ countText(tenantData.userOrgStats?.pendingUsers) }}</strong>
            <small>组织数 {{ countText(tenantData.userOrgStats?.totalOrgs) }}</small>
          </div>
          <div class="detail-kpi-cell">
            <span>用户配额</span>
            <strong>{{ quotaText(tenantData.quotaInfo?.usedUsers, tenantData.quotaInfo?.userLimit) }}</strong>
            <small>已用 / 上限</small>
          </div>
          <div class="detail-kpi-cell">
            <span>组织配额</span>
            <strong>{{ quotaText(tenantData.quotaInfo?.usedOrgs, tenantData.quotaInfo?.orgLimit) }}</strong>
            <small>已用 / 上限</small>
          </div>
        </div>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="操作记录" :flush="true">
        <template #extra>
          <button
            v-if="operationLogs.length > 0"
            type="button"
            class="detail-section-link"
            @click="activeTab = 'logs'"
          >
            查看全部 {{ operationLogs.length }} 条
          </button>
        </template>
        <div v-if="operationLogs.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作类型</th>
                <th>操作人</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in operationLogs.slice(0, 5)" :key="index">
                <td class="detail-mono">{{ value(log.time) }}</td>
                <td>{{ value(log.operationType) }}</td>
                <td>{{ value(log.operator) }}</td>
                <td>{{ value(log.content) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">暂无操作记录。</div>
        <template v-if="operationLogs.length" #footer>
          <span>共 <strong class="detail-mono">{{ operationLogs.length }}</strong> 条记录</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'certification'">
      <AgriVueDetailSection title="认证与核验信息">
        <template #extra>
          <span class="agri-detail-status-pill" :class="`is-${verifyStatusBadge.tone}`">
            {{ verifyStatusBadge.label }}
          </span>
        </template>
        <MdsDetailInfoGrid v-if="hasCertification" :items="certificationItems" />
        <div v-else class="mds-detail-empty">该主体尚未提交认证资料。</div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'quota'">
      <AgriVueDetailSection title="成员与组织统计">
        <MdsDetailInfoGrid :items="memberStatItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="资源配额明细" :flush="true">
        <template #extra>
          <button type="button" class="detail-section-link" @click="viewQuota">
            进入配额详情 →
          </button>
        </template>
        <div class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>资源项</th>
                <th class="is-num">当前已用</th>
                <th class="is-num">配额上限</th>
                <th>口径说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in quotaRows" :key="row.label">
                <td>{{ row.label }}</td>
                <td class="is-num">{{ row.used }}</td>
                <td class="is-num">{{ row.limit }}</td>
                <td>{{ row.hint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'logs'">
      <AgriVueDetailSection title="操作记录" :flush="true">
        <div v-if="operationLogs.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作类型</th>
                <th>操作人</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in operationLogs" :key="index">
                <td class="detail-mono">{{ value(log.time) }}</td>
                <td>{{ value(log.operationType) }}</td>
                <td>{{ value(log.operator) }}</td>
                <td>{{ value(log.content) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">暂无操作记录。</div>
        <template v-if="operationLogs.length" #footer>
          <span>共 <strong class="detail-mono">{{ operationLogs.length }}</strong> 条记录</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="主体状态进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联单据与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'
import MdsDetailInfoGrid, { type MdsDetailInfoItem } from '@/components/ui/MdsDetailInfoGrid.vue'
import { getTenantDetail } from '../../utils/api'

interface TenantLogItem {
  time?: string
  operationType?: string
  operator?: string
  content?: string
}

interface TenantDetailModel {
  id?: number | string
  tenantCode?: string
  tenantName?: string
  tenantType?: string
  status?: number | string
  verifyStatus?: string
  certificationNo?: string
  certificationStatus?: string
  verificationChannel?: string
  certificationReviewRemark?: string
  identityNoMasked?: string
  businessType?: string
  validStart?: string
  validEnd?: string
  policeVerified?: boolean
  livenessVerified?: boolean
  creditCode?: string
  industry?: string
  companySize?: string
  legalPerson?: string
  licenseNo?: string
  registeredCapital?: string
  legalPersonFaceStatus?: string
  corporateBankName?: string
  corporateBankAccount?: string
  corporateTransferStatus?: string
  businessLicenseUrl?: string
  address?: string
  contactName?: string
  phone?: string
  email?: string
  createTime?: string
  updateTime?: string
  userOrgStats?: {
    totalUsers?: number
    verifiedUsers?: number
    pendingUsers?: number
    totalOrgs?: number
  }
  quotaInfo?: {
    usedUsers?: number
    userLimit?: number
    usedOrgs?: number
    orgLimit?: number
    usedProducts?: number
    productLimit?: number
    usedApiToday?: number
    apiLimit?: number
  }
  operationLogs?: TenantLogItem[]
}

const route = useRoute()
const router = useRouter()
const tenantData = ref<TenantDetailModel | null>(null)
const loading = ref(false)
const loadError = ref('')
const activeTab = ref('detail')

const isPersonal = computed(() => tenantData.value?.tenantType === 'INDIVIDUAL')
const isEnabled = computed(() => Number(tenantData.value?.status) === 1)
const operationLogs = computed(() => tenantData.value?.operationLogs ?? [])

const hasCertification = computed(() => Boolean(
  tenantData.value?.certificationNo
  || tenantData.value?.verificationChannel
  || tenantData.value?.legalPersonFaceStatus
  || tenantData.value?.identityNoMasked,
))

const validity = computed(() => {
  const start = tenantData.value?.validStart
  const end = tenantData.value?.validEnd
  return start || end ? `${value(start)} 至 ${value(end)}` : '—'
})

const verifyStatusBadge = computed<DetailStatusBadge>(() => {
  const s = String(tenantData.value?.verifyStatus || '').toLowerCase()
  const map: Record<string, DetailStatusBadge> = {
    approved: { label: '已认证', tone: 'green' },
    pending: { label: '审核中', tone: 'orange' },
    rejected: { label: '已驳回', tone: 'red' },
    draft: { label: '草稿', tone: 'gray' },
    unverified: { label: '未认证', tone: 'gray' },
  }
  return map[s] || { label: '未认证', tone: 'gray' }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => [
  { label: isEnabled.value ? '启用' : '停用', tone: isEnabled.value ? 'green' : 'gray' },
  { label: subjectTypeText(tenantData.value?.tenantType), tone: isPersonal.value ? 'blue' : 'green' },
])

const headerMeta = computed(() => {
  const d = tenantData.value
  if (!d) return []
  return [
    { label: '主体类型', value: subjectTypeText(d.tenantType) },
    { label: '联系人', value: d.contactName || '未填写' },
    { label: '联系电话', value: d.phone || '未填写' },
    { label: '创建时间', value: formatDate(d.createTime) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '主体详情' },
  { key: 'certification', label: '认证核验' },
  { key: 'quota', label: '成员与配额' },
  { key: 'logs', label: '操作记录', count: operationLogs.value.length },
])

const profileItems = computed<MdsDetailInfoItem[]>(() => {
  const d = tenantData.value
  if (!d) return []
  const base: MdsDetailInfoItem[] = [
    { key: 'tenantCode', label: '主体编码', value: d.tenantCode, mono: true },
    { key: 'tenantType', label: '主体类型', value: subjectTypeText(d.tenantType) },
    { key: 'tenantName', label: isPersonal.value ? '真实姓名' : '企业名称', value: d.tenantName },
  ]
  if (isPersonal.value) {
    base.push(
      { key: 'identityNoMasked', label: '身份证号码', value: d.identityNoMasked, mono: true },
      { key: 'businessType', label: '个人经营类型', value: d.businessType },
      { key: 'validity', label: '证件有效期', value: validity.value, mono: true },
    )
  } else {
    base.push(
      { key: 'creditCode', label: '统一社会信用代码', value: d.creditCode, mono: true },
      { key: 'industry', label: '所属行业', value: d.industry },
      { key: 'companySize', label: '企业规模', value: d.companySize },
      { key: 'legalPerson', label: '法定代表人', value: d.legalPerson },
      { key: 'licenseNo', label: '营业执照号', value: d.licenseNo, mono: true },
      { key: 'registeredCapital', label: '注册资本', value: d.registeredCapital, mono: true },
    )
  }
  base.push(
    { key: 'createTime', label: '创建时间', value: formatDate(d.createTime), mono: true },
    { key: 'address', label: '注册地址', value: d.address, fullWidth: true },
  )
  return base
})

const contactItems = computed<MdsDetailInfoItem[]>(() => {
  const d = tenantData.value
  if (!d) return []
  return [
    { key: 'contactName', label: '联系人', value: d.contactName },
    { key: 'phone', label: '联系电话', value: d.phone, mono: true },
    { key: 'email', label: '联系邮箱', value: d.email },
    { key: 'status', label: '主体状态', value: isEnabled.value ? '启用' : '停用' },
  ]
})

const certificationItems = computed<MdsDetailInfoItem[]>(() => {
  const d = tenantData.value
  if (!d) return []
  const items: MdsDetailInfoItem[] = [
    { key: 'certificationNo', label: '认证单号', value: d.certificationNo, mono: true },
    { key: 'certStatus', label: '认证状态', value: verifyText(d.certificationStatus || d.verifyStatus) },
    { key: 'channel', label: '认证渠道', value: d.verificationChannel },
  ]
  if (isPersonal.value) {
    items.push(
      { key: 'police', label: '公安二要素', value: yesNo(d.policeVerified) },
      { key: 'liveness', label: '活体核验', value: yesNo(d.livenessVerified) },
    )
  } else {
    items.push(
      { key: 'face', label: '法人扫脸', value: faceStatusText(d.legalPersonFaceStatus) },
      { key: 'bankName', label: '对公账户户名', value: d.corporateBankName },
      { key: 'bankAcc', label: '对公账户', value: d.corporateBankAccount, mono: true },
      { key: 'transfer', label: '对公打款', value: transferStatusText(d.corporateTransferStatus) },
      { key: 'license', label: '营业执照材料', value: d.businessLicenseUrl ? '已上传' : '未上传' },
    )
  }
  if (d.certificationReviewRemark) {
    items.push({ key: 'remark', label: '审核意见', value: d.certificationReviewRemark, fullWidth: true })
  }
  return items
})

const memberStatItems = computed<MdsDetailInfoItem[]>(() => {
  const s = tenantData.value?.userOrgStats
  return [
    { key: 'totalUsers', label: '成员总数', value: countText(s?.totalUsers), mono: true },
    { key: 'verifiedUsers', label: '已实名成员', value: countText(s?.verifiedUsers), mono: true },
    { key: 'pendingUsers', label: '待认证成员', value: countText(s?.pendingUsers), mono: true },
    { key: 'totalOrgs', label: '组织数量', value: countText(s?.totalOrgs), mono: true },
  ]
})

const quotaRows = computed(() => {
  const q = tenantData.value?.quotaInfo
  return [
    { label: '用户数', used: countText(q?.usedUsers), limit: countText(q?.userLimit), hint: '绑定当前主体的有效成员数' },
    { label: '组织数', used: countText(q?.usedOrgs), limit: countText(q?.orgLimit), hint: '归属主体的部门与生产单位数' },
    { label: '商品数', used: countText(q?.usedProducts), limit: countText(q?.productLimit), hint: '主体名下已建档商品数' },
    { label: '每日 API', used: countText(q?.usedApiToday), limit: countText(q?.apiLimit), hint: '今日累计接口调用量' },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = tenantData.value
  if (!d) return []
  const vs = String(d.verifyStatus || '').toLowerCase()
  const hasQuota = d.quotaInfo?.userLimit !== null && d.quotaInfo?.userLimit !== undefined
  return [
    {
      key: 'registered',
      title: '主体已建档',
      time: formatDate(d.createTime),
      description: `${subjectTypeText(d.tenantType)} · ${d.tenantCode || ''}`,
      state: 'done',
    },
    {
      key: 'verify',
      title: vs === 'approved' ? '主体认证通过' : vs === 'rejected' ? '主体认证被驳回' : vs === 'pending' ? '等待认证审核' : '尚未完成主体认证',
      description: d.certificationReviewRemark || (hasCertification.value ? `认证单号 ${d.certificationNo || '已提交'}` : '待主体提交实名/企业资质'),
      state: vs === 'approved' ? 'done' : vs === 'rejected' ? 'error' : vs === 'pending' ? 'current' : 'pending',
    },
    {
      key: 'quota',
      title: hasQuota ? '资源配额已生效' : '待配置资源配额',
      description: hasQuota ? `用户上限 ${countText(d.quotaInfo?.userLimit)} · 组织上限 ${countText(d.quotaInfo?.orgLimit)}` : '按平台默认规则或手动分配',
      state: hasQuota ? 'done' : vs === 'approved' ? 'current' : 'pending',
    },
    {
      key: 'running',
      title: isEnabled.value ? '正常启用运营' : '主体已停用',
      description: isEnabled.value ? `当前关联 ${countText(d.userOrgStats?.totalUsers)} 名成员、${countText(d.userOrgStats?.totalOrgs)} 个组织` : '已暂停业务访问',
      state: isEnabled.value ? (vs === 'approved' ? 'done' : 'current') : 'error',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = tenantData.value
  if (!d) return []
  const subjectId = String(d.id ?? route.params.id ?? '')
  return [
    {
      key: 'cert',
      label: '认证单号',
      code: d.certificationNo || undefined,
      emptyText: '尚未提交',
      badge: verifyStatusBadge.value.label,
      badgeTone: verifyStatusBadge.value.tone as 'green' | 'orange' | 'red' | 'blue' | 'gray',
      clickable: true,
      onClick: () => { activeTab.value = 'certification' },
    },
    {
      key: 'quota',
      label: '主体配额',
      text: d.quotaInfo?.userLimit !== undefined && d.quotaInfo?.userLimit !== null ? '查看配额详情' : undefined,
      emptyText: '前往配置配额',
      clickable: true,
      onClick: viewQuota,
    },
    {
      key: 'orgs',
      label: '下属组织',
      text: `${countText(d.userOrgStats?.totalOrgs)} 个组织`,
      mono: false,
      clickable: true,
      onClick: () => void router.push({ path: '/org/list', query: { tenantId: subjectId } }),
    },
    {
      key: 'users',
      label: '成员账号',
      text: `${countText(d.userOrgStats?.totalUsers)} 名成员`,
      mono: false,
      clickable: true,
      onClick: () => void router.push('/user/list'),
    },
  ]
})

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getTenantDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '主体详情加载失败')
    tenantData.value = response.data as TenantDetailModel
  } catch (error) {
    tenantData.value = null
    loadError.value = error instanceof Error ? error.message : '主体详情加载失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => void router.push('/subject/list')
const editSubject = () => void router.push(`/subject/edit/${route.params.id}`)
const viewQuota = () => void router.push(`/subject/quota/${route.params.id}`)
const printPage = () => window.print()

const value = (input: unknown) => (input === null || input === undefined || input === '' ? '—' : String(input))
const countText = (input: unknown) => (input === null || input === undefined ? '—' : Number(input).toLocaleString('zh-CN'))
const quotaText = (used: unknown, limit: unknown) => `${countText(used)} / ${countText(limit)}`
const subjectTypeText = (type?: string) => (type === 'INDIVIDUAL' ? '个人主体' : '企业主体')
const verifyText = (status?: string) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', draft: '草稿', unverified: '未认证' }[status || ''] || '未认证')
const yesNo = (input?: boolean) => (input === true ? '已通过' : input === false ? '未通过' : '—')
const faceStatusText = (status?: string) => ({ verified: '已通过', uploaded: '材料已上传', pending: '待核验', rejected: '未通过' }[String(status || '').toLowerCase()] || status || '—')
const transferStatusText = (status?: string) => ({ verified: '已验证', submitted: '已提交', pending: '待打款', rejected: '未通过' }[String(status || '').toLowerCase()] || status || '—')
const formatDate = (input?: string) => (input ? String(input).replace('T', ' ').slice(0, 16) : '—')

watch(() => route.params.id, () => {
  activeTab.value = 'detail'
  void loadDetail()
})

onMounted(loadDetail)
</script>

<style scoped>
.detail-section-hint {
  color: #68776e;
  font-size: 12px;
}
</style>
