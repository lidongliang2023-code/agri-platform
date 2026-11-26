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
import { Alert, Card, Collapse, Descriptions, Image, Space, Tag, Typography } from '@/vue/ui';
import type { ImageSearchSnapshot } from '@/api/pest-atlas';
type Attempt = {
  attemptId: string;
  snapshot: ImageSearchSnapshot;
  createdAt: string;
};
const PestImageEvidence = defineComponent({
  name: "PestImageEvidence",
  props: {
    snapshot: null as unknown as PropType<{
      snapshot?: ImageSearchSnapshot;
      attempts?: Attempt[];
    }["snapshot"]>,
    attempts: null as unknown as PropType<{
      snapshot?: ImageSearchSnapshot;
      attempts?: Attempt[];
    }["attempts"]>
  },
  setup(__props: {
    snapshot?: ImageSearchSnapshot;
    attempts?: Attempt[];
  }, {
    slots: __slots
  }) {
    const current = computed(() => __props.snapshot ?? (__props.attempts ?? [])[(__props.attempts ?? []).length - 1]?.snapshot);
    return () => {
      const _currentSnapshot = current.value;
      if (!_currentSnapshot) return <Alert type="info" message="暂无病斑图片检索快照" description="病例生成于图片检索接入前，旧病例不会自动补检索。" />;
      return <Card size="small" title="病斑图片检索证据" extra={<Tag color={_currentSnapshot.status === 'MATCHED' ? 'green' : 'orange'}>{_currentSnapshot.status === 'MATCHED' ? `候选 ${_currentSnapshot.references.length} 条` : '无匹配样本'}</Tag>}>
    <Typography.Paragraph type="secondary">{_currentSnapshot.notice} · 方法：{_currentSnapshot.method}</Typography.Paragraph>
    {!_currentSnapshot.references.length && <Alert showIcon type="warning" message="当前作物暂无已发布病斑样本命中" description="这不代表没有病虫害；请结合结构化图谱、现场症状和人工核验。" />}
    <Collapse items={_currentSnapshot.references.map((ref, i) => ({
          key: ref.sampleId,
          label: <Space wrap><Typography.Text strong>{i + 1}. {ref.cropName} · {ref.diseaseName}</Typography.Text><Tag color={i === 0 ? 'green' : 'default'}>相似度 {Math.round(ref.similarity * 100)}%</Tag><Tag>距离 {ref.distance}</Tag></Space>,
          children: <Space direction="vertical" style={{
            width: '100%'
          }}><Image src={ref.imageUrl} width={180} height={130} style={{
              objectFit: 'cover'
            }} /><Descriptions size="small" column={1} items={[{
              key: 'source',
              label: '来源',
              children: `${ref.source} · ${ref.sourceVersion}`
            }, {
              key: 'ref',
              label: '出处',
              children: ref.sourceRef
            }, {
              key: 'id',
              label: '样本 / 图谱版本',
              children: `${ref.sampleId} · ${ref.atlasId}@${ref.revision}`
            }]} /></Space>
        }))} />
    {(__props.attempts ?? []).length > 1 && <Typography.Text type="secondary">本病例共有 {(__props.attempts ?? []).length} 次诊断尝试，以上为最近一次图片检索结果。</Typography.Text>}
  </Card>;
    };
  }
});
export default PestImageEvidence;
