import { useEffect, useMemo, useState } from 'react'
import { DownloadOutlined, FileProtectOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { App, Button, Modal } from 'antd'
import { serviceApi } from '../api'
import type { ServiceOrder } from '../types'
import { EmptyState, LoadingBlock, Money, PageTitle, StatusTag } from '../components/ui'

/** 合同要素按固定顺序拼出来，任何人拿同样字段都能重算出同一个摘要。 */
function canonicalText(order: ServiceOrder): string {
  return [
    `订单号=${order.orderNo}`,
    `委托方=${order.contactName}`,
    `服务方=${order.providerName}`,
    `服务内容=${order.serviceName}`,
    `数量=${order.quantity}${order.unit}`,
    `单价=${order.unitPrice}`,
    `金额=${order.totalAmount}`,
    `定金=${order.depositAmount}`,
    `履约时间=${order.appointmentDate} ${order.appointmentSlot}`,
    `地点=${order.location}`,
    `补充要求=${order.notes ?? ''}`,
  ].join('\n')
}

async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return ''
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function ContractsPage(): JSX.Element {
  const { message } = App.useApp()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ServiceOrder | null>(null)
  const [digests, setDigests] = useState<Record<number, string>>({})

  useEffect(() => {
    serviceApi.orders().then(setOrders).catch((reason: Error) => message.error(reason.message)).finally(() => setLoading(false))
  }, [message])

  const contracts = useMemo(() => orders.filter((order) => order.status !== 'cancelled'), [orders])

  // 摘要在订单加载后一次性算完，不在渲染过程里触发 setState
  useEffect(() => {
    let cancelled = false
    Promise.all(contracts.map(async (order) => [order.id, await sha256Hex(canonicalText(order))] as const))
      .then((pairs) => {
        if (!cancelled) setDigests(Object.fromEntries(pairs.filter(([, hex]) => hex)))
      })
      .catch(() => setDigests({}))
    return () => {
      cancelled = true
    }
  }, [contracts])

  const download = (order: ServiceOrder): void => {
    const hex = digests[order.id] ?? ''
    const body = [
      '农业服务作业合同（要素清单）',
      `合同编号：HT-${order.orderNo}`,
      '',
      canonicalText(order),
      '',
      `要素摘要（SHA-256）：${hex || '当前浏览器不支持 WebCrypto，未计算'}`,
      '',
      '说明：本清单由平台按订单要素实时生成，可线下逐字比对；平台尚未接入第三方电子签章与司法存证。',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `HT-${order.orderNo}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    message.success(`已下载合同要素清单 HT-${order.orderNo}.txt`)
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SERVICE CONTRACTS"
        title="服务合同要素"
        description="每张非取消订单都能导出合同要素清单，并给出可复算的 SHA-256 摘要用于逐字比对。"
      />
      <section className="contract-banner">
        <SafetyCertificateOutlined />
        <div>
          <b>这是要素清单，不是第三方电子签章</b>
          <p>摘要在本页按订单字段实时计算，平台侧尚未接入存证服务；如争议以订单动态与验收记录为准。</p>
        </div>
      </section>
      <section className="surface-card contract-table-wrap">
        {loading ? <LoadingBlock rows={3} /> : contracts.length === 0 ? <EmptyState icon="📄" title="暂无服务合同" description="订单取消后不会生成合同要素。" /> : (
          <div className="contract-table">
            <div className="contract-table-head"><span>合同与订单</span><span>服务商</span><span>合同金额</span><span>履约状态</span><span>要素摘要</span><span>操作</span></div>
            {contracts.map((order) => (
              <div className="contract-table-row" key={order.id}>
                <span><b>HT-{order.orderNo}</b><small>{order.orderNo} · {order.serviceName}</small></span>
                <span>{order.providerName}</span>
                <span><Money value={order.totalAmount} /></span>
                <span><StatusTag status={order.status} /></span>
                <span className="hash">{digests[order.id] ? `${digests[order.id].slice(0, 16)}…` : '浏览器不支持计算'}</span>
                <span>
                  <Button type="link" onClick={() => setActive(order)}>查看</Button>
                  <Button type="link" icon={<DownloadOutlined />} onClick={() => download(order)}>下载要素清单</Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <Modal title="农业服务作业合同要素" open={Boolean(active)} onCancel={() => setActive(null)} footer={<Button onClick={() => active && download(active)}><DownloadOutlined /> 下载要素清单</Button>} width={680}>
        {active && (
          <div className="contract-preview">
            <FileProtectOutlined className="contract-doc-icon" />
            <h2>农业服务作业合同</h2>
            <p>合同编号：HT-{active.orderNo}</p>
            <dl>
              <dt>委托方</dt><dd>{active.contactName}</dd>
              <dt>服务方</dt><dd>{active.providerName}</dd>
              <dt>服务内容</dt><dd>{active.serviceName}</dd>
              <dt>服务数量</dt><dd>{active.quantity} {active.unit}</dd>
              <dt>单价与金额</dt><dd>¥{active.unitPrice} × {active.quantity} = ¥{active.totalAmount}（定金 ¥{active.depositAmount}）</dd>
              <dt>履约时间</dt><dd>{active.appointmentDate} {active.appointmentSlot}</dd>
              <dt>履约地点</dt><dd>{active.location}</dd>
              <dt>补充要求</dt><dd>{active.notes || '无'}</dd>
            </dl>
            <p className="contract-clause">双方按平台服务标准与补充要求履约；订单动态、服务商进度上报与验收评价作为履约依据。</p>
            <p className="contract-clause">要素摘要（SHA-256）：{digests[active.id] || '当前浏览器不支持 WebCrypto，未计算'}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
