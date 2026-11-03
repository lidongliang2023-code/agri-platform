<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, toast, type Attestation } from '../../api'

const id = ref(0)
const record = ref<Attestation | null>(null)
const loading = ref(true)

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    record.value = await infoApi.attestation(id.value)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function copyAll() {
  const data = record.value
  if (!data) return
  const text = [
    `存证编号：${data.attestNo}`,
    `内容标题：${data.title}`,
    `内容类型：${data.contentType}`,
    `内容哈希：${data.contentHash}`,
    `交易哈希：${data.txId}`,
    `区块高度：${data.blockHeight}`,
    `存证时间：${data.attestedAt}`,
    `共识节点：${data.chainName}`,
  ].join('\n')
  uni.setClipboardData({ data: text, success: () => toast('凭证已复制') })
}

function toVerify() {
  uni.navigateTo({ url: `/pages/attest/verify?attestNo=${record.value?.attestNo || ''}` })
}

function downloadProof() {
  uni.showModal({
    title: '下载存证证明',
    content: `将生成《${record.value?.attestNo || ''} 存证证明》PDF，包含内容哈希、交易哈希、区块高度与链上确认时间。`,
    success: (result: { confirm: boolean }) => {
      if (result.confirm) toast('已生成下载任务，可在「我的报告 - 下载记录」查看', 'none')
    },
  })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="record">
      <view class="head">
        <text class="head-title">{{ record.title }}</text>
        <text class="head-sub">{{ record.attestNo }} · {{ record.contentType }}</text>
        <view class="status-row">
          <text class="tag green">✓ 数据完整性一致</text>
          <text class="tag blue">链上已确认</text>
          <text class="tag gray">{{ record.chainName }}</text>
        </view>
      </view>

      <view class="page-pad">
        <view class="card">
          <view class="card-head">
            <text class="card-title">区块链凭证</text>
            <text class="card-sub" @click="copyAll">复制全部</text>
          </view>
          <view class="field">
            <text class="field-label">存证 ID</text>
            <text class="field-value">{{ record.attestNo }}</text>
          </view>
          <view class="field">
            <text class="field-label">内容哈希 SHA-256</text>
            <text class="field-value hash">{{ record.contentHash }}</text>
          </view>
          <view class="field">
            <text class="field-label">交易哈希</text>
            <text class="field-value hash">{{ record.txId }}</text>
          </view>
          <view class="field">
            <text class="field-label">区块高度</text>
            <text class="field-value">{{ record.blockHeight }}</text>
          </view>
          <view class="field">
            <text class="field-label">存证时间</text>
            <text class="field-value">{{ record.attestedAt }}</text>
          </view>
          <view class="field">
            <text class="field-label">验证次数</text>
            <text class="field-value">{{ record.verifyCount }} 次</text>
          </view>
          <view class="field">
            <text class="field-label">验证状态</text>
            <text class="field-value" style="color: #2e7d32">✓ 一致（未篡改）</text>
          </view>
        </view>

        <view v-if="record.steps?.length" class="card">
          <view class="card-head">
            <text class="card-title">上链流程</text>
          </view>
          <view v-for="(step, index) in record.steps" :key="index" class="step">
            <view :class="['step-dot', { done: step.done }]" />
            <view class="step-copy">
              <text class="strong">{{ step.title }}</text>
              <text class="tiny">{{ step.note }}</text>
            </view>
          </view>
        </view>

        <view class="notice ai">
          <text>✦</text>
          <text>
            平台在内容审核通过后自动计算 SHA-256 内容哈希并上链，链上仅保存哈希与元数据，正文保存在业务库。
            任何内容改动都会导致哈希不一致，可通过「内容验证」随时复核。
          </text>
        </view>

        <view class="actions">
          <button class="btn grow" @click="downloadProof">下载存证证明</button>
          <button class="btn btn-primary grow" @click="toVerify">去验证</button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 26rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-title {
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.45;
}

.head-sub {
  color: rgba(255, 255, 255, 0.6);
  font-size: 21rpx;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}

.hash {
  max-width: 66%;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 18rpx;
  word-break: break-all;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.step:last-child {
  border-bottom: 0;
}

.step-dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  background: #d5dfd8;
}

.step-dot.done {
  background: #12764a;
}

.step-copy {
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.actions {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 40rpx;
}
</style>
