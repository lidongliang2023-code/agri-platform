import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { FactoryVisitReport } from '../components/FactoryVisitReport';
import { PortalPageHero } from '../components/PortalPageHero';
import { FactoryPanorama } from '../components/FactoryPanorama';
import { getPlatformAccessToken } from '../utils/platformToken';
import { redirectToPlatformLogin } from '../utils';
import './cloud-factory.css';
type Media = {
  id: number;
  title: string;
  kind: string;
  url: string;
  capturedAt: string;
  description: string;
};
type Factory = {
  id: number;
  name: string;
  enterprise: string;
  region: string;
  category: string;
  description: string;
  baseRef: string;
  productKeyword: string;
  traceCode: string;
  media?: Media[];
};
type Visit = {
  id: number;
  factoryName: string;
  requestedAt: string;
  status: string;
  purpose: string;
  note: string;
};
const labels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  rejected: '未通过',
  cancelled: '已取消',
  panorama: '360° 全景',
  video: '实景录像',
  live: '直播信号',
  image: '实景照片'
};
async function api<T>(path: string, body?: unknown, privateRequest = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (privateRequest) {
    const token = await getPlatformAccessToken();
    if (!token) throw new Error('请先登录后预约或查看我的预约');
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api/v1/info/${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let result: {
    code: number;
    message: string;
    data: T;
  };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new Error(`云工厂服务暂不可用（HTTP ${response.status}），请稍后重试`);
  }
  if (!response.ok || ![0, 200].includes(result.code)) throw new Error(result.message || '请求失败，请稍后再试');
  return result.data;
}
export const CloudFactory = defineComponent({
  name: "CloudFactory",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const reportVisit = ref<number | null>(null);
    const setReportVisit = (next: typeof reportVisit.value | ((previous: typeof reportVisit.value) => typeof reportVisit.value)) => {
      reportVisit.value = typeof next === 'function' ? (next as (previous: typeof reportVisit.value) => typeof reportVisit.value)(reportVisit.value) : next;
    };
    const rows = ref<Factory[]>([]),
      selected = ref<Factory | null>(null),
      media = ref<Media | null>(null);
    const setMedia = (next: typeof media.value | ((previous: typeof media.value) => typeof media.value)) => {
      media.value = typeof next === 'function' ? (next as (previous: typeof media.value) => typeof media.value)(media.value) : next;
    };
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const keyword = ref(''),
      category = ref(''),
      error = ref(''),
      loading = ref(true),
      busy = ref(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const visits = ref<Visit[]>([]),
      showVisits = ref(false),
      booking = ref(false),
      message = ref('');
    const setMessage = (next: typeof message.value | ((previous: typeof message.value) => typeof message.value)) => {
      message.value = typeof next === 'function' ? (next as (previous: typeof message.value) => typeof message.value)(message.value) : next;
    };
    const setBooking = (next: typeof booking.value | ((previous: typeof booking.value) => typeof booking.value)) => {
      booking.value = typeof next === 'function' ? (next as (previous: typeof booking.value) => typeof booking.value)(booking.value) : next;
    };
    const setShowVisits = (next: typeof showVisits.value | ((previous: typeof showVisits.value) => typeof showVisits.value)) => {
      showVisits.value = typeof next === 'function' ? (next as (previous: typeof showVisits.value) => typeof showVisits.value)(showVisits.value) : next;
    };
    const setVisits = (next: typeof visits.value | ((previous: typeof visits.value) => typeof visits.value)) => {
      visits.value = typeof next === 'function' ? (next as (previous: typeof visits.value) => typeof visits.value)(visits.value) : next;
    };
    onMounted(() => {
      watch(() => [keyword.value, category.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let active = true;
          setLoading(true);
          api<Factory[]>(`public/cloud-factories?keyword=${encodeURIComponent(keyword.value)}&category=${encodeURIComponent(category.value)}`).then(data => {
            if (active) {
              setRows(data);
              setError('');
            }
          }).catch(e => {
            if (active) setError(String(e.message));
          }).finally(() => {
            if (active) setLoading(false);
          });
          return () => {
            active = false;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    async function open(id: number): Promise<void> {
      setBusy(true);
      setError('');
      try {
        const d = await api<Factory>(`public/cloud-factories/${id}`);
        setSelected(d);
        setMedia(d.media?.[0] || null);
        setBooking(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    async function myVisits(): Promise<void> {
      setError('');
      setBusy(true);
      try {
        setVisits(await api<Visit[]>('cloud-factory/visits', undefined, true));
        setShowVisits(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    async function submit(e: PortalEvent<HTMLFormElement>): Promise<void> {
      e.preventDefault();
      if (!selected.value) return;
      const b = Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));
      setBusy(true);
      setError('');
      try {
        await api(`cloud-factory/${selected.value.id}/visits`, b, true);
        setBooking(false);
        setMessage('验厂预约已提交，运营确认后可在“我的预约”查看安排。');
        await myVisits();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    }
    async function cancel(id: number): Promise<void> {
      setBusy(true);
      try {
        await api(`cloud-factory/visits/${id}/cancel`, {}, true);
        await myVisits();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    return () => {
      const view_busy = busy.value;
      const view_error = error.value;
      const view_message = message.value;
      const view_showVisits = showVisits.value;
      const view_visits = visits.value;
      const view_reportVisit = reportVisit.value;
      const view_rows = rows.value;
      const view_keyword = keyword.value;
      const view_category = category.value;
      const view_loading = loading.value;
      const view_selected = selected.value;
      const view_media = media.value;
      const view_booking = booking.value;
      return <main class="portal-channel-page factory-page">
    <PortalPageHero badge="VR CLOUD FACTORY" title="VR 云工厂" description="基地实景在线看货，远程验厂溯源。连接基地展示、交易货源与质量核验，让采购决策更有依据。"><div class="factory-actions"><a class="btn portal-page-btn-light" href="#factory-list">浏览实景基地</a><button class="btn portal-page-btn-ghost" disabled={view_busy} onClick={() => void myVisits()}>我的验厂预约</button><button class="btn portal-page-btn-ghost" onClick={() => void redirectToPlatformLogin()}>登录 / 切换账号</button></div></PortalPageHero>
    <div class="container factory-body">
      <div class="factory-workflow"><span>01 基地实景</span><span>02 在线看货</span><span>03 预约远程验厂</span><span>04 溯源核验</span></div>
      {view_error && <p class="factory-error" role="alert">{view_error}</p>}{view_message && <p role="status">{view_message}</p>}
      {view_showVisits && <section class="factory-panel"><div class="factory-heading"><h2>我的验厂预约</h2><button class="btn btn-outline" onClick={() => setShowVisits(false)}>收起</button></div><p class="muted">预约时间按北京时间；确认不等于验厂通过，具体安排以运营回复为准。</p>{view_visits.length === 0 ? <p>暂无预约记录。</p> : view_visits.map(v => <article class="factory-line" key={v.id}><div><strong>{v.factoryName}</strong> · {labels[v.status]}<p>{v.requestedAt.replace('T', ' ')} · {v.purpose}</p><p class="muted">运营回复：{v.note || '等待处理'}</p><button class="btn btn-outline" disabled={view_busy} onClick={() => setReportVisit(v.id)}>查看验厂报告</button></div>{['pending', 'confirmed'].includes(v.status) && <button class="btn btn-outline" disabled={view_busy} onClick={() => void cancel(v.id)}>取消预约</button>}</article>)}</section>}
      {view_reportVisit !== null && <FactoryVisitReport visitId={view_reportVisit} load={() => api(`cloud-factory/visits/${view_reportVisit}/report`, undefined, true)} onClose={() => setReportVisit(null)} />}
      <section id="factory-list" class="factory-panel"><div class="factory-heading"><div><h2>实景基地</h2><p class="muted">仅展示已审核发布资料，实景素材不替代现场检验或认证结论。</p></div><span>{view_rows.length} 个展示结果（最多200个）</span></div><div class="factory-filters"><input aria-label="搜索基地" placeholder="搜索基地、企业、地区、品种" value={view_keyword} onInput={e => setKeyword((e.target as HTMLInputElement).value)} /><select aria-label="产业筛选" value={view_category} onChange={e => setCategory((e.target as HTMLInputElement).value)}><option value="">全部产业</option>{['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '预制菜', '冷链物流'].map(c => <option key={c}>{c}</option>)}</select></div>
      {view_loading ? <p>正在读取已发布基地…</p> : view_error && view_rows.length === 0 ? <p>基地列表暂未加载，请稍后刷新重试。</p> : view_rows.length === 0 ? <div class="factory-empty"><h3>暂无符合条件的实景基地</h3><p>待运营配置真实、已授权素材并审核发布后展示。</p></div> : view_rows.map(f => <article class="factory-line" key={f.id}><div><span class="factory-tag">{f.category}</span><h3>{f.name}</h3><p>{f.enterprise} · {f.region}</p><p class="muted">{f.description.slice(0, 130)}</p></div><button class="btn btn-primary" disabled={view_busy} onClick={() => void open(f.id)}>进入云工厂</button></article>)}</section>
      {view_selected && <section class="factory-panel"><div class="factory-heading"><div><span class="factory-tag">{view_selected.category}</span><h2>{view_selected.name}</h2><p>{view_selected.enterprise} · {view_selected.region}</p></div><button class="btn btn-outline" onClick={() => setSelected(null)}>关闭详情</button></div><p>{view_selected.description}</p>
        <div class="factory-media-tabs">{view_selected.media?.map(m => <button key={m.id} class={`btn ${m.id === view_media?.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMedia(m)}>{labels[m.kind]} · {m.title}</button>)}</div>
        {view_media && <div class="factory-viewer" key={view_media.id}>{view_media.kind === 'panorama' ? <FactoryPanorama url={view_media.url} /> : view_media.kind === 'image' ? <img src={view_media.url} alt={view_media.title} /> : <><video controls playsinline preload="metadata" src={view_media.url} onError={() => setError('视频当前无法播放，请联系运营核验源状态及浏览器格式兼容性。')} />{view_media.kind === 'live' && <p>直播可用性以播放器当前连接为准；不支持的推流格式需由媒体服务转换。</p>}</>}<p>{labels[view_media.kind]} · {view_media.title} · {view_media.kind === 'live' ? '配置时间' : '拍摄时间'}：{view_media.capturedAt.replace('T', ' ')}（北京时间）</p><p>{view_media.description}</p></div>}
        <div class="factory-actions">{view_selected.productKeyword && <a class="btn btn-outline" href={`#/hall?q=${encodeURIComponent(view_selected.productKeyword)}`}>查找相关货源</a>}{view_selected.traceCode && <a class="btn btn-outline" href={`#/quality-trace?code=${encodeURIComponent(view_selected.traceCode)}`}>核验关联溯源码</a>}<button class="btn btn-primary" onClick={() => setBooking(!view_booking)}>预约远程验厂 / 看货</button></div>
        {view_booking && <form class="factory-booking" onSubmit={e => void submit(e)}><h3>远程验厂预约</h3><p>运营确认后协调远程会看与材料核验，联系电话仅本人及授权运营人员可见。</p><label>联系人<input name="contact" required maxlength={60} /></label><label>联系电话<input name="phone" type="tel" required maxlength={30} /></label><label>希望验厂时间（北京时间）<input name="requestedAt" type="datetime-local" required /></label><label>关注产品 / 批次与核验需求<textarea name="purpose" required maxlength={600} placeholder="请说明看货品种、批次及生产环境、质量材料等核验需求" /></label><button class="btn btn-primary" disabled={view_busy} type="submit">{view_busy ? '处理中…' : '提交预约'}</button></form>}
      </section>}
    </div>
  </main>;
    };
  }
});
