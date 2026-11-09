<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, toast, type Attestation } from '../../api'

const HISTORY_KEY = 'info_verify_history'

interface VerifyItem {
  attestNo: string
  title: string
  valid: boolean
  message: string
  at: string
}

const attestNo = ref('')
const result = ref<{ valid: boolean; message: string; record?: Attestation } | null>(null)
const loading = ref(false)
const history = ref<VerifyItem[]>(uni.getStorageSync(HISTORY_KEY) || [])

onLoad((options) => {
  const preset = decodeURIComponent(String(options?.attestNo || ''))
  if (preset) {
    attestNo.value = preset
    verify()
  }
})

async function verify() {
  const value = attestNo.value.trim()
  if (!value) {
    toast('请输入内容 ID、存证编号或标题')
    return
  }
  loading.value = true
  try {
    const res = await infoApi.verifyAttestation(value)
    result.value = res
    const item: VerifyItem = {
      attestNo: res.record?.attestNo || value,
      title: res.record?.title || value,
      valid: res.valid,
      message: res.message,
      at: new Date().toISOString(),
    }
    history.value = [item, ...history.value.filter((row) => row.attestNo !== item.attestNo)].slice(0, 20)
    uni.setStorageSync(HISTORY_KEY, history.value)
  } catch (error) {
    toast(error instanceof Error ? error.message : '验证失败')
  } finally {
    loading.value = false
  }
}

function clearHistory() {
  history.value = []
  uni.removeStorageSync(HISTORY_KEY)
}

function openRecord() {
  if (!result.value?.record) return
  uni.navigateTo({ url: `/pages/attest/detail?id=${result.value.record.id}` })
}

function copyHash() {
  if (!result.value?.record) return
  uni.setClipboardData({
    data: result.value.record.contentHash,
    success: () => toast('内容哈希已复制'),
  })
}

function useHistory(item: VerifyItem) {
  attestNo.value = item.attestNo
  verify()
}
</script>

<template>
  <view class="page">
    <view class="page-pad">
      <view class="card">
        <view class="card-head">
          <text class="card-title">按内容 ID 验证</text>
          <text class="card-sub">支持存证编号 / 文章标题</text>
        </view>
        <input
          v-model="attestNo"
          class="input"
          placeholder="请输入内容 ID、存证编号或文章标题"
          placeholder-class="ph"
          confirm-type="search"
          @confirm="verify()"
        />
        <button class="btn btn-primary btn-block" style="margin-top: 16rpx" :disabled="loading" @click="verify">
          {{ loading ? '校验中…' : '立即验证' }}
        </button>
        <text class="tiny" style="display: block; margin-top: 12rpx">示例：CN20261021001</text>
      </view>

      <view v-if="result" :class="['result', result.valid ? 'ok' : 'bad']">
        <text class="result-title">{{ result.valid ? '✅ 验证通过 · 内容未被篡改' : '⚠️ 校验不一致' }}</text>
        <text class="result-desc">{{ result.message }}</text>

        <template v-if="result.record">
          <view class="field">
            <text class="field-label">内容标题</text>
            <text class="field-value">{{ result.record.title }}</text>
          </view>
          <view class="field">
            <text class="field-label">内容类型</text>
            <text class="field-value">{{ result.record.contentType }}</text>
          </view>
          <view class="field">
            <text class="field-label">区块高度</text>
            <text class="field-value">{{ result.record.blockHeight }}</text>
          </view>
          <view class="field">
            <text class="field-label">存证时间</text>
            <text class="field-value">{{ result.record.attestedAt }}</text>
          </view>
          <view class="field">
            <text class="field-label">交易哈希</text>
            <text class="field-value hash">{{ result.record.txId }}</text>
          </view>
          <view class="result-actions">
            <button class="btn btn-sm grow" @click="copyHash">复制哈希</button>
            <button class="btn btn-primary btn-sm grow" @click="openRecord">查看链上详情</button>
          </view>
        </template>
      </view>

      <view v-if="history.length" class="section-head">
        <text class="section-title">验证历史</text>
        <text class="card-sub" @click="clearHistory">清空</text>
      </view>
      <view v-if="history.length" class="card">
        <view v-for="item in history" :key="item.attestNo" class="list-item" @click="useHistory(item)">
          <view class="item-icon">{{ item.valid ? '✅' : '⚠️' }}</view>
          <view class="item-body">
            <text class="item-title">{{ item.attestNo }}</text>
            <text class="item-sub">{{ item.title }}</text>
          </view>
          <text :class="['tag', item.valid ? 'green' : 'red']">{{ item.valid ? '一致' : '不一致' }}</text>
        </view>
      </view>

      <view class="notice ai" style="margin-top: 16rpx">
        <text>✦</text>
        <text>
          系统对目标内容重新计算 SHA-256 哈希，与链上存证的哈希逐位比对：完全一致即证明内容自发布后未被改动；
          不一致则说明内容已被修改或并非平台原始版本。
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ph {
  color: #b3c0b7;
}

.result {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid #d9e9df;
  background: #f4faf6;
}

.result.bad {
  border-color: #f0d9d9;
  background: #fdf5f5;
}

.result-title {
  display: block;
  font-size: 27rpx;
  font-weight: 700;
}

.result-desc {
  display: block;
  margin-top: 8rpx;
  color: #53665a;
  font-size: 24rpx;
  line-height: 1.65;
}

.hash {
  max-width: 64%;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 24rpx;
  word-break: break-all;
}

.result-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
</style>
