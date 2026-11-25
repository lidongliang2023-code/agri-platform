<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate
      client-id="iot"
      landing-path="/dashboard"
      :required-permissions="IOT_PERMISSIONS"
    >
      <IotShell />
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import UnifiedSsoGate from '../../shared-ui/vue/UnifiedSsoGate.vue'
import IotShell from './IotShell.vue'

const IOT_PERMISSIONS = ['iot:read', 'iot:write']

const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBorder: '#e8e8e8',
    colorBgLayout: '#f5f6fa',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
  },
}
</script>
