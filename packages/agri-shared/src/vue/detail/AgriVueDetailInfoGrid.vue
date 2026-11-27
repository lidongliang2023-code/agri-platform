<template>
  <div
    class="detail-info-grid"
    :class="className"
    :style="{ '--detail-info-columns': String(columns) }"
  >
    <div
      v-for="(item, idx) in items"
      :key="item.key ?? `${item.label}-${idx}`"
      class="detail-info-item"
      :class="{ 'detail-info-item-full': item.fullWidth }"
    >
      <div class="detail-info-label">{{ item.label }}</div>
      <div class="detail-info-value" :class="{ 'detail-info-mono': item.mono }">
        <slot :name="`value-${item.key}`" :item="item">
          {{ isEmpty(item.value) ? '—' : item.value }}
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface DetailInfoGridItem {
  key?: string
  label: string
  value?: string | number | null
  mono?: boolean
  fullWidth?: boolean
}

withDefaults(
  defineProps<{
    items: DetailInfoGridItem[]
    columns?: number
    className?: string
  }>(),
  {
    columns: 2,
    className: '',
  },
)

function isEmpty(val: unknown): boolean {
  return val === null || val === undefined || String(val).trim() === ''
}
</script>
