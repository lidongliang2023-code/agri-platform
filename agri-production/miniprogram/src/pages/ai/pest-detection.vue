<template>
  <view class="page">
    <view class="notice">
      ⚠️ 后端 AI 病虫害识别当前是**占位实现**（`AiNotAvailableController` 直接抛 501「未接入」）。
      本页如实展示后端返回的错误，不做任何本地假识别结果。
    </view>

    <view class="card">
      <view class="card-title"><text>📷 拍照 / 选图</text></view>
      <view v-if="imagePath" class="row" style="margin-bottom: 16rpx">
        <text class="muted">已选图片：{{ imagePath.split('/').pop() }}</text>
        <text class="link" @click="imagePath = ''">重选</text>
      </view>
      <view class="btn-ghost" @click="chooseImage">从相册 / 相机选择作物照片</view>
      <view style="margin-top: 20rpx">
        <view class="btn-primary" @click="detect">{{ loading ? '识别中…' : '提交识别' }}</view>
      </view>
    </view>

    <view v-if="result" class="card">
      <view class="card-title"><text>🧪 识别结果</text></view>
      <view class="field"><text class="field-label">病虫害</text><text class="field-value">{{ result.pestName ?? result.pest_name ?? '—' }}</text></view>
      <view class="field"><text class="field-label">置信度</text><text class="field-value">{{ result.confidence ?? '—' }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">防治建议</text><text class="field-value">{{ result.treatment ?? result.suggestion ?? '—' }}</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view style="margin: 24rpx">
      <view class="btn-ghost" @click="goCreateTask">改用手工登记防治任务</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { pestDetection } from '@/api/production'

const imagePath = ref('')
const loading = ref(false)
const result = ref<any | null>(null)
const error = ref('')

/** 选图：小程序端可拍照或从相册选，H5 端 uni 会退化为文件选择 */
function chooseImage(): void {
  uni.chooseImage({
    count: 1,
    success: (res: any) => {
      imagePath.value = res.tempFilePaths?.[0] ?? ''
    },
    fail: () => uni.showToast({ title: '未选择图片', icon: 'none' }),
  })
}

/**
 * 提交识别。
 *
 * <p>后端未接入时会抛 501，这里把后端原文透出来（页面顶部也提前说明了），
 * 让"功能没上线"这件事一眼可见，而不是显示一个假的识别结果。</p>
 */
async function detect(): Promise<void> {
  error.value = ''
  result.value = null
  if (!imagePath.value) {
    error.value = '请先选择一张作物照片'
    return
  }
  loading.value = true
  try {
    result.value = await pestDetection({ imagePath: imagePath.value })
  } catch (err: any) {
    error.value = err?.message ?? '识别失败'
  } finally {
    loading.value = false
  }
}

const goCreateTask = (): void => {
  uni.navigateTo({ url: '/pages/tasks/create' })
}
</script>
