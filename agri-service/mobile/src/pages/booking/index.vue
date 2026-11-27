<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { localDate } from '../../utils'
import { onLoad } from '@dcloudio/uni-app'
import { serviceApi, type Provider } from '../../api'

interface CatalogItem {
  id: string | number
  name: string
  price: number
  unit: string
  description: string
  duration: string
}

const provider = ref<Provider | null>(null)
const catalog = ref<CatalogItem[]>([])
const submitting = ref(false)
const loadError = ref('')
/** 日期默认值必须是"今天+N"，不能写死某个历史日子，否则下单就是一条过期的预约。 */
const minDate = localDate(1)

const form = reactive({
  providerId: '',
  serviceItemId: '' as string | number,
  serviceName: '',
  quantity: 1,
  appointmentDate: minDate,
  appointmentSlot: '',
  location: '',
  contactName: '',
  contactPhone: '',
  notes: '',
})

const selected = computed(() => catalog.value.find((item) => String(item.id) === String(form.serviceItemId)) ?? null)
const estimate = computed(() => {
  const price = selected.value ? Number(selected.value.price) : Number(provider.value?.price ?? 0)
  const total = price * Number(form.quantity || 0)
  return { price, total: Math.round(total * 100) / 100, deposit: Math.round(total * 0.2) }
})

onLoad(async (options) => {
  form.providerId = String(options?.providerId || '')
  if (!/^\d+$/.test(form.providerId)) { loadError.value = '缺少服务商编号，请从服务商详情进入预约'; return }
  try {
    const data = await serviceApi.provider(form.providerId)
    provider.value = data
    catalog.value = data.items ?? []
    const initial = catalog.value.find(item => String(item.id) === String(options?.serviceItemId)) || catalog.value[0]
    if (!initial) throw new Error('该服务商暂无可预约项目，请返回服务中心选择其他服务商')
    form.serviceItemId = initial.id
    form.serviceName = initial.name
    form.appointmentSlot = data.availableSlots?.[0] ?? ''
    // 联系人默认填经营主体名，来自后端解析的令牌身份，不是写死的演示人物
    const identity = await serviceApi.identity().catch(() => null)
    form.contactName = identity?.merchantName ?? ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '服务商档案加载失败'
  }
})

function onServiceChange(event: { detail: { value: string } }) {
  const item = catalog.value[Number(event.detail.value)]
  if (item) { form.serviceName = item.name; form.serviceItemId = item.id }
}

function onSlotChange(event: { detail: { value: string } }) {
  const slot = (provider.value?.availableSlots ?? [])[Number(event.detail.value)]
  if (slot) form.appointmentSlot = slot
}

function onDateChange(event: { detail: { value: string } }) {
  form.appointmentDate = event.detail.value
}

async function submit() {
  if (submitting.value) return
  if (!selected.value || !Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0 || !form.appointmentSlot || form.appointmentDate < minDate) {
    uni.showToast({ title: '请选择有效项目、数量、日期和时段', icon: 'none' }); return
  }
  if (!provider.value) {
    uni.showToast({ title: loadError.value || '服务商档案未加载', icon: 'none' })
    return
  }
  if (!form.serviceName || !form.location || !form.contactPhone) {
    uni.showToast({ title: '请完善服务项目、服务地址和联系电话', icon: 'none' })
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) {
    uni.showToast({ title: '请填写 11 位手机号', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    // 单价与金额由服务端按目录价实算，这里只提交选择项
    const order = await serviceApi.createOrder({
      providerId: form.providerId,
      serviceItemId: form.serviceItemId,
      serviceName: form.serviceName,
      quantity: form.quantity,
      appointmentDate: form.appointmentDate,
      appointmentSlot: form.appointmentSlot,
      location: form.location,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      notes: form.notes,
    })
    uni.showToast({ title: '预约成功', icon: 'success' })
    setTimeout(() => uni.redirectTo({ url: `/pages/orders/detail?id=${order.id}` }), 500)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '预约失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page page-pad booking-page">
    <view v-if="loadError" class="card">
      <text class="strong">无法发起预约</text>
      <text class="muted">{{ loadError }}</text>
    </view>
    <template v-else>
      <view v-if="provider" class="summary">
        <view class="summary-icon">{{ provider.categoryIcon }}</view>
        <view>
          <text class="strong">{{ provider.name }}</text>
          <text class="muted">{{ provider.region }} · 预约服务</text>
        </view>
      </view>
      <view class="card">
        <view class="form-item">
          <text class="form-label">服务项目</text>
          <picker v-if="catalog.length" mode="selector" :range="catalog.map((item) => `${item.name} ¥${item.price}/${item.unit}`)" @change="onServiceChange">
            <view class="picker">{{ form.serviceName || '请选择服务内容' }}</view>
          </picker>
          <input v-else class="input" v-model="form.serviceName" placeholder="请填写服务内容" />
        </view>
        <view class="grid-2">
          <view class="form-item"><text class="form-label">数量（{{ selected?.unit?.replace('元/', '') || '次' }}）</text><input class="input" type="digit" v-model="form.quantity" /></view>
          <view class="form-item"><text class="form-label">上门日期</text>
            <picker mode="date" :start="minDate" @change="onDateChange">
              <view class="picker">{{ form.appointmentDate }}</view>
            </picker>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">服务商公布时段</text>
          <picker mode="selector" :range="provider?.availableSlots ?? []" @change="onSlotChange">
            <view class="picker">{{ form.appointmentSlot || '请选择参考时段' }}</view>
          </picker>
          <text class="muted">以上为服务商档案中的时段说明，不代表所选日期仍有余量；上门时间以服务商确认结果为准。</text>
        </view>
        <view class="form-item"><text class="form-label">服务地址</text><input class="input" v-model="form.location" placeholder="村镇 + 地块，例：望城区乔口镇 3 号田" /></view>
        <view class="grid-2">
          <view class="form-item"><text class="form-label">联系人</text><input class="input" v-model="form.contactName" /></view>
          <view class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.contactPhone" placeholder="11 位手机号" /></view>
        </view>
        <view class="form-item"><text class="form-label">补充要求</text><textarea class="textarea" v-model="form.notes" placeholder="作业标准、运输卸粮、机损赔付要求等" /></view>
        <view class="quote">
          <text>目录单价 ¥{{ estimate.price }} · 数量 {{ form.quantity }}</text>
          <text class="quote-total">预估总额 ¥{{ estimate.total }}　定金 ¥{{ estimate.deposit }}</text>
          <text class="tiny">金额与定金由服务端按服务商目录价实算，改报价需要服务商重新上架。</text>
        </view>
        <view class="notice">提交后请确认预约信息，由服务商安排作业。此处不执行扣款或自动锁档，费用请双方另行确认。</view>
        <button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting || !selected" @click="submit">确认预约</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.summary { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; padding: 22rpx; border-radius: 22rpx; background: #edf8f2; }
.summary-icon { display: flex; width: 82rpx; height: 82rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #12764a; font-size: 40rpx; }
.summary > view:last-child { display: flex; flex-direction: column; gap: 5rpx; }
.notice { margin-bottom: 20rpx; padding: 16rpx; border-radius: 13rpx; background: #fff3dd; color: #704000; font-size: 13px; line-height: 1.6; }
.picker { min-height: 44px; padding: 18rpx 20rpx; border: 1rpx solid #dfe7e1; border-radius: 14rpx; background: #fbfdfb; font-size: 13px; color: #1f2a23; }
.quote { display: flex; flex-direction: column; gap: 6rpx; margin: 16rpx 0; padding: 18rpx; border-radius: 14rpx; background: #f2f7f3; font-size: 13px; color: #4c5a51; }
.quote-total { font-size: 14px; font-weight: 650; color: #0e5233; }

.summary-icon { flex-shrink: 0; }
.summary > view:last-child { min-width: 0; }
.picker { font-size: 15px; }

</style>
