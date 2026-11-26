import './contract-management.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { ListRowActions } from "@/vue/shared";
import { TradeList, TradeFilters } from '@/components/TradeList';
import { Checkbox, Form, Image, Input, Radio, Select, Upload, message } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, EditOutlined, EyeOutlined, FileProtectOutlined, InboxOutlined, SafetyCertificateOutlined, SearchOutlined, ShopOutlined, UploadOutlined } from "@ant-design/icons-vue";
import { useQuery, useQueryClient } from "@/vue/query";
import { archiveContract, getContractById, getContractList, signContract, uploadContractEvidence, type ContractQuery, type ContractVO } from '@/api/contract';
import { getMyMerchants } from '@/api/identity';
import { Panel, money, shortDate } from '../../member-center/shared';
type PageMode = 'list' | 'detail' | 'sign';
const CONTRACT_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  draft: {
    text: '待签署',
    tone: 'amber'
  },
  pending: {
    text: '待生效',
    tone: 'amber'
  },
  signed: {
    text: '已签署',
    tone: 'green'
  },
  effective: {
    text: '生效中',
    tone: 'green'
  },
  cancelled: {
    text: '已取消',
    tone: 'ghost'
  },
  expired: {
    text: '已到期',
    tone: 'ghost'
  },
  completed: {
    text: '已完成',
    tone: 'green'
  }
};
const SIGN_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待签署',
    tone: 'amber'
  },
  signed: {
    text: '已签署',
    tone: 'green'
  },
  rejected: {
    text: '已拒签',
    tone: 'red'
  }
};
function statusMeta(map: Record<string, {
  text: string;
  tone: string;
}>, value: string): {
  text: string;
  tone: string;
} {
  return map[value] ?? {
    text: value || '未知',
    tone: 'ghost'
  };
}
const StatusPill = defineComponent({
  name: "StatusPill",
  props: {
    map: null as unknown as PropType<{
      map: Record<string, {
        text: string;
        tone: string;
      }>;
      value: string;
    }["map"]>,
    value: null as unknown as PropType<{
      map: Record<string, {
        text: string;
        tone: string;
      }>;
      value: string;
    }["value"]>
  },
  setup(__props: {
    map: Record<string, {
      text: string;
      tone: string;
    }>;
    value: string;
  }, {
    slots: __slots
  }) {
    const meta = computed(() => statusMeta(__props.map, __props.value));
    return () => {
      return <span class={`mc-tag ${meta.value.tone}`}>{meta.value.text}</span>;
    };
  }
});
function signatureInfo(value?: string | null): {
  mode: 'online' | 'offline' | 'legacy';
  signer: string;
  url: string;
} | null {
  if (!value) return null;
  const [mode, signer, url] = value.split('|');
  if ((mode === 'ONLINE' || mode === 'OFFLINE') && url) {
    return {
      mode: mode === 'ONLINE' ? 'online' : 'offline',
      signer: signer || '',
      url
    };
  }
  return {
    mode: 'legacy',
    signer: '',
    url: ''
  };
}
const SignatureEvidence = defineComponent({
  name: "SignatureEvidence",
  props: {
    value: null as unknown as PropType<{
      value?: string | null;
    }["value"]>
  },
  setup(__props: {
    value?: string | null;
  }, {
    slots: __slots
  }) {
    const info = computed(() => signatureInfo(__props.value));
    return () => {
      if (!info.value) return <span class="contract-muted">尚未签署</span>;
      if (info.value.mode === 'legacy') return <span class="contract-muted">历史在线签署</span>;
      return <div class="contract-evidence">
      <span class="contract-evidence-icon">
        {info.value.mode === 'online' ? <SafetyCertificateOutlined /> : <FileProtectOutlined />}
      </span>
      <div>
        <strong>{info.value.mode === 'online' ? '在线电子签章' : '线下签署文件'}</strong>
        <small>{info.value.signer || '经办人已确认'}</small>
        <a href={info.value.url} target="_blank" rel="noreferrer">
          {info.value.mode === 'online' ? '查看签章' : '查看签署文件'}
        </a>
      </div>
    </div>;
    };
  }
});
const PartyMark = defineComponent({
  name: "PartyMark",
  props: {
    side: null as unknown as PropType<{
      side: 'buyer' | 'seller';
    }["side"]>
  },
  setup(__props: {
    side: 'buyer' | 'seller';
  }, {
    slots: __slots
  }) {
    return () => {
      return <span class={`contract-party-mark ${__props.side}`}>{__props.side === 'buyer' ? '买' : '卖'}</span>;
    };
  }
});
/**
 * 会员中心合同工作区。
 *
 * 合同列表、详情与签署是两个中心共用的页面级工作区，不是后台弹窗。
 * 数据范围、签署方和存证仍由服务端按当前经营主体判定。
 */
const ContractManagement = defineComponent({
  name: "ContractManagement",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const query = shallowRef<ContractQuery>({
      pageNum: 1,
      pageSize: 20
    });
    const setQuery = (next: typeof query.value | ((previous: typeof query.value) => typeof query.value)) => {
      query.value = typeof next === 'function' ? (next as (previous: typeof query.value) => typeof query.value)(query.value) : next;
    };
    const draft = shallowRef<{
      contractNo?: string;
      contractStatus?: string;
    }>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const pageMode = shallowRef<PageMode>('list');
    const setPageMode = (next: typeof pageMode.value | ((previous: typeof pageMode.value) => typeof pageMode.value)) => {
      pageMode.value = typeof next === 'function' ? (next as (previous: typeof pageMode.value) => typeof pageMode.value)(pageMode.value) : next;
    };
    const activeContract = shallowRef<ContractVO | null>(null);
    const setActiveContract = (next: typeof activeContract.value | ((previous: typeof activeContract.value) => typeof activeContract.value)) => {
      activeContract.value = typeof next === 'function' ? (next as (previous: typeof activeContract.value) => typeof activeContract.value)(activeContract.value) : next;
    };
    const myMerchantIds = shallowRef<string[]>([]);
    const setMyMerchantIds = (next: typeof myMerchantIds.value | ((previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)) => {
      myMerchantIds.value = typeof next === 'function' ? (next as (previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)(myMerchantIds.value) : next;
    };
    const signing = shallowRef(false);
    const setSigning = (next: typeof signing.value | ((previous: typeof signing.value) => typeof signing.value)) => {
      signing.value = typeof next === 'function' ? (next as (previous: typeof signing.value) => typeof signing.value)(signing.value) : next;
    };
    const signMode = shallowRef<'online' | 'offline'>('online');
    const setSignMode = (next: typeof signMode.value | ((previous: typeof signMode.value) => typeof signMode.value)) => {
      signMode.value = typeof next === 'function' ? (next as (previous: typeof signMode.value) => typeof signMode.value)(signMode.value) : next;
    };
    const evidenceUrl = shallowRef('');
    const setEvidenceUrl = (next: typeof evidenceUrl.value | ((previous: typeof evidenceUrl.value) => typeof evidenceUrl.value)) => {
      evidenceUrl.value = typeof next === 'function' ? (next as (previous: typeof evidenceUrl.value) => typeof evidenceUrl.value)(evidenceUrl.value) : next;
    };
    const evidenceName = shallowRef('');
    const setEvidenceName = (next: typeof evidenceName.value | ((previous: typeof evidenceName.value) => typeof evidenceName.value)) => {
      evidenceName.value = typeof next === 'function' ? (next as (previous: typeof evidenceName.value) => typeof evidenceName.value)(evidenceName.value) : next;
    };
    const uploading = shallowRef(false);
    const setUploading = (next: typeof uploading.value | ((previous: typeof uploading.value) => typeof uploading.value)) => {
      uploading.value = typeof next === 'function' ? (next as (previous: typeof uploading.value) => typeof uploading.value)(uploading.value) : next;
    };
    const signForm = Form.useForm();
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
    const isBuyer = (row: ContractVO): boolean => row.buyerId != null && myMerchantIds.value.includes(String(row.buyerId));
    const isSeller = (row: ContractVO): boolean => row.sellerId != null && myMerchantIds.value.includes(String(row.sellerId));
    const canSign = (row: ContractVO): boolean => row.contractStatus !== 'cancelled' && (isBuyer(row) && row.buyerSignStatus !== 'signed' || isSeller(row) && row.sellerSignStatus !== 'signed');
    const _query = useQuery(() => ({
      queryKey: ['contracts', query.value],
      queryFn: () => getContractList(query.value)
    }));
    const rows = computed<ContractVO[]>(() => _query.data.value?.data?.records ?? []);
    const total = computed(() => Number(_query.data.value?.data?.total ?? 0));
    const pageStats = computed(() => ({
      waiting: rows.value.filter(canSign).length,
      signed: rows.value.filter(item => item.contractStatus === 'signed').length,
      archived: rows.value.filter(item => item.archiveStatus === 'archived').length
    }));
    const showList = (): void => {
      setPageMode('list');
      setActiveContract(null);
    };
    const showDetail = (row: ContractVO): void => {
      setActiveContract(row);
      setPageMode('detail');
    };
    const showSign = (row: ContractVO): void => {
      setActiveContract(row);
      setPageMode('sign');
      setSignMode('online');
      setEvidenceUrl('');
      setEvidenceName('');
      signForm.resetFields();
      signForm.setFieldsValue({
        signMode: 'online',
        signerName: isBuyer(row) ? row.buyerName : row.sellerName,
        confirmed: false
      });
    };
    const refreshActiveContract = async (id: number): Promise<void> => {
      try {
        const response = await getContractById(id);
        if (response?.code === 200 && response.data) setActiveContract(response.data);
      } catch {
        // 列表仍会通过 queryClient 刷新，详情保持当前内容即可。
      }
    };
    const handleEvidenceUpload = async (file: File): Promise<void> => {
      if (!activeContract.value) return;
      setUploading(true);
      try {
        const response = await uploadContractEvidence(activeContract.value.id, signMode.value, file);
        if (response?.code === 200 && response.data?.url) {
          setEvidenceUrl(response.data.url);
          setEvidenceName(response.data.originalName || file.name);
          message.success(signMode.value === 'online' ? '电子签章上传成功' : '线下签署文件上传成功');
        } else {
          message.error(response?.message ?? '签署文件上传失败');
        }
      } catch {
        message.error('签署文件上传失败（请检查后端是否在运行）');
      } finally {
        setUploading(false);
      }
    };
    const handleSign = async (): Promise<void> => {
      if (!activeContract.value) return;
      const values = await signForm.validateFields();
      if (!evidenceUrl.value) {
        message.warning(signMode.value === 'online' ? '请先上传电子签章' : '请先上传线下签署合同文件');
        return;
      }
      setSigning(true);
      try {
        const response = await signContract(activeContract.value.id, {
          signMode: signMode.value,
          signerName: values.signerName,
          evidenceUrl: evidenceUrl.value,
          confirmed: values.confirmed
        });
        if (response?.code === 200) {
          message.success(signMode.value === 'online' ? '在线电子签章完成' : '线下签署确认完成');
          await queryClient.invalidateQueries({
            queryKey: ['contracts']
          });
          await refreshActiveContract(activeContract.value.id);
          setPageMode('detail');
        } else {
          message.error(response?.message ?? '签署失败');
        }
      } catch {
        message.error('签署失败（请检查后端是否在运行）');
      } finally {
        setSigning(false);
      }
    };
    const handleArchive = async (row: ContractVO): Promise<void> => {
      if (!window.confirm(`确认归档合同 ${row.contractNo}？归档后合同仍可查看。`)) return;
      try {
        const response = await archiveContract(row.id);
        if (response?.code === 200) {
          message.success('合同已归档');
          await queryClient.invalidateQueries({
            queryKey: ['contracts']
          });
          if (activeContract.value?.id === row.id) await refreshActiveContract(row.id);
        } else {
          message.error(response?.message ?? '归档失败');
        }
      } catch {
        message.error('归档失败（请检查后端是否在运行）');
      }
    };
    return () => {
      const view_activeContract = activeContract.value;
      if (pageMode.value === 'detail' && view_activeContract) {
        const contractState = statusMeta(CONTRACT_STATUS, view_activeContract.contractStatus);
        return <div class="contract-page contract-detail-page">
        <button type="button" class="contract-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回合同列表
        </button>
        <section class="contract-detail-hero">
          <div class="contract-detail-icon"><FileProtectOutlined /></div>
          <div class="contract-detail-title">
            <span>电子合同 · {view_activeContract.contractNo}</span>
            <h2>{view_activeContract.contractName || '采购合同'}</h2>
            <p>关联订单 {view_activeContract.orderNo || view_activeContract.orderId || '—'} · 创建于 {shortDate(view_activeContract.createTime)}</p>
          </div>
          <span class={`mc-tag ${contractState.tone}`}>{contractState.text}</span>
          <div class="contract-detail-hero-actions">
            {canSign(view_activeContract) && <button type="button" class="mc-btn" onClick={() => showSign(view_activeContract)}>
                <EditOutlined /> 立即签署
              </button>}
            {view_activeContract.archiveStatus !== 'archived' && <button type="button" class="mc-btn ghost" onClick={() => void handleArchive(view_activeContract)}>
                <InboxOutlined /> 归档
              </button>}
          </div>
        </section>

        <div class="contract-detail-layout">
          <div class="contract-detail-main">
            <Panel title="合同主体">
              <div class="contract-party-grid">
                <div class="contract-party-card">
                  <PartyMark side="buyer" />
                  <div><span>采购方</span><strong>{view_activeContract.buyerName || '—'}</strong><small>经营主体 ID {String(view_activeContract.buyerId ?? '—')}</small></div>
                  <StatusPill map={SIGN_STATUS} value={view_activeContract.buyerSignStatus} />
                </div>
                <div class="contract-party-link"><span>↔</span><small>合同双方</small></div>
                <div class="contract-party-card">
                  <PartyMark side="seller" />
                  <div><span>供货方</span><strong>{view_activeContract.sellerName || '—'}</strong><small>经营主体 ID {String(view_activeContract.sellerId ?? '—')}</small></div>
                  <StatusPill map={SIGN_STATUS} value={view_activeContract.sellerSignStatus} />
                </div>
              </div>
            </Panel>

            <Panel title="交易条款">
              <div class="contract-terms-grid">
                <div><span>合同金额</span><strong class="contract-amount">{money(view_activeContract.contractAmount)}</strong></div>
                <div><span>关联订单</span><strong>{view_activeContract.orderNo || view_activeContract.orderId || '—'}</strong></div>
                <div><span>交付地址</span><strong>{view_activeContract.deliveryAddress || '—'}</strong></div>
                <div><span>约定交期</span><strong>{shortDate(view_activeContract.deliveryDate)}</strong></div>
                <div><span>合同类型</span><strong>{view_activeContract.contractType === 'sale' ? '采购销售合同' : view_activeContract.contractType || '—'}</strong></div>
                <div><span>归档状态</span><strong>{view_activeContract.archiveStatus === 'archived' ? '已归档' : '未归档'}</strong></div>
              </div>
            </Panel>

            <Panel title="签署记录">
              <div class="contract-signature-grid">
                <div class="contract-signature-card">
                  <div class="contract-signature-head">
                    <PartyMark side="buyer" />
                    <div><strong>采购方签署</strong><span>{view_activeContract.buyerName || '—'}</span></div>
                    <StatusPill map={SIGN_STATUS} value={view_activeContract.buyerSignStatus} />
                  </div>
                  <SignatureEvidence value={view_activeContract.buyerSignature} />
                  <small>签署时间：{shortDate(view_activeContract.buyerSignTime)}</small>
                </div>
                <div class="contract-signature-card">
                  <div class="contract-signature-head">
                    <PartyMark side="seller" />
                    <div><strong>供货方签署</strong><span>{view_activeContract.sellerName || '—'}</span></div>
                    <StatusPill map={SIGN_STATUS} value={view_activeContract.sellerSignStatus} />
                  </div>
                  <SignatureEvidence value={view_activeContract.sellerSignature} />
                  <small>签署时间：{shortDate(view_activeContract.sellerSignTime)}</small>
                </div>
              </div>
            </Panel>

            <Panel title="合同正文">
              <div class="contract-content">
                {view_activeContract.contractContent || '本合同由平台按订单成交信息生成，具体商品、数量、金额与交付要求以订单及双方确认内容为准。'}
              </div>
            </Panel>
          </div>

          <aside class="contract-detail-aside">
            <Panel title="签约进度">
              <div class="contract-timeline">
                <div class="on"><span><CheckCircleOutlined /></span><div><strong>合同已生成</strong><small>{shortDate(view_activeContract.createTime)}</small></div></div>
                <div class={view_activeContract.buyerSignStatus === 'signed' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>采购方签署</strong><small>{view_activeContract.buyerSignStatus === 'signed' ? shortDate(view_activeContract.buyerSignTime) : '等待采购方签署'}</small></div></div>
                <div class={view_activeContract.sellerSignStatus === 'signed' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>供货方签署</strong><small>{view_activeContract.sellerSignStatus === 'signed' ? shortDate(view_activeContract.sellerSignTime) : '等待供货方签署'}</small></div></div>
                <div class={view_activeContract.contractStatus === 'signed' ? 'on' : ''}><span><SafetyCertificateOutlined /></span><div><strong>合同生效</strong><small>{view_activeContract.effectiveDate ? shortDate(view_activeContract.effectiveDate) : '双方签署后生效'}</small></div></div>
              </div>
            </Panel>
            <Panel title="存证信息">
              <div class="contract-hash-list">
                <div><span>合同哈希</span><code>{view_activeContract.contractHash || '签署生成'}</code></div>
                <div><span>存证哈希</span><code>{view_activeContract.chainTxHash || '双方签署后生成'}</code></div>
                <div><span>存证状态</span><strong>{view_activeContract.chainStatus === 'success' ? '存证成功' : '待存证'}</strong></div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (pageMode.value === 'sign' && view_activeContract) {
        return <div class="contract-page contract-sign-page">
        <button type="button" class="contract-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回合同详情
        </button>
        <div class="contract-sign-heading">
          <div class="contract-detail-icon"><EditOutlined /></div>
          <div>
            <span>合同签署</span>
            <h2>{view_activeContract.contractName || '采购合同'}</h2>
            <p>{view_activeContract.contractNo} · {money(view_activeContract.contractAmount)}</p>
          </div>
          <span class="mc-tag amber">待我方签署</span>
        </div>

        <div class="contract-sign-layout">
          <Panel title="选择签署方式" className="contract-sign-form-panel">
            <Form form={signForm} layout="vertical" onFinish={() => void handleSign()}>
              <Form.Item name="signMode" rules={[{
                  required: true
                }]}>
                <Radio.Group class="contract-method-group" onChange={event => {
                    setSignMode(event.target.value ?? '');
                    setEvidenceUrl('');
                    setEvidenceName('');
                  }}>
                  <Radio value="online" class="contract-method-card">
                    <span class="contract-method-icon"><SafetyCertificateOutlined /></span>
                    <span><strong>在线电子签章</strong><small>上传公章、合同专用章或个人签名图片，在线确认完成签署</small></span>
                  </Radio>
                  <Radio value="offline" class="contract-method-card">
                    <span class="contract-method-icon"><FileProtectOutlined /></span>
                    <span><strong>线下签署</strong><small>上传双方签字盖章后的合同扫描件或 PDF，确认归档</small></span>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="signerName" label={signMode.value === 'online' ? '签章主体 / 经办人' : '线下签署经办人'} rules={[{
                  required: true,
                  message: '请填写签署人'
                }]}>
                <Input placeholder="请输入实际签署人或经办人姓名" />
              </Form.Item>

              <Form.Item label={signMode.value === 'online' ? '电子签章图片' : '线下签署合同文件'} required>
                <div class="contract-upload-zone">
                  <span class="contract-upload-icon"><UploadOutlined /></span>
                  <div>
                    <strong>{signMode.value === 'online' ? '上传清晰的电子签章' : '上传已签署合同扫描件'}</strong>
                    <small>{signMode.value === 'online' ? '支持 PNG、JPG、JPEG、WEBP，文件不超过 5MB' : '支持 PDF、PNG、JPG、JPEG、WEBP，文件不超过 5MB'}</small>
                  </div>
                  <Upload accept={signMode.value === 'online' ? '.png,.jpg,.jpeg,.webp' : '.pdf,.png,.jpg,.jpeg,.webp'} showUploadList={false} beforeUpload={file => {
                      void handleEvidenceUpload(file as File);
                      return false;
                    }}>
                    <button type="button" class="mc-btn ghost">{uploading.value ? '上传中…' : '选择文件'}</button>
                  </Upload>
                </div>
                {evidenceUrl.value && <div class="contract-upload-preview">
                    {signMode.value === 'online' && <Image src={evidenceUrl.value} width={92} height={62} alt="电子签章预览" />}
                    <div><strong>{evidenceName.value}</strong><a href={evidenceUrl.value} target="_blank" rel="noreferrer">查看已上传文件</a></div>
                    <span class="mc-tag green">已上传</span>
                  </div>}
              </Form.Item>

              <Form.Item name="confirmed" valuePropName="checked" rules={[{
                  validator: (_, checked) => checked ? Promise.resolve() : Promise.reject(new Error('请确认已核对合同内容'))
                }]}>
                <Checkbox>我已核对合同主体、金额和条款，确认以当前经营主体完成本次签署</Checkbox>
              </Form.Item>

              <div class="contract-sign-actions">
                <button type="submit" class="mc-btn" disabled={signing.value || uploading.value}>
                  <SafetyCertificateOutlined /> {signing.value ? '正在签署…' : '确认签署'}
                </button>
                <button type="button" class="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>

          <aside class="contract-sign-summary">
            <Panel title="合同概要">
              <div class="contract-summary-contract">
                <span>{view_activeContract.contractNo}</span>
                <strong>{view_activeContract.contractName || '采购合同'}</strong>
                <em>{money(view_activeContract.contractAmount)}</em>
              </div>
              <div class="contract-summary-parties">
                <div><PartyMark side="buyer" /><span>采购方</span><strong>{view_activeContract.buyerName}</strong></div>
                <div><PartyMark side="seller" /><span>供货方</span><strong>{view_activeContract.sellerName}</strong></div>
              </div>
            </Panel>
            <Panel title="签署提示">
              <div class="contract-tips">
                <p><CheckCircleOutlined /> 签署方由系统按当前经营主体自动判定，不能替代对方签署。</p>
                <p><FileProtectOutlined /> 签署文件会与合同内容一起留痕，双方签署完成后生成存证哈希。</p>
                <p><ShopOutlined /> 线下签署请确保上传文件包含双方签字或盖章页。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      return <div class="contract-page">
      <section class="contract-overview">
        <div class="contract-overview-title">
          <span class="contract-overview-icon"><FileProtectOutlined /></span>
          <div><span>TRADE CONTRACTS</span><h2>合同管理</h2><p>统一管理采购合同、双方签署证据与平台存证记录。</p></div>
        </div>
        <div class="contract-overview-stats">
          <div><span>合同总数</span><strong>{total.value}</strong></div>
          <div><span>本页待签</span><strong>{pageStats.value.waiting}</strong></div>
          <div><span>本页已签</span><strong>{pageStats.value.signed}</strong></div>
          <div><span>本页已归档</span><strong>{pageStats.value.archived}</strong></div>
        </div>
      </section>

      <TradeList listId="member-contract" rowKey="id" dataSource={rows.value} onRefresh={() => void _query.refetch()} loading={_query.isFetching.value} filterSlot={<TradeFilters fields={[{
          label: '合同编号',
          control: <Input placeholder="输入合同编号搜索" prefix={<SearchOutlined />} value={draft.value.contractNo} allowClear onChange={event => setDraft(previous => ({
            ...previous,
            contractNo: (event.target.value ?? '') || undefined
          }))} />
        }, {
          label: '合同状态',
          control: <Select placeholder="全部合同状态" allowClear value={draft.value.contractStatus} onChange={value => setDraft(previous => ({
            ...previous,
            contractStatus: value
          }))} options={Object.entries(CONTRACT_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }]} onQuery={() => setQuery(prev => ({
          ...prev,
          pageNum: 1,
          contractNo: draft.value.contractNo,
          contractStatus: draft.value.contractStatus
        }))} onReset={() => {
          setDraft({});
          setQuery(prev => ({
            pageNum: 1,
            pageSize: prev.pageSize
          }));
        }} />} pagination={{
          current: query.value.pageNum ?? 1,
          pageSize: query.value.pageSize ?? 20,
          total: total.value,
          onChange: (pageNum, pageSize) => setQuery(prev => ({
            ...prev,
            pageNum,
            pageSize
          }))
        }} locale={{
          emptyText: '还没有合同'
        }} columns={[{
          title: "合同名称 / 编号",
          key: 'col-1',
          width: 160,
          render: (_, row) => <><button type="button" class="contract-name-link" onClick={() => showDetail(row)}>
                          <strong>{row.contractName || '采购合同'}</strong>
                          <span class="mc-mono">{row.contractNo}</span>
                        </button></>
        }, {
          title: "交易双方",
          key: 'col-2',
          width: 160,
          render: (_, row) => <><div class="contract-parties-cell">
                          <div><PartyMark side="buyer" /><span>{row.buyerName || '—'}</span></div>
                          <div><PartyMark side="seller" /><span>{row.sellerName || '—'}</span></div>
                        </div></>
        }, {
          title: "合同金额",
          key: 'col-3',
          width: 160,
          render: (_, row) => <><span class="mc-price">{money(row.contractAmount)}</span></>
        }, {
          title: "双方签署",
          key: 'col-4',
          width: 160,
          render: (_, row) => <><div class="contract-progress">
                          <div><span>买方</span><StatusPill map={SIGN_STATUS} value={row.buyerSignStatus} /></div>
                          <div><span>卖方</span><StatusPill map={SIGN_STATUS} value={row.sellerSignStatus} /></div>
                        </div></>
        }, {
          title: "合同状态",
          key: 'col-5',
          width: 108,
          render: (_, row) => <><StatusPill map={CONTRACT_STATUS} value={row.contractStatus} /></>
        }, {
          title: "创建时间",
          key: 'col-6',
          width: 160,
          render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.createTime)}</span>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, row) => <><ListRowActions>
                          <button type="button" class="mc-link contract-action-link" onClick={() => showDetail(row)}>
                            <EyeOutlined /> 查看
                          </button>
                          {canSign(row) && <button type="button" class="mc-link contract-action-link" onClick={() => showSign(row)}>
                              <EditOutlined /> 签署
                            </button>}
                          {row.archiveStatus !== 'archived' && (isBuyer(row) || isSeller(row)) && <button type="button" class="mc-link contract-action-link" onClick={() => void handleArchive(row)}>
                              <InboxOutlined /> 归档
                            </button>}
                        </ListRowActions></>
        }]} />
    </div>;
    };
  }
});
export default ContractManagement;
