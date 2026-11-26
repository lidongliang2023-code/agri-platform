import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Select, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { AiAdmin, Knowledge, QaRecord } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/**
 * AI 知识库：AI 问答的答案完全来自这里的条目，因此内容质量直接决定问答可用性。
 * 编辑后立即影响检索结果，无需重启服务。
 */
export const AiPage = defineComponent({
  name: "AiPage",
  props: {},
  setup() {
    const data = ref<AiAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const draft = ref('');
    const keyword = ref('');
    const qaDraft = ref('');
    const qaKeyword = ref('');
    const qaType = ref('');
    const editing = ref<Knowledge | null>(null);
    const editorOpen = ref(false);
    const detail = ref<QaRecord | null>(null);
    const form = useFormModel();

    const load = (nextKeyword = keyword.value): void => {
      keyword.value = nextKeyword;
      loading.value = true;
      error.value = '';
      opsApi.ai(nextKeyword || undefined)
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(() => load(''));

    const openEditor = (item?: Knowledge): void => {
      editing.value = item ?? null;
      form.setFieldsValue(item ? {
        title: item.title,
        category: item.category,
        crop: item.crop,
        summary: item.summary,
        content: item.content,
        tags: item.tags.join(','),
        sourceName: item.sourceName
      } : {
        title: '',
        category: '病虫害防治',
        crop: '通用',
        summary: '',
        content: '',
        tags: '',
        sourceName: '平台运营'
      });
      editorOpen.value = true;
    };

    const filteredQaPairs = computed(() => {
      const list = data.value?.qaPairs ?? [];
      const q = qaKeyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (qaType.value && item.qaType !== qaType.value) return false;
        if (!q) return true;
        return `${item.question} ${item.crop} ${item.askedBy} ${item.qaNo}`.toLowerCase().includes(q);
      });
    });

    const knowledgeColumns = computed<JsxListColumn[]>(() => [{
      title: '知识条目',
      dataIndex: 'title',
      width: 280,
      render: (_, record: Knowledge) => (
        <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.category} · {record.crop} · {record.sourceName}</span>
        </div>
      )
    }, {
      title: '标签',
      dataIndex: 'tags',
      width: 220,
      render: value => (value ?? []).slice(0, 3).map((tag: string) => <Tag class="soft-tag" key={tag}>{tag}</Tag>)
    }, {
      title: '阅读',
      dataIndex: 'viewCount',
      width: 100,
      render: value => formatCount(value)
    }, {
      title: '更新',
      dataIndex: 'updatedAt',
      width: 140
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: Knowledge) => (
        <InfoRowActions actions={[{ key: 'edit', label: '编辑', onClick: () => openEditor(record) }]} />
      )
    }]);

    const qaColumns = computed<JsxListColumn[]>(() => [{
      title: '问题',
      dataIndex: 'question',
      width: 300,
      render: (_, record: QaRecord) => (
        <div class="table-title-cell">
          <b>{record.question}</b>
          <span class="small muted">{record.qaNo} · {record.askedBy} · {record.createdAt}</span>
        </div>
      )
    }, {
      title: '类型',
      dataIndex: 'qaType',
      width: 100,
      render: value => <Tag class="soft-tag">{value === 'pest' ? '病虫识别' : '问答'}</Tag>
    }, {
      title: '作物',
      dataIndex: 'crop',
      width: 100
    }, {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: value => <Tag class={`soft-tag tone-${value >= 90 ? 'green' : value >= 80 ? 'amber' : 'up'}`}>{value}%</Tag>
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: QaRecord) => (
        <InfoRowActions actions={[{ key: 'view', label: '查看', onClick: () => { detail.value = record; } }]} />
      )
    }]);

    return () => {
      const view_data = data.value;
      const view_detail = detail.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={() => load()} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="AI KNOWLEDGE BASE"
            title="AI 知识库"
            description="AI 问答与病虫识别的答案来源 · 条目需标注作物与分类，检索按二元组重叠度 + 作物命中加权"
          />

          <div class="grid-4">
            <StatTile label="知识条目" value={view_data.stats.knowledgeCount} unit="条" note="全部已发布" tone="up" />
            <StatTile label="问答记录" value={formatCount(view_data.stats.qaCount)} unit="次" note="含病虫识别" />
            <StatTile label="平均置信度" value={view_data.stats.avgConfidence} unit="%" note="低于 80% 建议转人工" tone="warn" />
            <StatTile label="敏感词" value={view_data.stats.sensitiveCount} unit="条" note="与内容审核共用词库" />
          </div>

          <InfoList
            listId="ai-knowledge"
            rowKey="id"
            loading={loading.value}
            columns={knowledgeColumns.value}
            dataSource={view_data.knowledge}
            onRefresh={() => load()}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[{
                  label: '关键字',
                  control: (
                    <Input
                      allowClear
                      value={draft.value}
                      placeholder="搜索知识标题 / 标签 / 作物"
                      onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                      onPressEnter={() => load(draft.value.trim())}
                    />
                  ),
                }]}
                onQuery={() => load(draft.value.trim())}
                onReset={() => { draft.value = ''; load(''); }}
              />
            }
            toolbarLeft={<Button type="primary" onClick={() => openEditor()}>＋ 新增知识条目</Button>}
          />

          <InfoList
            listId="ai-qa-logs"
            rowKey="id"
            loading={loading.value}
            columns={qaColumns.value}
            dataSource={filteredQaPairs.value}
            onRefresh={() => load()}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '问答关键字',
                    control: (
                      <Input
                        allowClear
                        value={qaDraft.value}
                        placeholder="搜索问题 / 作物 / 提问人"
                        onChange={(e: any) => { qaDraft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { qaKeyword.value = qaDraft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '问答类型',
                    control: (
                      <Select
                        value={qaType.value}
                        options={[
                          { value: '', label: '全部类型' },
                          { value: 'qa', label: '问答' },
                          { value: 'pest', label: '病虫识别' },
                        ]}
                        onChange={v => { qaType.value = String(v ?? ''); }}
                      />
                    ),
                  },
                ]}
                onQuery={() => { qaKeyword.value = qaDraft.value.trim(); }}
                onReset={() => { qaDraft.value = ''; qaKeyword.value = ''; qaType.value = ''; }}
              />
            }
            toolbarLeft={<span style={{ fontWeight: 600 }}>问答记录</span>}
          />

          <Modal
            open={editorOpen.value}
            title={editing.value ? '编辑知识条目' : '新增知识条目'}
            width={640}
            onCancel={() => { editorOpen.value = false; }}
            onOk={() => form.submit()}
            okText="保存"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                opsApi.saveKnowledge({
                  ...values,
                  id: editing.value?.id
                }).then(result => {
                  message.success(result.message);
                  editorOpen.value = false;
                  form.resetFields();
                  load();
                }).catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
                <Input placeholder="例：大蒜叶枯病识别与防治" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                  <Select options={['病虫害防治', '营养管理', '采后处理', '栽培技术', '政策解读'].map(item => ({ value: item, label: item }))} />
                </Form.Item>
                <Form.Item name="crop" label="作物" rules={[{ required: true }]}>
                  <Input placeholder="例：大蒜 / 通用" />
                </Form.Item>
                <Form.Item name="sourceName" label="来源单位">
                  <Input placeholder="例：省农科院蔬菜研究所" />
                </Form.Item>
                <Form.Item name="tags" label="标签（逗号分隔）">
                  <Input placeholder="例：大蒜,叶枯病,真菌病害" />
                </Form.Item>
              </div>
              <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请填写摘要' }]}>
                <Input.TextArea rows={2} maxlength={120} showCount />
              </Form.Item>
              <Form.Item name="content" label="正文" rules={[{ required: true, message: '请填写正文' }]}>
                <Input.TextArea rows={7} placeholder="建议用【症状】【发病条件】【防治】等小标题分段，便于 AI 引用" />
              </Form.Item>
            </Form>
          </Modal>

          <Drawer open={Boolean(view_detail)} onClose={() => { detail.value = null; }} width={540} title={view_detail?.question ?? ''}>
            {view_detail && (
              <div class="stack">
                <div class="row" style={{ gap: "8px", flexWrap: 'wrap' }}>
                  <Tag class="soft-tag">{view_detail.qaType === 'pest' ? '病虫识别' : '问答'}</Tag>
                  <Tag class="soft-tag tone-green">置信度 {view_detail.confidence}%</Tag>
                  <Tag class="soft-tag">{view_detail.crop}</Tag>
                </div>
                <SectionHeading kicker="ANSWER" title="AI 回答" />
                <p class="small">{view_detail.answer}</p>
                <SectionHeading kicker="SOURCE" title="引用来源" />
                <p class="small muted">{view_detail.sourceRefs || '—'}</p>
                <div class="kv-list">
                  <div class="kv"><span>提问编号</span><b>{view_detail.qaNo}</b></div>
                  <div class="kv"><span>提问人</span><b>{view_detail.askedBy}</b></div>
                  <div class="kv"><span>时间</span><b>{view_detail.createdAt}</b></div>
                </div>
                <Button onClick={() => message.success('已标记为需补充知识条目，将进入运营待办')}>标记为知识缺口</Button>
              </div>
            )}
          </Drawer>
        </div>
      );
    };
  }
});
