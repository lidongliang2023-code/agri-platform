<template>
  <ul class="agri-detail-related-list">
    <li
      v-for="(item, idx) in items"
      :key="item.key ?? `${item.label}-${idx}`"
      class="agri-detail-related-row"
    >
      <span class="agri-detail-related-label">{{ item.label }}</span>
      <span class="agri-detail-related-value">
        <button
          v-if="(item.code || item.text) && item.onClick && item.clickable !== false"
          type="button"
          class="agri-detail-related-link"
          :class="{ 'is-mono': item.mono !== false && Boolean(item.code) }"
          @click="item.onClick()"
        >
          {{ item.code || item.text }}
        </button>
        <span
          v-else-if="item.code || item.text"
          class="agri-detail-related-text"
          :class="{ 'is-mono': item.mono !== false && Boolean(item.code) }"
        >
          {{ item.code || item.text }}
        </span>
        <span v-else class="agri-detail-related-empty">
          {{ item.emptyText || '暂无' }}
        </span>
        <span
          v-if="item.badge"
          class="agri-detail-status-pill"
          :class="`is-${resolveDetailStatusTone(item.badgeTone)}`"
        >
          {{ item.badge }}
        </span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { resolveDetailStatusTone, type DetailRelatedDocItem } from './detailUtils'
import './AgriVueDetail.css'

defineProps<{
  items: DetailRelatedDocItem[]
}>()
</script>
