<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate
      client-id="service"
      :landing-path="landingPath"
      :required-permissions="['service:consumer']"
    >
      <AppShell>
        <component :is="currentPageComponent" />
      </AppShell>
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, type Component } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useAppStore } from './app-context'
import type { PageKey } from './types'
import UnifiedSsoGate from './components/UnifiedSsoGate.vue'
import AppShell from './components/AppShell.vue'
import HomePage from './pages/HomePage.vue'
import ServicesPage from './pages/ServicesPage.vue'
import ProviderPage from './pages/ProviderPage.vue'
import OrdersPage from './pages/OrdersPage.vue'
import OrderDetailPage from './pages/OrderDetailPage.vue'
import DemandPage from './pages/DemandPage.vue'
import InsurancePage from './pages/InsurancePage.vue'
import PoliciesPage from './pages/PoliciesPage.vue'
import TrainingPage from './pages/TrainingPage.vue'
import ConsultPage from './pages/ConsultPage.vue'
import AiDiagnosePage from './pages/AiDiagnosePage.vue'
import ResourcesPage from './pages/ResourcesPage.vue'
import MessagesPage from './pages/MessagesPage.vue'
import JoinPage from './pages/JoinPage.vue'
import ContractsPage from './pages/ContractsPage.vue'
import ComplaintsPage from './pages/ComplaintsPage.vue'

const landingPath = window.location.port === '5194' ? '/#/home' : '/service/#/home'
const app = useAppStore()

const PAGE_MAP: Record<PageKey, Component> = {
  home: HomePage,
  services: ServicesPage,
  provider: ProviderPage,
  orders: OrdersPage,
  'order-detail': OrderDetailPage,
  demand: DemandPage,
  insurance: InsurancePage,
  policies: PoliciesPage,
  training: TrainingPage,
  consult: ConsultPage,
  'ai-diagnose': AiDiagnosePage,
  resources: ResourcesPage,
  messages: MessagesPage,
  join: JoinPage,
  contracts: ContractsPage,
  complaints: ComplaintsPage,
}

const currentPageComponent = computed(() => PAGE_MAP[app.page] ?? HomePage)

function handleHashChange() {
  app.syncFromWindow()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('hashchange', handleHashChange)
})
onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange)
})

const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorLinkHover: '#247a3f',
    colorSuccess: '#2d8f4e',
    colorWarning: '#d88718',
    colorError: '#c94b4b',
    colorText: '#0b1a12',
    colorTextSecondary: '#6b7c72',
    colorBorder: '#e1e9e3',
    colorBorderSecondary: '#edf2ee',
    colorBgLayout: '#f5f6fa',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, .12)',
  },
  components: {
    Button: { borderRadius: 4, primaryShadow: 'none', fontWeight: 500 },
    Input: { activeBorderColor: '#2d8f4e', hoverBorderColor: '#247a3f' },
    Select: { optionSelectedBg: '#e8f5e9' },
    Modal: { borderRadiusLG: 12, titleFontSize: 20 },
  },
}
</script>
