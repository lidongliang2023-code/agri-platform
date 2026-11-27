<template>
  <div v-if="loadError" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ loadError }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回组织列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!orgData" class="agri-detail-page">
    <div class="mds-detail-state">正在加载组织详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="orgData.orgCode || `ORG-${route.params.id}`"
    :title="value(orgData.orgName)"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回组织列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="loadDetail">刷新</a-button>
      <a-button
        v-if="!orgData.legacy && isEnabled"
        v-point="'PUT /admin/masterdata/org/{id}/status'"
        danger
        :loading="statusUpdating"
        @click="toggleStatus"
      >
        停用组织
      </a-button>
      <a-button
        v-else-if="!orgData.legacy"
        v-point="'PUT /admin/masterdata/org/{id}/status'"
        :loading="statusUpdating"
        @click="toggleStatus"
      >
        启用组织
      </a-button>
      <a-button type="primary" :disabled="orgData.legacy" @click="editOrg">编辑组织</a-button>
    </template>

    <template v-if="orgData.legacy" #banner>
      <NoticeBar tone="warning" title="历史组织数据 · 只读：">
        该组织仍使用旧租户编码（{{ orgData.tenantId }}），未关联统一企业或个人主体。运营端仅允许查看，请由主体管理员重新建立组织或执行历史数据迁移。
      </NoticeBar>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="基本档案">
        <template #extra>
          <span class="detail-section-hint">第 {{ orgData.orgLevel || 1 }} 级组织</span>
        </template>
        <MdsDetailInfoGrid :items="basicItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="负责人与地址信息">
        <MdsDetailInfoGrid :items="contactAddressItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="直接下级组织" :flush="true">
        <template #extra>
          <button
            v-if="childrenList.length > 0"
            type="button"
            class="detail-section-link"
            @click="activeTab = 'children'"
          >
            查看全部 {{ childrenList.length }} 项
          </button>
        </template>
        <div v-if="childrenList.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>组织名称</th>
                <th>组织编码</th>
                <th>组织类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="child in childrenList.slice(0, 5)" :key="child.id">
                <td><strong>{{ child.orgName }}</strong></td>
                <td class="detail-mono">{{ child.orgCode || '—' }}</td>
                <td>{{ resolveOrgTypeText(child) }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="Number(child.status) === 1 ? 'is-green' : 'is-gray'">
                    {{ Number(child.status) === 1 ? '启用' : '停用' }}
                  </span>
                </td>
                <td>
                  <button type="button" class="detail-section-link" @click="viewChild(child.id)">查看详情</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">暂无直接下级组织。</div>
        <template v-if="childrenList.length" #footer>
          <span>直接下级合计 <strong class="detail-mono">{{ orgData.childCount ?? childrenList.length }}</strong> 个</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'children'">
      <AgriVueDetailSection title="直接下级组织清单" :flush="true">
        <template #extra>
          <span class="detail-section-hint">完整层级可在组织列表的「层级」视图查看</span>
        </template>
        <div v-if="childrenList.length" class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>组织名称</th>
                <th>组织编码</th>
                <th>组织类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="child in childrenList" :key="child.id">
                <td><strong>{{ child.orgName }}</strong></td>
                <td class="detail-mono">{{ child.orgCode || '—' }}</td>
                <td>{{ resolveOrgTypeText(child) }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="Number(child.status) === 1 ? 'is-green' : 'is-gray'">
                    {{ Number(child.status) === 1 ? '启用' : '停用' }}
                  </span>
                </td>
                <td>
                  <button type="button" class="detail-section-link" @click="viewChild(child.id)">查看详情</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mds-detail-empty">暂无下级组织。</div>
        <template v-if="childrenList.length" #footer>
          <span>共 <strong class="detail-mono">{{ orgData.childCount ?? childrenList.length }}</strong> 个直接下级组织</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'governance'">
      <AgriVueDetailSection title="归属主体与治理说明">
        <MdsDetailInfoGrid :items="governanceItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="运营端职责与备注">
        <p class="mds-detail-text-block">
          组织属于主体内部经营数据。日常维护建议由经营主体负责人或主体管理员完成；运营端主要用于跨主体核查、异常组织处置和应急数据修正。
        </p>
        <p v-if="orgData.remark" class="mds-detail-text-block" style="margin-top: 12px">
          {{ orgData.remark }}
        </p>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="组织状态进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联主体与节点">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
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
import NoticeBar from '@/components/ui/NoticeBar.vue'
import { getOrgDetail, updateOrgStatus } from '../../utils/api'

interface OrgChildModel {
  id: number | string
  orgName: string
  orgCode?: string
  orgType?: string
  orgTypeName?: string
  status?: number | string
}

interface OrgDetailModel {
  id: number | string
  orgName?: string
  orgCode?: string
  orgType?: string
  orgTypeName?: string
  orgLevel?: number
  orgPath?: string
  status?: number | string
  parentId?: number | string | null
  parentName?: string
  childCount?: number
  children?: OrgChildModel[]
  tenantId?: number | string
  tenantName?: string
  subjectLinked?: boolean
  legacy?: boolean
  contactPerson?: string
  contactPhone?: string
  contactMobile?: string
  province?: string
  city?: string
  district?: string
  address?: string
  createBy?: string
  createTime?: string
  updateTime?: string
  remark?: string
}

const route = useRoute()
const router = useRouter()
const orgData = ref<OrgDetailModel | null>(null)
const loading = ref(false)
const loadError = ref('')
const statusUpdating = ref(false)
const activeTab = ref('detail')

const ORG_TYPE_MAP: Record<string, string> = {
  ENTERPRISE: '企业组织',
  COOPERATIVE: '合作社',
  DEPARTMENT: '部门',
  TEAM: '团队',
  PRODUCTION_UNIT: '生产单位',
  FARM: '农场/基地',
}

const resolveOrgTypeText = (item?: { orgType?: string; orgTypeName?: string } | null) => {
  if (!item) return '未分类'
  const mapped = ORG_TYPE_MAP[String(item.orgType || '').toUpperCase()]
  if (mapped) return mapped
  const rawName = String(item.orgTypeName || '').trim()
  if (rawName && rawName.toUpperCase() !== String(item.orgType || '').toUpperCase()) return rawName
  return '未分类'
}

const orgTypeText = computed(() => resolveOrgTypeText(orgData.value))
const isEnabled = computed(() => Number(orgData.value?.status) === 1)
const childrenList = computed(() => orgData.value?.children ?? [])

const statusBadge = computed<DetailStatusBadge>(() => ({
  label: isEnabled.value ? '启用' : '停用',
  tone: isEnabled.value ? 'green' : 'gray',
}))

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const list: DetailStatusBadge[] = [{ label: orgTypeText.value, tone: 'blue' }]
  if (orgData.value?.legacy) {
    list.push({ label: '历史只读', tone: 'orange' })
  } else {
    list.push({ label: orgData.value?.subjectLinked ? '统一主体组织' : '待关联主体', tone: orgData.value?.subjectLinked ? 'green' : 'gray' })
  }
  return list
})

const headerMeta = computed(() => {
  const d = orgData.value
  if (!d) return []
  return [
    { label: '归属主体', value: d.tenantName || '未匹配经营主体' },
    { label: '层级', value: `第 ${d.orgLevel || 1} 级` },
    { label: '负责人', value: d.contactPerson || '未填写' },
    { label: '创建时间', value: formatDateTime(d.createTime) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '组织详情' },
  { key: 'children', label: '直接下级', count: orgData.value?.childCount ?? childrenList.value.length },
  { key: 'governance', label: '归属与治理' },
])

const basicItems = computed<MdsDetailInfoItem[]>(() => {
  const d = orgData.value
  if (!d) return []
  return [
    { key: 'orgName', label: '组织名称', value: d.orgName },
    { key: 'orgCode', label: '组织编码', value: d.orgCode, mono: true },
    { key: 'orgType', label: '组织类型', value: orgTypeText.value },
    { key: 'status', label: '组织状态', value: isEnabled.value ? '启用' : '停用' },
    { key: 'parentName', label: '上级组织', value: value(d.parentName, '一级组织') },
    { key: 'childCount', label: '子组织数量', value: String(d.childCount ?? childrenList.value.length), mono: true },
    { key: 'createBy', label: '创建人', value: d.createBy },
    { key: 'createTime', label: '创建时间', value: formatDateTime(d.createTime), mono: true },
    { key: 'updateTime', label: '最后更新', value: formatDateTime(d.updateTime), mono: true },
    { key: 'orgPath', label: '组织路径', value: d.orgPath, mono: true, fullWidth: true },
  ]
})

const contactAddressItems = computed<MdsDetailInfoItem[]>(() => {
  const d = orgData.value
  if (!d) return []
  const region = [d.province, d.city, d.district].filter(Boolean).join(' / ')
  return [
    { key: 'contactPerson', label: '负责人', value: d.contactPerson },
    { key: 'contactPhone', label: '联系电话', value: d.contactPhone || d.contactMobile, mono: true },
    { key: 'region', label: '所在区域', value: region || '—' },
    { key: 'address', label: '详细地址', value: d.address, fullWidth: true },
  ]
})

const governanceItems = computed<MdsDetailInfoItem[]>(() => {
  const d = orgData.value
  if (!d) return []
  return [
    { key: 'tenantName', label: '归属经营主体', value: d.tenantName || '未匹配经营主体' },
    { key: 'tenantId', label: '主体编号', value: d.tenantId ? String(d.tenantId) : '未登记', mono: true },
    { key: 'linked', label: '主体关联状态', value: d.subjectLinked ? '统一主体组织' : '历史组织（未关联）' },
    { key: 'editable', label: '运营端权限', value: d.legacy ? '仅查看（历史只读）' : '支持编辑与启停' },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = orgData.value
  if (!d) return []
  const childTotal = d.childCount ?? childrenList.value.length
  return [
    {
      key: 'created',
      title: '组织已建立',
      time: formatDateTime(d.createTime),
      description: `第 ${d.orgLevel || 1} 级 · ${orgTypeText.value}`,
      state: 'done',
    },
    {
      key: 'linked',
      title: d.legacy ? '历史主体编码（只读）' : d.subjectLinked ? '已关联统一主体' : '待确认主体归属',
      description: d.tenantName || String(d.tenantId || '未登记主体'),
      state: d.legacy ? 'error' : d.subjectLinked ? 'done' : 'current',
    },
    {
      key: 'hierarchy',
      title: childTotal > 0 ? `已维护 ${childTotal} 个下级组织` : '末级组织节点',
      description: d.parentName ? `上级：${d.parentName}` : '顶层一级组织',
      state: 'done',
    },
    {
      key: 'status',
      title: isEnabled.value ? '正常运行中' : '组织已停用',
      time: formatDateTime(d.updateTime),
      description: isEnabled.value ? '可供业务人员与权限范围引用' : '已停用，不再参与新业务分配',
      state: isEnabled.value ? 'done' : 'error',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = orgData.value
  if (!d) return []
  return [
    {
      key: 'subject',
      label: '所属经营主体',
      text: d.tenantName || undefined,
      code: !d.tenantName && d.tenantId ? String(d.tenantId) : undefined,
      emptyText: '未匹配主体',
      badge: d.legacy ? '历史只读' : d.subjectLinked ? '统一主体' : undefined,
      badgeTone: d.legacy ? 'orange' : 'green',
      clickable: Boolean(!d.legacy && d.tenantId),
      onClick: viewSubject,
    },
    {
      key: 'parent',
      label: '上级组织',
      text: d.parentName || undefined,
      emptyText: '一级组织（无上级）',
      clickable: Boolean(d.parentId && Number(d.parentId) > 0),
      onClick: () => { if (d.parentId) viewChild(d.parentId) },
    },
    {
      key: 'children',
      label: '直接下级',
      text: `${d.childCount ?? childrenList.value.length} 个下级组织`,
      mono: false,
      clickable: true,
      onClick: () => { activeTab.value = 'children' },
    },
    {
      key: 'orgList',
      label: '同主体组织树',
      text: '前往组织列表',
      mono: false,
      clickable: true,
      onClick: goBack,
    },
  ]
})

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getOrgDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '组织详情加载失败')
    orgData.value = response.data as OrgDetailModel
  } catch (error) {
    orgData.value = null
    loadError.value = error instanceof Error ? error.message : '组织详情加载失败'
  } finally {
    loading.value = false
  }
}

const toggleStatus = async () => {
  if (!orgData.value || orgData.value.legacy) return
  const next = Number(orgData.value.status) === 1 ? 0 : 1
  if (!confirm(`确定要${next === 1 ? '启用' : '停用'}“${orgData.value.orgName}”吗？`)) return
  statusUpdating.value = true
  try {
    const response = await updateOrgStatus(orgData.value.id, next)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(next === 1 ? '组织已启用' : '组织已停用')
    await loadDetail()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    statusUpdating.value = false
  }
}

const goBack = () => void router.push({
  path: '/org/list',
  query: orgData.value?.tenantId ? { tenantId: String(orgData.value.tenantId) } : {},
})
const editOrg = () => {
  if (orgData.value?.legacy) return
  void router.push(`/org/edit/${route.params.id}`)
}
const viewSubject = () => {
  if (orgData.value?.tenantId) void router.push(`/subject/detail/${orgData.value.tenantId}`)
}
const viewChild = (id: number | string) => void router.push(`/org/detail/${id}`)
const printPage = () => window.print()

const value = (input: unknown, fallback = '—') => (input === null || input === undefined || input === '' ? fallback : String(input))
const formatDateTime = (input?: string) => (input ? String(input).replace('T', ' ').slice(0, 16) : '—')

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
