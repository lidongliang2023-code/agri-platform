import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/harvests/harvests.css';
/**
 * 页面名称：新建采收
 * 路由路径：/production/harvests/create
 * 所属模块：采收与库存管理
 * 原型 pageId：P14 harvest-create
 *
 * 还原要点：
 * - 「基本信息」：农场名称（下拉）+ 地块选择（下拉，联动加载）+ 当前种植记录信息条
 * - 「采收信息」：采收日期 / 采收数量(kg) / 采收面积(亩) / 采收人 / 产量对比（预计 vs 实际 vs 完成率）
 * - 「质量信息」：质量等级（A/B/C/D）+ 外观评价（优/良/中/差 单选）
 * - 安全间隔期（休药期）校验提示
 * - 底部：取消 / 保存并继续采收 / 保存（→harvest-detail）
 */

import { useNavigate, useSearchParams } from '@/vue/router';
import { useMutation, useQuery } from '@/vue/query';
import { PageContainer } from '@/vue/pro';
import { Alert, Button, Col, DatePicker, Divider, Form, Input, InputNumber, Radio, Row, Select, Skeleton, Space, Statistic, Tag, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { http } from '@/utils/request';
import { submitHarvest } from '@/api/harvests';
import { getPlot, listPlots } from '@/api/plots';
import { listPlans } from '@/api/plans';
import { listMembers } from '@/api/members';
import type { Member, PageResult, Plan, Plot } from '@/types';
import type { AppearanceGrade, HarvestBatch, HarvestGrade } from '@/types';
import { APPEARANCE_OPTIONS, GRADE_COLOR_MAP, GRADE_LABEL_MAP, GRADE_OPTIONS, HARVEST_UNIT_OPTIONS } from '@/types';

/** 地块状态文案：0 停用 1 空闲 2 在种 3 采收期 4 休耕 */
const PLOT_STATUS_LABEL: Record<number, string> = {
  0: '停用',
  1: '空闲',
  2: '在种',
  3: '采收期',
  4: '休耕'
};

/** 安全间隔期（休药期）天数，R-INPUT-03 */
const SAFE_INTERVAL_DAYS = 7;

/** 采收登记表单值 */
interface HarvestFormValues {
  /** 农场 ID */
  farmId?: string;
  /** 地块 ID */
  plotId?: string;
  /** 采收日期 */
  harvestDate?: Dayjs;
  /** 采收数量 */
  quantity?: number;
  /** 计量单位 */
  unit?: string;
  /** 采收面积（亩） */
  harvestArea?: number;
  /** 采收人 */
  operatorId?: string;
  /** 质量等级 */
  grade?: HarvestGrade;
  /** 外观评价 */
  appearance?: AppearanceGrade;
  /** 备注 */
  remark?: string;
}

/** 近期施药记录（用于休药期校验，取自投入品使用记录） */
interface RecentUsage {
  /** 投入品名称 */
  inputName?: string;
  /** 使用时间 */
  usedAt: string;
}

/**
 * 新建采收页面
 *
 * 业务职责：登记一次采收，自动带出地块种植记录、做产量对比与安全间隔期校验，
 * 提交后生成采收批次（HARV-03）。
 *
 * @returns 页面内容
 */
const Create = defineComponent({
  name: "Create",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmOptions = useFarmStore(state => state.farmOptions);
    const [form] = Form.useForm<HarvestFormValues>();
    const [searchParams] = useSearchParams();
    /** 从地块详情进入时预选地块 */
    const presetPlotId = computed(() => searchParams.value.get('plotId') ?? undefined);
    const farmId = shallowRef<string | undefined>(currentFarm.value?.farmId);
    const setFarmId = (next: typeof farmId.value | ((previous: typeof farmId.value) => typeof farmId.value)) => {
      farmId.value = typeof next === 'function' ? (next as (previous: typeof farmId.value) => typeof farmId.value)(farmId.value) : next;
    };
    const plotId = shallowRef<string | undefined>(presetPlotId.value);
    const setPlotId = (next: typeof plotId.value | ((previous: typeof plotId.value) => typeof plotId.value)) => {
      plotId.value = typeof next === 'function' ? (next as (previous: typeof plotId.value) => typeof plotId.value)(plotId.value) : next;
    };
    const quantity = shallowRef<number>(0);
    const setQuantity = (next: typeof quantity.value | ((previous: typeof quantity.value) => typeof quantity.value)) => {
      quantity.value = typeof next === 'function' ? (next as (previous: typeof quantity.value) => typeof quantity.value)(quantity.value) : next;
    };
    const unit = shallowRef<string>('kg');

    /** 地块下拉（按所选农场） */
    const setUnit = (next: typeof unit.value | ((previous: typeof unit.value) => typeof unit.value)) => {
      unit.value = typeof next === 'function' ? (next as (previous: typeof unit.value) => typeof unit.value)(unit.value) : next;
    };
    const plotQuery = useQuery(() => ({
      queryKey: ['plot-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listPlots({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));

    /** 农事计划（取预计产量 / 作物 / 种植周期） */
    const planQuery = useQuery(() => ({
      queryKey: ['plan-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listPlans({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));

    /** 地块详情（联动信息条） */
    const plotDetailQuery = useQuery(() => ({
      queryKey: ['plot-detail', plotId.value],
      enabled: Boolean(plotId.value),
      queryFn: () => getPlot(plotId.value as string)
    }));

    /** 采收人下拉 */
    const memberQuery = useQuery(() => ({
      queryKey: ['member-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listMembers({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));

    /**
     * 近期施药记录查询。
     * 直接以 silent 方式调用投入品使用记录接口，避免后端未就绪时弹出全局错误提示。
     */
    const usageQuery = useQuery(() => ({
      queryKey: ['input-usages-recent', plotId.value],
      enabled: Boolean(plotId.value),
      queryFn: async () => {
        const result = await http.get<PageResult<RecentUsage>>('/inputs/usages', {
          plotId: plotId.value,
          pageNum: 1,
          pageSize: 20
        }, {
          silent: true
        });
        return result?.list ?? [];
      }
    }));

    /** 地块下拉选项 */
    const plotOptions = computed(() => (plotQuery.data?.list ?? []).map((plot: Plot) => ({
      value: plot.plotId,
      label: plot.plotName
    })));

    /** 采收人下拉选项 */
    const memberOptions = computed(() =>
    // 2026-10-16 修正：operator_id 是 BIGINT 列，必须提交**数字主键** `Member.id`。
    // 原实现提交的是 `Member.memberId`（DEMO-MEM-001 这类业务标识），后端
    // toLong("DEMO-MEM-001") 解析失败后**返回 null**（静默丢弃，不报错），
    // 于是"采收人"选了却落不进库 —— 详情/列表里那一列永远空。规则见 agri-shared 的 Member 注释。
    (memberQuery.data?.list ?? []).filter((member: Member) => Boolean(member.id)).map((member: Member) => ({
      value: member.id as string,
      label: member.realName
    })));

    /** 当前地块对应的农事计划 */
    const currentPlan = computed<Plan | undefined>(() => (planQuery.data?.list ?? []).find((plan: Plan) => plan.plotId === plotId.value));

    /** 当前地块 */
    const currentPlot = computed<Plot | undefined>(() => (plotQuery.data?.list ?? []).find((plot: Plot) => plot.plotId === plotId.value));

    /** 预计产量（优先取农事计划的计划产量） */
    const expectedQuantity = computed(() => currentPlan.value?.expectedYield ?? 0);

    /** 完成率（%） */
    const finishRate = computed(() => expectedQuantity.value > 0 ? Math.round(quantity.value / expectedQuantity.value * 100) : 0);

    /** 亩产量（kg/亩） */
    const harvestArea = Form.useWatch('harvestArea', form);
    const perMuYield = computed(() => harvestArea.value && harvestArea.value > 0 ? Math.round(quantity.value / harvestArea.value * 100) / 100 : 0);

    /** 休药期校验结果 */
    const safetyInfo = computed(() => {
      const usages = usageQuery.data ?? [];
      if (usages.length === 0) {
        return {
          type: 'info' as const,
          text: '未查询到该地块近期施药记录，默认允许采收（建议人工复核投入品台账）'
        };
      }
      const latest = usages.map(item => item.usedAt).sort().reverse()[0];
      const days = dayjs().diff(dayjs(latest), 'day');
      if (days < SAFE_INTERVAL_DAYS) {
        return {
          type: 'error' as const,
          text: `⚠️ 该地块距上次施药仅 ${days} 天，未过安全间隔期（${SAFE_INTERVAL_DAYS} 天），不建议采收`
        };
      }
      return {
        type: 'success' as const,
        text: `✅ 该地块已过休药期（距上次施药 ${days} 天），可正常采收`
      };
    });

    /**
     * 提交采收登记。
     *
     * submitHarvest 只在服务端真正落库后返回；失败会抛错（文案含「未写入服务端」）。
     * 若批次已落库但溯源码生成未完成，返回 warning，此处必须显式告警，
     * 不能当成「操作成功」静默跳过。
     */
    const submitMutation = useMutation(() => ({
      mutationFn: (payload: Partial<HarvestBatch>) => submitHarvest(payload),
      onSuccess: result => {
        if (result.warning) {
          message.warning(result.warning, 6);
          return;
        }
        message.success(`采收登记已提交，批次 ${result.batch.batchNo} 已生成`);
      },
      onError: error => {
        message.error(error.message || '提交失败，请稍后重试');
      }
    }));

    /** 切换农场：清空地块 */
    const handleFarmChange = (value: string): void => {
      setFarmId(value);
      setPlotId(undefined);
      form.setFieldsValue({
        plotId: undefined
      });
    };

    /** 切换地块：加载联动信息 */
    const handlePlotChange = (value: string): void => {
      setPlotId(value);
    };

    /** 组装提交参数 */
    const buildPayload = (): Partial<HarvestBatch> => {
      const values = form.getFieldsValue();
      const operator = (memberQuery.data?.list ?? []).find(
      // 与上面的下拉取值同源：按数字主键匹配（原来按 memberId 匹配，永远匹配不上）
      (member: Member) => member.id === values.operatorId);
      return {
        farmId: farmId.value,
        farmName: farmOptions.value.find(item => item.farmId === farmId.value)?.farmName ?? currentFarm.value?.farmName,
        plotId: values.plotId,
        plotName: currentPlot.value?.plotName,
        planId: currentPlan.value?.planId,
        cropId: currentPlot.value?.cropId ?? currentPlan.value?.cropId ?? '',
        cropName: currentPlan.value?.cropName ?? currentPlot.value?.cropVariety ?? '',
        cropVariety: currentPlan.value?.cropVariety ?? currentPlot.value?.cropVariety,
        harvestDate: values.harvestDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        quantity: values.quantity ?? 0,
        unit: values.unit ?? 'kg',
        grade: values.grade ?? '待检',
        status: 1,
        traceGenerated: false,
        inboundStatus: 0,
        harvestArea: values.harvestArea,
        appearance: values.appearance,
        expectedQuantity: expectedQuantity.value,
        perMuYield: perMuYield.value,
        operatorId: values.operatorId,
        operatorName: operator?.realName,
        remark: values.remark
      };
    };

    /** 校验并保存 */
    const handleSave = (keepGoing: boolean): void => {
      form.validateFields().then(() => {
        const payload = buildPayload();
        submitMutation.mutate(payload, {
          onSuccess: result => {
            if (keepGoing) {
              form.setFieldsValue({
                quantity: undefined,
                remark: undefined
              });
              setQuantity(0);
            } else {
              navigate(`/production/harvests/${result.batch.batchId}`);
            }
          }
        });
      }).catch(() => {
        const invalid = form.getFieldsError().find(field => field.errors.length);
        if (invalid) form.scrollToField(invalid.name, {
          block: 'center',
          behavior: 'smooth'
        });
        message.warning('请完整填写必填项后再提交');
      });
    };
    return () => {
      return <PageContainer mobileForm class="harvest-business-page" title={<Space size={8}>
          <Typography.Link onClick={() => navigate('/production/harvests')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>新建采收记录</span>
        </Space>} subTitle={currentFarm.value?.farmName} extra={[<Button key="cancel" onClick={() => navigate('/production/harvests')}>
          取消
        </Button>, <Button key="continue" loading={submitMutation.isPending} onClick={() => handleSave(true)}>
          保存并继续采收
        </Button>, <Button key="save" type="primary" loading={submitMutation.isPending} onClick={() => handleSave(false)}>
          保存
        </Button>]}>
      <Form scrollToFirstError form={form} layout="vertical" initialValues={{
          farmId: currentFarm.value?.farmId,
          plotId: presetPlotId.value,
          harvestDate: dayjs(),
          unit: 'kg',
          grade: 'A',
          appearance: '良'
        }} style={{
          maxWidth: 960
        }}>
        <Card title="基本信息" style={{
            marginBottom: 16
          }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item name="farmId" label="农场名称" rules={[{
                  required: true,
                  message: '请选择农场'
                }]}>
                <Select placeholder="请选择农场" options={farmOptions.value.map(item => ({
                    value: item.farmId,
                    label: item.farmName
                  }))} onChange={handleFarmChange} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plotId" label="地块选择" rules={[{
                  required: true,
                  message: '请选择地块'
                }]}>
                <Select placeholder={farmId.value ? '请选择地块' : '请先选择农场'} options={plotOptions.value} onChange={handlePlotChange} showSearch optionFilterProp="label" loading={plotQuery.isFetching} />
              </Form.Item>
            </Col>
          </Row>

          {plotId.value ? <Alert style={{
              marginBottom: 8
            }} type="info" message="📋 当前种植记录（选择地块后自动加载）" description={plotDetailQuery.isLoading ? <Skeleton active paragraph={{
              rows: 1
            }} title={false} /> : <Space size={12} wrap>
                    <span>
                      作物品种:{' '}
                      <b>
                        {currentPlan.value?.cropName ?? '—'}
                        {currentPlan.value?.cropVariety ? `(${currentPlan.value.cropVariety})` : ''}
                      </b>
                    </span>
                    <span>
                      种植日期: <b>{currentPlan.value?.startDate ?? '—'}</b>
                    </span>
                    <span>
                      生长阶段:{' '}
                      <Tag color="green">
                        {PLOT_STATUS_LABEL[currentPlot.value?.status ?? plotDetailQuery.data?.status ?? 0] ?? '—'}
                      </Tag>
                    </span>
                    <span>
                      种植面积: <b>{currentPlot.value?.area ?? plotDetailQuery.data?.area ?? '—'}亩</b>
                    </span>
                    <span>
                      预计产量: <b>{expectedQuantity.value.toLocaleString()}kg</b>
                    </span>
                  </Space>} /> : <Alert style={{
              marginBottom: 8
            }} type="warning" showIcon message="请先选择地块，系统将自动带出该地块的种植记录" />}
        </Card>

        <Card title="采收信息" style={{
            marginBottom: 16
          }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item name="harvestDate" label="采收日期" rules={[{
                  required: true,
                  message: '请选择采收日期'
                }]}>
                <DatePicker style={{
                    width: '100%'
                  }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="quantity" label="采收数量(kg)" rules={[{
                  required: true,
                  message: '请输入采收数量'
                }, {
                  type: 'number',
                  min: 0.01,
                  message: '采收数量必须大于 0'
                }]}>
                <InputNumber style={{
                    width: '100%'
                  }} min={0} precision={2} placeholder="请输入采收数量" onChange={value => setQuantity(Number(value ?? 0))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="unit" label="计量单位">
                <Select options={HARVEST_UNIT_OPTIONS} onChange={value => setUnit(String(value))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item name="harvestArea" label="采收面积(亩)">
                <InputNumber style={{
                    width: '100%'
                  }} min={0} precision={2} placeholder="选填" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="operatorId" label="采收人" rules={[{
                  required: true,
                  message: '请选择采收人'
                }]}>
                <Select placeholder="请选择采收人" options={memberOptions.value} showSearch optionFilterProp="label" loading={memberQuery.isFetching} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="亩产量">
                <Input value={perMuYield.value > 0 ? `${perMuYield.value} ${unit.value}/亩` : '填写面积后自动计算'} readOnly />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            产量对比
          </Divider>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic title="预计产量" value={expectedQuantity.value} suffix="kg" />
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="实际采收" value={quantity.value} precision={2} suffix={unit.value} valueStyle={{
                  color: '#1677ff'
                }} />
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="完成率" value={finishRate.value} suffix="%" valueStyle={{
                  color: finishRate.value >= 100 ? '#52c41a' : '#faad14'
                }} />
            </Col>
          </Row>
        </Card>

        <Card title="质量信息" style={{
            marginBottom: 16
          }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item name="grade" label="质量等级" rules={[{
                  required: true,
                  message: '请选择质量等级'
                }]}>
                <Select placeholder="请选择质量等级" options={GRADE_OPTIONS} onChange={value => {
                    void value;
                  }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="appearance" label="外观评价">
                <Radio.Group options={APPEARANCE_OPTIONS.map(item => ({
                    value: item.value,
                    label: item.label
                  }))} optionType="button" buttonStyle="solid" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写采收过程中的异常说明、天气情况等" />
          </Form.Item>
          <Alert type={safetyInfo.value.type} showIcon message={safetyInfo.value.text} />
          <Space style={{
              marginTop: 12
            }}>
            <Typography.Text type="secondary">当前等级：</Typography.Text>
            <Tag color={GRADE_COLOR_MAP.A}>{GRADE_LABEL_MAP.A}</Tag>
            <Typography.Text type="secondary">
              未送检批次默认「待检」，不可上架交易（R-HARV-03）
            </Typography.Text>
          </Space>
        </Card>
      </Form>
    </PageContainer>;
    };
  }
});
export default Create;
