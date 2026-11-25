<template>
  <div class="pc-side-user">
    <a-dropdown :trigger="['click']" :placement="collapsed ? 'topRight' : 'topLeft'">
      <button
        type="button"
        class="pc-side-user-trigger"
        :title="`${displayName} · ${role}`"
        :style="collapsed ? { justifyContent: 'center', padding: '6px 0', gap: 0 } : undefined"
      >
        <span class="pc-side-user-avatar">{{ displayName.slice(0, 1) }}</span>
        <template v-if="!collapsed">
          <span class="pc-side-user-meta">
            <strong>{{ displayName }}</strong>
            <small>{{ role }}</small>
          </span>
          <span class="pc-side-user-caret"><UpOutlined /></span>
        </template>
      </button>
      <template #overlay>
        <a-menu @click="handleClick">
          <a-menu-item key="personal"><UserOutlined /> 个人中心</a-menu-item>
          <a-menu-item key="switch"><SwapOutlined /> {{ switchLabel }}</a-menu-item>
          <a-menu-divider />
          <a-menu-item key="logout" danger><LogoutOutlined /> 退出登录</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LogoutOutlined, SwapOutlined, UpOutlined, UserOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  name: string
  role: string
  collapsed: boolean
  switchLabel: string
  switchUrl: string
}>()

const emit = defineEmits<{ logout: [] }>()
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
const displayName = computed(() => props.name || '平台用户')

function handleClick({ key }: { key: string | number }) {
  if (key === 'personal') window.open(PERSONAL_CENTER, '_blank', 'noopener')
  else if (key === 'switch') window.location.href = props.switchUrl
  else if (key === 'logout') emit('logout')
}
</script>
