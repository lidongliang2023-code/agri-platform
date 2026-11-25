<template>
  <div v-if="error" style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f7f5">
    <section style="width: 430px; max-width: 100%; padding: 30px; border: 1px solid #e1e9e3; border-radius: 15px; background: #fff; text-align: center">
      <div style="width: 56px; height: 56px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 15px; background: #2d8f4e; color: #fff; font-size: 25px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 21px">统一登录未完成</h2>
      <p style="margin: 12px 0 22px; color: #6b7c72; font-size: 14px; line-height: 1.7">{{ error }}</p>
      <button type="button" style="height: 40px; padding: 0 22px; border: 0; border-radius: 8px; background: #2d8f4e; color: #fff; cursor: pointer" @click="retry">重新登录</button>
    </section>
  </div>
  <div v-else-if="denied" style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f7f5">
    <section style="width: 430px; max-width: 100%; padding: 30px; border: 1px solid #e1e9e3; border-radius: 15px; background: #fff; text-align: center">
      <div style="width: 56px; height: 56px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 15px; background: #2d8f4e; color: #fff; font-size: 25px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 21px">暂无资讯访问权限</h2>
      <p style="margin: 12px 0 22px; color: #6b7c72; font-size: 14px; line-height: 1.7">当前账号「{{ deniedAccount }}」没有平台资讯访问权限（info:admin）。请使用有权限的运营账号登录。</p>
      <button type="button" style="height: 40px; padding: 0 22px; border: 0; border-radius: 8px; background: #2d8f4e; color: #fff; cursor: pointer" @click="retry">重新登录</button>
    </section>
  </div>
  <div v-else-if="checking || !ready" style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f7f5">
    <section style="width: 430px; max-width: 100%; padding: 30px; border: 1px solid #e1e9e3; border-radius: 15px; background: #fff; text-align: center">
      <div style="width: 56px; height: 56px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 15px; background: #2d8f4e; color: #fff; font-size: 25px; font-weight: 800">丰</div>
      <h2 style="margin: 0; color: #0b1a12; font-size: 21px">正在连接统一认证中心</h2>
      <p style="margin: 12px 0 22px; color: #6b7c72; font-size: 14px; line-height: 1.7">正在核验统一账号与资讯访问权限，请稍候…</p>
    </section>
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
  loadPermissions,
  redirectToSso,
  restoreSession,
  routeTarget,
  ucSession,
  type LoginResult,
} from '../sso'

const props = defineProps<{
  clientId: string
  landingPath: string
  requiredPermissions: string[]
}>()

const checking = ref(true)
const error = ref('')
const denied = ref(false)
const deniedAccount = ref('')
const ready = computed(() => Boolean(ucSession.user))

function retry() {
  checking.value = true
  error.value = ''
  denied.value = false
  void redirectToSso(props.clientId, routeTarget())
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
      login = await restoreSession(props.clientId)
    }
    if (!login) {
      await redirectToSso(props.clientId, routeTarget())
      return
    }
    const permissions = await loadPermissions()
    const allowed = props.requiredPermissions.every((permission) => granted(permissions, permission))
    if (!allowed) {
      deniedAccount.value = login.user.username
      denied.value = true
      clearSession()
      return
    }
    ucSession.user = login.user
    ucSession.permissions = permissions
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '统一认证失败'
  } finally {
    checking.value = false
  }
})
</script>
