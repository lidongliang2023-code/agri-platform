<template>
  <EmptyState v-if="!app.id" title="缺少服务商编号" description="请从服务超市重新选择服务商。">
    <template #action>
      <a-button @click="app.navigate('services')">返回服务超市</a-button>
    </template>
  </EmptyState>
  <LoadingBlock v-else-if="!provider && !error" :rows="4" />
  <EmptyState v-else-if="!provider" icon="🛠️" title="服务商资料加载失败" :description="error">
    <template #action>
      <a-button @click="app.navigate('services')">返回服务超市</a-button>
    </template>
  </EmptyState>
  <div v-else class="page-stack provider-page">
    <button type="button" class="back-link" @click="app.navigate('services')">← 返回服务超市</button>

    <section class="provider-hero">
      <div class="provider-hero-main">
        <span class="provider-hero-icon">{{ provider.categoryIcon }}</span>
        <div>
          <div class="hero-provider-badges">
            <span class="verified-badge"><SafetyCertificateOutlined /> 平台认证</span>
            <span class="level-badge">{{ provider.badge }}</span>
          </div>
          <h1>{{ provider.name }}</h1>
          <p>{{ provider.description }}</p>
          <div class="provider-hero-meta">
            <span class="rating"><StarFilled /> {{ provider.rating }}<small> · {{ provider.orderCount }} 单服务</small></span>
            <span><EnvironmentOutlined /> {{ provider.region }}</span>
            <span><ClockCircleOutlined /> 平均 {{ provider.responseMinutes }} 分钟响应</span>
          </div>
        </div>
      </div>
      <div class="provider-hero-price">
        <small>{{ selectedItem?.name ?? provider.category }}</small>
        <Money :value="provider.price" :suffix="provider.unit.replace('元/', '')" />
        <span>平台担保 · 验收后结算</span>
      </div>
    </section>

    <div class="provider-detail-layout">
      <div class="provider-detail-main">
        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">SERVICE ITEMS</span><h2>服务项目与价格</h2></div>
            <span class="section-note">明码标价，无隐藏费用</span>
          </div>
          <div class="service-item-table">
            <div v-for="item in bookableItems" :key="item.id" class="service-item-row">
              <div>
                <h3>{{ item.name }}<span>{{ item.duration }}</span></h3>
                <p>{{ item.description }}</p>
                <small>近 30 天 {{ item.selectedCount }} 人选择</small>
              </div>
              <Money :value="item.price" :suffix="item.unit.replace('元/', '')" />
              <a-button type="primary" ghost @click="openBooking(item.name)">立即预约</a-button>
            </div>
          </div>
        </section>

        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">QUALIFICATION</span><h2>资质与履约保障</h2></div>
          </div>
          <div class="cert-grid">
            <div v-for="item in provider.certifications" :key="item">
              <CheckCircleFilled /><span><b>{{ item }}</b><small>服务商申报资质，入驻审核时由平台查验</small></span>
            </div>
            <div><CheckCircleFilled /><span><b>平台担保交易</b><small>定金托管，验收通过后释放尾款</small></span></div>
            <div><CheckCircleFilled /><span><b>服务过程留痕</b><small>订单动态、进度上报与评价可回溯</small></span></div>
          </div>
        </section>

        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">FIELD DIARY</span><h2>服务商公布的档期</h2></div>
            <span class="section-note">档期由服务商在工作台维护，未同步时以服务商确认为准</span>
          </div>
          <p v-if="provider.availableSlots.length === 0" class="muted-copy">该服务商暂未公布可约档期。</p>
          <div v-else class="slot-grid">
            <button v-for="slot in provider.availableSlots" :key="slot" type="button" @click="openBooking()">
              <span>{{ slot }}</span><small>选择后进入预约</small>
            </button>
          </div>
        </section>

        <section class="surface-card detail-section">
          <div class="section-heading compact">
            <div><span class="section-kicker">REVIEWS</span><h2>真实服务评价</h2></div>
            <span class="rating-summary"><b>{{ provider.rating }}</b> / 5.0</span>
          </div>
          <div class="review-list">
            <p v-if="reviews.length === 0" class="muted-copy">还没有可展示的评价，完成首单后可发表真实体验。</p>
            <article v-for="review in reviews" :key="review.orderNo" class="review-row">
              <span class="review-avatar">{{ provider.name.slice(0, 1) }}</span>
              <div>
                <div class="review-head"><b>{{ review.serviceName }}</b><span>{{ '★'.repeat(review.rating) }}</span></div>
                <p>{{ review.review }}</p>
                <small>{{ review.appointmentDate }} · 订单已验收</small>
              </div>
            </article>
          </div>
        </section>
      </div>

      <aside class="provider-detail-aside">
        <section class="booking-card">
          <span class="booking-kicker">立即预约</span>
          <h3>让服务按时到田</h3>
          <div class="booking-row"><span>最早可约</span><b>{{ provider.availableSlots[0] ?? '暂未公布' }}</b></div>
          <div class="booking-row"><span>服务区域</span><b>{{ provider.region }}</b></div>
          <div class="booking-row"><span>当前状态</span><b>{{ provider.status === 'available' ? '可接单' : provider.status }}</b></div>
          <a-button type="primary" size="large" block :disabled="provider.status !== 'available'" @click="openBooking()">
            {{ provider.status === 'available' ? '选择服务并预约' : '该服务商暂停接单' }}
          </a-button>
          <a-button size="large" block @click="toggleFavorite">
            <template #icon><HeartFilled v-if="favorite" /><HeartOutlined v-else /></template>
            {{ favorite ? '已收藏' : '收藏服务商' }}
          </a-button>
          <p class="muted-copy">未下单前平台不公开双方号码；预约提交后，服务商会看到你填写的联系号码。</p>
        </section>
        <section class="trust-card">
          <SafetyCertificateOutlined />
          <div><b>平台服务保障</b><p>资质审核 · 电子合同 · 履约留痕 · 纠纷调解</p></div>
        </section>
      </aside>
    </div>

    <a-modal v-model:open="bookingOpen" title="预约服务" :footer="null" :width="620" destroy-on-close>
      <a-form :model="bookingForm" layout="vertical" class="booking-form" @finish="submitBooking">
        <a-form-item label="服务项目" name="serviceName" :rules="[{ required: true, message: '请选择服务项目' }]">
          <a-select v-model:value="bookingForm.serviceName" :options="serviceItemOptions" />
        </a-form-item>
        <div class="form-grid-2">
          <a-form-item label="数量" name="quantity" :rules="[{ required: true, message: '请填写服务数量' }]">
            <a-input-number v-model:value="bookingForm.quantity" :min="1" :precision="1" :addon-after="provider.unit.replace('元/', '')" style="width: 100%" />
          </a-form-item>
          <a-form-item label="预约日期" name="appointmentDate" :rules="[{ required: true, message: '请选择日期' }]">
            <a-input v-model:value="bookingForm.appointmentDate" type="date" :min="tomorrowText()" />
          </a-form-item>
        </div>
        <a-form-item label="服务时段" name="appointmentSlot" :rules="[{ required: true, message: '请选择时段' }]">
          <a-select v-model:value="bookingForm.appointmentSlot" :options="slotOptions" />
        </a-form-item>
        <a-form-item label="服务地址" name="location" :rules="[{ required: true, message: '请输入服务地址' }]">
          <a-input v-model:value="bookingForm.location" placeholder="村镇 + 地块，例：望城区乔口镇 3 号田">
            <template #prefix><EnvironmentOutlined /></template>
          </a-input>
        </a-form-item>
        <div class="form-grid-2">
          <a-form-item label="联系人" name="contactName" :rules="[{ required: true, message: '请输入联系人' }]">
            <a-input v-model:value="bookingForm.contactName" placeholder="默认使用当前经营主体名称" />
          </a-form-item>
          <a-form-item
            label="联系电话"
            name="contactPhone"
            :rules="[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]"
          >
            <a-input v-model:value="bookingForm.contactPhone" placeholder="服务商接单后可见" />
          </a-form-item>
        </div>
        <a-form-item label="补充要求" name="notes">
          <a-textarea v-model:value="bookingForm.notes" :rows="3" placeholder="如作业标准、运输卸粮、机损赔付要求等" />
        </a-form-item>
        <div class="booking-form-tip">金额由服务端按目录价实算。提交后进入「待确认预约」，此操作不扣款、不自动锁档，费用与档期请双方确认。</div>
        <a-button type="primary" html-type="submit" size="large" block :loading="submitting">确认预约</a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { Provider } from '../types'
import EmptyState from '../components/EmptyState.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import Money from '../components/Money.vue'

function tomorrowText(): string {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const app = useAppStore()
const provider = ref<Provider | null>(null)
const error = ref('')
const bookingOpen = ref(false)
const submitting = ref(false)
const favorite = ref(false)
const subjectName = ref('')

const bookingForm = reactive({
  serviceName: '',
  quantity: 1,
  appointmentDate: tomorrowText(),
  appointmentSlot: '09:00-12:00',
  location: '',
  contactName: '',
  contactPhone: '',
  notes: '',
})

const bookableItems = computed(() => provider.value?.items ?? [])
const selectedItem = computed(() => bookableItems.value[0])
const reviews = computed(() => provider.value?.reviews ?? [])

const serviceItemOptions = computed(() => {
  if (!provider.value) return []
  return bookableItems.value.length > 0
    ? bookableItems.value.map((item) => ({ value: item.name, label: `${item.name} · ¥${item.price}/${item.unit.replace('元/', '')}` }))
    : [{ value: provider.value.name, label: `${provider.value.name} · 起价 ¥${provider.value.price}${provider.value.unit}` }]
})

const slotOptions = computed(() => {
  const slots = provider.value?.availableSlots.length ? provider.value.availableSlots : ['09:00-12:00', '14:00-18:00']
  return slots.map((slot) => ({ value: slot, label: slot }))
})

watch(() => app.id, (id) => {
  if (!id) return
  provider.value = null
  error.value = ''
  serviceApi.provider(id)
    .then((data) => { provider.value = data })
    .catch((reason: Error) => { error.value = reason.message })
  serviceApi.favorites()
    .then((rows) => { favorite.value = rows.some((item) => Number(item.id) === id) })
    .catch(() => { favorite.value = false })
  serviceApi.identity()
    .then((identity) => { subjectName.value = identity.merchantName })
    .catch(() => { subjectName.value = '' })
}, { immediate: true })

async function toggleFavorite() {
  if (!provider.value) return
  try {
    const result = await serviceApi.toggleFavorite(provider.value.id)
    favorite.value = Boolean(result.favorited)
    message.success(result.favorited ? `已收藏 ${result.name}` : '已取消收藏')
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '收藏操作失败')
  }
}

function openBooking(serviceName?: string) {
  if (!provider.value) return
  if (provider.value.status !== 'available') {
    message.warning(`该服务商当前状态为「${provider.value.status}」，暂不可接单`)
    return
  }
  bookingForm.serviceName = serviceName ?? selectedItem.value?.name ?? provider.value.name
  bookingForm.quantity = 1
  bookingForm.appointmentDate = tomorrowText()
  bookingForm.appointmentSlot = provider.value.availableSlots[0] ?? '09:00-12:00'
  bookingForm.location = ''
  bookingForm.contactName = subjectName.value
  bookingForm.contactPhone = ''
  bookingForm.notes = ''
  bookingOpen.value = true
}

async function submitBooking() {
  if (!provider.value) return
  submitting.value = true
  try {
    const order = await serviceApi.createOrder({
      providerId: provider.value.id,
      serviceName: bookingForm.serviceName,
      serviceItemId: bookableItems.value.find((item) => item.name === bookingForm.serviceName)?.id,
      quantity: bookingForm.quantity,
      appointmentDate: bookingForm.appointmentDate,
      appointmentSlot: bookingForm.appointmentSlot,
      location: bookingForm.location,
      contactName: bookingForm.contactName,
      contactPhone: bookingForm.contactPhone,
      notes: bookingForm.notes,
    })
    bookingOpen.value = false
    message.success(`预约已提交（${order.orderNo}），请确认预约信息后等待服务商安排作业`)
    app.navigate('order-detail', order.id)
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '预约失败')
  } finally {
    submitting.value = false
  }
}
</script>
