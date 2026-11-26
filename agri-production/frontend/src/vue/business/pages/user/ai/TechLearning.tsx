import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, App, Button, Card, Col, Empty, Input, List, Progress, Radio, Row, Space, Statistic, Steps, Tag, Typography } from '@/vue/ui';
import { BookOutlined, CheckCircleOutlined, SendOutlined, TrophyOutlined } from '@ant-design/icons-vue';
import { PageContainer as PageContainer } from '@/vue/pro';
import { answerTraining, askTech, completeTraining, createTraining, getTraining, listTechQaHistory, listTrainings } from '@/api/tech-learning';
import type { QaResult, TrainingDetail } from '@/api/tech-learning';
const TOPICS = ['病虫害识别基础', '农事日历编排', '投入品安全校验', '采收与销售管理', '绿色生产规范'];
const TechLearning = defineComponent({
  name: "TechLearning",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const client = useQueryClient();
    const question = shallowRef('');
    const setQuestion = (next: typeof question.value | ((previous: typeof question.value) => typeof question.value)) => {
      question.value = typeof next === 'function' ? (next as (previous: typeof question.value) => typeof question.value)(question.value) : next;
    };
    const qa = shallowRef<QaResult>();
    const setQa = (next: typeof qa.value | ((previous: typeof qa.value) => typeof qa.value)) => {
      qa.value = typeof next === 'function' ? (next as (previous: typeof qa.value) => typeof qa.value)(qa.value) : next;
    };
    const topic = shallowRef(TOPICS[0]);
    const setTopic = (next: typeof topic.value | ((previous: typeof topic.value) => typeof topic.value)) => {
      topic.value = typeof next === 'function' ? (next as (previous: typeof topic.value) => typeof topic.value)(topic.value) : next;
    };
    const training = shallowRef<TrainingDetail>();
    const setTraining = (next: typeof training.value | ((previous: typeof training.value) => typeof training.value)) => {
      training.value = typeof next === 'function' ? (next as (previous: typeof training.value) => typeof training.value)(training.value) : next;
    };
    const answer = shallowRef('');
    const setAnswer = (next: typeof answer.value | ((previous: typeof answer.value) => typeof answer.value)) => {
      answer.value = typeof next === 'function' ? (next as (previous: typeof answer.value) => typeof answer.value)(answer.value) : next;
    };
    const qaHistory = useQuery(() => ({
      queryKey: ['tech-qa-history'],
      queryFn: listTechQaHistory
    }));
    const trainings = useQuery(() => ({
      queryKey: ['tech-trainings'],
      queryFn: listTrainings
    }));
    const ask = useMutation(() => ({
      mutationFn: () => askTech(question.value),
      onSuccess: r => {
        setQa(r);
        setQuestion('');
        void client.invalidateQueries({
          queryKey: ['tech-qa-history']
        });
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const create = useMutation(() => ({
      mutationFn: () => createTraining({
        topic: topic.value,
        level: 'BASIC',
        questionCount: 5
      }),
      onSuccess: r => {
        setTraining(r);
        setAnswer('');
        void client.invalidateQueries({
          queryKey: ['tech-trainings']
        });
        message.success('陪练已生成，题目依据已冻结');
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const submitAnswer = useMutation(() => ({
      mutationFn: () => answerTraining(training.value!.training_id, currentQuestion.value!.question_no, answer.value),
      onSuccess: r => {
        message.info(Boolean(r.correct) ? '回答正确' : `回答完成，正确答案：${String(r.correctAnswer)}`);
        setAnswer('');
        void loadTraining();
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const finish = useMutation(() => ({
      mutationFn: () => completeTraining(training.value!.training_id),
      onSuccess: r => {
        setTraining(r);
        message.success(`练习完成，得分 ${r.score ?? 0}`);
        void client.invalidateQueries({
          queryKey: ['tech-trainings']
        });
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const loadTraining = async (): Promise<void> => {
      if (training.value) setTraining(await getTraining(training.value.training_id));
    };
    const currentQuestion = computed(() => training.value?.questions.find(q => !q.user_answer));
    const progress = computed(() => training.value ? Math.round(training.value.answered_count / Math.max(training.value.question_count, 1) * 100) : 0);
    return () => {
      return <PageContainer title="农技知识问答与培训陪练" subTitle="知识库检索问答 · 结构化培训练习 · 评分与错题回练">
    <Space direction="vertical" size={20} style={{
          width: '100%'
        }}>
      <div style={{
            background: 'linear-gradient(110deg,#0d6e88,#0b5566)',
            color: '#fff',
            borderRadius: 14,
            padding: '24px 28px'
          }}><Space align="start"><BookOutlined style={{
                fontSize: 28
              }} /><div><Tag color="cyan">AI 农技助手 · 场景 50</Tag><Typography.Title level={3} style={{
                  color: '#fff',
                  margin: '10px 0 4px'
                }}>基于已发布知识的农技问答与岗位陪练</Typography.Title><Typography.Text style={{
                  color: '#e7f6f8'
                }}>问答展示可追溯知识依据；陪练按主题出题、提交答案、结算成绩，错题进入复训参考。</Typography.Text></div></Space></div>
      <Steps size="small" current={training.value ? training.value.status === 'IN_PROGRESS' ? 1 : 3 : 0} items={[{
            title: '知识检索'
          }, {
            title: '陪练出题'
          }, {
            title: '作答反馈'
          }, {
            title: '评分留痕'
          }]} />
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={13}><Card title="农技知识问答" extra={<Tag color="blue">只引用已发布知识</Tag>}>
          <Alert type="info" showIcon message="问答边界" description="可回答知识库中的栽培、植保和规范问题；涉及确诊、具体用药剂量、任务下发时，会转入对应业务流程，不直接给结论。" />
          <Input.TextArea value={question.value} onChange={e => setQuestion(e.target.value)} onPressEnter={e => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    if (question.value.trim()) ask.mutate();
                  }
                }} rows={4} maxLength={2000} showCount placeholder="例如：设施番茄越夏栽培要注意哪些环节？" style={{
                  marginTop: 16
                }} />
          <Button type="primary" icon={<SendOutlined />} loading={ask.isPending} disabled={!question.value.trim()} onClick={() => ask.mutate()} style={{
                  marginTop: 12
                }}>检索并回答</Button>
          {qa.value && <Card size="small" title={<Space><CheckCircleOutlined style={{
                    color: '#3c8c62'
                  }} />回答结果<Tag color={qa.value.status === 'ANSWERED' ? 'success' : 'warning'}>{qa.value.status === 'ANSWERED' ? '有依据' : '需复核'}</Tag></Space>} style={{
                  marginTop: 18
                }}><Typography.Paragraph style={{
                    whiteSpace: 'pre-wrap'
                  }}>{qa.value.answer}</Typography.Paragraph><Typography.Text type="secondary">置信度：{(qa.value.confidence * 100).toFixed(0)}% · 记录号：{qa.value.recordId}</Typography.Text><List size="small" header="知识来源快照" dataSource={qa.value.sources} locale={{
                    emptyText: '无可引用来源'
                  }} renderItem={s => <List.Item><List.Item.Meta title={s.title} description={`${s.source ?? '来源未记录'} · ${s.publishAt ?? '发布时间未记录'} · ${s.articleId}`} /></List.Item>} /></Card>}
        </Card></Col>
        <Col xs={24} xl={11}><Card title="培训陪练" extra={<TrophyOutlined style={{
                color: '#d99832'
              }} />}>
          <Alert type="warning" showIcon message="陪练不代替现场培训" description="题目来源于已发布知识，成绩只反映本次答题；低分或错题请回到知识出处和农技员培训流程。" />
          <Space wrap style={{
                  marginTop: 16
                }}><Radio.Group value={topic.value} onChange={e => setTopic(e.target.value)} options={TOPICS.map(x => ({
                    label: x,
                    value: x
                  }))} optionType="button" buttonStyle="solid" /></Space>
          <Button type="primary" loading={create.isPending} onClick={() => create.mutate()} style={{
                  marginTop: 16
                }}>开始主题陪练</Button>
          {!training.value ? <Empty description="选择主题后开始陪练" style={{
                  marginTop: 24
                }} /> : <div style={{
                  marginTop: 20
                }}><Space direction="vertical" style={{
                    width: '100%'
                  }}><Typography.Title level={5}>{training.value.title}</Typography.Title><Progress percent={progress.value} status={training.value.status === 'NEEDS_REVIEW' ? 'exception' : undefined} /><Typography.Text type="secondary">已答 {training.value.answered_count} / {training.value.question_count} · 正确 {training.value.correct_count}</Typography.Text>{currentQuestion.value ? <Card size="small" title={`第 ${currentQuestion.value.question_no} 题`}><Typography.Paragraph>{currentQuestion.value.question_text}</Typography.Paragraph><Radio.Group value={answer.value} onChange={e => setAnswer(e.target.value)}><Space direction="vertical">{currentQuestion.value.options.map((o, i) => <Radio key={o} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)}. {o}</Radio>)}</Space></Radio.Group><br /><Button type="primary" disabled={!answer.value} loading={submitAnswer.isPending} onClick={() => submitAnswer.mutate()} style={{
                        marginTop: 14
                      }}>提交答案</Button></Card> : training.value.status === 'IN_PROGRESS' ? <Button type="primary" onClick={() => finish.mutate()} loading={finish.isPending}>结算成绩</Button> : <Statistic title="本次成绩" value={training.value.score ?? 0} suffix="分" valueStyle={{
                      color: training.value.status === 'COMPLETED' ? '#3c8c62' : '#cf4b47'
                    }} />}</Space></div>}
        </Card></Col>
      </Row>
      <Row gutter={[20, 20]}><Col xs={24} xl={12}><Card title="问答历史"><List size="small" loading={qaHistory.isLoading} dataSource={qaHistory.data ?? []} locale={{
                  emptyText: <Empty description="暂无问答记录" />
                }} renderItem={r => <List.Item><List.Item.Meta title={String(r.question)} description={`${String(r.status)} · ${String(r.create_time)}`} /></List.Item>} /></Card></Col><Col xs={24} xl={12}><Card title="培训历史"><List size="small" loading={trainings.isLoading} dataSource={trainings.data ?? []} locale={{
                  emptyText: <Empty description="暂无培训记录" />
                }} renderItem={r => <List.Item><List.Item.Meta title={String(r.title)} description={`${String(r.status)} · 已答 ${String(r.answered_count)}/${String(r.question_count)} · 得分 ${String(r.score ?? '—')}`} /></List.Item>} /></Card></Col></Row>
      <Alert type="warning" showIcon message="规则与边界" description="知识问答只引用已发布文章并保存来源快照；无匹配依据时明确提示需人工补充。培训题目、答案、评分和完成状态独立落库，不写入普通聊天消息，不创建农事任务，不替代病虫害诊断、投入品安全校验和农事计划。" />
      <Row gutter={[20, 20]}><Col xs={24} md={8}><Card title="使用角色 / 适用对象">种植户、合作社记录员、农技员和新入职生产人员。</Card></Col><Col xs={24} md={8}><Card title="业务价值">把知识检索、岗位练习和结果留痕放到同一闭环，便于复训和能力评估。</Card></Col><Col xs={24} md={8}><Card title="依赖组件 / 关联模块">已发布知识文章、SOP规程、AI调度、病虫害诊断、用药安全校验和农事任务。</Card></Col></Row>
    </Space>
  </PageContainer>;
    };
  }
});
export default TechLearning;
