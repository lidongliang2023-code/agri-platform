import { defineComponent, h, isVNode, Fragment, type PropType, type VNode, type VNodeChild } from 'vue';
import { Button, Dropdown, Menu, Popconfirm, Space } from 'ant-design-vue';
import { DownOutlined } from '@ant-design/icons-vue';
function flatten(nodes: VNodeChild): VNode[] {
  const result: VNode[] = [];
  const visit = (item: unknown) => {
    if (!item || typeof item === 'boolean') return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (isVNode(item)) {
      if (item.type === Fragment || item.type === Space || (item.type as any)?.name === 'ProductionVueListRowActions') {
        const children = item.children;
        visit(children && typeof children === 'object' && 'default' in children ? (children as any).default() : children);
        return;
      }
      result.push(item);
    }
  };
  visit(nodes);
  return result;
}
function asMenuItem(node: VNode, index: number) {
  const props = (node.props ?? {}) as Record<string, any>;
  const key = String(node.key ?? index);
  if (node.type === Popconfirm || typeof node.type === 'object' && (node.type as any)?.name?.includes('Popconfirm')) {
    const child = flatten(typeof node.children === 'object' && node.children && 'default' in node.children ? (node.children as any).default() : node.children)[0];
    const disabled = Boolean(props.disabled || (child?.props as any)?.disabled);
    const danger = Boolean((child?.props as any)?.danger);
    return {
      key,
      disabled,
      danger,
      label: h('span', {
        onClick: (e: Event) => e.stopPropagation()
      }, [node])
    };
  }
  const disabled = Boolean(props.disabled);
  const danger = Boolean(props.danger);
  const label = typeof node.children === 'object' && node.children && 'default' in node.children ? (node.children as any).default() : node.children;
  return {
    key,
    disabled,
    danger,
    label: label ?? '操作',
    onClick: () => {
      if (!disabled) props.onClick?.();
    }
  };
}

/** 表格行操作收拢：最多平铺 2 个文字操作，其余自动归入「更多」下拉。 */
export default defineComponent({
  name: 'ProductionVueListRowActions',
  props: {
    items: Array as PropType<VNodeChild[]>,
    maxVisible: {
      type: Number,
      default: 2
    }
  },
  setup(props, {
    slots
  }) {
    return () => {
      const all = flatten(props.items ?? slots.default?.());
      if (!all.length) return null;
      const limit = Math.min(2, Math.max(1, props.maxVisible));
      if (all.length <= limit) return h('span', {
        class: 'agri-list-row-actions',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }
      }, all);
      const direct = all.slice(0, limit - 1);
      const overflow = all.slice(limit - 1);
      return h('span', {
        class: 'agri-list-row-actions',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }
      }, [...direct, h(Dropdown, {
        trigger: ['click'],
        placement: 'bottomRight'
      }, {
        default: () => h(Button, {
          type: 'link',
          size: 'small',
          style: {
            paddingInline: '4px'
          }
        }, () => ['更多 ', h(DownOutlined, {
          style: {
            fontSize: '11px'
          }
        })]),
        overlay: () => h(Menu, {
          items: overflow.map(asMenuItem)
        })
      })]);
    };
  }
});
