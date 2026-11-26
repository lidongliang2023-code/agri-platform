import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useFormModel } from '../components/vue-form';
import { CollectionAlertsPanel } from './CollectionAlertsPanel';
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Switch, Table, Tabs, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { AlertRule, CollectTask, Forecast, PriceIndex, Quote, QuoteSource, QuotesAdmin } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, Sparkline, StatTile, StatusTag, formatCount } from '../components/ui';

/**
 * 行情运营：报价维护、数据源与采集任务、价格指数、AI 预测、数据质量与预警规则。
 * 报价录入后立即影响用户端行情中心与预测输入，因此写操作全部记审计。
 */
export const QuotesPage = defineComponent({
  name: "QuotesPage",
  props: {},
  setup() {
    const data = ref<QuotesAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const quoteDraft = ref('');
    const quoteKeyword = ref('');
    const quoteStatus = ref('');
    const quoteMonitor = ref('');
    const taskDraft = ref('');
    const taskKeyword = ref('');
    const taskStatus = ref('');
    const quoteOpen = ref(false);
    const editing = ref<Quote | null>(null);
    const ruleOpen = ref(false);
    const forecast = ref<Forecast | null>(null);
    const form = useFormModel();
    const ruleForm = useFormModel();
    const collectionForm = useFormModel();
    const configTask = ref<CollectTask | null>(null);
    const running = ref<number[]>([]);
    const runTask = ref<CollectTask | null>(null);
    const runs = ref<Awaited<ReturnType<typeof opsApi.collectionRuns>>>([]);
    const savingConfig = ref(false);
    const scheduleTask = ref<CollectTask | null>(null);
    const scheduleForm = useFormModel();
    const savingSchedule = ref(false);

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.quotes()
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    let pollTimer: number | undefined;
    onMounted(() => {
      load();
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          opsApi.quotes().then(res => { data.value = res; }).catch(() => undefined);
        }
      }, 15000);
    });
    onBeforeUnmount(() => {
      if (pollTimer) window.clearInterval(pollTimer);
    });

    const filteredQuotes = computed(() => {
      const list = data.value?.quotes ?? [];
      const q = quoteKeyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (quoteStatus.value && item.status !== quoteStatus.value) return false;
        if (quoteMonitor.value && item.monitorLevel !== quoteMonitor.value) return false;
        if (!q) return true;
        return `${item.name} ${item.code} ${item.origin} ${item.market}`.toLowerCase().includes(q);
      });
    });

    const filteredTasks = computed(() => {
      const list = data.value?.tasks ?? [];
      const q = taskKeyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (taskStatus.value && item.status !== taskStatus.value) return false;
        if (!q) return true;
        return `${item.name} ${item.sourceName} ${item.remark ?? ''}`.toLowerCase().includes(q);
      });
    });

    const openQuote = (quote?: Quote): void => {
      editing.value = quote ?? null;
      form.setFieldsValue(quote ? {
        name: quote.name,
        price: quote.price,
        changePct: quote.changePct,
        changeAmount: quote.changeAmount,
        spec: quote.spec,
        monitorLevel: quote.monitorLevel,
        status: quote.status
      } : {
        name: '',
        price: undefined,
        changePct: 0,
        changeAmount: 0,
        spec: '',
        icon: '🌾',
        category: '蔬菜',
        origin: '',
        market: '',
        priceUnit: '元/公斤',
        monitorLevel: 'normal',
        status: 'online'
      });
      quoteOpen.value = true;
    };

    const quoteColumns = computed<JsxListColumn[]>(() => [{
      title: '品种',
      dataIndex: 'name',
      width: 240,
      render: (_, record: Quote) => (
        <div class="table-title-cell">
          <b>{record.icon} {record.name}</b>
          <span class="small muted">{record.code} · {record.origin}</span>
        </div>
      )
    }, {
      title: '市场',
      dataIndex: 'market',
      width: 190
    }, {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      render: (value, record: Quote) => <b>{Number(value).toFixed(2)} <small class="muted">{record.priceUnit}</small></b>
    }, {
      title: '涨跌幅',
      dataIndex: 'changePct',
      width: 90,
      render: value => <ChangePct value={value} />
    }, {
      title: '走势',
      dataIndex: 'trend',
      width: 100,
      render: value => <Sparkline points={value} />
    }, {
      title: '监测',
      dataIndex: 'monitorLevel',
      width: 90,
      render: value => <StatusTag status={value} />
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: value => <StatusTag status={value} />
    }, {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 150
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: Quote) => (
        <InfoRowActions actions={[{ key: 'edit', label: '维护', onClick: () => openQuote(record) }]} />
      )
    }]);

    const sourceColumns = computed<JsxListColumn[]>(() => [{
      title: '数据源',
      dataIndex: 'name',
      width: 220
    }, {
      title: '类型',
      dataIndex: 'sourceType',
      width: 110
    }, {
      title: '频率',
      dataIndex: 'frequency',
      width: 100
    }, {
      title: '采集点',
      dataIndex: 'pointCount',
      width: 100,
      render: value => formatCount(value)
    }, {
      title: '错误率',
      dataIndex: 'errorRate',
      width: 100,
      render: value => `${Number(value).toFixed(2)}%`
    }, {
      title: '最近同步',
      dataIndex: 'lastSync',
      width: 160
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }]);

    const taskColumns = computed<JsxListColumn[]>(() => [{
      title: '任务',
      dataIndex: 'name',
      width: 200
    }, {
      title: '数据源',
      dataIndex: 'sourceName',
      width: 170
    }, {
      title: '自动调度（北京时间）',
      key: 'schedule',
      width: 230,
      render: (_, record: CollectTask) => (
        <div>
          <Tag color={record.scheduleEnabled ? 'green' : 'default'}>{record.scheduleEnabled ? '已启用' : '已暂停'}</Tag>
          <div>{record.cron || '尚未配置'}</div>
          <small class="muted">
            下次：{record.scheduleEnabled ? record.nextRunAt || '等待配置' : '—'}{record.retryCount ? ` · 重试 ${record.retryCount}` : ''}
          </small>
          {record.scheduleResult && <div class="muted">{record.scheduleResult}</div>}
        </div>
      )
    }, {
      title: '最近执行',
      dataIndex: 'lastRun',
      width: 150
    }, {
      title: '入库行数',
      dataIndex: 'lastRows',
      width: 90
    }, {
      title: '执行说明',
      dataIndex: 'remark',
      width: 220
    }, {
      title: '耗时',
      dataIndex: 'durationMs',
      width: 90,
      render: value => `${value} ms`
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => (
        <Tag class="soft-tag">
          {({ pending_config: '待接入', running: '执行中', partial: '部分成功', failed: '失败', success: '成功' } as Record<string, string>)[value] ?? value}
        </Tag>
      )
    }, {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_, record: CollectTask) => (
        <InfoRowActions
          actions={[
            {
              key: 'run',
              label: running.value.includes(record.id) ? '执行中…' : '立即执行',
              disabled: record.status === 'running' || running.value.includes(record.id),
              onClick: () => {
                running.value = [...running.value, record.id];
                opsApi.runTask(record.id)
                  .then(result => {
                    if (result.status === 'success') message.success(result.message);
                    else message.warning(result.message);
                  })
                  .catch((reason: Error) => message.error(reason.message))
                  .finally(() => {
                    running.value = running.value.filter(id => id !== record.id);
                    load();
                  });
              },
            },
            {
              key: 'schedule',
              label: '自动调度',
              onClick: () => {
                opsApi.collectionSchedule(record.id).then(value => {
                  scheduleForm.resetFields();
                  scheduleForm.setFieldsValue(value);
                  scheduleTask.value = record;
                }).catch((reason: Error) => message.error(reason.message));
              },
            },
            {
              key: 'config',
              label: '接入配置',
              onClick: () => {
                opsApi.collectionConfig(record.id).then(value => {
                  collectionForm.resetFields();
                  collectionForm.setFieldsValue(value);
                  configTask.value = record;
                }).catch((reason: Error) => message.error(reason.message));
              },
            },
            {
              key: 'runs',
              label: '执行记录',
              onClick: () => {
                opsApi.collectionRuns(record.id).then(value => {
                  runs.value = value;
                  runTask.value = record;
                }).catch((reason: Error) => message.error(reason.message));
              },
            },
          ]}
        />
      )
    }]);

    const indexColumns = computed<JsxListColumn[]>(() => [{
      title: '指数',
      dataIndex: 'name',
      width: 240,
      render: (_, record: PriceIndex) => (
        <div class="table-title-cell">
          <b>{record.name}</b>
          <span class="small muted">{record.code} · 基期 {record.basePeriod}</span>
        </div>
      )
    }, {
      title: '类别',
      dataIndex: 'category',
      width: 100
    }, {
      title: '点位',
      dataIndex: 'value',
      width: 100,
      render: value => Number(value).toFixed(2)
    }, {
      title: '涨跌幅',
      dataIndex: 'changePct',
      width: 90,
      render: value => <ChangePct value={value} />
    }, {
      title: '样本',
      dataIndex: 'sampleCount',
      width: 80
    }, {
      title: '走势',
      dataIndex: 'trend',
      width: 100,
      render: value => <Sparkline points={value} />
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }]);

    const forecastColumns = computed<JsxListColumn[]>(() => [{
      title: '预测对象',
      dataIndex: 'quoteId',
      width: 220,
      render: value => {
        const quote = data.value?.quotes.find(item => item.id === value);
        return <b>{quote ? `${quote.icon} ${quote.name}（${quote.origin}）` : `#${value}`}</b>;
      }
    }, {
      title: '周期',
      dataIndex: 'horizon',
      width: 90
    }, {
      title: '预测中值',
      dataIndex: 'midPrice',
      width: 170,
      render: (value, record: Forecast) => (
        <span>{Number(value).toFixed(2)} <small class="muted">[{Number(record.lowPrice).toFixed(2)}, {Number(record.highPrice).toFixed(2)}]</small></span>
      )
    }, {
      title: '上涨概率',
      dataIndex: 'upProbability',
      width: 100,
      render: value => <ChangePct value={value} digits={1} />
    }, {
      title: '置信度',
      dataIndex: 'confidence',
      width: 90,
      render: value => `${value}%`
    }, {
      title: 'MAPE',
      dataIndex: 'mape',
      width: 90,
      render: value => `${Number(value).toFixed(2)}%`
    }, {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 150
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: Forecast) => (
        <InfoRowActions actions={[{ key: 'view', label: '查看', onClick: () => { forecast.value = record; } }]} />
      )
    }]);

    const ruleColumns = computed<JsxListColumn[]>(() => [{
      title: '规则',
      dataIndex: 'ruleName',
      width: 220
    }, {
      title: '对象',
      dataIndex: 'quoteName',
      width: 160
    }, {
      title: '条件',
      dataIndex: 'threshold',
      width: 180,
      render: (_, record: AlertRule) => `${record.metric} ${record.operator} ${Number(record.threshold).toFixed(2)}`
    }, {
      title: '触达',
      dataIndex: 'channel',
      width: 150
    }, {
      title: '命中',
      dataIndex: 'hitCount',
      width: 80
    }, {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value, record: AlertRule) => (
        <Switch
          size="small"
          checked={value}
          onChange={checked =>
            opsApi.saveAlertRule({
              id: record.id,
              ruleName: record.ruleName,
              metric: record.metric,
              operator: record.operator,
              threshold: record.threshold,
              channel: record.channel,
              enabled: checked
            }).then(result => {
              message.success(result.message);
              load();
            }).catch((reason: Error) => message.error(reason.message))
          }
        />
      )
    }]);

    return () => {
      const view_data = data.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={load} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="MARKET OPERATIONS"
            title="行情与采集"
            description="授权接口真实采集、历史观测归档与数据质量管理；未配置接口的任务不会产生行情。"
          />

          <div class="grid-4">
            <StatTile label="监测品种" value={view_data.quotes.length} unit="个" note={`在线 ${view_data.quotes.filter(item => item.status === 'online').length} 个`} />
            <StatTile label="数据源" value={view_data.sources.length} unit="个" note={`正常 ${view_data.sources.filter(item => item.status === 'success').length} 个`} tone="up" />
            <StatTile label="数据可用率" value={view_data.quality.availableRate} unit="%" note={`拦截 ${view_data.quality.blockedRows} 行`} tone="up" />
            <StatTile label="采集任务" value={view_data.tasks.length} unit="个" note={`执行中 ${view_data.tasks.filter(item => item.status === 'running').length} 个`} />
          </div>

          <Tabs
            defaultActiveKey="quotes"
            items={[
              {
                key: 'quotes',
                label: `报价维护（${view_data.quotes.length}）`,
                children: (
                  <InfoList
                    listId="quotes"
                    rowKey="id"
                    loading={loading.value}
                    columns={quoteColumns.value}
                    dataSource={filteredQuotes.value}
                    onRefresh={load}
                    filterSlot={
                      <InfoFilters
                        loading={loading.value}
                        fields={[
                          {
                            label: '关键字',
                            control: (
                              <Input
                                allowClear
                                value={quoteDraft.value}
                                placeholder="搜索品种 / 编码 / 产地 / 市场"
                                onChange={(e: any) => { quoteDraft.value = e.target?.value ?? ''; }}
                                onPressEnter={() => { quoteKeyword.value = quoteDraft.value.trim(); }}
                              />
                            ),
                          },
                          {
                            label: '监测级别',
                            control: (
                              <Select
                                value={quoteMonitor.value}
                                options={[
                                  { value: '', label: '全部级别' },
                                  { value: 'normal', label: '正常' },
                                  { value: 'abnormal', label: '异动' },
                                ]}
                                onChange={v => { quoteMonitor.value = String(v ?? ''); }}
                              />
                            ),
                          },
                          {
                            label: '上架状态',
                            control: (
                              <Select
                                value={quoteStatus.value}
                                options={[
                                  { value: '', label: '全部状态' },
                                  { value: 'online', label: '在线' },
                                  { value: 'offline', label: '下线' },
                                ]}
                                onChange={v => { quoteStatus.value = String(v ?? ''); }}
                              />
                            ),
                          },
                        ]}
                        onQuery={() => { quoteKeyword.value = quoteDraft.value.trim(); }}
                        onReset={() => {
                          quoteDraft.value = '';
                          quoteKeyword.value = '';
                          quoteMonitor.value = '';
                          quoteStatus.value = '';
                        }}
                      />
                    }
                    toolbarLeft={
                      <>
                        <Button type="primary" onClick={() => openQuote()}>＋ 新增监测品种</Button>
                        <Button onClick={() => { ruleOpen.value = true; }}>＋ 预警规则</Button>
                      </>
                    }
                  />
                )
              },
              {
                key: 'collection-alerts',
                label: '采集异常告警',
                children: <CollectionAlertsPanel tasks={view_data.tasks} />
              },
              {
                key: 'sources',
                label: `数据源（${view_data.sources.length}）`,
                children: (
                  <InfoList
                    listId="quote-sources"
                    rowKey="id"
                    loading={loading.value}
                    columns={sourceColumns.value}
                    dataSource={view_data.sources}
                    onRefresh={load}
                  />
                )
              },
              {
                key: 'tasks',
                label: `采集任务（${view_data.tasks.length}）`,
                children: (
                  <InfoList
                    listId="quote-tasks"
                    rowKey="id"
                    loading={loading.value}
                    columns={taskColumns.value}
                    dataSource={filteredTasks.value}
                    onRefresh={load}
                    filterSlot={
                      <InfoFilters
                        loading={loading.value}
                        fields={[
                          {
                            label: '关键字',
                            control: (
                              <Input
                                allowClear
                                value={taskDraft.value}
                                placeholder="搜索任务名称 / 数据源 / 说明"
                                onChange={(e: any) => { taskDraft.value = e.target?.value ?? ''; }}
                                onPressEnter={() => { taskKeyword.value = taskDraft.value.trim(); }}
                              />
                            ),
                          },
                          {
                            label: '执行状态',
                            control: (
                              <Select
                                value={taskStatus.value}
                                options={[
                                  { value: '', label: '全部状态' },
                                  { value: 'success', label: '成功' },
                                  { value: 'partial', label: '部分成功' },
                                  { value: 'running', label: '执行中' },
                                  { value: 'failed', label: '失败' },
                                  { value: 'pending_config', label: '待接入' },
                                ]}
                                onChange={v => { taskStatus.value = String(v ?? ''); }}
                              />
                            ),
                          },
                        ]}
                        onQuery={() => { taskKeyword.value = taskDraft.value.trim(); }}
                        onReset={() => { taskDraft.value = ''; taskKeyword.value = ''; taskStatus.value = ''; }}
                      />
                    }
                  />
                )
              },
              {
                key: 'indices',
                label: `价格指数（${view_data.indices.length}）`,
                children: (
                  <InfoList
                    listId="quote-indices"
                    rowKey="id"
                    loading={loading.value}
                    columns={indexColumns.value}
                    dataSource={view_data.indices}
                    onRefresh={load}
                  />
                )
              },
              {
                key: 'forecasts',
                label: `AI 预测（${view_data.forecasts.length}）`,
                children: (
                  <InfoList
                    listId="quote-forecasts"
                    rowKey="id"
                    loading={loading.value}
                    columns={forecastColumns.value}
                    dataSource={view_data.forecasts}
                    onRefresh={load}
                  />
                )
              },
              {
                key: 'quality',
                label: '数据质量',
                children: (
                  <div class="stack">
                    <div class="grid-4">
                      <StatTile label="可用率" value={view_data.quality.availableRate} unit="%" tone="up" />
                      <StatTile label="拦截行数" value={view_data.quality.blockedRows} unit="行" note="真实采集校验拒收" tone="warn" />
                      <StatTile label="去重行数" value={view_data.quality.duplicateRows} unit="行" note="同报价同一观测时点" />
                      <StatTile label="自动补全行数" value={view_data.quality.missingRows} unit="行" note="不猜测规格或单位，缺失直接拒收" />
                    </div>
                    <InfoList
                      listId="quote-quality-rules"
                      rowKey="name"
                      loading={loading.value}
                      dataSource={view_data.quality.rules}
                      onRefresh={load}
                      columns={[
                        { title: '规则', dataIndex: 'name', width: 260 },
                        { title: '处置', dataIndex: 'level', width: 120, render: value => <Tag class="soft-tag tone-amber">{value}</Tag> },
                        { title: '命中次数', dataIndex: 'hit', width: 120 }
                      ]}
                    />
                  </div>
                )
              },
              {
                key: 'rules',
                label: `预警规则（${view_data.rules.length}）`,
                children: (
                  <InfoList
                    listId="quote-alert-rules"
                    rowKey="id"
                    loading={loading.value}
                    columns={ruleColumns.value}
                    dataSource={view_data.rules}
                    onRefresh={load}
                    toolbarLeft={<Button type="primary" onClick={() => { ruleOpen.value = true; }}>＋ 预警规则</Button>}
                  />
                )
              }
            ]}
          />

          <Modal
            open={Boolean(scheduleTask.value)}
            title={`自动采集调度：${scheduleTask.value?.name ?? ''}`}
            width={680}
            onCancel={() => { scheduleTask.value = null; }}
            onOk={() => scheduleForm.submit()}
            confirmLoading={savingSchedule.value}
            okText="保存调度"
          >
            <p class="muted">按北京时间执行，服务每15秒检查到期任务。同一任务不会重复启动；停机错过的周期合并补跑一次，之后按当前时间计算下个周期。服务必须保持运行。</p>
            <p class="muted">失败按基础间隔的1、2、4倍退避重试，耗尽后等待下一周期。部分成功保留拒收记录，不自动重试。暂停阻止后续执行，已开始的采集允许完成。关闭数据源接入也会停止后续调度。</p>
            <Form
              form={scheduleForm}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                if (!scheduleTask.value) return;
                savingSchedule.value = true;
                opsApi.saveCollectionSchedule(scheduleTask.value.id, values)
                  .then(result => {
                    message.success(result.message);
                    scheduleTask.value = null;
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message))
                  .finally(() => { savingSchedule.value = false; });
              }}
            >
              <Form.Item name="enabled" label="启用自动采集" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item label="常用频率">
                <Select
                  placeholder="选择后填入 Cron，可继续编辑"
                  onChange={value => scheduleForm.setFieldValue('cron', value)}
                  options={[
                    { value: '0 */15 * * * *', label: '每15分钟' },
                    { value: '0 */30 * * * *', label: '每30分钟' },
                    { value: '0 0 * * * *', label: '每小时' },
                    { value: '0 0 8,12,18 * * *', label: '每天08:00、12:00、18:00' },
                    { value: '0 0 8 * * MON-FRI', label: '工作日08:00' }
                  ]}
                />
              </Form.Item>
              <Form.Item name="cron" label="六段 Cron（秒 分 时 日 月 周），间隔至少60秒" rules={[{ required: true }]}>
                <Input maxlength={60} placeholder="0 */15 * * * *" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="maxRetries" label="失败额外重试次数（0～3）" rules={[{ required: true }]}><InputNumber min={0} max={3} precision={0} /></Form.Item>
                <Form.Item name="retrySeconds" label="重试基础间隔（60～3600秒）" rules={[{ required: true }]}><InputNumber min={60} max={3600} precision={0} /></Form.Item>
              </div>
            </Form>
          </Modal>

          <Modal
            open={Boolean(configTask.value)}
            title={`授权行情接口：${configTask.value?.name ?? ''}`}
            width={720}
            onCancel={() => { configTask.value = null; }}
            onOk={() => collectionForm.submit()}
            confirmLoading={savingConfig.value}
            okText="保存配置"
          >
            <p class="muted">仅接入已获得使用授权的 HTTPS JSON 接口，GET 请求。接口应返回完整报价数组（最多5000条、2MB），不自动翻页。此处启用允许采集；自动执行还需单独在“自动调度”中配置并启用。</p>
            <p class="muted">默认字段：code、name、category、origin、market、spec、priceUnit、price、observedAt；时间支持带时区ISO时间或北京时间。缺失字段拒收；不同规格与单位分别存储，不擅自换算。日线保留当天最新观测，历史补采不会覆盖更晚报价。</p>
            <Form
              form={collectionForm}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                if (!configTask.value) return;
                savingConfig.value = true;
                opsApi.saveCollectionConfig(configTask.value.id, values)
                  .then(result => {
                    message.success(result.message);
                    configTask.value = null;
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message))
                  .finally(() => { savingConfig.value = false; });
              }}
            >
              <Form.Item name="endpoint" label="已授权 HTTPS 接口地址（不含查询参数或密钥）" rules={[{ required: true }]}><Input maxlength={1500} /></Form.Item>
              <Form.Item name="rowsPath" label="报价数组 JSON Pointer（根数组留空）"><Input placeholder="/data/rows" maxlength={200} /></Form.Item>
              <Form.Item name="fieldMap" label="字段映射 JSON（标准字段留 {}，如 price 映射为 /avgPrice）" rules={[{ required: true }]}><Input.TextArea rows={5} maxlength={4000} /></Form.Item>
              <Form.Item name="tokenEnv" label="Bearer Token 环境变量名（无鉴权可留空，不要填写密钥本身）"><Input maxlength={120} /></Form.Item>
              <Form.Item name="enabled" label="允许执行采集" valuePropName="checked"><Switch /></Form.Item>
            </Form>
          </Modal>

          <Drawer open={Boolean(runTask.value)} title={`${runTask.value?.name ?? ''} · 最近20次真实执行`} width={1000} onClose={() => { runTask.value = null; }}>
            <Table
              rowKey="id"
              dataSource={runs.value}
              pagination={false}
              scroll={{ x: 900 }}
              columns={[
                { title: '开始时间', dataIndex: 'startedAt' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  customRender: ({ text: v }: { text: any }) =>
                    ({ running: '执行中', partial: '部分成功', failed: '失败', success: '成功' } as Record<string, string>)[v] ?? v
                },
                { title: '接收', dataIndex: 'totalRows' },
                { title: '入库', dataIndex: 'acceptedRows' },
                { title: '重复', dataIndex: 'duplicateRows' },
                { title: '拒收', dataIndex: 'rejectedRows' },
                { title: '结果与拒收原因', dataIndex: 'detail', width: 340 }
              ]}
            />
          </Drawer>

          <Modal
            open={quoteOpen.value}
            title={editing.value ? `维护行情：${editing.value.name}` : '新增监测品种'}
            onCancel={() => { quoteOpen.value = false; }}
            onOk={() => form.submit()}
            okText="保存"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                opsApi.saveQuote({ ...values, id: editing.value?.id })
                  .then(result => {
                    message.success(result.message);
                    quoteOpen.value = false;
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message));
              }}
            >
              <div class="form-grid">
                <Form.Item name="name" label="品种名称" rules={[{ required: true, message: '请填写品种名称' }]}><Input placeholder="例：大蒜" /></Form.Item>
                <Form.Item name="price" label="最新价" rules={[{ required: true, message: '请填写价格' }]}><InputNumber style={{ width: '100%' }} min={0} step={0.01} /></Form.Item>
                <Form.Item name="changePct" label="涨跌幅（%）" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
                <Form.Item name="changeAmount" label="涨跌额"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
                <Form.Item name="monitorLevel" label="监测级别" rules={[{ required: true }]}>
                  <Select options={[{ value: 'normal', label: '正常' }, { value: 'abnormal', label: '异动' }]} />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                  <Select options={[{ value: 'online', label: '在线' }, { value: 'offline', label: '下线' }]} />
                </Form.Item>
              </div>
              <Form.Item name="spec" label="规格"><Input placeholder="例：杂交红蒜 5.5-6.0cm 混级" /></Form.Item>
              {!editing.value && (
                <div class="form-grid">
                  <Form.Item name="icon" label="图标（emoji）"><Input /></Form.Item>
                  <Form.Item name="category" label="类别"><Select options={['蔬菜', '水果', '粮油', '畜禽', '水产'].map(item => ({ value: item, label: item }))} /></Form.Item>
                  <Form.Item name="origin" label="产地"><Input /></Form.Item>
                  <Form.Item name="market" label="市场"><Input /></Form.Item>
                  <Form.Item name="priceUnit" label="计价单位"><Select options={['元/公斤', '元/斤', '元/吨'].map(item => ({ value: item, label: item }))} /></Form.Item>
                </div>
              )}
            </Form>
          </Modal>

          <Modal
            open={ruleOpen.value}
            title="新建预警规则"
            onCancel={() => { ruleOpen.value = false; }}
            onOk={() => ruleForm.submit()}
            okText="创建"
          >
            <Form
              form={ruleForm}
              layout="vertical"
              initialValues={{ metric: '涨跌幅', operator: '>=', channel: '站内消息' }}
              onFinish={(values: Record<string, any>) => {
                opsApi.saveAlertRule(values)
                  .then(result => {
                    message.success(result.message);
                    ruleOpen.value = false;
                    ruleForm.resetFields();
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: '请填写规则名称' }]}><Input placeholder="例：大蒜涨跌幅超 5%" /></Form.Item>
              <Form.Item name="quoteId" label="监控品种" rules={[{ required: true, message: '请选择品种' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  onChange={value => {
                    const quote = view_data.quotes.find(item => item.id === value);
                    ruleForm.setFieldValue('quoteName', quote?.name ?? '全平台');
                  }}
                  options={view_data.quotes.map(quote => ({
                    value: quote.id,
                    label: `${quote.icon} ${quote.name}（${quote.origin}）`
                  }))}
                />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="metric" label="指标" rules={[{ required: true }]}>
                  <Select options={['涨跌幅', '最新价', '周涨幅', '月涨幅'].map(item => ({ value: item, label: item }))} />
                </Form.Item>
                <Form.Item name="operator" label="条件" rules={[{ required: true }]}>
                  <Select options={[{ value: '>=', label: '大于等于' }, { value: '<=', label: '小于等于' }]} />
                </Form.Item>
                <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请填写阈值' }]}><InputNumber style={{ width: '100%' }} min={0} step={0.1} /></Form.Item>
                <Form.Item name="channel" label="触达渠道" rules={[{ required: true }]}>
                  <Select options={['站内消息', '短信', '微信'].map(item => ({ value: item, label: item }))} />
                </Form.Item>
              </div>
            </Form>
          </Modal>

          <Drawer open={Boolean(forecast.value)} onClose={() => { forecast.value = null; }} width={520} title="AI 预测详情">
            {forecast.value && (
              <div class="stack">
                <div class="kv-list">
                  <div class="kv"><span>预测周期</span><b>{forecast.value.horizon}</b></div>
                  <div class="kv"><span>预测中值</span><b>{Number(forecast.value.midPrice).toFixed(2)}</b></div>
                  <div class="kv"><span>预测区间</span><b>{Number(forecast.value.lowPrice).toFixed(2)} ~ {Number(forecast.value.highPrice).toFixed(2)}</b></div>
                  <div class="kv"><span>上涨概率</span><b>{forecast.value.upProbability}%</b></div>
                  <div class="kv"><span>震荡概率</span><b>{forecast.value.flatProbability}%</b></div>
                  <div class="kv"><span>下跌概率</span><b>{forecast.value.downProbability}%</b></div>
                  <div class="kv"><span>供给指数 / 需求指数</span><b>{forecast.value.supplyIndex} / {forecast.value.demandIndex}</b></div>
                  <div class="kv"><span>库存天数</span><b>{forecast.value.stockDays}</b></div>
                  <div class="kv"><span>模型置信度</span><b>{forecast.value.confidence}%</b></div>
                  <div class="kv"><span>MAPE</span><b>{Number(forecast.value.mape).toFixed(2)}%</b></div>
                </div>
                <SectionHeading kicker="ADVICE" title="经营建议" />
                <p class="small"><b>销售端：</b>{forecast.value.salesAdvice}</p>
                <p class="small"><b>种植端：</b>{forecast.value.plantAdvice}</p>
                <SectionHeading kicker="DRIVERS" title="驱动因子" />
                <p class="small">{forecast.value.drivers}</p>
                <p class="source-note">更新时间 {forecast.value.updatedAt}</p>
              </div>
            )}
          </Drawer>
        </div>
      );
    };
  }
});
