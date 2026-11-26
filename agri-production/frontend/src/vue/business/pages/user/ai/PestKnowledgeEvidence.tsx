import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Card, Collapse, Descriptions, Space, Tag, Typography } from '@/vue/ui';
import type { KnowledgeSnapshot } from '@/api/pest-atlas';
const PestKnowledgeEvidence = defineComponent({
  name: "PestKnowledgeEvidence",
  props: {
    snapshot: null as unknown as PropType<{
      snapshot?: KnowledgeSnapshot;
      referenceIds?: string[];
    }["snapshot"]>,
    referenceIds: null as unknown as PropType<{
      snapshot?: KnowledgeSnapshot;
      referenceIds?: string[];
    }["referenceIds"]>
  },
  setup(__props: {
    snapshot?: KnowledgeSnapshot;
    referenceIds?: string[];
  }, {
    slots: __slots
  }) {
    return () => {
      if (!__props.snapshot) return <Alert type="info" message="历史病例无图谱检索快照" description="本次接入不会给旧病例追补引用证据。" />;
      return <Card size="small" title="病虫害图谱证据" extra={<Tag color={__props.snapshot.status === 'MATCHED' ? 'green' : 'orange'}>{__props.snapshot.status === 'MATCHED' ? `检索到 ${__props.snapshot.references.length} 条` : '无匹配证据'}</Tag>}>
    <Typography.Paragraph type="secondary">{__props.snapshot.notice} · 检索时间：{__props.snapshot.retrievedAt}</Typography.Paragraph>
    {!__props.snapshot.references.length && <Alert showIcon type="warning" message="当前作物和症状未检索到有效发布图谱" description="请补充现场事实或联系运营录入并审核知识，不能据此认定没有病虫害。诊断按图谱外处理。" />}
    <Collapse items={__props.snapshot.references.map(ref => ({
          key: ref.referenceId,
          label: <Space wrap><Typography.Text strong>{ref.cropName} · {ref.diseaseName}</Typography.Text><Tag>修订 {ref.revision}</Tag>{(__props.referenceIds ?? []).includes(ref.referenceId) && <Tag color="green">诊断已引用</Tag>}{ref.quarantine && <Tag color="red">检疫提示</Tag>}</Space>,
          children: <>
      <Descriptions size="small" column={1} items={[{
              key: 'matched',
              label: '命中关键词',
              children: ref.matchedKeywords.join('、')
            }, {
              key: 'part',
              label: '受害部位',
              children: ref.affectedParts.join('、')
            }, {
              key: 'source',
              label: '出处',
              children: `${ref.source} · ${ref.sourceVersion} · ${ref.sourceRef}`
            }, {
              key: 'id',
              label: '证据版本',
              children: ref.referenceId
            }, ...(ref.articleId ? [{
              key: 'article',
              label: '知识文章编号',
              children: ref.articleId
            }] : [])]} />
      <Typography.Title level={5}>识别依据</Typography.Title><Typography.Paragraph style={{
              whiteSpace: 'pre-wrap'
            }}>{ref.identification}</Typography.Paragraph>
      <Typography.Title level={5}>鉴别要点</Typography.Title><Typography.Paragraph style={{
              whiteSpace: 'pre-wrap'
            }}>{ref.differential}</Typography.Paragraph>
      <Typography.Title level={5}>农艺与采样建议</Typography.Title><Typography.Paragraph style={{
              whiteSpace: 'pre-wrap'
            }}>{ref.measures}</Typography.Paragraph>
    </>
        }))} />
  </Card>;
    };
  }
});
export default PestKnowledgeEvidence;
