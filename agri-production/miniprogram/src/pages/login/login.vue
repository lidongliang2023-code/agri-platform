<template>
  <view class="page login-page">
    <view class="login-head">
      <text class="login-logo">🌾</text>
      <text class="login-title">农业生产管理</text>
      <text class="muted">田间地头的一线操作台</text>
    </view>

    <view class="card">
      <view class="field">
        <text class="field-label">账号</text>
        <input v-model="username" class="input" placeholder="手机号 / 用户名" />
      </view>
      <view class="field">
        <text class="field-label">密码</text>
        <input v-model="password" class="input" password placeholder="登录密码" />
      </view>
      <view class="field">
        <text class="field-label">市场</text>
        <input v-model="marketId" class="input" type="number" placeholder="1" />
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>

    <view style="margin: 32rpx 24rpx">
      <view class="btn-primary" @click="handleLogin">{{ loading ? '登录中…' : '登 录' }}</view>
    </view>

    <view class="muted" style="text-align: center; padding: 0 48rpx">
      登录走统一认证中心（POST /api/v1/auth/login）；令牌存本地，后续请求以 Bearer 发送。
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { listFarms, login, setCurrentFarm } from '@/utils/auth-helper'

/** 账号 */
const username = ref('')
/** 密码 */
const password = ref('')
/** 市场 ID（多市场部署时由运营分配，默认 1） */
const marketId = ref('1')

const loading = ref(false)
const error = ref('')

/**
 * 登录 → 建立「当前农场」上下文 → 进工作台。
 *
 * <p>农场上下文必须登录后立刻建立：地块 / 任务 / 采收都是农场作用域，
 * 没有它各 Tab 只能显示空列表（PC 端历史上踩过"没选农场看着像没数据"）。</p>
 */
async function handleLogin(): Promise<void> {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  try {
    await login({
      username: username.value.trim(),
      password: password.value,
      marketId: Number(marketId.value) || 1,
    })
    const farms = await listFarms()
    if (farms.length > 0) {
      setCurrentFarm(farms[0])
    } else {
      uni.showToast({ title: '该账号名下暂无农场', icon: 'none' })
    }
    uni.reLaunch({ url: '/pages/workbench/workbench' })
  } catch (err: any) {
    error.value = err?.message ?? '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  padding-top: 80rpx;
}

.login-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.login-logo {
  font-size: 96rpx;
}

.login-title {
  font-size: 40rpx;
  font-weight: 600;
  margin: 12rpx 0 8rpx;
}
</style>
