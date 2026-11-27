<template>
  <view class="page aftersale-page">
    <view class="status-row">
      <text v-for="tab in tabs" :key="tab.value" class="status-chip" :class="{ active: activeTab === tab.value }" @tap="activeTab = tab.value">
        {{ tab.label }}<text v-if="tab.count" class="chip-count">{{ tab.count }}</text>
      </text>
    </view>

    <view v-if="loading && !records.length" class="empty"><text>正在加载售后记录…</text></view>
    <view v-else-if="!filtered.length" class="empty">
      <view class="empty-icon">售</view>
      <text>{{ activeTab ? '没有这一类售后单' : '暂未提交售后申请' }}</text>
      <text class="empty-sub">在订单详情页点「申请售后」即可发起</text>
      <button class="btn btn-ghost btn-sm empty-button" @tap="goOrders">查看我的订单</button>
    </view>

    <view v-else class="list">
      <view v-for="item in filtered" :key="item.id" class="card after-card">
        <view class="after-head">
          <view>
            <text class="after-type">{{ afterSaleTypeLabel(item.type) }}</text>
            <text class="after-order" @tap="openOrder(item.orderId)">订单 {{ item.orderId }} ›</text>
          </view>
          <text class="tag" :class="`tag-${statusMeta(item.status, item.returnShippedAt).tone}`">{{ statusMeta(item.status, item.returnShippedAt).label }}</text>
        </view>
        <text class="after-reason">{{ item.reason }}</text>
        <view v-if="item.handleOpinion" class="opinion">商家答复：{{ item.handleOpinion }}</view>

        <view v-if="item.status === 'RETURNING' && !item.returnShippedAt" class="return-form">
          <text class="return-title">商家已同意退货，请寄回商品后填写物流</text>
          <input v-model="returnForms[item.id].company" class="input" placeholder="物流公司，如 顺丰速运" />
          <input v-model="returnForms[item.id].logisticsNo" class="input" placeholder="物流单号" />
          <button class="btn btn-primary btn-sm" :loading="submittingId === item.id" @tap="submitReturn(item)">提交退货物流</button>
        </view>
        <view v-else-if="item.returnShippedAt" class="return-done">
          已寄回：{{ item.returnCompany }} {{ item.returnLogisticsNo }}
          <text v-if="!item.returnReceivedAt"> · 等待商家确认收货</text>
          <text v-else> · 商家已收货</text>
        </view>

        <button class="btn btn-sm" @tap="openAfterSale(item.id)">查看售后详情</button>
        <view class="after-foot">
          <text>{{ formatTime(item.createTime) }}</text>
          <text class="price">{{ money(item.amount) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { mallApi, type AfterSale } from '../../api'
import { ensureLogin } from '../../session'
import { afterSaleTypeLabel, formatTime, money, statusMeta, toast } from '../../utils'

const records = ref<AfterSale[]>([])
const loading = ref(false)
const activeTab = ref('')
const submittingId = ref<number | null>(null)
const returnForms = reactive<Record<number, { company: string; logisticsNo: string }>>({})

const PROCESSING = ['PENDING', 'RETURNING']
const tabs = computed(() => [
  { label: '全部', value: '', count: 0 },
  { label: '处理中', value: 'processing', count: records.value.filter((item) => PROCESSING.includes(item.status)).length },
  { label: '已完成', value: 'done', count: 0 },
])
const filtered = computed(() => {
  if (activeTab.value === 'processing') return records.value.filter((item) => PROCESSING.includes(item.status))
  if (activeTab.value === 'done') return records.value.filter((item) => !PROCESSING.includes(item.status))
  return records.value
})

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!ensureLogin()) return
  loading.value = true
  try {
    records.value = await mallApi.getAfterSales()
    for (const item of records.value) {
      if (!returnForms[item.id]) returnForms[item.id] = { company: '', logisticsNo: '' }
    }
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitReturn(item: AfterSale) {
  const form = returnForms[item.id]
  if (!form?.company.trim() || !form.logisticsNo.trim()) return toast('请填写物流公司和单号')
  submittingId.value = item.id
  try {
    const result = await mallApi.submitReturn(item.id, form.company.trim(), form.logisticsNo.trim())
    if (!result.success) throw new Error(result.message || '提交失败')
    toast('退货物流已提交', 'success')
    await load()
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submittingId.value = null
  }
}

function openAfterSale(id: number) { uni.navigateTo({url:'/pages/aftersale/detail?id='+id}) }
function openOrder(id: number) {
  uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
}

function goOrders() {
  uni.navigateTo({ url: '/pages/orders/index' })
}
</script>

<style scoped lang="scss">
.status-row {
  display: flex;
  gap: 12rpx;
  padding: 18rpx 24rpx;
  background: #fff;
}

.status-chip {
  padding: 10rpx 26rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  color: #666666;
  font-size: 26rpx;
}

.status-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.chip-count {
  margin-left: 6rpx;
  color: #e53935;
}

.empty-sub {
  color: #666666;
  font-size: 24rpx;
}

.empty-button {
  margin-top: 12rpx;
}

.after-card {
  margin-bottom: 0;
}

.after-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.after-type,
.after-order {
  display: block;
}

.after-type {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
}

.after-order {
  margin-top: 6rpx;
  color: #12764a;
  font-size: 24rpx;
}

.after-reason {
  display: block;
  margin-top: 14rpx;
  color: #52665a;
  font-size: 26rpx;
  line-height: 1.6;
}

.opinion {
  margin-top: 12rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: #f5f8f6;
  color: #52665a;
  font-size: 24rpx;
}

.return-form {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 16rpx;
  padding: 18rpx;
  border: 1rpx dashed #b9dfc9;
  border-radius: 14rpx;
  background: #f6fcf8;
}

.return-title {
  color: #0e5233;
  font-size: 24rpx;
  font-weight: 700;
}

.return-done {
  margin-top: 12rpx;
  color: #176c93;
  font-size: 24rpx;
}

.after-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf2ee;
  color: #666666;
  font-size: 24rpx;
}

.after-foot .price {
  font-size: 30rpx;
}
</style>
