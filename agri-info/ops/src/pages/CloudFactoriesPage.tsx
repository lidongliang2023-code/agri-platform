import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { FactoryReportEditor } from './FactoryReportEditor';
import { App, Alert, Button, Form, Input, Modal, Select, Space, Tabs, Tag, Typography } from "../components/vue-ui";
import { cloudFactoryRequest as request } from '../api';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { PageTitle } from '../components/ui';

type Factory = {
  id: number;
  name: string;
  enterprise: string;
  region: string;
  category: string;
  description: string;
  baseRef: string;
  productKeyword: string;
  traceCode: string;
  status: string;
  media: Media[];
};
type Media = {
  title: string;
  kind: string;
  url: string;
  capturedAt: string;
  description: string;
};
type Visit = {
  id: number;
  factoryName: string;
  contact: string;
  phone: string;
  purpose: string;
  requestedAt: string;
  status: string;
  note: string;
};

const states: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  offline: '已下线',
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  rejected: '未通过',
  cancelled: '已取消'
};
const categories = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '预制菜', '冷链物流'];

export const CloudFactoriesPage = defineComponent({
  name: "CloudFactoriesPage",
  props: {},
  setup() {
    const { message, modal } = App.useApp();
    const rows = ref<Factory[]>([]);
    const visits = ref<Visit[]>([]);
    const busy = ref(false);
    const editing = ref<Factory | Partial<Factory> | null>(null);
    const handling = ref<Visit | null>(null);
    const reportVisit = ref<Visit | null>(null);
    const factoryDraft = ref('');
    const factoryKeyword = ref('');
    const factoryStatus = ref('');
    const visitDraft = ref('');
    const visitKeyword = ref('');
    const visitStatus = ref('');
    const form = useFormModel();
    const handleForm = useFormModel();

    const report = (e: unknown): void => {
      void message.error((e as Error).message);
    };

    async function load(): Promise<void> {
      busy.value = true;
      try {
        const [a, b] = await Promise.all([request<Factory[]>('/cloud-factories'), request<Visit[]>('/cloud-factory-visits')]);
        rows.value = a;
        visits.value = b;
      } catch (e) {
        report(e);
      } finally {
        busy.value = false;
      }
    }

    onMounted(() => { void load(); });

    const filteredFactories = computed(() => {
      const q = factoryKeyword.value.trim().toLowerCase();
      return rows.value.filter(r => {
        if (factoryStatus.value && r.status !== factoryStatus.value) return false;
        if (!q) return true;
        return `${r.name} ${r.enterprise} ${r.region} ${r.category}`.toLowerCase().includes(q);
      });
    });

    const filteredVisits = computed(() => {
      const q = visitKeyword.value.trim().toLowerCase();
      return visits.value.filter(v => {
        if (visitStatus.value && v.status !== visitStatus.value) return false;
        if (!q) return true;
        return `${v.factoryName} ${v.contact} ${v.phone} ${v.purpose}`.toLowerCase().includes(q);
      });
    });

    async function edit(id?: number): Promise<void> {
      try {
        const d = id ? await request<Factory>(`/cloud-factories/${id}`) : { media: [] };
        editing.value = d;
        form.setFieldsValue(d);
      } catch (e) {
        report(e);
      }
    }

    async function save(): Promise<void> {
      try {
        const b = await form.validateFields();
        busy.value = true;
        await request(
          editing.value?.id ? `/cloud-factories/${editing.value.id}` : '/cloud-factories',
          { ...b, media: b.media || [] },
          editing.value?.id ? 'PUT' : 'POST',
        );
        editing.value = null;
        form.resetFields();
        void message.success('已保存为草稿，请复核后发布');
        await load();
      } catch (e) {
        report(e);
      } finally {
        busy.value = false;
      }
    }

    function publish(row: Factory, status: string): void {
      modal.confirm({
        title: status === 'published' ? '确认审核发布基地实景？' : '确认下线基地？',
        content: status === 'published'
          ? '请确认素材获得公开展示授权，拍摄时间准确，内容不包含设备密钥、人员隐私或内部经营资料。'
          : '下线后门户不再展示，已有预约仍可处理。',
        onOk: async () => {
          try {
            await request(`/cloud-factories/${row.id}/status`, { status });
            await load();
          } catch (e) {
            report(e);
            throw e;
          }
        }
      });
    }

    async function handle(): Promise<void> {
      if (!handling.value) return;
      try {
        const b = await handleForm.validateFields();
        busy.value = true;
        await request(`/cloud-factory-visits/${handling.value.id}/status`, b);
        handling.value = null;
        handleForm.resetFields();
        await load();
      } catch (e) {
        report(e);
      } finally {
        busy.value = false;
      }
    }

    return () => (
      <div class="page-stack">
        <PageTitle
          eyebrow="VR CLOUD FACTORY"
          title="VR 云工厂"
          description="实景资料审核、在线看货入口与远程验厂预约"
        />

        <Alert
          type="info"
          showIcon
          message="领域边界与素材要求"
          description="基地引用关联生产域标识；物联网管理设备及媒体分发，交易域维护货源，溯源域核验单品码。这里只编排公开资料和验厂服务，不把预约完成标为认证通过。全景采用2:1等距柱状图；外部素材需允许跨域读取；视频/直播须提供浏览器可播放且不含密钥的媒体地址。"
        />

        <Tabs
          items={[
            {
              key: 'factories',
              label: '基地展示',
              children: (
                <InfoList
                  listId="cloud-factories"
                  rowKey="id"
                  loading={busy.value}
                  dataSource={filteredFactories.value}
                  onRefresh={() => { void load(); }}
                  filterSlot={
                    <InfoFilters
                      loading={busy.value}
                      fields={[
                        {
                          label: '关键字',
                          control: (
                            <Input
                              allowClear
                              value={factoryDraft.value}
                              placeholder="搜索基地 / 企业 / 地区 / 产业"
                              onChange={(e: any) => { factoryDraft.value = e.target?.value ?? ''; }}
                              onPressEnter={() => { factoryKeyword.value = factoryDraft.value.trim(); }}
                            />
                          ),
                        },
                        {
                          label: '发布状态',
                          control: (
                            <Select
                              value={factoryStatus.value}
                              options={[
                                { value: '', label: '全部状态' },
                                { value: 'draft', label: '草稿' },
                                { value: 'published', label: '已发布' },
                                { value: 'offline', label: '已下线' },
                              ]}
                              onChange={v => { factoryStatus.value = String(v ?? ''); }}
                            />
                          ),
                        },
                      ]}
                      onQuery={() => { factoryKeyword.value = factoryDraft.value.trim(); }}
                      onReset={() => { factoryDraft.value = ''; factoryKeyword.value = ''; factoryStatus.value = ''; }}
                    />
                  }
                  toolbarLeft={<Button type="primary" onClick={() => { void edit(); }}>＋ 新增基地展示</Button>}
                  columns={[
                    { title: '基地', dataIndex: 'name', width: 200 },
                    { title: '企业', dataIndex: 'enterprise', width: 200 },
                    { title: '地区', dataIndex: 'region', width: 140 },
                    { title: '产业', dataIndex: 'category', width: 120 },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: s => <Tag color={s === 'published' ? 'green' : 'default'}>{states[s] || s}</Tag>
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 140,
                      fixed: 'right',
                      render: (_, r: Factory) => (
                        <InfoRowActions
                          actions={[
                            { key: 'edit', label: '编辑', onClick: () => { void edit(r.id); } },
                            {
                              key: 'publish',
                              label: r.status === 'published' ? '下线' : '审核发布',
                              danger: r.status === 'published',
                              onClick: () => publish(r, r.status === 'published' ? 'offline' : 'published'),
                            },
                          ]}
                        />
                      )
                    }
                  ]}
                />
              )
            },
            {
              key: 'visits',
              label: `验厂预约（待确认 ${visits.value.filter(v => v.status === 'pending').length}）`,
              children: (
                <InfoList
                  listId="cloud-factory-visits"
                  rowKey="id"
                  dataSource={filteredVisits.value}
                  loading={busy.value}
                  onRefresh={() => { void load(); }}
                  filterSlot={
                    <InfoFilters
                      loading={busy.value}
                      fields={[
                        {
                          label: '关键字',
                          control: (
                            <Input
                              allowClear
                              value={visitDraft.value}
                              placeholder="搜索基地 / 联系人 / 电话 / 需求"
                              onChange={(e: any) => { visitDraft.value = e.target?.value ?? ''; }}
                              onPressEnter={() => { visitKeyword.value = visitDraft.value.trim(); }}
                            />
                          ),
                        },
                        {
                          label: '预约状态',
                          control: (
                            <Select
                              value={visitStatus.value}
                              options={[
                                { value: '', label: '全部状态' },
                                { value: 'pending', label: '待确认' },
                                { value: 'confirmed', label: '已确认' },
                                { value: 'completed', label: '已完成' },
                                { value: 'rejected', label: '未通过' },
                                { value: 'cancelled', label: '已取消' },
                              ]}
                              onChange={v => { visitStatus.value = String(v ?? ''); }}
                            />
                          ),
                        },
                      ]}
                      onQuery={() => { visitKeyword.value = visitDraft.value.trim(); }}
                      onReset={() => { visitDraft.value = ''; visitKeyword.value = ''; visitStatus.value = ''; }}
                    />
                  }
                  columns={[
                    { title: '基地', dataIndex: 'factoryName', width: 170 },
                    { title: '联系人', dataIndex: 'contact', width: 110 },
                    { title: '联系电话', dataIndex: 'phone', width: 130 },
                    { title: '预约时间（北京时间）', dataIndex: 'requestedAt', width: 170 },
                    { title: '核验需求', dataIndex: 'purpose', width: 180, ellipsis: true },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: s => <Tag class="soft-tag">{states[s] || s}</Tag>
                    },
                    { title: '处理说明', dataIndex: 'note', width: 180, ellipsis: true },
                    {
                      title: '操作',
                      key: 'action',
                      width: 150,
                      fixed: 'right',
                      render: (_, r: Visit) => (
                        <InfoRowActions
                          actions={[
                            {
                              key: 'handle',
                              label: '处理预约',
                              disabled: !['pending', 'confirmed'].includes(r.status),
                              onClick: () => {
                                handling.value = r;
                                handleForm.resetFields();
                              },
                            },
                            {
                              key: 'report',
                              label: '验厂报告',
                              disabled: !['confirmed', 'completed'].includes(r.status),
                              onClick: () => { reportVisit.value = r; },
                            },
                          ]}
                        />
                      )
                    }
                  ]}
                />
              )
            }
          ]}
        />

        {reportVisit.value && <FactoryReportEditor visit={reportVisit.value} onClose={() => { reportVisit.value = null; }} />}

        <Modal
          width={850}
          title={editing.value?.id ? '编辑基地展示（保存后重新审核）' : '新增基地展示'}
          open={editing.value !== null}
          destroyOnClose
          onCancel={() => {
            editing.value = null;
            form.resetFields();
          }}
          onOk={() => { void save(); }}
          confirmLoading={busy.value}
        >
          <Form form={form} layout="vertical">
            {[['name', '基地名称', 120], ['enterprise', '所属企业', 120], ['region', '地区', 120]].map(([key, label, max]) => (
              <Form.Item key={key} name={key} label={label} rules={[{ required: true, message: '请填写' }]}>
                <Input maxlength={Number(max)} />
              </Form.Item>
            ))}
            <Form.Item name="category" label="产业分类" rules={[{ required: true }]}>
              <Select options={categories.map(value => ({ value, label: value }))} />
            </Form.Item>
            <Form.Item name="description" label="公开基地介绍" rules={[{ required: true }]}>
              <Input.TextArea maxlength={2000} rows={3} showCount />
            </Form.Item>
            <Form.Item name="baseRef" label="生产域基地标识（引用，不代表已自动绑定）"><Input maxlength={100} /></Form.Item>
            <Form.Item name="productKeyword" label="关联货源搜索关键词（不是库存承诺）"><Input maxlength={80} /></Form.Item>
            <Form.Item name="traceCode" label="关联公开溯源码（由溯源页独立核验）"><Input maxlength={100} /></Form.Item>
            <Typography.Title level={5}>已授权实景素材</Typography.Title>
            <Form.List name="media">
              {(fields: Array<{ key: number; name: number }>, { add, remove }: { add: (v?: Record<string, unknown>) => void; remove: (index: number) => void }) => (
                <>
                  {fields.map(field => (
                    <div key={field.key} style={{ border: '1px solid #e1e9e3', padding: "16px", marginBottom: "16px", borderRadius: "10px" }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <strong>素材 {field.name + 1}</strong>
                        <Button danger type="link" onClick={() => remove(field.name)}>移除本条</Button>
                      </Space>
                      <Form.Item name={[field.name, 'title']} label="素材标题" rules={[{ required: true }]}>
                        <Input maxlength={120} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'kind']} label="素材类型" rules={[{ required: true }]}>
                        <Select options={[
                          { value: 'panorama', label: '360° 全景图（2:1）' },
                          { value: 'image', label: '实景照片' },
                          { value: 'video', label: '实景录像' },
                          { value: 'live', label: '直播媒体信号' }
                        ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'url']} label="平台资源路径 / HTTPS 媒体地址（不含密钥和查询参数）" rules={[{ required: true }]}>
                        <Input maxlength={1500} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'capturedAt']} label="拍摄时间 / 直播配置时间（北京时间，YYYY-MM-DD HH:mm:ss）" rules={[{ required: true }]}>
                        <Input maxlength={40} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'description']} label="场景说明 / 素材授权说明">
                        <Input.TextArea maxlength={300} />
                      </Form.Item>
                    </div>
                  ))}
                  <Button disabled={fields.length >= 20} onClick={() => add({ kind: 'panorama' })}>
                    添加实景素材（最多20项）
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        </Modal>

        <Modal
          title={`处理验厂预约 · ${handling.value?.factoryName || ''}`}
          open={handling.value !== null}
          onCancel={() => { handling.value = null; }}
          onOk={() => { void handle(); }}
          confirmLoading={busy.value}
          destroyOnClose
        >
          <p>{handling.value?.purpose}</p>
          <Form form={handleForm} layout="vertical">
            <Form.Item name="status" label="处理结果" rules={[{ required: true }]}>
              <Select
                options={(handling.value?.status === 'pending' ? ['confirmed', 'rejected'] : ['completed', 'cancelled']).map(value => ({
                  value,
                  label: states[value]
                }))}
              />
            </Form.Item>
            <Form.Item name="note" label="用户可见的安排 / 材料核验结果与处理说明" rules={[{ required: true, whitespace: true }]}>
              <Input.TextArea rows={5} maxlength={1000} showCount />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
});
