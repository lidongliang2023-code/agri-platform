import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Radio, Select, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import { useApp } from '../app-context';
import type { Article, Contents } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount, riskLabel, statusLabel } from '../components/ui';
const STATUS_TABS = [
// 草稿原先没有页签：点一次「退回修改」，这条稿子就从四个页签里全部消失（数据还在库里，只是没人看得见）
{
  key: 'draft',
  label: '草稿'
}, {
  key: 'pending',
  label: '待审核'
}, {
  key: 'published',
  label: '已发布'
}, {
  key: 'rejected',
  label: '未通过'
}, {
  key: 'offline',
  label: '已下架'
}, {
  key: 'all',
  label: '全部'
}];

/** 页签上的数字直接取后端 counts，不在前端再数一遍当前一页 */
const countOf = (counts: Contents['counts'], key: string): number => (counts as unknown as Record<string, number>)[key] ?? 0;

/**
 * 内容审核：按状态/栏目/关键词筛选，支持通过、驳回、退回修改、转专家复核与下架。
 * 驳回与退回必须填处理意见，与后端校验保持一致。
 */
export const ContentsPage = defineComponent({
  name: "ContentsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<Contents | null>(null);
    const setData = (next: Contents | null | ((previous: Contents | null) => Contents | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: Contents | null) => Contents | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const status = ref('pending');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const channel = ref('全部栏目');
    const setChannel = (next: typeof channel.value | ((previous: typeof channel.value) => typeof channel.value)) => {
      channel.value = typeof next === 'function' ? (next as (previous: typeof channel.value) => typeof channel.value)(channel.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const detail = ref<Article | null>(null);
    const setDetail = (next: Article | null | ((previous: Article | null) => Article | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Article | null) => Article | null)(detail.value) : next;
    };
    const auditTarget = ref<Article | null>(null);
    const setAuditTarget = (next: Article | null | ((previous: Article | null) => Article | null)) => {
      auditTarget.value = typeof next === 'function' ? (next as (previous: Article | null) => Article | null)(auditTarget.value) : next;
    };
    const auditForm = useFormModel();
    const submitting = ref(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const createOpen = ref(false);
    const setCreateOpen = (next: typeof createOpen.value | ((previous: typeof createOpen.value) => typeof createOpen.value)) => {
      createOpen.value = typeof next === 'function' ? (next as (previous: typeof createOpen.value) => typeof createOpen.value)(createOpen.value) : next;
    };
    const createForm = useFormModel();
    const load = (overrides: Partial<{
      status: string;
      channel: string;
      keyword: string;
    }> = {}): void => {
      const next = {
        status: status.value,
        channel: channel.value,
        keyword: keyword.value,
        ...overrides
      };
      setStatus(next.status);
      setChannel(next.channel);
      setKeyword(next.keyword);
      setError('');
      opsApi.contents({
        status: next.status === 'all' ? undefined : next.status,
        channel: next.channel === '全部栏目' ? undefined : next.channel,
        keyword: next.keyword || undefined
      }).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openAudit = (article: Article): void => {
      setAuditTarget(article);
      auditForm.resetFields();
      auditForm.setFieldsValue({
        action: article.status === 'draft' || article.status === 'rejected' ? 'submit' : 'approve'
      });
    };
    const submitAudit = (values: {
      action: string;
      note?: string;
    }): void => {
      if (!auditTarget.value) return;
      setSubmitting(true);
      opsApi.auditContent(auditTarget.value.id, values).then(result => {
        message.success(result.message);
        setAuditTarget(null);
        auditForm.resetFields();
        load();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSubmitting(false));
    };
    const columns = computed<ColumnsType<Article>>(() => [{
      title: '内容',
      dataIndex: 'title',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.coverIcon} {record.title}</b>
          <span class="small muted">{record.articleNo} · {record.author} · {record.publishedAt || '待发布'}</span>
        </div>
    }, {
      title: '栏目',
      dataIndex: 'channel',
      width: 100
    }, {
      title: '形态',
      dataIndex: 'contentType',
      width: 80
    }, {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => {
        const risk = riskLabel(value);
        return <Tag class={`soft-tag tone-${risk.tone}`}>{risk.label}</Tag>;
      }
    }, {
      title: '阅读',
      dataIndex: 'readCount',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => formatCount(value)
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
      width: 190,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="row" style={{
        gap: "6px"
      }}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" type="primary" onClick={() => openAudit(record)}>审核</Button>
          {record.status === 'published' && <Button size="small" danger onClick={() => {
          Modal.confirm({
            title: '确认下架该内容？',
            content: '下架后用户端立即不可见，需填写下架原因。',
            onOk: () => opsApi.offlineContent(record.id, {
              note: '运营人工下架'
            }).then(result => {
              message.success(result.message);
              load();
            }).catch((reason: Error) => message.error(reason.message))
          });
        }}>
              下架
            </Button>}
        </div>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      const view_status = status.value;
      const view_channel = channel.value;
      const view_keyword = keyword.value;
      const view_columns = columns.value;
      const view_detail = detail.value;
      const view_auditTarget = auditTarget.value;
      const view_submitting = submitting.value;
      const view_createOpen = createOpen.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load()} />;
      return <div class="page-stack">
      <PageTitle eyebrow="CONTENT REVIEW" title="内容审核" description="机器预审 + 人工复核双闸门 · 高风险内容必须人工通过 · 审核结论与操作人全部留痕" actions={<>
            <Button onClick={() => view_navigate('channels')}>栏目与作者</Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>＋ 新建内容</Button>
          </>} />

      <div class="grid-4">
        <StatTile label="内容总量" value={view_data.counts.all} unit="篇" note="全栏目合计" />
        <StatTile label="待审核" value={view_data.counts.pending} unit="篇" note="承诺 2 小时内处理" tone="warn" />
        <StatTile label="已发布" value={view_data.counts.published} unit="篇" note="用户端可见" tone="up" />
        <StatTile label="未通过 / 已下架" value={`${view_data.counts.rejected} / ${view_data.counts.offline}`} unit="篇" note="保留审计轨迹" />
      </div>

      <section class="surface-card">
        <div class="row between" style={{
            marginBottom: "12px",
            flexWrap: 'wrap',
            gap: "10px"
          }}>
          <div class="chip-row">
            {STATUS_TABS.map(tab => <button type="button" key={tab.key} class={`chip${view_status === tab.key ? ' on' : ''}`} onClick={() => load({
                status: tab.key
              })}>
                {tab.label} {countOf(view_data.counts, tab.key)}
              </button>)}
          </div>
          <div class="row" style={{
              gap: "10px"
            }}>
            <select class="chip" value={view_channel} onInput={event => load({
                channel: (event.target as HTMLInputElement).value
              })}>
              {['全部栏目', ...view_data.channels].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input.Search allowClear style={{
                width: "220px"
              }} placeholder="搜索标题 / 作者" defaultValue={view_keyword} onSearch={(value = "") => load({
                keyword: value.trim()
              })} />
          </div>
        </div>

        <Table rowKey="id" size="middle" columns={view_columns} dataSource={view_data.items} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} locale={{
            emptyText: <EmptyState icon="📄" title="没有符合条件的内容" description="切换状态或清空筛选条件试试。" />
          }} />
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={620} title={view_detail?.title ?? ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
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
            <Button type="primary" onClick={() => {
              setDetail(null);
              openAudit(view_detail);
            }}>审核该内容</Button>
          </div>}
      </Drawer>

      <Modal open={Boolean(view_auditTarget)} title={`审核：${view_auditTarget?.title ?? ''}`} onCancel={() => setAuditTarget(null)} onOk={() => auditForm.submit()} okText="提交结论" confirmLoading={view_submitting}>
        <Form form={auditForm} layout="vertical" onFinish={submitAudit} initialValues={{
            action: 'approve'
          }}>
          <p class="source-note">
            当前状态：<b>{statusLabel(view_auditTarget?.status ?? '') || '未知'}</b>。
            能不能上线由服务端按状态流转判定，不合法的结论会被拒绝并说明原因（编辑内容不会改变状态）。
          </p>
          <Form.Item name="action" label="审核结论" rules={[{
              required: true
            }]}>
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

      <Modal open={view_createOpen} title="新建内容" width={620} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText="保存">
        <Form form={createForm} layout="vertical" initialValues={{
            contentType: '图文',
            status: 'pending'
          }} onFinish={(values: Record<string, any>) => {
            opsApi.saveContent({
              ...values,
              tags: values.tags ?? ''
            }).then(result => {
              message.success(result.message);
              setCreateOpen(false);
              createForm.resetFields();
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <Form.Item name="title" label="标题" rules={[{
              required: true,
              message: '请填写标题'
            }]}>
            <Input placeholder="例：大蒜价格周度分析" />
          </Form.Item>
          <div class="form-grid">
            <Form.Item name="channel" label="所属栏目" rules={[{
                required: true,
                message: '请选择栏目'
              }]}>
              <Select options={view_data.channels.map(item => ({
                  value: item,
                  label: item
                }))} />
            </Form.Item>
            <Form.Item name="contentType" label="内容形态" rules={[{
                required: true
              }]}>
              <Select options={['图文', '短视频', '直播', '专题'].map(item => ({
                  value: item,
                  label: item
                }))} />
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
          {/*
            新建只能落在这两档：后端会拒掉其它 status（原先传 published 就能跳过审核直接上线）。
            没有这个控件时运营员只能全部送审，「退回修改」改完也没法先存草稿。
           */}
          <Form.Item name="status" label="保存方式" rules={[{
              required: true
            }]}>
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
    </div>;
    };
  }
});
