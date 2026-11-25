<template>
  <AgriVueRowActions
    v-if="visibleActions.length"
    :actions="visibleActions"
    :max-visible="maxVisible"
    :more-label="moreLabel"
  />
  <span v-else class="mds-muted">{{ fallbackText }}</span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { AgriVueRowActions, type VueRowActionItem } from '@agri/shared/vue/list'
import { usePointStore } from '@/stores/points'

export interface MdsRowActionItem extends VueRowActionItem {
  /** 可选按钮级权限点编码（与 v-point 等价，隐藏时自动登记到 PointHiddenNotice 横幅）。 */
  point?: string
}

const props = withDefaults(
  defineProps<{
    actions: readonly MdsRowActionItem[]
    maxVisible?: number
    moreLabel?: string
    fallbackText?: string
  }>(),
  {
    maxVisible: 2,
    moreLabel: '更多',
    fallbackText: '—',
  },
)

const points = usePointStore()
const hiddenMarked = new Set<string>()

const evaluated = computed(() =>
  props.actions.map((item) => {
    const deniedByPoint = Boolean(item.point && !points.can(item.point))
    return {
      item,
      deniedByPoint,
      effectiveHidden: Boolean(item.hidden || deniedByPoint),
    }
  }),
)

const visibleActions = computed<VueRowActionItem[]>(() =>
  evaluated.value
    .filter((entry) => !entry.effectiveHidden)
    .map((entry) => ({
      key: entry.item.key,
      label: entry.item.label,
      danger: entry.item.danger,
      disabled: entry.item.disabled,
      title: entry.item.title,
      confirm: entry.item.confirm,
      onClick: entry.item.onClick,
    })),
)

watch(
  evaluated,
  (list) => {
    const nextDenied = new Set<string>()
    for (const entry of list) {
      if (!entry.item.hidden && entry.deniedByPoint && entry.item.point) {
        nextDenied.add(entry.item.point)
      }
    }
    for (const code of [...hiddenMarked]) {
      if (!nextDenied.has(code)) {
        hiddenMarked.delete(code)
        points.unmarkHidden(code)
      }
    }
    for (const code of nextDenied) {
      if (!hiddenMarked.has(code)) {
        hiddenMarked.add(code)
        points.markHidden(code)
      }
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const code of hiddenMarked) {
    points.unmarkHidden(code)
  }
  hiddenMarked.clear()
})
</script>
