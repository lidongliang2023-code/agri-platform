import { defineComponent, h, type CSSProperties, type PropType, type VNodeChild } from 'vue'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailMetaEntry,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'

export type {
  DetailMetaEntry,
  DetailRelatedDocItem,
  DetailStatusBadge,
  DetailTabEntry,
  DetailTimelineStep,
}

export interface TradeDetailInfoItem {
  key?: string
  label: VNodeChild
  value: VNodeChild
  fullWidth?: boolean
  mono?: boolean
}

/**
 * 交易撮合统一详情页布局（基于 @agri/shared/vue/detail）。
 * 结构固定：吸顶页头（20px 等宽单号 + 状态胶囊 + 次要→危险→主要操作 + 内嵌页签）
 * → 左侧信息分组/明细子表 + 右侧 340px 状态进度与关联单据。
 */
export const TradeDetailLayout = defineComponent({
  name: 'TradeDetailLayout',
  inheritAttrs: false,
  props: {
    code: String,
    title: String,
    status: Object as PropType<DetailStatusBadge | null>,
    extraStatuses: Array as PropType<DetailStatusBadge[]>,
    meta: Array as PropType<DetailMetaEntry[]>,
    tabs: Array as PropType<DetailTabEntry[]>,
    activeTab: String,
    showBack: { type: Boolean, default: true },
    backLabel: { type: String, default: '返回列表' },
    stickyHeader: { type: Boolean, default: true },
    hasAside: { type: Boolean, default: true },
    actions: null as unknown as PropType<VNodeChild>,
    banner: null as unknown as PropType<VNodeChild>,
    aside: null as unknown as PropType<VNodeChild>,
    onBack: Function as PropType<() => void>,
    onTabChange: Function as PropType<(key: string) => void>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const slotMap: Record<string, () => VNodeChild> = {
        default: () => slots.default?.(),
      }
      if (props.actions !== undefined && props.actions !== null && props.actions !== false) {
        slotMap.actions = () => props.actions
      } else if (slots.actions) {
        slotMap.actions = () => slots.actions?.()
      }
      if (props.banner !== undefined && props.banner !== null && props.banner !== false) {
        slotMap.banner = () => props.banner
      } else if (slots.banner) {
        slotMap.banner = () => slots.banner?.()
      }
      if (props.aside !== undefined && props.aside !== null && props.aside !== false) {
        slotMap.aside = () => props.aside
      } else if (slots.aside) {
        slotMap.aside = () => slots.aside?.()
      }
      return h(
        AgriVueDetailLayout,
        {
          ...attrs,
          code: props.code,
          title: props.title,
          status: props.status,
          extraStatuses: props.extraStatuses,
          meta: props.meta,
          tabs: props.tabs,
          activeTab: props.activeTab,
          showBack: props.showBack,
          backLabel: props.backLabel,
          stickyHeader: props.stickyHeader,
          hasAside: props.hasAside,
          onBack: props.onBack,
          onTabChange: props.onTabChange,
        },
        slotMap,
      )
    }
  },
})

export const TradeDetailSection = defineComponent({
  name: 'TradeDetailSection',
  inheritAttrs: false,
  props: {
    title: String,
    flush: Boolean,
    extra: null as unknown as PropType<VNodeChild>,
    footer: null as unknown as PropType<VNodeChild>,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const slotMap: Record<string, () => VNodeChild> = {
        default: () => slots.default?.(),
      }
      if (props.extra !== undefined && props.extra !== null && props.extra !== false) {
        slotMap.extra = () => props.extra
      } else if (slots.extra) {
        slotMap.extra = () => slots.extra?.()
      }
      if (props.footer !== undefined && props.footer !== null && props.footer !== false) {
        slotMap.footer = () => props.footer
      } else if (slots.footer) {
        slotMap.footer = () => slots.footer?.()
      }
      return h(AgriVueDetailSection, { ...attrs, title: props.title, flush: props.flush }, slotMap)
    }
  },
})

export const TradeDetailTimeline = defineComponent({
  name: 'TradeDetailTimeline',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<DetailTimelineStep[]>, required: true },
  },
  setup(props, { attrs }) {
    return () => h(AgriVueDetailTimeline, { ...attrs, items: props.items })
  },
})

export const TradeDetailRelatedDocs = defineComponent({
  name: 'TradeDetailRelatedDocs',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<DetailRelatedDocItem[]>, required: true },
  },
  setup(props, { attrs }) {
    return () => h(AgriVueDetailRelated, { ...attrs, items: props.items })
  },
})

export const TradeDetailInfoGrid = defineComponent({
  name: 'TradeDetailInfoGrid',
  props: {
    items: { type: Array as PropType<TradeDetailInfoItem[]>, required: true },
    columns: { type: Number, default: 2 },
    className: String,
  },
  setup(props) {
    return () => (
      <div
        class={`detail-info-grid ${props.className ?? ''}`.trim()}
        style={{ '--detail-info-columns': props.columns } as CSSProperties}
      >
        {props.items.map((item, idx) => {
          const isEmpty = item.value === null || item.value === undefined || item.value === ''
          return (
            <div
              key={item.key ?? idx}
              class={`detail-info-item${item.fullWidth ? ' detail-info-item-full' : ''}`}
            >
              <div class="detail-info-label">{item.label}</div>
              <div class={`detail-info-value${item.mono ? ' detail-info-mono' : ''}`}>
                {isEmpty ? '—' : item.value}
              </div>
            </div>
          )
        })}
      </div>
    )
  },
})
