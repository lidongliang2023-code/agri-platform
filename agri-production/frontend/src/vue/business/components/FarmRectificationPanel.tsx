import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionDetailCompact.css';
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import { useQuery, useQueryClient } from '@/vue/query';
import { Alert, App, Button, Drawer, Form, Input, Modal, Select, Space, Tag, DatePicker } from '@/vue/ui';
import type { ProColumns } from '@/vue/pro';
import ProTable from '@/vue/ProductionRequestTable';
import useAuthStore from '@/vue/authStore';
import Card from '@/vue/business/components/SectionCard';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { checkStates, supervisionChecks, readCheck, registerCheck, submitRectification, reviewRectification } from '@/api/admin/farm-supervision';
import type { CheckRecord } from '@/api/admin/farm-supervision';
const FarmRectificationPanel = defineComponent({
  name: "FarmRectificationPanel",
  props: {
    farmId: null as unknown as PropType<{
      farmId?: string;
      user?: boolean;
    }["farmId"]>,
    user: null as unknown as PropType<{
      farmId?: string;
      user?: boolean;
    }["user"]>
  },
  setup(__props: {
    farmId?: string;
    user?: boolean;
  }, {
    slots: __slots
  }) {
    const subject = useAuthStore(s => s.userInfo?.tenantId);
    return () => {
      return <Panel key={`${subject.value}-${__props.farmId}-${__props.user ?? false}`} farmId={__props.farmId} user={__props.user ?? false} />;
    };
  }
});
export default FarmRectificationPanel;
const Panel = defineComponent({
  name: "Panel",
  props: {
    farmId: null as unknown as PropType<{
      farmId?: string;
      user: boolean;
    }["farmId"]>,
    user: null as unknown as PropType<{
      farmId?: string;
      user: boolean;
    }["user"]>
  },
  setup(__props: {
    farmId?: string;
    user: boolean;
  }, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const status = shallowRef<string>();
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const detail = shallowRef<CheckRecord>();
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const open = shallowRef(false);
    const setOpen = (next: typeof open.value | ((previous: typeof open.value) => typeof open.value)) => {
      open.value = typeof next === 'function' ? (next as (previous: typeof open.value) => typeof open.value)(open.value) : next;
    };
    const target = shallowRef<CheckRecord>();
    const setTarget = (next: typeof target.value | ((previous: typeof target.value) => typeof target.value)) => {
      target.value = typeof next === 'function' ? (next as (previous: typeof target.value) => typeof target.value)(target.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const form = Form.useForm();
    const actionForm = Form.useForm();
    const result = Form.useWatch('result', form);
    const queryClient = useQueryClient();
    const refresh = () => Promise.all([queryClient.invalidateQueries({
      queryKey: ['farm-checks']
    }), queryClient.invalidateQueries({
      queryKey: ['supervision-detail']
    })]);
    const q = useQuery(() => ({
      queryKey: ['farm-checks', __props.user, __props.farmId, page.value, size.value, status.value],
      queryFn: () => supervisionChecks({
        farmId: __props.farmId,
        pageNum: page.value,
        pageSize: size.value,
        rectifyStatus: status.value
      }, __props.user),
      retry: false,
      refetchOnWindowFocus: true
    }));
    const save = async () => {
      let v;
      try {
        v = await form.validateFields();
      } catch {
        return;
      }
      setBusy(true);
      let written = false;
      try {
        const saved = await registerCheck({
          ...v,
          farmId: __props.farmId,
          rectifyDeadline: v.rectifyDeadline?.format('YYYY-MM-DD')
        });
        written = true;
        await refresh();
        const read = await readCheck(saved.checkId);
        if (read.checkId !== saved.checkId || String(read.farmId) !== String(__props.farmId)) throw new Error('回读不一致');
        setOpen(false);
        message.success('检查已保存并回读确认');
      } catch (e) {
        message.error(`${written ? '已保存，回读未完成，请刷新核对：' : ''}${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    };
    const act = async () => {
      let v;
      try {
        v = await actionForm.validateFields();
      } catch {
        return;
      }
      if (!target.value) return;
      setBusy(true);
      let written = false;
      try {
        const saved = __props.user ? await submitRectification(target.value.checkId, v.remark) : await reviewRectification(target.value.checkId, v.approved === 'pass' || v.approved === true, v.remark);
        written = true;
        await refresh();
        const read = await readCheck(target.value.checkId, __props.user);
        if (read.rectifyStatus !== saved.rectifyStatus || read.rectifyRemark !== saved.rectifyRemark) throw new Error('状态或历史回读不一致');
        setTarget(undefined);
        setDetail(undefined);
        message.success('处置已保存并回读确认');
      } catch (e) {
        message.error(`${written ? '已保存，回读未完成，请刷新核对：' : ''}${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    };
    const cols = computed<ProColumns<CheckRecord>[]>(() => [{
      title: '检查编号',
      dataIndex: 'checkId',
      width: 230,
      ellipsis: true
    }, {
      title: '农场',
      dataIndex: 'farmName',
      width: 180
    }, {
      title: '检查事项',
      dataIndex: 'checkItem',
      width: 240,
      ellipsis: true
    }, {
      title: '结论',
      width: 120,
      render: (_, r) => <Tag color={r.result === 1 ? 'green' : r.result === 3 ? 'red' : 'orange'}>{r.result === 1 ? '合规' : r.result === 2 ? '限期整改' : r.result === 3 ? '严重违规' : '待补录'}</Tag>
    }, {
      title: '整改状态',
      width: 150,
      render: (_, r) => <Space direction="vertical" size={0}><span>{checkStates[r.rectifyStatus] ?? '未知状态'}</span>{r.rectifyDeadline && r.rectifyDeadline < new Date().toLocaleDateString('sv-SE') && !['rectified', 'none'].includes(r.rectifyStatus) && <Tag color="red">已逾期</Tag>}</Space>
    }, {
      title: '整改期限',
      dataIndex: 'rectifyDeadline',
      width: 140
    }, {
      title: '检查人',
      dataIndex: 'checkerName',
      width: 180
    }, {
      title: '检查时间',
      dataIndex: 'checkedAt',
      width: 185
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 190,
      render: (_, r) => <Space><Button type="link" onClick={async () => {
          try {
            setDetail(await readCheck(r.checkId, __props.user));
          } catch (e) {
            message.error((e as Error).message);
          }
        }}>详情</Button>{(__props.user ? ['pending', 'processing', 'overdue'].includes(r.rectifyStatus) : r.rectifyStatus === 'reviewing') && <Button type="link" onClick={() => {
          setTarget(r);
          actionForm.resetFields();
        }}>{__props.user ? '提交整改' : '复核'}</Button>}</Space>
    }]);
    return () => {
      return <Space direction="vertical" size={12} style={{
        width: '100%'
      }}>
 <Alert type="info" showIcon message={__props.user ? '整改提交后由运营复核，复核通过后关闭' : '检查登记 → 经营主体提交整改 → 运营复核'} description="检查结论不代替主体认证、质检判定或政府行政执法。仅登记实际检查事实；未整改问题不会因填写备注自动关闭。" />
 {q.isError && <Alert type="error" message="检查台账读取失败" description={(q.error as Error).message} action={<Button onClick={() => void q.refetch()}>重试</Button>} />}
 <Card title={__props.user ? '监管检查与整改' : '检查与整改台账'}><ProTable rowKey="checkId" columns={cols.value} dataSource={q.isError ? [] : q.data?.list ?? []} loading={q.isFetching} search={false} scroll={{
            x: 1600
          }} columnWidthStorageKey={`farm-checks-${__props.user}`} columnsState={{
            persistenceKey: `farm-checks-columns-${__props.user}`,
            persistenceType: 'localStorage'
          }} options={{
            reload: () => void q.refetch()
          }} toolbar={{
            actions: [<Select key="status" allowClear style={{
              width: 160
            }} placeholder="全部整改状态" value={status.value} options={Object.entries(checkStates).map(([value, label]) => ({
              value,
              label
            }))} onChange={v => {
              setStatus(v);
              setPage(1);
            }} />, ...(!__props.user && __props.farmId ? [<Button key="create" type="primary" onClick={() => {
              form.resetFields();
              form.setFieldsValue({
                checkType: '常规检查',
                result: 1
              });
              setOpen(true);
            }}>登记检查</Button>] : [])]
          }} pagination={{
            current: page.value,
            pageSize: size.value,
            total: q.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(s === size.value ? p : 1);
              setSize(s);
            }
          }} /></Card>
 <Drawer class={__props.user ? "production-detail-compact production-detail-dialog" : "farm-supervision-compact"} title="检查与整改详情" width={720} open={!!detail.value} onClose={() => setDetail(undefined)}>{detail.value && <Space direction="vertical" size={12} style={{
            width: '100%'
          }}>
 <Card title="检查信息" extra={<Tag color={detail.value.result === 1 ? 'green' : detail.value.result === 3 ? 'red' : 'orange'}>{detail.value.result === 1 ? '合规' : detail.value.result === 2 ? '限期整改' : detail.value.result === 3 ? '严重违规' : '待补录'}</Tag>}><DetailInfoGrid items={[{
                key: 'code',
                label: '检查编号',
                value: detail.value.checkId
              }, {
                key: 'farm',
                label: '所属农场',
                value: detail.value.farmName
              }, {
                key: 'type',
                label: '检查类型',
                value: detail.value.checkType
              }, {
                key: 'checker',
                label: '检查人',
                value: detail.value.checkerName
              }, {
                key: 'time',
                label: '检查时间',
                value: detail.value.checkedAt
              }, {
                key: 'status',
                label: '整改状态',
                value: checkStates[detail.value.rectifyStatus] ?? '未知状态'
              }, {
                key: 'item',
                label: '检查事项与依据',
                value: detail.value.checkItem,
                fullWidth: true
              }]} /></Card>
 <Card title="问题与整改"><DetailInfoGrid items={[{
                key: 'problem',
                label: '问题事实',
                value: <span style={{
                  whiteSpace: 'pre-wrap'
                }}>{detail.value.problem || '—'}</span>,
                fullWidth: true
              }, {
                key: 'requirement',
                label: '整改要求',
                value: <span style={{
                  whiteSpace: 'pre-wrap'
                }}>{detail.value.rectifyRequirement || '—'}</span>,
                fullWidth: true
              }, {
                key: 'deadline',
                label: '整改期限',
                value: detail.value.rectifyDeadline
              }, {
                key: 'rectified',
                label: '复核通过时间',
                value: detail.value.rectifiedAt
              }, {
                key: 'history',
                label: '处置历史',
                value: <span style={{
                  whiteSpace: 'pre-wrap'
                }}>{detail.value.rectifyRemark || '暂无处置记录'}</span>,
                fullWidth: true
              }]} /></Card></Space>}</Drawer>
 <Modal class="production-form-dialog" title="登记实际检查" open={open.value} confirmLoading={busy.value} closable={!busy.value} maskClosable={false} cancelButtonProps={{
          disabled: busy.value
        }} onCancel={() => setOpen(false)} onOk={() => void save()}><Form form={form} layout="vertical"><Form.Item name="checkType" label="检查类型" rules={[{
              required: true
            }]}><Select options={['常规检查', '禁限用农资抽查', '记录缺失督导'].map(value => ({
                value,
                label: value
              }))} /></Form.Item><Form.Item name="checkItem" label="检查事项与依据" rules={[{
              required: true
            }]}><Input.TextArea maxLength={200} showCount /></Form.Item><Form.Item name="result" label="检查结论" rules={[{
              required: true
            }]}><Select options={[{
                value: 1,
                label: '合规'
              }, {
                value: 2,
                label: '限期整改'
              }, {
                value: 3,
                label: '严重违规'
              }]} /></Form.Item>{result.value > 1 && <><Form.Item name="problem" label="问题事实" rules={[{
                required: true
              }]}><Input.TextArea maxLength={500} /></Form.Item><Form.Item name="rectifyRequirement" label="整改要求" rules={[{
                required: true
              }]}><Input.TextArea maxLength={500} /></Form.Item><Form.Item name="rectifyDeadline" label="整改期限" rules={[{
                required: true
              }]}><DatePicker /></Form.Item></>}</Form></Modal>
 <Modal class="production-form-dialog" title={__props.user ? '提交整改结果' : '运营整改复核'} open={!!target.value} confirmLoading={busy.value} closable={!busy.value} maskClosable={false} cancelButtonProps={{
          disabled: busy.value
        }} onCancel={() => setTarget(undefined)} onOk={() => void act()}><Alert type="info" message="请填写实际结果及凭据编号，不要填入个人隐私信息。处置历史容量500字，超限将拒绝保存。" style={{
            marginBottom: 16
          }} /><Form form={actionForm} layout="vertical">{!__props.user && <Form.Item name="approved" label="复核结论" rules={[{
              required: true
            }]}><Select options={[{
                value: 'pass',
                label: '依据充分，复核通过'
              }, {
                value: 'fail',
                label: '依据不足，退回整改'
              }]} /></Form.Item>}<Form.Item name="remark" label={__props.user ? '整改事实与凭据说明' : '复核事实与依据'} rules={[{
              required: true,
              whitespace: true
            }]}><Input.TextArea rows={4} maxLength={200} showCount /></Form.Item></Form></Modal>
 </Space>;
    };
  }
});
