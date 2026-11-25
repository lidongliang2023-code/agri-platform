import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Table } from "../components/vue-ui";
import { opsApi } from '../api';
import type { StatsAdmin } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/** 统计报表：内容、渠道、供需、AI 与专家的运营成效汇总，支持导出（演示环境提示）。 */
export const StatsPage = defineComponent({
  name: "StatsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<StatsAdmin | null>(null);
    const setData = (next: StatsAdmin | null | ((previous: StatsAdmin | null) => StatsAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: StatsAdmin | null) => StatsAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const load = (): void => {
      setError('');
      opsApi.stats().then(setData).catch((reason: Error) => setError(reason.message));
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
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      const maxChannelRead = Math.max(...view_data.channelStats.map(item => item.readTotal), 1);
      return <div class="page-stack">
      <PageTitle eyebrow="STATISTICS" title="统计报表" description="内容生产与消费、供需撮合、AI 服务与专家答疑的运营成效汇总 · 数据 T+0 更新" actions={<Button onClick={() => window.print()}>导出 / 打印</Button>} />

      <div class="grid-4">
        <StatTile label="内容总量" value={view_data.content.total} unit="篇" note={`已发布 ${view_data.content.published} 篇`} />
        <StatTile label="累计阅读" value={formatCount(view_data.content.readTotal)} unit="次" note="全站 PV" tone="up" />
        <StatTile label="互动总量" value={formatCount(view_data.content.likeTotal + view_data.content.commentTotal)} unit="次" note={`赞 ${formatCount(view_data.content.likeTotal)} · 评 ${view_data.content.commentTotal}`} />
        <StatTile label="供需浏览" value={formatCount(view_data.sdStats.viewTotal)} unit="次" note={`在线 ${view_data.sdStats.online} 条`} tone="up" />
      </div>

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="CHANNEL PERFORMANCE" title="栏目表现" />
          <Table rowKey="channel" size="middle" pagination={false} dataSource={view_data.channelStats} columns={[{
              title: '栏目',
              dataIndex: 'channel',
              width: 140
            }, {
              title: '内容量',
              dataIndex: 'total',
              width: 100
            }, {
              title: '阅读量',
              dataIndex: 'readTotal',
              width: 140,
              customRender: ({
                text: value
              }: {
                text: any;
              }) => formatCount(value)
            }, {
              title: '占比',
              dataIndex: 'readTotal',
              customRender: ({
                text: value
              }: {
                text: any;
              }) => <div class="bar-cell">
                    <span class="bar-track"><i style={{
                    width: `${value / maxChannelRead * 100}%`
                  }} /></span>
                    <small>{(value / Math.max(view_data.content.readTotal, 1) * 100).toFixed(1)}%</small>
                  </div>
            }]} />
        </section>

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

      <section class="surface-card">
        <SectionHeading kicker="AI PERFORMANCE" title="AI 问答分类表现" />
        <Table rowKey="category" size="middle" pagination={false} dataSource={view_data.aiStats} columns={[{
            title: '知识分类',
            dataIndex: 'category',
            width: 180
          }, {
            title: '问答次数',
            dataIndex: 'total',
            width: 120
          }, {
            title: '平均置信度',
            dataIndex: 'avgConfidence',
            customRender: ({
              text: value
            }: {
              text: any;
            }) => <div class="bar-cell">
                  <span class="bar-track"><i style={{
                  width: `${value}%`
                }} /></span>
                  <small>{Number(value).toFixed(1)}%</small>
                </div>
          }]} />
      </section>
    </div>;
    };
  }
});
