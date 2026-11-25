<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="MY SERVICES"
      title="我的服务订单"
      description="从预约确认、现场作业到验收结算，每一步都有记录。"
    >
      <template #actions>
        <a-button type="primary" @click="app.navigate('demand')">+ 发布服务需求</a-button>
      </template>
    </PageTitle>

    <section class="surface-card order-filter">
      <div class="order-tabs">
        <button v-for="tab in TABS" :key="tab.key" type="button" :class="{ on: status === tab.key }" @click="status = tab.key">
          {{ tab.label }}
        </button>
      </div>
      <div class="inline-search">
        <a-input v-model:value="keyword" allow-clear placeholder="搜索订单号、服务或服务商" @press-enter="load">
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-button @click="load">查询</a-button>
      </div>
    </section>

    <LoadingBlock v-if="loading" :rows="3" />
    <EmptyState v-else-if="orders.length === 0" icon="📋" title="当前筛选下没有订单" description="您可以调整订单状态，或去服务超市寻找合适的服务。">
      <template #action>
        <a-button type="primary" @click="app.navigate('services')">去服务超市</a-button>
      </template>
    </EmptyState>
    <div v-else class="order-list">
      <article v-for="order in orders" :key="order.id" class="order-card surface-card">
        <header>
          <div>
            <span class="order-category">{{ order.category }}</span>
            <b>{{ order.serviceName }}</b>
            <small>{{ order.orderNo }} · {{ order.createdAt }}</small>
          </div>
          <StatusTag :status="order.status" />
        </header>
        <div class="order-card-body">
          <div class="order-provider">
            <span>{{ order.providerName.slice(0, 1) }}</span>
            <div><b>{{ order.providerName }}</b><small>平台认证服务商</small></div>
          </div>
          <div class="order-info-grid">
            <span><CalendarOutlined /><small>预约</small><b>{{ order.appointmentDate }} {{ order.appointmentSlot }}</b></span>
            <span><EnvironmentOutlined /><small>服务地点</small><b>{{ order.location }}</b></span>
            <span><ClockCircleOutlined /><small>服务进度</small><b>{{ order.progress }}%</b></span>
          </div>
          <div class="order-amount"><small>订单金额</small><Money :value="order.totalAmount" /></div>
        </div>
        <div v-if="order.status === 'in_progress'" class="order-progress-strip">
          <MiniProgress :value="order.progress" /><span>服务商正在作业，预计今天 18:00 前完成</span>
        </div>
        <footer>
          <span>{{ order.quantity }} {{ order.unit }} × ¥{{ order.unitPrice }}</span>
          <div>
            <a-button @click="app.navigate('order-detail', order.id)">查看详情</a-button>
            <a-button v-if="order.status === 'completed' && !order.rating" type="primary" @click="reviewTarget = order">去评价</a-button>
            <a-button v-if="order.status === 'in_progress'" type="primary" @click="app.navigate('order-detail', order.id)">查看进度</a-button>
          </div>
        </footer>
      </article>
    </div>

    <a-modal :open="Boolean(reviewTarget)" title="服务评价" :confirm-loading="submitting" ok-text="提交评价" @cancel="reviewTarget = null" @ok="submitReview">
      <div v-if="reviewTarget" class="review-form">
        <div class="review-order-summary">
          <span>{{ reviewTarget.serviceName }}</span><small>{{ reviewTarget.providerName }} · {{ reviewTarget.orderNo }}</small>
        </div>
        <label>服务评分</label>
        <a-rate v-model:value="rating" />
        <label>服务体验</label>
        <a-textarea v-model:value="review" :rows="4" placeholder="说说作业质量、服务时效与价格透明情况…" />
        <div class="booking-form-tip">评价将进行真实性校验，并可公开展示给其他用户。</div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { ServiceOrder } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import MiniProgress from '../components/MiniProgress.vue'
import Money from '../components/Money.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'

const TABS = [
  { key: 'all', label: '全部订单' },
  { key: 'pending_payment', label: '待确认预约' },
  { key: 'confirmed', label: '待服务' },
  { key: 'in_progress', label: '服务中' },
  { key: 'completed', label: '待评价/已完成' },
  { key: 'cancelled', label: '已取消' },
]

const app = useAppStore()
const orders = ref<ServiceOrder[]>([])
const status = ref('all')
const keyword = ref('')
const loading = ref(true)
const reviewTarget = ref<ServiceOrder | null>(null)
const rating = ref(5)
const review = ref('')
const submitting = ref(false)

function load() {
  loading.value = true
  serviceApi.orders({ status: status.value === 'all' ? undefined : status.value, keyword: keyword.value || undefined })
    .then((rows) => { orders.value = rows })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { loading.value = false })
}

watch([status, () => app.page], () => {
  load()
}, { immediate: true })

async function submitReview() {
  if (!reviewTarget.value) return
  submitting.value = true
  try {
    await serviceApi.reviewOrder(reviewTarget.value.id, { rating: rating.value, review: review.value })
    message.success('评价已提交，感谢您的真实反馈')
    reviewTarget.value = null
    review.value = ''
    load()
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '评价提交失败')
  } finally {
    submitting.value = false
  }
}
</script>
