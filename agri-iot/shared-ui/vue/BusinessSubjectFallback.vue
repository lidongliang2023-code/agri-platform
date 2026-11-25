<template>
  <div class="iot-subject-fallback">
    <a-spin v-if="loading || switching" :tip="switching ? '正在切换经营主体…' : '正在核验经营主体…'">
      <div style="min-height: 140px" />
    </a-spin>
    <a-alert
      v-else
      :type="error ? 'error' : 'info'"
      show-icon
      :message="error || '当前账号暂无可用经营主体'"
      description="业务数据按统一账号当前经营主体加载，请重试或前往统一账号完善主体关联。"
    >
      <template #action>
        <a-button @click="error ? emit('reload') : emit('go-sso')">
          {{ error ? '重新加载' : '前往统一账号' }}
        </a-button>
      </template>
    </a-alert>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  switching: boolean
  error: string
}>()

const emit = defineEmits<{
  reload: []
  'go-sso': []
}>()
</script>
