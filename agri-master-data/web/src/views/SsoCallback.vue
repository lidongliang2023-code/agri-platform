<!--
  SSO 回跳页（/sso/callback）—— 授权码换令牌的落点。

  它只做一件事：把 URL 上的 code 换成平台令牌写入登录态，再回到来之前的页面。
  单独成页而不是塞进登录页，是因为"收集意图并跳转"和"换票"是两件事：
  混在一起会让失败重试、返回登录页这两条路径互相干扰，也说不清错误该归谁。
-->
<template>
  <div class="callback">
    <template v-if="!error">
      <a-spin />
      <p class="hint">正在完成登录…</p>
    </template>
    <template v-else>
      <a-result status="error" title="登录未完成" :sub-title="error" />
      <!-- 带 ?local=1 回到登录页：绕过自动跳转，避免"跳过去又失败"来回打转 -->
      <a-button type="primary" @click="goLogin">返回登录页</a-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { exchangeCode, takeReturnTo, LOGIN_PATH } from '@/utils/sso'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const error = ref('')

function goLogin(): void {
  window.location.href = `${LOGIN_PATH}?local=1`
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) {
    error.value = '回跳地址里没有授权码'
    return
  }
  try {
    const result = await exchangeCode(code, params.get('state'))
    session.apply(result)
    const returnTo = takeReturnTo()
    await router.replace(returnTo ?? '/dashboard')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '换取令牌失败'
  }
})
</script>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.hint {
  color: #667085;
}
</style>
