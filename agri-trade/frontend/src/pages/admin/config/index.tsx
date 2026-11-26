import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Button, Input, Select, Tag, Typography, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getConfigs, updateConfig, type ConfigRow } from '@/api/config';
import { TradeFilters, TradeList } from '@/components/TradeList';
const GROUP_NAME: Record<string, string> = {
  settlement: '结算与分账',
  product: '货源',
  order: '订单'
};

/**
 * 系统配置（运营端）。
 */
const AdminConfig = defineComponent({
  name: "AdminConfig",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<ConfigRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const draft = shallowRef<Record<string, string>>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const savingKey = shallowRef<string | null>(null);
    const setSavingKey = (next: typeof savingKey.value | ((previous: typeof savingKey.value) => typeof savingKey.value)) => {
      savingKey.value = typeof next === 'function' ? (next as (previous: typeof savingKey.value) => typeof savingKey.value)(savingKey.value) : next;
    };
    const groupFilter = shallowRef<string | undefined | undefined>(undefined);
    const setGroupFilter = (next: typeof groupFilter.value | ((previous: typeof groupFilter.value) => typeof groupFilter.value)) => {
      groupFilter.value = typeof next === 'function' ? (next as (previous: typeof groupFilter.value) => typeof groupFilter.value)(groupFilter.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftGroup = shallowRef<string | undefined | undefined>(undefined);
    const setDraftGroup = (next: typeof draftGroup.value | ((previous: typeof draftGroup.value) => typeof draftGroup.value)) => {
      draftGroup.value = typeof next === 'function' ? (next as (previous: typeof draftGroup.value) => typeof draftGroup.value)(draftGroup.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const load = async () => {
      setLoading(true);
      try {
        const res = await getConfigs();
        if (res?.code === 200) {
          setRows(res.data ?? []);
          setDraft({});
        } else {
          message.error(res?.message ?? '加载配置失败');
        }
      } catch {
        message.error('加载配置失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [load], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const filteredRows = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      return rows.value.filter(row => (!groupFilter.value || row.configGroup === groupFilter.value) && (!kw || [row.configName, row.configKey, row.description].some(v => String(v ?? '').toLowerCase().includes(kw))));
    });
    const handleQuery = () => {
      setGroupFilter(draftGroup.value);
      setKeyword(draftKeyword.value);
    };
    const handleReset = () => {
      setDraftGroup(undefined);
      setDraftKeyword('');
      setGroupFilter(undefined);
      setKeyword('');
    };
    const save = async (row: ConfigRow) => {
      const value = draft.value[row.configKey] ?? row.configValue;
      setSavingKey(row.configKey);
      try {
        const res = await updateConfig(row.configKey, value);
        if (res?.code === 200) {
          message.success('已保存');
          load();
        } else {
          message.error(res?.message ?? '保存失败');
        }
      } catch {
        message.error('保存失败');
      } finally {
        setSavingKey(null);
      }
    };
    const renderEditor = (row: ConfigRow) => {
      const disabled = row.editable === 0;
      const value = draft.value[row.configKey] ?? row.configValue;
      if (row.valueType === 'boolean') {
        return <Select style={{
          width: 140
        }} disabled={disabled} value={value} onChange={v => setDraft(prev => ({
          ...prev,
          [row.configKey]: v
        }))} options={[{
          value: 'true',
          label: '是'
        }, {
          value: 'false',
          label: '否'
        }]} />;
      }
      return <Input style={{
        width: 190
      }} disabled={disabled} value={value} onChange={e => setDraft(prev => ({
        ...prev,
        [row.configKey]: e.target.value ?? ''
      }))} />;
    };
    return () => {
      const view_savingKey = savingKey.value;
      return <div style={{
        padding: 20
      }}>
      <Alert type="info" showIcon style={{
          marginBottom: 12
        }} message="这里只列真的有代码在读的配置" description="改了会真的改变系统行为。取值优先级：这里的值 > 配置文件；删掉本行则回落到配置文件里的值。" />

      <TradeList listId="admin-config" rowKey="configKey" loading={loading.value} dataSource={filteredRows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>系统配置（共 {filteredRows.value.length} 项）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '配置分组',
          control: <Select allowClear value={draftGroup.value} placeholder="全部分组" onChange={setDraftGroup} options={Object.entries(GROUP_NAME).map(([value, label]) => ({
            value,
            label
          }))} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="配置项 / 配置键 / 说明" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} locale={{
          emptyText: '暂无配置项'
        }} columns={[{
          title: '分组',
          dataIndex: 'configGroup',
          width: 120,
          render: (v: string) => GROUP_NAME[v] ?? v
        }, {
          title: '配置项',
          dataIndex: 'configName',
          width: 180,
          ellipsis: true
        }, {
          title: '配置键',
          dataIndex: 'configKey',
          width: 230,
          ellipsis: true,
          render: (v: string) => <Typography.Text code>{v}</Typography.Text>
        }, {
          title: '类型',
          dataIndex: 'valueType',
          width: 90,
          render: (v: string) => <Tag>{v}</Tag>
        }, {
          title: '当前值',
          dataIndex: 'configValue',
          width: 220,
          render: (_: string, row: ConfigRow) => renderEditor(row)
        }, {
          title: '说明',
          dataIndex: 'description',
          width: 260,
          ellipsis: true
        }, {
          title: '操作',
          key: 'action',
          width: 104,
          render: (_: unknown, row: ConfigRow) => row.editable === 0 ? <span style={{
            color: '#a0aec0'
          }}>只读</span> : <ListRowActions>
                  <Button type="link" size="small" loading={view_savingKey === row.configKey} onClick={() => save(row)}>
                    保存
                  </Button>
                </ListRowActions>
        }]} />
      <Typography.Paragraph type="secondary" style={{
          marginTop: 12,
          marginBottom: 0
        }}>
        说明：配置项不是越多越好。新增一个键的前提是已经有代码在读它，否则运营改了没反应，会以为系统坏了。
      </Typography.Paragraph>
    </div>;
    };
  }
});
export default AdminConfig;
