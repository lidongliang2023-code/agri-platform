import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { RecommendAdmin, RecommendItem, RecommendSlot, SensitiveWord } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag } from '../components/ui';

/**
 * 推荐与推送：推荐位策略与敏感词库共同决定用户端首屏内容，
 * 策略调整立即生效，因此每次改动都写审计日志。
 */
export const RecommendPage = defineComponent({
  name: "RecommendPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<RecommendAdmin | null>(null);
    const setData = (next: RecommendAdmin | null | ((previous: RecommendAdmin | null) => RecommendAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: RecommendAdmin | null) => RecommendAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const slotTarget = ref<RecommendSlot | null>(null);
    const setSlotTarget = (next: RecommendSlot | null | ((previous: RecommendSlot | null) => RecommendSlot | null)) => {
      slotTarget.value = typeof next === 'function' ? (next as (previous: RecommendSlot | null) => RecommendSlot | null)(slotTarget.value) : next;
    };
    const wordOpen = ref(false);
    const setWordOpen = (next: typeof wordOpen.value | ((previous: typeof wordOpen.value) => typeof wordOpen.value)) => {
      wordOpen.value = typeof next === 'function' ? (next as (previous: typeof wordOpen.value) => typeof wordOpen.value)(wordOpen.value) : next;
    };
    const slotForm = useFormModel();
    const curateTarget = ref<RecommendSlot | null>(null);
    const setCurateTarget = (next: RecommendSlot | null | ((previous: RecommendSlot | null) => RecommendSlot | null)) => {
      curateTarget.value = typeof next === 'function' ? (next as (previous: RecommendSlot | null) => RecommendSlot | null)(curateTarget.value) : next;
    };
    const curateIds = ref<number[]>([]);
    const setCurateIds = (next: number[] | ((previous: number[]) => number[])) => {
      curateIds.value = typeof next === 'function' ? (next as (previous: number[]) => number[])(curateIds.value) : next;
    };
    const articleOptions = ref<Array<{
      label: string;
      value: number;
    }>>([]);
    const setArticleOptions = (next: Array<{
      label: string;
      value: number;
    }> | ((previous: Array<{
      label: string;
      value: number;
    }>) => Array<{
      label: string;
      value: number;
    }>)) => {
      articleOptions.value = typeof next === 'function' ? (next as (previous: Array<{
        label: string;
        value: number;
      }>) => Array<{
        label: string;
        value: number;
      }>)(articleOptions.value) : next;
    };
    const curating = ref(false);
    const setCurating = (next: typeof curating.value | ((previous: typeof curating.value) => typeof curating.value)) => {
      curating.value = typeof next === 'function' ? (next as (previous: typeof curating.value) => typeof curating.value)(curating.value) : next;
    };
    const wordForm = useFormModel();
    const load = (): void => {
      setError('');
      opsApi.recommend().then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = load();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openCurate = (slot: RecommendSlot): void => {
      setCurateTarget(slot);
      setCurateIds([]);
      setArticleOptions([]);
      void Promise.all([opsApi.recommendItems(slot.id), opsApi.contents({
        status: 'published'
      })]).then(([items, contents]) => {
        const list = items as RecommendItem[];
        setCurateIds(list.map(item => item.contentId));
        setArticleOptions((contents.items ?? []).map(article => ({
          value: article.id,
          label: `[${article.channel}] ${article.title}`
        })));
      }).catch((reason: Error) => message.error(reason.message));
    };
    const saveCurate = (): void => {
      if (!curateTarget.value) return;
      setCurating(true);
      opsApi.saveRecommendItems(curateTarget.value.id, curateIds.value).then(result => {
        message.success(result.message);
        setCurateTarget(null);
        load();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setCurating(false));
    };
    const slotColumns = computed<ColumnsType<RecommendSlot>>(() => [{
      title: '推荐位',
      dataIndex: 'slotName',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.slotName}</b>
          <span class="small muted">{record.positionName}</span>
        </div>
    }, {
      title: '策略',
      dataIndex: 'strategyName',
      width: 260
    }, {
      title: '条数',
      dataIndex: 'itemCount',
      width: 80
    }, {
      title: 'CTR',
      dataIndex: 'ctr',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => `${Number(value).toFixed(2)}%`
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <StatusTag status={value} />
    }, {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 150
    }, {
      title: '操作',
      width: 180,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Space size={4}>
          <Button size="small" onClick={() => {
          setSlotTarget(record);
          slotForm.setFieldsValue({
            strategyName: record.strategyName,
            itemCount: record.itemCount,
            status: record.status
          });
        }}>
            调整
          </Button>
          <Button size="small" type="primary" ghost onClick={() => openCurate(record)}>编排内容</Button>
        </Space>
    }]);
    const wordColumns = computed<ColumnsType<SensitiveWord>>(() => [{
      title: '敏感词',
      dataIndex: 'word',
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <b>{value}</b>
    }, {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class={`soft-tag tone-${value === 'high' ? 'up' : value === 'medium' ? 'amber' : 'default'}`}>
          {value === 'high' ? '高' : value === 'medium' ? '中' : '低'}
        </Tag>
    }, {
      title: '处置',
      dataIndex: 'action',
      width: 120
    }, {
      title: '命中',
      dataIndex: 'hitCount',
      width: 80
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <StatusTag status={value} />
    }, {
      title: '操作',
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" onClick={() => {
        wordForm.setFieldsValue({
          id: record.id,
          word: record.word,
          level: record.level,
          action: record.action,
          status: record.status
        });
        setWordOpen(true);
      }}>
          编辑
        </Button>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_slotColumns = slotColumns.value;
      const view_wordColumns = wordColumns.value;
      const view_slotTarget = slotTarget.value;
      const view_curateTarget = curateTarget.value;
      const view_curating = curating.value;
      const view_curateIds = curateIds.value;
      const view_articleOptions = articleOptions.value;
      const view_wordOpen = wordOpen.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="RECOMMENDATION" title="推荐与推送" description="推荐位策略、敏感词库与预警推送统一维护 · 策略变更实时生效，敏感词命中会自动降级为人工复核" actions={<Button type="primary" onClick={() => {
          wordForm.resetFields();
          setWordOpen(true);
        }}>＋ 新增敏感词</Button>} />

      <div class="grid-4">
        <StatTile label="推荐位" value={view_data.slots.length} unit="个" note={`在线 ${view_data.slots.filter(item => item.status === 'online').length} 个`} />
        <StatTile label="平均 CTR" value={(view_data.slots.reduce((sum, item) => sum + item.ctr, 0) / Math.max(view_data.slots.length, 1)).toFixed(2)} unit="%" note="近 7 日均值" tone="up" />
        <StatTile label="敏感词" value={view_data.sensitiveWords.length} unit="条" note={`启用 ${view_data.sensitiveWords.filter(item => item.status === 'enabled').length} 条`} />
        <StatTile label="推送记录" value={view_data.pushRecords.length} unit="条" note="价格预警触达" tone="warn" />
      </div>

      <section class="surface-card">
        <SectionHeading kicker="SLOTS" title="推荐位策略" />
        <Table rowKey="id" size="middle" columns={view_slotColumns} dataSource={view_data.slots} pagination={false} />
      </section>

      <section class="surface-card">
        <SectionHeading kicker="SENSITIVE WORDS" title="敏感词库" />
        <Table rowKey="id" size="middle" columns={view_wordColumns} dataSource={view_data.sensitiveWords} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <section class="surface-card">
        <SectionHeading kicker="PUSH RECORDS" title="推送记录" />
        <Table rowKey="id" size="middle" pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} dataSource={view_data.pushRecords} columns={[{
            title: '标题',
            dataIndex: 'title'
          }, {
            title: '品种',
            dataIndex: 'quoteName',
            width: 140
          }, {
            title: '触发值',
            dataIndex: 'triggerValue',
            width: 110
          }, {
            title: '级别',
            dataIndex: 'level',
            width: 90,
            customRender: ({
              text: value
            }: {
              text: any;
            }) => <Tag class={`soft-tag tone-${value === 'high' ? 'up' : 'amber'}`}>{value === 'high' ? '高' : '中'}</Tag>
          }, {
            title: '时间',
            dataIndex: 'createdAt',
            width: 150
          }]} />
      </section>

      <Modal open={Boolean(view_slotTarget)} title={`调整推荐位：${view_slotTarget?.slotName ?? ''}`} onCancel={() => setSlotTarget(null)} onOk={() => slotForm.submit()} okText="保存">
        <Form form={slotForm} layout="vertical" onFinish={(values: Record<string, any>) => {
            if (!view_slotTarget) return;
            opsApi.saveSlot(view_slotTarget.id, values).then(result => {
              message.success(result.message);
              setSlotTarget(null);
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <Form.Item name="strategyName" label="推荐策略" rules={[{
              required: true,
              message: '请填写策略'
            }]}>
            <Input placeholder="例：实时意图感知 + DIN 多目标" />
          </Form.Item>
          <div class="form-grid">
            <Form.Item name="itemCount" label="展示条数" rules={[{
                required: true
              }]}>
              <InputNumber style={{
                  width: '100%'
                }} min={1} max={20} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{
                required: true
              }]}>
              <Select options={[{
                  value: 'online',
                  label: '上线'
                }, {
                  value: 'offline',
                  label: '下线'
                }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal open={Boolean(view_curateTarget)} title={`编排内容：${view_curateTarget?.slotName ?? ''}`} onCancel={() => setCurateTarget(null)} onOk={saveCurate} confirmLoading={view_curating} okText="保存并生效" width={680}>
        <p class="small muted" style={{
            marginBottom: "12px"
          }}>
          选中的内容按「选择顺序」展示在门户对应位置；全部清空则门户回退为按发布时间排序。
        </p>
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" style={{
            width: '100%'
          }} placeholder="搜索并选择要推荐的文章" value={view_curateIds} onChange={values => setCurateIds(values as number[])} options={view_articleOptions} />
        {view_curateIds.length > 0 && <ol class="small" style={{
            marginTop: "14px",
            paddingLeft: "20px",
            lineHeight: 1.9
          }}>
            {view_curateIds.map(id => <li key={id}>{view_articleOptions.find(item => item.value === id)?.label ?? `#${id}`}</li>)}
          </ol>}
        {view_curateIds.length === 0 && <p class="small muted" style={{
            marginTop: "12px"
          }}>当前未选择任何内容。</p>}
      </Modal>

      <Modal open={view_wordOpen} title="敏感词维护" onCancel={() => setWordOpen(false)} onOk={() => wordForm.submit()} okText="保存">
        <Form form={wordForm} layout="vertical" initialValues={{
            level: 'medium',
            action: '人工复核',
            status: 'enabled'
          }} onFinish={(values: Record<string, any>) => {
            opsApi.saveSensitiveWord(values).then(result => {
              message.success(result.message);
              setWordOpen(false);
              wordForm.resetFields();
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <Form.Item name="word" label="敏感词" rules={[{
              required: true,
              message: '请填写敏感词'
            }]}>
            <Input placeholder="例：绝对增产" />
          </Form.Item>
          <div class="form-grid">
            <Form.Item name="level" label="级别" rules={[{
                required: true
              }]}>
              <Select options={[{
                  value: 'high',
                  label: '高'
                }, {
                  value: 'medium',
                  label: '中'
                }, {
                  value: 'low',
                  label: '低'
                }]} />
            </Form.Item>
            <Form.Item name="action" label="处置方式" rules={[{
                required: true
              }]}>
              <Select options={['人工复核', '直接拦截', '仅记录'].map(item => ({
                  value: item,
                  label: item
                }))} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{
                required: true
              }]}>
              <Select options={[{
                  value: 'enabled',
                  label: '启用'
                }, {
                  value: 'disabled',
                  label: '停用'
                }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>;
    };
  }
});
