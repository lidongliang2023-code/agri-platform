import { defineComponent, shallowRef, watch, type CSSProperties } from 'vue';
import '@/components/ProductionDetailCompact.css';
import { useNavigate, useParams } from '@/vue/router';
import { useQuery } from '@/vue/query';
import { Alert, Button, Result, Space, Spin, Tag, Typography, message } from '@/vue/ui';
import { CheckCircleFilled, CloseCircleFilled, CopyOutlined, DownloadOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import {
  DetailInfoGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import { getCertRecord, verifyChain } from '@/api/blockchain';
import type { BlockchainBizRecord } from '@/types';
import { asApiRequestError, httpStatusOf, toNumber } from '@/utils/request';

const MONO_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
};

const BIZ_TYPE_NAME: Record<string, string> = {
  FARMING: '生产记录',
  INSPECTION: '检测报告',
  INPUT: '投入品使用',
  HARVEST: '采收入库',
  CIRCULATION: '流通记录',
  IOT: 'IoT数据',
  TRACE: '溯源记录',
};

const VERIFY_ENDPOINT = 'GET /api/v1/production/blockchain/verify/{txHash}';

interface VerifyOutcome {
  txHash: string;
  passed: boolean;
  verifiedAt: string;
}

interface VerifyFailure {
  title: string;
  detail: string;
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    message.success('已复制到剪贴板');
  } catch {
    message.error('复制失败，请手动选中复制');
  }
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function describeFailure(error: unknown): VerifyFailure {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const apiError = asApiRequestError(error);
  if (apiError && typeof apiError.bizCode === 'number') {
    return {
      title: '验真接口返回业务失败，未取得验真结论',
      detail: `后端业务码 ${apiError.bizCode}（HTTP ${apiError.httpStatus ?? 200}）：${rawMessage}`,
    };
  }
  const status = httpStatusOf(error);
  if (status > 0) {
    return { title: `验真接口返回 HTTP ${status}，未取得验真结论`, detail: rawMessage };
  }
  return { title: '无法连接验真接口（网络异常或超时），未取得验真结论', detail: rawMessage };
}

function isValidRecord(data: BlockchainBizRecord | undefined): boolean {
  return Boolean(data && data.recordId);
}

const RecordDetail = defineComponent({
  name: 'RecordDetail',
  props: {},
  setup() {
    const navigate = useNavigate();
    const _params = useParams<{ recordId: string }>();
    const activeTab = shallowRef<string>('overview');
    const verifying = shallowRef<boolean>(false);
    const outcome = shallowRef<VerifyOutcome | null>(null);
    const failure = shallowRef<VerifyFailure | null>(null);

    watch(() => _params.recordId, () => {
      activeTab.value = 'overview';
      outcome.value = null;
      failure.value = null;
    });

    const recordQuery = useQuery<BlockchainBizRecord>(() => ({
      queryKey: ['blockchain-record-detail', _params.recordId ?? ''],
      queryFn: () => getCertRecord(_params.recordId ?? ''),
      enabled: Boolean(_params.recordId ?? ''),
    }));

    const handleVerify = async (txHash: string): Promise<void> => {
      verifying.value = true;
      outcome.value = null;
      failure.value = null;
      activeTab.value = 'verify';
      try {
        const raw: unknown = await verifyChain(encodeURIComponent(txHash));
        if (typeof raw === 'boolean') {
          outcome.value = { txHash, passed: raw, verifiedAt: new Date().toLocaleString('zh-CN') };
        } else {
          failure.value = {
            title: '后端返回了非预期的验真结果，未取得验真结论',
            detail: `期望布尔值，实际为 ${raw === null ? 'null' : typeof raw}`,
          };
        }
      } catch (err) {
        failure.value = describeFailure(err);
      } finally {
        verifying.value = false;
      }
    };

    const handleDownloadCert = (record: BlockchainBizRecord): void => {
      const lines = [
        '========== 区块链存证证书 ==========',
        `存证记录号：${record.recordId}`,
        `业务类型：${BIZ_TYPE_NAME[record.bizType ?? ''] ?? record.bizType ?? '-'}`,
        `业务单号：${record.bizNo ?? '-'}`,
        `关联批次：${record.batchId ?? '-'}`,
        `关联溯源码：${record.traceCode ?? '-'}`,
        `链类型 / 网络：${record.chainType ?? '-'} / ${record.chainNetwork ?? '-'}`,
        `存证状态：${record.status ?? '-'}`,
        `上链时间：${record.anchorAt ?? '-'}`,
        '----------------------------------',
        `交易哈希：${record.txHash ?? '-'}`,
        `区块高度：${record.blockHeight ?? '-'}`,
        `内容哈希(payloadHash)：${record.payloadHash ?? '-'}`,
        '----------------------------------',
        `验真结论：${outcome.value ? (outcome.value.passed ? '通过' : '未通过') : '尚未验真'}`,
        `验真端点：${outcome.value ? VERIFY_ENDPOINT : '-'}`,
        '说明：后端不返回确认数 / 数字签名 / 链ID / 出块时间等字段，本证书不包含这些项。',
        '==================================',
      ];
      downloadFile(`存证证书_${record.recordId}.txt`, lines.join('\n'));
      message.success('存证证书已下载');
    };

    const handleExportReport = (record: BlockchainBizRecord): void => {
      const lines = [
        '========== 存证验真报告 ==========',
        `存证记录号：${record.recordId}`,
        `交易哈希：${record.txHash ?? '-'}`,
        `验真端点：${VERIFY_ENDPOINT}`,
        `验真时间：${outcome.value?.verifiedAt ?? '-'}`,
        `后端返回值：${outcome.value ? String(outcome.value.passed) : '-'}`,
        `验真结论：${outcome.value ? (outcome.value.passed ? '通过' : '未通过') : '尚未验真（未调用验真接口）'}`,
        '==================================',
      ];
      downloadFile(`验真报告_${record.recordId}.txt`, lines.join('\n'));
      message.success('验真报告已导出');
    };

    return () => {
      if (recordQuery.isLoading) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="存证详情" hasAside={false} onBack={() => navigate('/production/blockchain/records')}>
            <DetailSection>
              <Spin tip="正在读取链上存证数据...">
                <div style={{ minHeight: 240 }} />
              </Spin>
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (recordQuery.isError) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="存证详情" hasAside={false} onBack={() => navigate('/production/blockchain/records')}>
            <DetailSection>
              <Result
                status="error"
                title="存证详情接口调用失败"
                subTitle={
                  <Space direction="vertical" size={4}>
                    <Typography.Text>
                      {(recordQuery.error as Error | undefined)?.message ?? '请检查后端服务 /api/v1/production/blockchain/{id}'}
                    </Typography.Text>
                    <Typography.Text type="secondary">未取得该存证的任何数据，留空即代表「未取得」。</Typography.Text>
                  </Space>
                }
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => void recordQuery.refetch()}>
                      重试
                    </Button>
                    <Button onClick={() => navigate('/production/blockchain/records')}>返回列表</Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (!isValidRecord(recordQuery.data)) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="存证详情" hasAside={false} onBack={() => navigate('/production/blockchain/records')}>
            <DetailSection>
              <Result
                status="warning"
                title="未找到该存证记录"
                subTitle={`后端未返回 recordId 为「${(_params.recordId ?? '') || '-'}」的记录。该存证可能已被删除，或编号有误。`}
                extra={
                  <Button type="primary" onClick={() => navigate('/production/blockchain/records')}>
                    返回存证记录列表
                  </Button>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const record: BlockchainBizRecord = recordQuery.data as BlockchainBizRecord;
      const txHash = record.txHash ?? '';
      const blockHeight = toNumber(record.blockHeight, 0);
      const bizLabel = BIZ_TYPE_NAME[record.bizType ?? ''] ?? record.bizType ?? '—';
      const statusBadge =
        record.status === 'SUCCESS'
          ? { label: '已上链', tone: 'green' }
          : record.status === 'PENDING'
            ? { label: '上链中', tone: 'blue' }
            : { label: '上链失败', tone: 'red' };

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '存证详情' },
        { key: 'verify', label: '链上验真' },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'biz',
          title: '业务数据归档',
          description: `${bizLabel} · ${record.bizNo ?? '—'}`,
          state: 'done',
        },
        {
          key: 'hash',
          title: '内容指纹计算',
          description: record.payloadHash ? '已生成 payloadHash 指纹' : '暂未生成指纹',
          state: record.payloadHash ? 'done' : 'pending',
        },
        {
          key: 'anchor',
          title: record.status === 'SUCCESS' ? '链上出块确认' : record.status === 'PENDING' ? '等待出块确认' : '上链异常',
          time: record.anchorAt ?? undefined,
          description: record.blockHeight != null ? `区块高度 #${blockHeight.toLocaleString('en-US')}` : '未回填区块高度',
          state: record.status === 'SUCCESS' ? 'done' : record.status === 'PENDING' ? 'current' : 'error',
        },
        {
          key: 'verify',
          title: outcome.value ? (outcome.value.passed ? '验真已通过' : '验真未通过') : '在线验真核对',
          time: outcome.value?.verifiedAt,
          description: outcome.value ? `返回 ${String(outcome.value.passed)}` : '点击右上角「链上验真」核对',
          state: outcome.value ? (outcome.value.passed ? 'done' : 'error') : txHash ? 'current' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        { key: 'bizNo', label: '业务单号', code: record.bizNo || undefined, emptyText: '无业务单号' },
        {
          key: 'batchId',
          label: '关联采收批次',
          code: record.batchId || undefined,
          emptyText: '未关联批次',
          onClick: record.batchId ? () => navigate(`/production/harvests/${record.batchId}`) : undefined,
        },
        {
          key: 'traceCode',
          label: '关联溯源码',
          code: record.traceCode || undefined,
          emptyText: '无溯源码',
          onClick: record.traceCode ? () => navigate(`/production/trace/full-chain?code=${encodeURIComponent(record.traceCode!)}`) : undefined,
        },
        {
          key: 'verifyPage',
          label: '独立验真台',
          text: txHash ? '在验真页打开' : undefined,
          emptyText: '暂无哈希',
          mono: false,
          onClick: txHash ? () => navigate(`/production/blockchain/verify?type=tx&value=${encodeURIComponent(txHash)}`) : undefined,
        },
      ];

      return (
        <ProductionDetailLayout
          class="production-detail-compact"
          code={record.recordId}
          title={`${bizLabel}存证`}
          status={statusBadge}
          meta={[
            { label: '业务类型', value: bizLabel },
            { label: '链类型 / 网络', value: `${record.chainType ?? '—'} / ${record.chainNetwork ?? '—'}` },
            { label: '上链时间', value: record.anchorAt ?? '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回存证记录"
          onBack={() => navigate('/production/blockchain/records')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          actions={
            /* 次要 → 主要 */
            <>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownloadCert(record)}>
                下载存证证书
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleExportReport(record)}>
                导出验真报告
              </Button>
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                loading={verifying.value}
                disabled={!txHash}
                onClick={() => void handleVerify(txHash)}
              >
                链上验真
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="存证进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联单据">
                <DetailRelatedDocs items={relatedDocs} />
              </DetailSection>
            </>
          }
        >
          {activeTab.value === 'overview' && (
            <>
              <DetailSection title="链上元数据">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      key: 'recordId',
                      label: '存证记录号',
                      value: (
                        <Typography.Text
                          style={MONO_STYLE}
                          copyable={{ text: record.recordId, tooltips: ['复制编号', '已复制'] }}
                        >
                          {record.recordId}
                        </Typography.Text>
                      ),
                    },
                    { key: 'bizType', label: '业务类型', value: <Tag color="geekblue">{bizLabel}</Tag> },
                    { key: 'bizNo', label: '业务单号', value: record.bizNo ?? '—', mono: true },
                    { key: 'batchId', label: '关联批次', value: record.batchId ?? '—', mono: true },
                    { key: 'chain', label: '链类型 / 网络', value: `${record.chainType ?? '—'} / ${record.chainNetwork ?? '—'}` },
                    { key: 'traceCode', label: '关联溯源码', value: record.traceCode ?? '—', mono: true },
                  ]}
                />
              </DetailSection>

              <DetailSection title="链上凭证信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      key: 'txHash',
                      label: '交易哈希',
                      fullWidth: true,
                      value: txHash ? (
                        <Space size={4} wrap>
                          <Typography.Text style={MONO_STYLE}>{txHash}</Typography.Text>
                          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => void copyText(txHash)}>
                            复制
                          </Button>
                        </Space>
                      ) : (
                        <Typography.Text type="secondary">—（该记录尚未上链，后端未回填哈希）</Typography.Text>
                      ),
                    },
                    {
                      key: 'blockHeight',
                      label: '区块高度',
                      mono: true,
                      value: record.blockHeight == null ? '—' : blockHeight.toLocaleString('en-US'),
                    },
                    { key: 'anchorAt', label: '上链时间', value: record.anchorAt ?? '—', mono: true },
                    {
                      key: 'payloadHash',
                      label: '内容哈希',
                      fullWidth: true,
                      value: record.payloadHash ? (
                        <Typography.Text
                          style={MONO_STYLE}
                          copyable={{ text: record.payloadHash, tooltips: ['复制指纹', '已复制'] }}
                        >
                          {record.payloadHash}
                        </Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">—</Typography.Text>
                      ),
                    },
                  ]}
                />
                <Alert
                  style={{ marginTop: 12 }}
                  type="info"
                  showIcon
                  message="以下字段后端未提供，本页不展示"
                  description="确认数、区块确认阈值、数字签名、链ID、出块时间、上链方式及原始数据 JSON 均未由后端返回，本页不作本地推导填充。"
                />
              </DetailSection>

              <DetailSection title="关联存证链路说明">
                <Alert
                  type="info"
                  showIcon
                  message="后端暂未提供「按溯源码查询关联存证链路」接口"
                  description={`当前存证关联溯源码：${record.traceCode ?? '—（该记录无溯源码）'}。后端补齐链路查询端点后再接入真实链路。`}
                />
              </DetailSection>
            </>
          )}

          {activeTab.value === 'verify' && (
            <DetailSection
              title="链上验真结果"
              extra={
                <Button
                  size="small"
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  loading={verifying.value}
                  disabled={!txHash}
                  onClick={() => void handleVerify(txHash)}
                >
                  重新验真
                </Button>
              }
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {!txHash && (
                  <Alert
                    type="warning"
                    showIcon
                    message="该记录尚未上链（无交易哈希），无法验真"
                    description={`后端验真端点 ${VERIFY_ENDPOINT} 只接受交易哈希。请先完成上链再验真。`}
                  />
                )}

                {!outcome.value && !failure.value && txHash && (
                  <Typography.Text type="secondary">
                    尚未验真。点击「链上验真」将调用 {VERIFY_ENDPOINT}，返回该交易哈希是否命中且状态为 SUCCESS。
                  </Typography.Text>
                )}

                {failure.value && (
                  <Alert
                    type="error"
                    showIcon
                    message={failure.value.title}
                    description={failure.value.detail}
                  />
                )}

                {outcome.value && (
                  <>
                    <Alert
                      type={outcome.value.passed ? 'success' : 'error'}
                      showIcon
                      icon={
                        outcome.value.passed ? (
                          <CheckCircleFilled style={{ color: '#2d8f4e' }} />
                        ) : (
                          <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                        )
                      }
                      message={outcome.value.passed ? '验真通过：链上存在该交易哈希对应的成功存证记录' : '验真未通过：未检索到成功存证记录'}
                    />
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { key: 'txHash', label: '交易哈希', fullWidth: true, value: <span style={MONO_STYLE}>{outcome.value.txHash}</span> },
                        { key: 'passed', label: '后端返回值', value: String(outcome.value.passed), mono: true },
                        { key: 'verifiedAt', label: '验真时间', value: outcome.value.verifiedAt, mono: true },
                        { key: 'source', label: '验真接口', fullWidth: true, value: <span style={MONO_STYLE}>{VERIFY_ENDPOINT}</span> },
                      ]}
                    />
                  </>
                )}
              </Space>
            </DetailSection>
          )}
        </ProductionDetailLayout>
      );
    };
  },
});

export default RecordDetail;
