import { defineComponent, ref, onMounted } from 'vue';
import { Button } from "../components/vue-ui";
import { opsApi } from '../api';
import type { StatsAdmin } from '../types';
import { InfoList } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/** 统计报表：内容、渠道、供需、AI 与专家的运营成效汇总，支持导出（演示环境提示）。 */
export const StatsPage = defineComponent({
  name: "StatsPage",
  props: {},
  setup() {
    const data = ref<StatsAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.stats()
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);

    return () => {
      const view_data = data.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={load} />;
      const maxChannelRead = Math.max(...view_data.channelStats.map(item => item.readTotal), 1);
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="STATISTICS"
            title="统计报表"
            description="内容生产与消费、供需撮合、AI 服务与专家答疑的运营成效汇总 · 数据 T+0 更新"
            actions={<Button onClick={() => window.print()}>导出 / 打印</Button>}
          />

          <div class="grid-4">
            <StatTile label="内容总量" value={view_data.content.total} unit="篇" note={`已发布 ${view_data.content.published} 篇`} />
            <StatTile label="累计阅读" value={formatCount(view_data.content.readTotal)} unit="次" note="全站 PV" tone="up" />
            <StatTile label="互动总量" value={formatCount(view_data.content.likeTotal + view_data.content.commentTotal)} unit="次" note={`赞 ${formatCount(view_data.content.likeTotal)} · 评 ${view_data.content.commentTotal}`} />
            <StatTile label="供需浏览" value={formatCount(view_data.sdStats.viewTotal)} unit="次" note={`在线 ${view_data.sdStats.online} 条`} tone="up" />
          </div>

          <div class="grid-main-aside">
            <InfoList
              listId="stats-channels"
              rowKey="channel"
              loading={loading.value}
              dataSource={view_data.channelStats}
              onRefresh={load}
              toolbarLeft={<span style={{ fontWeight: 600 }}>栏目表现</span>}
              columns={[
                { title: '栏目', dataIndex: 'channel', width: 140 },
                { title: '内容量', dataIndex: 'total', width: 100 },
                { title: '阅读量', dataIndex: 'readTotal', width: 130, render: value => formatCount(value) },
                {
                  title: '占比',
                  key: 'ratio',
                  dataIndex: 'readTotal',
                  width: 220,
                  render: value => (
                    <div class="bar-cell">
                      <span class="bar-track"><i style={{ width: `${value / maxChannelRead * 100}%` }} /></span>
                      <small>{(value / Math.max(view_data.content.readTotal, 1) * 100).toFixed(1)}%</small>
                    </div>
                  ),
                },
              ]}
            />

            <div class="stack">
              <section class="surface-card">
                <SectionHeading kicker="SUPPLY & DEMAND" title="供需结构" />
                <div class="kv-list">
                  <div class="kv"><span>在线信息</span><b>{view_data.sdStats.online} 条</b></div>
                  <div class="kv"><span>供应</span><b>{view_data.sdStats.supply} 条</b></div>
                  <div class="kv"><span>需求</span><b>{view_data.sdStats.demand} 条</b></div>
                  <div class="kv"><span>累计浏览</span><b>{formatCount(view_data.sdStats.viewTotal)} 次</b></div>
                </div>
              </section>

              <section class="surface-card">
                <SectionHeading kicker="EXPERT" title="专家服务" />
                <div class="kv-list">
                  <div class="kv"><span>已认证专家</span><b>{view_data.expertStats.approved} 位</b></div>
                  <div class="kv"><span>待审核</span><b>{view_data.expertStats.pending} 位</b></div>
                  <div class="kv"><span>累计答疑</span><b>{view_data.expertStats.answers} 条</b></div>
                </div>
              </section>
            </div>
          </div>

          <InfoList
            listId="stats-ai"
            rowKey="category"
            loading={loading.value}
            dataSource={view_data.aiStats}
            onRefresh={load}
            toolbarLeft={<span style={{ fontWeight: 600 }}>AI 问答分类表现</span>}
            columns={[
              { title: '知识分类', dataIndex: 'category', width: 180 },
              { title: '问答次数', dataIndex: 'total', width: 120 },
              {
                title: '平均置信度',
                dataIndex: 'avgConfidence',
                width: 280,
                render: value => (
                  <div class="bar-cell">
                    <span class="bar-track"><i style={{ width: `${value}%` }} /></span>
                    <small>{Number(value).toFixed(1)}%</small>
                  </div>
                ),
              },
            ]}
          />
        </div>
      );
    };
  }
});
