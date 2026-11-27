<template>
  <div v-if="error" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ error }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回配额列表</a-button>
        <a-button type="primary" @click="load">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!detail" class="agri-detail-page">
    <div class="mds-detail-state">正在加载主体配额详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="detail.tenantCode || `QUOTA-${route.params.id}`"
    :title="detail.tenantName || '经营主体'"
    :status="quotaStatusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回配额列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="load">刷新</a-button>
      <a-button @click="viewSubject">主体档案</a-button>
      <a-button type="primary" @click="editQuota">编辑配额</a-button>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="主体与配额概览">
        <MdsDetailInfoGrid :items="overviewItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="资源限额与实时用量" :flush="true">
        <template #extra>
          <button type="button" class="detail-section-link" @click="activeTab = 'usage'">
            查看全部 {{ usageItems.length }} 项
          </button>
        </template>
        <div class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>资源项</th>
                <th class="is-num">当前已用</th>
                <th class="is-num">配额上限</th>
                <th>使用进度</th>
                <th class="is-num">使用率</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in usageItems" :key="item.key">
                <td><strong>{{ item.label }}</strong></td>
                <td class="is-num">{{ formatNumber(item.used, item.unit) }}</td>
                <td class="is-num">{{ item.limit === null ? '—' : formatNumber(item.limit, item.unit) }}</td>
                <td>
                  <div class="detail-quota-bar">
                    <i :class="{ 'is-danger': item.percent >= 80 }" :style="{ width: `${item.percent}%` }" />
                  </div>
                </td>
                <td class="is-num">
                  <span class="agri-detail-status-pill" :class="usageToneClass(item)">
                    {{ hasQuota ? `${item.percent}%` : '未设限' }}
                  </span>
                </td>
                <td>{{ item.hint || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <template #footer>
          <span>最高使用率 <strong class="detail-mono">{{ hasQuota ? `${maxPercent}%` : '未设置' }}</strong></span>
          <span v-if="warningCount > 0" style="color: #cf1322">· {{ warningCount }} 项达到 ≥ 80% 预警线</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'usage'">
      <AgriVueDetailSection title="资源用量进度卡片">
        <div class="detail-kpi-strip">
          <div v-for="item in usageItems" :key="item.key" class="detail-kpi-cell">
            <span>{{ item.label }}</span>
            <strong>{{ usageText(item.used, item.limit, item.unit) }}</strong>
            <div class="detail-quota-bar" style="margin: 4px 0">
              <i :class="{ 'is-danger': item.percent >= 80 }" :style="{ width: `${item.percent}%` }" />
            </div>
            <small>{{ hasQuota ? `使用率 ${item.percent}%` : '未设置限额' }}{{ item.hint ? ` · ${item.hint}` : '' }}</small>
          </div>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'rules'">
      <AgriVueDetailSection title="资源口径说明">
        <MdsDetailInfoGrid :items="ruleItems" />
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="配额监控进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联档案与入口">
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

interface QuotaDetailModel {
  id?: number | string
  tenantCode?: string
  tenantName?: string
  tenantType?: string
  createTime?: string
  quotaInfo?: {
    usedUsers?: number
    userLimit?: number | null
    usedOrgs?: number
    orgLimit?: number | null
    usedProducts?: number
    productLimit?: number | null
    usedStorage?: number
    storageLimit?: number | null
    usedApiToday?: number
    apiLimit?: number | null
  }
}

interface UsageRow {
  key: string
  label: string
  used: number
  limit: number | null
  unit: string
  hint: string
  percent: number
}

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const detail = ref<QuotaDetailModel | null>(null)
const loading = ref(false)
const error = ref('')
const activeTab = ref('detail')

const hasQuota = computed(() => detail.value?.quotaInfo?.userLimit !== null && detail.value?.quotaInfo?.userLimit !== undefined)

const usageItems = computed<UsageRow[]>(() => {
  const quota = detail.value?.quotaInfo ?? {}
  return [
    buildItem('users', '用户数', quota.usedUsers, quota.userLimit, '', '绑定当前主体的有效成员'),
    buildItem('orgs', '组织数', quota.usedOrgs, quota.orgLimit, '', '主体下属部门与生产单位'),
    buildItem('products', '商品数', quota.usedProducts, quota.productLimit, '', '主体名下已建档商品'),
    buildItem('storage', '存储空间', quota.usedStorage, quota.storageLimit, 'GB', '文件与附件累计占用'),
    buildItem('api', '每日 API', quota.usedApiToday, quota.apiLimit, '', '今日累计调用次数'),
  ]
})

const maxPercent = computed(() => Math.max(0, ...usageItems.value.map(i => i.percent)))
const warningCount = computed(() => usageItems.value.filter(i => i.percent >= 80).length)

function buildItem(key: string, label: string, used: unknown, limit: unknown, unit = '', hint = ''): UsageRow {
  const normalizedUsed = unit === 'GB' ? Math.round(((Number(used) || 0) / GB) * 100) / 100 : Number(used) || 0
  const normalizedLimit = unit === 'GB' ? Math.round(((Number(limit) || 0) / GB) * 100) / 100 : Number(limit) || 0
  const hasLimit = limit !== null && limit !== undefined
  return {
    key,
    label,
    used: normalizedUsed,
    limit: hasLimit ? normalizedLimit : null,
    unit,
    hint,
    percent: hasLimit && normalizedLimit > 0 ? Math.min(100, Math.round((normalizedUsed / normalizedLimit) * 100)) : 0,
  }
}

const formatNumber = (val: number, unit: string) => `${Number(val || 0).toLocaleString('zh-CN')}${unit === 'GB' ? ' GB' : ''}`
const usageText = (used: number, limit: number | null, unit: string) => `${formatNumber(used, unit)} / ${limit === null ? '—' : formatNumber(limit, unit)}`

const usageToneClass = (row: UsageRow) => {
  if (!hasQuota.value) return 'is-gray'
  if (row.percent >= 80) return 'is-red'
  if (row.percent >= 60) return 'is-orange'
  return 'is-green'
}

const quotaStatusBadge = computed<DetailStatusBadge>(() => {
  if (!hasQuota.value) return { label: '尚未配置配额', tone: 'orange' }
  if (warningCount.value > 0) return { label: '配额预警中', tone: 'red' }
  return { label: '已配置配额', tone: 'green' }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const isPersonal = detail.value?.tenantType === 'INDIVIDUAL'
  return [
    { label: isPersonal ? '个人主体' : '企业主体', tone: isPersonal ? 'blue' : 'green' },
  ]
})

const headerMeta = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    { label: '主体类型', value: d.tenantType === 'INDIVIDUAL' ? '个人主体' : '企业主体' },
    { label: '配额状态', value: hasQuota.value ? '已生效' : '未配置' },
    { label: '最高使用率', value: hasQuota.value ? `${maxPercent.value}%` : '—' },
    { label: '预警项', value: `${warningCount.value} 项` },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '配额详情' },
  { key: 'usage', label: '资源用量', count: usageItems.value.length },
  { key: 'rules', label: '口径说明' },
])

const overviewItems = computed<MdsDetailInfoItem[]>(() => {
  const d = detail.value
  if (!d) return []
  return [
    { key: 'code', label: '主体编码', value: d.tenantCode, mono: true },
    { key: 'name', label: '主体名称', value: d.tenantName },
    { key: 'type', label: '主体类型', value: d.tenantType === 'INDIVIDUAL' ? '个人主体' : '企业主体' },
    { key: 'state', label: '配额状态', value: hasQuota.value ? '已配置配额' : '尚未配置配额' },
    { key: 'maxPercent', label: '最高使用率', value: hasQuota.value ? `${maxPercent.value}%` : '未设置', mono: true },
    { key: 'warningCount', label: '预警资源项', value: warningCount.value > 0 ? `${warningCount.value} 项（≥ 80%）` : '0 项（健康）', mono: true },
  ]
})

const ruleItems: MdsDetailInfoItem[] = [
  { key: 'users', label: '用户用量', value: '平台用户与当前主体的有效绑定数量' },
  { key: 'orgs', label: '组织用量', value: '归属当前主体的部门、团队和生产单位数量' },
  { key: 'products', label: '商品用量', value: '归属当前主体的商品数量' },
  { key: 'storageApi', label: '存储 / API', value: '由配额记录中的累计用量实时统计提供' },
]

const timelineSteps = computed<DetailTimelineStep[]>(() => [
  {
    key: 'subject',
    title: '经营主体已建档',
    time: detail.value?.createTime ? String(detail.value.createTime).replace('T', ' ').slice(0, 16) : undefined,
    description: detail.value?.tenantName || '',
    state: 'done',
  },
  {
    key: 'config',
    title: hasQuota.value ? '资源配额已配置' : '等待配置资源配额',
    description: hasQuota.value ? '覆盖用户、组织、商品、存储与每日 API 五项指标' : '点击右上角「编辑配额」设定限额',
    state: hasQuota.value ? 'done' : 'current',
  },
  {
    key: 'collect',
    title: '实时用量持续采集中',
    description: `最高使用率 ${hasQuota.value ? `${maxPercent.value}%` : '未设限'}`,
    state: hasQuota.value ? 'done' : 'pending',
  },
  {
    key: 'alert',
    title: warningCount.value > 0 ? `触发 ${warningCount.value} 项超限预警` : '资源使用处于安全区间',
    description: warningCount.value > 0 ? '建议评估扩容或升级服务套餐' : '各项使用率均低于 80% 预警线',
    state: warningCount.value > 0 ? 'error' : hasQuota.value ? 'done' : 'pending',
  },
])

const relatedDocs = computed<DetailRelatedDocItem[]>(() => [
  {
    key: 'subject',
    label: '主体详情档案',
    code: detail.value?.tenantCode || undefined,
    text: !detail.value?.tenantCode ? '查看主体档案' : undefined,
    clickable: true,
    onClick: viewSubject,
  },
  {
    key: 'packages',
    label: '服务套餐模板',
    text: '查看可选套餐',
    mono: false,
    clickable: true,
    onClick: () => void router.push('/subject/package'),
  },
  {
    key: 'quotaList',
    label: '配额与超限列表',
    text: '查看全部主体配额',
    mono: false,
    clickable: true,
    onClick: goBack,
  },
  {
    key: 'stats',
    label: '主体数据统计',
    text: '查看趋势统计',
    mono: false,
    clickable: true,
    onClick: () => void router.push('/subject/statistics'),
  },
])

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await getTenantDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '配额详情加载失败')
    detail.value = response.data as QuotaDetailModel
  } catch (cause) {
    detail.value = null
    error.value = cause instanceof Error ? cause.message : '配额详情加载失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => void router.push('/subject/quota')
const viewSubject = () => void router.push(`/subject/detail/${route.params.id}`)
const editQuota = () => void router.push(`/subject/quota/${route.params.id}/edit`)
const printPage = () => window.print()

watch(() => route.params.id, () => {
  activeTab.value = 'detail'
  void load()
})

onMounted(load)
</script>
