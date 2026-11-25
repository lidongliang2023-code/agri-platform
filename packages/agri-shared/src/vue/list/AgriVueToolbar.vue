<template>
  <div class="agri-vue-toolbar">
    <div class="agri-vue-toolbar-left">
      <slot name="left" />
    </div>
    <div class="agri-vue-toolbar-right">
      <slot name="right-extra" />
      <div v-if="showColumnSettings && columns.length" ref="wrapRef" class="agri-vue-colset-wrap">
        <button
          type="button"
          class="agri-vue-tool-btn"
          :aria-expanded="panelOpen"
          @click="panelOpen = !panelOpen"
        >
          列设置
        </button>
        <div v-if="panelOpen" class="agri-vue-colset-panel" role="dialog" aria-label="列显示设置">
          <div class="agri-vue-colset-head">
            <span>列展示</span>
            <button type="button" class="agri-vue-colset-reset" @click="emit('reset-columns')">
              恢复默认
            </button>
          </div>
          <div class="agri-vue-colset-list">
            <label
              v-for="col in columns"
              :key="col.resolvedKey"
              class="agri-vue-colset-item"
              :class="{ 'is-locked': isLocked(col.resolvedKey) }"
            >
              <input
                type="checkbox"
                :checked="!hiddenKeys.includes(col.resolvedKey)"
                :disabled="isLocked(col.resolvedKey)"
                @change="onCheckboxChange(col.resolvedKey, $event)"
              />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </div>
      </div>
      <button
        v-if="showRefresh"
        type="button"
        class="agri-vue-tool-btn"
        :disabled="refreshing"
        @click="emit('refresh')"
      >
        刷新
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { NormalizedVueColumn } from './vueListUtils'
import './AgriVueList.css'

const props = withDefaults(
  defineProps<{
    columns?: readonly NormalizedVueColumn[]
    hiddenKeys?: readonly string[]
    lockedKeys?: readonly string[]
    showColumnSettings?: boolean
    showRefresh?: boolean
    refreshing?: boolean
  }>(),
  {
    columns: () => [],
    hiddenKeys: () => [],
    lockedKeys: () => [],
    showColumnSettings: true,
    showRefresh: true,
    refreshing: false,
  },
)

const emit = defineEmits<{
  'toggle-column': [key: string, visible: boolean]
  'reset-columns': []
  refresh: []
}>()

const panelOpen = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

function isLocked(key: string): boolean {
  return props.lockedKeys.includes(key)
}

function onCheckboxChange(key: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  emit('toggle-column', key, checked)
}

function handleDocClick(event: MouseEvent) {
  if (!panelOpen.value) return
  const target = event.target as Node | null
  if (wrapRef.value && target && !wrapRef.value.contains(target)) {
    panelOpen.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && panelOpen.value) {
    panelOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>
