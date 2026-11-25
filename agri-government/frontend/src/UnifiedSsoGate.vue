<template>
  <div
    v-if="error"
    style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f6fa"
  >
    <section
      style="width: 460px; max-width: 100%; padding: 32px; border: 1px solid #e8e8e8; border-radius: 8px; background: #fff; text-align: center"
    >
      <div
        style="width: 48px; height: 48px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 8px; background: #2d8f4e; color: #fff; font-size: 22px; font-weight: 700"
      >
        丰
      </div>
      <h2 style="margin: 0; color: #1a1a1a; font-size: 20px">统一登录未完成</h2>
      <p style="margin: 12px 0 24px; color: #595959; font-size: 14px; line-height: 1.7">{{ error }}</p>
      <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px">
        <button
          type="button"
          style="height: 36px; padding: 0 20px; border: 0; border-radius: 4px; background: #2d8f4e; color: #fff; font-size: 14px; cursor: pointer"
          @click="retry"
        >
          重新登录
        </button>
      </div>
    </section>
  </div>

  <div
    v-else-if="denied === 'inspector'"
    style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f6fa"
  >
    <section
      style="width: 460px; max-width: 100%; padding: 32px; border: 1px solid #e8e8e8; border-radius: 8px; background: #fff; text-align: center"
    >
      <div
        style="width: 48px; height: 48px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 8px; background: #2d8f4e; color: #fff; font-size: 22px; font-weight: 700"
      >
        丰
      </div>
      <h2 style="margin: 0; color: #1a1a1a; font-size: 20px">请使用移动执法端办理执法业务</h2>
      <p style="margin: 12px 0 24px; color: #595959; font-size: 14px; line-height: 1.7">
        政府监管 PC 端面向被监管经营主体办理监管业务（需 gov:citizen 权限）。当前账号为执法人员角色，请前往移动执法端开展现场检查、任务与取证。
      </p>
      <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px">
        <a
          :href="mobileUrl"
          style="display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 20px; border-radius: 4px; background: #2d8f4e; color: #fff; font-size: 14px; text-decoration: none"
        >
          前往移动执法端
        </a>
        <button
          type="button"
          style="height: 36px; padding: 0 20px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; color: #1a1a1a; font-size: 14px; cursor: pointer"
          @click="switchAccount"
        >
          切换其他账号
        </button>
      </div>
    </section>
  </div>

  <div
    v-else-if="denied === 'general'"
    style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f6fa"
  >
    <section
      style="width: 460px; max-width: 100%; padding: 32px; border: 1px solid #e8e8e8; border-radius: 8px; background: #fff; text-align: center"
    >
      <div
        style="width: 48px; height: 48px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 8px; background: #2d8f4e; color: #fff; font-size: 22px; font-weight: 700"
      >
        丰
      </div>
      <h2 style="margin: 0; color: #1a1a1a; font-size: 20px">暂无政府监管主体端访问权限</h2>
      <p style="margin: 12px 0 24px; color: #595959; font-size: 14px; line-height: 1.7">
        当前统一账号没有政府监管访问权限，请联系平台运营开通，或切换其他账号登录。
      </p>
      <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px">
        <button
          type="button"
          style="height: 36px; padding: 0 20px; border: 0; border-radius: 4px; background: #2d8f4e; color: #fff; font-size: 14px; cursor: pointer"
          @click="switchAccount"
        >
          切换其他账号
        </button>
      </div>
    </section>
  </div>

  <div
    v-else-if="checking || !ready"
    style="min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f6fa"
  >
    <section
      style="width: 460px; max-width: 100%; padding: 32px; border: 1px solid #e8e8e8; border-radius: 8px; background: #fff; text-align: center"
    >
      <div
        style="width: 48px; height: 48px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 8px; background: #2d8f4e; color: #fff; font-size: 22px; font-weight: 700"
      >
        丰
      </div>
      <h2 style="margin: 0; color: #1a1a1a; font-size: 20px">正在连接统一认证中心</h2>
      <p style="margin: 12px 0 24px; color: #595959; font-size: 14px; line-height: 1.7">
        正在核验统一账号与政府监管权限，请稍候…
      </p>
    </section>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CALLBACK_PATH,
  RETURN_KEY,
  exchangeCode,
  granted,
  loadPermissions,
  logoutUnified,
  mobileEnforcementUrl,
  redirectToSso,
  restoreSession,
  routeTarget,
  unifiedSession,
  type LoginResult,
} from './sso'

const props = defineProps<{
  clientId: string
  landingPath: string
  requiredPermissions: string[]
}>()

const checking = ref(true)
const error = ref('')
const denied = ref<'none' | 'inspector' | 'general'>('none')
const ready = computed(() => Boolean(unifiedSession.user))
const mobileUrl = computed(() => mobileEnforcementUrl())

function retry() {
  checking.value = true
  error.value = ''
  denied.value = 'none'
  void redirectToSso(props.clientId, routeTarget())
}

function switchAccount() {
  void logoutUnified(props.clientId)
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
      await redirectToSso(props.clientId, routeTarget())
      return
    }
    const permissions = await loadPermissions()
    const allowed = props.requiredPermissions.every((p) => granted(permissions, p))
    if (!allowed) {
      const isInspector = granted(permissions, 'gov:inspector') || granted(permissions, 'gov.oversight')
      denied.value = isInspector ? 'inspector' : 'general'
      return
    }
    unifiedSession.user = login.user
    unifiedSession.permissions = permissions
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '统一认证失败'
  } finally {
    checking.value = false
  }
})
</script>
