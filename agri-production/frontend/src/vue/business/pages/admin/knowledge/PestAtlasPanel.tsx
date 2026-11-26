import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, App, Button, Card, Col, Drawer, Form, Input, Modal, Row, Select, Space, Switch, Tag, Typography } from '@/vue/ui';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { AgriAntdvJsxList as Table } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { http } from '@/utils/request';
import { listPestAtlas, publishPestAtlas, savePestAtlas } from '@/api/pest-atlas';
import type { KnowledgeSnapshot, PestAtlasEntry } from '@/api/pest-atlas';
import PestKnowledgeEvidence from '@/vue/business/pages/user/ai/PestKnowledgeEvidence';
const statusNames = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下架'
};
const PestAtlasPanel = defineComponent({
  name: "PestAtlasPanel",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const cache = useQueryClient();
    const form = Form.useForm<PestAtlasEntry>();
    const searchForm = Form.useForm();
    const editing = shallowRef<Partial<PestAtlasEntry>>();
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const status = shallowRef<string>();
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const searchOpen = shallowRef(false);
    const setSearchOpen = (next: typeof searchOpen.value | ((previous: typeof searchOpen.value) => typeof searchOpen.value)) => {
      searchOpen.value = typeof next === 'function' ? (next as (previous: typeof searchOpen.value) => typeof searchOpen.value)(searchOpen.value) : next;
    };
    const list = useQuery(() => ({
      queryKey: ['pest-atlas', keyword.value, status.value, page.value, pageSize.value],
      queryFn: () => listPestAtlas({
        keyword: keyword.value,
        status: status.value,
        pageNum: page.value,
        pageSize: pageSize.value
      })
    }));
    const saved = (): void => {
      void cache.invalidateQueries({
        queryKey: ['pest-atlas']
      });
    };
    const save = useMutation(() => ({
      mutationFn: (values: PestAtlasEntry) => savePestAtlas({
        ...values,
        id: editing.value?.id,
        revision: editing.value?.revision
      }),
      onSuccess: () => {
        setEditing(undefined);
        saved();
        message.success('图谱草稿已保存，发布后参与新诊断');
      },
      onError: (error: Error) => message.error(error.message)
    }));
    const publish = useMutation(() => ({
      mutationFn: publishPestAtlas,
      onSuccess: () => {
        saved();
        message.success('图谱状态已更新，历史病例快照保持不变');
      },
      onError: (error: Error) => message.error(error.message)
    }));
    const search = useMutation(() => ({
      mutationFn: (values: {
        cropName: string;
        symptoms: string;
      }) => http.get<KnowledgeSnapshot>('/admin/knowledge/pest-atlas/search', values),
      onError: (error: Error) => message.error(error.message)
    }));
    const edit = (entry: Partial<PestAtlasEntry>): void => {
      form.resetFields();
      form.setFieldsValue(entry);
      setEditing(entry);
    };
    return () => {
      return <Card title="病虫害图谱 · 结构化识别依据">
    <Alert showIcon type="info" message="图谱管理识别关系，文章管理知识正文" description="只有已审核发布的条目参与诊断。按作物、症状和部位检索后交给视觉模型核验，非病斑图片相似度检索。编辑已发布条目会转回草稿，须重新发布。" style={{
          marginBottom: 12
        }} />
    {list.isError && <Alert type="error" message="图谱加载失败" description={(list.error as Error).message} style={{
          marginBottom: 12
        }} />}
    <Table rowKey="id" loading={list.isLoading} dataSource={list.data?.list ?? []} rowSelection={{}} columnSettingsStorageKey="agri:production:visible-columns:v1:admin-pest-atlas" columnWidthStorageKey="agri:production:column-widths:v1:admin-pest-atlas" onRefresh={() => void list.refetch()} filterSlot={<div class="production-filter-grid">
          <div class="production-filter-field"><label>关键词</label><Input allowClear value={keyword.value} placeholder="作物、病名或来源" onChange={e => {
              setKeyword(e.target.value);
              setPage(1);
            }} /></div>
          <div class="production-filter-field"><label>状态</label><Select allowClear value={status.value} placeholder="全部" options={Object.entries(statusNames).map(([value, label]) => ({
              value,
              label
            }))} onChange={value => {
              setStatus(value);
              setPage(1);
            }} /></div>
          <div class="production-filter-actions">
            <Button onClick={() => {
              setKeyword('');
              setStatus(undefined);
              setPage(1);
            }}>重置</Button>
            <Button type="primary" loading={list.isFetching} onClick={() => {
              setPage(1);
              void list.refetch();
            }}>查询</Button>
          </div>
        </div>} toolbarLeft={<Space size={8}><Button type="primary" onClick={() => edit({
            quarantine: false
          })}>新增图谱条目</Button><Button onClick={() => {
            search.reset();
            setSearchOpen(true);
          }}>检索试跑</Button></Space>} scroll={{
          x: 1000
        }} pagination={{
          current: page.value,
          pageSize: pageSize.value,
          total: list.data?.total ?? 0,
          onChange: (p, s) => {
            setPage(s === pageSize.value ? p : 1);
            setPageSize(s);
          }
        }} locale={{
          emptyText: '暂无图谱条目，请录入有真实出处的识别依据并审核发布'
        }} columns={[{
          title: '作物 / 病虫害',
          key: 'cropDisease',
          width: 240,
          render: (_, r) => <><Typography.Text strong>{r.cropName} · {r.diseaseName}</Typography.Text><div>{r.quarantine && <Tag color="red">检疫疑似需上报</Tag>}</div></>
        }, {
          title: '症状关键词',
          key: 'symptomKeywords',
          width: 220,
          render: (_, r) => r.symptomKeywords.join('、')
        }, {
          title: '出处 / 版本',
          key: 'source',
          width: 220,
          render: (_, r) => <>{r.source || '待填写'}<div>{r.sourceVersion || '待填写'} · 图谱修订 {r.revision}</div></>
        }, {
          title: '状态',
          key: 'status',
          width: 100,
          render: (_, r) => <Tag color={r.status === 'PUBLISHED' ? 'success' : 'default'}>{statusNames[r.status as keyof typeof statusNames] ?? r.status}</Tag>
        }, {
          title: '操作',
          key: 'action',
          width: 170,
          fixed: 'right',
          render: (_, r) => <ListRowActions items={[<Button key="edit" type="link" size="small" onClick={() => edit(r)}>编辑</Button>, <Button key="pub" type="link" size="small" loading={publish.isPending} onClick={() => publish.mutate(r)}>{r.status === 'PUBLISHED' ? '下架' : '审核发布'}</Button>]} />
        }]} />
    <Drawer title={editing.value?.id ? '编辑图谱（保存后为草稿）' : '新增病虫害图谱'} width={760} open={Boolean(editing.value)} onClose={() => !save.isPending && setEditing(undefined)} extra={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>保存草稿</Button>}>
      <Form form={form} layout="vertical" onFinish={values => save.mutate(values)} disabled={save.isPending}>
        <Row gutter={16}>{[['cropName', '作物名称'], ['diseaseName', '标准病虫害名称']].map(([name, label]) => <Col span={12} key={name}><Form.Item name={name} label={label} rules={[{
                  required: true,
                  whitespace: true,
                  max: 100
                }]}><Input maxLength={100} /></Form.Item></Col>)}</Row>
        {([['cropAliases', '作物别名', 20], ['diseaseAliases', '病虫害别名', 20], ['symptomKeywords', '症状关键词', 20], ['affectedParts', '受害部位', 10], ['growthStages', '适用生育阶段（可选）', 10]] as const).map(([name, label, count]) => <Form.Item key={name} name={name} label={`${label}（最多${count}项）`}><Select mode="tags" tokenSeparators={['，', ',']} open={false} placeholder="输入后按回车添加，也可用逗号分隔" /></Form.Item>)}
        {([['identification', '识别依据'], ['differential', '易混淆病因与鉴别要点'], ['measures', '农艺、物理防治与采样建议']] as const).map(([name, label]) => <Form.Item name={name} label={label} key={name}><Input.TextArea rows={3} maxLength={5000} showCount /></Form.Item>)}
        <Alert type="warning" showIcon message="不要把图谱防治建议用作自动用药处方，农药登记与剂量仍须专业人员核对。" style={{
              marginBottom: 16
            }} />
        <Row gutter={16}><Col span={12}><Form.Item name="source" label="来源机构 / 文献"><Input maxLength={500} /></Form.Item></Col><Col span={12}><Form.Item name="sourceVersion" label="文献版本 / 日期"><Input maxLength={500} /></Form.Item></Col></Row>
        <Form.Item name="sourceRef" label="出处章节、页码或资料编号"><Input maxLength={500} /></Form.Item>
        <Form.Item name="articleId" label="关联现有病虫害知识文章编号（可选）" extra="不复制文章正文；关联后仅在文章已发布且有正文时参与新诊断。"><Input maxLength={64} /></Form.Item>
        <Form.Item name="quarantine" label="属于检疫性病虫害（须按有效名录审核）" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Drawer>
    <Modal title="已发布图谱检索试跑" open={searchOpen.value} footer={null} width={800} onCancel={() => setSearchOpen(false)}>
      <Form form={searchForm} layout="vertical" onFinish={values => search.mutate(values)}><Form.Item name="cropName" label="作物名称 / 别名" rules={[{
              required: true,
              max: 100
            }]}><Input maxLength={100} /></Form.Item><Form.Item name="symptoms" label="现场症状" rules={[{
              required: true,
              max: 3000
            }]}><Input.TextArea rows={3} maxLength={3000} /></Form.Item><Button type="primary" htmlType="submit" loading={search.isPending}>检索已发布依据</Button></Form>
      {search.data && <div style={{
            marginTop: 16
          }}><PestKnowledgeEvidence snapshot={search.data} /></div>}
    </Modal>
  </Card>;
    };
  }
});
export default PestAtlasPanel;
