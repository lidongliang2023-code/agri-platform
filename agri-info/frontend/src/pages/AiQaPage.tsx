import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { RobotOutlined, SendOutlined, UserOutlined } from "@ant-design/icons-vue";
import { Button, Input, Select, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { AiAnswer, QaRecord } from '../types';
import { AiCard, EmptyState, PageTitle, SectionHeading } from '../components/ui';
interface Turn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  answer?: AiAnswer;
  createdAt: string;
}
const CROPS = ['', '大蒜', '辣椒', '西红柿', '水稻', '小麦', '玉米', '苹果', '番茄', '黄瓜', '草莓'];
const PRESETS = ['大蒜叶片从叶尖开始干枯是什么病？', '水稻分蘖期需要施多少氮肥？', '番茄叶片发黄是缺钾还是缺镁？', '辣椒落花落果怎么处理？'];

/**
 * AI 农技问答：答案全部来自平台知识库检索（二元组重叠打分），
 * 因此每条回答都带来源引用；检索不到时如实提示而不是编造。
 */
export const AiQaPage = defineComponent({
  name: "AiQaPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const turns = ref<Turn[]>([]);
    const setTurns = (next: Turn[] | ((previous: Turn[]) => Turn[])) => {
      turns.value = typeof next === 'function' ? (next as (previous: Turn[]) => Turn[])(turns.value) : next;
    };
    const question = ref('');
    const setQuestion = (next: typeof question.value | ((previous: typeof question.value) => typeof question.value)) => {
      question.value = typeof next === 'function' ? (next as (previous: typeof question.value) => typeof question.value)(question.value) : next;
    };
    const crop = ref('');
    const setCrop = (next: typeof crop.value | ((previous: typeof crop.value) => typeof crop.value)) => {
      crop.value = typeof next === 'function' ? (next as (previous: typeof crop.value) => typeof crop.value)(crop.value) : next;
    };
    const asking = ref(false);
    const setAsking = (next: typeof asking.value | ((previous: typeof asking.value) => typeof asking.value)) => {
      asking.value = typeof next === 'function' ? (next as (previous: typeof asking.value) => typeof asking.value)(asking.value) : next;
    };
    const records = ref<QaRecord[]>([]);
    const setRecords = (next: QaRecord[] | ((previous: QaRecord[]) => QaRecord[])) => {
      records.value = typeof next === 'function' ? (next as (previous: QaRecord[]) => QaRecord[])(records.value) : next;
    };
    const bottomRef = shallowRef<HTMLDivElement | null>(null);
    const loadRecords = (): void => {
      infoApi.qaRecords().then(setRecords).catch(() => setRecords([]));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = loadRecords();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    onMounted(() => {
      watch(() => [turns.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          bottomRef.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const ask = (text: string): void => {
      const content = text.trim();
      if (!content) return;
      const now = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      setTurns(previous => [...previous, {
        id: `u-${Date.now()}`,
        role: 'user',
        text: content,
        createdAt: now
      }]);
      setQuestion('');
      setAsking(true);
      infoApi.askAi({
        question: content,
        crop: crop.value || undefined
      }).then(answer => {
        setTurns(previous => [...previous, {
          id: `a-${Date.now()}`,
          role: 'ai',
          text: answer.answer,
          answer,
          createdAt: new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }]);
        loadRecords();
      }).catch((reason: Error) => {
        message.error(reason.message);
        setTurns(previous => [...previous, {
          id: `e-${Date.now()}`,
          role: 'ai',
          text: `抱歉，服务暂时不可用：${reason.message}`,
          createdAt: now
        }]);
      }).finally(() => setAsking(false));
    };
    return () => {
      const view_navigate = navigate.value;
      const view_crop = crop.value;
      const view_turns = turns.value;
      const view_asking = asking.value;
      const view_question = question.value;
      const view_records = records.value;
      return <div class="page-stack">
      <PageTitle eyebrow="AI ASSISTANT" title="AI 农技问答" description="基于平台知识库与专家问答记录检索作答，回答附带来源引用与置信度 · 疑难问题可一键转人工专家" actions={<Button onClick={() => view_navigate('pest')}>📷 拍照识病虫</Button>} />

      <div class="grid-main-aside">
        <section class="surface-card">
          <div class="row" style={{
              gap: "10px",
              marginBottom: "12px"
            }}>
            <span class="small muted">作物上下文</span>
            <Select style={{
                width: "160px"
              }} value={view_crop} onChange={value => setCrop(String(value ?? ''))} options={CROPS.map(item => ({
                value: item,
                label: item || '不限作物'
              }))} />
            <span class="small muted">选定作物可显著提升检索命中率</span>
          </div>

          <div class="chat-window tall">
            {view_turns.length === 0 && <EmptyState icon="🌾" title="问点什么吧" description="例如：大蒜叶枯病怎么防治？水稻分蘖期施多少氮肥？" />}
            {view_turns.map(turn => <div class={`chat-item ${turn.role === 'user' ? 'out' : 'in'}`} key={turn.id}>
                <span class="chat-avatar">{turn.role === 'user' ? <UserOutlined /> : <RobotOutlined />}</span>
                <div class="chat-content">
                  <div class="chat-meta">
                    <b>{turn.role === 'user' ? '我' : 'AI 农技助手'}</b>
                    <span>{turn.createdAt}</span>
                  </div>
                  <div class="chat-msg">{turn.text}</div>
                  {turn.answer && <div class="chat-extras">
                      <div class="row" style={{
                      gap: "6px",
                      flexWrap: 'wrap'
                    }}>
                        <Tag class="soft-tag tone-green">置信度 {turn.answer.confidence}%</Tag>
                        <Tag class="soft-tag">{turn.answer.category}</Tag>
                        <Tag class="soft-tag">编号 {turn.answer.qaNo}</Tag>
                      </div>
                      {turn.answer.sourceRefs.length > 0 && <p class="small muted">来源：{turn.answer.sourceRefs.join('、')}</p>}
                      {turn.answer.related.length > 0 && <div class="row" style={{
                      gap: "6px",
                      flexWrap: 'wrap'
                    }}>
                          {turn.answer.related.map(item => <button type="button" key={item.id} class="chip" onClick={() => view_navigate('knowledge', item.id)}>
                              {item.title}
                            </button>)}
                        </div>}
                      {turn.answer.expertAvailable && <Button size="small" onClick={() => view_navigate('expert')}>转人工专家</Button>}
                    </div>}
                </div>
              </div>)}
            {view_asking && <div class="chat-item in">
                <span class="chat-avatar"><RobotOutlined /></span>
                <div class="chat-content">
                  <div class="chat-msg typing">正在检索知识库…</div>
                </div>
              </div>}
            <div ref={(el: any) => {
                bottomRef.value = el;
              }} />
          </div>

          <div class="chat-input-row">
            <Input.TextArea rows={2} maxlength={200} value={view_question} placeholder="描述您的种植问题，越具体越准确（作物 + 症状 + 发生时间）" onChange={event => setQuestion((event.target as HTMLInputElement).value)} onPressEnter={event => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  ask(view_question);
                }
              }} />
            <Button type="primary" icon={<SendOutlined />} loading={view_asking} onClick={() => ask(view_question)}>提问</Button>
          </div>

          <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap',
              marginTop: "10px"
            }}>
            {PRESETS.map(preset => <button type="button" key={preset} class="chip" onClick={() => ask(preset)}>{preset}</button>)}
          </div>
        </section>

        <div class="stack">
          <AiCard title="AI 能力边界" confidence={92}>
            平台 AI 只基于已审核的农技知识与历史专家问答作答，不臆造药剂用量；涉及用药剂量时，请以产品标签与当地植保站指导为准。
          </AiCard>

          <section class="surface-card">
            <SectionHeading kicker="HISTORY" title="我的提问记录" />
            {view_records.length === 0 && <p class="muted small">还没有提问记录。</p>}
            <div class="stack" style={{
                gap: "10px"
              }}>
              {view_records.slice(0, 8).map(record => <div class="surface-card flat" key={record.id}>
                  <div class="row between">
                    <b style={{
                      fontSize: "13px"
                    }}>{record.question}</b>
                    <Tag class="soft-tag">{record.qaType === 'pest' ? '病虫识别' : '问答'}</Tag>
                  </div>
                  <p class="small muted" style={{
                    marginTop: "6px"
                  }}>{record.answer.slice(0, 60)}…</p>
                  <p class="small muted">{record.crop || '不限作物'} · {record.createdAt} · 置信度 {record.confidence}%</p>
                </div>)}
            </div>
          </section>
        </div>
      </div>
    </div>;
    };
  }
});
