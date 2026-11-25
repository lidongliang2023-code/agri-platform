import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { IdcardOutlined } from "@ant-design/icons-vue";
import { Alert, Button, Form, Input, Select, Steps, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Expert } from '../types';
import { EmptyState, PageTitle, SectionHeading } from '../components/ui';
const FIELDS = ['蔬菜栽培', '大蒜栽培', '植保', '土肥水', '设施园艺', '果树', '粮油作物', '畜牧兽医', '电商运营'];
const LEVELS = ['县级专家', '市级专家', '省级专家', '国家级专家'];

/**
 * 专家认证申请：提交后进入运营端「专家审核」队列。
 * 认证材料只做展示性校验，真实资质核验由运营人员在审核环节完成。
 */
export const ExpertCertPage = defineComponent({
  name: "ExpertCertPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const form = useFormModel();
    const records = ref<Expert[]>([]);
    const setRecords = (next: Expert[] | ((previous: Expert[]) => Expert[])) => {
      records.value = typeof next === 'function' ? (next as (previous: Expert[]) => Expert[])(records.value) : next;
    };
    const submitting = ref(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const load = (): void => {
      infoApi.myExpert().then(setRecords).catch(() => setRecords([]));
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
    const submit = (values: Record<string, string>): void => {
      setSubmitting(true);
      infoApi.applyExpert(values).then(result => {
        setRecords(result.records);
        form.resetFields();
        message.success(result.message);
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSubmitting(false));
    };
    const latest = computed(() => records.value[0]);
    return () => {
      const view_navigate = navigate.value;
      const view_submitting = submitting.value;
      const view_latest = latest.value;
      const view_records = records.value;
      return <div class="page-stack">
      <PageTitle eyebrow="EXPERT CERTIFICATION" title="申请成为平台专家" description="提交资质信息后由平台运营审核（3 个工作日内）· 通过后可在专家服务页接单答疑并展示认证编号" actions={<Button onClick={() => view_navigate('expert')}>返回专家服务</Button>} />

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="APPLICATION" title="填写认证信息" />
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{
              level: '市级专家',
              field: '蔬菜栽培'
            }}>
            <div class="form-grid">
              <Form.Item name="name" label="真实姓名" rules={[{
                  required: true,
                  message: '请填写姓名'
                }]}>
                <Input placeholder="例：王新民" />
              </Form.Item>
              <Form.Item name="title" label="职称" rules={[{
                  required: true,
                  message: '请填写职称'
                }]}>
                <Input placeholder="例：高级农艺师 / 推广研究员" />
              </Form.Item>
              <Form.Item name="orgName" label="所在单位" rules={[{
                  required: true,
                  message: '请填写单位'
                }]}>
                <Input placeholder="例：省农科院蔬菜研究所" />
              </Form.Item>
              <Form.Item name="field" label="擅长领域" rules={[{
                  required: true
                }]}>
                <Select options={FIELDS.map(item => ({
                    value: item,
                    label: item
                  }))} />
              </Form.Item>
              <Form.Item name="region" label="服务区域" rules={[{
                  required: true,
                  message: '请填写服务区域'
                }]}>
                <Input placeholder="例：山东济南" />
              </Form.Item>
              <Form.Item name="level" label="申报等级" rules={[{
                  required: true
                }]}>
                <Select options={LEVELS.map(item => ({
                    value: item,
                    label: item
                  }))} />
              </Form.Item>
              <Form.Item name="certNo" label="资格证书编号" rules={[{
                  required: true,
                  message: '请填写证书编号'
                }, {
                  pattern: /^[A-Z]{2,6}-\d{4}-\d{3,5}$/,
                  message: '格式如 NYK-2021-0386'
                }]}>
                <Input placeholder="例：NYK-2021-0386" />
              </Form.Item>
            </div>

            <Form.Item name="intro" label="个人简介" rules={[{
                required: true,
                message: '请填写简介'
              }, {
                min: 20,
                message: '至少 20 字'
              }]}>
              <Input.TextArea rows={4} maxlength={200} showCount placeholder="从业年限、主持项目、擅长技术方向、服务案例等" />
            </Form.Item>

            <Alert type="info" showIcon message="资质核验说明" description="平台将在审核阶段核验职称证书与执业单位信息；提供虚假资质将被永久取消入驻资格。" style={{
                marginBottom: "14px"
              }} />

            <Button type="primary" htmlType="submit" loading={view_submitting} icon={<IdcardOutlined />}>提交认证申请</Button>
          </Form>
        </section>

        <div class="stack">
          {view_latest && <section class="surface-card">
              <SectionHeading kicker="STATUS" title="最近一次申请" />
              <div class="row" style={{
                gap: "8px",
                marginBottom: "10px",
                flexWrap: 'wrap'
              }}>
                <Tag class={`soft-tag ${view_latest.status === 'approved' ? 'tone-green' : view_latest.status === 'rejected' ? 'tone-up' : 'tone-amber'}`}>
                  {statusLabel(view_latest.status)}
                </Tag>
                <Tag class="soft-tag">{view_latest.level}</Tag>
              </div>
              <div class="kv-list">
                <div class="kv"><span>姓名</span><b>{view_latest.name}</b></div>
                <div class="kv"><span>领域</span><b>{view_latest.field}</b></div>
                <div class="kv"><span>证书编号</span><b>{view_latest.certNo}</b></div>
                <div class="kv"><span>提交时间</span><b>{view_latest.applyAt}</b></div>
                {view_latest.auditAt && <div class="kv"><span>审核时间</span><b>{view_latest.auditAt}</b></div>}
              </div>
              {view_latest.auditNote && <p class="source-note" style={{
                marginTop: "10px"
              }}>审核意见：{view_latest.auditNote}</p>}
            </section>}

          <section class="surface-card">
            <SectionHeading kicker="PROCESS" title="认证流程" />
            <Steps direction="vertical" size="small" current={view_latest ? view_latest.status === 'approved' ? 3 : view_latest.status === 'rejected' ? 1 : 2 : 1} items={[{
                title: '提交材料',
                description: '填写职称、单位、证书编号与简介'
              }, {
                title: '运营初审',
                description: '核验证书真实性与执业单位（1 个工作日）'
              }, {
                title: '专家复审',
                description: '领域匹配度与答疑能力评估（2 个工作日）'
              }, {
                title: '认证通过',
                description: '展示认证标识，可在专家服务页接单'
              }]} />
          </section>

          {view_records.length > 1 && <section class="surface-card">
              <SectionHeading kicker="HISTORY" title="历史申请" />
              <div class="stack" style={{
                gap: "8px"
              }}>
                {view_records.slice(1).map(record => <div class="surface-card flat" key={record.id}>
                    <div class="row between">
                      <b style={{
                      fontSize: "13px"
                    }}>{record.name} · {record.level}</b>
                      <Tag class="soft-tag">{statusLabel(record.status)}</Tag>
                    </div>
                    <p class="small muted" style={{
                    marginTop: "6px"
                  }}>{record.applyAt} · {record.certNo}</p>
                  </div>)}
              </div>
            </section>}

          {view_records.length === 0 && <section class="surface-card">
              <EmptyState icon="🪪" title="还没有提交过认证" description="填写左侧表单提交后，可在此查看审核进度。" />
            </section>}
        </div>
      </div>
    </div>;
    };
  }
});
function statusLabel(status: string): string {
  return ({
    pending: '待审核',
    reviewing: '审核中',
    approved: '已通过',
    rejected: '未通过'
  } as Record<string, string>)[status] ?? status;
}
