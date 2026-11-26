import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Input, Tag } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { AuditLog } from '../types';
import { InfoFilters, InfoList } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui';

/** 操作审计：所有写操作由后端统一落库，页面只读，不提供删除入口。 */
export const AuditLogsPage = defineComponent({
  name: "AuditLogsPage",
  props: {},
  setup() {
    const items = ref<AuditLog[] | null>(null);
    const loading = ref(false);
    const error = ref('');
    const draft = ref('');
    const keyword = ref('');

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.auditLogs()
        .then(res => { items.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);
    onBeforeUnmount(() => undefined);

    const visible = computed(() => {
      if (!items.value) return [];
      const q = keyword.value.trim();
      if (!q) return items.value;
      return items.value.filter(item => `${item.operator}${item.action}${item.target}${item.detail}`.includes(q));
    });

    const columns = computed<JsxListColumn[]>(() => [{
      title: '时间',
      dataIndex: 'createdAt',
      width: 160
    }, {
      title: '操作人',
      dataIndex: 'operator',
      width: 130
    }, {
      title: '动作',
      dataIndex: 'action',
      width: 170,
      render: value => <Tag class="soft-tag tone-green">{value}</Tag>
    }, {
      title: '对象',
      dataIndex: 'target',
      width: 180
    }, {
      title: '详情',
      dataIndex: 'detail',
      width: 300
    }, {
      title: 'IP',
      dataIndex: 'ip',
      width: 130
    }]);

    return () => {
      const view_items = items.value;
      if (!view_items && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_items) return <ErrorBlock message={error.value} onRetry={load} />;
      const operators = new Set(view_items.map(item => item.operator)).size;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="AUDIT TRAIL"
            title="操作审计"
            description="内容审核、行情录入、供需审核、推荐策略等所有写操作自动留痕 · 日志只读，不可编辑或删除"
          />

          <div class="grid-4">
            <StatTile label="日志总量" value={view_items.length} unit="条" note="近 30 日" />
            <StatTile label="操作人数" value={operators} unit="人" note="含运营与审核岗" />
            <StatTile label="今日操作" value={view_items.filter(item => item.createdAt.startsWith('2026-06-27')).length} unit="条" note="按当前数据统计" tone="up" />
            <StatTile label="保留策略" value="180" unit="天" note="到期归档至数据仓库" />
          </div>

          <InfoList
            listId="audit-logs"
            rowKey="id"
            loading={loading.value}
            columns={columns.value}
            dataSource={visible.value}
            onRefresh={load}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[{
                  label: '关键字',
                  control: (
                    <Input
                      allowClear
                      value={draft.value}
                      placeholder="搜索操作人 / 动作 / 对象 / 详情"
                      onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                      onPressEnter={() => { keyword.value = draft.value.trim(); }}
                    />
                  ),
                }]}
                onQuery={() => { keyword.value = draft.value.trim(); }}
                onReset={() => { draft.value = ''; keyword.value = ''; }}
              />
            }
          />
        </div>
      );
    };
  }
});
