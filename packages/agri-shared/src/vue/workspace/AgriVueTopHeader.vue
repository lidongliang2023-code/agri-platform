<template>
  <header class="agri-workspace-header" :class="headerClass">
    <div class="agri-workspace-header-left" :class="leftClass">
      <button
        v-if="showCollapseToggle"
        type="button"
        class="agri-sidebar-toggle-btn"
        :class="toggleButtonClass"
        :aria-label="toggleState.label"
        :aria-expanded="toggleState.expanded"
        :title="toggleState.label"
        @click="emit('toggle-collapse')"
      >
        <svg
          v-if="toggleState.icon === 'fold'"
          class="agri-sidebar-toggle-icon"
          viewBox="0 0 1024 1024"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM115.4 518.9L271.7 642c5.8 4.6 14.4.5 14.4-6.9V388.9c0-7.4-8.5-11.5-14.4-6.9L115.4 505.1a8.74 8.74 0 0 0 0 13.8z" />
        </svg>
        <svg
          v-else
          class="agri-sidebar-toggle-icon"
          viewBox="0 0 1024 1024"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM142.4 642.1L298.7 519a8.84 8.84 0 0 0 0-13.9L142.4 381.9c-5.8-4.6-14.4-.5-14.4 6.9v246.3a8.9 8.9 0 0 0 14.4 7z" />
        </svg>
      </button>

      <slot name="left">
        <nav
          v-if="normalizedBreadcrumbs.length > 0"
          class="agri-workspace-header-breadcrumb"
          aria-label="页面路径"
        >
          <template v-for="(item, idx) in normalizedBreadcrumbs" :key="`${item.label}-${idx}`">
            <span v-if="idx > 0" class="agri-workspace-header-crumb-sep" aria-hidden="true">/</span>
            <strong
              v-if="idx === normalizedBreadcrumbs.length - 1"
              class="agri-workspace-header-crumb-current"
            >
              {{ item.label }}
            </strong>
            <button
              v-else-if="item.onClick"
              type="button"
              class="agri-workspace-header-crumb-link"
              @click="item.onClick"
            >
              {{ item.label }}
            </button>
            <a
              v-else-if="item.href"
              class="agri-workspace-header-crumb-link"
              :href="item.href"
            >
              {{ item.label }}
            </a>
            <span v-else class="agri-workspace-header-crumb-text">{{ item.label }}</span>
          </template>
        </nav>
      </slot>
    </div>

    <div v-if="$slots.center" class="agri-workspace-header-center" :class="centerClass">
      <slot name="center" />
    </div>

    <div v-if="$slots.right" class="agri-workspace-header-right" :class="rightClass">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  normalizeBreadcrumbItems,
  resolveSidebarToggleState,
  type WorkspaceBreadcrumbInput,
} from '../../components/workspace/workspaceHeaderUtils'
import '../../components/workspace/WorkspaceHeader.css'

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    mobile?: boolean
    mobileOpen?: boolean
    showCollapseToggle?: boolean
    breadcrumbs?: ReadonlyArray<WorkspaceBreadcrumbInput>
    headerClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
    leftClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
    centerClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
    rightClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
    toggleButtonClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  }>(),
  {
    collapsed: false,
    mobile: false,
    mobileOpen: false,
    showCollapseToggle: true,
    breadcrumbs: () => [],
    headerClass: '',
    leftClass: '',
    centerClass: '',
    rightClass: '',
    toggleButtonClass: '',
  },
)

const emit = defineEmits<{
  'toggle-collapse': []
}>()

const toggleState = computed(() =>
  resolveSidebarToggleState({
    collapsed: props.collapsed,
    mobile: props.mobile,
    mobileOpen: props.mobileOpen,
  }),
)

const normalizedBreadcrumbs = computed(() => normalizeBreadcrumbItems(props.breadcrumbs))
</script>
