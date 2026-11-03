import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CloseOutlined,
  MessageOutlined,
  SearchOutlined,
  SendOutlined,
  ShoppingOutlined,
} from '@ant-design/icons'
import { Empty, Input, InputNumber, Modal, Select, Spin } from 'antd'
import { getPublicProductById } from '@/api/product'
import {
  getConversations,
  getMessages,
  openNegotiation,
  sendMessage,
  type ChatMessage,
  type Conversation,
} from '@/api/shop-interaction'

interface ShopChatProps {
  open: boolean
  sellerId: string
  sellerName: string
  productId?: number | null
  onClose: () => void
  inbox?: boolean
  inboxRole?: 'buyer' | 'seller'
  embedded?: boolean
}

const timeText = (value: string | null): string => {
  if (!value) return ''
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value.slice(5, 16)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ShopChat({
  open,
  sellerId,
  sellerName,
  productId,
  onClose,
  inbox = false,
  inboxRole = 'buyer',
  embedded = false,
}: ShopChatProps): JSX.Element | null {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [messageType, setMessageType] = useState<'TEXT' | 'QUOTE'>('TEXT')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [orderUnit, setOrderUnit] = useState('件')
  const [orderPrice, setOrderPrice] = useState<number | null>(null)
  const [productUnit, setProductUnit] = useState('件')
  const listRef = useRef<HTMLDivElement>(null)

  const active = conversations.find((item) => item.id === activeId) ?? null
  const visibleConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return conversations
    return conversations.filter((item) =>
      [item.peerName, item.sellerName, item.productName, item.lastMessage]
        .some((value) => String(value ?? '').toLowerCase().includes(keyword)))
  }, [conversations, search])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError('')
      try {
        const list = await getConversations()
        if (cancelled) return
        const rows = list.code === 200 ? list.data ?? [] : []
        setConversations(rows)
        let selected = rows[0] ?? null
        if (!inbox) {
          const opened = await openNegotiation(sellerId, productId)
          if (opened.code !== 200 || !opened.data) {
            setError(opened.message || '无法进入洽谈会话')
            return
          }
          selected = opened.data
          if (!rows.some((item) => item.id === opened.data!.id)) {
            setConversations((current) => [opened.data!, ...current])
          }
        }
        if (!selected) {
          setActiveId(null)
          setMessages([])
          return
        }
        setActiveId(selected.id)
        const room = await getMessages(selected.id)
        if (!cancelled) setMessages(room.code === 200 ? room.data ?? [] : [])
      } catch {
        if (!cancelled) setError('洽谈服务暂时不可用，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [inbox, open, productId, sellerId])

  useEffect(() => {
    if (!open || embedded) return undefined
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [embedded, onClose, open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!active?.productId) return undefined
    let cancelled = false
    void getPublicProductById(active.productId)
      .then((result: { code: number; data?: { unit?: string; price?: number; priceMin?: number } }) => {
        if (cancelled || result.code !== 200 || !result.data) return
        const unit = result.data.unit || '件'
        setProductUnit(unit)
        setOrderUnit(unit)
        setOrderPrice(Number(result.data.price ?? result.data.priceMin ?? 0) || null)
      })
      .catch(() => { /* 商品已下架时仍允许按会话现有上下文下单 */ })
    return () => { cancelled = true }
  }, [active?.productId])

  if (!open) return null

  const chooseConversation = async (conversation: Conversation): Promise<void> => {
    setActiveId(conversation.id)
    setError('')
    try {
      const result = await getMessages(conversation.id)
      if (result.code === 200) setMessages(result.data ?? [])
      setConversations((current) => current.map((item) =>
        item.id === conversation.id ? { ...item, unread: 0 } : item))
    } catch {
      setError('读取洽谈消息失败')
    }
  }

  const send = async (): Promise<void> => {
    const content = text.trim()
    if (!activeId || !content || sending) return
    setSending(true)
    setError('')
    try {
      const result = await sendMessage(activeId, content, messageType)
      if (result.code !== 200 || !result.data) {
        setError(result.message || '消息发送失败')
        return
      }
      setMessages((current) => [...current, result.data])
      setConversations((current) => current.map((item) => item.id === activeId
        ? { ...item, lastMessage: content, lastMessageTime: result.data.createTime }
        : item))
      setText('')
      setMessageType('TEXT')
    } catch {
      setError('消息发送失败，请检查网络后重试')
    } finally {
      setSending(false)
    }
  }

  const quickQuote = (): void => {
    setMessageType('QUOTE')
    setText(inbox && inboxRole === 'seller'
      ? `您好，已收到您对${active?.productName || '该货源'}的询价，我们正在核对库存和交期，稍后给您正式报价。`
      : `您好，我想咨询${active?.productName || active?.sellerName || sellerName || '该货源'}的最新报价、起订量、库存和交期，请报一个最优价格。`)
  }

  const openOrderRequest = (): void => {
    setOrderQuantity(1)
    setOrderUnit(productUnit || '件')
    setOrderOpen(true)
  }

  const submitOrderRequest = async (): Promise<void> => {
    if (!active?.productId || !activeId || orderQuantity <= 0 || orderSubmitting) return
    setOrderSubmitting(true)
    setError('')
    try {
      const result = await sendMessage(activeId, '', 'ORDER_REQUEST', {
        businessId: active.productId,
        quantity: orderQuantity,
        unit: orderUnit,
        price: orderPrice ?? undefined,
      })
      if (result.code !== 200 || !result.data) {
        setError(result.message || '采购需求发送失败')
        return
      }
      setMessages((current) => [...current, result.data])
      setConversations((current) => current.map((item) => item.id === activeId
        ? { ...item, lastMessage: result.data.content, lastMessageTime: result.data.createTime }
        : item))
      setOrderOpen(false)
    } catch {
      setError('采购需求发送失败，请检查网络后重试')
    } finally {
      setOrderSubmitting(false)
    }
  }

  const buyerView = !(inbox && inboxRole === 'seller')

  const dialog = (
      <section className={`shop-chat-modal${embedded ? ' shop-chat-embedded' : ''}`}
        role="dialog" aria-modal={!embedded} aria-label={inbox ? '洽谈消息' : '在线洽谈'}>
        <header className="shop-chat-modal-head">
          <div>
            <span><MessageOutlined /></span>
            <div>
              <strong>{inbox ? '洽谈消息' : '在线洽谈'}</strong>
              <small>{inbox && inboxRole === 'seller'
                ? '处理采购方询价并回复价格、库存和交期'
                : '查看并继续与供应商沟通价格、规格与交期'}</small>
            </div>
          </div>
          {!embedded && <button type="button" aria-label="关闭" onClick={onClose}><CloseOutlined /></button>}
        </header>
        <div className="shop-chat-workspace">
          <aside className="shop-chat-list">
            <div className="shop-chat-search">
              <Input prefix={<SearchOutlined />} value={search}
                onChange={(event) => setSearch(event.target.value)} placeholder="搜索联系人..." />
            </div>
            <div className="shop-chat-conversations">
              {visibleConversations.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无洽谈记录" />
              ) : visibleConversations.map((conversation) => (
                <button type="button" key={conversation.id}
                  className={conversation.id === activeId ? 'active' : ''}
                  onClick={() => void chooseConversation(conversation)}>
                  <span className="shop-chat-avatar">{conversation.peerName.slice(0, 1)}</span>
                  <span className="shop-chat-conversation-main">
                    <span><b>{conversation.peerName}</b><small>{timeText(conversation.lastMessageTime)}</small></span>
                    <span>{conversation.lastMessage || '开始沟通报价与采购需求'}</span>
                  </span>
                  {conversation.unread > 0 && <em>{conversation.unread > 99 ? '99+' : conversation.unread}</em>}
                </button>
              ))}
            </div>
          </aside>

          <div className="shop-chat-room">
            {loading ? (
              <div className="shop-chat-loading"><Spin /><span>正在进入洽谈室…</span></div>
            ) : active ? (
              <>
                <header className="shop-chat-room-head">
                  <div>
                    <strong>{active.peerName}</strong>
                    <span><i />在线洽谈 · {active.role === 'SELLER' ? '供应商工作台' : '采购方'}</span>
                  </div>
                  {active.productName && <small><ShoppingOutlined />{active.productName}</small>}
                </header>
                <div className="shop-chat-messages" ref={listRef}>
                  <div className="shop-chat-date">开始与 {active.peerName} 洽谈</div>
                  {messages.length === 0 && (
                    <div className="shop-chat-empty">
                      <MessageOutlined />
                      <strong>还没有消息</strong>
                      <span>{inbox && inboxRole === 'seller'
                        ? '采购方发来消息后会显示在这里。'
                        : '可以发送采购数量、规格要求，或点击“快捷询价”。'}</span>
                    </div>
                  )}
                  {messages.map((message) => (
                    <div key={message.id} className={`shop-chat-message ${message.mine ? 'mine' : 'peer'}`}>
                      {message.messageType === 'ORDER_REQUEST' ? (
                        <div className="shop-chat-order-card">
                          <small>采购需求</small>
                          <strong>{message.businessTitle || message.content}</strong>
                          <span>{message.businessQuantity} {message.businessUnit}
                            {message.businessPrice != null ? ` · 期望价 ¥${message.businessPrice}/${message.businessUnit}` : ' · 价格面议'}
                          </span>
                          <button type="button" onClick={() => {
                            window.location.href = buyerView
                              ? (message.businessUrl || `/order/create?productId=${message.businessId}&quantity=${message.businessQuantity}`)
                              : `/product/detail/${message.businessId}`
                          }}>
                            {buyerView ? '去下单' : '查看货源'}
                          </button>
                        </div>
                      ) : (
                        <div className={`shop-chat-bubble ${message.messageType === 'QUOTE' ? 'quote' : ''}`}>
                          {message.messageType === 'QUOTE' && <small>询价</small>}
                          <p>{message.content}</p>
                        </div>
                      )}
                      <span>{message.mine ? '我' : message.senderName} · {timeText(message.createTime)}</span>
                    </div>
                  ))}
                </div>
                {error && <div className="shop-chat-error">{error}</div>}
                <div className="shop-chat-compose">
                  {buyerView && active.productId && (
                    <button type="button" className="shop-chat-order-request" onClick={openOrderRequest}>
                      发布需求
                    </button>
                  )}
                  <button type="button" className="shop-chat-quote" onClick={quickQuote}>
                    {inbox && inboxRole === 'seller' ? '快捷回复' : '快捷询价'}
                  </button>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={text}
                    onChange={(event) => setText(event.target.value)}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault()
                        void send()
                      }
                    }}
                    placeholder="输入消息，Enter 发送，Shift + Enter 换行" />
                  <button type="button" className="shop-chat-send" disabled={!text.trim() || sending}
                    onClick={() => void send()}>
                    <SendOutlined />{sending ? '发送中' : '发送'}
                  </button>
                </div>
              </>
            ) : (
              <div className="shop-chat-empty whole">
                <MessageOutlined /><strong>选择一个对话开始洽谈</strong>
              </div>
            )}
          </div>
        </div>
      </section>
  )

  const orderDialog = (
    <Modal
      title="在洽谈中发布采购需求"
      open={orderOpen}
      onCancel={() => setOrderOpen(false)}
      onOk={() => void submitOrderRequest()}
      okText={orderSubmitting ? '发送中…' : '发送需求'}
      cancelText="取消"
      confirmLoading={orderSubmitting}
    >
      <div className="shop-chat-order-form">
        <div><span>采购商品</span><strong>{active?.productName || '当前洽谈商品'}</strong></div>
        <label>
          <span>采购数量</span>
          <InputNumber min={0.001} value={orderQuantity} style={{ width: '100%' }}
            onChange={(value) => setOrderQuantity(Number(value ?? 0))} />
        </label>
        <label>
          <span>计量单位</span>
          <Select value={orderUnit} onChange={setOrderUnit}
            options={[...new Set([productUnit, '件', '箱', '袋', '公斤', '吨'])].map((value) => ({ value, label: value }))} />
        </label>
        <label>
          <span>期望单价（选填）</span>
          <InputNumber min={0} precision={2} value={orderPrice}
            placeholder="留空表示价格面议" style={{ width: '100%' }}
            onChange={(value) => setOrderPrice(value == null ? null : Number(value))} />
        </label>
        <p>发送后双方会看到采购需求卡，买家可点击卡片直接进入下单页。</p>
      </div>
    </Modal>
  )

  if (embedded) {
    return <div className="shop-chat-embedded-shell">{dialog}{orderDialog}</div>
  }

  return (
    <div className="shop-chat-mask" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      {dialog}
      {orderDialog}
    </div>
  )
}
