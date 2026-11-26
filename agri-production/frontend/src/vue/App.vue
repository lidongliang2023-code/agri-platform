<template>
  <a-config-provider :locale="zhCN" :theme="productionTheme">
    <RouterView v-if="authReady" />
    <div v-else class="production-boot-spin">
      <a-spin size="large" />
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ConfigProvider as AConfigProvider, Spin as ASpin } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { RouterView } from 'vue-router'
import { bootstrapAuthRefresh, installAuthRefreshInterceptor } from '@/api/auth'
import useAuthStore from '@/vue/authStore'
import { productionTheme } from '@/styles/productionTheme'
import '@agri/shared/styles/global.less'
import '@/styles/production-member-theme.css'

installAuthRefreshInterceptor()
void bootstrapAuthRefresh()

const authReady = useAuthStore((state) => state.authReady)
</script>

<style scoped>
.production-boot-spin {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>
