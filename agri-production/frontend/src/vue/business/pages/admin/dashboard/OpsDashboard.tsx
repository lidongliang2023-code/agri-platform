import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
/**
 * 页面名称：运营管理大盘
 * 路由路径：/admin/production/dashboard
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #1
 * 原型来源：P1 dashboard — 运营管理大盘
 *
 * 数据来源约定（硬规矩：不造数据源；可以降级，不能骗人）：
 * - KPI 卡片只展示后端真实返回的字段，来源为 GET /admin/dashboard
 *   与 GET /admin/subjects/overview；后端没有的指标不渲染、不用原型数字填充；
 * - 区域分布（/admin/dashboard/region-distribution）与近 7 天趋势（/admin/dashboard/trend）
 *   使用生产域聚合接口，失败时明确提示；
 * - 告警级别分布取 GET /admin/dashboard/alert-trend，告警/审批列表取各自真实分页接口；
 * - 「较昨日涨跌」后端无同比数据源，因此不展示，也不再多保留一条造假百分比。
 */

import { Alert, App, Button, Card, Col, Empty, Modal, Radio, Row, Skeleton, Space, Statistic, Switch, Tag, Tooltip, Typography } from '@/vue/ui';
import { BellOutlined, EnvironmentOutlined, ExclamationCircleOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons-vue';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { useNavigate } from '@/vue/router';
import ReactECharts from '@/vue/VueECharts';
import { TiandituMap, chinaRegionCenter, type TiandituMapPoint } from '@/vue/business/shared';
import type { EChartsOption } from 'echarts';
import { listApprovals } from '@/api/admin/approvals';
import { closeAlert, listAdminAlerts } from '@/api/admin/alerts';
import { fetchAlertLevelMap, fetchRankItems, fetchRegionStats, fetchTrendPoints, getOpsDashboard } from '@/api/admin/dashboard';
import { getTenantOverview } from '@/api/admin/tenants';
import type { Alert as AlertItem0 } from '@/types';
const {
  Text,
  Title
} = Typography;

/** 自动刷新周期（秒） */
const AUTO_REFRESH_SECONDS = 300;

/** KPI 卡片定义（value 为 null 表示后端未提供该指标，展示「—」而不是 0） */
interface KpiItem {
  /** 唯一标识 */
  key: string;
  /** 标题 */
  title: string;
  /** 数值；null 表示后端未提供数据源 */
  value: number | null;
  /** 单位后缀 */
  suffix: string;
  /** 小数位数 */
  precision: number;
}

/** 近 7 天趋势数据项（后端 OpsTrendPoint 形态） */
interface TrendPoint {
  /** X 轴标签 */
  label: string;
  /** 验收完成率（%） */
  taskRate: number;
  /**
   * 当日作业人数（后端字段名 activeWorkers）。
   *
   * 口径：当日有作业记录的不同人数，**不是**登录活跃用户 / DAU。
   */
  activeWorkers: number;
  /** 告警数 */
  alertCount: number;
}

/** 区域统计项 */
interface RegionStatItem {
  /** 区域名称 */
  region: string;
  /** 农场数量 */
  farmCount: number;
  /** 在田面积（亩） */
  fieldArea: number;
  /** 活跃主体数 */
  tenantCount: number;
  /** 活跃度分层 */
  activityLevel: 'high' | 'middle' | 'low';
}

/** 告警列表项类型 */
interface AlertItem {
  /** 告警 ID */
  id: string;
  /** 告警标题 */
  title: string;
  /** 告警内容 */
  content: string;
  /** 告警级别 */
  level: string;
  /** 相对时间文案 */
  relativeTime: string;
  /** 关联对象 */
  target: string;
}

/** 待办审批项类型 */
interface ApprovalItem {
  /** 审批单 ID */
  id: string;
  /** 审批编号 */
  no: string;
  /** 审批类型 */
  type: string;
  /** 关联对象（企业 / 农场） */
  target: string;
  /** 申请人 */
  applicant: string;
  /** 提交时间 */
  submitTime: string;
  /** 优先级 */
  priority: string;
}

/**
 * 从后端返回的聚合 Map 中读取非负数值。
 *
 * 后端部分聚合字段会序列化成字符串（如 farmCount: "5"），故统一走 Number 强转；
 * 取不到值时返回 null（调用方展示「—」），**不再回退到任何原型口径数字**。
 *
 * @param source 后端返回对象
 * @param key 字段名
 * @returns 有效数字；缺失时为 null
 */
function pickNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const raw = (source as Record<string, unknown>)[key];
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 运营管理大盘
 *
 * 业务职责：平台级运营总览，含 KPI 卡片、全国生产分布、近 7 天趋势、
 * 平台告警中心与待办审批事项。所有区块只消费后端真实返回的数据，
 * 缺失的区块展示空态，不做本地兜底。
 *
 * @returns 页面内容
 */
const OpsDashboard = defineComponent({
  name: "OpsDashboard",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const {
      message
    } = App.useApp();
    const queryClient = useQueryClient();

    /** 自动刷新开关 */
    const autoRefresh = shallowRef<boolean>(true);
    /** 距离下次自动刷新的剩余秒数 */
    const setAutoRefresh = (next: typeof autoRefresh.value | ((previous: typeof autoRefresh.value) => typeof autoRefresh.value)) => {
      autoRefresh.value = typeof next === 'function' ? (next as (previous: typeof autoRefresh.value) => typeof autoRefresh.value)(autoRefresh.value) : next;
    };
    const countdown = shallowRef<number>(AUTO_REFRESH_SECONDS);
    /** 告警处理弹窗当前处理的告警 */
    const setCountdown = (next: typeof countdown.value | ((previous: typeof countdown.value) => typeof countdown.value)) => {
      countdown.value = typeof next === 'function' ? (next as (previous: typeof countdown.value) => typeof countdown.value)(countdown.value) : next;
    };
    const activeAlert = shallowRef<AlertItem | null>(null);
    /** 告警处理措施 */
    const setActiveAlert = (next: typeof activeAlert.value | ((previous: typeof activeAlert.value) => typeof activeAlert.value)) => {
      activeAlert.value = typeof next === 'function' ? (next as (previous: typeof activeAlert.value) => typeof activeAlert.value)(activeAlert.value) : next;
    };
    const alertMeasure = shallowRef<string>('联系负责人排查');
    /** 告警处理说明 */
    const setAlertMeasure = (next: typeof alertMeasure.value | ((previous: typeof alertMeasure.value) => typeof alertMeasure.value)) => {
      alertMeasure.value = typeof next === 'function' ? (next as (previous: typeof alertMeasure.value) => typeof alertMeasure.value)(alertMeasure.value) : next;
    };
    const alertRemark = shallowRef<string>('');

    /** 核心指标（/admin/dashboard/overview） */
    const setAlertRemark = (next: typeof alertRemark.value | ((previous: typeof alertRemark.value) => typeof alertRemark.value)) => {
      alertRemark.value = typeof next === 'function' ? (next as (previous: typeof alertRemark.value) => typeof alertRemark.value)(alertRemark.value) : next;
    };
    const metricsQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'metrics'],
      queryFn: () => getOpsDashboard(),
      retry: false
    }));

    /** 主体概览（/admin/tenants/overview，提供真实主体数） */
    const overviewQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'tenant-overview'],
      queryFn: () => getTenantOverview(),
      retry: false
    }));

    /** 区域分布（使用生产域聚合接口） */
    const regionQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'regions'],
      queryFn: () => fetchRegionStats(),
      retry: false
    }));

    /** 近 7 天趋势（使用生产域聚合接口） */
    const trendQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'trend'],
      queryFn: () => fetchTrendPoints(),
      retry: false
    }));

    /** 种植面积排行 */
    const rankQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'rank'],
      queryFn: () => fetchRankItems(10),
      retry: false
    }));

    /** 告警级别分布 */
    const alertLevelQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'alert-level'],
      queryFn: () => fetchAlertLevelMap(),
      retry: false
    }));

    /** 告警列表（最新 5 条） */
    const alertsQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'alerts'],
      queryFn: () => listAdminAlerts({
        pageNum: 1,
        pageSize: 5,
        status: 1
      }),
      retry: false
    }));

    /** 待办审批列表（最新 5 条） */
    const approvalsQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'approvals'],
      queryFn: () => listApprovals({
        pageNum: 1,
        pageSize: 5,
        status: 1
      }),
      retry: false
    }));

    /** 告警处理（关闭告警） */
    const alertMutation = useMutation(() => ({
      mutationFn: (payload: {
        id: string;
        remark: string;
      }) => closeAlert(payload.id, payload.remark),
      onSuccess: () => {
        message.success('告警处理已提交');
        setActiveAlert(null);
        setAlertRemark('');
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'dashboard']
        });
      }
    }));

    /** KPI 卡片数据：全部取自后端真实返回的字段，缺项展示「—」 */
    const kpiItems = computed<KpiItem[]>(() => {
      const dash = metricsQuery.data as unknown as Record<string, unknown> | undefined;
      const overview = overviewQuery.data;
      return [{
        key: 'activeTenants',
        title: '活跃主体',
        value: pickNumber(overview, 'activeTenantCount'),
        suffix: '家',
        precision: 0
      }, {
        key: 'farmCount',
        title: '农场总数',
        value: pickNumber(dash, 'farmCount'),
        suffix: '个',
        precision: 0
      }, {
        key: 'deviceOnline',
        title: '在线设备',
        value: pickNumber(dash, 'deviceOnline'),
        suffix: '台',
        precision: 0
      }, {
        key: 'taskPending',
        title: '未完成农事任务',
        value: pickNumber(dash, 'taskPending'),
        suffix: '条',
        precision: 0
      }, {
        key: 'alertPending',
        title: '待处理告警',
        value: pickNumber(dash, 'alertPending'),
        suffix: '条',
        precision: 0
      }];
    });

    /** 趋势数据：后端无此端点时为空数组，由页面渲染空态 */
    const trendPoints = computed<TrendPoint[]>(() => (trendQuery.data ?? []).map(item => ({
      label: item.label,
      taskRate: Number(item.taskRate) || 0,
      activeWorkers: Number(item.activeWorkers) || 0,
      alertCount: Number(item.alertCount) || 0
    })));

    /** 区域分布数据：后端无此端点时为空数组，由页面渲染空态 */
    const regionStats = computed<RegionStatItem[]>(() => (regionQuery.data ?? []).map(item => ({
      region: item.region,
      farmCount: Number(item.farmCount) || 0,
      fieldArea: Number(item.fieldArea) || 0,
      tenantCount: Number(item.tenantCount) || 0,
      activityLevel: item.activityLevel
    })));
    const regionMapPoints = computed<TiandituMapPoint[]>(() => {
      const result: TiandituMapPoint[] = [];
      regionStats.value.forEach(item => {
        const center = chinaRegionCenter(item.region);
        if (!center) return;
        result.push({
          id: item.region,
          longitude: center.longitude,
          latitude: center.latitude,
          title: item.region,
          meta: `${item.farmCount} 个农场 · ${item.fieldArea.toLocaleString('zh-CN')} 亩`,
          tone: item.activityLevel === 'high' ? 'green' : item.activityLevel === 'middle' ? 'orange' : 'red'
        });
      });
      return result;
    });

    /** 排行数据（后端 /rank 返回农场维度） */
    const rankItems = computed<Array<{
      name: string;
      value: number;
      plotCount: number;
    }>>(() => {
      const remote = rankQuery.data;
      if (!remote || remote.length === 0) {
        return [];
      }
      return remote.map(item => ({
        name: item.farmName,
        value: Number(item.areaTotal) || 0,
        plotCount: Number(item.plotCount) || 0
      }));
    });

    /** 未关闭告警按统一四级词表统计，与生产告警中心一致。 */
    const alertLevelCounts = computed(() => ({
      urgent: pickNumber(alertLevelQuery.data, 'urgent'),
      important: pickNumber(alertLevelQuery.data, 'important'),
      normal: pickNumber(alertLevelQuery.data, 'normal'),
      info: pickNumber(alertLevelQuery.data, 'info')
    }));

    /** 告警列表：只用后端返回数据，无数据时为空（渲染空态） */
    const alertItems = computed<AlertItem[]>(() => {
      const remote: AlertItem0[] | undefined = alertsQuery.data?.list;
      if (!remote || remote.length === 0) {
        return [];
      }
      return remote.map(item => ({
        id: item.alertId,
        title: item.alertTitle,
        content: item.alertContent,
        level: Number(item.alertLevel) >= 4 ? '紧急' : Number(item.alertLevel) === 3 ? '严重' : Number(item.alertLevel) === 2 ? '一般' : '提示',
        relativeTime: item.triggeredAt?.slice(11, 16) ?? '--:--',
        target: item.plotName ?? item.farmId ?? '—'
      }));
    });

    /** 待办审批列表：只用后端返回数据，无数据时为空（渲染空态） */
    const approvalItems = computed<ApprovalItem[]>(() => {
      const remote = approvalsQuery.data?.list;
      if (!remote || remote.length === 0) {
        return [];
      }
      return remote.slice(0, 5).map(item => ({
        id: item.approvalId,
        no: item.approvalNo,
        type: ({
          CERT: '历史认证申请',
          RECALL: '历史召回申请',
          QUOTA: '历史配额申请'
        } as Record<string, string>)[item.bizType ?? ''] ?? item.bizType ?? '历史申请',
        target: item.title ?? item.bizSummary ?? item.tenantName ?? item.approvalId,
        applicant: item.applicantName,
        submitTime: item.submitAt?.slice(0, 16) ?? '--:--',
        // 后端审批表无优先级字段，不展示编造的优先级
        priority: '—'
      }));
    });

    /** 请求失败的区块清单（用于统一降级提示） */
    const unavailableBlocks = computed<string[]>(() => {
      const blocks: string[] = [];
      if (trendQuery.isError) {
        blocks.push('近7天趋势：GET /admin/dashboard/trend 请求失败');
      }
      if (regionQuery.isError) {
        blocks.push('全国生产分布：GET /admin/dashboard/region-distribution 请求失败');
      }
      if (alertLevelQuery.isError) {
        blocks.push('告警级别分布（GET /admin/dashboard/alert-trend 不可用）');
      }
      if (metricsQuery.isError) {
        blocks.push('KPI 汇总（GET /admin/dashboard 不可用）');
      }
      if (overviewQuery.isError) {
        blocks.push('主体概览（GET /admin/subjects/overview 不可用）');
      }
      if (rankQuery.isError) {
        blocks.push('种植面积排行（GET /admin/dashboard/rank 不可用）');
      }
      if (alertsQuery.isError) {
        blocks.push('告警列表（GET /admin/alerts 不可用）');
      }
      if (approvalsQuery.isError) {
        blocks.push('待办审批（GET /admin/approvals 不可用）');
      }
      return blocks;
    });

    /** 自动刷新倒计时 */
    onMounted(() => {
      watch(() => [autoRefresh.value, queryClient], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!autoRefresh.value) {
            return undefined;
          }
          const timer = window.setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                void queryClient.invalidateQueries({
                  queryKey: ['admin', 'dashboard']
                });
                return AUTO_REFRESH_SECONDS;
              }
              return prev - 1;
            });
          }, 1000);
          return () => window.clearInterval(timer);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 手动刷新全部区块 */
    const handleRefresh = (): void => {
      setCountdown(AUTO_REFRESH_SECONDS);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'dashboard']
      });
    };

    /** 倒计时文案 mm:ss */
    const countdownText = `${String(Math.floor(countdown.value / 60)).padStart(2, '0')}:${String(countdown.value % 60).padStart(2, '0')}`;

    /** 区域分布图表配置 */
    const regionChartOption = computed<EChartsOption>(() => {
      const sorted = [...regionStats.value].sort((a, b) => a.farmCount - b.farmCount);
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          }
        },
        grid: {
          left: 8,
          right: 16,
          top: 16,
          bottom: 8,
          containLabel: true
        },
        xAxis: {
          type: 'value',
          name: '农场数',
          splitLine: {
            lineStyle: {
              type: 'dashed'
            }
          }
        },
        yAxis: {
          type: 'category',
          data: sorted.map(item => item.region)
        },
        series: [{
          type: 'bar',
          name: '农场数',
          barWidth: 14,
          itemStyle: {
            borderRadius: [0, 7, 7, 0],
            color: '#1677ff'
          },
          data: sorted.map(item => item.farmCount)
        }]
      };
    });

    /** 排行图表配置 */
    const rankChartOption = computed<EChartsOption>(() => ({
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: 8,
        right: 16,
        top: 32,
        bottom: 8,
        containLabel: true
      },
      legend: {
        data: ['种植面积(亩)', '地块数'],
        top: 0
      },
      xAxis: {
        type: 'category',
        data: rankItems.value.map(item => item.name),
        axisLabel: {
          interval: 0,
          rotate: 30
        }
      },
      yAxis: [{
        type: 'value',
        name: '面积(亩)'
      }, {
        type: 'value',
        name: '地块数'
      }],
      series: [{
        type: 'bar',
        name: '种植面积(亩)',
        data: rankItems.value.map(item => item.value),
        itemStyle: {
          color: '#13a05a',
          borderRadius: [4, 4, 0, 0]
        }
      }, {
        type: 'line',
        name: '地块数',
        yAxisIndex: 1,
        smooth: true,
        data: rankItems.value.map(item => item.plotCount),
        itemStyle: {
          color: '#faad14'
        }
      }]
    }));

    /** 近 7 天趋势图配置 */
    const trendChartOption = computed<EChartsOption>(() => ({
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: 8,
        right: 16,
        top: 40,
        bottom: 8,
        containLabel: true
      },
      legend: {
        data: ['验收完成率', '计划执行人数', '告警数'],
        top: 0
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendPoints.value.map(item => item.label)
      },
      yAxis: [{
        type: 'value',
        name: '作业/告警'
      }, {
        type: 'value',
        name: '完成率(%)',
        min: 0,
        max: 100
      }],
      series: [{
        type: 'line',
        name: '验收完成率',
        yAxisIndex: 1,
        smooth: true,
        data: trendPoints.value.map(item => item.taskRate),
        itemStyle: {
          color: '#1677ff'
        },
        areaStyle: {
          opacity: 0.12
        }
      }, {
        type: 'line',
        name: '计划执行人数',
        smooth: true,
        // 口径：当日有作业记录的不同人数（非登录活跃用户 / DAU）
        data: trendPoints.value.map(item => item.activeWorkers),
        itemStyle: {
          color: '#13a05a'
        }
      }, {
        type: 'bar',
        name: '告警数',
        barWidth: 18,
        data: trendPoints.value.map(item => item.alertCount),
        itemStyle: {
          color: '#ff7875',
          borderRadius: [4, 4, 0, 0]
        }
      }]
    }));

    /** 告警级别 → antd Tag 颜色 */
    const levelColorMap = computed<Record<string, string>>(() => ({
      紧急: 'red',
      严重: 'orange',
      一般: 'blue',
      提示: 'default'
    }));

    /** 区域活跃度 → 颜色 */
    const activityColorMap = computed<Record<string, string>>(() => ({
      high: '#52c41a',
      middle: '#faad14',
      low: '#ff4d4f'
    }));

    /** 区域活跃度 → 文案 */
    const activityTextMap = computed<Record<string, string>>(() => ({
      high: '高活跃',
      middle: '中活跃',
      low: '低活跃'
    }));

    /** 后端不可用区块的统一空态文案 */
    const emptyBlock = (label: string): VNodeChild => <div style={{
      textAlign: 'center',
      padding: '24px 0'
    }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">{label}：暂无可展示数据；接口失败时请查看页面提示</Text>} />
    </div>;
    return () => {
      return <div>
      {/* 顶部标题栏 + 自动刷新 */}
      <Row justify="space-between" align="middle" style={{
          marginBottom: 12
        }}>
        <Col>
          <Title level={4} style={{
              margin: 0
            }}>
            运营管理大盘
          </Title>
          <Text type="secondary">
            生产数据实时聚合；设备数来自物联网运营接口，历史审批仅供查询
          </Text>
        </Col>
        <Col>
          <Space>
            <Text type="secondary">自动刷新 {countdownText}</Text>
            <Switch checked={autoRefresh.value} onChange={checked => {
                setAutoRefresh(Boolean(checked));
                if (checked) {
                  setCountdown(AUTO_REFRESH_SECONDS);
                }
              }} checkedChildren="开" unCheckedChildren="关" />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 缺失端点必须让用户看见：明确列出哪些区块没有真实数据源 */}
      {unavailableBlocks.value.length > 0 && <Alert type="warning" showIcon style={{
          marginBottom: 12
        }} message={`以下 ${unavailableBlocks.value.length} 个区块个区块请求失败，请刷新重试`} description={<ul style={{
          margin: 0,
          paddingLeft: 18
        }}>
              {unavailableBlocks.value.map(item => <li key={item}>{item}</li>)}
            </ul>} />}

      {metricsQuery.data?.deviceStatsStatus === 'UNAVAILABLE' && <Alert type="warning" showIcon style={{
          marginBottom: 12
        }} message="物联网运营统计暂不可用或无访问权限，在线设备显示“—”，其他生产指标不受影响。" />}

      {/* KPI 卡片区：只渲染后端有数据源的指标 */}
      <Row gutter={[12, 12]}>
        {kpiItems.value.map(item => <Col key={item.key} xs={24} sm={12} md={8} lg={6} xl={4}>
            <Card size="small" bodyStyle={{
              padding: 16
            }}>
              {metricsQuery.isLoading || overviewQuery.isLoading ? <Skeleton active title={false} paragraph={{
                rows: 2
              }} /> : <Statistic title={item.title} value={item.value === null ? '—' : item.value} precision={item.precision} suffix={item.value === null ? undefined : item.suffix} formatter={(arg: any) => { const raw = arg && typeof arg === 'object' && 'value' in arg ? arg.value : arg; return typeof raw === 'number' ? Number(raw).toLocaleString('zh-CN') : String(raw ?? '—'); }} />}
            </Card>
          </Col>)}
      </Row>

      {/* 全国生产分布 + 近 7 天趋势 */}
      <Row gutter={[12, 12]} style={{
          marginTop: 12
        }}>
        <Col xs={24} lg={14}>
          <Card size="small" title="全国生产分布地图" extra={<Space size={4}>
                <Tag color="success">高活跃</Tag>
                <Tag color="warning">中活跃</Tag>
                <Tag color="error">低活跃</Tag>
                <Tooltip title="刷新区域分布">
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} />
                </Tooltip>
                <Tooltip title="定位到全部区域">
                  <Button size="small" icon={<EnvironmentOutlined />} onClick={() => message.info('已展示全部区域')} />
                </Tooltip>
              </Space>}>
            {regionQuery.isLoading ? <Skeleton active paragraph={{
                rows: 6
              }} /> : regionStats.value.length === 0 ? emptyBlock('全国生产分布') : <Space direction="vertical" size={12} style={{
                width: '100%'
              }}>
                <TiandituMap points={regionMapPoints.value} height={360} onPoint-click={point => message.info(`${point.title}：${point.meta || ''}`)} />
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <ReactECharts option={regionChartOption.value} style={{
                      height: 300
                    }} notMerge />
                  </Col>
                  <Col xs={24} md={12}>
                    <div style={{
                      maxHeight: 300,
                      overflowY: 'auto',
                      paddingRight: 4
                    }}>
                      {regionStats.value.map(item => <Card key={item.region} size="small" style={{
                        marginBottom: 8,
                        borderLeft: `3px solid ${activityColorMap.value[item.activityLevel]}`
                      }} bodyStyle={{
                        padding: 10
                      }}>
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Text strong>{item.region}</Text>
                              <div>
                                <Text type="secondary" style={{
                                fontSize: 12
                              }}>
                                  农场 {item.farmCount} · 主体 {item.tenantCount}
                                </Text>
                              </div>
                            </Col>
                            <Col style={{
                            textAlign: 'right'
                          }}>
                              <Text strong style={{
                              color: activityColorMap.value[item.activityLevel]
                            }}>
                                {item.fieldArea >= 10000 ? `${(item.fieldArea / 10000).toFixed(2)}万亩` : `${item.fieldArea.toLocaleString('zh-CN')}亩`}
                              </Text>
                              <div>
                                <Text type="secondary" style={{
                                fontSize: 12
                              }}>
                                  {activityTextMap.value[item.activityLevel]}
                                </Text>
                              </div>
                            </Col>
                          </Row>
                        </Card>)}
                    </div>
                  </Col>
                </Row>
              </Space>}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title="近7天趋势图" extra={<Text type="secondary">
                验收完成率 / 计划执行人数 / 新增告警数
              </Text>}>
            {trendQuery.isLoading ? <Skeleton active paragraph={{
                rows: 6
              }} /> : trendPoints.value.length === 0 ? emptyBlock('近7天趋势') : <ReactECharts option={trendChartOption.value} style={{
                height: 300
              }} notMerge />}
          </Card>
        </Col>
      </Row>

      {/* 排行 + 告警中心 + 待办审批 */}
      <Row gutter={[12, 12]} style={{
          marginTop: 12
        }}>
        {rankItems.value.length > 0 && <Col xs={24} lg={10}>
            <Card size="small" title="农场种植面积 TOP10">
              <ReactECharts option={rankChartOption.value} style={{
                height: 280
              }} notMerge />
            </Card>
          </Col>}

        <Col xs={24} lg={rankItems.value.length > 0 ? 7 : 12}>
          <Card size="small" title={<Space>
                <BellOutlined />
                平台告警中心
              </Space>} extra={<Button type="link" size="small" onClick={() => navigate('/admin/production/alerts')}>
                查看全部告警 <RightOutlined />
              </Button>}>
            <Space wrap style={{
                marginBottom: 8
              }}>
              <Tag color="red">紧急 {alertLevelCounts.value.urgent ?? '—'}</Tag>
              <Tag color="orange">严重 {alertLevelCounts.value.important ?? '—'}</Tag>
              <Tag color="blue">一般 {alertLevelCounts.value.normal ?? '—'}</Tag>
              <Tag>提示 {alertLevelCounts.value.info ?? '—'}</Tag>
            </Space>
            {alertsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 4
              }} /> : alertItems.value.length === 0 ? <Empty description="暂无告警（后端未返回告警数据）" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <div style={{
                maxHeight: 268,
                overflowY: 'auto'
              }}>
                {alertItems.value.map(item => <div key={item.id} style={{
                  padding: '8px 0',
                  borderBottom: '1px dashed rgba(0,0,0,0.06)'
                }}>
                    <Space size={6}>
                      <ExclamationCircleOutlined style={{
                      color: '#faad14'
                    }} />
                      <Text strong ellipsis={{
                      tooltip: item.title
                    }} style={{
                      maxWidth: 170
                    }}>
                        {item.title}
                      </Text>
                      <Tag color={levelColorMap.value[item.level]}>{item.level}</Tag>
                    </Space>
                    <div>
                      <Text type="secondary" style={{
                      fontSize: 12
                    }}>
                        {item.content} · {item.relativeTime}
                      </Text>
                    </div>
                    <Space size={0} style={{
                    marginTop: 2
                  }}>
                      <Button type="link" size="small" onClick={() => {
                      setActiveAlert(item);
                      setAlertMeasure('联系负责人排查');
                      setAlertRemark('');
                    }}>
                        介入
                      </Button>
                      <Button type="link" size="small" onClick={() => navigate('/admin/production/alerts')}>
                        处理入口
                      </Button>
                      <Button type="link" size="small" onClick={() => navigate('/admin/production/alerts')}>
                        详情
                      </Button>
                    </Space>
                  </div>)}
              </div>}
          </Card>
        </Col>

        <Col xs={24} lg={rankItems.value.length > 0 ? 7 : 12}>
          <Card size="small" title="历史待审档案（只读）" extra={<Button type="link" size="small" onClick={() => navigate('/admin/production/approvals')}>
                业务办理入口 <RightOutlined />
              </Button>}>
            {approvalsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 4
              }} /> : approvalItems.value.length === 0 ? <Empty description="暂无历史待审档案" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <div style={{
                maxHeight: 268,
                overflowY: 'auto'
              }}>
                <Text type="secondary">以下为旧台账待审档案，不代表可执行待办；请在所属业务办理。</Text>
                {approvalItems.value.map(item => <div key={item.id} style={{
                  padding: '8px 0',
                  borderBottom: '1px dashed rgba(0,0,0,0.06)'
                }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text strong>{item.type}</Text>
                        <div>
                          <Text type="secondary" style={{
                          fontSize: 12
                        }}>
                            {item.target} · {item.submitTime}
                          </Text>
                        </div>
                      </Col>
                      <Col>
                        <Space size={6}>
                          <Tooltip title="查看详情">
                            <RightOutlined style={{
                            color: '#1677ff',
                            fontSize: 14,
                            cursor: 'pointer'
                          }} onClick={() => navigate('/admin/production/approvals/history')} />
                          </Tooltip>
                        </Space>
                      </Col>
                    </Row>
                  </div>)}
              </div>}
          </Card>
        </Col>
      </Row>

      <Text type="secondary" style={{
          display: 'block',
          marginTop: 8,
          fontSize: 12
        }}>
        数据说明：KPI 来自生产域大盘和主体概览；在线设备来自物联网运营接口，接口不可用时显示“—”。
        区域面积和排行按地块面积汇总；告警分布统计未处理与处理中的记录，列表展示最新未处理记录。
        趋势按任务计划日期归属，完工且验收通过才计入完成率；历史审批只读，办理回到所属业务。
      </Text>

      {/* 告警处理弹窗（原型 alert-modal） */}
      <Modal open={activeAlert.value !== null} title="告警处理" onCancel={() => setActiveAlert(null)} okText="确认处理" cancelText="取消" confirmLoading={alertMutation.isPending} destroyOnClose onOk={() => {
          if (!activeAlert.value) {
            return;
          }
          alertMutation.mutate({
            id: activeAlert.value.id,
            remark: `${alertMeasure.value}｜${alertRemark.value || '已按标准流程处理'}`
          });
        }}>
        {activeAlert.value && <div>
            <Row gutter={[0, 8]}>
              <Col span={24}>⚠ {activeAlert.value.title}</Col>
              <Col span={24}>告警内容：{activeAlert.value.content}</Col>
              <Col span={24}>告警编号：{activeAlert.value.id}</Col>
              <Col span={24}>关联对象：{activeAlert.value.target}</Col>
            </Row>
            <div style={{
              marginTop: 12
            }}>
              <Text>处理措施：</Text>
              <Radio.Group style={{
                marginTop: 6,
                display: 'block'
              }} value={alertMeasure.value} onChange={event => setAlertMeasure(String((event.target as HTMLInputElement).value))} options={[{
                label: '联系负责人排查',
                value: '联系负责人排查'
              }, {
                label: '远程重启设备',
                value: '远程重启设备'
              }, {
                label: '派遣维修人员',
                value: '派遣维修人员'
              }]} />
            </div>
            <div style={{
              marginTop: 12
            }}>
              <Text>处理说明：</Text>
              <textarea value={alertRemark.value} onInput={event => setAlertRemark((event.target as HTMLInputElement).value)} rows={3} placeholder="请输入补充说明" style={{
                width: '100%',
                marginTop: 6,
                padding: 8,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 6,
                resize: 'vertical',
                color: 'inherit',
                background: 'transparent'
              }} />
            </div>
          </div>}
      </Modal>
    </div>;
    };
  }
});
export default OpsDashboard;
