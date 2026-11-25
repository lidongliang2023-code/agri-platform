import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Input, Table, Tag } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { AuditLog } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui';

/** 操作审计：所有写操作由后端统一落库，页面只读，不提供删除入口。 */
export const AuditLogsPage = defineComponent({
  name: "AuditLogsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const items = ref<AuditLog[] | null>(null);
    const setItems = (next: AuditLog[] | null | ((previous: AuditLog[] | null) => AuditLog[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: AuditLog[] | null) => AuditLog[] | null)(items.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const load = (): void => {
      setError('');
      opsApi.auditLogs().then(setItems).catch((reason: Error) => setError(reason.message));
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
    const visible = computed(() => {
      if (!items.value) return [];
      const q = keyword.value.trim();
      if (!q) return items.value;
      return items.value.filter(item => `${item.operator}${item.action}${item.target}${item.detail}`.includes(q));
    });
    const columns = computed<ColumnsType<AuditLog>>(() => [{
      title: '时间',
      dataIndex: 'createdAt',
      width: 150
    }, {
      title: '操作人',
      dataIndex: 'operator',
      width: 130
    }, {
      title: '动作',
      dataIndex: 'action',
      width: 170,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class="soft-tag tone-green">{value}</Tag>
    }, {
      title: '对象',
      dataIndex: 'target'
    }, {
      title: '详情',
      dataIndex: 'detail',
      width: 320
    }, {
      title: 'IP',
      dataIndex: 'ip',
      width: 130
    }]);
    return () => {
      const view_items = items.value;
      const view_error = error.value;
      const view_visible = visible.value;
      const view_columns = columns.value;
      if (!view_items && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_items) return <ErrorBlock message={view_error} onRetry={load} />;
      const operators = new Set(view_items.map(item => item.operator)).size;
      return <div class="page-stack">
      <PageTitle eyebrow="AUDIT TRAIL" title="操作审计" description="内容审核、行情录入、供需审核、推荐策略等所有写操作自动留痕 · 日志只读，不可编辑或删除" actions={<Button onClick={load}>刷新</Button>} />

      <div class="grid-4">
        <StatTile label="日志总量" value={view_items.length} unit="条" note="近 30 日" />
        <StatTile label="操作人数" value={operators} unit="人" note="含运营与审核岗" />
        <StatTile label="今日操作" value={view_items.filter(item => item.createdAt.startsWith('2026-06-27')).length} unit="条" note="按当前数据统计" tone="up" />
        <StatTile label="保留策略" value="180" unit="天" note="到期归档至数据仓库" />
      </div>

      <section class="surface-card">
        <div class="row between" style={{
            marginBottom: "12px"
          }}>
          <span class="small muted">共 {view_visible.length} 条记录</span>
          <Input.Search allowClear style={{
              width: "260px"
            }} placeholder="搜索操作人 / 动作 / 对象" onSearch={(value = "") => setKeyword(value)} />
        </div>
        <Table rowKey="id" size="middle" columns={view_columns} dataSource={view_visible} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>
    </div>;
    };
  }
});
