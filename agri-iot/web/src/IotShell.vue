<template>
  <div class="iot-shell" :class="{ collapsed }">
    <aside class="iot-sidebar">
      <button type="button" class="iot-brand" @click="routeStore.navigate('/dashboard')">
        <img class="iot-brand-logo" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
        <div v-if="!collapsed">
          <b>丰链云</b>
          <small>FENGCHAIN · AGRI</small>
        </div>
      </button>

      <WorkspaceNavigation
        client-id="iot"
        :groups="MENU"
        :selected="routeStore.page"
        :collapsed="collapsed"
        :mobile-open="mobileOpen"
        @navigate="(key) => routeStore.navigate(`/${key}`)"
        @mobile-close="mobileOpen = false"
      />

      <div class="pc-side-user">
        <SidebarUserCard
          client-id="iot"
          role-label="物联网用户"
          :collapsed="collapsed"
          :switch-url="opsSwitchUrl"
          switch-label="切换身份（运营端）"
        />
      </div>
    </aside>

    <div class="iot-main">
      <AgriVueTopHeader
        header-class="iot-header"
        right-class="iot-header-right"
        :collapsed="collapsed"
        :mobile="isMobile"
        :mobile-open="mobileOpen"
        :breadcrumbs="['物联网管理', IOT_TITLES[routeStore.page]]"
        @toggle-collapse="toggleCollapse"
      >
        <template #center>
          <BusinessSubjectPicker
            :merchants="subject.summary.value?.merchants ?? []"
            :active-id="subject.active.value ? String(subject.active.value.merchantId) : undefined"
            :loading="subject.loading.value"
            :switching="subject.switching.value"
            :error="subject.error.value"
            @switch="(id) => void subject.switchSubject(id)"
            @reload="() => void subject.load()"
          />
        </template>
        <template #right>
          <span>{{ clock.date }}</span>
          <MessageBadge v-if="subject.ready.value && !subject.busy.value" @open="routeStore.navigate('/messages')" />
          <AccountMenu client-id="iot" />
        </template>
      </AgriVueTopHeader>

      <AgriVueWorkspaceTabs
        :active-key="routeStore.page"
        :active-label="IOT_TITLES[routeStore.page]"
        :active-path="routeStore.activePath"
        home-key="dashboard"
        :home-label="IOT_TITLES.dashboard"
        storage-key="agri-iot-web:workspace-tabs"
        @navigate="(path) => routeStore.navigate(`/${path}`)"
      />

      <main>
        <div v-if="subject.ready.value" style="position: relative; min-height: 200px" :aria-busy="subject.busy.value">
          <div :style="subject.busy.value ? { opacity: 0.35, pointerEvents: 'none' } : undefined">
            <DashboardView v-if="routeStore.page === 'dashboard' || routeStore.page === 'monitor'" :initial="routeStore.page === 'monitor' ? 'monitor' : 'dashboard'" />
            <DevicesView v-else-if="routeStore.page === 'devices'" />
            <GatewaysView v-else-if="routeStore.page === 'gateways'" />
            <PlotsView v-else-if="routeStore.page === 'plots'" />
            <AlertsView v-else-if="routeStore.page === 'alerts'" />
            <AutomationView v-else-if="routeStore.page === 'automation'" />
            <AnalyticsView v-else-if="routeStore.page === 'analytics'" />
            <MaintenanceView v-else-if="routeStore.page === 'maintenance'" />
            <MessagesView v-else-if="routeStore.page === 'messages'" />
          </div>
          <div v-if="subject.busy.value" style="position: absolute; inset: 0; z-index: 20; background: rgba(244, 247, 245, 0.7)">
            <BusinessSubjectFallback
              :loading="subject.loading.value"
              :switching="subject.switching.value"
              :error="subject.error.value"
              @reload="() => void subject.load()"
              @go-sso="subject.goSso"
            />
          </div>
        </div>
        <BusinessSubjectFallback
          v-else
          :loading="subject.loading.value"
          :switching="subject.switching.value"
          :error="subject.error.value"
          @reload="() => void subject.load()"
          @go-sso="subject.goSso"
        />
      </main>
      <footer>© 2026 农业产业互联网平台 · 物联网管理系统</footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertOutlined,
  ApiOutlined,
  BarChartOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  SlidersOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import WorkspaceNavigation, { type NavigationGroup } from '../../shared-ui/vue/WorkspaceNavigation.vue'
import AccountMenu from '../../shared-ui/vue/AccountMenu.vue'
import SidebarUserCard from '../../shared-ui/vue/SidebarUserCard.vue'
import BusinessSubjectPicker from '../../shared-ui/vue/BusinessSubjectPicker.vue'
import BusinessSubjectFallback from '../../shared-ui/vue/BusinessSubjectFallback.vue'
import { useBusinessSubject } from '../../shared-ui/vue/useBusinessSubject'
import { useClock } from '../../shared-ui/vue/useClock'
import MessageBadge from './components/MessageBadge.vue'
import DashboardView from './views/DashboardView.vue'
import DevicesView from './views/DevicesView.vue'
import GatewaysView from './views/GatewaysView.vue'
import PlotsView from './views/PlotsView.vue'
import AlertsView from './views/AlertsView.vue'
import AutomationView from './views/AutomationView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import MaintenanceView from './views/MaintenanceView.vue'
import MessagesView from './views/MessagesView.vue'
import { IOT_TITLES, useIotRouteStore } from './stores/iotRoute'

const MENU: NavigationGroup[] = [
  {
    group: '监测总览',
    items: [
      { page: 'dashboard', label: '监测工作台', icon: DashboardOutlined },
      { page: 'monitor', label: '实时监测大屏', icon: BarChartOutlined },
      { page: 'plots', label: '地块监测', icon: EnvironmentOutlined },
    ],
  },
  {
    group: '设备资产',
    items: [
      { page: 'devices', label: '设备管理', icon: CloudServerOutlined },
      { page: 'gateways', label: '边缘网关', icon: ApiOutlined },
    ],
  },
  {
    group: '告警与自动化',
    items: [
      { page: 'alerts', label: '预警中心', icon: AlertOutlined },
      { page: 'automation', label: '场景与自动化', icon: SlidersOutlined },
    ],
  },
  {
    group: '分析与运维',
    items: [
      { page: 'analytics', label: '数据分析', icon: BarChartOutlined },
      { page: 'maintenance', label: '运维与 OTA', icon: ToolOutlined },
    ],
  },
  {
    group: '消息通知',
    items: [{ page: 'messages', label: '消息中心', icon: MessageOutlined }],
  },
]

const routeStore = useIotRouteStore()
// UnifiedSsoGate 恢复目标地址后才挂载 IotShell，此时立刻从 window.location 同步首屏路径（保障 /devices 直达）
routeStore.syncFromWindow()

const baseUrl = import.meta.env.BASE_URL
const opsSwitchUrl = `${window.location.protocol}//${window.location.hostname}:8102/`
const clock = useClock()
const subject = useBusinessSubject()

const collapsed = ref(window.innerWidth >= 1024 && window.innerWidth < 1280)
const isMobile = ref(window.innerWidth < 1024)
const mobileOpen = ref(false)

function syncLayout() {
  const w = window.innerWidth
  isMobile.value = w < 1024
  if (w >= 1024 && w < 1280) collapsed.value = true
  else if (w >= 1280) collapsed.value = false
  if (w >= 1024) mobileOpen.value = false
}

function toggleCollapse() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

function normalizeLocation() {
  if (routeStore.pathname === '/') {
    routeStore.navigate('/dashboard', { replace: true })
  } else if (routeStore.pathname.replace(/\/+$/, '') === '/alert-rules') {
    const params = new URLSearchParams(routeStore.search)
    params.set('tab', 'rules')
    routeStore.navigate(`/alerts?${params.toString()}${routeStore.hash}`, { replace: true })
  }
}

watch(() => routeStore.pathname, normalizeLocation, { immediate: true })

function handlePopState() {
  routeStore.syncFromWindow()
}

onMounted(() => {
  window.addEventListener('resize', syncLayout)
  window.addEventListener('popstate', handlePopState)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncLayout)
  window.removeEventListener('popstate', handlePopState)
})
</script>
