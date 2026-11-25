import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from './vue-form';
import { ArrowRightOutlined } from "@ant-design/icons-vue";
import { Button, Tag } from "./vue-ui";
import type { DistributionItem, TrendPoint } from '../types';

/** 涨跌配色遵循国内习惯：涨=红，跌=绿。 */
export function toneOf(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}
export const ChangePct = defineComponent({
  name: "ChangePct",
  props: {
    value: null as unknown as PropType<{
      value: number;
      digits?: number;
    }["value"]>,
    digits: null as unknown as PropType<{
      value: number;
      digits?: number;
    }["digits"]>
  },
  setup(__props: {
    value: number;
    digits?: number;
  }, {
    slots: __slots
  }) {
    const value = computed(() => __props.value);
    const digits = computed(() => __props.digits ?? 2);
    const tone = toneOf(value.value);
    return () => {
      const view_value = value.value;
      const view_digits = digits.value;
      return <span class={`change-pct ${tone}`}>{tone === 'up' ? '+' : ''}{Number(view_value).toFixed(view_digits)}%</span>;
    };
  }
});
export const PageTitle = defineComponent({
  name: "PageTitle",
  props: {
    eyebrow: null as unknown as PropType<{
      eyebrow?: string;
      title: string;
      description?: string;
      actions?: VNodeChild;
    }["eyebrow"]>,
    title: null as unknown as PropType<{
      eyebrow?: string;
      title: string;
      description?: string;
      actions?: VNodeChild;
    }["title"]>,
    description: null as unknown as PropType<{
      eyebrow?: string;
      title: string;
      description?: string;
      actions?: VNodeChild;
    }["description"]>,
    actions: null as unknown as PropType<{
      eyebrow?: string;
      title: string;
      description?: string;
      actions?: VNodeChild;
    }["actions"]>
  },
  setup(__props: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: VNodeChild;
  }, {
    slots: __slots
  }) {
    const eyebrow = computed(() => __props.eyebrow);
    const title = computed(() => __props.title);
    const description = computed(() => __props.description);
    const actions = computed(() => __props.actions);
    return () => {
      const view_eyebrow = eyebrow.value;
      const view_title = title.value;
      const view_description = description.value;
      const view_actions = actions.value;
      return <div class="page-title-row">
      <div>
        {view_eyebrow && <div class="page-eyebrow">{view_eyebrow}</div>}
        <h1>{view_title}</h1>
        {view_description && <p>{view_description}</p>}
      </div>
      {view_actions && <div class="page-actions">{view_actions}</div>}
    </div>;
    };
  }
});
export const SectionHeading = defineComponent({
  name: "SectionHeading",
  props: {
    kicker: null as unknown as PropType<{
      kicker?: string;
      title: string;
      action?: string;
      onAction?: () => void;
    }["kicker"]>,
    title: null as unknown as PropType<{
      kicker?: string;
      title: string;
      action?: string;
      onAction?: () => void;
    }["title"]>,
    action: null as unknown as PropType<{
      kicker?: string;
      title: string;
      action?: string;
      onAction?: () => void;
    }["action"]>,
    onAction: null as unknown as PropType<{
      kicker?: string;
      title: string;
      action?: string;
      onAction?: () => void;
    }["onAction"]>
  },
  setup(__props: {
    kicker?: string;
    title: string;
    action?: string;
    onAction?: () => void;
  }, {
    slots: __slots
  }) {
    const kicker = computed(() => __props.kicker);
    const title = computed(() => __props.title);
    const action = computed(() => __props.action);
    const onAction = computed(() => __props.onAction);
    return () => {
      const view_kicker = kicker.value;
      const view_title = title.value;
      const view_action = action.value;
      const view_onAction = onAction.value;
      return <div class="section-heading compact">
      <div>
        {view_kicker && <span class="section-kicker">{view_kicker}</span>}
        <h2>{view_title}</h2>
      </div>
      {view_action && view_onAction && <button type="button" onClick={view_onAction}>{view_action} <ArrowRightOutlined /></button>}
    </div>;
    };
  }
});
export const StatTile = defineComponent({
  name: "StatTile",
  props: {
    label: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: string;
    }["label"]>,
    value: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: string;
    }["value"]>,
    unit: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: string;
    }["unit"]>,
    note: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: string;
    }["note"]>,
    tone: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: string;
    }["tone"]>
  },
  setup(__props: {
    label: string;
    value: string | number;
    unit?: string;
    note?: string;
    tone?: string;
  }, {
    slots: __slots
  }) {
    const label = computed(() => __props.label);
    const value = computed(() => __props.value);
    const unit = computed(() => __props.unit);
    const note = computed(() => __props.note);
    const tone = computed(() => __props.tone ?? 'default');
    return () => {
      const view_tone = tone.value;
      const view_label = label.value;
      const view_value = value.value;
      const view_unit = unit.value;
      const view_note = note.value;
      return <div class={`stat-tile tone-${view_tone}`}>
      <span class="stat-label">{view_label}</span>
      <b class="stat-value">{view_value}{view_unit && <small>{view_unit}</small>}</b>
      {view_note && <span class="stat-note">{view_note}</span>}
    </div>;
    };
  }
});

/**
 * 状态文案的唯一映射（运营端各页面共用）。
 * `draft` 原先没有 —— 「退回修改」写入的就是这个状态，于是不但页签里没有，标签上也只显示英文原值。
 */
const STATUS_META: Record<string, {
  label: string;
  tone: string;
}> = {
  draft: {
    label: '草稿',
    tone: 'default'
  },
  published: {
    label: '已发布',
    tone: 'green'
  },
  pending: {
    label: '待审核',
    tone: 'amber'
  },
  reviewing: {
    label: '审核中',
    tone: 'amber'
  },
  offline: {
    label: '已下架',
    tone: 'default'
  },
  rejected: {
    label: '未通过',
    tone: 'up'
  },
  approved: {
    label: '已通过',
    tone: 'green'
  },
  online: {
    label: '在线',
    tone: 'green'
  },
  enabled: {
    label: '启用',
    tone: 'green'
  },
  disabled: {
    label: '停用',
    tone: 'default'
  },
  confirmed: {
    label: '已确认',
    tone: 'purple'
  },
  normal: {
    label: '正常',
    tone: 'green'
  },
  abnormal: {
    label: '异动',
    tone: 'up'
  },
  success: {
    label: '成功',
    tone: 'green'
  },
  failed: {
    label: '失败',
    tone: 'up'
  }
};

/** 状态中文文案（未知状态原样显示，不猜一个看起来合理的词） */
export function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status ?? '';
}
export const StatusTag = defineComponent({
  name: "StatusTag",
  props: {
    status: null as unknown as PropType<{
      status: string;
    }["status"]>
  },
  setup(__props: {
    status: string;
  }, {
    slots: __slots
  }) {
    const status = computed(() => __props.status);
    const hit = computed(() => STATUS_META[status.value] ?? {
      label: status.value || '—',
      tone: 'default'
    });
    return () => {
      const view_hit = hit.value;
      return <Tag class={`soft-tag tone-${view_hit.tone}`}>{view_hit.label}</Tag>;
    };
  }
});

/** 运营大盘趋势：产量柱 + PV 折线，双轴归一化到同一坐标系。 */
export const OpsTrendChart = defineComponent({
  name: "OpsTrendChart",
  props: {
    points: null as unknown as PropType<{
      points: TrendPoint[];
      height?: number;
    }["points"]>,
    height: null as unknown as PropType<{
      points: TrendPoint[];
      height?: number;
    }["height"]>
  },
  setup(__props: {
    points: TrendPoint[];
    height?: number;
  }, {
    slots: __slots
  }) {
    const points = computed(() => __props.points);
    const height = computed(() => __props.height ?? 220);
    return () => {
      const view_points = points.value;
      const view_height = height.value;
      if (!view_points.length) return <div class="chart-empty">暂无趋势数据</div>;
      const width = 720;
      const padding = {
        top: 16,
        right: 16,
        bottom: 26,
        left: 40
      };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = view_height - padding.top - padding.bottom;
      const maxProduced = Math.max(...view_points.map(point => point.produced), 1);
      const maxPv = Math.max(...view_points.map(point => point.pv), 1);
      const stepX = plotWidth / Math.max(view_points.length, 1);
      const barWidth = Math.max(stepX * 0.5, 4);
      const labelStep = Math.ceil(view_points.length / 8);
      const pvPath = view_points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(padding.left + stepX * index + stepX / 2).toFixed(1)},${(padding.top + plotHeight - point.pv / maxPv * plotHeight).toFixed(1)}`).join(' ');
      return <svg class="trend-chart" viewBox={`0 0 ${width} ${view_height}`} role="img" aria-label="内容产量与阅读量趋势">
      {[0, 0.5, 1].map(ratio => <line key={ratio} x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight * ratio} y2={padding.top + plotHeight * ratio} class="chart-grid" />)}
      {view_points.map((point, index) => {
          const barHeight = point.produced / maxProduced * plotHeight;
          return <rect key={point.date} x={padding.left + stepX * index + (stepX - barWidth) / 2} y={padding.top + plotHeight - barHeight} width={barWidth} height={barHeight} rx={2} class="chart-bar" />;
        })}
      <path d={pvPath} class="chart-line history" />
      {view_points.map((point, index) => index % labelStep === 0 && index < view_points.length - Math.max(1, Math.floor(labelStep / 2)) || index === view_points.length - 1 ? <text key={`label-${point.date}`} x={padding.left + stepX * index + stepX / 2} y={view_height - 8} text-anchor="middle" class="chart-axis">
            {point.date.slice(5)}
          </text> : null)}
    </svg>;
    };
  }
});

/** 内容分布环形图：用 stroke-dasharray 画多段圆环，避免引入图表库。 */
export const DistributionDonut = defineComponent({
  name: "DistributionDonut",
  props: {
    items: null as unknown as PropType<{
      items: DistributionItem[];
    }["items"]>
  },
  setup(__props: {
    items: DistributionItem[];
  }, {
    slots: __slots
  }) {
    const items = computed(() => __props.items);
    const radius = computed(() => 52);
    const circumference = computed(() => 2 * Math.PI * radius.value);
    return () => {
      const view_radius = radius.value;
      const view_items = items.value;
      const view_circumference = circumference.value;
      let offset = 0;
      return <div class="donut-wrap">
      <svg viewBox="0 0 140 140" class="donut" role="img" aria-label="内容渠道分布">
        <circle cx="70" cy="70" r={view_radius} fill="none" stroke="#eef3ef" stroke-width="16" />
        {view_items.map(item => {
            const length = item.percent / 100 * view_circumference;
            const dash = `${length} ${view_circumference - length}`;
            const element = <circle key={item.name} cx="70" cy="70" r={view_radius} fill="none" stroke={item.color} stroke-width="16" stroke-dasharray={dash} stroke-dashoffset={-offset} transform="rotate(-90 70 70)" />;
            offset += length;
            return element;
          })}
      </svg>
      <div class="donut-legend">
        {view_items.map(item => <div class="donut-legend-row" key={item.name}>
            <i style={{
              background: item.color
            }} />
            <span>{item.name}</span>
            <b>{item.count}</b>
            <small>{item.percent}%</small>
          </div>)}
      </div>
    </div>;
    };
  }
});
export const Sparkline = defineComponent({
  name: "Sparkline",
  props: {
    points: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
    }["points"]>,
    width: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
    }["width"]>,
    height: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
    }["height"]>
  },
  setup(__props: {
    points: number[];
    width?: number;
    height?: number;
  }, {
    slots: __slots
  }) {
    const points = computed(() => __props.points);
    const width = computed(() => __props.width ?? 88);
    const height = computed(() => __props.height ?? 26);
    return () => {
      const view_points = points.value;
      const view_width = width.value;
      const view_height = height.value;
      if (!view_points.length) return <span class="spark-empty">—</span>;
      const min = Math.min(...view_points);
      const max = Math.max(...view_points);
      const span = max - min || 1;
      const step = view_width / Math.max(view_points.length - 1, 1);
      const path = view_points.map((value, index) => `${(index * step).toFixed(1)},${(view_height - (value - min) / span * (view_height - 4) - 2).toFixed(1)}`).join(' ');
      return <svg class={`sparkline ${toneOf(view_points[view_points.length - 1] - view_points[0])}`} width={view_width} height={view_height} viewBox={`0 0 ${view_width} ${view_height}`} role="img" aria-label="近期走势">
      <polyline points={path} fill="none" stroke-width="1.8" />
    </svg>;
    };
  }
});
export const EmptyState = defineComponent({
  name: "EmptyState",
  props: {
    icon: null as unknown as PropType<{
      icon?: string;
      title: string;
      description?: string;
      action?: VNodeChild;
    }["icon"]>,
    title: null as unknown as PropType<{
      icon?: string;
      title: string;
      description?: string;
      action?: VNodeChild;
    }["title"]>,
    description: null as unknown as PropType<{
      icon?: string;
      title: string;
      description?: string;
      action?: VNodeChild;
    }["description"]>,
    action: null as unknown as PropType<{
      icon?: string;
      title: string;
      description?: string;
      action?: VNodeChild;
    }["action"]>
  },
  setup(__props: {
    icon?: string;
    title: string;
    description?: string;
    action?: VNodeChild;
  }, {
    slots: __slots
  }) {
    const icon = computed(() => __props.icon ?? '🗂️');
    const title = computed(() => __props.title);
    const description = computed(() => __props.description);
    const action = computed(() => __props.action);
    return () => {
      const view_icon = icon.value;
      const view_title = title.value;
      const view_description = description.value;
      const view_action = action.value;
      return <div class="empty-state">
      <span>{view_icon}</span>
      <strong>{view_title}</strong>
      {view_description && <p>{view_description}</p>}
      {view_action}
    </div>;
    };
  }
});
export const LoadingBlock = defineComponent({
  name: "LoadingBlock",
  props: {
    rows: null as unknown as PropType<{
      rows?: number;
    }["rows"]>
  },
  setup(__props: {
    rows?: number;
  }, {
    slots: __slots
  }) {
    const rows = computed(() => __props.rows ?? 3);
    return () => {
      const view_rows = rows.value;
      return <div class="loading-list">
      {Array.from({
          length: view_rows
        }, (_, index) => <div class="skeleton-card" key={index}><i /><span /><span /></div>)}
    </div>;
    };
  }
});
export const ErrorBlock = defineComponent({
  name: "ErrorBlock",
  props: {
    message: null as unknown as PropType<{
      message: string;
      onRetry?: () => void;
    }["message"]>,
    onRetry: null as unknown as PropType<{
      message: string;
      onRetry?: () => void;
    }["onRetry"]>
  },
  setup(__props: {
    message: string;
    onRetry?: () => void;
  }, {
    slots: __slots
  }) {
    const message = computed(() => __props.message);
    const onRetry = computed(() => __props.onRetry);
    return () => {
      const view_message = message.value;
      const view_onRetry = onRetry.value;
      return <EmptyState icon="🛠️" title="数据暂时未加载" description={view_message} action={<Button type="primary" onClick={view_onRetry ?? (() => window.location.reload())}>重新加载</Button>} />;
    };
  }
});
export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}
export function riskLabel(level: string): {
  label: string;
  tone: string;
} {
  if (level === 'high') return {
    label: '高风险',
    tone: 'up'
  };
  if (level === 'medium') return {
    label: '中风险',
    tone: 'amber'
  };
  if (level === 'low') return {
    label: '低风险',
    tone: 'purple'
  };
  return {
    label: '无风险',
    tone: 'green'
  };
}
