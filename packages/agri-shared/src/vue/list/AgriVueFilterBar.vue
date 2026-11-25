<template>
  <div class="agri-vue-filter-card">
    <form
      class="agri-vue-filter-grid"
      :class="{ 'is-collapsed': collapsible && collapsed }"
      @submit.prevent="emit('search')"
    >
      <slot :collapsed="collapsed" :collapsible="collapsible" :toggle="toggle" />
      <div class="agri-vue-filter-actions">
        <slot name="actions" :collapsed="collapsed" :collapsible="collapsible" :toggle="toggle">
          <button
            type="button"
            class="agri-vue-btn"
            :disabled="loading"
            @click="emit('reset')"
          >
            {{ resetText }}
          </button>
          <button
            type="submit"
            class="agri-vue-btn agri-vue-btn--primary"
            :disabled="loading"
          >
            {{ searchText }}
          </button>
        </slot>
        <button
          v-if="collapsible"
          type="button"
          class="agri-vue-filter-collapse-btn"
          :aria-expanded="!collapsed"
          @click="toggle"
        >
          <span>{{ collapsed ? '展开' : '收起' }}</span>
          <span class="agri-vue-filter-chevron" :class="{ 'is-expanded': !collapsed }" aria-hidden="true">▾</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_COLLAPSE_THRESHOLD, shouldCollapseFilters } from './vueListUtils'
import './AgriVueList.css'

const props = withDefaults(
  defineProps<{
    /** 筛选字段总数；>= 5 时自动默认收起为单行并在按钮区显示「展开 / 收起」。 */
    fieldCount?: number
    /** 自动折叠阈值，默认 5。 */
    collapseThreshold?: number
    /** 初始折叠状态（缺省按 fieldCount >= collapseThreshold 自动判定）。 */
    defaultCollapsed?: boolean
    loading?: boolean
    resetText?: string
    searchText?: string
  }>(),
  {
    fieldCount: 0,
    collapseThreshold: DEFAULT_COLLAPSE_THRESHOLD,
    defaultCollapsed: undefined,
    loading: false,
    resetText: '重置',
    searchText: '查询',
  },
)

const emit = defineEmits<{
  search: []
  reset: []
  'update:collapsed': [collapsed: boolean]
}>()

const collapsible = computed(() => shouldCollapseFilters(props.fieldCount, props.collapseThreshold))
const collapsed = ref<boolean>(
  props.defaultCollapsed !== undefined ? props.defaultCollapsed : collapsible.value,
)

watch(collapsible, (nextCollapsible) => {
  if (!nextCollapsible) {
    collapsed.value = false
  } else if (props.defaultCollapsed === undefined) {
    collapsed.value = true
  }
})

function toggle() {
  collapsed.value = !collapsed.value
  emit('update:collapsed', collapsed.value)
}
</script>
