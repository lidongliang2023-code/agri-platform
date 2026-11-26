import './evaluation.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Form, Input, Select, Spin, message } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, FileTextOutlined, MessageOutlined, SafetyCertificateOutlined, SearchOutlined, WarningOutlined } from "@ant-design/icons-vue";
import { useQuery } from "@/vue/query";
import { appealEvaluation, getEvaluationList, replyEvaluation, type EvaluationQuery, type EvaluationVO } from '@/api/evaluation';
import { getMyMerchants } from '@/api/identity';
import { EmptyState, Panel, shortDate } from '../../member-center/shared';
type EvaluationMode = 'list' | 'reply' | 'appeal';
const Stars = defineComponent({
  name: "Stars",
  props: {
    value: null as unknown as PropType<{
      value: number;
    }["value"]>
  },
  setup(__props: {
    value: number;
  }, {
    slots: __slots
  }) {
    return () => {
      return <span class="credit-stars" aria-label={`${__props.value}星`}>{'★'.repeat(Math.round(__props.value))}<i>{'☆'.repeat(Math.max(0, 5 - Math.round(__props.value)))}</i></span>;
    };
  }
});
/** 卖家信用评价管理与回复、申诉工作区。 */
const EvaluationList = defineComponent({
  name: "EvaluationList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const mode = shallowRef<EvaluationMode>('list');
    const setMode = (next: typeof mode.value | ((previous: typeof mode.value) => typeof mode.value)) => {
      mode.value = typeof next === 'function' ? (next as (previous: typeof mode.value) => typeof mode.value)(mode.value) : next;
    };
    const active = shallowRef<EvaluationVO | null>(null);
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const query = shallowRef<EvaluationQuery>({
      pageNum: 1,
      pageSize: 10
    });
    const setQuery = (next: typeof query.value | ((previous: typeof query.value) => typeof query.value)) => {
      query.value = typeof next === 'function' ? (next as (previous: typeof query.value) => typeof query.value)(query.value) : next;
    };
    const draft = shallowRef<{
      evaluationNo?: string;
      ratingOverall?: number;
    }>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const myMerchantIds = shallowRef<string[]>([]);
    const setMyMerchantIds = (next: typeof myMerchantIds.value | ((previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)) => {
      myMerchantIds.value = typeof next === 'function' ? (next as (previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)(myMerchantIds.value) : next;
    };
    const submitting = shallowRef(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const replyForm = Form.useForm();
    const appealForm = Form.useForm();
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          getMyMerchants().then(response => {
            if (response?.code === 200) {
              setMyMerchantIds((response.data ?? []).map(item => String(item.merchantId)));
            }
          }).catch(() => setMyMerchantIds([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const _query = useQuery(() => ({
      queryKey: ['evaluations', query.value],
      queryFn: () => getEvaluationList(query.value)
    }));
    const rows = computed<EvaluationVO[]>(() => _query.data.value?.data?.records ?? []);
    const total = computed(() => Number(_query.data.value?.data?.total ?? 0));
    const currentPage = computed(() => Number(_query.data.value?.data?.current ?? query.value.pageNum ?? 1));
    const pageCount = computed(() => Math.max(1, Math.ceil(total.value / Number(query.value.pageSize ?? 10))));
    const canReply = (row: EvaluationVO): boolean => row.evaluateeId != null && myMerchantIds.value.includes(String(row.evaluateeId)) && !row.replyContent;
    const canAppeal = (row: EvaluationVO): boolean => row.evaluateeId != null && myMerchantIds.value.includes(String(row.evaluateeId));
    const showList = (): void => {
      setMode('list');
      setActive(null);
    };
    const openReply = (row: EvaluationVO): void => {
      setActive(row);
      replyForm.resetFields();
      setMode('reply');
    };
    const openAppeal = (row: EvaluationVO): void => {
      setActive(row);
      appealForm.resetFields();
      setMode('appeal');
    };
    const submitReply = async (): Promise<void> => {
      if (!active.value) return;
      const values = await replyForm.validateFields();
      setSubmitting(true);
      try {
        const response = await replyEvaluation(active.value.id, values.content);
        if (response?.code === 200) {
          message.success('评价回复已公开');
          await _query.refetch();
          showList();
        } else {
          message.error(response?.message ?? '回复失败');
        }
      } catch {
        message.error('回复失败（请检查后端是否在运行）');
      } finally {
        setSubmitting(false);
      }
    };
    const submitAppeal = async (): Promise<void> => {
      if (!active.value) return;
      const values = await appealForm.validateFields();
      setSubmitting(true);
      try {
        const response = await appealEvaluation(active.value.id, values);
        if (response?.code === 200) {
          message.success('评价申诉已提交，等待运营审核');
          showList();
        } else {
          message.error(response?.message ?? '申诉失败');
        }
      } catch {
        message.error('申诉失败（请检查后端是否在运行）');
      } finally {
        setSubmitting(false);
      }
    };
    return () => {
      const view_active = active.value;
      if (mode.value === 'reply' && view_active) {
        return <div class="credit-workbench credit-action-page">
        <button type="button" class="credit-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回信用评价
        </button>
        <section class="credit-action-hero">
          <span class="credit-action-icon"><MessageOutlined /></span>
          <div><small>PUBLIC REPLY</small><h2>回复买家评价</h2><p>{view_active.evaluationNo} · 订单 {view_active.orderId}</p></div>
          <Stars value={view_active.ratingOverall} />
        </section>
        <div class="credit-action-layout">
          <Panel title="公开回复">
            <Form form={replyForm} layout="vertical" onFinish={() => void submitReply()} class="credit-form">
              <div class="credit-evaluation-quote">
                <div><strong>{view_active.evaluatorName || '采购方'}</strong><Stars value={view_active.ratingOverall} /></div>
                <p>{view_active.evaluationContent || '未填写文字评价'}</p>
              </div>
              <Form.Item name="content" label="回复内容" rules={[{
                  required: true,
                  message: '请填写回复内容'
                }]}>
                <Input.TextArea rows={6} placeholder="回应采购方反馈，例如说明品质、物流或后续改进措施" showCount maxLength={500} />
              </Form.Item>
              <div class="credit-action-buttons">
                <button type="submit" class="mc-btn" disabled={submitting.value}>{submitting.value ? '正在提交…' : '发布回复'}</button>
                <button type="button" class="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="credit-action-aside">
            <Panel title="回复说明">
              <ul class="credit-guidance">
                <li><CheckCircleOutlined /> 回复会以当前卖家主体名义公开展示。</li>
                <li><CheckCircleOutlined /> 每条评价只允许回复一次，请确认后再提交。</li>
                <li><SafetyCertificateOutlined /> 回复会与评价一起保留交易留痕。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (mode.value === 'appeal' && view_active) {
        return <div class="credit-workbench credit-action-page">
        <button type="button" class="credit-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回信用评价
        </button>
        <section class="credit-action-hero appeal">
          <span class="credit-action-icon"><WarningOutlined /></span>
          <div><small>EVALUATION APPEAL</small><h2>发起评价申诉</h2><p>{view_active.evaluationNo} · 订单 {view_active.orderId}</p></div>
          <Stars value={view_active.ratingOverall} />
        </section>
        <div class="credit-action-layout">
          <Panel title="申诉信息">
            <Form form={appealForm} layout="vertical" onFinish={() => void submitAppeal()} class="credit-form">
              <div class="credit-evaluation-quote">
                <div><strong>{view_active.evaluatorName || '采购方'}</strong><Stars value={view_active.ratingOverall} /></div>
                <p>{view_active.evaluationContent || '未填写文字评价'}</p>
              </div>
              <Form.Item name="appealType" label="申诉类型" rules={[{
                  required: true,
                  message: '请选择申诉类型'
                }]}>
                <Select options={[{
                    value: 'false_content',
                    label: '评价内容不实'
                  }, {
                    value: 'not_my_order',
                    label: '评价不属于本订单'
                  }, {
                    value: 'malicious',
                    label: '恶意差评'
                  }, {
                    value: 'other',
                    label: '其他情况'
                  }]} />
              </Form.Item>
              <Form.Item name="appealReason" label="申诉理由" rules={[{
                  required: true,
                  message: '请填写申诉理由'
                }]}>
                <Input.TextArea rows={5} placeholder="请说明评价内容与真实交易情况不符的具体原因" showCount maxLength={500} />
              </Form.Item>
              <Form.Item name="appealEvidence" label="证据说明">
                <Input.TextArea rows={3} placeholder="可填写聊天记录、质检报告编号、物流凭证等" />
              </Form.Item>
              <div class="credit-action-buttons">
                <button type="submit" class="mc-btn" disabled={submitting.value}>{submitting.value ? '正在提交…' : '提交申诉'}</button>
                <button type="button" class="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="credit-action-aside">
            <Panel title="申诉须知">
              <ul class="credit-guidance">
                <li><WarningOutlined /> 只有被评价的卖家主体可以发起申诉。</li>
                <li><FileTextOutlined /> 运营审核通过后评价会被隐藏。</li>
                <li><SafetyCertificateOutlined /> 请提供客观证据，申诉过程会完整留痕。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      return <div class="credit-workbench">
      <div class="credit-toolbar">
        <div class="credit-toolbar-fields">
          <Input prefix={<SearchOutlined />} allowClear placeholder="输入评价编号" value={draft.value.evaluationNo} onChange={event => setDraft(previous => ({
              ...previous,
              evaluationNo: (event.target.value ?? '') || undefined
            }))} />
          <Select allowClear placeholder="综合评分" value={draft.value.ratingOverall} onChange={value => setDraft(previous => ({
              ...previous,
              ratingOverall: value
            }))} options={[5, 4, 3, 2, 1].map(value => ({
              value,
              label: `${value} 星`
            }))} />
        </div>
        <div class="credit-toolbar-actions">
          <span class="credit-count">共 {total.value} 条</span>
          <button type="button" class="mc-btn" onClick={() => setQuery(previous => ({
              ...previous,
              pageNum: 1,
              ...draft.value
            }))}>搜索</button>
          <button type="button" class="mc-btn ghost" onClick={() => {
              setDraft({});
              setQuery({
                pageNum: 1,
                pageSize: 10
              });
            }}>重置</button>
        </div>
      </div>

      {_query.isLoading.value ? <div class="credit-loading"><Spin /><span>正在读取评价记录…</span></div> : rows.value.length === 0 ? <EmptyState title="没有符合条件的评价" desc="订单完成后采购方提交的评价会显示在这里。" /> : <div class="credit-evaluation-list">
          {rows.value.map(row => <div class="credit-evaluation-card" key={row.id}>
              <div class="credit-evaluation-main">
                <span class="credit-evaluation-avatar">{row.evaluatorName?.slice(0, 1) || '客'}</span>
                <div>
                  <div class="credit-evaluation-meta">
                    <strong>{row.evaluatorName || '采购方'}</strong>
                    <Stars value={row.ratingOverall} />
                    <span class={`mc-tag ${row.evaluationStatus === 'hidden' ? 'ghost' : 'green'}`}>
                      {row.evaluationStatus === 'hidden' ? '已隐藏' : '展示中'}
                    </span>
                    <span class="mc-tag ghost">{row.isAnonymous === 1 ? '匿名' : '实名'}</span>
                  </div>
                  <p>{row.evaluationContent || '未填写文字评价'}</p>
                  {row.replyContent && <div class="credit-existing-reply"><MessageOutlined /> 我方回复：{row.replyContent}</div>}
                  <small>{row.evaluationNo} · 订单 {row.orderId} · {shortDate(row.createTime)}</small>
                </div>
              </div>
              <div class="credit-evaluation-actions">
                {canReply(row) && <button type="button" class="mc-btn" onClick={() => openReply(row)}>
                    <MessageOutlined /> 回复评价
                  </button>}
                {canAppeal(row) && <button type="button" class="mc-btn ghost" onClick={() => openAppeal(row)}>
                    <WarningOutlined /> 发起申诉
                  </button>}
              </div>
            </div>)}
        </div>}
      {rows.value.length > 0 && <div class="mc-pager">
          <button type="button" disabled={currentPage.value <= 1} onClick={() => setQuery(previous => ({
            ...previous,
            pageNum: currentPage.value - 1
          }))}>上一页</button>
          <span>第 {currentPage.value} / {pageCount.value} 页 · 共 {total.value} 条</span>
          <button type="button" disabled={currentPage.value >= pageCount.value} onClick={() => setQuery(previous => ({
            ...previous,
            pageNum: currentPage.value + 1
          }))}>下一页</button>
        </div>}
    </div>;
    };
  }
});
export default EvaluationList;
