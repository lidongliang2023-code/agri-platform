<template>
  <section class="agri-detail-page">
    <div :class="stickyHeader ? 'agri-detail-header-sticky' : ''">
      <header class="agri-detail-header-card">
        <div class="agri-detail-header-main">
          <div class="agri-detail-header-left">
            <div class="agri-detail-title-row">
              <button
                v-if="showBack"
                type="button"
                class="agri-detail-back-btn"
                :aria-label="backLabel"
                :title="backLabel"
                @click="emit('back')"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M10.5 3.25L5.75 8L10.5 12.75" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <h1 v-if="code" class="agri-detail-code">{{ code }}</h1>
              <span
                v-if="status && status.label"
                class="agri-detail-status-pill"
                :class="`is-${resolveDetailStatusTone(status.tone)}`"
              >
                {{ status.label }}
              </span>
              <span
                v-for="(item, idx) in extraStatuses"
                :key="`${item.label}-${idx}`"
                class="agri-detail-status-pill"
                :class="`is-${resolveDetailStatusTone(item.tone)}`"
              >
                {{ item.label }}
              </span>
              <h2 v-if="title" class="agri-detail-name" :class="{ 'is-primary-title': !code }">
                {{ title }}
              </h2>
            </div>

            <div v-if="visibleMeta.length > 0" class="agri-detail-meta-row">
              <template v-for="(item, idx) in visibleMeta" :key="`${item.label}-${idx}`">
                <span v-if="idx > 0" class="agri-detail-meta-sep" aria-hidden="true">·</span>
                <span class="agri-detail-meta-item">
                  <span>{{ item.label }}：</span>
                  <span class="agri-detail-meta-value">{{ item.value }}</span>
                </span>
              </template>
            </div>
          </div>

          <div v-if="$slots.actions" class="agri-detail-header-actions">
            <slot name="actions" />
          </div>
        </div>

        <nav v-if="tabs.length > 0" class="agri-detail-tabs-bar" role="tablist" aria-label="详情页签">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="agri-detail-tab-btn"
            :class="{ 'is-active': activeTab === tab.key }"
            :aria-selected="activeTab === tab.key"
            :disabled="tab.disabled"
            @click="selectTab(tab.key)"
          >
            <span>{{ tab.label }}</span>
            <span v-if="tab.count !== undefined && tab.count !== null" class="agri-detail-tab-count">
              ({{ tab.count }})
            </span>
          </button>
        </nav>
      </header>
    </div>

    <div v-if="$slots.banner" class="agri-detail-banner">
      <slot name="banner" />
    </div>

    <div class="agri-detail-body" :class="{ 'is-single-column': !showAside }">
      <div class="agri-detail-main">
        <slot />
      </div>
      <aside v-if="showAside" class="agri-detail-aside">
        <slot name="aside" />
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { resolveDetailStatusTone, type DetailStatusTone } from './detailUtils'
import './AgriVueDetail.css'

export interface DetailStatusBadge {
  label: string
  tone?: DetailStatusTone | string
}

export interface DetailMetaEntry {
  label: string
  value?: string | number | null
}

export interface DetailTabEntry {
  key: string
  label: string
  count?: number | null
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  code?: string
  title?: string
  status?: DetailStatusBadge | null
  extraStatuses?: DetailStatusBadge[]
  meta?: DetailMetaEntry[]
  tabs?: DetailTabEntry[]
  activeTab?: string
  showBack?: boolean
  backLabel?: string
  stickyHeader?: boolean
  hasAside?: boolean
}>(), {
  code: '',
  title: '',
  status: null,
  extraStatuses: () => [],
  meta: () => [],
  tabs: () => [],
  activeTab: '',
  showBack: true,
  backLabel: '返回列表',
  stickyHeader: true,
  hasAside: true,
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'update:activeTab', key: string): void
  (e: 'tabChange', key: string): void
}>()

const slots = useSlots()

const visibleMeta = computed(() =>
  props.meta
    .filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '')
    .map(item => ({ label: item.label, value: String(item.value) })),
)

const showAside = computed(() => props.hasAside && Boolean(slots.aside))

function selectTab(key: string) {
  if (key === props.activeTab) return
  emit('update:activeTab', key)
  emit('tabChange', key)
}
</script>
