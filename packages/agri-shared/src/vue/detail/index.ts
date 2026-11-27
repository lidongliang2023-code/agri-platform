export { default as AgriVueDetailLayout } from './AgriVueDetailLayout.vue'
export { default as AgriVueDetailSection } from './AgriVueDetailSection.vue'
export { default as AgriVueDetailTimeline } from './AgriVueDetailTimeline.vue'
export { default as AgriVueDetailRelated } from './AgriVueDetailRelated.vue'
export { default as AgriVueDetailInfoGrid, type DetailInfoGridItem } from './AgriVueDetailInfoGrid.vue'
export type { DetailMetaEntry, DetailStatusBadge, DetailTabEntry } from './AgriVueDetailLayout.vue'
export {
  normalizeTimelineState,
  resolveDetailStatusTone,
  sortDetailActions,
  type DetailActionDescriptor,
  type DetailActionKind,
  type DetailRelatedDocItem,
  type DetailStatusTone,
  type DetailTimelineState,
  type DetailTimelineStep,
} from './detailUtils'
