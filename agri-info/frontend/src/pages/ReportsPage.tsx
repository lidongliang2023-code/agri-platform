import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { DownloadOutlined, FileTextOutlined } from "@ant-design/icons-vue";
import { Button, Drawer, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Report } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/**
 * 研究报告：按类别浏览，免费报告可直接下载（后端累加下载量），
 * 付费报告展示价格与购买入口；已下载的报告在「我的下载」中回看。
 */
export const ReportsPage = defineComponent({
  name: "ReportsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<{
      items: Report[];
      categories: string[];
      downloads: number;
    } | null>(null);
    const setData = (next: {
      items: Report[];
      categories: string[];
      downloads: number;
    } | null | ((previous: {
      items: Report[];
      categories: string[];
      downloads: number;
    } | null) => {
      items: Report[];
      categories: string[];
      downloads: number;
    } | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: {
        items: Report[];
        categories: string[];
        downloads: number;
      } | null) => {
        items: Report[];
        categories: string[];
        downloads: number;
      } | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const category = ref('全部');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const detail = ref<Report | null>(null);
    const setDetail = (next: Report | null | ((previous: Report | null) => Report | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Report | null) => Report | null)(detail.value) : next;
    };
    const mine = ref<Report[] | null>(null);
    const setMine = (next: Report[] | null | ((previous: Report[] | null) => Report[] | null)) => {
      mine.value = typeof next === 'function' ? (next as (previous: Report[] | null) => Report[] | null)(mine.value) : next;
    };
    const downloading = ref(0);
    const setDownloading = (next: typeof downloading.value | ((previous: typeof downloading.value) => typeof downloading.value)) => {
      downloading.value = typeof next === 'function' ? (next as (previous: typeof downloading.value) => typeof downloading.value)(downloading.value) : next;
    };
    const load = (nextCategory: string): void => {
      setCategory(nextCategory);
      setError('');
      infoApi.reports(nextCategory === '全部' ? undefined : nextCategory).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load('全部');
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openDetail = (id: number): void => {
      infoApi.report(id).then(setDetail).catch((reason: Error) => message.error(reason.message));
    };
    const download = (report: Report): void => {
      setDownloading(report.id);
      infoApi.downloadReport(report.id).then(result => {
        message.success(result.message);
        setData(previous => previous ? {
          ...previous,
          downloads: result.downloads,
          items: previous.items.map(item => item.id === report.id ? {
            ...item,
            downloads: item.downloads + 1
          } : item)
        } : previous);
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setDownloading(0));
    };
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_category = category.value;
      const view_navigate = navigate.value;
      const view_downloading = downloading.value;
      const view_detail = detail.value;
      const view_mine = mine.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load(view_category)} />;
      return <div class="page-stack">
      <PageTitle eyebrow="RESEARCH REPORTS" title="研究报告" description="单品月报、周报、专题分析与遥感监测 · 报告关键结论可链上存证，支持在线验真" actions={<>
            <Button onClick={() => infoApi.myReports().then(setMine).catch((reason: Error) => message.error(reason.message))}>
              我的下载
            </Button>
            <Button onClick={() => view_navigate('attest')}>存证查询</Button>
          </>} />

      <div class="grid-4">
        <StatTile label="在架报告" value={view_data.items.length} unit="份" note={`${view_data.categories.length} 个类别`} />
        <StatTile label="免费报告" value={view_data.items.filter(item => item.isFree).length} unit="份" note="登录即可下载" tone="up" />
        <StatTile label="累计下载" value={formatCount(view_data.downloads)} unit="次" note="全平台统计" />
        <StatTile label="已存证报告" value={view_data.items.filter(item => item.attestation).length} unit="份" note="关键结论上链" tone="warn" />
      </div>

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "14px"
          }}>
          {['全部', ...view_data.categories].map(item => <button type="button" key={item} class={`chip${view_category === item ? ' on' : ''}`} onClick={() => load(item)}>{item}</button>)}
        </div>

        {view_data.items.length === 0 && <EmptyState icon="📄" title="该类别暂无报告" description="换个类别看看。" />}

        <div class="stack" style={{
            gap: "12px"
          }}>
          {view_data.items.map(report => <article class="report-row" key={report.id}>
              <span class="report-icon"><FileTextOutlined /></span>
              <div class="report-main">
                <div class="row" style={{
                  gap: "8px",
                  flexWrap: 'wrap'
                }}>
                  <b style={{
                    fontSize: "14px"
                  }}>{report.title}</b>
                  <Tag class="soft-tag tone-green">{report.category}</Tag>
                  {report.isFree ? <Tag class="soft-tag">免费</Tag> : <Tag class="soft-tag tone-amber">¥{Number(report.price).toFixed(2)}</Tag>}
                  {report.attestation && <Tag class="soft-tag tone-purple">✓ 已存证</Tag>}
                </div>
                <p class="small muted" style={{
                  margin: '6px 0'
                }}>{report.summary}</p>
                <div class="row" style={{
                  gap: "14px",
                  flexWrap: 'wrap'
                }}>
                  <span class="small muted">{report.reportNo}</span>
                  <span class="small muted">{report.period}</span>
                  <span class="small muted">{report.pageCount} 页</span>
                  <span class="small muted">下载 {formatCount(report.downloads)}</span>
                  <span class="small muted">{report.publishedAt}</span>
                </div>
              </div>
              <div class="report-actions">
                <Button size="small" onClick={() => openDetail(report.id)}>查看目录</Button>
                {report.isFree ? <Button size="small" type="primary" icon={<DownloadOutlined />} loading={view_downloading === report.id} onClick={() => download(report)}>
                    下载
                  </Button> : <Button size="small" type="primary" onClick={() => message.info('演示环境未接入支付，正式版对接平台统一支付')}>
                    购买
                  </Button>}
              </div>
            </article>)}
        </div>
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={560} title={view_detail?.title ?? ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
              <Tag class="soft-tag tone-green">{view_detail.category}</Tag>
              <Tag class="soft-tag">{view_detail.period}</Tag>
              {view_detail.attestation && <Tag class="soft-tag tone-purple">已存证 {view_detail.attestation.attestNo}</Tag>}
            </div>
            <p class="small">{view_detail.summary}</p>
            <div class="kv-list">
              <div class="kv"><span>报告编号</span><b>{view_detail.reportNo}</b></div>
              <div class="kv"><span>页数</span><b>{view_detail.pageCount} 页</b></div>
              <div class="kv"><span>发布时间</span><b>{view_detail.publishedAt}</b></div>
              <div class="kv"><span>下载次数</span><b>{formatCount(view_detail.downloads)}</b></div>
              <div class="kv"><span>价格</span><b>{view_detail.isFree ? '免费' : `¥${Number(view_detail.price).toFixed(2)}`}</b></div>
            </div>

            <SectionHeading kicker="CONTENTS" title="报告目录" />
            <ol class="step-list">
              {(Array.isArray(view_detail.sections) ? view_detail.sections : String(view_detail.sections).split(',')).map(section => <li key={section}>{section}</li>)}
            </ol>

            {(view_detail.related ?? []).length > 0 && <>
                <SectionHeading kicker="RELATED" title="相关报告" />
                <div class="stack" style={{
                gap: "8px"
              }}>
                  {(view_detail.related ?? []).map(item => <button type="button" class="related-row" key={item.id} onClick={() => openDetail(item.id)}>
                      <b>{item.title}</b>
                      <span class="small muted">{item.category} · {item.period}</span>
                    </button>)}
                </div>
              </>}

            {view_detail.isFree ? <Button type="primary" icon={<DownloadOutlined />} loading={view_downloading === view_detail.id} onClick={() => download(view_detail)}>下载 PDF</Button> : <Button type="primary" onClick={() => message.info('演示环境未接入支付，正式版对接平台统一支付')}>购买后下载</Button>}
          </div>}
      </Drawer>

      <Drawer open={Boolean(view_mine)} onClose={() => setMine(null)} width={520} title="我的下载">
        {(view_mine ?? []).length === 0 && <p class="muted small">还没有下载记录。</p>}
        <div class="stack" style={{
            gap: "10px"
          }}>
          {(view_mine ?? []).map(report => <div class="surface-card flat" key={report.id} onClick={() => {
              setMine(null);
              openDetail(report.id);
            }}>
              <b style={{
                fontSize: "13px"
              }}>{report.title}</b>
              <p class="small muted" style={{
                marginTop: "6px"
              }}>{report.category} · {report.period} · {report.publishedAt}</p>
            </div>)}
        </div>
      </Drawer>
    </div>;
    };
  }
});
