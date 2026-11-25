import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Select, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { AiAdmin, Knowledge, QaRecord } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/**
 * AI 知识库：AI 问答的答案完全来自这里的条目，因此内容质量直接决定问答可用性。
 * 编辑后立即影响检索结果，无需重启服务。
 */
export const AiPage = defineComponent({
  name: "AiPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<AiAdmin | null>(null);
    const setData = (next: AiAdmin | null | ((previous: AiAdmin | null) => AiAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: AiAdmin | null) => AiAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const editing = ref<Knowledge | null>(null);
    const setEditing = (next: Knowledge | null | ((previous: Knowledge | null) => Knowledge | null)) => {
      editing.value = typeof next === 'function' ? (next as (previous: Knowledge | null) => Knowledge | null)(editing.value) : next;
    };
    const editorOpen = ref(false);
    const setEditorOpen = (next: typeof editorOpen.value | ((previous: typeof editorOpen.value) => typeof editorOpen.value)) => {
      editorOpen.value = typeof next === 'function' ? (next as (previous: typeof editorOpen.value) => typeof editorOpen.value)(editorOpen.value) : next;
    };
    const detail = ref<QaRecord | null>(null);
    const setDetail = (next: QaRecord | null | ((previous: QaRecord | null) => QaRecord | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: QaRecord | null) => QaRecord | null)(detail.value) : next;
    };
    const form = useFormModel();
    const load = (nextKeyword = keyword.value): void => {
      setKeyword(nextKeyword);
      setError('');
      opsApi.ai(nextKeyword || undefined).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load('');
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openEditor = (item?: Knowledge): void => {
      setEditing(item ?? null);
      form.setFieldsValue(item ? {
        title: item.title,
        category: item.category,
        crop: item.crop,
        summary: item.summary,
        content: item.content,
        tags: item.tags.join(','),
        sourceName: item.sourceName
      } : {
        category: '病虫害防治',
        crop: '通用',
        sourceName: '平台运营'
      });
      setEditorOpen(true);
    };
    const knowledgeColumns = computed<ColumnsType<Knowledge>>(() => [{
      title: '知识条目',
      dataIndex: 'title',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.category} · {record.crop} · {record.sourceName}</span>
        </div>
    }, {
      title: '标签',
      dataIndex: 'tags',
      width: 220,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => value.slice(0, 3).map((tag: string) => <Tag class="soft-tag" key={tag}>{tag}</Tag>)
    }, {
      title: '阅读',
      dataIndex: 'viewCount',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => formatCount(value)
    }, {
      title: '更新',
      dataIndex: 'updatedAt',
      width: 120
    }, {
      title: '操作',
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" onClick={() => openEditor(record)}>编辑</Button>
    }]);
    const qaColumns = computed<ColumnsType<QaRecord>>(() => [{
      title: '问题',
      dataIndex: 'question',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.question}</b>
          <span class="small muted">{record.qaNo} · {record.askedBy} · {record.createdAt}</span>
        </div>
    }, {
      title: '类型',
      dataIndex: 'qaType',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class="soft-tag">{value === 'pest' ? '病虫识别' : '问答'}</Tag>
    }, {
      title: '作物',
      dataIndex: 'crop',
      width: 90
    }, {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class={`soft-tag tone-${value >= 90 ? 'green' : value >= 80 ? 'amber' : 'up'}`}>{value}%</Tag>
    }, {
      title: '操作',
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" onClick={() => setDetail(record)}>查看</Button>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_keyword = keyword.value;
      const view_knowledgeColumns = knowledgeColumns.value;
      const view_qaColumns = qaColumns.value;
      const view_editorOpen = editorOpen.value;
      const view_editing = editing.value;
      const view_detail = detail.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load()} />;
      return <div class="page-stack">
      <PageTitle eyebrow="AI KNOWLEDGE BASE" title="AI 知识库" description="AI 问答与病虫识别的答案来源 · 条目需标注作物与分类，检索按二元组重叠度 + 作物命中加权" actions={<Button type="primary" onClick={() => openEditor()}>＋ 新增知识条目</Button>} />

      <div class="grid-4">
        <StatTile label="知识条目" value={view_data.stats.knowledgeCount} unit="条" note="全部已发布" tone="up" />
        <StatTile label="问答记录" value={formatCount(view_data.stats.qaCount)} unit="次" note="含病虫识别" />
        <StatTile label="平均置信度" value={view_data.stats.avgConfidence} unit="%" note="低于 80% 建议转人工" tone="warn" />
        <StatTile label="敏感词" value={view_data.stats.sensitiveCount} unit="条" note="与内容审核共用词库" />
      </div>

      <section class="surface-card">
        <div class="row between" style={{
            marginBottom: "12px"
          }}>
          <SectionHeading kicker="KNOWLEDGE" title="知识条目" />
          <Input.Search allowClear style={{
              width: "240px"
            }} placeholder="搜索标题 / 标签" defaultValue={view_keyword} onSearch={(value = "") => load(value.trim())} />
        </div>
        <Table rowKey="id" size="middle" columns={view_knowledgeColumns} dataSource={view_data.knowledge} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <section class="surface-card">
        <SectionHeading kicker="Q&A LOGS" title="问答记录" />
        <Table rowKey="id" size="middle" columns={view_qaColumns} dataSource={view_data.qaPairs} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <Modal open={view_editorOpen} title={view_editing ? '编辑知识条目' : '新增知识条目'} width={640} onCancel={() => setEditorOpen(false)} onOk={() => form.submit()} okText="保存">
        <Form form={form} layout="vertical" onFinish={(values: Record<string, any>) => {
            opsApi.saveKnowledge({
              ...values,
              id: view_editing?.id
            }).then(result => {
              message.success(result.message);
              setEditorOpen(false);
              form.resetFields();
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <Form.Item name="title" label="标题" rules={[{
              required: true,
              message: '请填写标题'
            }]}>
            <Input placeholder="例：大蒜叶枯病识别与防治" />
          </Form.Item>
          <div class="form-grid">
            <Form.Item name="category" label="分类" rules={[{
                required: true
              }]}>
              <Select options={['病虫害防治', '营养管理', '采后处理', '栽培技术', '政策解读'].map(item => ({
                  value: item,
                  label: item
                }))} />
            </Form.Item>
            <Form.Item name="crop" label="作物" rules={[{
                required: true
              }]}>
              <Input placeholder="例：大蒜 / 通用" />
            </Form.Item>
            <Form.Item name="sourceName" label="来源单位">
              <Input placeholder="例：省农科院蔬菜研究所" />
            </Form.Item>
            <Form.Item name="tags" label="标签（逗号分隔）">
              <Input placeholder="例：大蒜,叶枯病,真菌病害" />
            </Form.Item>
          </div>
          <Form.Item name="summary" label="摘要" rules={[{
              required: true,
              message: '请填写摘要'
            }]}>
            <Input.TextArea rows={2} maxlength={120} showCount />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{
              required: true,
              message: '请填写正文'
            }]}>
            <Input.TextArea rows={7} placeholder="建议用【症状】【发病条件】【防治】等小标题分段，便于 AI 引用" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={540} title={view_detail?.question ?? ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
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
          </div>}
      </Drawer>
    </div>;
    };
  }
});
