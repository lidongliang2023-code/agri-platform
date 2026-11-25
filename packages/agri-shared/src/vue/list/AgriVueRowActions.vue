<template>
  <div class="agri-vue-row-actions">
    <button
      v-for="item in partitioned.visible"
      :key="item.key"
      type="button"
      class="agri-vue-action-link"
      :class="{ 'is-danger': item.danger }"
      :disabled="item.disabled"
      @click="triggerAction(item)"
    >
      {{ item.label }}
    </button>

    <div v-if="partitioned.overflow.length" ref="moreRef" class="agri-vue-more-wrap">
      <button
        type="button"
        class="agri-vue-action-link"
        :aria-expanded="open"
        @click.stop="open = !open"
      >
        {{ moreLabel }}
      </button>
      <div v-if="open" class="agri-vue-more-menu" role="menu">
        <button
          v-for="item in partitioned.overflow"
          :key="item.key"
          type="button"
          role="menuitem"
          class="agri-vue-more-item"
          :class="{ 'is-danger': item.danger }"
          :disabled="item.disabled"
          @click.stop="triggerAction(item, true)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { partitionRowActions, type VueRowActionItem } from './vueListUtils'
import './AgriVueList.css'

const props = withDefaults(
  defineProps<{
    actions: readonly VueRowActionItem[]
    maxVisible?: number
    moreLabel?: string
  }>(),
  {
    maxVisible: 2,
    moreLabel: '更多',
  },
)

const emit = defineEmits<{
  action: [item: VueRowActionItem]
}>()

const open = ref(false)
const moreRef = ref<HTMLElement | null>(null)
const partitioned = computed(() => partitionRowActions(props.actions, props.maxVisible))

function triggerAction(item: VueRowActionItem, fromMenu = false) {
  if (item.disabled) return
  if (fromMenu) open.value = false
  if (item.confirm && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (!window.confirm(item.confirm)) return
  }
  item.onClick?.()
  emit('action', item)
}

function handleDocClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node | null
  if (moreRef.value && target && !moreRef.value.contains(target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocClick))
</script>
