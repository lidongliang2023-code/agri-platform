<template>
  <EmptyState v-if="!app.id" title="缺少订单编号">
    <template #action>
      <a-button @click="app.navigate('orders')">返回订单</a-button>
    </template>
  </EmptyState>
  <LoadingBlock v-else-if="!order && !error" :rows="5" />
  <EmptyState v-else-if="!order" icon="📡" title="订单加载失败" :description="error">
    <template #action>
      <a-button @click="app.navigate('orders')">返回订单</a-button>
    </template>
  </EmptyState>
  <div v-else class="page-stack">
    <button type="button" class="back-link" @click="app.navigate('orders')">← 返回订单列表</button>
    <section class="order-detail-hero">
      <div>
        <span class="order-kicker">ORDER DETAIL</span>
        <h1>{{ order.serviceName }}</h1>
        <p>{{ order.orderNo }} · {{ order.providerName }}</p>
      </div>
      <div class="order-detail-status">
        <StatusTag :status="order.status" />
        <b>{{ order.progress }}%</b>
        <small>{{ order.status === 'in_progress' ? '现场作业中' : order.status === 'completed' ? '服务已完成' : '履约进度' }}</small>
      </div>
    </section>

    <div class="order-detail-layout">
      <div class="order-detail-main">
        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">LIVE PROGRESS</span><h2>服务动态</h2></div>
            <span class="live-label"><i /> 实时更新</span>
          </div>
          <div class="timeline">
            <div v-for="(event, index) in timeline" :key="`${event.title}-${index}`" class="timeline-item" :class="{ done: event.completed }">
              <span class="timeline-dot">
                <CheckCircleFilled v-if="event.completed" />
                <template v-else>{{ index + 1 }}</template>
              </span>
              <div><b>{{ event.title }}</b><p>{{ event.note }}</p><small>{{ event.eventTime }}</small></div>
            </div>
          </div>
        </section>

        <section v-if="order.status === 'in_progress'" class="surface-card quality-monitor">
          <div class="section-heading compact">
            <div><span class="section-kicker">PROGRESS REPORT</span><h2>服务商进度上报</h2></div>
            <span class="quality-score">{{ order.progress }}<small>%</small></span>
          </div>
          <div class="quality-grid">
            <div><span>服务数量</span><b>{{ order.quantity }} {{ order.unit }}</b><MiniProgress :value="order.progress" /></div>
            <div><span>最新上报</span><b>{{ latestReport?.title ?? '暂无上报' }}</b><small>{{ latestReport?.note ?? '服务商在移动工作台上报后，这里会同步' }}</small></div>
            <div><span>上报时间</span><b>{{ latestReport?.eventTime ?? '—' }}</b><small>进度只前进不回退</small></div>
            <div><span>验收方式</span><b>由你确认</b><small class="good">确认验收后释放尾款</small></div>
          </div>
        </section>

        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">ORDER INFORMATION</span><h2>预约与费用</h2></div>
          </div>
          <div class="info-table">
            <span><small>服务地点</small><b><EnvironmentOutlined /> {{ order.location }}</b></span>
            <span><small>预约时间</small><b><ClockCircleOutlined /> {{ order.appointmentDate }} {{ order.appointmentSlot }}</b></span>
            <span><small>服务数量</small><b>{{ order.quantity }} {{ order.unit }}</b></span>
            <span><small>联系人</small><b>{{ order.contactName }} · {{ order.contactPhone }}</b></span>
            <span><small>订单总额</small><b><Money :value="order.totalAmount" /></b></span>
            <span><small>已付定金</small><b><Money :value="order.depositAmount" /></b></span>
          </div>
          <div v-if="order.notes" class="order-note"><b>补充要求</b><p>{{ order.notes }}</p></div>
        </section>
      </div>

      <aside class="order-detail-aside">
        <section class="surface-card provider-summary">
          <span class="provider-summary-icon">{{ order.providerName.slice(0, 1) }}</span>
          <h3>{{ order.providerName }}</h3>
          <p>平台认证 · 履约保障</p>
          <a-button block @click="app.navigate('contracts')">
            <template #icon><FileProtectOutlined /></template>
            查看服务合同要素
          </a-button>
          <p class="muted-copy">平台不在订单页下发双方号码；服务商在工作台接单后可见你预留的联系号码，问题请走「售后服务」由平台受理。</p>
        </section>
        <section class="surface-card safety-summary">
          <SafetyCertificateOutlined />
          <div><b>平台担保交易</b><p>尾款将在验收通过后结算；如服务不符，可发起售后并申请平台介入。</p></div>
        </section>
        <section class="surface-card action-stack">
          <a-button v-if="order.status === 'pending_payment'" type="primary" size="large" block :loading="busy" @click="updateStatus('confirmed')">确认预约（不扣款）</a-button>
          <div v-if="order.status === 'confirmed'" class="booking-form-tip">预约已确认，等待服务商安排作业并上报进度。</div>
          <a-button v-if="order.status === 'in_progress' && order.progress >= 100" type="primary" size="large" block :loading="busy" @click="updateStatus('completed')">作业完成，确认验收</a-button>
          <a-button v-if="order.status === 'completed' && !order.rating" type="primary" size="large" block @click="reviewOpen = true">评价本次服务</a-button>
          <div v-if="order.rating" class="reviewed-box"><span>{{ '★'.repeat(order.rating) }}</span><p>{{ order.review }}</p></div>
          <a-button block @click="complaintOpen = true">售后服务</a-button>
          <a-button v-if="!['completed', 'cancelled'].includes(order.status)" danger block :loading="busy" @click="updateStatus('cancelled')">取消订单</a-button>
        </section>
      </aside>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircleFilled, ClockCircleOutlined, EnvironmentOutlined, FileProtectOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { ServiceOrder } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import MiniProgress from '../components/MiniProgress.vue'
import Money from '../components/Money.vue'
import StatusTag from '../components/StatusTag.vue'

const app = useAppStore()
const order = ref<ServiceOrder | null>(null)
const error = ref('')
const busy = ref(false)
const reviewOpen = ref(false)
const complaintOpen = ref(false)
const rating = ref(5)
const review = ref('')
const complaint = ref('')

const timeline = computed(() => order.value?.timeline ?? [])
const latestReport = computed(() => [...timeline.value].reverse().find((event) => event.title === '服务商上报进度'))

watch(() => app.id, (id) => {
  if (!id) return
  order.value = null
  error.value = ''
  serviceApi.order(id).then((data) => { order.value = data }).catch((reason: Error) => { error.value = reason.message })
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
</script>
