import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from './vue-form';
import { ArrowRightOutlined, EyeOutlined, MessageOutlined, StarOutlined } from "@ant-design/icons-vue";
import { Button, Tag } from "./vue-ui";
import { useApp } from '../app-context';
import type { Article, Quote, SeriesPoint } from '../types';

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
    const tone = computed(() => toneOf(value.value));
    const prefix = computed(() => tone.value === 'up' ? '+' : '');
    return () => {
      const view_prefix = prefix.value;
      const view_value = value.value;
      const view_digits = digits.value;
      return <span class={`change-pct ${tone.value}`}>{view_prefix}{Number(view_value).toFixed(view_digits)}%</span>;
    };
  }
});
export const Price = defineComponent({
  name: "Price",
  props: {
    value: null as unknown as PropType<{
      value: number;
      unit?: string;
    }["value"]>,
    unit: null as unknown as PropType<{
      value: number;
      unit?: string;
    }["unit"]>
  },
  setup(__props: {
    value: number;
    unit?: string;
  }, {
    slots: __slots
  }) {
    const value = computed(() => __props.value);
    const unit = computed(() => __props.unit);
    return () => {
      const view_value = value.value;
      const view_unit = unit.value;
      return <span class="price-value">{Number(view_value).toFixed(2)}{view_unit && <small>{view_unit}</small>}</span>;
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
      tone?: 'default' | 'up' | 'down' | 'warn';
    }["label"]>,
    value: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: 'default' | 'up' | 'down' | 'warn';
    }["value"]>,
    unit: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: 'default' | 'up' | 'down' | 'warn';
    }["unit"]>,
    note: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: 'default' | 'up' | 'down' | 'warn';
    }["note"]>,
    tone: null as unknown as PropType<{
      label: string;
      value: string | number;
      unit?: string;
      note?: string;
      tone?: 'default' | 'up' | 'down' | 'warn';
    }["tone"]>
  },
  setup(__props: {
    label: string;
    value: string | number;
    unit?: string;
    note?: string;
    tone?: 'default' | 'up' | 'down' | 'warn';
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
export const ToneTag = defineComponent({
  name: "ToneTag",
  props: {
    tone: null as unknown as PropType<{
      tone: string;
      children?: VNodeChild;
    }["tone"]>,
    children: null as unknown as PropType<{
      tone: string;
      children?: VNodeChild;
    }["children"]>
  },
  setup(__props: {
    tone: string;
    children?: VNodeChild;
  }, {
    slots: __slots
  }) {
    const tone = computed(() => __props.tone);
    const children = computed(() => __slots.default?.());
    return () => {
      const view_tone = tone.value;
      const view_children = children.value;
      return <Tag class={`soft-tag tone-${view_tone}`}>{view_children}</Tag>;
    };
  }
});

/** 迷你走势图：只画折线，用于表格与卡片。 */
export const Sparkline = defineComponent({
  name: "Sparkline",
  props: {
    points: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
      tone?: 'up' | 'down' | 'flat';
    }["points"]>,
    width: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
      tone?: 'up' | 'down' | 'flat';
    }["width"]>,
    height: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
      tone?: 'up' | 'down' | 'flat';
    }["height"]>,
    tone: null as unknown as PropType<{
      points: number[];
      width?: number;
      height?: number;
      tone?: 'up' | 'down' | 'flat';
    }["tone"]>
  },
  setup(__props: {
    points: number[];
    width?: number;
    height?: number;
    tone?: 'up' | 'down' | 'flat';
  }, {
    slots: __slots
  }) {
    const points = computed(() => __props.points);
    const width = computed(() => __props.width ?? 96);
    const height = computed(() => __props.height ?? 28);
    const tone = computed(() => __props.tone);
    return () => {
      const view_points = points.value;
      const view_width = width.value;
      const view_height = height.value;
      const view_tone = tone.value;
      if (!view_points.length) return <span class="spark-empty">—</span>;
      const min = Math.min(...view_points);
      const max = Math.max(...view_points);
      const span = max - min || 1;
      const step = view_width / Math.max(view_points.length - 1, 1);
      const path = view_points.map((value, index) => `${(index * step).toFixed(1)},${(view_height - (value - min) / span * (view_height - 4) - 2).toFixed(1)}`).join(' ');
      const resolved = view_tone ?? toneOf(view_points[view_points.length - 1] - view_points[0]);
      return <svg class={`sparkline ${resolved}`} width={view_width} height={view_height} viewBox={`0 0 ${view_width} ${view_height}`} role="img" aria-label="近期走势">
      <polyline points={path} fill="none" stroke-width="1.8" />
    </svg>;
    };
  }
});

/** 30 日价格走势 + 7 日 AI 预测区间（预测段虚线、区间半透明填充）。 */
export const TrendChart = defineComponent({
  name: "TrendChart",
  props: {
    series: null as unknown as PropType<{
      series: SeriesPoint[];
      height?: number;
    }["series"]>,
    height: null as unknown as PropType<{
      series: SeriesPoint[];
      height?: number;
    }["height"]>
  },
  setup(__props: {
    series: SeriesPoint[];
    height?: number;
  }, {
    slots: __slots
  }) {
    const series = computed(() => __props.series);
    const height = computed(() => __props.height ?? 260);
    return () => {
      const view_series = series.value;
      const view_height = height.value;
      if (!view_series.length) return <div class="chart-empty">暂无走势数据</div>;
      const width = 720;
      const padding = {
        top: 18,
        right: 16,
        bottom: 26,
        left: 44
      };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = view_height - padding.top - padding.bottom;
      const prices = view_series.flatMap(point => [point.price ?? 0, point.low ?? point.price ?? 0, point.high ?? point.price ?? 0]);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const span = max - min || 1;
      const stepX = plotWidth / Math.max(view_series.length - 1, 1);
      const x = (index: number): number => padding.left + index * stepX;
      const y = (value: number): number => padding.top + plotHeight - (value - min) / span * plotHeight;
      const history = view_series.filter(point => !point.forecast);
      const forecast = view_series.filter(point => point.forecast);
      const historyPath = history.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.price ?? 0).toFixed(1)}`).join(' ');
      const offset = history.length;
      const forecastPoints = [history[history.length - 1], ...forecast].filter(Boolean);
      const forecastPath = forecastPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(offset - 1 + index).toFixed(1)},${y(point.price ?? 0).toFixed(1)}`).join(' ');
      const bandPoints = forecast.map((point, index) => `${x(offset + index).toFixed(1)},${y(point.high ?? point.price ?? 0).toFixed(1)}`);
      const bandBack = forecast.map((point, index) => `${x(offset + index).toFixed(1)},${y(point.low ?? point.price ?? 0).toFixed(1)}`).reverse();
      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => min + span * (1 - ratio));
      return <svg class="trend-chart" viewBox={`0 0 ${width} ${view_height}`} role="img" aria-label="价格走势与预测区间">
      {gridLines.map(value => <g key={value}>
          <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} class="chart-grid" />
          <text x={8} y={y(value) + 4} class="chart-axis">{value.toFixed(2)}</text>
        </g>)}
      {forecast.length > 0 && <>
          <line x1={x(offset - 1)} x2={x(offset - 1)} y1={padding.top} y2={padding.top + plotHeight} class="chart-divider" />
          <polygon class="chart-band" points={[...bandPoints, ...bandBack].join(' ')} />
        </>}
      <path d={historyPath} class="chart-line history" />
      {forecast.length > 0 && <path d={forecastPath} class="chart-line forecast" />}
      {view_series.map((point, index) => index === 0 || index === view_series.length - 1 ? <text key={point.date} x={x(index)} y={view_height - 8} text-anchor={index === 0 ? 'start' : 'end'} class="chart-axis">
            {point.date.slice(5)}
          </text> : null)}
    </svg>;
    };
  }
});
export const ArticleCard = defineComponent({
  name: "ArticleCard",
  props: {
    article: null as unknown as PropType<{
      article: Article;
      compact?: boolean;
    }["article"]>,
    compact: null as unknown as PropType<{
      article: Article;
      compact?: boolean;
    }["compact"]>
  },
  setup(__props: {
    article: Article;
    compact?: boolean;
  }, {
    slots: __slots
  }) {
    const article = computed(() => __props.article);
    const compact = computed(() => __props.compact);
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    return () => {
      const view_compact = compact.value;
      const view_navigate = navigate.value;
      const view_article = article.value;
      return <article class={`article-card${view_compact ? ' compact' : ''}`} onClick={() => view_navigate('news-detail', view_article.id)}>
      <div class={`article-cover type-${view_article.contentType}`}>
        <span>{view_article.coverIcon || '📰'}</span>
        {view_article.contentType === '短视频' && <i class="play-badge">▶</i>}
        {view_article.contentType === '直播' && <i class="play-badge live">●</i>}
      </div>
      <div class="article-body">
        <h3>
          {view_article.title}
          {view_article.aiGenerated && <em class="ai-chip">✦ AI 简报</em>}
          {view_article.isTop && <em class="top-chip">置顶</em>}
        </h3>
        {!view_compact && <p>{view_article.summary}</p>}
        <div class="article-meta">
          <span>{view_article.author}</span>
          <span>{view_article.publishedAt}</span>
          <span><EyeOutlined /> {formatCount(view_article.readCount)}</span>
          <span><MessageOutlined /> {view_article.commentCount}</span>
          <span><StarOutlined /> {view_article.favoriteCount}</span>
        </div>
      </div>
    </article>;
    };
  }
});
export const QuoteRow = defineComponent({
  name: "QuoteRow",
  props: {
    quote: null as unknown as PropType<{
      quote: Quote;
      onOpen: () => void;
    }["quote"]>,
    onOpen: null as unknown as PropType<{
      quote: Quote;
      onOpen: () => void;
    }["onOpen"]>
  },
  setup(__props: {
    quote: Quote;
    onOpen: () => void;
  }, {
    slots: __slots
  }) {
    const quote = computed(() => __props.quote);
    const onOpen = computed(() => __props.onOpen);
    const tone = toneOf(quote.value.changePct);
    return () => {
      const view_onOpen = onOpen.value;
      const view_quote = quote.value;
      return <tr onClick={view_onOpen}>
      <td>
        <b class="quote-name">{view_quote.icon} {view_quote.name}</b>
        {view_quote.monitorLevel === 'abnormal' && <em class="abnormal-chip">异动</em>}
      </td>
      <td>{view_quote.origin}</td>
      <td class="num"><b>{Number(view_quote.price).toFixed(2)}</b></td>
      <td class={`num ${tone}`}>{view_quote.changeAmount > 0 ? '+' : ''}{Number(view_quote.changeAmount).toFixed(2)}</td>
      <td class="num"><ChangePct value={view_quote.changePct} /></td>
      <td><Sparkline points={view_quote.trend} tone={tone} /></td>
      <td><button type="button" class="link-button" onClick={event => {
            event.stopPropagation();
            view_onOpen();
          }}>详情</button></td>
    </tr>;
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
    const icon = computed(() => __props.icon ?? '🌱');
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
export const AiCard = defineComponent({
  name: "AiCard",
  props: {
    title: null as unknown as PropType<{
      title: string;
      children?: VNodeChild;
      confidence?: number;
      actions?: VNodeChild;
    }["title"]>,
    children: null as unknown as PropType<{
      title: string;
      children?: VNodeChild;
      confidence?: number;
      actions?: VNodeChild;
    }["children"]>,
    confidence: null as unknown as PropType<{
      title: string;
      children?: VNodeChild;
      confidence?: number;
      actions?: VNodeChild;
    }["confidence"]>,
    actions: null as unknown as PropType<{
      title: string;
      children?: VNodeChild;
      confidence?: number;
      actions?: VNodeChild;
    }["actions"]>
  },
  setup(__props: {
    title: string;
    children?: VNodeChild;
    confidence?: number;
    actions?: VNodeChild;
  }, {
    slots: __slots
  }) {
    const title = computed(() => __props.title);
    const children = computed(() => __slots.default?.());
    const confidence = computed(() => __props.confidence);
    const actions = computed(() => __props.actions);
    return () => {
      const view_title = title.value;
      const view_children = children.value;
      const view_confidence = confidence.value;
      const view_actions = actions.value;
      return <section class="ai-card">
      <div class="ai-card-head"><span>✦</span>{view_title}</div>
      <div class="ai-card-body">{view_children}</div>
      {typeof view_confidence === 'number' && <div class="ai-confidence">
          <span>结论置信度</span>
          <span class="confidence-bar"><i style={{
              width: `${view_confidence}%`
            }} /></span>
          <b>{view_confidence}%</b>
        </div>}
      {view_actions && <div class="ai-card-actions">{view_actions}</div>}
    </section>;
    };
  }
});
export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}
