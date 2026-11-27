<template>
  <a-layout class="agri-layout" :class="{ 'production-member-shell': !admin, 'is-embedded': embedded }">
    <a-layout-sider v-if="!mobile && !embedded" class="agri-sider" :collapsed="collapsed" :width="240" :collapsed-width="80" :trigger="null" theme="dark">
      <Navigation />
    </a-layout-sider>
    <a-drawer v-if="!embedded" title="生产管理导航" placement="left" :width="240" :open="mobile && navigationOpen" @close="navigationOpen = false"><Navigation /></a-drawer>
    <a-layout class="agri-main" :style="{ marginLeft: mobile || embedded ? 0 : collapsed ? '80px' : '240px' }">
      <AgriVueTopHeader v-if="!embedded" class="agri-header" :collapsed="collapsed" :mobile="mobile" :mobile-open="navigationOpen" :breadcrumbs="breadcrumb" @toggle-collapse="toggleNavigation">
        <template #right>
          <div v-if="!admin" class="agri-header-context"><ContextSelectors /></div>
          <a-badge :count="admin ? 0 : unread.data.value ?? 0" size="small"><a-button type="text" :aria-label="admin ? '告警中心' : '消息中心'" @click="router.push(admin ? '/admin/production/alerts' : '/production/messages')"><BellOutlined /></a-button></a-badge>
          <a-dropdown :trigger="['click']"><a-space role="button" tabindex="0" aria-label="账号菜单" style="cursor:pointer"><a-avatar size="small" :src="user?.avatar">{{ displayName.slice(0, 1) }}</a-avatar><span>{{ displayName }}</span></a-space><template #overlay><AccountMenu /></template></a-dropdown>
        </template>
      </AgriVueTopHeader>
      <div v-else-if="!admin" class="agri-embedded-header"><ContextSelectors /></div>
      <a-layout-content class="agri-content agri-workspace-host">
        <template v-if="!admin && !subjectReady">
          <a-spin v-if="subjectsQuery.isPending.value || switching" tip="正在加载经营主体"><div style="min-height:200px" /></a-spin>
          <a-alert v-else :type="subjectsQuery.error.value ? 'error' : 'info'" show-icon :message="subjectsQuery.error.value ? '经营主体加载失败' : subjects.length ? '请选择当前经营主体' : '当前账号暂无关联经营主体'" :description="subjectsQuery.error.value?.message">
            <template #action><a-space><a-button @click="subjectsQuery.refetch()">重新加载</a-button><a-button @click="services.reauthenticate(route.fullPath)">前往统一登录</a-button></a-space></template>
          </a-alert>
        </template>
        <a-spin v-else wrapper-class-name="production-workspace-loading" :spinning="switching" tip="正在切换经营主体">
          <div class="agri-workspace" :inert="switching ? true : undefined" :aria-busy="switching">
            <ProductionWorkspace :admin="admin" :embedded="embedded" :context-key="contextKey" />
          </div>
        </a-spin>
      </a-layout-content>
      <a-layout-footer v-if="!embedded" class="agri-footer">© 2026 农业产业互联网平台 · {{ title }}</a-layout-footer>
    </a-layout>
  </a-layout>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Avatar as AAvatar, Alert as AAlert, Badge as ABadge, Button as AButton, Drawer as ADrawer, Dropdown as ADropdown, Layout as ALayout, LayoutSider as ALayoutSider, LayoutContent as ALayoutContent, LayoutFooter as ALayoutFooter, Space as ASpace, Spin as ASpin, Menu, Select, message } from 'ant-design-vue'
import { BellOutlined, DashboardOutlined, HomeOutlined, CalendarOutlined, ExperimentOutlined, MonitorOutlined, InboxOutlined, SafetyCertificateOutlined, SwapOutlined, BarChartOutlined, SettingOutlined, DatabaseOutlined, RobotOutlined } from '@ant-design/icons-vue'
import { AgriVueTopHeader } from '@agri/shared/vue/workspace'
import menus from '../../../../packages/agri-shared/src/production/menus.json'
import ProductionWorkspace from './ProductionWorkspace'
import type { AuthUser } from './authStore'
import type { CurrentFarm } from './farmStore'
import '../layouts/BasicLayout.css'
import '../layouts/EmbeddedWorkspace.css'
import '../components/ProductionWorkspaceTabs.css'
import './production-member-lists.css'

interface Subject { merchantId: string; merchantName?: string; active?: boolean }
interface Summary { activeMerchantId?: string; merchants: Subject[] }
export interface ProductionLayoutServices {
  getSubjects: (signal: AbortSignal) => Promise<Summary>
  activateSubject: (id: string) => Promise<{ activeMerchantId: string; merchantName?: string }>
  getFarms: () => Promise<CurrentFarm[]>
  getUnreadCount: () => Promise<number>
  setUser: (user: AuthUser) => void
  setFarm: (farm: CurrentFarm | null) => void
  setFarmOptions: (farms: CurrentFarm[]) => void
  reauthenticate: (returnTo: string) => void
  logout: () => void
}
const props = withDefaults(defineProps<{ admin?: boolean; embedded?: boolean; title?: string; user: AuthUser | null; tokenReady: boolean; tokenExpireAt?: number; marketId?: number | null; currentFarm: CurrentFarm | null; farmOptions: CurrentFarm[]; services: ProductionLayoutServices }>(), { admin: false, embedded: false, title: '生产管理', tokenExpireAt: 0, marketId: null })
const route = useRoute(), router = useRouter(), client = useQueryClient()
const mobileMedia = window.matchMedia('(max-width:1023px)'), compactMedia = window.matchMedia('(min-width:1024px) and (max-width:1279px)')
const mobile = ref(mobileMedia.matches), collapsed = ref(compactMedia.matches), navigationOpen = ref(false), switching = ref(false), openKeys = ref<string[]>([])
const syncViewport = () => { mobile.value = mobileMedia.matches; navigationOpen.value = false; if (!mobile.value) collapsed.value = compactMedia.matches }
mobileMedia.addEventListener('change', syncViewport); compactMedia.addEventListener('change', syncViewport)
onBeforeUnmount(() => { mobileMedia.removeEventListener('change', syncViewport); compactMedia.removeEventListener('change', syncViewport) })
const groups = computed(() => props.admin ? menus.admin : menus.user)
const matched = computed(() => {
  let best: { group: typeof menus.user[number]; leaf: { key: string; label: string } } | undefined
  for (const group of groups.value) for (const leaf of group.children) if ((route.path === leaf.key || route.path.startsWith(`${leaf.key}/`)) && (!best || leaf.key.length > best.leaf.key.length)) best = { group, leaf }
  return best
})
const breadcrumb = computed(() => {
  const pageName = String(route.meta.name ?? '').trim()
  if (matched.value) {
    const items = ['首页', matched.value.group.label, matched.value.leaf.label]
    if (route.path !== matched.value.leaf.key && pageName && pageName !== matched.value.leaf.label) {
      items.push(pageName)
    }
    return items
  }
  return ['首页', pageName || props.title]
})
watch(() => route.fullPath, () => { navigationOpen.value = false })
watch(() => [matched.value?.group.key, collapsed.value, mobile.value], () => { const key = matched.value?.group.key; if (key && (mobile.value || !collapsed.value)) openKeys.value = props.admin ? Array.from(new Set([...openKeys.value, key])) : [key] }, { immediate: true })
const subjectsQuery = useQuery(computed(() => ({ queryKey: ['operating-subjects', props.user?.userId, props.marketId, props.tokenExpireAt], enabled: !props.admin && props.tokenReady && Boolean(props.user?.userId), queryFn: ({ signal }: { signal: AbortSignal }) => props.services.getSubjects(signal), retry: false, refetchOnWindowFocus: true })))
const subjects = computed(() => subjectsQuery.data.value?.merchants ?? [])
const activeSubject = computed(() => subjects.value.find(item => String(item.merchantId) === String(subjectsQuery.data.value?.activeMerchantId)))
const subjectReady = computed(() => !subjectsQuery.error.value && Boolean(activeSubject.value) && props.user?.tenantId === String(activeSubject.value?.merchantId))
watch(() => [subjectsQuery.data.value, subjectsQuery.error.value, props.admin], () => {
  if (props.admin || !subjectsQuery.data.value || subjectsQuery.error.value || !props.user) return
  const id = activeSubject.value ? String(activeSubject.value.merchantId) : '', name = activeSubject.value?.merchantName ?? ''
  if (props.user.tenantId !== id || props.user.tenantName !== name) { props.services.setFarm(null); props.services.setFarmOptions([]); props.services.setUser({ ...props.user, tenantId: id, tenantName: name }) }
})
const unread = useQuery(computed(() => ({ queryKey: ['messages', 'unread-count', props.user?.tenantId], enabled: props.admin || subjectReady.value, queryFn: props.services.getUnreadCount, retry: false })))
const farms = useQuery(computed(() => ({ queryKey: ['farms', 'all', props.user?.tenantId], enabled: !props.admin && subjectReady.value && !switching.value, queryFn: props.services.getFarms, retry: false })))
watch(() => farms.data.value, values => { if (values) props.services.setFarmOptions(values) })
const displayName = computed(() => props.user?.realName || props.user?.username || (props.admin ? '平台运营' : '农场用户'))
const contextKey = computed(() => `${props.admin}:${props.user?.userId}:${props.user?.tenantId}:${props.currentFarm?.farmId ?? ''}`)
const icons: Record<string, typeof HomeOutlined> = { dashboard: DashboardOutlined, farm: HomeOutlined, 'smart-farming': CalendarOutlined, input: ExperimentOutlined, growth: MonitorOutlined, harvest: InboxOutlined, quality: SafetyCertificateOutlined, p2t: SwapOutlined, analytics: BarChartOutlined, settings: SettingOutlined, 'ops-dashboard': DashboardOutlined, 'farm-supervision': HomeOutlined, 'base-data': DatabaseOutlined, monitor: MonitorOutlined, trace: SafetyCertificateOutlined, 'ai-center': RobotOutlined, report: BarChartOutlined }
function toggleNavigation() { if (mobile.value) navigationOpen.value = !navigationOpen.value; else collapsed.value = !collapsed.value }
async function switchSubject(id: string) {
  if (switching.value || id === String(activeSubject.value?.merchantId) || !subjects.value.some(item => String(item.merchantId) === id)) return
  switching.value = true
  try {
    const activated = await props.services.activateSubject(id)
    await client.cancelQueries(); client.removeQueries({ predicate: query => query.queryKey[0] !== 'operating-subjects' })
    const nativeWorkspace = sessionStorage.getItem('agri_native_workspace') === '1'
    if (nativeWorkspace) await router.replace(props.admin ? '/admin/production/dashboard' : '/production/dashboard')
    client.setQueryData(['operating-subjects', props.user?.userId, props.marketId, props.tokenExpireAt], { ...subjectsQuery.data.value, activeMerchantId: String(activated.activeMerchantId) })
    if (props.user) props.services.setUser({ ...props.user, tenantId: String(activated.activeMerchantId), tenantName: activated.merchantName })
    props.services.setFarm(null); props.services.setFarmOptions([])
    if (nativeWorkspace) { await subjectsQuery.refetch(); switching.value = false }
    else window.location.replace(props.admin ? '/admin/production/dashboard' : '/production/dashboard')
  } catch (error) { message.error(error instanceof Error ? error.message : '经营主体切换失败'); switching.value = false; void subjectsQuery.refetch() }
}
const AccountMenu = defineComponent({ setup: () => () => h(Menu, { items: [
  { key: 'personal', label: '个人中心', onClick: () => window.open(`${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`, '_blank', 'noopener') },
  ...(!props.admin ? [{ key: 'settings', label: '系统设置', onClick: () => router.push('/production/settings') }] : []),
  { key: 'role', label: props.admin ? '切换身份（用户端）' : '切换身份（运营端）', onClick: () => router.push(props.admin ? '/production/dashboard' : '/admin/production/dashboard') },
  { type: 'divider' }, { key: 'logout', label: '退出登录', danger: true, onClick: props.services.logout },
] }) })
const Navigation = defineComponent({ setup: () => () => h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } }, [
  h('div', { class: 'agri-brand' }, [h('strong', { class: 'agri-brand-logo' }, 'AGRI'), !collapsed.value || mobile.value ? h('span', { class: 'agri-brand-text' }, [h('strong', '丰链云'), h('small', 'FENGCHAIN · AGRI')]) : null]),
  h('div', { class: 'agri-sider-menu-scroll' }, [h(Menu, { mode: 'inline', theme: 'dark', inlineCollapsed: !mobile.value && collapsed.value, openKeys: collapsed.value && !mobile.value ? undefined : openKeys.value, selectedKeys: matched.value ? [matched.value.leaf.key] : [], items: groups.value.map(group => ({ key: group.key, label: group.label, icon: icons[group.key] ? () => h(icons[group.key]) : undefined, children: group.children })), onOpenChange: keys => { const next = keys.map(String), added = next.find(key => !openKeys.value.includes(key)); openKeys.value = props.admin ? next : added ? [added] : next.slice(-1) }, onClick: ({ key }) => { void router.push(String(key)); navigationOpen.value = false } })]),
  h('div', { class: 'pc-side-user' }, [h(ADropdown, { trigger: ['click'], placement: 'topRight' }, { default: () => h('button', { class: 'pc-side-user-trigger', type: 'button' }, [h('span', { class: 'pc-side-user-avatar' }, displayName.value.slice(0, 1)), !collapsed.value || mobile.value ? h('span', { class: 'pc-side-user-meta' }, [h('strong', displayName.value), h('small', props.admin ? '生产运营管理' : activeSubject.value?.merchantName || '经营主体用户')]) : null]), overlay: () => h(AccountMenu) })]),
]) })
const ContextSelectors = defineComponent({ setup: () => () => h(ASpace, { size: 8 }, () => [
  h(Select, { 'aria-label': '当前经营主体', class: 'agri-subject-select', style: props.embedded ? undefined : { width: '240px', maxWidth: '35vw' }, showSearch: true, optionFilterProp: 'label', loading: subjectsQuery.isPending.value || switching.value, disabled: subjectsQuery.isPending.value || switching.value || Boolean(subjectsQuery.error.value), value: activeSubject.value ? String(activeSubject.value.merchantId) : undefined, placeholder: '请选择经营主体', options: subjects.value.map(item => ({ value: String(item.merchantId), label: item.merchantName || `主体 ${item.merchantId}` })), onChange: value => { void switchSubject(String(value)) } }),
  h(Select, { 'aria-label': '当前农场', class: 'agri-farm-select', style: { width: '180px' }, disabled: !subjectReady.value || switching.value, value: subjectReady.value ? props.currentFarm?.farmId : undefined, placeholder: '请选择当前农场', options: props.farmOptions.map(item => ({ value: item.farmId, label: item.farmName })), onChange: value => { const farm = props.farmOptions.find(item => item.farmId === String(value)); if (farm) props.services.setFarm(farm) } }),
]) })
</script>
