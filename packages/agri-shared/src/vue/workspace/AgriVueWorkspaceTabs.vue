<template>
  <div
    v-if="!hidden"
    ref="wrapperRef"
    class="agri-route-workspace"
    :class="wrapperClass"
    :style="sticky ? { top: `${stickyTop}px` } : undefined"
  >
    <div class="agri-workspace-tabbar" :class="tabBarClass">
      <div class="agri-vue-tabs-scroll" role="tablist" aria-label="已打开页面页签">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.key"
          role="tab"
          :aria-selected="tab.key === activeKey"
          :tabindex="tab.key === activeKey ? 0 : -1"
          class="agri-vue-tab-item"
          :class="{
            'is-active': tab.key === activeKey,
            'is-dragging': draggingKey === tab.key,
            'is-drop-left': dropTarget?.key === tab.key && dropTarget.side === 'left',
            'is-drop-right': dropTarget?.key === tab.key && dropTarget.side === 'right',
          }"
          :draggable="tabs.length > 1"
          :title="`${tab.label}（拖动调整顺序，Alt + 左右方向键移动）`"
          @click="handleSelect(tab.key)"
          @contextmenu.prevent="openContextMenu($event, tab.key, index)"
          @dragstart="handleDragStart($event, tab.key)"
          @dragover.prevent="handleDragOver($event, tab.key)"
          @dragleave="handleDragLeave(tab.key)"
          @drop.prevent.stop="handleDrop($event, tab.key)"
          @dragend="resetDrag"
          @keydown="handleKeyDown($event, tab, index)"
        >
          <span class="agri-vue-tab-label">{{ tab.label }}</span>
          <button
            v-if="tabs.length > 1"
            type="button"
            class="agri-vue-tab-close"
            :aria-label="`关闭 ${tab.label}`"
            @click.stop="closeKeys([tab.key])"
          >
            ×
          </button>
        </div>
      </div>

      <div ref="actionsMenuRef" class="agri-vue-tabs-actions">
        <button
          type="button"
          class="agri-workspace-actions-btn agri-vue-tabs-actions-btn"
          aria-label="页签操作"
          :aria-expanded="actionsOpen"
          @click.stop="actionsOpen = !actionsOpen"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 4.25L6 7.75L9.5 4.25"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div v-if="actionsOpen" class="agri-vue-tabs-dropdown" role="menu">
          <button
            type="button"
            class="agri-vue-tabs-menu-item"
            :disabled="tabs.length < 2"
            @click="runMenuAction(activeKey, 'others')"
          >
            关闭其他页签
          </button>
          <button
            type="button"
            class="agri-vue-tabs-menu-item"
            @click="runMenuAction(activeKey, 'all')"
          >
            关闭全部页签
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="agri-vue-tabs-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        role="menu"
        @click.stop
      >
        <button
          type="button"
          class="agri-vue-tabs-menu-item"
          :disabled="tabs.length < 2"
          @click="runMenuAction(contextMenu.key, 'current')"
        >
          关闭当前页签
        </button>
        <button
          type="button"
          class="agri-vue-tabs-menu-item"
          :disabled="tabs.length < 2"
          @click="runMenuAction(contextMenu.key, 'others')"
        >
          关闭其他页签
        </button>
        <button
          type="button"
          class="agri-vue-tabs-menu-item"
          :disabled="contextMenu.index === 0"
          @click="runMenuAction(contextMenu.key, 'left')"
        >
          关闭左侧页签
        </button>
        <button
          type="button"
          class="agri-vue-tabs-menu-item"
          :disabled="contextMenu.index === tabs.length - 1"
          @click="runMenuAction(contextMenu.key, 'right')"
        >
          关闭右侧页签
        </button>
        <div class="agri-vue-tabs-menu-divider" />
        <button
          type="button"
          class="agri-vue-tabs-menu-item"
          @click="runMenuAction(contextMenu.key, 'all')"
        >
          关闭全部页签
        </button>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="pendingCloseKeys" class="agri-vue-tabs-confirm-mask" @click="pendingCloseKeys = null">
        <div class="agri-vue-tabs-confirm-card" role="dialog" aria-modal="true" @click.stop>
          <div class="agri-vue-tabs-confirm-title">关闭页面？</div>
          <div class="agri-vue-tabs-confirm-body">关闭后未提交的表单内容不会保留。</div>
          <div class="agri-vue-tabs-confirm-foot">
            <button type="button" class="agri-vue-tabs-btn" @click="pendingCloseKeys = null">取消</button>
            <button type="button" class="agri-vue-tabs-btn is-primary" @click="confirmPendingClose">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DEFAULT_MAX_WORKSPACE_TABS,
  computeCloseResult,
  isFormWorkspaceTab,
  parseStoredWorkspaceTabs,
  reorderWorkspaceTabs,
  resolveCloseTargetKeys,
  upsertWorkspaceTab,
  type RouteWorkspaceTabMeta,
  type WorkspaceTabCloseAction,
} from '../../components/workspace/workspaceTabsUtils'
import '../../components/workspace/WorkspaceTabs.css'
import './AgriVueWorkspaceTabs.css'

const props = withDefaults(
  defineProps<{
    activeKey: string
    activeLabel: string
    activePath?: string
    homeKey: string
    homeLabel: string
    homePath?: string
    storageKey?: string
    maxTabs?: number
    sticky?: boolean
    hideTabBar?: boolean
    wrapperClass?: string
    tabBarClass?: string
  }>(),
  {
    activePath: undefined,
    homePath: undefined,
    storageKey: undefined,
    maxTabs: DEFAULT_MAX_WORKSPACE_TABS,
    sticky: true,
    hideTabBar: false,
    wrapperClass: '',
    tabBarClass: '',
  },
)

const emit = defineEmits<{
  navigate: [path: string]
  'tabs-change': [tabs: RouteWorkspaceTabMeta[]]
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const actionsMenuRef = ref<HTMLDivElement | null>(null)
const stickyTop = ref(0)
const isMobile = ref(false)
const actionsOpen = ref(false)
const draggingKey = ref<string | null>(null)
const dropTarget = ref<{ key: string; side: 'left' | 'right' } | null>(null)
const contextMenu = ref<{ key: string; index: number; x: number; y: number } | null>(null)
const pendingCloseKeys = ref<string[] | null>(null)

const hidden = computed(() => props.hideTabBar || isMobile.value)

function makeTab(key: string, label: string, path: string): RouteWorkspaceTabMeta {
  return {
    key,
    label,
    path,
    form: isFormWorkspaceTab(`/${path}`, label),
  }
}

function readStoredTabs(key?: string): RouteWorkspaceTabMeta[] {
  if (!key || typeof window === 'undefined') return []
  try {
    return parseStoredWorkspaceTabs(window.sessionStorage.getItem(key))
  } catch {
    return []
  }
}

const homeTab = computed(() => makeTab(props.homeKey, props.homeLabel, props.homePath || props.homeKey))

const tabs = ref<RouteWorkspaceTabMeta[]>(
  upsertWorkspaceTab(
    readStoredTabs(props.storageKey),
    makeTab(props.activeKey, props.activeLabel, props.activePath || props.activeKey),
    props.maxTabs,
    [props.homeKey],
  ),
)

watch(
  () => [props.activeKey, props.activeLabel, props.activePath, props.homeKey, props.maxTabs] as const,
  ([key, label, path, homeKey, maxTabs]) => {
    tabs.value = upsertWorkspaceTab(tabs.value, makeTab(key, label, path || key), maxTabs, [homeKey])
  },
)

watch(
  tabs,
  (next) => {
    emit('tabs-change', next)
    if (!props.storageKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(
        props.storageKey,
        JSON.stringify(next.map(({ key, label, path, form }) => ({ key, label, path, form }))),
      )
    } catch {
      /* 忽略隐私模式或配额不足 */
    }
  },
  { deep: true, immediate: true },
)

function handleSelect(key: string) {
  const target = tabs.value.find((t) => t.key === key)
  emit('navigate', target?.path || (key === props.homeKey ? homeTab.value.path : key))
}

function executeClose(keys: string[]) {
  const { remaining, nextActiveKey } = computeCloseResult(tabs.value, props.activeKey, keys, props.homeKey)
  tabs.value = remaining.length ? remaining : [homeTab.value]
  if (nextActiveKey && nextActiveKey !== props.activeKey) {
    handleSelect(nextActiveKey)
  }
}

function closeKeys(keys: string[]) {
  if (!keys.length) return
  if (tabs.value.some((t) => keys.includes(t.key) && t.form)) {
    pendingCloseKeys.value = keys
    return
  }
  executeClose(keys)
}

function confirmPendingClose() {
  const keys = pendingCloseKeys.value
  pendingCloseKeys.value = null
  if (keys) executeClose(keys)
}

function runMenuAction(anchorKey: string, action: WorkspaceTabCloseAction) {
  actionsOpen.value = false
  contextMenu.value = null
  closeKeys(resolveCloseTargetKeys(tabs.value, anchorKey, action))
}

function openContextMenu(event: MouseEvent, key: string, index: number) {
  actionsOpen.value = false
  contextMenu.value = { key, index, x: event.clientX, y: event.clientY }
}

function resetDrag() {
  draggingKey.value = null
  dropTarget.value = null
}

function reorder(source: string, target: string, side: 'left' | 'right') {
  const next = reorderWorkspaceTabs(tabs.value, source, target, side)
  if (next.length === tabs.value.length && next.every((tab, idx) => tab.key === tabs.value[idx]?.key)) return
  tabs.value = next
}

function handleDragStart(event: DragEvent, key: string) {
  draggingKey.value = key
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }
}

function handleDragOver(event: DragEvent, key: string) {
  if (!draggingKey.value) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const side = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
  dropTarget.value = draggingKey.value === key ? null : { key, side }
}

function handleDragLeave(key: string) {
  if (dropTarget.value?.key === key) dropTarget.value = null
}

function handleDrop(event: DragEvent, key: string) {
  if (!draggingKey.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const side = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
  reorder(draggingKey.value, key, side)
  resetDrag()
}

function handleKeyDown(event: KeyboardEvent, tab: RouteWorkspaceTabMeta, index: number) {
  if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const target = tabs.value[index + (event.key === 'ArrowLeft' ? -1 : 1)]
  if (target) reorder(tab.key, target.key, event.key === 'ArrowLeft' ? 'left' : 'right')
}

let resizeObserver: ResizeObserver | null = null
let mediaQuery: MediaQueryList | null = null

function syncStickyTop() {
  const header = wrapperRef.value?.previousElementSibling
  if (!(header instanceof HTMLElement)) {
    stickyTop.value = 0
    return
  }
  const pos = window.getComputedStyle(header).position
  stickyTop.value = pos === 'sticky' || pos === 'fixed' ? header.offsetHeight : 0
}

function handleGlobalClick(event: MouseEvent) {
  contextMenu.value = null
  if (actionsOpen.value && actionsMenuRef.value && !actionsMenuRef.value.contains(event.target as Node)) {
    actionsOpen.value = false
  }
}

function handleMediaChange(event: MediaQueryListEvent) {
  isMobile.value = event.matches
}

onMounted(() => {
  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(max-width: 767px)')
  isMobile.value = mediaQuery.matches
  mediaQuery.addEventListener?.('change', handleMediaChange)
  window.addEventListener('click', handleGlobalClick)
  syncStickyTop()
  const header = wrapperRef.value?.previousElementSibling
  if (header instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(syncStickyTop)
    resizeObserver.observe(header)
  }
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener?.('change', handleMediaChange)
  window.removeEventListener('click', handleGlobalClick)
  resizeObserver?.disconnect()
})
</script>
