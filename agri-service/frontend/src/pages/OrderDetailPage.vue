<template>
  <EmptyState v-if="!app.id" title="缺少订单编号">
    <template #action>
      <a-button @click="app.navigate('orders')">返回订单列表</a-button>
    </template>
  </EmptyState>
  <LoadingBlock v-else-if="!order && !error" :rows="6" />
  <EmptyState v-else-if="!order" icon="📡" title="订单加载失败" :description="error">
    <template #action>
      <a-button @click="app.navigate('orders')">返回订单列表</a-button>
    </template>
  </EmptyState>
  <AgriVueDetailLayout
    v-else
    :code="order.orderNo || `SO-${order.id}`"
    :title="order.serviceName"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回我的订单"
    @back="app.navigate('orders')"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="reloadOrder">刷新</a-button>
      <a-button @click="complaintOpen = true">售后服务</a-button>
      <a-popconfirm
        v-if="!['completed', 'cancelled'].includes(order.status)"
        title="确认取消该服务订单？"
        description="取消后档期将释放，如需服务需重新预约。"
        ok-text="确认取消"
        cancel-text="再想想"
        @confirm="updateStatus('cancelled')"
      >
        <a-button danger :loading="busy">取消订单</a-button>
      </a-popconfirm>
      <a-button
        v-if="order.status === 'pending_payment'"
        type="primary"
        :loading="busy"
        @click="updateStatus('confirmed')"
      >
        确认预约
      </a-button>
      <a-button
        v-else-if="order.status === 'in_progress' && order.progress >= 100"
        type="primary"
        :loading="busy"
        @click="updateStatus('completed')"
      >
        确认验收
      </a-button>
      <a-button
        v-else-if="order.status === 'completed' && !order.rating"
        type="primary"
        @click="reviewOpen = true"
      >
        评价服务
      </a-button>
    </template>

    <template v-if="order.status === 'confirmed'" #banner>
      <a-alert
        type="info"
        show-icon
        message="预约已确认，等待服务商安排作业并上报进度"
        description="服务商到场并完成作业上报至 100% 后，可在右上角点击「确认验收」释放尾款。"
      />
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="预约与基本信息">
        <AgriVueDetailInfoGrid :items="baseItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="联系与现场要求">
        <AgriVueDetailInfoGrid :items="contactItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="服务与费用明细" :flush="true">
        <template #extra>
          <button type="button" class="agri-detail-section-link" @click="activeTab = 'items'">
            查看费用说明 →
          </button>
        </template>
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="serviceRows"
          :columns="serviceColumns"
        >
          <template #bodyCell="{ column, text }">
            <span v-if="column.key === 'unitPrice' || column.key === 'depositAmount' || column.key === 'totalAmount'" class="agri-detail-mono">
              ¥{{ formatMoney(Number(text ?? 0)) }}
            </span>
            <span v-else-if="column.key === 'quantity'" class="agri-detail-mono">{{ text }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
        <template #footer>
          <span>
            已付定金 <strong class="agri-detail-mono">¥{{ formatMoney(order.depositAmount) }}</strong>
            · 待结尾款 <strong class="agri-detail-mono">¥{{ formatMoney(balanceAmount) }}</strong>
            · 订单总额 <strong class="agri-detail-mono" style="color: #2d8f4e; font-size: 15px">¥{{ formatMoney(order.totalAmount) }}</strong>
          </span>
        </template>
      </AgriVueDetailSection>

      <AgriVueDetailSection v-if="order.rating" title="服务评价">
        <div class="svc-reviewed-box">
          <strong class="svc-review-stars">{{ '★'.repeat(order.rating) }}（{{ order.rating }} 分）</strong>
          <p>{{ order.review || '已给出评分，未填写文字评价。' }}</p>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'items'">
      <AgriVueDetailSection title="服务项目明细" :flush="true">
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="serviceRows"
          :columns="serviceColumns"
        >
          <template #bodyCell="{ column, text }">
            <span v-if="column.key === 'unitPrice' || column.key === 'depositAmount' || column.key === 'totalAmount'" class="agri-detail-mono">
              ¥{{ formatMoney(Number(text ?? 0)) }}
            </span>
            <span v-else-if="column.key === 'quantity'" class="agri-detail-mono">{{ text }}</span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
        <template #footer>
          <span>订单总额 <strong class="agri-detail-mono">¥{{ formatMoney(order.totalAmount) }}</strong></span>
        </template>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="费用与结算说明">
        <AgriVueDetailInfoGrid :items="feeItems" />
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'progress'">
      <AgriVueDetailSection v-if="order.status === 'in_progress'" title="服务商进度上报概况">
        <div class="agri-detail-kpi-strip">
          <div class="agri-detail-kpi-cell">
            <span>当前进度</span>
            <strong>{{ order.progress }}%</strong>
            <small>进度只前进不回退</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>作业量</span>
            <strong>{{ order.quantity }} {{ order.unit }}</strong>
            <small>{{ order.category || '综合服务' }}</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>最新节点</span>
            <strong>{{ latestReport?.title ?? '等待上报' }}</strong>
            <small>{{ latestReport?.eventTime ?? '—' }}</small>
          </div>
          <div class="agri-detail-kpi-cell">
            <span>验收方式</span>
            <strong>用户确认</strong>
            <small>确认验收后释放尾款</small>
          </div>
        </div>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="履约动态明细" :flush="true">
        <a-table
          row-key="key"
          size="small"
          :pagination="false"
          :data-source="timelineRows"
          :locale="{ emptyText: '暂无服务动态记录' }"
          :columns="timelineColumns"
        >
          <template #bodyCell="{ column, text }">
            <span v-if="column.key === 'eventTime'" class="agri-detail-mono">{{ text || '—' }}</span>
            <span v-else-if="column.key === 'completed'" class="agri-detail-status-pill" :class="text ? 'is-green' : 'is-gray'">
              {{ text ? '已完成' : '待处理' }}
            </span>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'guarantee'">
      <AgriVueDetailSection title="服务评价与担保保障">
        <AgriVueDetailInfoGrid :items="guaranteeItems" />
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="订单履约进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联单据与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>

  <a-modal v-model:open="reviewOpen" title="评价服务" :confirm-loading="busy" ok-text="提交评价" @ok="submitReview">
    <div class="review-form">
      <label>服务评分</label>
      <a-rate v-model:value="rating" />
      <label>服务体验</label>
      <a-textarea v-model:value="review" :rows="4" placeholder="评价将帮助下一位用户做出选择…" />
    </div>
  </a-modal>

  <a-modal v-model:open="complaintOpen" title="发起售后 / 投诉" :confirm-loading="busy" ok-text="提交投诉" @ok="submitComplaint">
    <div class="review-form">
      <label>问题描述</label>
      <a-textarea v-model:value="complaint" :rows="5" placeholder="请说明问题、发生时间与期望处理方式" />
      <div class="booking-form-tip">投诉会创建一张归属本主体的工单，平台受理与处理结论都在「售后与投诉」页可查。</div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
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
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { ServiceOrder } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import { ORDER_STATUS, formatMoney } from '../components/ui-constants'

const app = useAppStore()
const order = ref<ServiceOrder | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const reviewOpen = ref(false)
const complaintOpen = ref(false)
const rating = ref(5)
const review = ref('')
const complaint = ref('')
const activeTab = ref('detail')

const serviceColumns = [
  { title: '服务名称', dataIndex: 'serviceName', key: 'serviceName' },
  { title: '服务分类', dataIndex: 'category', key: 'category', width: 120 },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 110, align: 'right' as const },
  { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 110, align: 'right' as const },
  { title: '定金', dataIndex: 'depositAmount', key: 'depositAmount', width: 110, align: 'right' as const },
  { title: '小计', dataIndex: 'totalAmount', key: 'totalAmount', width: 120, align: 'right' as const },
]

const timelineColumns = [
  { title: '节点名称', dataIndex: 'title', key: 'title', width: 170 },
  { title: '动态说明', dataIndex: 'note', key: 'note' },
  { title: '记录时间', dataIndex: 'eventTime', key: 'eventTime', width: 160 },
  { title: '状态', dataIndex: 'completed', key: 'completed', width: 100 },
]

const timeline = computed(() => order.value?.timeline ?? [])
const timelineRows = computed(() =>
  timeline.value.map((event, index) => ({
    key: `${event.title}-${index}`,
    title: event.title,
    note: event.note,
    eventTime: event.eventTime,
    completed: event.completed,
  })),
)
const latestReport = computed(() => [...timeline.value].reverse().find((event) => event.title === '服务商上报进度'))
const balanceAmount = computed(() => Math.max(0, Number(order.value?.totalAmount || 0) - Number(order.value?.depositAmount || 0)))

const serviceRows = computed(() => {
  const o = order.value
  if (!o) return []
  return [{
    id: o.id,
    serviceName: o.serviceName,
    category: o.category || '综合服务',
    quantity: `${o.quantity} ${o.unit}`,
    unitPrice: o.unitPrice,
    depositAmount: o.depositAmount,
    totalAmount: o.totalAmount,
  }]
})

const statusBadge = computed<DetailStatusBadge>(() => {
  const raw = order.value?.status || ''
  const meta = ORDER_STATUS[raw] ?? { label: raw || '未知状态', tone: 'gray' }
  return { label: meta.label, tone: meta.tone }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const o = order.value
  if (!o) return []
  const badges: DetailStatusBadge[] = [
    { label: `履约进度 ${o.progress ?? 0}%`, tone: o.progress >= 100 ? 'green' : o.status === 'cancelled' ? 'gray' : 'blue' },
  ]
  if (o.category) badges.push({ label: o.category, tone: 'gray' })
  return badges
})

const headerMeta = computed(() => {
  const o = order.value
  if (!o) return []
  return [
    { label: '服务商', value: o.providerName },
    { label: '预约时间', value: `${o.appointmentDate} ${o.appointmentSlot}`.trim() },
    { label: '订单总额', value: `¥${formatMoney(o.totalAmount)}` },
    { label: '下单时间', value: o.createdAt ? String(o.createdAt).replace('T', ' ').slice(0, 16) : '—' },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '订单详情' },
  { key: 'items', label: '服务与费用', count: serviceRows.value.length },
  { key: 'progress', label: '履约动态', count: timeline.value.length },
  { key: 'guarantee', label: '评价与保障' },
])

const baseItems = computed<DetailInfoGridItem[]>(() => {
  const o = order.value
  if (!o) return []
  return [
    { key: 'orderNo', label: '订单编号', value: o.orderNo, mono: true },
    { key: 'category', label: '服务类目', value: o.category || '综合服务' },
    { key: 'provider', label: '服务商', value: o.providerName },
    { key: 'status', label: '当前状态', value: statusBadge.value.label },
    { key: 'appointment', label: '预约时间', value: `${o.appointmentDate || '—'} ${o.appointmentSlot || ''}`.trim(), mono: true },
    { key: 'quantity', label: '服务数量', value: `${o.quantity} ${o.unit}`, mono: true },
    { key: 'createdAt', label: '下单时间', value: o.createdAt ? String(o.createdAt).replace('T', ' ').slice(0, 16) : '—', mono: true },
    { key: 'progress', label: '履约进度', value: `${o.progress ?? 0}%`, mono: true },
  ]
})

const contactItems = computed<DetailInfoGridItem[]>(() => {
  const o = order.value
  if (!o) return []
  return [
    { key: 'contactName', label: '联系人', value: o.contactName || '—' },
    { key: 'contactPhone', label: '联系电话', value: o.contactPhone || '—', mono: Boolean(o.contactPhone) },
    { key: 'location', label: '服务地点', value: o.location || '—', fullWidth: true },
    { key: 'notes', label: '补充要求', value: o.notes || '无特殊补充要求', fullWidth: true },
  ]
})

const feeItems = computed<DetailInfoGridItem[]>(() => {
  const o = order.value
  if (!o) return []
  return [
    { key: 'unitPrice', label: '服务单价', value: `¥${formatMoney(o.unitPrice)} / ${o.unit}`, mono: true },
    { key: 'quantity', label: '预约数量', value: `${o.quantity} ${o.unit}`, mono: true },
    { key: 'total', label: '订单总额', value: `¥${formatMoney(o.totalAmount)}`, mono: true },
    { key: 'deposit', label: '已付定金', value: `¥${formatMoney(o.depositAmount)}`, mono: true },
    { key: 'balance', label: '待结尾款', value: `¥${formatMoney(balanceAmount.value)}`, mono: true },
    { key: 'settleRule', label: '结算规则', value: '平台担保交易，验收通过后释放尾款' },
  ]
})

const guaranteeItems = computed<DetailInfoGridItem[]>(() => {
  const o = order.value
  if (!o) return []
  return [
    { key: 'provider', label: '承接服务商', value: `${o.providerName}（平台认证 · 履约保障）` },
    { key: 'guarantee', label: '担保方式', value: '平台担保交易，验收通过后按结算批次释放尾款' },
    { key: 'rating', label: '服务评分', value: o.rating ? `${'★'.repeat(o.rating)}（${o.rating} 分）` : '尚未评价' },
    { key: 'privacy', label: '隐私保护', value: '平台不在订单页下发双方号码，服务商接单后可见预留号码' },
    { key: 'review', label: '评价内容', value: o.review || '暂未填写服务评价', fullWidth: true },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const o = order.value
  if (!o) return []
  const list = timeline.value
  if (list.length > 0) {
    let currentAssigned = false
    return list.map((event, idx) => {
      let state: DetailTimelineStep['state'] = 'pending'
      if (o.status === 'cancelled' && idx === list.length - 1) {
        state = 'error'
      } else if (event.completed) {
        state = 'done'
      } else if (!currentAssigned && o.status !== 'cancelled') {
        state = 'current'
        currentAssigned = true
      }
      return {
        key: `${event.title}-${idx}`,
        title: event.title,
        time: event.eventTime || undefined,
        description: event.note || undefined,
        state,
      }
    })
  }
  const s = o.status
  return [
    { key: 'created', title: '服务预约已提交', time: o.createdAt, state: 'done' },
    { key: 'confirmed', title: '预约确认与档期锁定', state: s === 'pending_payment' ? 'current' : s === 'cancelled' ? 'error' : 'done' },
    { key: 'working', title: '服务商到场履约', description: `当前进度 ${o.progress ?? 0}%`, state: s === 'in_progress' ? 'current' : s === 'completed' ? 'done' : 'pending' },
    { key: 'completed', title: s === 'cancelled' ? '订单已取消' : '验收完成并结算尾款', state: s === 'completed' ? 'done' : s === 'cancelled' ? 'error' : 'pending' },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const o = order.value
  if (!o) return []
  return [
    {
      key: 'provider',
      label: '承接服务商',
      text: o.providerName,
      mono: false,
      badge: '平台认证',
      badgeTone: 'green',
      clickable: Boolean(o.providerId),
      onClick: () => { if (o.providerId) app.navigate('provider', o.providerId) },
    },
    {
      key: 'contract',
      label: '服务合同要素',
      text: '查看履约条款',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('contracts'),
    },
    {
      key: 'complaint',
      label: '售后与投诉',
      text: '发起或跟进工单',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('complaints'),
    },
    {
      key: 'orders',
      label: '我的服务订单',
      text: '返回全部订单',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('orders'),
    },
  ]
})

async function reloadOrder() {
  if (!app.id) return
  loading.value = true
  error.value = ''
  try {
    order.value = await serviceApi.order(app.id)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '订单加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => app.id, (id) => {
  activeTab.value = 'detail'
  if (!id) return
  order.value = null
  void reloadOrder()
}, { immediate: true })

async function updateStatus(status: string) {
  if (!order.value) return
  busy.value = true
  try {
    order.value = await serviceApi.updateOrder(order.value.id, { status })
    const done: Record<string, string> = {
      confirmed: '定金已支付，档期锁定，等待服务商到场',
      completed: '已确认验收，尾款按结算批次释放',
      cancelled: '订单已取消',
    }
    message.success(done[status] ?? '订单状态已更新')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '操作失败')
  } finally {
    busy.value = false
  }
}

async function submitReview() {
  if (!order.value) return
  busy.value = true
  try {
    order.value = await serviceApi.reviewOrder(order.value.id, { rating: rating.value, review: review.value })
    reviewOpen.value = false
    message.success('评价已提交')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '评价提交失败')
  } finally {
    busy.value = false
  }
}

async function submitComplaint() {
  if (!order.value) return
  busy.value = true
  try {
    await serviceApi.createComplaint({
      orderNo: order.value.orderNo,
      category: '服务履约',
      description: complaint.value,
      demand: '请平台协调服务商完成整改',
    })
    complaintOpen.value = false
    message.success('投诉工单已创建，可在「售后与投诉」跟进')
    app.navigate('complaints')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '投诉提交失败')
  } finally {
    busy.value = false
  }
}

function printPage() {
  window.print()
}
</script>

<style scoped>
.svc-reviewed-box {
  padding: 12px 14px;
  border-radius: 8px;
  background: #f6fbf8;
  border: 1px solid #dfeee4;
}

.svc-review-stars {
  display: block;
  color: #d48806;
  font-size: 14px;
  margin-bottom: 4px;
}

.svc-reviewed-box p {
  margin: 0;
  color: #36453d;
  font-size: 13px;
  line-height: 1.65;
}
</style>
