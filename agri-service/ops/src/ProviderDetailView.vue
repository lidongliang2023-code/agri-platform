<template>
  <AgriVueDetailLayout
    :code="provider.creditCode || `SV-${provider.id}`"
    :title="provider.name"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回服务商列表"
    @back="emit('back')"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="refreshing" @click="emit('refresh')">刷新</a-button>
      <a-button @click="emit('open-catalog')">查看服务商品</a-button>
      <a-button
        v-if="provider.status === 'available'"
        danger
        @click="emit('open-status', 'restricted')"
      >
        限制接单
      </a-button>
      <a-button type="primary" @click="emit('open-status', nextPrimaryStatus)">
        调整经营状态
      </a-button>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="核心经营指标">
        <div class="agri-detail-kpi-strip">
          <div class="agri-detail-kpi-cell">
            <span>信用分 / 等级</span>
            <strong>{{ provider.creditScore }}</strong>
            <small>{{ creditGradeLabel }}</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>累计服务单量</span>
            <strong>{{ provider.orderCount }}</strong>
            <small>近期订单 {{ orders.length }} 笔</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>综合评分</span>
            <strong>★ {{ provider.rating }}</strong>
            <small>{{ provider.badge || '认证服务商' }}</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>接单取消率</span>
            <strong :style="provider.cancelRate > 10 ? { color: '#cf1322' } : undefined">
              {{ provider.cancelRate }}%
            </strong>
            <small>风险等级：{{ riskMeta.label }}</small>
          </div>
        </div>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="主体档案与风险概况">
        <AgriVueDetailInfoGrid :items="profileItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="最近履约订单" :flush="true">
        <template #extra>
          <button
            v-if="orders.length > 0"
            type="button"
            class="agri-detail-section-link"
            @click="activeTab = 'orders'"
          >
            查看全部 {{ orders.length }} 笔
          </button>
        </template>
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="orders.slice(0, 5)"
          :locale="{ emptyText: '暂无最近履约订单' }"
          :columns="orderColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <span v-if="column.key === 'orderNo'" class="agri-detail-mono">{{ text }}</span>
            <a-tag
              v-else-if="column.key === 'status'"
              :class="`ops-status tone-${orderStatusMeta(String(text ?? '')).tone}`"
            >
              {{ orderStatusMeta(String(text ?? '')).label }}
            </a-tag>
            <span v-else-if="column.key === 'totalAmount'" class="agri-detail-mono">
              ¥{{ Number(text ?? 0).toLocaleString('zh-CN') }}
            </span>
            <span v-else-if="column.key === 'progress'" class="agri-detail-mono">{{ record.progress ?? 0 }}%</span>
            <span v-else-if="column.key === 'appointmentDate'" class="agri-detail-mono">{{ text || '—' }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
        <template #footer>
          <span>最近订单总额 <strong class="agri-detail-mono">¥{{ recentOrderTotal.toLocaleString('zh-CN') }}</strong> · 服务商品 <strong class="agri-detail-mono">{{ items.length }}</strong> 项</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'items'">
      <AgriVueDetailSection title="服务商品与目录" :flush="true">
        <template #extra>
          <button type="button" class="agri-detail-section-link" @click="emit('open-catalog')">
            前往服务商品审核 →
          </button>
        </template>
        <div style="padding: 14px 16px">
          <AgriAntdvListTable
            :columns="itemColumns"
            :data="itemRows"
            row-key="id"
            client-pagination
            column-settings-storage-key="service-ops:provider-detail-items"
            @refresh="emit('refresh')"
          >
            <template #toolbar-left>
              <div class="ops-table-caption">
                <b>服务商品与目录</b>
                <small>审核状态与近期选择量</small>
              </div>
            </template>
            <template #cell-price="{ record }">
              <span class="agri-detail-mono">¥{{ record.price }} / {{ record.unit }}</span>
            </template>
            <template #cell-auditStatus="{ record }">
              <a-tag :color="record.auditStatus === 'approved' ? 'green' : record.auditStatus === 'rejected' ? 'red' : 'orange'">
                {{ record.auditStatus === 'approved' ? '已通过' : record.auditStatus === 'rejected' ? '已驳回' : '待审核' }}
              </a-tag>
            </template>
            <template #cell-aiScore="{ record }">
              <span class="agri-detail-mono">{{ record.aiScore }} 分</span>
            </template>
            <template #cell-selectedCount="{ record }">
              <span class="agri-detail-mono">{{ record.selectedCount }} 人</span>
            </template>
          </AgriAntdvListTable>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'orders'">
      <AgriVueDetailSection title="全部最近履约订单" :flush="true">
        <template #extra>
          <button type="button" class="agri-detail-section-link" @click="emit('open-orders')">
            查看全量服务订单 →
          </button>
        </template>
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="orders"
          :locale="{ emptyText: '暂无最近履约订单' }"
          :columns="orderColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <span v-if="column.key === 'orderNo'" class="agri-detail-mono">{{ text }}</span>
            <a-tag
              v-else-if="column.key === 'status'"
              :class="`ops-status tone-${orderStatusMeta(String(text ?? '')).tone}`"
            >
              {{ orderStatusMeta(String(text ?? '')).label }}
            </a-tag>
            <span v-else-if="column.key === 'totalAmount'" class="agri-detail-mono">
              ¥{{ Number(text ?? 0).toLocaleString('zh-CN') }}
            </span>
            <span v-else-if="column.key === 'progress'" class="agri-detail-mono">{{ record.progress ?? 0 }}%</span>
            <span v-else-if="column.key === 'appointmentDate'" class="agri-detail-mono">{{ text || '—' }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="入驻与经营进度">
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
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
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
import type { VueListColumn } from '@agri/shared/vue/list'
import { ORDER_STATUS, PROVIDER_STATUS, type OpsProvider } from './api'

const props = defineProps<{
  provider: OpsProvider
  itemColumns: VueListColumn[]
  refreshing?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh'): void
  (e: 'open-catalog'): void
  (e: 'open-orders'): void
  (e: 'open-quality'): void
  (e: 'open-settlement'): void
  (e: 'open-status', nextStatus: string): void
}>()

const activeTab = ref('detail')

watch(() => props.provider.id, () => {
  activeTab.value = 'detail'
})

const RISK_LEVEL_MAP: Record<string, { label: string; tone: 'green' | 'orange' | 'red' }> = {
  low: { label: '低风险', tone: 'green' },
  normal: { label: '正常', tone: 'green' },
  safe: { label: '低风险', tone: 'green' },
  medium: { label: '中风险', tone: 'orange' },
  warn: { label: '关注风险', tone: 'orange' },
  warning: { label: '关注风险', tone: 'orange' },
  high: { label: '高风险', tone: 'red' },
  critical: { label: '严重风险', tone: 'red' },
  低风险: { label: '低风险', tone: 'green' },
  中风险: { label: '中风险', tone: 'orange' },
  高风险: { label: '高风险', tone: 'red' },
}

const orderColumns = [
  { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 170 },
  { title: '服务项目', dataIndex: 'serviceName', key: 'serviceName' },
  { title: '预约日期', dataIndex: 'appointmentDate', key: 'appointmentDate', width: 120 },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 80 },
  { title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 110, align: 'right' as const },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
]

const items = computed(() => props.provider.items ?? [])
const itemRows = computed(() => items.value as unknown as Record<string, unknown>[])
const orders = computed(() => props.provider.orders ?? [])
const recentOrderTotal = computed(() => orders.value.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0))

const riskMeta = computed(() => {
  const raw = String(props.provider.riskLevel || '').trim()
  if (!raw) return { label: '低风险', tone: 'green' as const }
  return RISK_LEVEL_MAP[raw] || RISK_LEVEL_MAP[raw.toLowerCase()] || { label: raw, tone: 'orange' as const }
})

const creditGradeLabel = computed(() => {
  const s = Number(props.provider.creditScore || 0)
  return s >= 90 ? 'A 级 · 优质' : s >= 75 ? 'B 级 · 正常' : 'C 级 · 关注风险'
})

const nextPrimaryStatus = computed(() => (props.provider.status === 'available' ? 'restricted' : 'available'))

const statusBadge = computed<DetailStatusBadge>(() => {
  const meta = PROVIDER_STATUS[props.provider.status] ?? { label: props.provider.status, tone: 'gray' }
  return { label: meta.label, tone: meta.tone }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const list: DetailStatusBadge[] = [{ label: riskMeta.value.label, tone: riskMeta.value.tone }]
  if (props.provider.badge) list.push({ label: props.provider.badge, tone: 'blue' })
  return list
})

const headerMeta = computed(() => [
  { label: '服务类目', value: props.provider.category || '—' },
  { label: '服务区域', value: props.provider.region || '—' },
  { label: '联系人', value: props.provider.contactName || '待补' },
  { label: '绑定主体', value: props.provider.merchantId || '未绑定' },
])

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '档案详情' },
  { key: 'items', label: '服务商品', count: items.value.length },
  { key: 'orders', label: '最近订单', count: orders.value.length },
])

const profileItems = computed<DetailInfoGridItem[]>(() => [
  { key: 'creditCode', label: '信用代码', value: props.provider.creditCode || '待补充', mono: Boolean(props.provider.creditCode) },
  { key: 'category', label: '主营品类', value: props.provider.category || '—' },
  { key: 'region', label: '所在区域', value: props.provider.region || '—' },
  { key: 'serviceArea', label: '服务覆盖', value: props.provider.serviceArea || props.provider.region || '—' },
  { key: 'creditGrade', label: '信用等级', value: `${creditGradeLabel.value}（${props.provider.creditScore} 分）` },
  { key: 'riskLevel', label: '风险等级', value: riskMeta.value.label },
  { key: 'cancelRate', label: '接单取消率', value: `${props.provider.cancelRate}%`, mono: true },
  { key: 'merchantId', label: '平台主体', value: props.provider.merchantId || '未绑定', mono: Boolean(props.provider.merchantId) },
  { key: 'contactName', label: '联系人', value: props.provider.contactName || '待补' },
  { key: 'contactPhone', label: '联系电话', value: props.provider.contactPhone || '待补', mono: Boolean(props.provider.contactPhone) },
  { key: 'price', label: '指导价格', value: `¥${props.provider.price} / ${props.provider.unit}`, mono: true },
  { key: 'createdAt', label: '入驻时间', value: props.provider.createdAt ? String(props.provider.createdAt).replace('T', ' ').slice(0, 16) : '—', mono: true },
  { key: 'auditReason', label: '审核备注', value: props.provider.auditReason || '—', fullWidth: true },
])

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const p = props.provider
  const isPending = p.status === 'pending'
  const isNormal = p.status === 'available'
  const isBad = p.status === 'frozen' || p.status === 'removed'
  const hasBound = Boolean(p.merchantId)
  const approvedItems = items.value.filter((i) => i.auditStatus === 'approved').length
  return [
    {
      key: 'apply',
      title: '服务商入驻建档',
      time: p.createdAt ? String(p.createdAt).replace('T', ' ').slice(0, 16) : undefined,
      description: `${p.category} · ${p.region}`,
      state: 'done',
    },
    {
      key: 'audit',
      title: isPending ? '等待入驻审核' : isBad ? `已处置（${statusBadge.value.label}）` : '资质审核已通过',
      description: p.auditReason || (isPending ? '请核验资质并完成审核' : '已纳入平台服务商名录'),
      state: isPending ? 'current' : isBad ? 'error' : 'done',
    },
    {
      key: 'bind',
      title: hasBound ? `已绑定平台主体 ${p.merchantId}` : '尚未绑定平台主体',
      description: hasBound ? '可通过服务商移动端工作台接单履约' : '绑定主体后方可登录服务商工作台',
      state: hasBound ? 'done' : 'current',
    },
    {
      key: 'operate',
      title: isNormal
        ? `正常履约中（${approvedItems} 项在售商品 · ${p.orderCount} 单）`
        : `当前状态：${statusBadge.value.label}`,
      description: `信用分 ${p.creditScore} · 风险等级 ${riskMeta.value.label}`,
      state: isNormal ? 'done' : isBad ? 'error' : 'current',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => [
  {
    key: 'catalog',
    label: '服务商品审核',
    text: `${items.value.length} 项服务商品`,
    mono: false,
    badge: `${items.value.filter((i) => i.auditStatus === 'approved').length} 已上架`,
    badgeTone: 'green',
    clickable: true,
    onClick: () => emit('open-catalog'),
  },
  {
    key: 'orders',
    label: '全量服务订单',
    text: `累计 ${props.provider.orderCount} 单`,
    mono: false,
    clickable: true,
    onClick: () => emit('open-orders'),
  },
  {
    key: 'quality',
    label: '质量与评价预警',
    text: '查看预警与评分',
    mono: false,
    badge: riskMeta.value.label,
    badgeTone: riskMeta.value.tone,
    clickable: true,
    onClick: () => emit('open-quality'),
  },
  {
    key: 'settlement',
    label: '结算与分账批次',
    text: '查看结算概况',
    mono: false,
    clickable: true,
    onClick: () => emit('open-settlement'),
  },
])

function orderStatusMeta(status: string) {
  return ORDER_STATUS[status] ?? { label: status, tone: 'gray' }
}

function printPage() {
  window.print()
}
</script>
