<template>
  <div class="agri-vue-row-actions">
    <button
      v-for="item in partitioned.visible"
      :key="item.key"
      type="button"
      class="agri-vue-action-link"
      :class="{ 'is-danger': item.danger }"
      :disabled="item.disabled"
      :title="item.title"
      @click="triggerAction(item)"
    >
      {{ item.label }}
    </button>

    <div v-if="partitioned.overflow.length" ref="moreRef" class="agri-vue-more-wrap">
      <button
        ref="triggerRef"
        type="button"
        class="agri-vue-action-link"
        :aria-expanded="open"
        @click.stop="toggleMenu"
      >
        {{ moreLabel }}
      </button>
      <Teleport to="body">
        <div
          v-if="open"
          ref="menuRef"
          class="agri-vue-more-menu agri-vue-more-menu--portal"
          :style="menuStyle"
          role="menu"
        >
          <button
            v-for="item in partitioned.overflow"
            :key="item.key"
            type="button"
            role="menuitem"
            class="agri-vue-more-item"
            :class="{ 'is-danger': item.danger }"
            :disabled="item.disabled"
            :title="item.title"
            @click.stop="triggerAction(item, true)"
          >
            {{ item.label }}
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})
const partitioned = computed(() => partitionRowActions(props.actions, props.maxVisible))

function updateMenuPosition() {
  if (!triggerRef.value || typeof window === 'undefined') return
  const rect = triggerRef.value.getBoundingClientRect()
  const menuHeight = menuRef.value?.offsetHeight ?? 140
  const menuWidth = menuRef.value?.offsetWidth ?? 120
  const spaceBelow = window.innerHeight - rect.bottom
  const top = spaceBelow < menuHeight + 12 && rect.top > menuHeight + 12
    ? Math.max(8, rect.top - menuHeight - 4)
    : Math.min(window.innerHeight - 8, rect.bottom + 4)
  const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth))
  menuStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    right: 'auto',
    zIndex: '2600',
  }
}

async function toggleMenu() {
  open.value = !open.value
  if (open.value) {
    updateMenuPosition()
    await nextTick()
    updateMenuPosition()
  }
}

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
  if (!target) return
  if (moreRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

function handleScrollOrResize() {
  if (open.value) open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocClick)
  window.addEventListener('scroll', handleScrollOrResize, true)
  window.addEventListener('resize', handleScrollOrResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
})
</script>
