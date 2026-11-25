<template>
  <div v-if="error" style="min-height: 100vh; display: grid; place-items: center; background: #f4f7f5; padding: 24px">
    <div style="width: 420px; max-width: 100%; padding: 28px; border: 1px solid #e3eae5; border-radius: 14px; background: #fff; text-align: center">
      <div style="width: 54px; height: 54px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 14px; background: #eaf7ef; color: #12764a; font-size: 24px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 20px">统一登录未完成</h2>
      <p style="margin: 10px 0 20px; color: #718277; font-size: 13px; line-height: 1.7">{{ error }}</p>
      <button type="button" style="height: 40px; padding: 0 20px; border: 0; border-radius: 9px; background: #12764a; color: #fff; cursor: pointer" @click="retry">重新登录</button>
    </div>
  </div>
  <div v-else-if="denied" style="min-height: 100vh; display: grid; place-items: center; background: #f4f7f5; padding: 24px">
    <div style="width: 420px; max-width: 100%; padding: 28px; border: 1px solid #e3eae5; border-radius: 14px; background: #fff; text-align: center">
      <div style="width: 54px; height: 54px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 14px; background: #eaf7ef; color: #12764a; font-size: 24px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 20px">暂无物联网访问权限</h2>
      <p style="margin: 10px 0 20px; color: #718277; font-size: 13px; line-height: 1.7">当前统一账号没有开通物联网访问权限，请联系平台运营为该账号分配 iot 权限。</p>
      <button type="button" style="height: 40px; padding: 0 20px; border: 0; border-radius: 9px; background: #12764a; color: #fff; cursor: pointer" @click="retry">重新登录</button>
    </div>
  </div>
  <div v-else-if="checking || !ready" style="min-height: 100vh; display: grid; place-items: center; background: #f4f7f5; padding: 24px">
    <div style="width: 420px; max-width: 100%; padding: 28px; border: 1px solid #e3eae5; border-radius: 14px; background: #fff; text-align: center">
      <div style="width: 54px; height: 54px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 14px; background: #eaf7ef; color: #12764a; font-size: 24px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 20px">正在连接统一认证中心</h2>
      <p style="margin: 10px 0 20px; color: #718277; font-size: 13px; line-height: 1.7">正在核验统一账号与物联网访问权限，请稍候…</p>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CALLBACK_PATH,
  RETURN_KEY,
  clearSession,
  exchangeCode,
  granted,
  iotSession,
  loadPermissions,
  redirectToSso,
  restoreSession,
  type LoginResult,
} from './sso'

const props = defineProps<{
  clientId: string
  landingPath: string
  requiredPermissions: string[]
}>()

const checking = ref(true)
const error = ref('')
const denied = ref(false)
const ready = computed(() => Boolean(iotSession.user))

function retry() {
  checking.value = true
  error.value = ''
  denied.value = false
  void redirectToSso(props.clientId, props.landingPath)
}

onMounted(async () => {
  try {
    let login: LoginResult | null = null
    if (window.location.pathname.replace(/\/+$/, '') === CALLBACK_PATH) {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (!code) throw new Error('统一认证回跳缺少授权码')
      login = await exchangeCode(props.clientId, code, params.get('state'))
      const returnTo = sessionStorage.getItem(RETURN_KEY)
      sessionStorage.removeItem(RETURN_KEY)
      window.history.replaceState({}, '', returnTo || props.landingPath)
    } else {
      login = await restoreSession()
    }
    if (!login) {
      await redirectToSso(props.clientId, `${window.location.pathname}${window.location.search}`)
      return
    }
    const permissions = await loadPermissions()
    const allowed = props.requiredPermissions.every((permission) => granted(permissions, permission))
    if (!allowed) {
      denied.value = true
      clearSession()
      return
    }
    iotSession.user = login.user
    iotSession.permissions = permissions
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '统一认证失败'
  } finally {
    checking.value = false
  }
})
</script>
