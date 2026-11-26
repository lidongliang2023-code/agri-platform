import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
import { Card } from 'ant-design-vue';
import '@/components/SectionCard.css';

/** Vue 业务分区卡片，保持生产端统一样式类名与圆角结构。 */
export default defineComponent({
  name: 'ProductionVueSectionCard',
  inheritAttrs: false,
  props: {
    title: null as unknown as PropType<VNodeChild | false>,
    extra: null as unknown as PropType<VNodeChild>,
    size: String as PropType<'default' | 'small'>,
    bordered: {
      type: Boolean,
      default: true
    },
    loading: Boolean,
    styles:Object as PropType<{body?: Record<string,any>;header?:Record<string,any>}>,
    hoverable: Boolean,
    cover: null as unknown as PropType<VNodeChild>,
    actions: Array as PropType<VNodeChild[]>,
    onClick: Function as PropType<(event: MouseEvent) => void>,
    bodyStyle: Object,
    headStyle: Object
  },
  setup(props, {
    attrs,
    slots
  }) {
    return () => {
      const cls = ['production-section-card', attrs.class];
      const cardProps: Record<string, unknown> = {
        ...attrs,
        ...props,
        bodyStyle: props.bodyStyle ?? props.styles?.body, headStyle:props.headStyle??props.styles?.header,
        class: cls
      };
      if (props.title === false) delete cardProps.title;
      return h(Card, cardProps, {
        default: () => slots.default?.(),
        ...(props.extra !== undefined ? {
          extra: () => props.extra
        } : slots.extra ? {
          extra: slots.extra
        } : {}),
        ...(props.title && typeof props.title !== 'string' ? {
          title: () => props.title
        } : slots.title ? {
          title: slots.title
        } : {})
      });
    };
  }
});
