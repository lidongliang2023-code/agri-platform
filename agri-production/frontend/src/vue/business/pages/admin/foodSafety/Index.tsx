import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionListDense.css';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { AgriAntdvJsxList as Table } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import ListRowActions from '@/vue/business/components/ListRowActions';
/**
 * 页面名称：食品安全事件台账
 * 路由路径：/admin/production/food-safety
 * 所属模块：食品安全
 * 原型 pageId：food-safety（PRD 外，原型补充页面 P15）
 *
 * 原型结构：指标卡 → 风险热力图（16 格农场食品安全评分）→ 食品安全事件告警清单。
 */

import { Alert, App, Badge, Breadcrumb, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Skeleton, Space, Statistic, Tag, Typography } from '@/vue/ui';
import type { ProductionColumn } from '@/vue/ProductionRequestTable';
type ColumnsType<T = any> = ProductionColumn<T>[];
import { ArrowRightOutlined, CheckCircleOutlined, EyeOutlined, HomeOutlined, ReloadOutlined, SafetyCertificateOutlined, SyncOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Navigate, useLocation, useNavigate } from '@/vue/router';
import ReactECharts from '@/vue/VueECharts';
import type { EChartsOption } from 'echarts';
import { FOOD_SAFETY_WRITE_ALERT, getFoodSafetyMetrics, handleFoodSafetyAlert, isMockSource, isWriteBackendConfirmed, listFarmRisk, listFoodSafetyAlerts, notifyWriteResult } from '@/api/admin/foodSafety';
import type { FoodSafetyAlert, SafetyAlertLevel } from '@/api/admin/foodSafety';
const {
  Text,
  Title
} = Typography;

/** 告警级别文案 */
const LEVEL_TEXT: Record<SafetyAlertLevel, string> = {
  urgent: '紧急',
  important: '重要',
  normal: '一般'
};

/** 告警级别 Tag 颜色 */
const LEVEL_COLOR: Record<SafetyAlertLevel, string> = {
  urgent: 'red',
  important: 'orange',
  normal: 'blue'
};

/** 告警级别圆点图标（原型：🔴 紧急 / 🟡 重要 / 🟠 一般） */
const LEVEL_DOT: Record<SafetyAlertLevel, string> = {
  urgent: '🔴',
  important: '🟡',
  normal: '🟠'
};

/** 告警状态 Tag 颜色 */
const ALERT_STATUS_COLOR: Record<string, string> = {
  待处理: 'red',
  处理中: 'gold',
  已处理: 'green'
};

/** 处置措施下拉选项 */
const MEASURE_OPTIONS: string[] = ['申请封存并启动复检', '通知农场负责人整改', '申请批次风险管控', '转属地监管部门处理', '要求补传检测报告'];

/** 风险热力图列分组（4×4） */
const HEATMAP_COLUMNS: string[] = ['一组', '二组', '三组', '四组'];
/** 风险热力图行分组（4×4） */
const HEATMAP_ROWS: string[] = ['第一排', '第二排', '第三排', '第四排'];

/**
 * 食品安全事件台账
 *
 * 业务职责：汇总平台食品安全态势，包括食品安全综合指数、检测合格率、告警数量与
 * 合规校验通过率，通过农场风险热力图定位高风险主体，并对食品安全事件告警进行处置。
 * 数据优先取后端 /admin/food-safety/*，接口未就绪时降级到原型示例口径（原型 4.2）。
 *
 * @returns 页面内容
 */
const Index = defineComponent({
  name: "Index",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const {
      message
    } = App.useApp();
    const queryClient = useQueryClient();

    /** 告警处置弹窗当前处理的告警 */
    const activeAlert = shallowRef<FoodSafetyAlert | null>(null);
    /** 告警详情弹窗当前查看的告警 */
    const setActiveAlert = (next: typeof activeAlert.value | ((previous: typeof activeAlert.value) => typeof activeAlert.value)) => {
      activeAlert.value = typeof next === 'function' ? (next as (previous: typeof activeAlert.value) => typeof activeAlert.value)(activeAlert.value) : next;
    };
    const detailAlert = shallowRef<FoodSafetyAlert | null>(null);
    /** 处置表单 */
    const setDetailAlert = (next: typeof detailAlert.value | ((previous: typeof detailAlert.value) => typeof detailAlert.value)) => {
      detailAlert.value = typeof next === 'function' ? (next as (previous: typeof detailAlert.value) => typeof detailAlert.value)(detailAlert.value) : next;
    };
    const handleForm = Form.useForm<{
      measure: string;
      remark?: string;
    }>();

    /** 核心指标 */
    const metricsQuery = useQuery(() => ({
      queryKey: ['admin', 'food-safety', 'metrics'],
      queryFn: () => getFoodSafetyMetrics(),
      retry: false
    }));

    /** 农场风险评分（热力图） */
    const riskQuery = useQuery(() => ({
      queryKey: ['admin', 'food-safety', 'risk'],
      queryFn: () => listFarmRisk(),
      retry: false
    }));

    /** 食品安全事件告警 */
    const alertsQuery = useQuery(() => ({
      queryKey: ['admin', 'food-safety', 'alerts'],
      queryFn: () => listFoodSafetyAlerts(20),
      retry: false
    }));

    /** 处置告警（只有 result.ok 才提示成功并关闭弹窗） */
    const handleMutation = useMutation(() => ({
      mutationFn: (payload: {
        id: string;
        measure: string;
        remark?: string;
      }) => handleFoodSafetyAlert(payload.id, {
        measure: payload.measure,
        remark: payload.remark
      }),
      onSuccess: result => {
        notifyWriteResult(message, result, '告警处置已提交并写入服务端');
        if (!result.ok) {
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'food-safety', 'alerts']
        });
        setActiveAlert(null);
        handleForm.resetFields();
      },
      onError: (error: Error) => {
        message.error(error.message || '处置失败，请稍后重试');
      }
    }));

    /** 核心指标（带兜底） */
    const metrics = computed(() => metricsQuery.data);
    /** 风险列表 */
    const riskList = computed(() => riskQuery.data ?? []);
    /** 告警列表 */
    const alertList = computed(() => alertsQuery.data ?? []);

    /** 风险热力图配置 */
    const heatmapOption = computed<EChartsOption>(() => {
      const data = riskList.value.slice(0, 16).map((item, index) => ({
        value: [index % 4, Math.floor(index / 4), item.score],
        name: item.farmName
      }));
      return {
        tooltip: {
          formatter: (params: unknown) => {
            const p = params as {
              name?: string;
              value?: number[];
            };
            const score = p.value?.[2] ?? 0;
            return `${p.name ?? ''}<br/>食品安全评分：${score}`;
          }
        },
        grid: {
          left: 70,
          right: 24,
          top: 16,
          bottom: 70
        },
        xAxis: {
          type: 'category',
          data: HEATMAP_COLUMNS,
          splitArea: {
            show: true
          },
          axisLine: {
            show: false
          }
        },
        yAxis: {
          type: 'category',
          data: HEATMAP_ROWS,
          inverse: true,
          splitArea: {
            show: true
          },
          axisLine: {
            show: false
          }
        },
        visualMap: {
          min: 0,
          max: 100,
          orient: 'horizontal',
          left: 'center',
          bottom: 8,
          itemWidth: 14,
          itemHeight: 90,
          pieces: [{
            min: 80,
            max: 100,
            label: '🟢 ≥80 低风险',
            color: '#52c41a'
          }, {
            min: 60,
            max: 80,
            label: '🟡 60-80 中风险',
            color: '#faad14'
          }, {
            min: 0,
            max: 60,
            label: '🔴 <60 高风险',
            color: '#ff4d4f'
          }]
        },
        series: [{
          name: '食品安全评分',
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: '#fff',
            fontWeight: 'bold'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.4)'
            }
          }
        }]
      };
    });

    /** 风险等级分布饼图配置 */
    const riskPieOption = computed<EChartsOption>(() => {
      const high = riskList.value.filter(item => item.score < 60).length;
      const middle = riskList.value.filter(item => item.score >= 60 && item.score < 80).length;
      const low = riskList.value.filter(item => item.score >= 80).length;
      return {
        tooltip: {
          trigger: 'item',
          formatter: '{b}：{c} 个农场（{d}%）'
        },
        legend: {
          bottom: 0,
          itemWidth: 12,
          itemHeight: 12
        },
        series: [{
          name: '风险等级分布',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: {
            formatter: '{b}\n{c} 个'
          },
          data: [{
            name: '低风险(≥80)',
            value: low,
            itemStyle: {
              color: '#52c41a'
            }
          }, {
            name: '中风险(60-80)',
            value: middle,
            itemStyle: {
              color: '#faad14'
            }
          }, {
            name: '高风险(<60)',
            value: high,
            itemStyle: {
              color: '#ff4d4f'
            }
          }]
        }]
      };
    });

    /** 告警表格列 */
    const alertColumns = computed<ColumnsType<FoodSafetyAlert>>(() => [{
      title: '级别',
      dataIndex: 'level',
      width: 110,
      render: (level: SafetyAlertLevel) => <Tag color={LEVEL_COLOR[level]}>
          {LEVEL_DOT[level]} {LEVEL_TEXT[level]}
        </Tag>
    }, {
      title: '告警类型',
      dataIndex: 'type',
      width: 140,
      render: (type: string) => <Text strong>{type}</Text>
    }, {
      title: '告警对象',
      dataIndex: 'target',
      width: 160
    }, {
      title: '关联编号',
      dataIndex: 'code',
      width: 110
    }, {
      title: '发生时间',
      dataIndex: 'time',
      width: 130
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag color={ALERT_STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: FoodSafetyAlert) => <ListRowActions items={[<Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailAlert(record)}>
              查看
            </Button>, <Button key="handle" type="link" size="small" icon={<ToolOutlined />} disabled={record.status === '已处理'} onClick={() => {
        setActiveAlert(record);
        handleForm.setFieldsValue({
          measure: MEASURE_OPTIONS[0],
          remark: ''
        });
      }}>
              处理
            </Button>]} />
    }]);
    return () => {
      return <div>
      {/* 面包屑 + 标题 + 实时监控标识（原型 P15 顶部栏） */}
      <Row justify="space-between" align="middle" style={{
          marginBottom: 12
        }}>
        <Col>
          <Breadcrumb style={{
              marginBottom: 4
            }} items={[{
              href: '/admin/production/dashboard',
              title: <HomeOutlined />
            }, {
              title: '食品安全'
            }, {
              title: '监控中心'
            }]} />
          <Space align="center" size={8}>
            <Title level={4} style={{
                margin: 0
              }}>
              食品安全事件台账
            </Title>
            <Tag icon={<SyncOutlined spin />} color="success">
              实时监控中
            </Tag>
          </Space>
          <Text type="secondary">食品安全综合指数、风险热力图与事件告警</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['admin', 'food-safety']
                });
              }}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}
      {isMockSource('metrics', 'risk', 'alerts') && <Alert type="warning" showIcon banner style={{
          marginBottom: 12
        }} message="当前展示示例数据，后端接口建设中" description="食品安全属于合规强相关数据：本页指标、风险评分与告警均取自原型示例口径（原型 4.2），不代表真实生产数据，请勿用于对外报送或监管举证。后端 /admin/food-safety/* 接口上线后本页将自动切换真实数据。" />}

      {/* 写操作未接入后端明示（禁止「未写入服务端却提示成功」） */}
      {!isWriteBackendConfirmed() && <Alert type="warning" showIcon banner style={{
          marginBottom: 12
        }} message={FOOD_SAFETY_WRITE_ALERT.message} description={`${FOOD_SAFETY_WRITE_ALERT.description}本页涉及：告警处置。`} />}

      {/* 专项治理快捷入口（监控中心下钻到各专项页面） */}
      <Card size="small" style={{
          marginBottom: 12
        }}>
        <Space wrap>
          <Text type="secondary">专项治理：</Text>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/circulation')}>
            流通异常检测
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/compliance')}>
            合规校验管理
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/trust-label')}>
            可信农产品管理
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/quality/recalls')}>
            冷链资源撮合
          </Button>
        </Space>
      </Card>

      {/* 数据异常提示 */}
      {(metricsQuery.isError || riskQuery.isError || alertsQuery.isError) && <Alert type="warning" showIcon style={{
          marginBottom: 12
        }} message="部分指标获取失败，已切换为示例数据展示" action={<Button size="small" onClick={() => {
          void queryClient.invalidateQueries({
            queryKey: ['admin', 'food-safety']
          });
        }}>
              重试
            </Button>} />}

      {/* 指标卡（原型 P15 Metrics Cards） */}
      <Row gutter={[12, 12]} style={{
          marginBottom: 12
        }}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 1
              }} title={false} /> : <Statistic title={<Space size={4}>
                    <SafetyCertificateOutlined />
                    食品安全综合指数
                  </Space>} value={metrics.value?.safetyIndex ?? 0} precision={1} suffix="/ 100" valueStyle={{
                color: '#1677ff'
              }} />}
            <Text type="success">↑ {metrics.value?.safetyIndexDelta ?? 0} 较上月</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 1
              }} title={false} /> : <Statistic title={<Space size={4}>
                    <CheckCircleOutlined />
                    检测合格率
                  </Space>} value={metrics.value?.passRate ?? 0} precision={1} suffix="%" valueStyle={{
                color: '#52c41a'
              }} />}
            <Text type="success">↑ {metrics.value?.passRateDelta ?? 0}%</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 1
              }} title={false} /> : <Statistic title={<Space size={4}>
                    <WarningOutlined />
                    食品安全告警
                  </Space>} value={metrics.value?.alertCount ?? 0} valueStyle={{
                color: '#faad14'
              }} />}
            <Space size={6}>
              <Badge status="error" />
              <Text type="danger">{metrics.value?.urgentAlertCount ?? 0} 紧急</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? <Skeleton active paragraph={{
                rows: 1
              }} title={false} /> : <Statistic title="合规校验通过率" value={metrics.value?.compliancePassRate ?? 0} precision={1} suffix="%" valueStyle={{
                color: '#1677ff'
              }} />}
            <Text type="secondary">冷链达标率 {metrics.value?.coldChainPassRate ?? 0}%</Text>
          </Card>
        </Col>
      </Row>

      {/* 风险热力图 + 风险等级分布 */}
      <Row gutter={[12, 12]} style={{
          marginBottom: 12
        }}>
        <Col xs={24} xl={16}>
          <Card title="风险热力图 - 各农场食品安全风险" extra={<Text type="secondary" style={{
              fontSize: 12
            }}>
                数值 = 食品安全评分（满分 100）
              </Text>}>
            {riskQuery.isLoading ? <Skeleton active paragraph={{
                rows: 6
              }} title={false} /> : riskList.value.length === 0 ? <Empty description="暂无农场风险评分数据" /> : <ReactECharts option={heatmapOption.value} style={{
                height: 360
              }} notMerge />}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="风险等级分布">
            {riskQuery.isLoading ? <Skeleton active paragraph={{
                rows: 6
              }} title={false} /> : riskList.value.length === 0 ? <Empty description="暂无风险分布数据" /> : <ReactECharts option={riskPieOption.value} style={{
                height: 360
              }} notMerge />}
          </Card>
        </Col>
      </Row>

      {/* 食品安全事件告警（原型 P15 Alert List） */}
      <Card title="食品安全事件告警" class="production-list-dense production-member-list" extra={<Button type="link" onClick={() => navigate('/admin/production/alerts')} style={{
          paddingInline: 0
        }}>
            查看全部告警 <ArrowRightOutlined />
          </Button>}>
        <Table rowKey="id" size="middle" loading={alertsQuery.isLoading} columns={alertColumns.value} dataSource={alertList.value} rowSelection={{}} columnSettingsStorageKey="agri:production:visible-columns:v1:admin-food-safety-alerts" columnWidthStorageKey="agri:production:column-widths:v1:admin-food-safety-alerts" onRefresh={() => void alertsQuery.refetch()} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} locale={{
            emptyText: <Empty description="暂无食品安全告警" />
          }} />
      </Card>

      {/* 告警详情弹窗 */}
      <Modal class="quality-dialog quality-detail" width={800} open={detailAlert.value !== null} title="告警详情" onCancel={() => setDetailAlert(null)} footer={[<Button key="close" onClick={() => setDetailAlert(null)}>
            关闭
          </Button>]}>
        {detailAlert.value && <DetailInfoGrid items={[{
            key: 'id',
            fullWidth: true,
            label: '告警编号',
            value: detailAlert.value.id
          }, {
            key: 'type',
            label: '告警类型',
            value: detailAlert.value.type
          }, {
            key: 'level',
            label: '告警级别',
            value: <Tag color={LEVEL_COLOR[detailAlert.value.level]}>
                  {LEVEL_DOT[detailAlert.value.level]} {LEVEL_TEXT[detailAlert.value.level]}
                </Tag>
          }, {
            key: 'target',
            label: '告警对象',
            value: detailAlert.value.target
          }, {
            key: 'code',
            label: '关联编号',
            value: detailAlert.value.code
          }, {
            key: 'time',
            label: '发生时间',
            value: detailAlert.value.time
          }, {
            key: 'status',
            label: '处理状态',
            value: <Tag color={ALERT_STATUS_COLOR[detailAlert.value.status] ?? 'default'}>{detailAlert.value.status}</Tag>
          }, {
            key: 'measure',
            fullWidth: true,
            label: '处置措施',
            value: detailAlert.value.measure ?? '—'
          }]} />}
      </Modal>

      {/* 告警处置弹窗 */}
      <Modal open={activeAlert.value !== null} title="处置食品安全告警" okText="登记处理进展" cancelText="取消" confirmLoading={handleMutation.isPending} onCancel={() => setActiveAlert(null)} onOk={() => {
          void handleForm.validateFields().then(values => {
            if (!activeAlert.value) {
              return;
            }
            handleMutation.mutate({
              id: activeAlert.value.id,
              measure: values.measure,
              remark: values.remark
            });
          });
        }}>
        {activeAlert.value && <div>
            <Alert type="warning" showIcon style={{
              marginBottom: 12
            }} message={`${activeAlert.value.type} · ${activeAlert.value.target} ${activeAlert.value.code}`} description={`发生时间：${activeAlert.value.time}`} />
            <Form form={handleForm} layout="vertical">
              <Form.Item name="measure" label="处置措施" rules={[{
                required: true,
                message: '请选择处置措施'
              }]}>
                <Select placeholder="请选择处置措施" options={MEASURE_OPTIONS.map(item => ({
                  value: item,
                  label: item
                }))} />
              </Form.Item>
              <Form.Item name="remark" label="处置说明" rules={[{
                required: true,
                message: '请填写处置说明'
              }]}>
                <Input.TextArea rows={3} placeholder="请填写处置说明，例如联系人、整改期限等" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>}
      </Modal>
    </div>;
    };
  }
});
const SafetyEvidencePage = defineComponent({
  name: "SafetyEvidencePage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    return () => {
      return <><div role="note" style={{
          padding: 16,
          background: "#fffbe6",
          marginBottom: 16
        }}>此处仅登记处理进展，不自动执行下架、销毁、物流或退款，也不作为整改结案凭据。批次冻结与码作废请进入不合格品处置。</div><Index /></>;
    };
  }
});
/** 旧食品安全入口归并到质量总览，原安全事件业务作为内嵌面板使用。 */
const SafetyEntry = defineComponent({
  name: "SafetyEntry",
  props: {
    embedded: null as unknown as PropType<{
      embedded?: boolean;
    }["embedded"]>
  },
  setup(__props: {
    embedded?: boolean;
  }, {
    slots: __slots
  }) {
    const _state = useLocation();
    return () => {
      if (__props.embedded ?? false) return <SafetyEvidencePage />;
      const params = new URLSearchParams(_state.value.search);
      params.set('tab', 'safety');
      return <Navigate to={`/admin/production/trace?${params.toString()}${_state.value.hash}`} replace />;
    };
  }
});
export default SafetyEntry;
