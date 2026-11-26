import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
/**
 * 指标值展示组件（数据源缺失时显式降级）
 *
 * 背景：此前看板类页面把「后端没返回的字段」用本地示例值 / 0 顶上，
 * 用户在同一张卡片上看到真数和假数混排却分不出来。
 *
 * 纪律（项目铁规矩）：
 * - 后端没有的字段显示「—」，不许本地算、不许填 0、不许填随机数；
 * - 降级必须让用户看得见：缺失值旁给出警示图标 + Tooltip 说明「后端暂无该指标数据源」。
 *
 * 因此本组件在 `value === null` 时渲染灰色「—」+ 橙色信息图标（hover 出提示），
 * 而不是渲染一个看起来正常的数字。
 */

import { Space, Statistic, Tooltip, Typography } from '@/vue/ui';
import { InfoCircleOutlined } from '@ant-design/icons-vue';
import { formatMetric, toFiniteNumber } from '@/utils/metric-format';

/** 缺失值展示文案 */
export const MISSING_VALUE_TEXT = '—';

/** 缺失值默认提示语 */
export const MISSING_VALUE_TIP = '后端暂无该指标数据源，显示为「—」，接口补齐后自动填充';

/** 指标值展示组件入参 */
export interface MetricStatisticProps {
  /** 指标标题 */
  title: string;
  /** 指标值；null 表示后端未提供该数据源 */
  value: number | null;
  /** 小数位，缺省 0 */
  precision?: number;
  /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
  suffix?: VNodeChild;
  /** 前置内容（图标等） */
  prefix?: VNodeChild;
  /** 数值样式 */
  valueStyle?: CSSProperties;
  /** 缺失时的自定义提示语 */
  missingTip?: string;
}

/**
 * 指标值展示组件。
 *
 * @param props 见 MetricStatisticProps
 * @returns 数值，或带可见提示的「—」
 */
const MetricStatistic = defineComponent({
  name: "MetricStatistic",
  props: {
    title: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["title"]>,
    value: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["value"]>,
    precision: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["precision"]>,
    suffix: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["suffix"]>,
    prefix: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["prefix"]>,
    valueStyle: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["valueStyle"]>,
    missingTip: null as unknown as PropType<{
      /** 指标标题 */
      title: string;
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
      suffix?: VNodeChild;
      /** 前置内容（图标等） */
      prefix?: VNodeChild;
      /** 数值样式 */
      valueStyle?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["missingTip"]>
  },
  setup(__props: {
    title: string;
    value: number | null;
    precision?: number;
    suffix?: VNodeChild;
    prefix?: VNodeChild;
    valueStyle?: CSSProperties;
    missingTip?: string;
  }, {
    slots: __slots
  }) {
    return () => {
      if (__props.value === null) {
        return <Tooltip title={__props.missingTip ?? MISSING_VALUE_TIP}>
        <Statistic title={<Space size={4}>
              <span>{__props.title}</span>
              <InfoCircleOutlined style={{
              fontSize: 12,
              color: '#faad14'
            }} />
            </Space>} value={MISSING_VALUE_TEXT} valueStyle={{
            color: '#bfbfbf',
            ...__props.valueStyle
          }} />
      </Tooltip>;
      }
      return <Statistic title={__props.title} value={__props.value} precision={__props.precision ?? 0} suffix={<span>{__props.suffix}</span>} prefix={<span>{__props.prefix}</span>} valueStyle={__props.valueStyle} />;
    };
  }
});
export default MetricStatistic;
/** 行内数值入参（表格列 / 描述项 / 卡片大数等任意位置） */
export interface MetricNumberProps {
  /**
   * 指标值。
   *
   * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
   * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
   * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
   * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
   */
  value: unknown;
  /** 小数位，缺省 0 */
  precision?: number;
  /** 区域，缺省 zh-CN */
  locale?: string;
  /** 单位后缀，如「 亩」 */
  suffix?: string;
  /** 前置内容，如「¥ 」 */
  prefix?: VNodeChild;
  /** 数值样式 */
  style?: CSSProperties;
  /** 缺失时的自定义提示语 */
  missingTip?: string;
}

/**
 * 行内数值（表格列 / Descriptions / 卡片大数通用）。
 *
 * 与 `MetricText` 的区别：入参收 `unknown`（后端原始字段），
 * 内部先经 `toFiniteNumber` 判定，缺失时渲染「—」+ 橙色信息图标（hover 出提示），
 * **不渲染 0、不渲染空白**。
 *
 * @param props 见 MetricNumberProps
 * @returns 千分位数值，或带可见提示的「—」
 */
export const MetricNumber = defineComponent({
  name: "MetricNumber",
  props: {
    value: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["value"]>,
    precision: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["precision"]>,
    locale: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["locale"]>,
    suffix: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["suffix"]>,
    prefix: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["prefix"]>,
    style: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["style"]>,
    missingTip: null as unknown as PropType<{
      /**
       * 指标值。
       *
       * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
       * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
       * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
       * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
       */
      value: unknown;
      /** 小数位，缺省 0 */
      precision?: number;
      /** 区域，缺省 zh-CN */
      locale?: string;
      /** 单位后缀，如「 亩」 */
      suffix?: string;
      /** 前置内容，如「¥ 」 */
      prefix?: VNodeChild;
      /** 数值样式 */
      style?: CSSProperties;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["missingTip"]>
  },
  setup(__props: {
    value: unknown;
    precision?: number;
    locale?: string;
    suffix?: string;
    prefix?: VNodeChild;
    style?: CSSProperties;
    missingTip?: string;
  }, {
    slots: __slots
  }) {
    const numeric = computed(() => toFiniteNumber(__props.value));
    return () => {
      if (numeric.value === null) {
        return <Tooltip title={__props.missingTip ?? MISSING_VALUE_TIP}>
        <Typography.Text type="secondary" style={{
            cursor: 'help',
            ...__props.style
          }}>
          {MISSING_VALUE_TEXT}
          <InfoCircleOutlined style={{
              fontSize: 12,
              color: '#faad14',
              marginLeft: 2
            }} />
        </Typography.Text>
      </Tooltip>;
      }
      return <Typography.Text style={__props.style}>
      {__props.prefix}
      {formatMetric(numeric.value, {
          locale: __props.locale ?? 'zh-CN',
          minimumFractionDigits: __props.precision ?? 0,
          maximumFractionDigits: __props.precision ?? 0
        })}
      {__props.suffix ?? ''}
    </Typography.Text>;
    };
  }
});

/** 行内指标文案入参 */
export interface MetricTextProps {
  /** 指标值；null 表示后端未提供该数据源 */
  value: number | null;
  /** 固定小数位，缺省 0 */
  precision?: number;
  /**
   * 最多保留的小数位（与 {@link precision} 二选一）。
   *
   * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
   * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
   * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
   * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
   */
  maxPrecision?: number;
  /** 单位后缀 */
  suffix?: string;
  /** 缺失时的自定义提示语 */
  missingTip?: string;
}

/**
 * 行内指标文案（用于副标题 / 表格等不适合放整块 Statistic 的位置）。
 *
 * @param props 见 MetricTextProps
 * @returns 数值文案，或带可见提示的「—」
 */
export const MetricText = defineComponent({
  name: "MetricText",
  props: {
    value: null as unknown as PropType<{
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 固定小数位，缺省 0 */
      precision?: number;
      /**
       * 最多保留的小数位（与 {@link precision} 二选一）。
       *
       * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
       * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
       * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
       * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
       */
      maxPrecision?: number;
      /** 单位后缀 */
      suffix?: string;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["value"]>,
    precision: null as unknown as PropType<{
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 固定小数位，缺省 0 */
      precision?: number;
      /**
       * 最多保留的小数位（与 {@link precision} 二选一）。
       *
       * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
       * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
       * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
       * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
       */
      maxPrecision?: number;
      /** 单位后缀 */
      suffix?: string;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["precision"]>,
    maxPrecision: null as unknown as PropType<{
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 固定小数位，缺省 0 */
      precision?: number;
      /**
       * 最多保留的小数位（与 {@link precision} 二选一）。
       *
       * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
       * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
       * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
       * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
       */
      maxPrecision?: number;
      /** 单位后缀 */
      suffix?: string;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["maxPrecision"]>,
    suffix: null as unknown as PropType<{
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 固定小数位，缺省 0 */
      precision?: number;
      /**
       * 最多保留的小数位（与 {@link precision} 二选一）。
       *
       * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
       * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
       * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
       * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
       */
      maxPrecision?: number;
      /** 单位后缀 */
      suffix?: string;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["suffix"]>,
    missingTip: null as unknown as PropType<{
      /** 指标值；null 表示后端未提供该数据源 */
      value: number | null;
      /** 固定小数位，缺省 0 */
      precision?: number;
      /**
       * 最多保留的小数位（与 {@link precision} 二选一）。
       *
       * <p>2026-10-16 新增：`precision` 是**min=max** 的定长格式，而有些指标是带小数的实测量
       * （如采收数量 321.5 kg）—— 用默认 0 位会被抹成 322，看着像"数错了"。
       * 这个选项按"最多 N 位、不补零"输出（321.5 → `321.5`，1250 → `1,250`），
       * 既保住精度，也不给整数硬塞小数尾巴。传了它时忽略 `precision`。</p>
       */
      maxPrecision?: number;
      /** 单位后缀 */
      suffix?: string;
      /** 缺失时的自定义提示语 */
      missingTip?: string;
    }["missingTip"]>
  },
  setup(__props: {
    value: number | null;
    precision?: number;
    maxPrecision?: number;
    suffix?: string;
    missingTip?: string;
  }, {
    slots: __slots
  }) {
    return () => {
      if (__props.value === null) {
        return <Tooltip title={__props.missingTip ?? MISSING_VALUE_TIP}>
        <Typography.Text type="secondary" style={{
            cursor: 'help'
          }}>
          {MISSING_VALUE_TEXT}
          <InfoCircleOutlined style={{
              fontSize: 12,
              color: '#faad14',
              marginLeft: 2
            }} />
        </Typography.Text>
      </Tooltip>;
      }
      return <Typography.Text>
      {__props.maxPrecision === undefined ? __props.value.toLocaleString('zh-CN', {
          minimumFractionDigits: __props.precision ?? 0,
          maximumFractionDigits: __props.precision ?? 0
        }) : __props.value.toLocaleString('zh-CN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: __props.maxPrecision
        })}
      {__props.suffix ?? ''}
    </Typography.Text>;
    };
  }
});
