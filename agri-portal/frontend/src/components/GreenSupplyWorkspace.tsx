import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import './green-supply.css';
export type GreenRequest = <T>(path: string, body?: unknown) => Promise<T>;
type Row = {
  id: number;
  revision: number;
  status: string;
  title: string;
  [key: string]: unknown;
};
type Field = [string, string, string?];
const names: Record<string, string> = {
  project: '碳核算与报告',
  certificate: '绿色认证',
  consultation: '碳咨询',
  factor: '排放因子'
};
const states: Record<string, string> = {
  draft: '草稿',
  returned: '已退回 / 撤回',
  review: '待审核',
  published: '已发布',
  submitted: '待受理',
  accepted: '服务中',
  completed: '已完成',
  cancelled: '已取消'
};
const fields: Record<string, Field[]> = {
  project: [['title', '核算项目名称'], ['enterprise', '核算主体'], ['boundary', '组织 / 产品边界与覆盖环节'], ['methodology', '核算方法与采用标准'], ['periodStart', '核算开始日期', 'date'], ['periodEnd', '核算结束日期', 'date'], ['limitations', '数据缺口、排除事项与核算局限']],
  certificate: [['title', '认证名称'], ['enterprise', '获证主体'], ['certificateNo', '证书编号'], ['issuer', '发证机构'], ['standard', '认证标准'], ['scope', '认证范围'], ['validFrom', '生效日期', 'date'], ['validUntil', '到期日期', 'date'], ['evidence', '证书证据地址'], ['verifyUrl', '发证机构核验地址']],
  consultation: [['title', '咨询主题'], ['enterprise', '企业名称'], ['service', '服务类型'], ['contact', '联系人'], ['phone', '联系电话'], ['demand', '服务需求与预期成果']],
  factor: [['title', '因子名称'], ['activity', '适用活动与地区'], ['unit', '活动单位（精确匹配）'], ['scope', '排放范围'], ['value', '因子值（kgCO₂e / 活动单位）', 'number'], ['version', '版本与发布年份'], ['reference', '权威出处地址'], ['validFrom', '适用开始日期', 'date'], ['validUntil', '适用结束日期', 'date']]
};
const optionSets: Record<string, [string, string][]> = {
  scope: [['scope1', '范围一：直接排放'], ['scope2', '范围二：外购能源'], ['scope3', '范围三：价值链其他间接排放']],
  service: [['accounting', '碳核算'], ['report', '碳报告'], ['certification', '绿色认证咨询'], ['reduction', '减排路径咨询']],
  domain: [['production', '生产管理'], ['iot', '物联网'], ['logistics', '物流服务'], ['trade', '交易'], ['manual', '人工凭证']]
};
const itemFields: Field[] = [['name', '活动名称'], ['domain', '来源模块'], ['sourceRef', '原始单据 / 批次编号'], ['observedOn', '活动日期', 'date'], ['amount', '活动量', 'number'], ['unit', '活动单位'], ['evidence', '凭证地址']];
const Input = defineComponent({
  name: "Input",
  props: {
    field: null as unknown as PropType<{
      field: Field;
      value: unknown;
      onChange: (v: string) => void;
    }["field"]>,
    value: null as unknown as PropType<{
      field: Field;
      value: unknown;
      onChange: (v: string) => void;
    }["value"]>,
    onChange: null as unknown as PropType<{
      field: Field;
      value: unknown;
      onChange: (v: string) => void;
    }["onChange"]>
  },
  setup(__props: {
    field: Field;
    value: unknown;
    onChange: (v: string) => void;
  }, {
    slots: __slots
  }) {
    return () => {
      const [key, label, type] = __props.field;
      const view___props = __props.value;
      const view_prop_onChange = __props.onChange;
      return <label>{label}{optionSets[key] ? <select required value={String(view___props || '')} onChange={e => view_prop_onChange((e.target as HTMLInputElement).value)}><option value="">请选择</option>{optionSets[key].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : <input required maxlength={type === 'date' ? 10 : 2000} type={type || 'text'} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? 0 : undefined} value={String(view___props ?? '')} onInput={e => view_prop_onChange((e.target as HTMLInputElement).value)} />}</label>;
    };
  }
});
export const GreenSupplyWorkspace = defineComponent({
  name: "GreenSupplyWorkspace",
  props: {
    request: null as unknown as PropType<{
      request: GreenRequest;
      ops?: boolean;
    }["request"]>,
    ops: null as unknown as PropType<{
      request: GreenRequest;
      ops?: boolean;
    }["ops"]>
  },
  setup(__props: {
    request: GreenRequest;
    ops?: boolean;
  }, {
    slots: __slots
  }) {
    const kind = ref('project'),
      rows = ref<Row[]>([]),
      factors = ref<Row[]>([]),
      edit = ref<Record<string, unknown> | null>(null),
      detail = ref<Row | null>(null),
      error = ref(''),
      notice = ref(''),
      busy = ref(false),
      note = ref('');
    const setNote = (next: typeof note.value | ((previous: typeof note.value) => typeof note.value)) => {
      note.value = typeof next === 'function' ? (next as (previous: typeof note.value) => typeof note.value)(note.value) : next;
    };
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const setEdit = (next: typeof edit.value | ((previous: typeof edit.value) => typeof edit.value)) => {
      edit.value = typeof next === 'function' ? (next as (previous: typeof edit.value) => typeof edit.value)(edit.value) : next;
    };
    const setFactors = (next: typeof factors.value | ((previous: typeof factors.value) => typeof factors.value)) => {
      factors.value = typeof next === 'function' ? (next as (previous: typeof factors.value) => typeof factors.value)(factors.value) : next;
    };
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const setKind = (next: typeof kind.value | ((previous: typeof kind.value) => typeof kind.value)) => {
      kind.value = typeof next === 'function' ? (next as (previous: typeof kind.value) => typeof kind.value)(kind.value) : next;
    };
    const exported = ref<{
      html: string;
      filename: string;
    } | null>(null);
    const setExported = (next: typeof exported.value | ((previous: typeof exported.value) => typeof exported.value)) => {
      exported.value = typeof next === 'function' ? (next as (previous: typeof exported.value) => typeof exported.value)(exported.value) : next;
    };
    const reportFrame = shallowRef<HTMLIFrameElement | null>(null);
    async function exportReport(r: Row): Promise<void> {
      setBusy(true);
      setError('');
      setExported(null);
      try {
        setExported(await __props.request<{
          html: string;
          filename: string;
        }>(`${base.value}/project/${r.id}/export?revision=${r.revision}`, {}));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    function downloadReport(): void {
      if (!exported.value) return;
      const url = URL.createObjectURL(new Blob([exported.value.html], {
        type: 'text/html;charset=utf-8'
      }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exported.value.filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function printReport(): void {
      try {
        const w = reportFrame.value?.contentWindow;
        if (!w) throw new Error();
        w.focus();
        w.print();
      } catch {
        setError('无法打开打印，请下载 HTML 报告后使用浏览器打印功能另存 PDF');
      }
    }
    const base = computed(() => __props.ops ?? false ? 'ops/green' : 'green');
    async function reload(): Promise<void> {
      setBusy(true);
      setError('');
      try {
        setRows(await __props.request<Row[]>(`${base.value}/${kind.value}`));
        setFactors(await __props.request<Row[]>('public/green/factor'));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    onMounted(() => {
      watch(() => [kind.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setRows([]);
          setEdit(null);
          setDetail(null);
          setExported(null);
          void reload();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    async function save(e: PortalEvent): Promise<void> {
      e.preventDefault();
      if (!edit.value) return;
      setBusy(true);
      setError('');
      try {
        await __props.request(`${base.value}/${kind.value}/${edit.value.id || 0}`, edit.value);
        setEdit(null);
        setNotice('已保存。核算结果由服务器计算，提交审核后进入报告流程。');
        await reload();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    }
    async function transition(r: Row, status: string): Promise<void> {
      if (!note.value.trim()) {
        setError('请先填写提交、审核或服务处理说明');
        return;
      }
      setBusy(true);
      setError('');
      try {
        await __props.request(`${base.value}/${kind.value}/${r.id}/status`, {
          status,
          note: note.value,
          revision: r.revision
        });
        setExported(null);
        setDetail(null);
        setNote('');
        setNotice('状态已更新');
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    const items = computed(() => (edit.value?.items || []) as Record<string, unknown>[]);
    function setItem(index: number, key: string, value: unknown): void {
      setEdit({
        ...edit.value,
        items: items.value.map((x, n) => n === index ? {
          ...x,
          [key]: value
        } : x)
      });
    }
    return () => {
      const view_prop_ops = __props.ops;
      const view_kind = kind.value;
      const view_busy = busy.value;
      const view_error = error.value;
      const view_notice = notice.value;
      const view_edit = edit.value;
      const view_factors = factors.value;
      const view_items = items.value;
      const view_rows = rows.value;
      const view_exported = exported.value;
      const view_detail = detail.value;
      const view_note = note.value;
      return <section class="green-workspace">
 <div class="green-tabs">{Object.entries(names).filter(([k]) => (view_prop_ops ?? false) || k !== 'factor').map(([k, n]) => <button class={view_kind === k ? 'selected' : ''} key={k} disabled={view_busy} onClick={() => setKind(k)}>{n}</button>)}</div>
 <p class="green-hint">核算口径：活动量 × 因子（kgCO₂e / 活动单位）；不自动进行单位换算或抵销。生产、物联网、物流、交易数据通过来源编号和凭证引用。碳报告为平台核算记录，认证以外部机构证书为准。</p>
 {view_error && <p role="alert" class="green-error">{view_error}</p>}{view_notice && <p role="status">{view_notice}</p>}
 <div class="green-toolbar"><h2>{names[view_kind]}</h2><button disabled={view_busy} onClick={() => {
            setDetail(null);
            setEdit({
              revision: 0,
              items: []
            });
          }}>新建{view_kind === 'project' ? '核算项目' : view_kind === 'certificate' ? '证书申请' : view_kind === 'factor' ? '因子' : '咨询申请'}</button><button disabled={view_busy} onClick={() => void reload()}>刷新</button></div>
 {view_busy && <p>正在处理…</p>}
 {view_edit && <form class="green-editor" onSubmit={e => void save(e)}><div class="green-grid">{fields[view_kind].map(f => <Input key={f[0]} field={f} value={view_edit[f[0]]} onChange={v => setEdit({
              ...view_edit,
              [f[0]]: v
            })} />)}</div>
 {view_kind === 'project' && <><h3>活动明细（须使用已发布且适用日期有效的因子）</h3>{!view_factors.length && <p>暂无已发布因子，请由运营录入有出处的因子并由其他人员审核发布。</p>}{view_items.map((item, index) => <div class="green-activity" key={index}><strong>活动 {index + 1}</strong><button type="button" onClick={() => setEdit({
                ...view_edit,
                items: view_items.filter((_, n) => n !== index)
              })}>移除</button><div class="green-grid"><label>排放因子<select required value={String(item.factorId || '')} onChange={e => {
                    const f = view_factors.find(x => x.id === Number((e.target as HTMLInputElement).value));
                    setEdit({
                      ...view_edit,
                      items: view_items.map((x, n) => n === index ? {
                        ...x,
                        factorId: (e.target as HTMLInputElement).value,
                        unit: f?.unit || ''
                      } : x)
                    });
                  }}><option value="">请选择</option>{view_factors.map(f => <option key={f.id} value={f.id}>{f.title} · {String(f.value)} kgCO₂e/{String(f.unit)} · {String(f.version)}</option>)}</select></label>{itemFields.map(f => <Input key={f[0]} field={f} value={item[f[0]]} onChange={v => setItem(index, f[0], v)} />)}</div></div>)}<button type="button" disabled={view_items.length >= 100} onClick={() => setEdit({
              ...view_edit,
              items: [...view_items, {}]
            })}>添加活动</button></>}
 <p>证据请填写已授权的平台资源地址或不含敏感参数的 HTTPS 地址。</p><div class="green-toolbar"><button disabled={view_busy} type="submit">保存{view_kind === 'project' ? '并核算' : '草稿'}</button><button type="button" onClick={() => setEdit(null)}>取消编辑</button></div></form>}
 {!view_busy && !view_rows.length && <p class="green-empty">暂无记录。登录后可创建自己的核算、证书或咨询申请。</p>}
 {view_rows.map(r => <article class="green-row" key={r.id}><div><h3>{r.title}</h3><p>{String(r.enterprise || r.activity || '')} · {states[r.status]} · 版本 {r.revision}{r.expired === true ? ' · 已过期' : ''}</p>{view_kind === 'project' && <p>排放量：{String(r.totalKg)} kgCO₂e（{String(r.totalTonnes)} tCO₂e）</p>}</div><div class="green-toolbar"><button onClick={() => {
              setDetail(r);
              setEdit(null);
            }}>查看{view_kind === 'project' ? '碳报告' : '详情'}</button>{['draft', 'returned'].includes(r.status) && <button onClick={() => {
              setEdit(r);
              setDetail(null);
            }}>编辑</button>}</div></article>)}
 {view_exported && <section class="green-export"><div class="green-toolbar"><h2>碳报告导出预览</h2><button onClick={printReport}>打印 / 另存 PDF</button><button onClick={downloadReport}>下载 HTML 报告</button><button onClick={() => setExported(null)}>关闭预览</button></div><p>包含当前版本的计算明细和因子快照。草稿、待审核及撤回报告均明确标注状态；导出后请以平台当前状态为准。另存 PDF 需在打印窗口选择相应目标。</p><iframe ref={reportFrame} title="碳报告导出预览" sandbox="allow-same-origin allow-modals" referrerpolicy="no-referrer" srcdoc={view_exported.html} /></section>}
 {view_detail && <section class="green-detail"><div class="green-toolbar"><h2>{view_detail.title}</h2>{view_kind === 'project' && <button disabled={view_busy} onClick={() => void exportReport(view_detail)}>导出碳报告</button>}<button onClick={() => setDetail(null)}>关闭详情</button></div><p>记录 GS-{view_detail.id} · {states[view_detail.status]} · 版本 {view_detail.revision}{view_kind === 'project' && view_detail.status !== 'published' ? ' · 未发布，不作为正式发布报告' : ''}</p>{fields[view_kind].map(([k, l]) => <p key={k}><strong>{l}：</strong>{String(view_detail[k] ?? '')}</p>)}
 {view_kind === 'project' && <><h3>核算汇总：{String(view_detail.totalKg)} kgCO₂e / {String(view_detail.totalTonnes)} tCO₂e</h3><p>{Object.entries((view_detail.scopeTotalsKg || {}) as Record<string, number>).map(([k, v]) => `${optionSets.scope.find(x => x[0] === k)?.[1]}：${v} kgCO₂e`).join('；')}</p>{(view_detail.items as Record<string, unknown>[]).map((x, n) => {
              const f = x.factorSnapshot as Record<string, unknown>;
              return <article class="green-activity" key={n}><h4>{String(x.name)}</h4><p>{String(x.amount)} {String(x.unit)} × {String(f.value)} = {String(x.emissionKg)} kgCO₂e</p><p>来源：{String(x.domain)} / {String(x.sourceRef)} · 日期 {String(x.observedOn)}</p><p>因子：{String(f.title)} · {String(f.version)} · 适用 {String(f.validFrom)} 至 {String(f.validUntil)}</p><a href={String(x.evidence)} target="_blank" rel="noopener noreferrer">活动凭证</a> · <a href={String(f.reference)} target="_blank" rel="noopener noreferrer">因子出处</a></article>;
            })}<p>本报告不包含未经录入的活动，不代表完整生命周期评价或第三方核查，也不提供碳抵销结论。</p></>}
 {view_kind === 'certificate' && <p><a href={String(view_detail.evidence)} target="_blank" rel="noopener noreferrer">查看证书证据</a> · <a href={String(view_detail.verifyUrl)} target="_blank" rel="noopener noreferrer">发证机构核验</a> · {view_detail.expired ? '证书已过期' : '请结合认证范围及有效期核验'}</p>}
 {Boolean(view_detail.reviewNote) && <p>最近处理说明：{String(view_detail.reviewNote)}</p>}
 <label>提交 / 审核 / 服务处理说明<textarea maxlength={1000} value={view_note} onInput={e => setNote((e.target as HTMLInputElement).value)} /></label><div class="green-toolbar">
 {['draft', 'returned'].includes(view_detail.status) && <button disabled={view_busy} onClick={() => void transition(view_detail, view_kind === 'consultation' ? 'submitted' : 'review')}>提交{view_kind === 'consultation' ? '申请' : '审核'}</button>}
 {(view_prop_ops ?? false) && view_detail.status === 'review' && <><button disabled={view_busy} onClick={() => void transition(view_detail, 'published')}>审核发布</button><button disabled={view_busy} onClick={() => void transition(view_detail, 'returned')}>退回</button></>}
 {(view_prop_ops ?? false) && view_detail.status === 'published' && <button disabled={view_busy} onClick={() => void transition(view_detail, 'returned')}>撤回</button>}
 {view_kind === 'consultation' && view_detail.status === 'submitted' && <><button disabled={view_busy} onClick={() => void transition(view_detail, 'cancelled')}>取消申请</button>{(view_prop_ops ?? false) && <><button disabled={view_busy} onClick={() => void transition(view_detail, 'accepted')}>受理</button><button disabled={view_busy} onClick={() => void transition(view_detail, 'returned')}>退回补充</button></>}</>}
 {(view_prop_ops ?? false) && view_kind === 'consultation' && view_detail.status === 'accepted' && <button disabled={view_busy} onClick={() => void transition(view_detail, 'completed')}>记录成果并完成服务</button>}
 </div><h3>处理记录</h3>{((view_detail.history || []) as Record<string, string>[]).map((h, i) => <p key={i}>{h.at} · {states[h.to]} · {h.note}</p>)}</section>}
 </section>;
    };
  }
});
