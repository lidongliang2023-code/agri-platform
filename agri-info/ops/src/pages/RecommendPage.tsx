import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Form, Input, InputNumber, Modal, Select, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { RecommendAdmin, RecommendItem, RecommendSlot, SensitiveWord } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag } from '../components/ui';

/**
 * 推荐与推送：推荐位策略与敏感词库共同决定用户端首屏内容，
 * 策略调整立即生效，因此每次改动都写审计日志。
 */
export const RecommendPage = defineComponent({
  name: "RecommendPage",
  props: {},
  setup() {
    const data = ref<RecommendAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const slotTarget = ref<RecommendSlot | null>(null);
    const wordOpen = ref(false);
    const slotForm = useFormModel();
    const curateTarget = ref<RecommendSlot | null>(null);
    const curateIds = ref<number[]>([]);
    const articleOptions = ref<Array<{ label: string; value: number }>>([]);
    const curating = ref(false);
    const wordForm = useFormModel();
    const wordDraft = ref('');
    const wordKeyword = ref('');
    const wordLevel = ref('');

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.recommend()
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);

    const openCurate = (slot: RecommendSlot): void => {
      curateTarget.value = slot;
      curateIds.value = [];
      articleOptions.value = [];
      void Promise.all([opsApi.recommendItems(slot.id), opsApi.contents({ status: 'published' })])
        .then(([items, contents]) => {
          const list = items as RecommendItem[];
          curateIds.value = list.map(item => item.contentId);
          articleOptions.value = (contents.items ?? []).map(article => ({
            value: article.id,
            label: `[${article.channel}] ${article.title}`
          }));
        })
        .catch((reason: Error) => message.error(reason.message));
    };

    const saveCurate = (): void => {
      if (!curateTarget.value) return;
      curating.value = true;
      opsApi.saveRecommendItems(curateTarget.value.id, curateIds.value)
        .then(result => {
          message.success(result.message);
          curateTarget.value = null;
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { curating.value = false; });
    };

    const filteredWords = computed(() => {
      const list = data.value?.sensitiveWords ?? [];
      const q = wordKeyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (wordLevel.value && item.level !== wordLevel.value) return false;
        if (!q) return true;
        return `${item.word} ${item.action}`.toLowerCase().includes(q);
      });
    });

    const slotColumns = computed<JsxListColumn[]>(() => [{
      title: '推荐位',
      dataIndex: 'slotName',
      width: 220,
      render: (_, record: RecommendSlot) => (
        <div class="table-title-cell">
          <b>{record.slotName}</b>
          <span class="small muted">{record.positionName}</span>
        </div>
      )
    }, {
      title: '策略',
      dataIndex: 'strategyName',
      width: 240
    }, {
      title: '条数',
      dataIndex: 'itemCount',
      width: 80
    }, {
      title: 'CTR',
      dataIndex: 'ctr',
      width: 90,
      render: value => `${Number(value).toFixed(2)}%`
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record: RecommendSlot) => (
        <InfoRowActions
          actions={[
            {
              key: 'adjust',
              label: '调整',
              onClick: () => {
                slotTarget.value = record;
                slotForm.setFieldsValue({
                  strategyName: record.strategyName,
                  itemCount: record.itemCount,
                  status: record.status
                });
              },
            },
            { key: 'curate', label: '编排内容', onClick: () => openCurate(record) },
          ]}
        />
      )
    }]);

    const wordColumns = computed<JsxListColumn[]>(() => [{
      title: '敏感词',
      dataIndex: 'word',
      width: 200,
      render: value => <b>{value}</b>
    }, {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      render: value => (
        <Tag class={`soft-tag tone-${value === 'high' ? 'up' : value === 'medium' ? 'amber' : 'default'}`}>
          {value === 'high' ? '高' : value === 'medium' ? '中' : '低'}
        </Tag>
      )
    }, {
      title: '处置',
      key: 'disposition',
      dataIndex: 'action',
      width: 120
    }, {
      title: '命中',
      dataIndex: 'hitCount',
      width: 90
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: SensitiveWord) => (
        <InfoRowActions
          actions={[{
            key: 'edit',
            label: '编辑',
            onClick: () => {
              wordForm.setFieldsValue({
                id: record.id,
                word: record.word,
                level: record.level,
                action: record.action,
                status: record.status
              });
              wordOpen.value = true;
            },
          }]}
        />
      )
    }]);

    return () => {
      const view_data = data.value;
      const view_slotTarget = slotTarget.value;
      const view_curateTarget = curateTarget.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={load} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="RECOMMENDATION"
            title="推荐与推送"
            description="推荐位策略、敏感词库与预警推送统一维护 · 策略变更实时生效，敏感词命中会自动降级为人工复核"
          />

          <div class="grid-4">
            <StatTile label="推荐位" value={view_data.slots.length} unit="个" note={`在线 ${view_data.slots.filter(item => item.status === 'online').length} 个`} />
            <StatTile label="平均 CTR" value={(view_data.slots.reduce((sum, item) => sum + item.ctr, 0) / Math.max(view_data.slots.length, 1)).toFixed(2)} unit="%" note="近 7 日均值" tone="up" />
            <StatTile label="敏感词" value={view_data.sensitiveWords.length} unit="条" note={`启用 ${view_data.sensitiveWords.filter(item => item.status === 'enabled').length} 条`} />
            <StatTile label="推送记录" value={view_data.pushRecords.length} unit="条" note="价格预警触达" tone="warn" />
          </div>

          <InfoList
            listId="recommend-slots"
            rowKey="id"
            loading={loading.value}
            columns={slotColumns.value}
            dataSource={view_data.slots}
            onRefresh={load}
            toolbarLeft={<span style={{ fontWeight: 600 }}>推荐位策略</span>}
          />

          <InfoList
            listId="recommend-words"
            rowKey="id"
            loading={loading.value}
            columns={wordColumns.value}
            dataSource={filteredWords.value}
            onRefresh={load}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '敏感词关键字',
                    control: (
                      <Input
                        allowClear
                        value={wordDraft.value}
                        placeholder="搜索敏感词 / 处置方式"
                        onChange={(e: any) => { wordDraft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { wordKeyword.value = wordDraft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '敏感级别',
                    control: (
                      <Select
                        value={wordLevel.value}
                        options={[
                          { value: '', label: '全部级别' },
                          { value: 'high', label: '高' },
                          { value: 'medium', label: '中' },
                          { value: 'low', label: '低' },
                        ]}
                        onChange={v => { wordLevel.value = String(v ?? ''); }}
                      />
                    ),
                  },
                ]}
                onQuery={() => { wordKeyword.value = wordDraft.value.trim(); }}
                onReset={() => { wordDraft.value = ''; wordKeyword.value = ''; wordLevel.value = ''; }}
              />
            }
            toolbarLeft={
              <Button
                type="primary"
                onClick={() => {
                  wordForm.resetFields();
                  wordOpen.value = true;
                }}
              >
                ＋ 新增敏感词
              </Button>
            }
          />

          <InfoList
            listId="recommend-pushes"
            rowKey="id"
            loading={loading.value}
            dataSource={view_data.pushRecords}
            onRefresh={load}
            toolbarLeft={<span style={{ fontWeight: 600 }}>预警推送记录</span>}
            columns={[
              { title: '标题', dataIndex: 'title', width: 260 },
              { title: '品种', dataIndex: 'quoteName', width: 140 },
              { title: '触发值', dataIndex: 'triggerValue', width: 110 },
              {
                title: '级别',
                dataIndex: 'level',
                width: 90,
                render: value => <Tag class={`soft-tag tone-${value === 'high' ? 'up' : 'amber'}`}>{value === 'high' ? '高' : '中'}</Tag>
              },
              { title: '时间', dataIndex: 'createdAt', width: 160 }
            ]}
          />

          <Modal
            open={Boolean(view_slotTarget)}
            title={`调整推荐位：${view_slotTarget?.slotName ?? ''}`}
            onCancel={() => { slotTarget.value = null; }}
            onOk={() => slotForm.submit()}
            okText="保存"
          >
            <Form
              form={slotForm}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                if (!view_slotTarget) return;
                opsApi.saveSlot(view_slotTarget.id, values).then(result => {
                  message.success(result.message);
                  slotTarget.value = null;
                  load();
                }).catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="strategyName" label="推荐策略" rules={[{ required: true, message: '请填写策略' }]}>
                <Input placeholder="例：实时意图感知 + DIN 多目标" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="itemCount" label="展示条数" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={1} max={20} />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                  <Select options={[{ value: 'online', label: '上线' }, { value: 'paused', label: '已暂停' }, { value: 'offline', label: '下线' }]} />
                </Form.Item>
              </div>
            </Form>
          </Modal>

          <Modal
            open={Boolean(view_curateTarget)}
            title={`编排内容：${view_curateTarget?.slotName ?? ''}`}
            onCancel={() => { curateTarget.value = null; }}
            onOk={saveCurate}
            confirmLoading={curating.value}
            okText="保存并生效"
            width={680}
          >
            <p class="small muted" style={{ marginBottom: "12px" }}>
              选中的内容按「选择顺序」展示在门户对应位置；全部清空则门户回退为按发布时间排序。
            </p>
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder="搜索并选择要推荐的文章"
              value={curateIds.value}
              onChange={values => { curateIds.value = values as number[]; }}
              options={articleOptions.value}
            />
            {curateIds.value.length > 0 && (
              <ol class="small" style={{ marginTop: "14px", paddingLeft: "20px", lineHeight: 1.9 }}>
                {curateIds.value.map(id => <li key={id}>{articleOptions.value.find(item => item.value === id)?.label ?? `#${id}`}</li>)}
              </ol>
            )}
            {curateIds.value.length === 0 && <p class="small muted" style={{ marginTop: "12px" }}>当前未选择任何内容。</p>}
          </Modal>

          <Modal
            open={wordOpen.value}
            title="敏感词维护"
            onCancel={() => { wordOpen.value = false; }}
            onOk={() => wordForm.submit()}
            okText="保存"
          >
            <Form
              form={wordForm}
              layout="vertical"
              initialValues={{ level: 'medium', action: '人工复核', status: 'enabled' }}
              onFinish={(values: Record<string, any>) => {
                opsApi.saveSensitiveWord(values).then(result => {
                  message.success(result.message);
                  wordOpen.value = false;
                  wordForm.resetFields();
                  load();
                }).catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="word" label="敏感词" rules={[{ required: true, message: '请填写敏感词' }]}>
                <Input placeholder="例：绝对增产" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="level" label="级别" rules={[{ required: true }]}>
                  <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
                </Form.Item>
                <Form.Item name="action" label="处置方式" rules={[{ required: true }]}>
                  <Select options={['人工复核', '直接拦截', '仅记录'].map(item => ({ value: item, label: item }))} />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                  <Select options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} />
                </Form.Item>
              </div>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
