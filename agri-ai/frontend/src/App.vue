<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  AgriVueTopHeader,
  AgriVueWorkspaceTabs,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@agri/shared/vue/workspace'
import {
  AgriVueFilterBar,
  AgriVueRowActions,
  AgriVueTable,
} from '@agri/shared/vue/list'
import { createAiConsole } from './console'

const SIDEBAR_STORAGE_KEY = 'agri-ai:sidebar-collapsed'
const root = ref(null)
const menuOpen = ref(false)
const collapsed = ref(readSidebarCollapsed(SIDEBAR_STORAGE_KEY))
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 1023 : false)
const mobileOpen = ref(false)

const ui = reactive({
  ready: false,
  user: null,
  active: 'overview',
  content: '',
  notice: '',
  toast: '',
  bootMessage: '正在连接统一认证中心…',
  loginVisible: false,
  loggingOut: false,
  notifications: { unreadCount: 0, writable: true },
  notificationError: false,
})

const tableState = reactive({
  overviewRecent: [],
  scenes: [],
  sceneTotal: 0,
  sceneSelection: [],
  sceneSearch: '',
  sceneDomain: '',
  sceneModelSource: '',
  sceneModelProvider: '',
  sceneDomainOptions: [],
  sceneModelOptions: [],
  sceneBatchSaving: false,
  calls: [],
  callsTotal: 0,
  callsPage: 1,
  callsPageSize: 20,
  callsLoading: false,
  callKeyword: '',
  callStatus: '',
  promptSceneCode: '',
  promptPublishedVersion: null,
  promptVersions: [],
  promptEvents: [],
  drawerType: '',
  drawerTitle: '',
  drawerBusy: false,
  failoverData: null,
  failoverError: '',
  failoverFilters: { hours: '24', provider: '', outcome: 'ALL', page: 1, pageSize: 20 },
  failoverProviderOptions: [],
  alertData: null,
  alertError: '',
  alertFilters: { provider: '', type: 'ALL', unreadOnly: false, page: 1, pageSize: 20 },
  alertProviderOptions: [],
})

const navs = ref([])
let consoleApp

const username = computed(() => ui.user?.nickname || ui.user?.username || '平台管理员')
const crumb = computed(() => navs.value.find((n) => n[0] === ui.active)?.[1] || '运行概览')
const personalUrl = location.protocol + '//' + location.hostname + ':8098/portal/#/account/business'
const notificationTitle = computed(() =>
  ui.notificationError
    ? '通知暂时无法刷新，点击重试'
    : ui.notifications.writable
      ? '查看熔断和恢复通知'
      : '通知记录持久化异常，请检查存储',
)

const effectiveCollapsed = computed(() => (isMobile.value ? false : collapsed.value))

function updateViewport() {
  if (typeof window === 'undefined') return
  const nextMobile = window.innerWidth <= 1023
  if (!nextMobile) mobileOpen.value = false
  isMobile.value = nextMobile
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileOpen.value = !mobileOpen.value
    return
  }
  collapsed.value = !collapsed.value
  writeSidebarCollapsed(SIDEBAR_STORAGE_KEY, collapsed.value)
}

function navigate(path) {
  mobileOpen.value = false
  location.hash = path.startsWith('#') ? path : '#' + path
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function formatPct(value) {
  return value == null ? '—' : Number(value).toFixed(1) + '%'
}

function sceneNameOf(code) {
  return consoleApp?.nameOf(code) || code || '—'
}

function sceneModelText(scene) {
  return consoleApp?.sceneModelText(scene) || '—'
}

function eventActionText(action) {
  return (
    {
      CREATE_SCENE: '新增自定义场景',
      EDIT_SCENE: '修改场景',
      BIND_MODEL: '变更场景模型',
      BATCH_BIND_MODEL: '批量绑定模型',
      CREATE_DRAFT: '创建草稿',
      PUBLISH: '发布版本',
      ROLLBACK: '回滚版本',
    }[action] || action
  )
}

function circuitEventLabel(type) {
  return { OPEN: '通道熔断', REOPEN: '探测失败', RECOVERED: '恢复成功' }[type] || type
}

const overviewRecentColumns = [
  { key: 'scene', prop: 'sceneCode', label: '业务场景', width: 280, locked: true, ellipsis: false },
  { key: 'status', prop: 'status', label: '执行状态', width: 120, kind: 'status' },
  { key: 'latencyMs', prop: 'latencyMs', label: '响应耗时', width: 120, kind: 'number' },
  { key: 'time', prop: 'time', label: '调用时间', width: 180 },
]

const sceneColumns = [
  { key: 'scene', prop: 'name', label: '场景名称 / 编码', width: 250, locked: true, ellipsis: false },
  { key: 'domain', prop: 'domain', label: '业务子系统', width: 130 },
  { key: 'status', prop: 'enabled', label: '状态 / 提示词版本', width: 190, kind: 'status' },
  { key: 'model', prop: 'providerId', label: '模型路由 / 应用说明', width: 320, ellipsis: false },
  { key: 'action', label: '操作', width: 170, kind: 'action', fixed: 'right', locked: true },
]

const callColumns = [
  { key: 'scene', prop: 'sceneCode', label: '场景', width: 230, locked: true, ellipsis: false },
  { key: 'task', prop: 'taskId', label: '任务编号 / 来源', width: 280, ellipsis: false },
  { key: 'status', prop: 'status', label: '状态', width: 120, kind: 'status' },
  { key: 'latencyMs', prop: 'latencyMs', label: '耗时', width: 110, kind: 'number' },
  { key: 'time', prop: 'time', label: '时间', width: 180 },
  { key: 'action', label: '操作', width: 120, kind: 'action', fixed: 'right', locked: true },
]

const promptVersionColumns = [
  { key: 'version', prop: 'number', label: '版本', width: 100, locked: true },
  { key: 'status', prop: 'publishedAt', label: '状态', width: 120, kind: 'status' },
  { key: 'note', prop: 'note', label: '版本说明', width: 280, ellipsis: false },
  { key: 'creator', prop: 'createdBy', label: '创建账号 / 时间', width: 210, ellipsis: false },
  { key: 'action', label: '操作', width: 190, kind: 'action', fixed: 'right', locked: true },
]

const promptEventColumns = [
  { key: 'actionType', prop: 'action', label: '动作', width: 180, locked: true },
  { key: 'version', prop: 'version', label: '版本 / 变更', width: 240 },
  { key: 'operator', prop: 'operator', label: '操作账号', width: 160 },
  { key: 'time', prop: 'time', label: '时间', width: 180 },
]

const failoverChannelColumns = [
  { key: 'channel', prop: 'name', label: '通道', width: 200, locked: true, ellipsis: false },
  { key: 'requests', prop: 'requests', label: '实际尝试', width: 100, kind: 'number' },
  { key: 'outcome', prop: 'success', label: '成功 / 失败', width: 120, kind: 'number' },
  { key: 'skipped', prop: 'skipped', label: '熔断跳过', width: 100, kind: 'number' },
  { key: 'takeovers', prop: 'takeovers', label: '备用接管', width: 100, kind: 'number' },
  { key: 'successRate', prop: 'successRate', label: '成功率', width: 100, kind: 'number' },
  { key: 'averageLatencyMs', prop: 'averageLatencyMs', label: '平均耗时', width: 110, kind: 'number' },
]

const failoverReasonColumns = [
  { key: 'reason', prop: 'reason', label: '原因', width: 420, locked: true, ellipsis: false },
  { key: 'count', prop: 'count', label: '通道次数', width: 120, kind: 'number' },
]

const failoverRecordColumns = [
  { key: 'timeScene', prop: 'time', label: '时间 / 场景', width: 200, locked: true, ellipsis: false },
  { key: 'primaryName', prop: 'primaryName', label: '主通道', width: 150 },
  { key: 'result', prop: 'success', label: '模型结果', width: 130, kind: 'status' },
  { key: 'attempts', prop: 'attempts', label: '尝试顺序', width: 320, ellipsis: false },
  { key: 'latencyMs', prop: 'latencyMs', label: '总耗时', width: 100, kind: 'number' },
]

const circuitAlertColumns = [
  { key: 'timeRead', prop: 'time', label: '时间 / 阅读状态', width: 170, locked: true, ellipsis: false },
  { key: 'channel', prop: 'providerName', label: '模型通道', width: 180, ellipsis: false },
  { key: 'event', prop: 'type', label: '告警事件', width: 150, kind: 'status' },
  { key: 'detail', prop: 'reason', label: '故障与恢复信息', width: 340, ellipsis: false },
  { key: 'action', label: '操作', width: 160, kind: 'action', fixed: 'right', locked: true },
]

const failoverTrendMax = computed(() => {
  const list = tableState.failoverData?.trend || []
  return Math.max(1, ...list.map((x) => Number(x.total) || 0))
})

const hasSceneFilters = computed(() =>
  Boolean(
    tableState.sceneDomain ||
      tableState.sceneSearch.trim() ||
      tableState.sceneModelSource ||
      tableState.sceneModelProvider,
  ),
)

function sceneRowActions(scene) {
  return [
    {
      key: 'manage',
      label: '配置与提示词',
      onClick: () => consoleApp?.openScenePrompts(scene.code),
    },
    {
      key: 'debug',
      label: '调试 ↗',
      onClick: () => consoleApp?.openSceneDebug(scene.code),
    },
    {
      key: 'detail',
      label: '详情',
      onClick: () => consoleApp?.showScene(scene.code),
    },
  ]
}

function callRowActions(record) {
  return [
    {
      key: 'trace',
      label: '复制追踪号',
      onClick: () => consoleApp?.copyText(record.traceId),
    },
  ]
}

function promptVersionRowActions(v) {
  const items = [
    {
      key: 'load',
      label: '复制编辑 / 预览',
      onClick: () => consoleApp?.loadPromptVersion(v.number),
    },
  ]
  if (v.number !== tableState.promptPublishedVersion) {
    items.push({
      key: 'activate',
      label: v.publishedAt ? '回滚到此版本' : '发布',
      onClick: () => consoleApp?.activatePromptVersion(v.number, Boolean(v.publishedAt)),
    })
  }
  return items
}

function circuitAlertRowActions(row) {
  const e = row.event || {}
  const items = []
  if (!row.read) {
    items.push({
      key: 'read',
      label: '标为已读',
      onClick: () => consoleApp?.markCircuitAlertsRead({ ids: [e.id] }),
    })
  }
  if (consoleApp?.hasProvider(e.providerId)) {
    items.push({
      key: 'channel',
      label: '查看通道',
      onClick: () => consoleApp?.openCircuitFromAlert(e.providerId),
    })
  }
  return items
}

function handleSceneSelectionChange(keys) {
  consoleApp?.setSceneSelection(keys)
}

function handleCallsPageChange(page, pageSize) {
  consoleApp?.setCallsPagination(page, pageSize)
}

function handleFailoverPageChange(page, pageSize) {
  consoleApp?.setFailoverPagination(page, pageSize)
}

function handleAlertPageChange(page, pageSize) {
  consoleApp?.setAlertPagination(page, pageSize)
}

function closeActiveDrawer() {
  if (tableState.drawerType) {
    consoleApp?.closeVueDrawer()
  } else {
    consoleApp?.closeDrawer()
  }
}

function outsideClick(e) {
  if (!e.target.closest('#side-user')) menuOpen.value = false
}
function keydown(e) {
  if (e.key === 'Escape') {
    menuOpen.value = false
    mobileOpen.value = false
    closeActiveDrawer()
  }
}
function hashchange() {
  mobileOpen.value = false
  consoleApp?.hashchange()
}
function visibilitychange() {
  consoleApp?.visibilitychange()
}

onMounted(() => {
  updateViewport()
  consoleApp = createAiConsole(ui, root.value, tableState)
  navs.value = consoleApp.navs
  document.addEventListener('click', outsideClick)
  document.addEventListener('keydown', keydown)
  document.addEventListener('visibilitychange', visibilitychange)
  window.addEventListener('hashchange', hashchange)
  window.addEventListener('resize', updateViewport)
  consoleApp.boot()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', outsideClick)
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('visibilitychange', visibilitychange)
  window.removeEventListener('hashchange', hashchange)
  window.removeEventListener('resize', updateViewport)
  consoleApp?.dispose()
})
</script>

<template>
  <div ref="root">
    <div id="boot" class="boot" :hidden="ui.ready">
      <div class="brand-symbol">AI</div>
      <h1>农业 AI 中台</h1>
      <p id="boot-message">{{ ui.bootMessage }}</p>
      <button id="login" class="primary" :hidden="!ui.loginVisible" @click="consoleApp.login()">重新登录</button>
      <p class="muted">统一身份认证 · 业务场景调度 · 运行可追溯</p>
    </div>

    <div
      id="app"
      :hidden="!ui.ready"
      :class="{
        'is-collapsed': effectiveCollapsed,
        'is-mobile': isMobile,
        'is-drawer-open': mobileOpen,
      }"
    >
      <button
        v-if="isMobile && mobileOpen"
        type="button"
        class="sidebar-overlay"
        aria-label="关闭导航菜单"
        @click="mobileOpen = false"
      />
      <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
        <a class="brand" href="#overview" @click="mobileOpen = false">
          <span class="brand-symbol">AI</span>
          <span>农业 AI 中台<small>产业互联网平台</small></span>
        </a>
        <nav id="nav">
          <a
            v-for="[id, name, path] in navs"
            :key="id"
            :href="'#' + id"
            :data-nav="id"
            :title="name"
            :aria-label="name"
            :class="{ active: ui.active === id }"
            @click="mobileOpen = false"
          >
            <svg viewBox="0 0 24 24"><path :d="path" /></svg>
            <span>{{ name }}</span>
          </a>
        </nav>
        <div class="pc-side-user" id="side-user">
          <button
            type="button"
            class="pc-side-user-trigger"
            id="side-user-trigger"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            :title="username + ' · AI 中台运营'"
            @click.stop="menuOpen = !menuOpen"
          >
            <span class="pc-side-user-avatar" id="side-avatar">{{ username[0] }}</span>
            <span class="pc-side-user-meta">
              <strong id="side-username">{{ username }}</strong>
              <small>AI 中台运营</small>
            </span>
            <span class="pc-side-user-caret" aria-hidden="true">⌃</span>
          </button>
          <div
            class="pc-side-user-menu"
            id="side-user-menu"
            role="menu"
            :hidden="!menuOpen"
            @click="menuOpen = false"
          >
            <a role="menuitem" id="side-personal" :href="personalUrl" target="_blank" rel="noreferrer">个人中心</a>
            <a role="menuitem" href="#governance">权限与审计</a>
            <div class="pc-side-user-divider"></div>
            <button
              type="button"
              class="is-danger"
              role="menuitem"
              id="side-logout"
              :disabled="ui.loggingOut"
              @click="consoleApp.logout()"
            >
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <div class="body-wrap">
        <AgriVueTopHeader
          header-class="topbar"
          right-class="top-actions"
          :collapsed="collapsed"
          :mobile="isMobile"
          :mobile-open="mobileOpen"
          @toggle-collapse="toggleSidebar"
        >
          <template #left>
            <nav class="agri-workspace-header-breadcrumb breadcrumb" aria-label="页面路径">
              <span class="agri-workspace-header-crumb-text">产业互联网平台</span>
              <span class="agri-workspace-header-crumb-sep" aria-hidden="true">/</span>
              <span class="agri-workspace-header-crumb-text">AI 中台</span>
              <span class="agri-workspace-header-crumb-sep" aria-hidden="true">/</span>
              <strong id="crumb" class="agri-workspace-header-crumb-current">{{ crumb }}</strong>
            </nav>
          </template>
          <template #right>
            <button
              id="model-notifications"
              type="button"
              class="alert-notification-button"
              :class="{ 'has-unread': ui.notifications.unreadCount > 0 }"
              :title="notificationTitle"
              :aria-label="'熔断通知，' + ui.notifications.unreadCount + '条未读'"
              @click="consoleApp.showCircuitAlerts()"
            >
              熔断通知{{ ui.notifications.unreadCount ? ' · ' + ui.notifications.unreadCount : '' }}
            </button>
            <span class="env-label">本地运行环境</span>
            <button
              id="refresh"
              type="button"
              class="icon-button"
              title="刷新当前数据"
              aria-label="刷新当前数据"
              @click="consoleApp.refresh()"
            >
              ↻
            </button>
            <div class="user-avatar" id="avatar">{{ username[0] }}</div>
            <span id="username">{{ username }}</span>
            <button
              id="logout"
              type="button"
              class="text-button"
              :disabled="ui.loggingOut"
              @click="consoleApp.logout()"
            >
              退出
            </button>
          </template>
        </AgriVueTopHeader>

        <AgriVueWorkspaceTabs
          v-if="ui.ready"
          :active-key="ui.active"
          :active-label="crumb"
          home-key="overview"
          home-label="运行概览"
          storage-key="agri-ai:workspace-tabs"
          @navigate="navigate"
        />

        <main>
          <div id="notice" class="banner error" role="alert" :hidden="!ui.notice">{{ ui.notice }}</div>
          <div id="content" aria-live="polite" v-html="ui.content"></div>

          <!-- 1. 运行概览：最近调用共享表格 -->
          <section v-if="ui.ready && ui.active === 'overview'" class="ai-vue-section">
            <div class="ai-section-head">
              <h2>最近调用<small>真实服务记录</small></h2>
              <a class="link" href="#calls">查看全部 ↗</a>
            </div>
            <AgriVueTable
              :columns="overviewRecentColumns"
              :data="tableState.overviewRecent"
              :row-key="(row, idx) => String(row.taskId || row.traceId || idx)"
              client-pagination
              :page-size="10"
              :selectable="false"
              column-settings-storage-key="agri-ai:overview-recent"
              empty-text="暂无调用记录，可前往调试工作台发起一次场景调用"
              @refresh="consoleApp?.refresh()"
            >
              <template #cell-scene="{ row }">
                <div class="cell-title">{{ sceneNameOf(row.sceneCode) }}</div>
                <div class="mono">{{ row.sceneCode }}</div>
              </template>
              <template #cell-status="{ row }">
                <span class="agri-vue-status-pill" :class="row.status === 'SUCCESS' ? 'tone-success' : 'tone-danger'">
                  {{ row.status === 'SUCCESS' ? '调用成功' : '调用失败' }}
                </span>
              </template>
              <template #cell-latencyMs="{ row }">
                <span>{{ row.latencyMs }} <span class="cell-sub">ms</span></span>
              </template>
              <template #cell-time="{ row }">
                {{ formatTime(row.time) }}
              </template>
            </AgriVueTable>
          </section>

          <!-- 2. 场景中心：四段式共享列表 -->
          <section v-if="ui.ready && ui.active === 'scenes'" class="ai-vue-section">
            <AgriVueTable
              :columns="sceneColumns"
              :data="tableState.scenes"
              row-key="code"
              client-pagination
              :page-size="20"
              :selected-keys="tableState.sceneSelection"
              column-settings-storage-key="agri-ai:scenes"
              empty-text="没有匹配的场景，请调整筛选条件"
              total-unit="个场景"
              @update:selected-keys="handleSceneSelectionChange"
              @refresh="consoleApp?.refresh()"
            >
              <template #filter>
                <AgriVueFilterBar
                  :field-count="4"
                  @search="consoleApp?.applySceneFilters()"
                  @reset="consoleApp?.resetSceneFiltersAndSync()"
                >
                  <div class="agri-vue-filter-field">
                    <label for="scene-search">关键字</label>
                    <input
                      id="scene-search"
                      v-model="tableState.sceneSearch"
                      aria-label="搜索场景"
                      placeholder="搜索场景名称、编码或业务域"
                      @input="consoleApp?.onSceneSearchInput()"
                    />
                  </div>
                  <div class="agri-vue-filter-field">
                    <label for="scene-domain">业务子系统</label>
                    <select
                      id="scene-domain"
                      v-model="tableState.sceneDomain"
                      aria-label="筛选业务域"
                      @change="consoleApp?.applySceneFilters()"
                    >
                      <option value="">全部业务子系统</option>
                      <option v-for="d in tableState.sceneDomainOptions" :key="d" :value="d">{{ d }}</option>
                    </select>
                  </div>
                  <div class="agri-vue-filter-field">
                    <label for="scene-model-source">模型来源</label>
                    <select
                      id="scene-model-source"
                      v-model="tableState.sceneModelSource"
                      aria-label="筛选模型来源"
                      @change="consoleApp?.applySceneFilters()"
                    >
                      <option value="">全部模型来源</option>
                      <option value="GLOBAL">跟随全局模型</option>
                      <option value="SCENE">场景专属模型</option>
                    </select>
                  </div>
                  <div class="agri-vue-filter-field">
                    <label for="scene-model-filter">模型通道</label>
                    <select
                      id="scene-model-filter"
                      v-model="tableState.sceneModelProvider"
                      aria-label="筛选模型通道"
                      @change="consoleApp?.applySceneFilters()"
                    >
                      <option value="">全部模型通道</option>
                      <option v-for="opt in tableState.sceneModelOptions" :key="opt.id" :value="opt.id">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                  <template #actions>
                    <button
                      id="reset-scene-filters"
                      type="button"
                      class="agri-vue-btn"
                      :disabled="!hasSceneFilters"
                      @click="consoleApp?.resetSceneFiltersAndSync()"
                    >
                      重置
                    </button>
                    <button type="submit" class="agri-vue-btn agri-vue-btn--primary">查询</button>
                  </template>
                </AgriVueFilterBar>
              </template>

              <template #toolbar-left>
                <button
                  id="batch-bind-model"
                  type="button"
                  class="agri-vue-btn agri-vue-btn--primary"
                  :disabled="!tableState.sceneSelection.length || tableState.sceneBatchSaving"
                  @click="consoleApp?.openBatchModelDrawer()"
                >
                  批量绑定模型
                </button>
                <button
                  id="clear-scene-selection"
                  type="button"
                  class="agri-vue-btn"
                  :disabled="!tableState.sceneSelection.length || tableState.sceneBatchSaving"
                  @click="consoleApp?.clearSceneSelection()"
                >
                  清空选择
                </button>
                <span id="scene-selection-count" class="ai-toolbar-meta" role="status">
                  匹配 {{ tableState.scenes.length }} / {{ tableState.sceneTotal }} 个场景 · 已选择
                  {{ tableState.sceneSelection.length }} 个
                </span>
              </template>

              <template #cell-scene="{ row }">
                <div class="cell-title">
                  {{ row.name }}
                  <span v-if="row.custom" class="pill gray">自定义</span>
                </div>
                <div class="mono">{{ row.code }}</div>
              </template>
              <template #cell-status="{ row }">
                <div class="ai-status-pair">
                  <span class="agri-vue-status-pill" :class="row.enabled ? 'tone-success' : 'tone-default'">
                    {{ row.enabled ? '已启用' : '已停用' }}
                  </span>
                  <span class="pill amber">{{ row.publishedVersion ? 'v' + row.publishedVersion : '未发布' }}</span>
                </div>
              </template>
              <template #cell-model="{ row }">
                <div class="cell-title">{{ sceneModelText(row) }}</div>
                <div class="cell-sub">{{ row.description }}</div>
              </template>
              <template #cell-action="{ row }">
                <AgriVueRowActions :actions="sceneRowActions(row)" />
              </template>
            </AgriVueTable>
            <div class="inline-note ai-inline-note">
              模型通道按当前配置路由筛选，跟随全局的场景计入当前全局通道；实际调用以回执为准。可新增自定义场景；保存后场景编码与业务子系统固定，停用后统一调度拒绝执行。自定义场景使用已发布提示词调用模型，无内置规则降级。提示词支持版本发布与回滚，真实模型推理使用已发布版本，规则降级不消费提示词正文。
            </div>
          </section>

          <!-- 3. 调用日志：四段式共享列表 -->
          <section v-if="ui.ready && ui.active === 'calls'" class="ai-vue-section">
            <AgriVueTable
              :columns="callColumns"
              :data="tableState.calls"
              :row-key="(row, idx) => String(row.taskId || row.traceId || idx)"
              :loading="tableState.callsLoading"
              :page="tableState.callsPage"
              :page-size="tableState.callsPageSize"
              :total="tableState.callsTotal"
              column-settings-storage-key="agri-ai:calls"
              empty-text="暂无调用记录，可前往调试工作台发起一次场景调用"
              @page-change="handleCallsPageChange"
              @refresh="consoleApp?.loadCalls()"
            >
              <template #filter>
                <AgriVueFilterBar
                  :field-count="2"
                  :loading="tableState.callsLoading"
                  @search="consoleApp?.queryCalls()"
                  @reset="consoleApp?.resetCallFilters()"
                >
                  <div class="agri-vue-filter-field">
                    <label for="call-search">关键字</label>
                    <input
                      id="call-search"
                      v-model="tableState.callKeyword"
                      aria-label="搜索调用日志"
                      placeholder="搜索场景编码、任务或追踪编号"
                    />
                  </div>
                  <div class="agri-vue-filter-field">
                    <label for="call-status">执行状态</label>
                    <select
                      id="call-status"
                      v-model="tableState.callStatus"
                      aria-label="筛选调用状态"
                      @change="consoleApp?.queryCalls()"
                    >
                      <option value="">全部执行状态</option>
                      <option value="SUCCESS">调用成功</option>
                      <option value="FAILED">调用失败</option>
                    </select>
                  </div>
                  <template #actions>
                    <button
                      type="button"
                      class="agri-vue-btn"
                      :disabled="tableState.callsLoading"
                      @click="consoleApp?.resetCallFilters()"
                    >
                      重置
                    </button>
                    <button
                      id="query-calls"
                      type="submit"
                      class="agri-vue-btn agri-vue-btn--primary"
                      :disabled="tableState.callsLoading"
                    >
                      {{ tableState.callsLoading ? '查询中…' : '查询' }}
                    </button>
                  </template>
                </AgriVueFilterBar>
              </template>

              <template #cell-scene="{ row }">
                <div class="cell-title">{{ sceneNameOf(row.sceneCode) }}</div>
                <div class="mono">{{ row.sceneCode }}</div>
              </template>
              <template #cell-task="{ row }">
                <div class="mono">{{ row.taskId }}</div>
                <div class="cell-sub">{{ row.source }}{{ row.failover ? ' · 已故障切换' : '' }}</div>
                <div v-if="row.modelAttempts?.length" class="cell-sub">
                  {{
                    row.modelAttempts
                      .map((a) => `${a.provider_name}：${a.status === 'SUCCESS' ? '成功' : a.reason || '失败'}`)
                      .join(' → ')
                  }}
                </div>
              </template>
              <template #cell-status="{ row }">
                <span class="agri-vue-status-pill" :class="row.status === 'SUCCESS' ? 'tone-success' : 'tone-danger'">
                  {{ row.status === 'SUCCESS' ? '调用成功' : '调用失败' }}
                </span>
              </template>
              <template #cell-latencyMs="{ row }">
                <span>{{ row.latencyMs }} <span class="cell-sub">ms</span></span>
              </template>
              <template #cell-time="{ row }">
                {{ formatTime(row.time) }}
              </template>
              <template #cell-action="{ row }">
                <AgriVueRowActions :actions="callRowActions(row)" />
              </template>
            </AgriVueTable>
            <div class="inline-note ai-inline-note">
              最近 1000 条记录持久化保留。为减少业务数据暴露，日志不保存请求或响应正文、令牌、密钥。未经管理鉴权的兼容业务调用会标注为“未核验调用方”。
            </div>
          </section>

          <!-- 4 & 5. 提示词管理：版本记录与最近配置操作共享表格 -->
          <section v-if="ui.ready && ui.active === 'prompts' && tableState.promptSceneCode" class="ai-vue-section">
            <div class="ai-section-head">
              <h2>版本记录<small>正文保存后不可覆盖，修改时复制为新草稿</small></h2>
            </div>
            <AgriVueTable
              :columns="promptVersionColumns"
              :data="tableState.promptVersions"
              row-key="number"
              client-pagination
              :page-size="20"
              column-settings-storage-key="agri-ai:prompt-versions"
              empty-text="尚无提示词版本，先创建一个草稿"
              @refresh="consoleApp?.refresh()"
            >
              <template #cell-version="{ row }">
                <span class="mono">v{{ row.number }}</span>
              </template>
              <template #cell-status="{ row }">
                <span
                  class="agri-vue-status-pill"
                  :class="
                    row.number === tableState.promptPublishedVersion
                      ? 'tone-success'
                      : row.publishedAt
                        ? 'tone-info'
                        : 'tone-warning'
                  "
                >
                  {{
                    row.number === tableState.promptPublishedVersion
                      ? '当前发布'
                      : row.publishedAt
                        ? '历史发布'
                        : '草稿'
                  }}
                </span>
              </template>
              <template #cell-creator="{ row }">
                <div>{{ row.createdBy }}</div>
                <div class="cell-sub">{{ formatTime(row.createdAt) }}</div>
              </template>
              <template #cell-action="{ row }">
                <AgriVueRowActions :actions="promptVersionRowActions(row)" />
              </template>
            </AgriVueTable>

            <div class="ai-section-head ai-section-gap">
              <h2>最近配置操作<small>最多保留 100 条</small></h2>
            </div>
            <AgriVueTable
              :columns="promptEventColumns"
              :data="tableState.promptEvents"
              :row-key="(row, idx) => `${row.time || idx}-${row.action || idx}-${idx}`"
              client-pagination
              :page-size="20"
              :selectable="false"
              column-settings-storage-key="agri-ai:prompt-events"
              empty-text="暂无配置操作"
              @refresh="consoleApp?.refresh()"
            >
              <template #cell-actionType="{ row }">
                {{ eventActionText(row.action) }}
              </template>
              <template #cell-version="{ row }">
                <template v-if="['BIND_MODEL', 'BATCH_BIND_MODEL'].includes(row.action)">
                  {{ (row.beforeProviderId || '跟随全局') + ' → ' + (row.afterProviderId || '跟随全局') }}
                </template>
                <template v-else>
                  {{ row.version ? 'v' + row.version : '—' }}
                </template>
              </template>
              <template #cell-time="{ row }">
                {{ formatTime(row.time) }}
              </template>
            </AgriVueTable>
          </section>
        </main>

        <footer>
          农业产业互联网平台 <span>AI 能力管理控制台</span><span>统一认证 · 权限控制 · 审计追踪</span>
        </footer>
      </div>
    </div>

    <div id="toast" role="status" :hidden="!ui.toast">{{ ui.toast }}</div>

    <!-- 表单类抽屉继续沿用原生 DOM 容器 -->
    <div id="drawer" class="drawer-mask" hidden @click.self="consoleApp.closeDrawer()"></div>

    <!-- 6-9. 数据表格抽屉（熔断告警通知 & 故障切换统计） -->
    <div v-if="tableState.drawerType" class="drawer-mask" @click.self="consoleApp?.closeVueDrawer()">
      <!-- 熔断告警通知 -->
      <section
        v-if="tableState.drawerType === 'circuit-alerts'"
        class="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="circuit-alert-title"
        style="width: min(1180px, 96vw)"
      >
        <div class="panel-head">
          <h2 id="circuit-alert-title">熔断告警通知</h2>
          <button
            type="button"
            id="close-circuit-alerts"
            class="text-button"
            @click="consoleApp?.closeVueDrawer()"
          >
            关闭 ✕
          </button>
        </div>
        <div class="form">
          <div class="banner">
            通道首次熔断、恢复探测失败及恢复成功时生成站内通知。同一轮冷却中的跳过请求不重复提醒；已读状态按账号分别保存。标记已读不影响熔断恢复。
          </div>
          <p class="muted" id="alert-summary">
            <template v-if="tableState.alertData">
              共保留 {{ tableState.alertData.retained }} 条通知，当前账号未读
              {{ tableState.alertData.unreadCount }} 条，筛选结果 {{ tableState.alertData.total }} 条。{{
                tableState.alertData.writable ? '持久化正常。' : '持久化异常，新增通知可能仅保留在内存中。'
              }}
            </template>
            <template v-else>正在加载通知…</template>
          </p>
          <div class="banner error" id="alert-error" role="alert" :hidden="!tableState.alertError">
            {{ tableState.alertError }}
          </div>

          <AgriVueTable
            :columns="circuitAlertColumns"
            :data="tableState.alertData?.records || []"
            :row-key="(row, idx) => String(row.event?.id || idx)"
            :loading="tableState.drawerBusy"
            :page="tableState.alertFilters.page"
            :page-size="tableState.alertFilters.pageSize"
            :total="tableState.alertData?.total || 0"
            column-settings-storage-key="agri-ai:circuit-alerts"
            empty-text="暂无符合条件的熔断通知"
            @page-change="handleAlertPageChange"
            @refresh="consoleApp?.loadCircuitAlerts()"
          >
            <template #filter>
              <AgriVueFilterBar
                :field-count="3"
                :loading="tableState.drawerBusy"
                @search="consoleApp?.applyAlertFilters()"
                @reset="consoleApp?.resetAlertFilters()"
              >
                <div class="agri-vue-filter-field">
                  <label for="alert-provider">告警通道</label>
                  <select
                    id="alert-provider"
                    v-model="tableState.alertFilters.provider"
                    aria-label="告警通道"
                    :disabled="tableState.drawerBusy"
                    @change="consoleApp?.applyAlertFilters()"
                  >
                    <option value="">全部通道</option>
                    <option v-for="opt in tableState.alertProviderOptions" :key="opt.id" :value="opt.id">
                      {{ opt.name }}
                    </option>
                  </select>
                </div>
                <div class="agri-vue-filter-field">
                  <label for="alert-type">告警事件</label>
                  <select
                    id="alert-type"
                    v-model="tableState.alertFilters.type"
                    aria-label="告警事件"
                    :disabled="tableState.drawerBusy"
                    @change="consoleApp?.applyAlertFilters()"
                  >
                    <option value="ALL">全部事件</option>
                    <option value="OPEN">通道熔断</option>
                    <option value="REOPEN">探测失败</option>
                    <option value="RECOVERED">恢复成功</option>
                  </select>
                </div>
                <div class="agri-vue-filter-field">
                  <label for="alert-unread">阅读状态</label>
                  <select
                    id="alert-unread"
                    :value="tableState.alertFilters.unreadOnly ? 'UNREAD' : 'ALL'"
                    aria-label="筛选未读"
                    :disabled="tableState.drawerBusy"
                    @change="consoleApp?.setAlertUnreadOnly($event.target.value === 'UNREAD')"
                  >
                    <option value="ALL">全部通知</option>
                    <option value="UNREAD">仅看未读</option>
                  </select>
                </div>
              </AgriVueFilterBar>
            </template>

            <template #toolbar-left>
              <button
                id="alert-read-all"
                type="button"
                class="agri-vue-btn agri-vue-btn--primary"
                :disabled="tableState.drawerBusy || !tableState.alertData?.unreadCount"
                @click="consoleApp?.markAllCircuitAlertsRead()"
              >
                全部标为已读
              </button>
            </template>

            <template #cell-timeRead="{ row }">
              <div>{{ formatTime(row.event?.time) }}</div>
              <div class="cell-sub">{{ row.read ? '已读' : '未读' }}</div>
            </template>
            <template #cell-channel="{ row }">
              <div class="cell-title">{{ row.event?.providerName }}</div>
              <div class="cell-sub">{{ row.event?.model }}</div>
            </template>
            <template #cell-event="{ row }">
              <span
                class="agri-vue-status-pill"
                :class="row.event?.type === 'RECOVERED' ? 'tone-success' : 'tone-warning'"
              >
                {{ circuitEventLabel(row.event?.type) }}
              </span>
              <div class="cell-sub">{{ row.event?.title }}</div>
            </template>
            <template #cell-detail="{ row }">
              <div>{{ row.event?.reason }}</div>
              <div class="cell-sub">
                连续故障 {{ row.event?.failures }} 次 · 阈值 {{ row.event?.threshold }} 次 · 冷却
                {{ row.event?.cooldownSeconds }} 秒
              </div>
              <div class="cell-sub">事件组 {{ row.event?.incidentId }}</div>
            </template>
            <template #cell-action="{ row }">
              <AgriVueRowActions v-if="circuitAlertRowActions(row).length" :actions="circuitAlertRowActions(row)" />
              <span v-else class="muted">通道已移除</span>
            </template>
          </AgriVueTable>

          <p class="muted ai-inline-note">
            保留最近 1000 条事件，重启后恢复通知历史与已读状态；通道配置重置和服务重启不代表真实恢复，不发送恢复成功通知。控制台打开且页面可见时每 30 秒检查新通知，列表通过刷新按钮更新。
          </p>
        </div>
      </section>

      <!-- 故障切换统计（含 3 张共享表格） -->
      <section
        v-else-if="tableState.drawerType === 'failover-statistics'"
        class="drawer statistics-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="statistics-title"
      >
        <div class="panel-head">
          <h2 id="statistics-title">故障切换统计</h2>
          <button
            type="button"
            id="close-statistics"
            class="text-button"
            @click="consoleApp?.closeVueDrawer()"
          >
            关闭 ✕
          </button>
        </div>

        <div class="drawer-body">
          <AgriVueFilterBar
            :field-count="3"
            :loading="tableState.drawerBusy"
            @search="consoleApp?.loadFailoverStatistics()"
            @reset="consoleApp?.resetFailoverFilters()"
          >
            <div class="agri-vue-filter-field">
              <label for="statistics-hours">统计时间范围</label>
              <select
                id="statistics-hours"
                v-model="tableState.failoverFilters.hours"
                aria-label="统计时间范围"
                @change="consoleApp?.applyFailoverFilters()"
              >
                <option value="1">最近 1 小时</option>
                <option value="24">最近 24 小时</option>
                <option value="168">最近 7 天</option>
                <option value="720">最近 30 天</option>
                <option value="0">全部保留记录</option>
              </select>
            </div>
            <div class="agri-vue-filter-field">
              <label for="statistics-provider">主通道</label>
              <select
                id="statistics-provider"
                v-model="tableState.failoverFilters.provider"
                aria-label="筛选统计主通道"
                @change="consoleApp?.applyFailoverFilters()"
              >
                <option value="">全部主通道</option>
                <option v-for="opt in tableState.failoverProviderOptions" :key="opt.id" :value="opt.id">
                  {{ opt.name }}
                </option>
              </select>
            </div>
            <div class="agri-vue-filter-field">
              <label for="statistics-outcome">路由结果</label>
              <select
                id="statistics-outcome"
                v-model="tableState.failoverFilters.outcome"
                aria-label="筛选路由结果"
                @change="consoleApp?.applyFailoverFilters()"
              >
                <option value="ALL">全部路由结果</option>
                <option value="SWITCHED">发生故障切换</option>
                <option value="FAILED">模型最终失败</option>
                <option value="PRIMARY">主模型直接成功</option>
              </select>
            </div>
          </AgriVueFilterBar>

          <div v-if="tableState.failoverError" class="banner error ai-section-gap" role="alert">
            {{ tableState.failoverError }}，可点击查询重试。
          </div>
          <div v-else-if="!tableState.failoverData" class="loading">正在汇总模型路由记录…</div>
          <template v-else>
            <div class="banner ai-section-gap" :class="tableState.failoverData.writable ? '' : 'error'">
              统计覆盖场景真实推理及普通聊天；连接验证、模型列表获取和纯规则执行不计入。切换指已进入第二或后续通道（含熔断跳过）；切换成功率 = 备用成功接管 / 发生切换。规则降级成功仍计为模型失败。
            </div>
            <p class="muted">
              保留最近 {{ tableState.failoverData.capacity }} 条，当前 {{ tableState.failoverData.retained }} 条；筛选后
              {{ tableState.failoverData.total }} 条。
              <template v-if="tableState.failoverData.oldestRetainedAt">
                最早保留 {{ formatTime(tableState.failoverData.oldestRetainedAt) }}。
              </template>
              从功能启用后采集，不补算旧日志。更新时间 {{ formatTime(tableState.failoverData.generatedAt) }} ·
              {{ tableState.failoverData.zone }}。{{
                tableState.failoverData.writable ? '持久化正常，重启可恢复。' : '统计文件不可写，新增记录仅暂存内存。'
              }}
            </p>

            <div class="stats">
              <div class="stat">
                <div class="stat-top">真实模型路由</div>
                <div class="stat-value">{{ tableState.failoverData.total }}</div>
                <div class="stat-foot">按当前时间、主通道和结果筛选</div>
              </div>
              <div class="stat">
                <div class="stat-top">发生故障切换</div>
                <div class="stat-value">{{ tableState.failoverData.switched }}</div>
                <div class="stat-foot">占路由总量 {{ formatPct(tableState.failoverData.switchRate) }}</div>
              </div>
              <div class="stat">
                <div class="stat-top">备用接管成功</div>
                <div class="stat-value">{{ tableState.failoverData.rescued }}</div>
                <div class="stat-foot">切换成功率 {{ formatPct(tableState.failoverData.switchSuccessRate) }}</div>
              </div>
              <div class="stat">
                <div class="stat-top">模型最终失败</div>
                <div class="stat-value">{{ tableState.failoverData.failed }}</div>
                <div class="stat-foot">真实模型成功率 {{ formatPct(tableState.failoverData.successRate) }}</div>
              </div>
            </div>

            <p class="statistics-summary">
              主模型直接成功 <b>{{ tableState.failoverData.primarySuccess }}</b> 次 · 切换后失败
              <b>{{ tableState.failoverData.switchFailed }}</b> 次 · 熔断跳过
              <b>{{ tableState.failoverData.skipped }}</b> 次 · 平均路由耗时
              <b>{{ tableState.failoverData.total ? Number(tableState.failoverData.averageLatencyMs).toFixed(1) : '—' }}</b>
              ms · 切换平均耗时
              <b>{{
                tableState.failoverData.switched ? Number(tableState.failoverData.switchAverageLatencyMs).toFixed(1) : '—'
              }}</b>
              ms
            </p>

            <section class="panel">
              <div class="panel-head"><h2>切换趋势</h2></div>
              <div
                v-if="(tableState.failoverData.trend || []).length"
                class="statistics-trend"
                aria-label="蓝色为主模型成功，绿色为备用接管，红色为模型最终失败"
              >
                <div v-for="t in tableState.failoverData.trend" :key="t.time" class="trend-row">
                  <span>{{ t.time }}</span>
                  <div
                    class="trend-bar"
                    role="img"
                    :aria-label="`${t.time}：总计${t.total}，备用接管${t.rescued}，失败${t.failed}`"
                  >
                    <i class="trend-primary" :style="{ width: (t.primarySuccess / failoverTrendMax) * 100 + '%' }"></i>
                    <i class="trend-rescued" :style="{ width: (t.rescued / failoverTrendMax) * 100 + '%' }"></i>
                    <i class="trend-failed" :style="{ width: (t.failed / failoverTrendMax) * 100 + '%' }"></i>
                  </div>
                  <small>{{ t.total }} 次 / 切换 {{ t.switched }}</small>
                </div>
                <p class="muted">
                  蓝：主模型成功 · 绿：备用接管 · 红：模型最终失败；按 {{ tableState.failoverData.zone }}
                  分桶，首尾可能为部分时段。
                </p>
              </div>
              <div v-else class="empty">暂无趋势数据</div>
            </section>

            <div class="ai-section-head"><h2>通道运行表现</h2></div>
            <AgriVueTable
              :columns="failoverChannelColumns"
              :data="tableState.failoverData.channels || []"
              row-key="id"
              client-pagination
              :page-size="20"
              :selectable="false"
              column-settings-storage-key="agri-ai:failover-channels"
              empty-text="暂无符合条件的记录"
              @refresh="consoleApp?.loadFailoverStatistics()"
            >
              <template #cell-channel="{ row }">
                <div>{{ row.name }}</div>
                <div class="mono">{{ row.id }}</div>
              </template>
              <template #cell-outcome="{ row }">{{ row.success }} / {{ row.failed }}</template>
              <template #cell-successRate="{ row }">{{ formatPct(row.successRate) }}</template>
              <template #cell-averageLatencyMs="{ row }">
                {{ row.requests ? Number(row.averageLatencyMs).toFixed(1) : '—' }} ms
              </template>
            </AgriVueTable>

            <div class="ai-section-head ai-section-gap"><h2>失败与跳过原因</h2></div>
            <AgriVueTable
              :columns="failoverReasonColumns"
              :data="tableState.failoverData.reasons || []"
              :row-key="(row, idx) => `${row.reason || idx}-${idx}`"
              client-pagination
              :page-size="20"
              :selectable="false"
              column-settings-storage-key="agri-ai:failover-reasons"
              empty-text="暂无符合条件的记录"
              @refresh="consoleApp?.loadFailoverStatistics()"
            />

            <div class="ai-section-head ai-section-gap"><h2>最近路由记录</h2></div>
            <AgriVueTable
              :columns="failoverRecordColumns"
              :data="tableState.failoverData.records || []"
              :row-key="(row, idx) => `${row.time || idx}-${row.primaryName || ''}-${idx}`"
              :loading="tableState.drawerBusy"
              :page="tableState.failoverFilters.page"
              :page-size="tableState.failoverFilters.pageSize"
              :total="tableState.failoverData.total || 0"
              :selectable="false"
              column-settings-storage-key="agri-ai:failover-records"
              empty-text="暂无符合条件的记录"
              @page-change="handleFailoverPageChange"
              @refresh="consoleApp?.loadFailoverStatistics()"
            >
              <template #cell-timeScene="{ row }">
                <div>{{ formatTime(row.time) }}</div>
                <div class="cell-sub">{{ row.sceneCode ? sceneNameOf(row.sceneCode) : '普通聊天 / 通用调用' }}</div>
              </template>
              <template #cell-result="{ row }">
                <span class="agri-vue-status-pill" :class="row.success ? 'tone-success' : 'tone-danger'">
                  {{ row.success ? (row.switched ? '备用接管成功' : '主模型成功') : '模型最终失败' }}
                </span>
              </template>
              <template #cell-attempts="{ row }">
                <template v-if="(row.attempts || []).length">
                  <div v-for="(a, idx) in row.attempts" :key="idx" class="cell-sub">
                    {{ a.name }} / {{ a.model }}：{{ a.status === 'SUCCESS' ? '成功' : a.reason }} · {{ a.latencyMs }} ms
                  </div>
                </template>
                <span v-else class="cell-sub">未进入通道尝试</span>
              </template>
              <template #cell-latencyMs="{ row }">{{ row.latencyMs }} ms</template>
            </AgriVueTable>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
