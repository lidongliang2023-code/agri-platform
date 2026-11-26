import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import '@/components/ProductionDetailCompact.css';
import { useNavigate, useSearchParams } from '@/vue/router';
import { useQuery } from '@/vue/query';
import { Alert, App, Button, Card, Form, Input, Modal, Space, Tabs, Tag, Typography } from '@/vue/ui';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import type { ProColumns } from '@/vue/pro';
import { PageContainer as PageContainer } from '@/vue/pro';
import ProTable from '@/vue/ProductionRequestTable';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import useAuthStore from '@/vue/authStore';
import useFarmStore from '@/vue/farmStore';
import { createSetting, getSetting, getTenantProfile, listOperationLogs, listSettings } from '@/api/settings';
import type { OperationLogItem, SettingItem } from '@/api/settings';
const LINKS = [{
  title: '农场与地块',
  detail: '维护农场基础资料、地块与种植区域',
  path: '/production/farms'
}, {
  title: '告警规则',
  detail: '设置监测阈值与告警触发条件',
  path: '/production/alerts/rules'
}, {
  title: '设备绑定',
  detail: '维护设备与农场、地块的关联',
  path: '/production/iot/bindings'
}, {
  title: '农事计划',
  detail: '安排生产阶段与农事任务',
  path: '/production/plans'
}];

/** 设置仅管理配置记录；生产规则回到所属业务模块维护，主体主数据由统一平台管理。 */
const SystemSettings = defineComponent({
  name: "SystemSettings",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subjectId = useAuthStore(s => s.userInfo?.tenantId);
    // 主体切换时卸载所有编辑、分页和查询状态，禁止旧主体响应回填。
    return () => {
      return <SettingsContent key={String(subjectId.value ?? '')} scope={String(subjectId.value ?? '')} />;
    };
  }
});
export default SystemSettings;
const SettingsContent = defineComponent({
  name: "SettingsContent",
  props: {
    scope: null as unknown as PropType<{
      scope: string;
    }["scope"]>
  },
  setup(__props: {
    scope: string;
  }, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = computed(() => ['overview', 'configs', 'logs'].includes(params.value.get('tab') ?? '') ? params.value.get('tab')! : 'overview');
    const {
      message
    } = App.useApp();
    const farm = useFarmStore(s => s.currentFarm);
    const configPage = shallowRef(1);
    const configPageSize = shallowRef(20);
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
      configPage.value = 1;
    };
    const editing = shallowRef<SettingItem | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const creating = shallowRef(false);
    const setCreating = (next: typeof creating.value | ((previous: typeof creating.value) => typeof creating.value)) => {
      creating.value = typeof next === 'function' ? (next as (previous: typeof creating.value) => typeof creating.value)(creating.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const savingRef = shallowRef(false);
    const [form] = Form.useForm<SettingItem>();
    const logPage = shallowRef(1);
    const setLogPage = (next: typeof logPage.value | ((previous: typeof logPage.value) => typeof logPage.value)) => {
      logPage.value = typeof next === 'function' ? (next as (previous: typeof logPage.value) => typeof logPage.value)(logPage.value) : next;
    };
    const logSize = shallowRef(10);
    const setLogSize = (next: typeof logSize.value | ((previous: typeof logSize.value) => typeof logSize.value)) => {
      logSize.value = typeof next === 'function' ? (next as (previous: typeof logSize.value) => typeof logSize.value)(logSize.value) : next;
    };
    const current = () => String(useAuthStore.getState().userInfo?.tenantId ?? '') === __props.scope;
    const configs = useQuery(() => ({
      queryKey: ['system-settings', __props.scope, 'configs'],
      queryFn: listSettings,
      enabled: !!__props.scope,
      retry: false
    }));
    const profile = useQuery(() => ({
      queryKey: ['system-settings', __props.scope, 'profile'],
      queryFn: getTenantProfile,
      enabled: !!__props.scope && tab.value === 'overview',
      retry: false
    }));
    const logs = useQuery(() => ({
      queryKey: ['system-settings', __props.scope, 'logs', logPage.value, logSize.value],
      queryFn: () => listOperationLogs({
        pageNum: logPage.value,
        pageSize: logSize.value
      }),
      enabled: !!__props.scope && tab.value === 'logs',
      retry: false
    }));
    const rows = computed(() => (configs.data ?? []).filter(row => [row.configKey, row.description].some(value => String(value ?? '').toLowerCase().includes(keyword.value.trim().toLowerCase()))));
    const refresh = () => {
      if (tab.value === 'logs') void logs.refetch();else if (tab.value === 'configs') void configs.refetch();else {
        void profile.refetch();
        void configs.refetch();
      }
    };
    const open = (row?: SettingItem) => {
      form.resetFields();
      form.setFieldsValue(row ?? {
        configKey: 'custom.',
        configValue: '',
        description: ''
      });
      setEditing(row ?? null);
      setCreating(!row);
    };
    const save = async () => {
      if (savingRef.value || !current()) return;
      let values: SettingItem;
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      if (!values.configKey.startsWith('custom.')) {
        message.warning('仅允许维护 custom. 前缀的自定义配置');
        return;
      }
      const payload = {
        ...values,
        configKey: values.configKey.trim(),
        configValue: values.configValue.trim(),
        description: values.description?.trim()
      };
      savingRef.value = true;
      setSaving(true);
      let written = false;
      try {
        if (!current()) return;
        if (creating.value && (await getSetting(payload.configKey))) throw new Error('该配置键已存在，请从列表编辑，避免覆盖已有配置');
        if (!current()) return;
        await createSetting(payload);
        written = true;
        if (!current()) return;
        const stored = await getSetting(payload.configKey);
        if (!current()) return;
        if (!stored || stored.configValue !== payload.configValue || payload.description && stored.description !== payload.description) throw new Error('保存请求已完成，但回读内容不一致，请刷新核对后再操作');
        setEditing(null);
        setCreating(false);
        message.success('配置记录已保存并回读确认；不会自动启动业务功能');
        void configs.refetch();
      } catch (error) {
        if (current()) message.error(`${written ? '写入请求已成功，回读核验未完成，请先刷新核对：' : '保存未完成：'}${(error as Error).message}`);
      } finally {
        savingRef.value = false;
        if (current()) setSaving(false);
      }
    };
    const columns = computed<ProColumns<SettingItem>[]>(() => [{
      title: '配置键',
      dataIndex: 'configKey',
      width: 260,
      ellipsis: true
    }, {
      title: '配置值',
      dataIndex: 'configValue',
      width: 260,
      ellipsis: true
    }, {
      title: '说明',
      dataIndex: 'description',
      width: 320,
      ellipsis: true
    }, {
      title: '使用范围',
      key: 'scope',
      width: 150,
      render: (_, row) => <Tag>{row.configKey.startsWith('custom.') ? '自定义记录' : '历史／保留配置'}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 110,
      render: (_, row) => row.configKey.startsWith('custom.') ? <Button type="link" onClick={() => open(row)}>编辑</Button> : <Typography.Text type="secondary">只读</Typography.Text>
    }]);
    const logColumns = computed<ProColumns<OperationLogItem>[]>(() => [{
      title: '操作时间',
      dataIndex: 'operateTime',
      width: 180
    }, {
      title: '操作人',
      dataIndex: 'operator',
      width: 260,
      renderText: (value: string) => value === '未持有用户档案（本服务仅解析到经营主体）' ? '历史记录未采集操作人身份' : value || '未记录'
    }, {
      title: '操作类型',
      dataIndex: 'operateType',
      width: 130
    }, {
      title: '操作对象',
      dataIndex: 'target',
      width: 300,
      ellipsis: true
    }, {
      title: '结果',
      dataIndex: 'result',
      width: 100,
      render: (_, row) => row.result === 1 ? <Tag color="success">成功</Tag> : row.result === 0 ? <Tag color="error">失败</Tag> : '—'
    }, {
      title: 'IP 地址',
      dataIndex: 'ipAddress',
      width: 160
    }]);
    return () => {
      return <PageContainer title="系统设置" subTitle="主体信息查看、生产配置入口与配置记录管理" extra={<Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>}>
    {!__props.scope ? <Alert type="warning" showIcon message="请先选择经营主体" /> : <Tabs activeKey={tab.value} onChange={value => {
          const next = new URLSearchParams(params.value);
          next.set('tab', value);
          setParams(next, {
            replace: true
          });
        }} items={[{
          key: 'overview',
          label: '使用概览',
          children: <Space direction="vertical" size={16} style={{
            width: '100%'
          }}>
        <Card title="当前使用范围" loading={profile.isLoading}>
          <DetailInfoGrid columns={3} items={[{
                label: '当前主体 ID',
                value: __props.scope
              }, {
                label: '主体名称',
                value: profile.data?.profile?.tenantName
              }, {
                label: '统一社会信用代码',
                value: profile.data?.profile?.creditCode
              }, {
                label: '当前农场',
                value: farm.value?.farmName
              }, {
                label: '配置范围',
                value: '当前经营主体共享，不随农场切换'
              }, {
                label: '资料维护',
                value: '由统一平台维护主体资料与账号权限'
              }]} />
          {profile.data?.unavailableReason && <Alert style={{
                marginTop: 16
              }} type="info" showIcon message="主体档案暂不可读取" description={profile.data.unavailableReason} />}
        </Card>
        <Card title="生产业务设置入口"><div>{LINKS.map(link => <div key={link.path} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom: '1px solid #edf2ef'
                }}><Space direction="vertical" size={2}><Typography.Text strong>{link.title}</Typography.Text><Typography.Text type="secondary">{link.detail}</Typography.Text></Space><Button onClick={() => navigate(link.path)}>前往设置</Button></div>)}</div></Card>
        <Alert type="info" showIcon message="设置职责说明" description="生产参数应在所属业务页面维护；经营主体认证、成员授权和账号安全由统一平台管理。本页不重复创建主体档案或独立权限规则。" />
      </Space>
        }, {
          key: 'configs',
          label: '配置记录',
          children: <Space direction="vertical" size={16} style={{
            width: '100%'
          }}>
        <Alert type="info" showIcon message="配置保存不等于功能启用" description="当前配置服务仅负责记录存储，尚未确认自动派单、自动归档、报表推送等参数的业务执行端。历史配置只读保留，自定义记录仅用于有明确接入约定的配置，不在此承诺执行效果。请勿保存密码、访问令牌等敏感信息。" />
        {configs.isError && <Alert type="error" showIcon message="配置加载失败，不能据此认定没有配置" description={(configs.error as Error).message} action={<Button onClick={() => void configs.refetch()}>重试</Button>} />}
        <ProTable headerTitle={`已保存配置（${configs.data?.length ?? 0} 项）`} rowKey="configKey" columns={columns.value} dataSource={configs.isError ? [] : rows.value} loading={configs.isFetching} search={false} options={{
              reload: () => {
                void configs.refetch();
              }
            }} scroll={{
              x: 1100
            }} columnsState={{
              persistenceKey: 'production-settings-config-columns',
              persistenceType: 'localStorage'
            }} columnWidthStorageKey="settings-configs" filterSlot={<ProductionListFilters embedded={false} loading={configs.isFetching} onSearch={() => setKeyword(keyword.value.trim())} onReset={() => setKeyword('')}>
              <div class="production-filter-field">
                <label>关键字</label>
                <Input allowClear placeholder="搜索配置键或说明" value={keyword.value} onChange={event => setKeyword(event.target.value ?? '')} />
              </div>
            </ProductionListFilters>} toolBarRender={() => [<Button key="add" type="primary" icon={<PlusOutlined />} disabled={!configs.isSuccess} onClick={() => open()}>新增自定义配置</Button>]} pagination={{
              current: configPage.value,
              pageSize: configPageSize.value,
              onChange: (page, size) => {
                configPage.value = size === configPageSize.value ? page : 1;
                configPageSize.value = size;
              },
              showSizeChanger: true,
              showTotal: total => `共 ${total} 项`
            }} />
      </Space>
        }, {
          key: 'logs',
          label: '操作日志',
          children: <Space direction="vertical" size={16} style={{
            width: '100%'
          }}>
        <Alert type="info" showIcon message="日志仅展示服务端实际返回的审计记录" description="此处不生成本地日志，不以配置保存请求或浏览器记录替代正式审计。当前接口未承诺操作人及日期组合筛选，不进行当前页过滤以免漏查。" />
        {logs.data?.unavailableReason && <Alert type="warning" showIcon message="操作日志不可用" description={logs.data.unavailableReason} action={<Button onClick={() => void logs.refetch()}>重试</Button>} />}
        {logs.isError && <Alert type="error" showIcon message="日志读取失败" description={(logs.error as Error).message} />}
        <ProTable headerTitle="操作日志" rowKey="logId" search={false} columns={logColumns.value} dataSource={logs.data?.list ?? []} loading={logs.isFetching} scroll={{
              x: 1000
            }} columnWidthStorageKey="settings-logs" columnsState={{
              persistenceKey: 'production-settings-log-columns',
              persistenceType: 'localStorage'
            }} options={{
              reload: () => {
                void logs.refetch();
              }
            }} pagination={{
              current: logPage.value,
              pageSize: logSize.value,
              total: logs.data?.total ?? 0,
              showSizeChanger: true,
              onChange: (page, size) => {
                setLogPage(size === logSize.value ? page : 1);
                setLogSize(size);
              },
              showTotal: total => `共 ${total} 条`
            }} />
      </Space>
        }]} />}
    <Modal class="production-form-dialog" title={creating.value ? '新增自定义配置' : '编辑自定义配置'} open={creating.value || !!editing.value} confirmLoading={saving.value} closable={!saving.value} maskClosable={false} cancelButtonProps={{
          disabled: saving.value
        }} onCancel={() => {
          if (!saving.value) {
            setCreating(false);
            setEditing(null);
          }
        }} onOk={() => void save()} destroyOnClose>
      <Alert type="info" showIcon message="仅保存配置记录，不会自动改变生产业务流程" style={{
            marginBottom: 16
          }} />
      <Form form={form} layout="vertical">
        <Form.Item name="configKey" label="配置键" rules={[{
              required: true
            }, {
              pattern: /^custom\.[A-Za-z0-9][A-Za-z0-9_.-]*$/,
              message: '须以 custom. 开头，后接字母、数字、下划线、点或短横线'
            }, {
              max: 64
            }]}><Input disabled={!creating.value} maxLength={64} /></Form.Item>
        <Form.Item name="configValue" label="配置值" rules={[{
              required: true,
              whitespace: true
            }, {
              max: 500
            }]}><Input.TextArea rows={4} maxLength={500} showCount /></Form.Item>
        <Form.Item name="description" label="用途说明" rules={[{
              required: true,
              whitespace: true
            }, {
              max: 200
            }]}><Input.TextArea rows={2} maxLength={200} showCount placeholder="填写使用模块与接入约定" /></Form.Item>
      </Form>
    </Modal>
  </PageContainer>;
    };
  }
});
