<template>
  <div v-if="error" class="agri-detail-page">
    <div class="uc-detail-state is-error">
      <p>{{ error }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="app.navigate('org-list')">返回组织列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!data" class="agri-detail-page">
    <div class="uc-detail-state">正在加载组织详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="data.org.code || `ORG-${data.org.id}`"
    :title="data.org.name"
    :status="verifyStatusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回组织列表"
    @back="app.navigate('org-list')"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="loadDetail">刷新</a-button>
      <a-button @click="app.navigate('identity-audit')">身份申请审核</a-button>
      <a-button type="primary" @click="app.navigate('org-audit')">前往组织认证审核</a-button>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="工商与联系信息">
        <AgriVueDetailInfoGrid :items="profileItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="组织成员关系" :flush="true">
        <template #extra>
          <button
            v-if="data.members.length > 0"
            type="button"
            class="agri-detail-section-link"
            @click="activeTab = 'members'"
          >
            查看全部 {{ data.members.length }} 人
          </button>
        </template>
        <a-table
          row-key="userId"
          size="small"
          :pagination="false"
          :data-source="data.members.slice(0, 5)"
          :locale="{ emptyText: '暂无成员绑定' }"
          :columns="memberColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <div v-if="column.key === 'username'">
              <b>{{ record.nickname || text }}</b>
              <div class="small muted agri-detail-mono">{{ text }}</div>
            </div>
            <template v-else-if="column.key === 'roleInMerchant'">{{ roleInMerchantLabel(text) }}</template>
            <span v-else-if="column.key === 'joinedAt'" class="agri-detail-mono">{{ formatTime(text) }}</span>
            <a-button
              v-else-if="column.key === 'action'"
              size="small"
              type="link"
              @click="app.navigate('user-detail', record.userId)"
            >
              查看用户
            </a-button>
          </template>
        </a-table>
        <template #footer>
          <span>成员总数 <strong class="agri-detail-mono">{{ data.members.length }}</strong> 人 · 认证记录 <strong class="agri-detail-mono">{{ data.certifications.length }}</strong> 份</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'members'">
      <AgriVueDetailSection title="全部组织成员" :flush="true">
        <a-table
          row-key="userId"
          size="small"
          :pagination="false"
          :data-source="data.members"
          :locale="{ emptyText: '暂无成员绑定' }"
          :columns="memberColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <div v-if="column.key === 'username'">
              <b>{{ record.nickname || text }}</b>
              <div class="small muted agri-detail-mono">{{ text }}</div>
            </div>
            <template v-else-if="column.key === 'roleInMerchant'">{{ roleInMerchantLabel(text) }}</template>
            <span v-else-if="column.key === 'joinedAt'" class="agri-detail-mono">{{ formatTime(text) }}</span>
            <a-button
              v-else-if="column.key === 'action'"
              size="small"
              type="link"
              @click="app.navigate('user-detail', record.userId)"
            >
              查看用户
            </a-button>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'certifications'">
      <AgriVueDetailSection title="资质认证记录" :flush="true">
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="data.certifications"
          :locale="{ emptyText: '该组织尚未提交资质认证' }"
          :scroll="{ x: 820 }"
          :columns="certColumns"
        >
          <template #bodyCell="{ column, text }">
            <span v-if="column.key === 'certNo'" class="agri-detail-mono">{{ text || '—' }}</span>
            <StatusTag v-else-if="column.key === 'certStatus'" :status="text" />
            <span v-else-if="column.key === 'submitTime'" class="agri-detail-mono">{{ formatTime(text) }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'applications'">
      <AgriVueDetailSection title="关联身份申请" :flush="true">
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="data.applications"
          :locale="{ emptyText: '该主体暂无关联身份申请' }"
          :columns="appColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <a-tag v-if="column.key === 'identityType'" class="soft-tag">{{ identityTypeText(text) }}</a-tag>
            <StatusTag v-else-if="column.key === 'status'" :status="text" />
            <span v-else-if="column.key === 'applyTime'" class="agri-detail-mono">{{ formatTime(text ?? record.createdAt) }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="组织认证进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联单据与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AgriVueDetailInfoGrid,
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailInfoGridItem,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import StatusTag from '../components/StatusTag.vue'
import { ORG_TYPE_LABEL, STATUS_MAP, formatTime, identityTypeText } from '../components/ui-constants'
import type { OrgDetailData } from '../types'

const props = defineProps<{ id: string }>()
const app = useAppStore()
const data = ref<OrgDetailData | null>(null)
const loading = ref(false)
const error = ref('')
const activeTab = ref('detail')

const memberColumns = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '组织内角色', dataIndex: 'roleInMerchant', key: 'roleInMerchant', width: 130 },
  { title: '加入时间', dataIndex: 'joinedAt', key: 'joinedAt', width: 150 },
  { title: '操作', key: 'action', width: 90 },
]

const certColumns = [
  { title: '证书编号', dataIndex: 'certNo', key: 'certNo', width: 170 },
  { title: '企业名称', dataIndex: 'companyName', key: 'companyName' },
  { title: '法人', dataIndex: 'legalPerson', key: 'legalPerson', width: 100 },
  { title: '状态', dataIndex: 'certStatus', key: 'certStatus', width: 110 },
  { title: '提交时间', dataIndex: 'submitTime', key: 'submitTime', width: 150 },
  { title: '审核意见', dataIndex: 'reviewRemark', key: 'reviewRemark' },
]

const appColumns = [
  { title: '申请身份', dataIndex: 'identityType', key: 'identityType', width: 130 },
  { title: '主体名称', dataIndex: 'subjectName', key: 'subjectName' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '提交时间', dataIndex: 'applyTime', key: 'applyTime', width: 150 },
]

const ROLE_IN_MERCHANT_LABEL: Record<string, string> = {
  OWNER: '主体负责人',
  ADMIN: '主体管理员',
  MANAGER: '业务主管',
  MEMBER: '普通成员',
  OPERATOR: '运营操作员',
  FINANCE: '财务人员',
}

const MEMBER_TYPE_LABEL: Record<string, string> = {
  FARMER: '种植户 / 农户',
  COOP: '农民专业合作社',
  ENTERPRISE: '农业企业',
  COMPANY: '企业主体',
  MERCHANT: '经营主体',
  BUYER: '采购商',
  SUPPLIER: '供应商',
  CHANNEL: '渠道商',
  INDIVIDUAL: '个人主体',
}

const orgTypeLabel = (code?: string | null) =>
  (code && (ORG_TYPE_LABEL[code.toUpperCase()] || ORG_TYPE_LABEL[code])) || code || '未分类'

const memberTypeLabel = (code?: string | null) =>
  (code && (MEMBER_TYPE_LABEL[code.toUpperCase()] || ORG_TYPE_LABEL[code.toUpperCase()] || code)) || '—'

const roleInMerchantLabel = (code?: string | null) =>
  (code && (ROLE_IN_MERCHANT_LABEL[code.toUpperCase()] || code)) || '—'

const verifyStatusBadge = computed<DetailStatusBadge>(() => {
  const raw = (data.value?.org.verifyStatus || '').toLowerCase()
  const hit = STATUS_MAP[raw]
  if (raw === 'approved' || raw === 'verified') return { label: hit?.label || '已认证', tone: 'green' }
  if (raw === 'rejected') return { label: hit?.label || '已驳回', tone: 'red' }
  if (raw === 'pending' || raw === 'submitted' || raw === 'reviewing') return { label: hit?.label || '待审核', tone: 'orange' }
  return { label: hit?.label || data.value?.org.verifyStatus || '未认证', tone: 'gray' }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const d = data.value
  if (!d) return []
  const badges: DetailStatusBadge[] = [{ label: orgTypeLabel(d.org.type), tone: 'blue' }]
  if (d.org.industry) badges.push({ label: d.org.industry, tone: 'gray' })
  return badges
})

const headerMeta = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: '组织编号', value: String(d.org.id) },
    { label: '联系人', value: d.org.contactName || '未填写' },
    { label: '成员数', value: `${d.members.length} 人` },
    { label: '创建时间', value: formatTime(d.org.createdAt) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '组织详情' },
  { key: 'members', label: '组织成员', count: data.value?.members.length ?? 0 },
  { key: 'certifications', label: '资质认证', count: data.value?.certifications.length ?? 0 },
  { key: 'applications', label: '身份申请', count: data.value?.applications.length ?? 0 },
])

const profileItems = computed<DetailInfoGridItem[]>(() => {
  const o = data.value?.org
  if (!o) return []
  return [
    { key: 'code', label: '组织编码', value: o.code || `ORG-${o.id}`, mono: true },
    { key: 'creditCode', label: '信用代码', value: o.creditCode || '—', mono: Boolean(o.creditCode) },
    { key: 'type', label: '组织类型', value: orgTypeLabel(o.type) },
    { key: 'memberType', label: '会员类型', value: memberTypeLabel(o.memberType) },
    { key: 'industry', label: '所属行业', value: o.industry || '—' },
    { key: 'contact', label: '联系人', value: o.contactName ? `${o.contactName}${o.contactPhone ? ` · ${o.contactPhone}` : ''}` : (o.contactPhone || '—') },
    { key: 'createdAt', label: '创建时间', value: formatTime(o.createdAt), mono: true },
    { key: 'verifyTime', label: '认证时间', value: formatTime(o.verifyTime), mono: true },
    { key: 'address', label: '所在地', value: o.address || '—', fullWidth: true },
    { key: 'verifyRemark', label: '认证意见', value: o.verifyRemark || '—', fullWidth: true },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = data.value
  if (!d) return []
  const raw = (d.org.verifyStatus || '').toLowerCase()
  const verified = raw === 'approved' || raw === 'verified'
  const rejected = raw === 'rejected'
  const hasCert = d.certifications.length > 0
  const hasMembers = d.members.length > 0
  return [
    {
      key: 'created',
      title: '组织档案已建档',
      time: formatTime(d.org.createdAt),
      description: d.org.name,
      state: 'done',
    },
    {
      key: 'cert',
      title: hasCert ? `已提交 ${d.certifications.length} 份资质材料` : '尚未提交资质认证',
      time: formatTime(d.certifications[0]?.submitTime),
      description: d.certifications[0]?.certNo ? `最新证书 ${d.certifications[0].certNo}` : '待主体补充工商与资质证照',
      state: hasCert ? 'done' : 'pending',
    },
    {
      key: 'verify',
      title: verified ? '组织认证已通过' : rejected ? '组织认证已驳回' : '等待组织认证审核',
      time: formatTime(d.org.verifyTime),
      description: d.org.verifyRemark || (verified ? '具备平台正式经营主体资格' : '可在组织认证审核台处理'),
      state: verified ? 'done' : rejected ? 'error' : 'current',
    },
    {
      key: 'members',
      title: hasMembers ? `已绑定 ${d.members.length} 名组织成员` : '待绑定成员账号',
      description: hasMembers ? `代表成员：${d.members[0].nickname || d.members[0].username || '—'}` : '绑定成员后可协同开展业务',
      state: hasMembers ? 'done' : 'pending',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = data.value
  if (!d) return []
  const latestCert = d.certifications[0]
  const firstMember = d.members[0]
  return [
    {
      key: 'cert',
      label: '最新资质证书',
      code: latestCert?.certNo || undefined,
      text: latestCert ? (latestCert.certNo ? undefined : latestCert.companyName || '已提交') : '未提交',
      badge: latestCert ? (STATUS_MAP[latestCert.certStatus?.toLowerCase()]?.label ?? latestCert.certStatus) : undefined,
      badgeTone: latestCert?.certStatus?.toLowerCase() === 'approved' ? 'green' : latestCert ? 'orange' : 'gray',
      clickable: Boolean(latestCert),
      onClick: () => { activeTab.value = 'certifications' },
    },
    {
      key: 'member',
      label: '代表成员账号',
      text: firstMember ? (firstMember.nickname || firstMember.username || '查看成员') : '暂无成员',
      mono: false,
      clickable: Boolean(firstMember),
      onClick: () => { if (firstMember) app.navigate('user-detail', firstMember.userId) },
    },
    {
      key: 'orgAudit',
      label: '组织认证审核台',
      text: '前往审核队列',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('org-audit'),
    },
    {
      key: 'qualAudit',
      label: '资质审核队列',
      text: '查看资质单据',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('qualification-audit'),
    },
  ]
})

function loadDetail() {
  if (!props.id) {
    error.value = '缺少组织 ID'
    return
  }
  loading.value = true
  error.value = ''
  ucApi.orgDetail(props.id)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch(() => props.id, (id) => {
  activeTab.value = 'detail'
  data.value = null
  if (!id) {
    error.value = '缺少组织 ID'
    return
  }
  loadDetail()
}, { immediate: true })

function printPage() {
  window.print()
}
</script>
