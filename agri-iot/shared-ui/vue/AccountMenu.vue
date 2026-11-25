<template>
  <a-dropdown :trigger="['click']">
    <button type="button" class="iot-account-menu" aria-label="账号菜单" aria-haspopup="menu" :disabled="exiting">
      <span class="iot-account-avatar">{{ name.slice(0, 1) }}</span>
      <span class="iot-account-name">
        <b>{{ name }}</b>
        <small>统一平台账号</small>
      </span>
      <DownOutlined />
    </button>
    <template #overlay>
      <a-menu @click="handleClick">
        <template v-if="showLogs">
          <a-menu-item key="logs">操作审计</a-menu-item>
          <a-menu-divider />
        </template>
        <a-menu-item key="logout" :disabled="exiting">
          <LogoutOutlined /> {{ exiting ? '正在退出…' : '退出登录' }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DownOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { iotSession, logoutUnified } from './sso'

const props = defineProps<{
  clientId: string
  showLogs?: boolean
}>()

const emit = defineEmits<{
  logs: []
}>()

const exiting = ref(false)
const name = computed(() => iotSession.user?.nickname || iotSession.user?.username || '物联网用户')

async function handleClick({ key }: { key: string | number }) {
  if (key === 'logs') {
    emit('logs')
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
