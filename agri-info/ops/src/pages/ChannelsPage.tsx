import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { Author, Channel } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount } from '../components/ui';
const AUTHOR_TYPES: Record<string, string> = {
  official: '官方',
  expert: '专家',
  media: '媒体',
  enterprise: '企业',
  user: '用户'
};

/** 栏目与作者：栏目决定用户端资讯频道分组，作者决定内容可信度标识。 */
export const ChannelsPage = defineComponent({
  name: "ChannelsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<{
      channels: Channel[];
      authors: Author[];
    } | null>(null);
    const setData = (next: {
      channels: Channel[];
      authors: Author[];
    } | null | ((previous: {
      channels: Channel[];
      authors: Author[];
    } | null) => {
      channels: Channel[];
      authors: Author[];
    } | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: {
        channels: Channel[];
        authors: Author[];
      } | null) => {
        channels: Channel[];
        authors: Author[];
      } | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const channelOpen = ref(false);
    const setChannelOpen = (next: typeof channelOpen.value | ((previous: typeof channelOpen.value) => typeof channelOpen.value)) => {
      channelOpen.value = typeof next === 'function' ? (next as (previous: typeof channelOpen.value) => typeof channelOpen.value)(channelOpen.value) : next;
    };
    const editing = ref<Channel | null>(null);
    const setEditing = (next: Channel | null | ((previous: Channel | null) => Channel | null)) => {
      editing.value = typeof next === 'function' ? (next as (previous: Channel | null) => Channel | null)(editing.value) : next;
    };
    const form = useFormModel();
    const load = (): void => {
      setError('');
      opsApi.channels().then(setData).catch((reason: Error) => setError(reason.message));
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
    const openChannel = (channel?: Channel): void => {
      setEditing(channel ?? null);
      form.setFieldsValue(channel ? {
        name: channel.name,
        icon: channel.icon,
        description: channel.description,
        status: channel.status
      } : {
        name: '',
        icon: '📰',
        description: '',
        status: 'enabled'
      });
      setChannelOpen(true);
    };
    const channelColumns = computed<ColumnsType<Channel>>(() => [{
      title: '栏目',
      dataIndex: 'name',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.icon} {record.name}</b>
          <span class="small muted">{record.code}</span>
        </div>
    }, {
      title: '说明',
      dataIndex: 'description'
    }, {
      title: '内容量',
      dataIndex: 'articleCount',
      width: 100,
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
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" onClick={() => openChannel(record)}>编辑</Button>
    }]);
    const authorColumns = computed<ColumnsType<Author>>(() => [{
      title: '作者',
      dataIndex: 'name',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="row" style={{
        gap: "8px"
      }}>
          <span class="expert-avatar">{record.avatarText || record.name.slice(0, 1)}</span>
          <div class="table-title-cell">
            <b>{record.name}</b>
            <span class="small muted">{record.title} · {record.orgName}</span>
          </div>
        </div>
    }, {
      title: '类型',
      dataIndex: 'authorType',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class="soft-tag">{AUTHOR_TYPES[value] ?? value}</Tag>
    }, {
      title: '发文',
      dataIndex: 'articleCount',
      width: 80
    }, {
      title: '关注',
      dataIndex: 'followers',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => formatCount(value)
    }, {
      title: '认证',
      dataIndex: 'verified',
      width: 100,
      customRender: ({
        text: value,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Switch size="small" checked={value} checkedChildren="已认证" unCheckedChildren="未认证" onChange={checked => opsApi.updateAuthor(record.id, {
        verified: checked
      }).then(result => {
        message.success(result.message);
        setData(previous => previous ? {
          ...previous,
          authors: result.authors as Author[]
        } : previous);
      }).catch((reason: Error) => message.error(reason.message))} />
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_channelColumns = channelColumns.value;
      const view_authorColumns = authorColumns.value;
      const view_channelOpen = channelOpen.value;
      const view_editing = editing.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="CHANNELS & AUTHORS" title="栏目与作者" description="栏目决定资讯频道结构与推荐位归属；作者认证标识直接影响用户端内容可信度展示" actions={<Button type="primary" onClick={() => openChannel()}>＋ 新建栏目</Button>} />

      <div class="grid-4">
        <StatTile label="栏目数" value={view_data.channels.length} unit="个" note={`启用 ${view_data.channels.filter(item => item.status === 'enabled').length} 个`} />
        <StatTile label="栏目内容量" value={formatCount(view_data.channels.reduce((sum, item) => sum + item.articleCount, 0))} unit="篇" note="全栏目合计" tone="up" />
        <StatTile label="作者数" value={view_data.authors.length} unit="位" note={`已认证 ${view_data.authors.filter(item => item.verified).length} 位`} />
        <StatTile label="作者关注量" value={formatCount(view_data.authors.reduce((sum, item) => sum + item.followers, 0))} unit="人" note="累计关注" />
      </div>

      <section class="surface-card">
        <SectionHeading kicker="CHANNELS" title="栏目管理" />
        <Table rowKey="id" size="middle" columns={view_channelColumns} dataSource={view_data.channels} pagination={false} />
      </section>

      <section class="surface-card">
        <SectionHeading kicker="AUTHORS" title="作者管理" />
        <Table rowKey="id" size="middle" columns={view_authorColumns} dataSource={view_data.authors} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <Modal open={view_channelOpen} title={view_editing ? '编辑栏目' : '新建栏目'} onCancel={() => setChannelOpen(false)} onOk={() => form.submit()} okText="保存">
        <Form form={form} layout="vertical" onFinish={(values: Record<string, any>) => {
            opsApi.saveChannel({
              ...values,
              id: view_editing?.id
            }).then(result => {
              message.success(result.message);
              setChannelOpen(false);
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <div class="form-grid">
            <Form.Item name="name" label="栏目名称" rules={[{
                required: true,
                message: '请填写栏目名称'
              }]}>
              <Input placeholder="例：市场动态" />
            </Form.Item>
            <Form.Item name="icon" label="图标（emoji）" rules={[{
                required: true
              }]}>
              <Input placeholder="例：📈" />
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
            <Form.Item name="sortNo" label="排序号">
              <InputNumber style={{
                  width: '100%'
                }} min={1} max={99} placeholder="数字越小越靠前" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="栏目说明">
            <Input.TextArea rows={3} maxlength={80} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
