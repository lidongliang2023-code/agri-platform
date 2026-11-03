<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, statusMeta } from '../../api'

interface Product {
  id: number
  name: string
  premium: string
  coverage: string
  subsidy: string
  icon: string
  summary: string
  tags: string[]
  premiumRate: number
  coveragePerUnit: number
  unitMeasure: string
}

const products = ref<Product[]>([])
const policies = ref<Array<{ id: number; policyNo: string; productName: string; insuredSubject: string; insuredArea: string; premium: number; coverageAmount: number; effectiveDate: string; status: string }>>([])
const claims = ref<Array<{ id: number; claimNo: string; policyNo: string; disasterType: string; status: string; progress: number; description: string }>>([])
const claimOpen = ref(false)
const claimForm = reactive({ policyId: 0, disasterType: '暴雨内涝', lossArea: '', description: '' })
const insureOpen = ref(false)
const insureProduct = ref<Product | null>(null)
const insureAmount = ref('')

/** 首屏的保障数字来自本主体名下真正生效的保单，不是写死的 128 亩 / ¥153,600。 */
const protectedSummary = computed(() => {
  const effective = policies.value.filter((item) => item.status !== 'expired')
  return {
    count: effective.length,
    subject: effective[0]?.insuredSubject ?? '',
    coverage: effective.reduce((sum, item) => sum + Number(item.coverageAmount || 0), 0),
  }
})
const insureEstimate = computed(() => {
  const product = insureProduct.value
  const amount = Number(insureAmount.value)
  if (!product || !amount || amount <= 0) return null
  return {
    premium: Math.round(Number(product.premiumRate) * amount * 100) / 100,
    coverage: Math.round(Number(product.coveragePerUnit) * amount * 100) / 100,
    unit: product.unitMeasure,
  }
})

onShow(load)

async function load() {
  try {
    const [productList, policyList, claimList] = await Promise.all([
      serviceApi.insuranceProducts(), serviceApi.insurancePolicies(), serviceApi.insuranceClaims(),
    ])
    products.value = productList
    policies.value = policyList
    claims.value = claimList
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

function openClaim(policyId = 0) {
  const usable = policies.value.filter((item) => item.status !== 'expired')
  if (usable.length === 0) {
    uni.showToast({ title: '当前没有生效中的保单，无法报案', icon: 'none' })
    return
  }
  claimForm.policyId = policyId || usable[0].id
  claimForm.description = ''
  claimForm.lossArea = ''
  claimOpen.value = true
}

async function submitClaim() {
  if (!claimForm.lossArea || !claimForm.description) {
    uni.showToast({ title: '请填写受灾面积与经过', icon: 'none' })
    return
  }
  try {
    const result = await serviceApi.createClaim(claimForm) as { claimNo?: string }
    claimOpen.value = false
    uni.showToast({ title: `报案 ${result?.claimNo ?? ''} 已提交`, icon: 'none' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' })
  }
}

function openInsure(product: Product) {
  insureProduct.value = product
  insureAmount.value = ''
  insureOpen.value = true
}

async function submitInsure() {
  const product = insureProduct.value
  if (!product) return
  if (!Number(insureAmount.value) || Number(insureAmount.value) <= 0) {
    uni.showToast({ title: `请填写投保${product.unitMeasure}数量`, icon: 'none' })
    return
  }
  try {
    const policy = await serviceApi.insure({
      productId: product.id,
      insuredAmount: Number(insureAmount.value),
    })
    insureOpen.value = false
    uni.showModal({
      title: '投保成功',
      content: `保单 ${policy.policyNo}，保费 ¥${policy.premium}，保额 ¥${policy.coverageAmount}，次日起生效。`,
      showCancel: false,
    })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '投保失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page insurance-page">
    <view class="insurance-hero">
      <text class="shield">🛡️</text>
      <view>
        <text class="tiny">政策性农险 · 平台协办</text>
        <text class="hero-insurance-title">{{ protectedSummary.count }} 份保单在保障期</text>
        <text class="tiny">{{ protectedSummary.subject || '当前主体暂无保单' }} · 保额合计 ¥{{ protectedSummary.coverage.toLocaleString() }}</text>
      </view>
    </view>
    <view class="page-pad">
      <view class="card"><view class="card-head"><text class="card-title">我的保单</text><text class="card-sub">{{ policies.length }} 份</text></view><view class="policy-card" v-for="policy in policies" :key="policy.id"><view class="policy-head"><text class="policy-icon">🛡️</text><view><text class="strong">{{ policy.productName }}</text><text class="tiny">{{ policy.policyNo }} · {{ policy.insuredSubject }}</text></view><text class="tag" :class="statusMeta(policy.status).tone">{{ statusMeta(policy.status).label }}</text></view><view class="figures"><view><text class="tiny">承保面积</text><text>{{ policy.insuredArea }}</text></view><view><text class="tiny">自缴保费</text><text>¥{{ policy.premium }}</text></view><view><text class="tiny">保障额度</text><text>¥{{ policy.coverageAmount.toLocaleString() }}</text></view></view><button v-if="policy.status !== 'expired'" class="btn btn-sm btn-ghost" @click="openClaim(policy.id)">出险报案</button><text v-else class="tiny">保单已到期，到期前 30 天可在下方重新投保</text></view><view v-if="policies.length === 0" class="empty">本主体暂无保单，可在下方选择险种投保</view></view>
      <view class="card"><view class="card-head"><text class="card-title">在售险种</text><text class="card-sub">按险种费率测算</text></view><scroll-view scroll-x class="product-scroll" :show-scrollbar="false"><view class="product-card" v-for="product in products" :key="product.id"><text class="product-icon">{{ product.icon }}</text><text class="strong">{{ product.name }}</text><text class="product-premium">{{ product.premium }}</text><text class="muted">{{ product.summary }}</text><text class="tag green">{{ product.subsidy }}</text><button class="btn btn-sm btn-ghost" @click="openInsure(product)">立即投保</button></view></scroll-view></view>
      <view class="card"><view class="card-head"><text class="card-title">理赔进度</text><button class="btn btn-sm btn-primary" @click="openClaim()">快速报案</button></view><view class="claim" v-for="claim in claims" :key="claim.id"><view class="between"><text class="strong">{{ claim.disasterType }}</text><text class="tag" :class="statusMeta(claim.status).tone">{{ statusMeta(claim.status).label }}</text></view><text class="tiny">{{ claim.claimNo }} · {{ claim.policyNo }}</text><text class="muted">{{ claim.description }}</text><view class="progress"><view :style="{ width: `${claim.progress}%` }" /></view></view><view v-if="claims.length === 0" class="empty">暂无理赔案件</view></view>
    </view>
    <view v-if="claimOpen" class="overlay" @click.self="claimOpen = false">
      <view class="sheet">
        <view class="between"><text class="card-title">出险报案</text><text class="sheet-close" @click="claimOpen = false">×</text></view>
        <view class="form-item"><text class="form-label">灾害类型</text><picker :range="['暴雨内涝','干旱','风灾','冻害','病虫害','意外事故']" @change="claimForm.disasterType = ['暴雨内涝','干旱','风灾','冻害','病虫害','意外事故'][Number($event.detail.value)]"><view class="input">{{ claimForm.disasterType }} ▾</view></picker></view>
        <view class="form-item"><text class="form-label">受灾面积</text><input class="input" v-model="claimForm.lossArea" /></view>
        <view class="form-item"><text class="form-label">受灾情况</text><textarea class="textarea" v-model="claimForm.description" placeholder="发生时间、受灾范围与当前状态" /></view>
        <button class="btn btn-primary btn-block" @click="submitClaim">提交报案</button>
      </view>
    </view>
    <view v-if="insureOpen" class="overlay" @click.self="insureOpen = false">
      <view class="sheet">
        <view class="between"><text class="card-title">投保 · {{ insureProduct?.name }}</text><text class="sheet-close" @click="insureOpen = false">×</text></view>
        <view class="form-item">
          <text class="form-label">投保数量（{{ insureProduct?.unitMeasure }}）</text>
          <input class="input" type="digit" v-model="insureAmount" placeholder="如 128" />
        </view>
        <view class="quote">
          <text>费率 ¥{{ insureProduct?.premiumRate }}/{{ insureProduct?.unitMeasure }} · 单位保额 ¥{{ insureProduct?.coveragePerUnit }}</text>
          <text class="quote-total" v-if="insureEstimate">应交保费 ¥{{ insureEstimate.premium }}　保障额度 ¥{{ insureEstimate.coverage }}</text>
          <text class="tiny" v-else>填写数量后按险种费率测算，最终金额以服务端计算为准。</text>
        </view>
        <button class="btn btn-primary btn-block" @click="submitInsure">确认投保</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.insurance-page { padding-bottom: 24rpx; }
.insurance-hero { display: flex; align-items: center; gap: 20rpx; margin: 24rpx; padding: 28rpx; border-radius: 24rpx; background: radial-gradient(circle at 92% 0, rgba(99,210,143,.2), transparent 300rpx), linear-gradient(135deg, #073621, #0c5a39); color: #fff; }
.shield { display: flex; width: 86rpx; height: 86rpx; align-items: center; justify-content: center; border-radius: 21rpx; background: rgba(255,255,255,.1); font-size: 42rpx; }
.insurance-hero > view { display: flex; flex-direction: column; gap: 5rpx; }
.insurance-hero .tiny { color: rgba(255,255,255,.55); }
.hero-insurance-title { font-size: 34rpx; font-weight: 700; }
.policy-card { margin-bottom: 16rpx; padding: 18rpx; border: 1rpx solid #e4ece7; border-radius: 16rpx; background: #fcfefd; }
.policy-head { display: flex; align-items: center; gap: 12rpx; }
.policy-icon { display: flex; width: 60rpx; height: 60rpx; align-items: center; justify-content: center; border-radius: 15rpx; background: #e5f5eb; font-size: 28rpx; }
.policy-head > view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3rpx; }
.policy-head .strong { overflow: hidden; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.figures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin: 16rpx 0; padding: 14rpx; border-radius: 12rpx; background: #f4f8f5; }
.figures view { display: flex; flex-direction: column; gap: 4rpx; font-size: 21rpx; }
.product-scroll { white-space: nowrap; }
.product-card { display: inline-flex; width: 330rpx; flex-direction: column; gap: 7rpx; margin-right: 14rpx; padding: 20rpx; border: 1rpx solid #e1e9e3; border-radius: 18rpx; background: #fff; vertical-align: top; white-space: normal; }
.product-icon { font-size: 38rpx; }
.product-premium { color: #0e5233; font-size: 22rpx; }
.product-card .muted { min-height: 84rpx; }
.claim { display: flex; flex-direction: column; gap: 6rpx; margin-bottom: 14rpx; padding: 18rpx; border: 1rpx solid #f1dfc1; border-radius: 15rpx; background: #fffdf8; }
.overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(5,25,15,.45); }
.sheet { width: 100%; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 30rpx 30rpx 0 0; background: #fff; }
.sheet-head, .between { margin-bottom: 20rpx; }
.sheet-close { color: #718277; font-size: 44rpx; }
.quote { display: flex; flex-direction: column; gap: 6rpx; margin: 16rpx 0; padding: 18rpx; border-radius: 14rpx; background: #f2f7f3; font-size: 21rpx; color: #4c5a51; }
.quote-total { font-size: 25rpx; font-weight: 650; color: #0e5233; }
</style>
