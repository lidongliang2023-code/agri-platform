<template>
  <view class="page audit-page">
    <view class="hero">
      <text class="hero-kicker">ONBOARDING AUDIT</text>
      <text class="hero-title">{{ auditTitle }}</text>
      <text class="hero-desc">供应商入驻审核与商品审核状态同步</text>
      <text class="audit-status">{{ auditStatusText }}</text>
    </view>

    <view class="card">
      <view v-for="(step, index) in steps" :key="step.title" class="step" :class="{ done: step.done, active: step.active }">
        <view class="step-line">
          <view class="step-dot">{{ step.done ? '✓' : index + 1 }}</view>
          <view v-if="index < steps.length - 1" class="line" />
        </view>
        <view class="step-copy">
          <text>{{ step.title }}</text>
          <small class="small-copy">{{ step.desc }}</small>
          <em v-if="step.time">{{ step.time }}</em>
        </view>
      </view>
    </view>

    <view v-if="supplier?.auditOpinion" class="card opinion-card">
      <text class="opinion-title">平台审核意见</text>
      <text class="opinion-text">{{ supplier.auditOpinion }}</text>
    </view>

    <view class="card platform-note">
      <view class="compact-icon">端</view>
      <view><text>多端审核进度同步</text><small class="small-copy">移动端与供应商桌面端读取同一业务数据</small></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { supplierApi, type Supplier } from '../../api'
import { requireSupplierLogin, supplierSession } from '../../session'
import { toast } from '../../utils'

const supplier = ref<Supplier | null>(null)
const auditTitle = computed(() => supplier.value?.shopName || '供应商入驻审核')
const auditStatusText = computed(() => {
  if (supplier.value?.auditStatus === 'APPROVED') return '资质审核已通过'
  if (supplier.value?.auditStatus === 'REJECTED') return '资质审核未通过'
  return '平台审核处理中'
})
const steps = computed(() => [
  { title: '提交入驻申请', desc: '供应商提交企业、店铺和结算资料', done: true, active: false, time: supplier.value?.auditTime || '已完成' },
  { title: '平台资质审核', desc: '平台核验企业与经营资质', done: supplier.value?.auditStatus === 'APPROVED', active: supplier.value?.auditStatus !== 'APPROVED' && supplier.value?.auditStatus !== 'REJECTED', time: supplier.value?.auditTime || '' },
  { title: '商品资料审核', desc: '审核商品信息、图片与认证资料', done: supplier.value?.auditStatus === 'APPROVED', active: false, time: '' },
  { title: '入驻经营', desc: '审核通过后可发布和经营商品', done: supplier.value?.auditStatus === 'APPROVED', active: false, time: '' },
])

onShow(load)

async function load() {
  if (!requireSupplierLogin()) return
  try {
    supplier.value = await supplierApi.getSupplier(supplierSession.account?.id || 1)
  } catch (error) {
    toast((error as Error).message)
  }
}
</script>

<style scoped lang="scss">
.audit-page {
  padding-bottom: 30rpx;
}

.audit-status {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 6rpx 14rpx;
  border: 1rpx solid rgba(255,255,255,.16);
  border-radius: 999rpx;
  background: rgba(255,255,255,.08);
  color: #c9f2d7;
  font-size: 18rpx;
}

.step {
  display: flex;
  gap: 18rpx;
  min-height: 128rpx;
}

.step-line {
  display: flex;
  width: 46rpx;
  align-items: center;
  flex-direction: column;
}

.step-dot {
  display: grid;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 42rpx;
  place-items: center;
  border: 1rpx solid #d7e2db;
  border-radius: 50%;
  background: #f5f8f6;
  color: #93a29a;
  font-size: 18rpx;
  font-weight: 700;
}

.line {
  width: 2rpx;
  flex: 1;
  background: #e3eae5;
}

.step.done .step-dot {
  border-color: #12764a;
  background: #12764a;
  color: #fff;
}

.step.done .line {
  background: #a9d6ba;
}

.step.active .step-dot {
  border-color: #d88718;
  background: #fff3dd;
  color: #a96a08;
}

.step-copy {
  flex: 1;
  padding: 2rpx 0 25rpx;
}

.step-copy text,
.step-copy .small-copy,
.step-copy em {
  display: block;
}

.step-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.step-copy .small-copy {
  margin-top: 7rpx;
  color: #84938a;
  font-size: 18rpx;
}

.step-copy em {
  margin-top: 6rpx;
  color: #a0aba4;
  font-size: 16rpx;
  font-style: normal;
}

.opinion-card {
  border-color: #efd0d0;
  background: #fff6f6;
}

.opinion-title,
.opinion-text {
  display: block;
}

.opinion-title {
  color: #c54b4b;
  font-size: 23rpx;
  font-weight: 700;
}

.opinion-text {
  margin-top: 9rpx;
  color: #6b4d4d;
  font-size: 20rpx;
  line-height: 1.6;
}

.platform-note {
  display: flex;
  align-items: center;
  gap: 14rpx;
  border-color: #dcebe2;
  background: #f5fbf7;
}

.platform-note text,
.platform-note .small-copy {
  display: block;
}

.platform-note text {
  color: #0e5233;
  font-size: 22rpx;
  font-weight: 700;
}

.platform-note .small-copy {
  margin-top: 5rpx;
  color: #718277;
  font-size: 17rpx;
}
</style>
