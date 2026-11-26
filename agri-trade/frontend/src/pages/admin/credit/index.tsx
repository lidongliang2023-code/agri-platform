import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Button, Descriptions, Form, Input, Modal, Popconfirm, Rate, Select, Space, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { auditCreditAppeal, changeEvaluationStatus, getCreditAppeals, getCreditEvaluations, type CreditAppeal, type CreditEvaluation } from '@/api/credit';
import { TradeFilters, TradeList } from '@/components/TradeList';
const APPEAL_TYPE: Record<string, string> = {
  fact: '内容不实',
  false_content: '内容不实',
  not_my_order: '评价的不是本单',
  malicious: '恶意差评',
  other: '其它'
};
const APPEAL_STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending: {
    text: '待处理',
    color: 'warning'
  },
  approved: {
    text: '已通过',
    color: 'success'
  },
  rejected: {
    text: '已驳回',
    color: 'default'
  }
};
const EVAL_STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  published: {
    text: '展示中',
    color: 'success'
  },
  hidden: {
    text: '已隐藏',
    color: 'default'
  }
};

/**
 * 信用管理（运营端）：评价监管 + 申诉处理。
 */
const AdminCredit = defineComponent({
  name: "AdminCredit",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const evaluations = shallowRef<CreditEvaluation[]>([]);
    const setEvaluations = (next: typeof evaluations.value | ((previous: typeof evaluations.value) => typeof evaluations.value)) => {
      evaluations.value = typeof next === 'function' ? (next as (previous: typeof evaluations.value) => typeof evaluations.value)(evaluations.value) : next;
    };
    const evalTotal = shallowRef(0);
    const setEvalTotal = (next: typeof evalTotal.value | ((previous: typeof evalTotal.value) => typeof evalTotal.value)) => {
      evalTotal.value = typeof next === 'function' ? (next as (previous: typeof evalTotal.value) => typeof evalTotal.value)(evalTotal.value) : next;
    };
    const evalPage = shallowRef(1);
    const setEvalPage = (next: typeof evalPage.value | ((previous: typeof evalPage.value) => typeof evalPage.value)) => {
      evalPage.value = typeof next === 'function' ? (next as (previous: typeof evalPage.value) => typeof evalPage.value)(evalPage.value) : next;
    };
    const evalPageSize = shallowRef(20);
    const setEvalPageSize = (next: typeof evalPageSize.value | ((previous: typeof evalPageSize.value) => typeof evalPageSize.value)) => {
      evalPageSize.value = typeof next === 'function' ? (next as (previous: typeof evalPageSize.value) => typeof evalPageSize.value)(evalPageSize.value) : next;
    };
    const evalFilters = shallowRef<{
      evaluationNo?: string;
      ratingOverall?: number;
      evaluationStatus?: string;
    }>({});
    const setEvalFilters = (next: typeof evalFilters.value | ((previous: typeof evalFilters.value) => typeof evalFilters.value)) => {
      evalFilters.value = typeof next === 'function' ? (next as (previous: typeof evalFilters.value) => typeof evalFilters.value)(evalFilters.value) : next;
    };
    const evalDraft = shallowRef<{
      evaluationNo?: string;
      ratingOverall?: number;
      evaluationStatus?: string;
    }>({});
    const setEvalDraft = (next: typeof evalDraft.value | ((previous: typeof evalDraft.value) => typeof evalDraft.value)) => {
      evalDraft.value = typeof next === 'function' ? (next as (previous: typeof evalDraft.value) => typeof evalDraft.value)(evalDraft.value) : next;
    };
    const appeals = shallowRef<CreditAppeal[]>([]);
    const setAppeals = (next: typeof appeals.value | ((previous: typeof appeals.value) => typeof appeals.value)) => {
      appeals.value = typeof next === 'function' ? (next as (previous: typeof appeals.value) => typeof appeals.value)(appeals.value) : next;
    };
    const appealTotal = shallowRef(0);
    const setAppealTotal = (next: typeof appealTotal.value | ((previous: typeof appealTotal.value) => typeof appealTotal.value)) => {
      appealTotal.value = typeof next === 'function' ? (next as (previous: typeof appealTotal.value) => typeof appealTotal.value)(appealTotal.value) : next;
    };
    const appealPage = shallowRef(1);
    const setAppealPage = (next: typeof appealPage.value | ((previous: typeof appealPage.value) => typeof appealPage.value)) => {
      appealPage.value = typeof next === 'function' ? (next as (previous: typeof appealPage.value) => typeof appealPage.value)(appealPage.value) : next;
    };
    const appealPageSize = shallowRef(20);
    const setAppealPageSize = (next: typeof appealPageSize.value | ((previous: typeof appealPageSize.value) => typeof appealPageSize.value)) => {
      appealPageSize.value = typeof next === 'function' ? (next as (previous: typeof appealPageSize.value) => typeof appealPageSize.value)(appealPageSize.value) : next;
    };
    const appealStatus = shallowRef<string | undefined | undefined>(undefined);
    const setAppealStatus = (next: typeof appealStatus.value | ((previous: typeof appealStatus.value) => typeof appealStatus.value)) => {
      appealStatus.value = typeof next === 'function' ? (next as (previous: typeof appealStatus.value) => typeof appealStatus.value)(appealStatus.value) : next;
    };
    const draftAppealStatus = shallowRef<string | undefined | undefined>(undefined);
    const setDraftAppealStatus = (next: typeof draftAppealStatus.value | ((previous: typeof draftAppealStatus.value) => typeof draftAppealStatus.value)) => {
      draftAppealStatus.value = typeof next === 'function' ? (next as (previous: typeof draftAppealStatus.value) => typeof draftAppealStatus.value)(draftAppealStatus.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const hideRow = shallowRef<CreditEvaluation | null>(null);
    const setHideRow = (next: typeof hideRow.value | ((previous: typeof hideRow.value) => typeof hideRow.value)) => {
      hideRow.value = typeof next === 'function' ? (next as (previous: typeof hideRow.value) => typeof hideRow.value)(hideRow.value) : next;
    };
    const hideReason = shallowRef('');
    const setHideReason = (next: typeof hideReason.value | ((previous: typeof hideReason.value) => typeof hideReason.value)) => {
      hideReason.value = typeof next === 'function' ? (next as (previous: typeof hideReason.value) => typeof hideReason.value)(hideReason.value) : next;
    };
    const detail = shallowRef<CreditEvaluation | null>(null);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const appealDetail = shallowRef<CreditAppeal | null>(null);
    const setAppealDetail = (next: typeof appealDetail.value | ((previous: typeof appealDetail.value) => typeof appealDetail.value)) => {
      appealDetail.value = typeof next === 'function' ? (next as (previous: typeof appealDetail.value) => typeof appealDetail.value)(appealDetail.value) : next;
    };
    const auditRow = shallowRef<CreditAppeal | null>(null);
    const setAuditRow = (next: typeof auditRow.value | ((previous: typeof auditRow.value) => typeof auditRow.value)) => {
      auditRow.value = typeof next === 'function' ? (next as (previous: typeof auditRow.value) => typeof auditRow.value)(auditRow.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const form = Form.useForm();
    const load = async () => {
      setLoading(true);
      try {
        const [e, a] = await Promise.all([getCreditEvaluations({
          pageNum: evalPage.value,
          pageSize: evalPageSize.value,
          ...evalFilters.value
        }), getCreditAppeals({
          pageNum: appealPage.value,
          pageSize: appealPageSize.value,
          appealStatus: appealStatus.value
        })]);
        if (e?.code === 200) {
          setEvaluations(e.data?.records ?? []);
          setEvalTotal(Number(e.data?.total ?? 0));
        }
        if (a?.code === 200) {
          setAppeals(a.data?.records ?? []);
          setAppealTotal(Number(a.data?.total ?? 0));
        }
      } catch {
        message.error('加载信用数据失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [evalPage.value, evalPageSize.value, evalFilters.value, appealPage.value, appealPageSize.value, appealStatus.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const submitHide = async () => {
      if (!hideRow.value) return;
      if (!hideReason.value.trim()) {
        message.warning('隐藏评价必须填写原因');
        return;
      }
      setSaving(true);
      try {
        const res = await changeEvaluationStatus(hideRow.value.id, 'hide', hideReason.value.trim());
        if (res?.code === 200) {
          message.success('已隐藏');
          setHideRow(null);
          setHideReason('');
          load();
        } else {
          message.error(res?.message ?? '操作失败');
        }
      } catch {
        message.error('操作失败');
      } finally {
        setSaving(false);
      }
    };
    const restore = async (row: CreditEvaluation) => {
      try {
        const res = await changeEvaluationStatus(row.id, 'restore');
        if (res?.code === 200) {
          message.success('已恢复展示');
          load();
        } else {
          message.error(res?.message ?? '操作失败');
        }
      } catch {
        message.error('操作失败');
      }
    };
    const submitAudit = async () => {
      if (!auditRow.value) return;
      const values = await form.validateFields();
      setSaving(true);
      try {
        const res = await auditCreditAppeal(auditRow.value.id, values.status, values.remark);
        if (res?.code === 200) {
          message.success(values.status === 'approved' ? '申诉已通过，对应评价已隐藏' : '申诉已驳回');
          setAuditRow(null);
          form.resetFields();
          load();
        } else {
          message.error(res?.message ?? '审核失败');
        }
      } catch {
        message.error('审核失败');
      } finally {
        setSaving(false);
      }
    };
    return () => {
      const view_auditRow = auditRow.value;
      const view_appealDetail = appealDetail.value;
      const view_detail = detail.value;
      const view_hideRow = hideRow.value;
      return <div style={{
        padding: 20,
        display: 'grid',
        gap: 16
      }}>
      <Alert type="info" showIcon message="隐藏评价必须填写原因" description="评价是公开的，隐藏要有据可查（原因会记在评价上）。申诉通过时系统也会自动隐藏对应评价。" />

      <TradeList listId="admin-credit-evaluations" rowKey="id" loading={loading.value} dataSource={evaluations.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>评价监管（共 {evalTotal.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={() => {
          setEvalPage(1);
          setEvalFilters({
            ...evalDraft.value,
            evaluationNo: evalDraft.value.evaluationNo?.trim() || undefined
          });
        }} onReset={() => {
          setEvalDraft({});
          setEvalFilters({});
          setEvalPage(1);
        }} fields={[{
          label: '评价编号',
          control: <Input allowClear value={evalDraft.value.evaluationNo} placeholder="评价编号" onChange={e => setEvalDraft(p => ({
            ...p,
            evaluationNo: (e.target.value ?? '') || undefined
          }))} onPressEnter={() => {
            setEvalPage(1);
            setEvalFilters({
              ...evalDraft.value,
              evaluationNo: evalDraft.value.evaluationNo?.trim() || undefined
            });
          }} />
        }, {
          label: '综合评分',
          control: <Select allowClear value={evalDraft.value.ratingOverall} placeholder="全部评分" onChange={v => setEvalDraft(p => ({
            ...p,
            ratingOverall: v
          }))} options={[5, 4, 3, 2, 1].map(v => ({
            value: v,
            label: `${v}星`
          }))} />
        }, {
          label: '展示状态',
          control: <Select allowClear value={evalDraft.value.evaluationStatus} placeholder="全部状态" onChange={v => setEvalDraft(p => ({
            ...p,
            evaluationStatus: v
          }))} options={Object.entries(EVAL_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }]} />} pagination={{
          current: evalPage.value,
          pageSize: evalPageSize.value,
          total: evalTotal.value,
          onChange: (nextPage, nextSize) => {
            setEvalPage(nextPage);
            setEvalPageSize(nextSize);
          }
        }} columns={[{
          title: '评价编号',
          dataIndex: 'evaluationNo',
          width: 160,
          ellipsis: true
        }, {
          title: '订单号',
          dataIndex: 'orderId',
          width: 100
        }, {
          title: '评价人',
          dataIndex: 'evaluatorName',
          width: 150,
          ellipsis: true
        }, {
          title: '被评价人',
          dataIndex: 'evaluateeName',
          width: 150,
          ellipsis: true
        }, {
          title: '综合评分',
          dataIndex: 'ratingOverall',
          width: 140,
          align: 'center',
          render: (v: number) => <Rate disabled defaultValue={v} />
        }, {
          title: '内容',
          dataIndex: 'evaluationContent',
          width: 220,
          ellipsis: true
        }, {
          title: '展示状态',
          dataIndex: 'evaluationStatus',
          width: 120,
          render: (v: string, row: CreditEvaluation) => <Space size={4}>
                <Tag color={EVAL_STATUS[v]?.color ?? 'default'}>{EVAL_STATUS[v]?.text ?? v}</Tag>
                {v === 'hidden' && row.hideReason ? <span style={{
              color: '#999',
              fontSize: 12
            }} title={row.hideReason}>有原因</span> : null}
              </Space>
        }, {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: unknown, row: CreditEvaluation) => <ListRowActions>
                <Button type="link" size="small" onClick={() => setDetail(row)}>详情</Button>
                {row.evaluationStatus === 'hidden' ? <Popconfirm title="恢复这条评价的展示？" okText="确 定" cancelText="取 消" onConfirm={() => restore(row)}>
                    <Button type="link" size="small">恢复</Button>
                  </Popconfirm> : <Button type="link" size="small" danger onClick={() => {
              setHideRow(row);
              setHideReason('');
            }}>隐藏</Button>}
              </ListRowActions>
        }]} />

      <TradeList listId="admin-credit-appeals" rowKey="id" loading={loading.value} dataSource={appeals.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>申诉处理（共 {appealTotal.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={() => {
          setAppealPage(1);
          setAppealStatus(draftAppealStatus.value);
        }} onReset={() => {
          setDraftAppealStatus(undefined);
          setAppealStatus(undefined);
          setAppealPage(1);
        }} fields={[{
          label: '申诉状态',
          control: <Select allowClear value={draftAppealStatus.value} placeholder="全部申诉状态" onChange={v => {
            setDraftAppealStatus(v);
            setAppealPage(1);
            setAppealStatus(v);
          }} options={Object.entries(APPEAL_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }]} />} locale={{
          emptyText: '暂无申诉'
        }} pagination={{
          current: appealPage.value,
          pageSize: appealPageSize.value,
          total: appealTotal.value,
          onChange: (nextPage, nextSize) => {
            setAppealPage(nextPage);
            setAppealPageSize(nextSize);
          }
        }} columns={[{
          title: '申诉编号',
          dataIndex: 'appealNo',
          width: 160,
          ellipsis: true
        }, {
          title: '关联评价',
          dataIndex: 'evaluationNo',
          width: 160,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '被评价方（申诉方）',
          dataIndex: 'evaluateeName',
          width: 170,
          ellipsis: true,
          render: (v: string, row: CreditAppeal) => v ?? row.appellantName ?? '—'
        }, {
          title: '申诉类型',
          dataIndex: 'appealType',
          width: 120,
          render: (v: string) => APPEAL_TYPE[v] ?? v ?? '—'
        }, {
          title: '申诉理由',
          dataIndex: 'appealReason',
          width: 220,
          ellipsis: true
        }, {
          title: '状态',
          dataIndex: 'appealStatus',
          width: 110,
          render: (v: string) => {
            const hit = APPEAL_STATUS[v];
            return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? v}</Tag>;
          }
        }, {
          title: '申请时间',
          dataIndex: 'createTime',
          width: 170
        }, {
          title: '操作',
          key: 'action',
          width: 150,
          render: (_: unknown, row: CreditAppeal) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setAppealDetail(row)}>详情</Button>, row.appealStatus === 'pending' && <Button key="approve" type="link" size="small" onClick={() => {
            setAuditRow(row);
            form.setFieldsValue({
              status: 'approved'
            });
          }}>
                      审核
                    </Button>, row.appealStatus === 'pending' && <Button key="reject" type="link" size="small" danger onClick={() => {
            setAuditRow(row);
            form.setFieldsValue({
              status: 'rejected'
            });
          }}>
                      驳回
                    </Button>]} />
        }]} />

      <Modal title="隐藏评价" open={!!view_hideRow} onCancel={() => setHideRow(null)} onOk={submitHide} confirmLoading={saving.value} destroyOnClose>
        <Alert type="warning" showIcon style={{
            marginBottom: 12
          }} message="隐藏后这条评价不再对外展示" description="请填写原因（会记在该评价上，作为处置留痕）。" />
        <Input.TextArea rows={3} value={hideReason.value} onChange={e => setHideReason(e.target.value ?? '')} placeholder="例如：经核实为同行恶意差评" />
      </Modal>

      <Modal title="审核申诉" open={!!view_auditRow} onCancel={() => setAuditRow(null)} onOk={submitAudit} confirmLoading={saving.value} destroyOnClose>
        <Alert type="warning" showIcon style={{
            marginBottom: 12
          }} message="通过会同时隐藏被申诉的评价" description="通过 = 认可申诉（评价置为隐藏）；驳回 = 维持原评价。这里只处理待处理的申诉。" />
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="审核结论" rules={[{
              required: true,
              message: '请选择结论'
            }]}>
            <Select options={[{
                value: 'approved',
                label: '通过（隐藏该评价）'
              }, {
                value: 'rejected',
                label: '驳回（维持该评价）'
              }]} />
          </Form.Item>
          <Form.Item name="remark" label="审核备注">
            <Input.TextArea rows={3} placeholder="可留空" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="评价详情" open={!!view_detail} onCancel={() => setDetail(null)} footer={null} width={700}>
        {view_detail && <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="评价编号">{view_detail.evaluationNo}</Descriptions.Item>
            <Descriptions.Item label="订单号">{view_detail.orderId}</Descriptions.Item>
            <Descriptions.Item label="评价人">{view_detail.evaluatorName}</Descriptions.Item>
            <Descriptions.Item label="被评价人">{view_detail.evaluateeName}</Descriptions.Item>
            <Descriptions.Item label="综合评分"><Rate disabled defaultValue={view_detail.ratingOverall} /></Descriptions.Item>
            <Descriptions.Item label="展示状态">
              <Tag color={EVAL_STATUS[view_detail.evaluationStatus]?.color ?? 'default'}>
                {EVAL_STATUS[view_detail.evaluationStatus]?.text ?? view_detail.evaluationStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="评价内容" span={2}>{view_detail.evaluationContent ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="隐藏原因" span={2}>{view_detail.hideReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="是否匿名" span={2}>
              {view_detail.isAnonymous === 1 ? '匿名' : '实名'}
            </Descriptions.Item>
          </Descriptions>}
      </Modal>

      <Modal title="申诉详情" open={!!view_appealDetail} onCancel={() => setAppealDetail(null)} footer={null} width={720}>
        {view_appealDetail && <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="申诉编号">{view_appealDetail.appealNo}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={APPEAL_STATUS[view_appealDetail.appealStatus]?.color ?? 'default'}>
                {APPEAL_STATUS[view_appealDetail.appealStatus]?.text ?? view_appealDetail.appealStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申诉方">{view_appealDetail.evaluateeName ?? view_appealDetail.appellantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="申诉类型">{APPEAL_TYPE[view_appealDetail.appealType] ?? view_appealDetail.appealType ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="申诉理由" span={2}>{view_appealDetail.appealReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="证据说明" span={2}>{view_appealDetail.appealEvidence ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联评价">{view_appealDetail.evaluationNo ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{view_appealDetail.orderId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="评价内容" span={2}>{view_appealDetail.evaluationContent ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核人">{view_appealDetail.reviewer ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核时间">{view_appealDetail.reviewTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核备注" span={2}>{view_appealDetail.reviewRemark ?? '—'}</Descriptions.Item>
          </Descriptions>}
      </Modal>
    </div>;
    };
  }
});
export default AdminCredit;
