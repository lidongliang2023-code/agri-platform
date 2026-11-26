import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
/**
 * 详情页信息栅格。
 *
 * <p>用「小标签 + 值」的信息块替代 antd `Descriptions` 的表格线样式：
 * 详情页的字段是"读"的，不需要边框网格；信息块按列排布，长字段（地址 / 资质）可独占一行。</p>
 *
 * <p>样式与生产管理用户端一致：浅绿底、12px 圆角、标签次要色、值加粗。</p>
 */

import '@/components/DetailInfoGrid.css';

/** 单个信息项 */
export interface DetailInfoItem {
  /** 唯一键（不传时用索引） */
  key?: string;
  /** 字段名 */
  label: VNodeChild;
  /** 字段值；null / undefined / 空串统一显示「—」 */
  value: VNodeChild;
  /** 是否独占一行（长地址、资质标签等） */
  fullWidth?: boolean;
}

/** 信息栅格入参 */
export interface DetailInfoGridProps {
  /** 信息项 */
  items: DetailInfoItem[];
  /** 桌面端列数，默认 2；窄屏自动降为 1 列 */
  columns?: number;
  /** 附加类名 */
  className?: string;
}

/**
 * 详情页信息栅格。
 *
 * @param props 见 DetailInfoGridProps
 * @returns 信息块栅格
 */
const DetailInfoGrid = defineComponent({
  name: "DetailInfoGrid",
  props: {
    items: null as unknown as PropType<{
      /** 信息项 */
      items: DetailInfoItem[];
      /** 桌面端列数，默认 2；窄屏自动降为 1 列 */
      columns?: number;
      /** 附加类名 */
      className?: string;
    }["items"]>,
    columns: null as unknown as PropType<{
      /** 信息项 */
      items: DetailInfoItem[];
      /** 桌面端列数，默认 2；窄屏自动降为 1 列 */
      columns?: number;
      /** 附加类名 */
      className?: string;
    }["columns"]>,
    className: null as unknown as PropType<{
      /** 信息项 */
      items: DetailInfoItem[];
      /** 桌面端列数，默认 2；窄屏自动降为 1 列 */
      columns?: number;
      /** 附加类名 */
      className?: string;
    }["className"]>
  },
  setup(__props: {
    items: DetailInfoItem[];
    columns?: number;
    className?: string;
  }, {
    slots: __slots
  }) {
    return () => {
      return <div class={`detail-info-grid ${__props.className ?? ''}`.trim()} style={{
        '--detail-info-columns': __props.columns ?? 2
      } as CSSProperties}>
      {__props.items.map((item, index) => <div key={item.key ?? index} class={`detail-info-item${item.fullWidth ? ' detail-info-item-full' : ''}`}>
          <div class="detail-info-label">{item.label}</div>
          <div class="detail-info-value">
            {item.value === undefined || item.value === null || item.value === '' ? '—' : item.value}
          </div>
        </div>)}
    </div>;
    };
  }
});
export default DetailInfoGrid;
