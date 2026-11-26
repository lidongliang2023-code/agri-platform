import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { App, Button, Card, Form, Image, Input, Modal, Select, Space, Tag, Upload } from '@/vue/ui';
import type { UploadFile } from '@/vue/ui';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { AgriAntdvJsxList as Table } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { listPestAtlas, listPestImageSamples, publishPestImageSample, uploadPestImageSample } from '@/api/pest-atlas';
import type { PestAtlasEntry, PestImageSample } from '@/api/pest-atlas';
const labels: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFFLINE: '已下架'
};
const PestImageSamplesPanel = defineComponent({
  name: "PestImageSamplesPanel",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const cache = useQueryClient();
    const atlasId = shallowRef<string>();
    const setAtlasId = (next: typeof atlasId.value | ((previous: typeof atlasId.value) => typeof atlasId.value)) => {
      atlasId.value = typeof next === 'function' ? (next as (previous: typeof atlasId.value) => typeof atlasId.value)(atlasId.value) : next;
    };
    const uploadOpen = shallowRef(false);
    const setUploadOpen = (next: typeof uploadOpen.value | ((previous: typeof uploadOpen.value) => typeof uploadOpen.value)) => {
      uploadOpen.value = typeof next === 'function' ? (next as (previous: typeof uploadOpen.value) => typeof uploadOpen.value)(uploadOpen.value) : next;
    };
    const file = shallowRef<UploadFile>();
    const setFile = (next: typeof file.value | ((previous: typeof file.value) => typeof file.value)) => {
      file.value = typeof next === 'function' ? (next as (previous: typeof file.value) => typeof file.value)(file.value) : next;
    };
    const form = Form.useForm();
    const atlas = useQuery(() => ({
      queryKey: ['pest-atlas-sample-options'],
      queryFn: () => listPestAtlas({
        status: 'PUBLISHED',
        pageNum: 1,
        pageSize: 50
      })
    }));
    const samples = useQuery(() => ({
      queryKey: ['pest-image-samples', atlasId.value],
      queryFn: () => listPestImageSamples({
        atlasId: atlasId.value
      }),
      enabled: Boolean(atlasId.value)
    }));
    const refresh = (): void => {
      void cache.invalidateQueries({
        queryKey: ['pest-image-samples']
      });
    };
    const upload = useMutation(() => ({
      mutationFn: async (values: Record<string, string>) => {
        if (!file.value?.originFileObj) throw new Error('请选择病斑图片');
        const selected = (atlas.data?.list ?? []).find((x: PestAtlasEntry) => x.id === values.atlasId);
        if (!selected) throw new Error('请选择已发布图谱');
        return uploadPestImageSample(file.value.originFileObj, {
          atlasId: selected.id,
          atlasRevision: selected.revision,
          source: values.source,
          sourceVersion: values.sourceVersion,
          sourceRef: values.sourceRef,
          note: values.note
        });
      },
      onSuccess: () => {
        setUploadOpen(false);
        setFile(undefined);
        form.resetFields();
        refresh();
        message.success('病斑样本已保存为草稿，请审核发布');
      },
      onError: (error: Error) => message.error(error.message)
    }));
    const publish = useMutation(() => ({
      mutationFn: publishPestImageSample,
      onSuccess: () => {
        refresh();
        message.success('病斑样本状态已更新');
      },
      onError: (error: Error) => message.error(error.message)
    }));
    return () => {
      return <Card title="病斑图片样本库">
    <Table rowKey="id" loading={samples.isLoading} dataSource={samples.data ?? []} rowSelection={{}} columnSettingsStorageKey="agri:production:visible-columns:v1:admin-pest-samples" columnWidthStorageKey="agri:production:column-widths:v1:admin-pest-samples" onRefresh={() => void refresh()} filterSlot={<div class="production-filter-grid">
          <div class="production-filter-field production-filter-span-2"><label>所属已发布图谱</label><Select allowClear showSearch optionFilterProp="label" placeholder="按已发布图谱筛选" value={atlasId.value} onChange={setAtlasId} options={(atlas.data?.list ?? []).map(x => ({
              value: x.id,
              label: `${x.cropName} · ${x.diseaseName} · 修订${x.revision}`
            }))} /></div>
          <div class="production-filter-actions">
            <Button onClick={() => setAtlasId(undefined)}>重置</Button>
            <Button type="primary" loading={samples.isFetching} onClick={() => void refresh()}>查询</Button>
          </div>
        </div>} toolbarLeft={<Button type="primary" onClick={() => setUploadOpen(true)}>上传病斑样本</Button>} scroll={{
          x: 1000
        }} locale={{
          emptyText: atlasId.value ? '暂无样本' : '请先选择一个已发布图谱'
        }} columns={[{
          title: '样本',
          key: 'sample',
          width: 260,
          render: (_, r) => <Space><Image src={r.image_url} width={80} height={60} style={{
              objectFit: 'cover'
            }} /><span>{r.crop_name} · {r.disease_name}<br /><small>{r.width}×{r.height}</small></span></Space>
        }, {
          title: '图谱版本',
          key: 'version',
          width: 200,
          render: (_, r) => `图谱修订 ${r.atlas_revision} · 样本修订 ${r.sample_revision}`
        }, {
          title: '来源',
          key: 'source',
          width: 260,
          render: (_, r) => <><span>{r.source}</span><br /><small>{r.source_version} · {r.source_ref}</small></>
        }, {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: string) => <Tag color={v === 'PUBLISHED' ? 'success' : v === 'DRAFT' ? 'gold' : 'default'}>{labels[v] ?? v}</Tag>
        }, {
          title: '操作',
          key: 'action',
          width: 120,
          fixed: 'right',
          render: (_, r) => <ListRowActions items={[<Button key="pub" type="link" size="small" onClick={() => publish.mutate(r)} loading={publish.isPending}>{r.status === 'PUBLISHED' ? '下架' : '审核发布'}</Button>]} />
        }]} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true
        }} />
    <Modal title="上传病斑图片样本" open={uploadOpen.value} onCancel={() => !upload.isPending && setUploadOpen(false)} onOk={() => form.submit()} confirmLoading={upload.isPending} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={values => upload.mutate(values)}>
        <Form.Item name="atlasId" label="绑定已发布图谱" rules={[{
              required: true,
              message: '请选择图谱'
            }]}><Select showSearch optionFilterProp="label" options={(atlas.data?.list ?? []).map(x => ({
                value: x.id,
                label: `${x.cropName} · ${x.diseaseName} · 修订${x.revision}`
              }))} /></Form.Item>
        <Form.Item label="病斑图片" required><Upload accept="image/jpeg,image/png" maxCount={1} beforeUpload={() => false} fileList={file.value ? [file.value] : []} onChange={({
                fileList
              }) => setFile(fileList[0])}><Button>选择图片</Button></Upload></Form.Item>
        <Form.Item name="source" label="来源机构 / 文献" rules={[{
              required: true
            }]}><Input maxLength={500} /></Form.Item>
        <Form.Item name="sourceVersion" label="版本 / 日期" rules={[{
              required: true
            }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="sourceRef" label="原文出处 / 图片编号" rules={[{
              required: true
            }]}><Input maxLength={500} /></Form.Item>
        <Form.Item name="note" label="样本说明"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>
  </Card>;
    };
  }
});
export default PestImageSamplesPanel;
