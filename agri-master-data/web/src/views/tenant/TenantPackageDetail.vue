<template>
  <div v-if="error" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ error }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回套餐列表</a-button>
        <a-button type="primary" @click="load">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!pkg" class="agri-detail-page">
    <div class="mds-detail-state">正在加载服务套餐详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="pkg.packageCode || `PKG-${route.params.id}`"
    :title="pkg.packageName || '服务套餐'"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回套餐列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="load">刷新</a-button>
      <a-button type="primary" @click="edit">编辑套餐</a-button>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="套餐配置">
        <MdsDetailInfoGrid :items="configItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="资源限额明细" :flush="true">
        <template #extra>
          <button type="button" class="detail-section-link" @click="activeTab = 'limits'">
            查看全部 {{ limits.length }} 项
          </button>
        </template>
        <div class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>资源项</th>
                <th class="is-num">套餐上限</th>
                <th>计费与适用说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in limits" :key="item.key">
                <td>{{ item.label }}</td>
                <td class="is-num"><strong>{{ item.value }}</strong></td>
                <td>{{ item.hint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <template #footer>
          <span>套餐标价 <strong class="detail-mono">¥{{ pkg.price ?? 0 }}</strong> / {{ pkg.duration ?? 0 }} 天</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'limits'">
      <AgriVueDetailSection title="核心资源配额指标">
        <div class="detail-kpi-strip">
          <div v-for="item in limits" :key="item.key" class="detail-kpi-cell">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </div>
        </div>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="限额明细表" :flush="true">
        <div class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>资源项</th>
                <th class="is-num">配额上限</th>
                <th>控制策略</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in limits" :key="item.key">
                <td>{{ item.label }}</td>
                <td class="is-num"><strong>{{ item.value }}</strong></td>
                <td>{{ item.hint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="套餐状态进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联配置与入口">
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
import { getTenantPackageDetail } from '../../utils/api'

interface PackageDetailModel {
  id: number | string
  packageCode?: string
  packageName?: string
  packageDesc?: string
  price?: number | string
  duration?: number
  serviceLevel?: number
  serviceLevelDesc?: string
  status?: number
  userLimit?: number
  orgLimit?: number
  productLimit?: number
  storageLimit?: number
  apiLimit?: number
  createTime?: string
  updateTime?: string
}

const GB = 1024 ** 3
const route = useRoute()
const router = useRouter()
const pkg = ref<PackageDetailModel | null>(null)
const loading = ref(false)
const error = ref('')
const activeTab = ref('detail')

const isEnabled = computed(() => Number(pkg.value?.status) === 1)
const levelText = (value?: number) => ({ 1: '基础支持', 2: '标准支持', 3: '7×24 专属支持' }[value || 0] || '—')
const num = (value?: number) => (value === null || value === undefined || value <= 0 ? '不限' : Number(value).toLocaleString('zh-CN'))

const limits = computed(() => [
  { key: 'users', label: '用户上限', value: num(pkg.value?.userLimit), hint: '主体内允许绑定的有效成员账号数' },
  { key: 'orgs', label: '组织上限', value: num(pkg.value?.orgLimit), hint: '主体内可维护的组织架构节点上限' },
  { key: 'products', label: '商品上限', value: num(pkg.value?.productLimit), hint: '主体名下可维护的商品主数据总量' },
  {
    key: 'storage',
    label: '存储上限',
    value: (pkg.value?.storageLimit ?? 0) > 0 ? `${Math.round(((pkg.value?.storageLimit ?? 0) / GB) * 10) / 10} GB` : '不限',
    hint: '文件、证照与业务附件累计占用空间',
  },
  { key: 'api', label: '每日 API 调用', value: num(pkg.value?.apiLimit), hint: '单自然日接口调用频次上限' },
])

const statusBadge = computed<DetailStatusBadge>(() => ({
  label: isEnabled.value ? '启用中' : '已停用',
  tone: isEnabled.value ? 'green' : 'gray',
}))

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const d = pkg.value
  if (!d) return []
  return [
    { label: levelText(d.serviceLevel), tone: 'blue' },
    { label: `¥${d.price ?? 0} / ${d.duration ?? 0} 天`, tone: 'green' },
  ]
})

const headerMeta = computed(() => {
  const d = pkg.value
  if (!d) return []
  return [
    { label: '价格', value: `¥${d.price ?? 0}` },
    { label: '有效期', value: `${d.duration ?? 0} 天` },
    { label: '服务级别', value: levelText(d.serviceLevel) },
    { label: '创建时间', value: formatTime(d.createTime) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '套餐详情' },
  { key: 'limits', label: '资源限额', count: limits.value.length },
])

const configItems = computed<MdsDetailInfoItem[]>(() => {
  const d = pkg.value
  if (!d) return []
  return [
    { key: 'packageCode', label: '套餐编码', value: d.packageCode, mono: true },
    { key: 'packageName', label: '套餐名称', value: d.packageName },
    { key: 'price', label: '套餐价格', value: `¥${d.price ?? 0}`, mono: true },
    { key: 'duration', label: '有效期', value: `${d.duration ?? 0} 天`, mono: true },
    { key: 'serviceLevel', label: '服务级别', value: levelText(d.serviceLevel) },
    { key: 'status', label: '启用状态', value: isEnabled.value ? '启用' : '停用' },
    { key: 'createTime', label: '创建时间', value: formatTime(d.createTime), mono: true },
    { key: 'serviceLevelDesc', label: '服务说明', value: d.serviceLevelDesc || '—' },
    { key: 'packageDesc', label: '套餐说明', value: d.packageDesc || '暂无套餐说明', fullWidth: true },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = pkg.value
  if (!d) return []
  return [
    {
      key: 'created',
      title: '套餐模板已创建',
      time: formatTime(d.createTime),
      description: `编码 ${d.packageCode || ''}`,
      state: 'done',
    },
    {
      key: 'pricing',
      title: '价格与周期已设定',
      description: `¥${d.price ?? 0} / ${d.duration ?? 0} 天 · ${levelText(d.serviceLevel)}`,
      state: 'done',
    },
    {
      key: 'limits',
      title: '5 项资源限额已配置',
      description: `用户 ${num(d.userLimit)} · 组织 ${num(d.orgLimit)} · 商品 ${num(d.productLimit)}`,
      state: 'done',
    },
    {
      key: 'status',
      title: isEnabled.value ? '已启用并可供开通选用' : '套餐已停用',
      time: formatTime(d.updateTime),
      description: isEnabled.value ? '可在主体开通配置中选择该套餐' : '停用后新开通主体不再可选',
      state: isEnabled.value ? 'done' : 'error',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => [
  {
    key: 'packageList',
    label: '套餐模板列表',
    text: '查看全部套餐',
    mono: false,
    clickable: true,
    onClick: goBack,
  },
  {
    key: 'quota',
    label: '配额与超限',
    text: '查看主体配额',
    mono: false,
    clickable: true,
    onClick: () => void router.push('/subject/quota'),
  },
  {
    key: 'create',
    label: '主体开通配置',
    text: '前往开通向导',
    mono: false,
    clickable: true,
    onClick: () => void router.push('/subject/create'),
  },
  {
    key: 'stats',
    label: '主体数据统计',
    text: '查看套餐分布',
    mono: false,
    clickable: true,
    onClick: () => void router.push('/subject/statistics'),
  },
])

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await getTenantPackageDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '套餐详情加载失败')
    pkg.value = response.data as PackageDetailModel
  } catch (cause) {
    pkg.value = null
    error.value = cause instanceof Error ? cause.message : '套餐详情加载失败'
  } finally {
    loading.value = false
  }
}

const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')
const goBack = () => void router.push('/subject/package')
const edit = () => void router.push(`/subject/package/${route.params.id}/edit`)
const printPage = () => window.print()

watch(() => route.params.id, () => {
  activeTab.value = 'detail'
  void load()
})

onMounted(load)
</script>
