<template>
  <ol class="agri-detail-timeline">
    <li
      v-for="(item, idx) in normalizedItems"
      :key="item.key ?? `${item.title}-${idx}`"
      class="agri-detail-timeline-item"
      :class="`is-${item.state}`"
    >
      <div class="agri-detail-timeline-rail" aria-hidden="true">
        <span class="agri-detail-timeline-dot" />
        <span class="agri-detail-timeline-line" />
      </div>
      <div class="agri-detail-timeline-content">
        <div class="agri-detail-timeline-title">{{ item.title }}</div>
        <div v-if="item.time" class="agri-detail-timeline-sub">{{ item.time }}</div>
        <div v-if="item.description" class="agri-detail-timeline-sub">{{ item.description }}</div>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeTimelineState, type DetailTimelineStep } from './detailUtils'
import './AgriVueDetail.css'

const props = defineProps<{
  items: DetailTimelineStep[]
}>()

const normalizedItems = computed(() =>
  props.items.map(item => ({
    ...item,
    state: normalizeTimelineState(item.state),
  })),
)
</script>
