<template>
  <a-dropdown :trigger="['click']" :placement="collapsed ? 'topRight' : 'topLeft'">
    <button type="button" class="pc-side-user-trigger" :title="`${name} · ${roleLabel}`" :disabled="exiting">
      <span class="pc-side-user-avatar">{{ name.slice(0, 1) }}</span>
      <template v-if="!collapsed">
        <span class="pc-side-user-meta">
          <strong>{{ name }}</strong>
          <small>{{ roleLabel }}</small>
        </span>
        <span class="pc-side-user-caret"><UpOutlined /></span>
      </template>
    </button>
    <template #overlay>
      <a-menu @click="handleClick">
        <a-menu-item key="personal"><UserOutlined /> 个人中心</a-menu-item>
        <a-menu-item key="switch"><SwapOutlined /> {{ switchLabel }}</a-menu-item>
        <a-menu-divider />
        <a-menu-item key="logout" danger :disabled="exiting">
          <LogoutOutlined /> {{ exiting ? '正在退出…' : '退出登录' }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { LogoutOutlined, SwapOutlined, UpOutlined, UserOutlined } from '@ant-design/icons-vue'
import { iotSession, logoutUnified } from './sso'

const props = defineProps<{
  clientId: string
  roleLabel: string
  switchUrl: string
  switchLabel: string
  collapsed: boolean
}>()

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
const exiting = ref(false)
const name = computed(() => iotSession.user?.nickname || iotSession.user?.username || '物联网用户')

async function handleClick({ key }: { key: string | number }) {
  if (key === 'personal') {
    window.open(PERSONAL_CENTER, '_blank', 'noopener')
  } else if (key === 'switch') {
    window.location.href = props.switchUrl
  } else if (key === 'logout') {
    exiting.value = true
    try {
      await logoutUnified(props.clientId)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '退出失败，请重试')
      exiting.value = false
    }
  }
}
</script>
