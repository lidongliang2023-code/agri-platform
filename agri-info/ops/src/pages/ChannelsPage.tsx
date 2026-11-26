import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { Author, Channel } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag, formatCount } from '../components/ui';

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
  setup() {
    const data = ref<{ channels: Channel[]; authors: Author[] } | null>(null);
    const loading = ref(false);
    const error = ref('');
    const channelOpen = ref(false);
    const editing = ref<Channel | null>(null);
    const authorDraft = ref('');
    const authorKeyword = ref('');
    const authorType = ref('');
    const form = useFormModel();

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.channels()
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);

    const openChannel = (channel?: Channel): void => {
      editing.value = channel ?? null;
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
      channelOpen.value = true;
    };

    const filteredAuthors = computed(() => {
      const list = data.value?.authors ?? [];
      const q = authorKeyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (authorType.value && item.authorType !== authorType.value) return false;
        if (!q) return true;
        return `${item.name} ${item.title ?? ''} ${item.orgName ?? ''}`.toLowerCase().includes(q);
      });
    });

    const channelColumns = computed<JsxListColumn[]>(() => [{
      title: '栏目',
      dataIndex: 'name',
      width: 200,
      render: (_, record: Channel) => (
        <div class="table-title-cell">
          <b>{record.icon} {record.name}</b>
          <span class="small muted">{record.code}</span>
        </div>
      )
    }, {
      title: '说明',
      dataIndex: 'description',
      width: 300
    }, {
      title: '内容量',
      dataIndex: 'articleCount',
      width: 100,
      render: value => formatCount(value)
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
      render: (_, record: Channel) => (
        <InfoRowActions actions={[{ key: 'edit', label: '编辑', onClick: () => openChannel(record) }]} />
      )
    }]);

    const authorColumns = computed<JsxListColumn[]>(() => [{
      title: '作者',
      dataIndex: 'name',
      width: 260,
      render: (_, record: Author) => (
        <div class="row" style={{ gap: "8px" }}>
          <span class="expert-avatar">{record.avatarText || record.name.slice(0, 1)}</span>
          <div class="table-title-cell">
            <b>{record.name}</b>
            <span class="small muted">{record.title} · {record.orgName}</span>
          </div>
        </div>
      )
    }, {
      title: '类型',
      dataIndex: 'authorType',
      width: 100,
      render: value => <Tag class="soft-tag">{AUTHOR_TYPES[value] ?? value}</Tag>
    }, {
      title: '发文',
      dataIndex: 'articleCount',
      width: 90
    }, {
      title: '关注',
      dataIndex: 'followers',
      width: 100,
      render: value => formatCount(value)
    }, {
      title: '认证',
      dataIndex: 'verified',
      width: 110,
      render: (value, record: Author) => (
        <Switch
          size="small"
          checked={value}
          checkedChildren="已认证"
          unCheckedChildren="未认证"
          onChange={checked =>
            opsApi.updateAuthor(record.id, { verified: checked }).then(result => {
              message.success(result.message);
              if (data.value) {
                data.value = { ...data.value, authors: result.authors as Author[] };
              }
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
            eyebrow="CHANNELS & AUTHORS"
            title="栏目与作者"
            description="栏目决定资讯频道结构与推荐位归属；作者认证标识直接影响用户端内容可信度展示"
          />

          <div class="grid-4">
            <StatTile label="栏目数" value={view_data.channels.length} unit="个" note={`启用 ${view_data.channels.filter(item => item.status === 'enabled').length} 个`} />
            <StatTile label="栏目内容量" value={formatCount(view_data.channels.reduce((sum, item) => sum + item.articleCount, 0))} unit="篇" note="全栏目合计" tone="up" />
            <StatTile label="作者数" value={view_data.authors.length} unit="位" note={`已认证 ${view_data.authors.filter(item => item.verified).length} 位`} />
            <StatTile label="作者关注量" value={formatCount(view_data.authors.reduce((sum, item) => sum + item.followers, 0))} unit="人" note="累计关注" />
          </div>

          <InfoList
            listId="channels"
            rowKey="id"
            loading={loading.value}
            columns={channelColumns.value}
            dataSource={view_data.channels}
            onRefresh={load}
            toolbarLeft={<Button type="primary" onClick={() => openChannel()}>＋ 新建栏目</Button>}
          />

          <InfoList
            listId="authors"
            rowKey="id"
            loading={loading.value}
            columns={authorColumns.value}
            dataSource={filteredAuthors.value}
            onRefresh={load}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '作者关键字',
                    control: (
                      <Input
                        allowClear
                        value={authorDraft.value}
                        placeholder="搜索作者姓名 / 头衔 / 单位"
                        onChange={(e: any) => { authorDraft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { authorKeyword.value = authorDraft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '作者类型',
                    control: (
                      <Select
                        value={authorType.value}
                        options={[
                          { value: '', label: '全部类型' },
                          ...Object.entries(AUTHOR_TYPES).map(([value, label]) => ({ value, label })),
                        ]}
                        onChange={v => { authorType.value = String(v ?? ''); }}
                      />
                    ),
                  },
                ]}
                onQuery={() => { authorKeyword.value = authorDraft.value.trim(); }}
                onReset={() => { authorDraft.value = ''; authorKeyword.value = ''; authorType.value = ''; }}
              />
            }
            toolbarLeft={<span style={{ fontWeight: 600 }}>作者管理</span>}
          />

          <Modal
            open={channelOpen.value}
            title={editing.value ? '编辑栏目' : '新建栏目'}
            onCancel={() => { channelOpen.value = false; }}
            onOk={() => form.submit()}
            okText="保存"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                opsApi.saveChannel({
                  ...values,
                  id: editing.value?.id
                }).then(result => {
                  message.success(result.message);
                  channelOpen.value = false;
                  load();
                }).catch((reason: Error) => message.error(reason.message));
              }}
            >
              <div class="form-grid">
                <Form.Item name="name" label="栏目名称" rules={[{ required: true, message: '请填写栏目名称' }]}>
                  <Input placeholder="例：市场动态" />
                </Form.Item>
                <Form.Item name="icon" label="图标（emoji）" rules={[{ required: true }]}>
                  <Input placeholder="例：📈" />
                </Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                  <Select options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} />
                </Form.Item>
                <Form.Item name="sortNo" label="排序号">
                  <InputNumber style={{ width: '100%' }} min={1} max={99} placeholder="数字越小越靠前" />
                </Form.Item>
              </div>
              <Form.Item name="description" label="栏目说明">
                <Input.TextArea rows={3} maxlength={80} showCount />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
