import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Radio, Select, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import { useApp } from '../app-context';
import type { Article, Contents } from '../types';
import { InfoFilters, InfoList, InfoRowActions, type InfoRowActionItem } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount, riskLabel, statusLabel } from '../components/ui';

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '未通过' },
  { value: 'offline', label: '已下架' },
  { value: 'all', label: '全部状态' },
];

const countOf = (counts: Contents['counts'], key: string): number =>
  (counts as unknown as Record<string, number>)[key] ?? 0;

/**
 * 内容审核：按状态/栏目/关键词筛选，支持通过、驳回、退回修改、转专家复核与下架。
 * 驳回与退回必须填处理意见，与后端校验保持一致。
 */
export const ContentsPage = defineComponent({
  name: "ContentsPage",
  props: {},
  setup() {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<Contents | null>(null);
    const loading = ref(false);
    const error = ref('');
    const status = ref('pending');
    const channel = ref('全部栏目');
    const draft = ref('');
    const keyword = ref('');
    const detail = ref<Article | null>(null);
    const auditTarget = ref<Article | null>(null);
    const auditForm = useFormModel();
    const submitting = ref(false);
    const createOpen = ref(false);
    const createForm = useFormModel();

    const load = (overrides: Partial<{ status: string; channel: string; keyword: string }> = {}): void => {
      const nextStatus = overrides.status ?? status.value;
      const nextChannel = overrides.channel ?? channel.value;
      const nextKeyword = overrides.keyword ?? keyword.value;
      status.value = nextStatus;
      channel.value = nextChannel;
      keyword.value = nextKeyword;
      loading.value = true;
      error.value = '';
      opsApi.contents({
        status: nextStatus === 'all' ? undefined : nextStatus,
        channel: nextChannel === '全部栏目' ? undefined : nextChannel,
        keyword: nextKeyword || undefined
      })
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(() => load());

    const openAudit = (article: Article): void => {
      auditTarget.value = article;
      auditForm.resetFields();
      auditForm.setFieldsValue({
        action: article.status === 'draft' || article.status === 'rejected' ? 'submit' : 'approve'
      });
    };

    const submitAudit = (values: { action: string; note?: string }): void => {
      if (!auditTarget.value) return;
      submitting.value = true;
      opsApi.auditContent(auditTarget.value.id, values)
        .then(result => {
          message.success(result.message);
          auditTarget.value = null;
          auditForm.resetFields();
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { submitting.value = false; });
    };

    const rowActions = (record: Article): InfoRowActionItem[] => {
      const list: InfoRowActionItem[] = [
        { key: 'detail', label: '详情', onClick: () => { detail.value = record; } },
        { key: 'audit', label: '审核', onClick: () => openAudit(record) },
      ];
      if (record.status === 'published') {
        list.push({
          key: 'offline',
          label: '下架',
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: '确认下架该内容？',
              content: '下架后用户端立即不可见，需填写下架原因。',
              onOk: () =>
                opsApi.offlineContent(record.id, { note: '运营人工下架' })
                  .then(result => {
                    message.success(result.message);
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message)),
            });
          },
        });
      }
      return list;
    };

    const columns = computed<JsxListColumn[]>(() => [{
      title: '内容',
      dataIndex: 'title',
      width: 290,
      render: (_, record: Article) => (
        <div class="table-title-cell">
          <b>{record.coverIcon} {record.title}</b>
          <span class="small muted">{record.articleNo} · {record.author} · {record.publishedAt || '待发布'}</span>
        </div>
      )
    }, {
      title: '栏目',
      dataIndex: 'channel',
      width: 110
    }, {
      title: '形态',
      dataIndex: 'contentType',
      width: 90
    }, {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 90,
      render: value => {
        const risk = riskLabel(value);
        return <Tag class={`soft-tag tone-${risk.tone}`}>{risk.label}</Tag>;
      }
    }, {
      title: '阅读',
      dataIndex: 'readCount',
      width: 90,
      render: value => formatCount(value)
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record: Article) => <InfoRowActions actions={rowActions(record)} />
    }]);

    return () => {
      const view_data = data.value;
      const view_detail = detail.value;
      const view_auditTarget = auditTarget.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={() => load()} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="CONTENT REVIEW"
            title="内容审核"
            description="机器预审 + 人工复核双闸门 · 高风险内容必须人工通过 · 审核结论与操作人全部留痕"
          />

          <div class="grid-4">
            <StatTile label="内容总量" value={view_data.counts.all} unit="篇" note="全栏目合计" />
            <StatTile label="待审核" value={view_data.counts.pending} unit="篇" note="承诺 2 小时内处理" tone="warn" />
            <StatTile label="已发布" value={view_data.counts.published} unit="篇" note="用户端可见" tone="up" />
            <StatTile label="未通过 / 已下架" value={`${view_data.counts.rejected} / ${view_data.counts.offline}`} unit="篇" note="保留审计轨迹" />
          </div>

          <InfoList
            listId="contents"
            rowKey="id"
            loading={loading.value}
            columns={columns.value}
            dataSource={view_data.items}
            locale={{ emptyText: '没有符合条件的内容，请切换状态或清空筛选条件试试。' }}
            onRefresh={() => load()}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '关键字',
                    control: (
                      <Input
                        allowClear
                        value={draft.value}
                        placeholder="搜索标题 / 作者"
                        onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => load({ keyword: draft.value.trim() })}
                      />
                    ),
                  },
                  {
                    label: '所属栏目',
                    control: (
                      <Select
                        value={channel.value}
                        options={['全部栏目', ...view_data.channels].map(item => ({ value: item, label: item }))}
                        onChange={v => load({ channel: String(v ?? '全部栏目') })}
                      />
                    ),
                  },
                  {
                    label: '审核状态',
                    control: (
                      <Select
                        value={status.value}
                        options={STATUS_OPTIONS.map(opt => ({
                          value: opt.value,
                          label: `${opt.label}（${countOf(view_data.counts, opt.value)}）`,
                        }))}
                        onChange={v => load({ status: String(v ?? 'pending') })}
                      />
                    ),
                  },
                ]}
                onQuery={() => load({ keyword: draft.value.trim() })}
                onReset={() => {
                  draft.value = '';
                  load({ status: 'pending', channel: '全部栏目', keyword: '' });
                }}
              />
            }
            toolbarLeft={
              <>
                <Button type="primary" onClick={() => { createOpen.value = true; }}>＋ 新建内容</Button>
                <Button onClick={() => navigate.value('channels')}>栏目与作者</Button>
              </>
            }
          />

          <Drawer open={Boolean(view_detail)} onClose={() => { detail.value = null; }} width={620} title={view_detail?.title ?? ''}>
            {view_detail && (
              <div class="stack">
                <div class="row" style={{ gap: "8px", flexWrap: 'wrap' }}>
                  <Tag class="soft-tag tone-green">{view_detail.channel}</Tag>
                  <Tag class="soft-tag">{view_detail.contentType}</Tag>
                  <StatusTag status={view_detail.status} />
                  {view_detail.aiGenerated && <Tag class="soft-tag tone-purple">AI 生成</Tag>}
                  {view_detail.isTop && <Tag class="soft-tag tone-amber">置顶</Tag>}
                </div>
                <div class="kv-list">
                  <div class="kv"><span>内容编号</span><b>{view_detail.articleNo}</b></div>
                  <div class="kv"><span>作者</span><b>{view_detail.author}</b></div>
                  <div class="kv"><span>来源</span><b>{view_detail.source}</b></div>
                  <div class="kv"><span>发布时间</span><b>{view_detail.publishedAt || '待发布'}</b></div>
                  <div class="kv"><span>互动数据</span><b>阅读 {formatCount(view_detail.readCount)} · 赞 {view_detail.likeCount} · 评 {view_detail.commentCount}</b></div>
                </div>
                <SectionHeading kicker="SUMMARY" title="摘要" />
                <p class="small">{view_detail.summary}</p>
                {view_detail.riskNote && <p class="source-note">机器预审风险提示：{view_detail.riskNote}</p>}
                {view_detail.auditNote && <p class="source-note">历史审核意见：{view_detail.auditNote}</p>}
                <Button
                  type="primary"
                  onClick={() => {
                    detail.value = null;
                    openAudit(view_detail);
                  }}
                >
                  审核该内容
                </Button>
              </div>
            )}
          </Drawer>

          <Modal
            open={Boolean(view_auditTarget)}
            title={`审核：${view_auditTarget?.title ?? ''}`}
            onCancel={() => { auditTarget.value = null; }}
            onOk={() => auditForm.submit()}
            okText="提交结论"
            confirmLoading={submitting.value}
          >
            <Form form={auditForm} layout="vertical" onFinish={submitAudit} initialValues={{ action: 'approve' }}>
              <p class="source-note">
                当前状态：<b>{statusLabel(view_auditTarget?.status ?? '') || '未知'}</b>。
                能不能上线由服务端按状态流转判定，不合法的结论会被拒绝并说明原因（编辑内容不会改变状态）。
              </p>
              <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio.Button value="submit">提交审核</Radio.Button>
                  <Radio.Button value="approve">通过并发布</Radio.Button>
                  <Radio.Button value="reject">驳回</Radio.Button>
                  <Radio.Button value="revise">退回修改</Radio.Button>
                  <Radio.Button value="expert">转专家复核</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="note" label="处理意见" extra="驳回或退回修改时必须填写具体原因，作者可在用户端看到该意见">
                <Input.TextArea rows={4} maxlength={200} showCount placeholder="例：标题含极限词「最便宜」，请修改后重新提交" />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            open={createOpen.value}
            title="新建内容"
            width={620}
            onCancel={() => { createOpen.value = false; }}
            onOk={() => createForm.submit()}
            okText="保存"
          >
            <Form
              form={createForm}
              layout="vertical"
              initialValues={{ contentType: '图文', status: 'pending' }}
              onFinish={(values: Record<string, any>) => {
                opsApi.saveContent({ ...values, tags: values.tags ?? '' })
                  .then(result => {
                    message.success(result.message);
                    createOpen.value = false;
                    createForm.resetFields();
                    load();
                  })
                  .catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
                <Input placeholder="例：大蒜价格周度分析" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="channel" label="所属栏目" rules={[{ required: true, message: '请选择栏目' }]}>
                  <Select options={view_data.channels.map(item => ({ value: item, label: item }))} />
                </Form.Item>
                <Form.Item name="contentType" label="内容形态" rules={[{ required: true }]}>
                  <Select options={['图文', '短视频', '直播', '专题'].map(item => ({ value: item, label: item }))} />
                </Form.Item>
                <Form.Item name="author" label="作者">
                  <Input placeholder="默认取当前运营账号" />
                </Form.Item>
                <Form.Item name="tags" label="标签（逗号分隔）">
                  <Input placeholder="例：大蒜,行情分析,价格周报" />
                </Form.Item>
              </div>
              <Form.Item name="summary" label="摘要">
                <Input.TextArea rows={2} maxlength={120} showCount />
              </Form.Item>
              <Form.Item name="status" label="保存方式" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio.Button value="pending">提交审核</Radio.Button>
                  <Radio.Button value="draft">存为草稿</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="content" label="正文">
                <Input.TextArea rows={6} placeholder="支持纯文本；正式版接入富文本编辑器" />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
