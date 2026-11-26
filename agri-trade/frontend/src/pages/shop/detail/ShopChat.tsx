import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { CloseOutlined, MessageOutlined, SearchOutlined, SendOutlined, ShoppingOutlined } from "@ant-design/icons-vue";
import { Empty, Input, InputNumber, Modal, Select, Spin } from "@/vue/ui";
import { getPublicProductById } from '@/api/product';
import { getConversations, getMessages, openNegotiation, sendMessage, type ChatMessage, type Conversation } from '@/api/shop-interaction';
interface ShopChatProps {
  open: boolean;
  sellerId: string;
  sellerName: string;
  productId?: number | null;
  onClose: () => void;
  inbox?: boolean;
  inboxRole?: 'buyer' | 'seller';
  embedded?: boolean;
}
const timeText = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(5, 16);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
export const ShopChat = defineComponent({
  name: "ShopChat",
  props: {
    open: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["open"]>,
    sellerId: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["sellerId"]>,
    sellerName: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["sellerName"]>,
    productId: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["productId"]>,
    onClose: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["onClose"]>,
    inbox: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["inbox"]>,
    inboxRole: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["inboxRole"]>,
    embedded: null as unknown as PropType<{
      open: boolean;
      sellerId: string;
      sellerName: string;
      productId?: number | null;
      onClose: () => void;
      inbox?: boolean;
      inboxRole?: 'buyer' | 'seller';
      embedded?: boolean;
    }["embedded"]>
  },
  setup(__props: {
    open: boolean;
    sellerId: string;
    sellerName: string;
    productId?: number | null;
    onClose: () => void;
    inbox?: boolean;
    inboxRole?: 'buyer' | 'seller';
    embedded?: boolean;
  }, {
    slots: __slots
  }) {
    const conversations = shallowRef<Conversation[]>([]);
    const setConversations = (next: typeof conversations.value | ((previous: typeof conversations.value) => typeof conversations.value)) => {
      conversations.value = typeof next === 'function' ? (next as (previous: typeof conversations.value) => typeof conversations.value)(conversations.value) : next;
    };
    const activeId = shallowRef<number | null>(null);
    const setActiveId = (next: typeof activeId.value | ((previous: typeof activeId.value) => typeof activeId.value)) => {
      activeId.value = typeof next === 'function' ? (next as (previous: typeof activeId.value) => typeof activeId.value)(activeId.value) : next;
    };
    const messages = shallowRef<ChatMessage[]>([]);
    const setMessages = (next: typeof messages.value | ((previous: typeof messages.value) => typeof messages.value)) => {
      messages.value = typeof next === 'function' ? (next as (previous: typeof messages.value) => typeof messages.value)(messages.value) : next;
    };
    const text = shallowRef('');
    const setText = (next: typeof text.value | ((previous: typeof text.value) => typeof text.value)) => {
      text.value = typeof next === 'function' ? (next as (previous: typeof text.value) => typeof text.value)(text.value) : next;
    };
    const messageType = shallowRef<'TEXT' | 'QUOTE'>('TEXT');
    const setMessageType = (next: typeof messageType.value | ((previous: typeof messageType.value) => typeof messageType.value)) => {
      messageType.value = typeof next === 'function' ? (next as (previous: typeof messageType.value) => typeof messageType.value)(messageType.value) : next;
    };
    const search = shallowRef('');
    const setSearch = (next: typeof search.value | ((previous: typeof search.value) => typeof search.value)) => {
      search.value = typeof next === 'function' ? (next as (previous: typeof search.value) => typeof search.value)(search.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const sending = shallowRef(false);
    const setSending = (next: typeof sending.value | ((previous: typeof sending.value) => typeof sending.value)) => {
      sending.value = typeof next === 'function' ? (next as (previous: typeof sending.value) => typeof sending.value)(sending.value) : next;
    };
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const orderOpen = shallowRef(false);
    const setOrderOpen = (next: typeof orderOpen.value | ((previous: typeof orderOpen.value) => typeof orderOpen.value)) => {
      orderOpen.value = typeof next === 'function' ? (next as (previous: typeof orderOpen.value) => typeof orderOpen.value)(orderOpen.value) : next;
    };
    const orderSubmitting = shallowRef(false);
    const setOrderSubmitting = (next: typeof orderSubmitting.value | ((previous: typeof orderSubmitting.value) => typeof orderSubmitting.value)) => {
      orderSubmitting.value = typeof next === 'function' ? (next as (previous: typeof orderSubmitting.value) => typeof orderSubmitting.value)(orderSubmitting.value) : next;
    };
    const orderQuantity = shallowRef(1);
    const setOrderQuantity = (next: typeof orderQuantity.value | ((previous: typeof orderQuantity.value) => typeof orderQuantity.value)) => {
      orderQuantity.value = typeof next === 'function' ? (next as (previous: typeof orderQuantity.value) => typeof orderQuantity.value)(orderQuantity.value) : next;
    };
    const orderUnit = shallowRef('件');
    const setOrderUnit = (next: typeof orderUnit.value | ((previous: typeof orderUnit.value) => typeof orderUnit.value)) => {
      orderUnit.value = typeof next === 'function' ? (next as (previous: typeof orderUnit.value) => typeof orderUnit.value)(orderUnit.value) : next;
    };
    const orderPrice = shallowRef<number | null>(null);
    const setOrderPrice = (next: typeof orderPrice.value | ((previous: typeof orderPrice.value) => typeof orderPrice.value)) => {
      orderPrice.value = typeof next === 'function' ? (next as (previous: typeof orderPrice.value) => typeof orderPrice.value)(orderPrice.value) : next;
    };
    const productUnit = shallowRef('件');
    const setProductUnit = (next: typeof productUnit.value | ((previous: typeof productUnit.value) => typeof productUnit.value)) => {
      productUnit.value = typeof next === 'function' ? (next as (previous: typeof productUnit.value) => typeof productUnit.value)(productUnit.value) : next;
    };
    const listRef = shallowRef<HTMLDivElement | null>(null);
    const active = computed(() => conversations.value.find(item => item.id === activeId.value) ?? null);
    const visibleConversations = computed(() => {
      const keyword = search.value.trim().toLowerCase();
      if (!keyword) return conversations.value;
      return conversations.value.filter(item => [item.peerName, item.sellerName, item.productName, item.lastMessage].some(value => String(value ?? '').toLowerCase().includes(keyword)));
    });
    onMounted(() => {
      watch(() => [__props.inbox ?? false, __props.open, __props.productId, __props.sellerId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!__props.open) return undefined;
          let cancelled = false;
          const load = async (): Promise<void> => {
            setLoading(true);
            setError('');
            try {
              const list = await getConversations();
              if (cancelled) return;
              const rows = list.code === 200 ? list.data ?? [] : [];
              setConversations(rows);
              let selected = rows[0] ?? null;
              if (!(__props.inbox ?? false)) {
                const opened = await openNegotiation(__props.sellerId, __props.productId);
                if (opened.code !== 200 || !opened.data) {
                  setError(opened.message || '无法进入洽谈会话');
                  return;
                }
                selected = opened.data;
                if (!rows.some(item => item.id === opened.data!.id)) {
                  setConversations(current => [opened.data!, ...current]);
                }
              }
              if (!selected) {
                setActiveId(null);
                setMessages([]);
                return;
              }
              setActiveId(selected.id);
              const room = await getMessages(selected.id);
              if (!cancelled) setMessages(room.code === 200 ? room.data ?? [] : []);
            } catch {
              if (!cancelled) setError('洽谈服务暂时不可用，请稍后重试');
            } finally {
              if (!cancelled) setLoading(false);
            }
          };
          void load();
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [__props.embedded ?? false, __props.onClose, __props.open], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!__props.open || (__props.embedded ?? false)) return undefined;
          const handler = (event: PortalEvent): void => {
            if ((event as KeyboardEvent).key === 'Escape') __props.onClose();
          };
          window.addEventListener('keydown', handler);
          return () => window.removeEventListener('keydown', handler);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [messages.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [active.value?.productId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!active.value?.productId) return undefined;
          let cancelled = false;
          void getPublicProductById(active.value.productId).then((result: {
            code: number;
            data?: {
              unit?: string;
              price?: number;
              priceMin?: number;
            };
          }) => {
            if (cancelled || result.code !== 200 || !result.data) return;
            const unit = result.data.unit || '件';
            setProductUnit(unit);
            setOrderUnit(unit);
            setOrderPrice(Number(result.data.price ?? result.data.priceMin ?? 0) || null);
          }).catch(() => {/* 商品已下架时仍允许按会话现有上下文下单 */});
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_orderPrice = orderPrice.value;
      const view_activeId = activeId.value;
      if (!__props.open) return null;
      const chooseConversation = async (conversation: Conversation): Promise<void> => {
        setActiveId(conversation.id);
        setError('');
        try {
          const result = await getMessages(conversation.id);
          if (result.code === 200) setMessages(result.data ?? []);
          setConversations(current => current.map(item => item.id === conversation.id ? {
            ...item,
            unread: 0
          } : item));
        } catch {
          setError('读取洽谈消息失败');
        }
      };
      const send = async (): Promise<void> => {
        const content = text.value.trim();
        if (!view_activeId || !content || sending.value) return;
        setSending(true);
        setError('');
        try {
          const result = await sendMessage(view_activeId, content, messageType.value);
          if (result.code !== 200 || !result.data) {
            setError(result.message || '消息发送失败');
            return;
          }
          setMessages(current => [...current, result.data]);
          setConversations(current => current.map(item => item.id === view_activeId ? {
            ...item,
            lastMessage: content,
            lastMessageTime: result.data.createTime
          } : item));
          setText('');
          setMessageType('TEXT');
        } catch {
          setError('消息发送失败，请检查网络后重试');
        } finally {
          setSending(false);
        }
      };
      const quickQuote = (): void => {
        setMessageType('QUOTE');
        setText((__props.inbox ?? false) && (__props.inboxRole ?? 'buyer') === 'seller' ? `您好，已收到您对${active.value?.productName || '该货源'}的询价，我们正在核对库存和交期，稍后给您正式报价。` : `您好，我想咨询${active.value?.productName || active.value?.sellerName || __props.sellerName || '该货源'}的最新报价、起订量、库存和交期，请报一个最优价格。`);
      };
      const openOrderRequest = (): void => {
        setOrderQuantity(1);
        setOrderUnit(productUnit.value || '件');
        setOrderOpen(true);
      };
      const submitOrderRequest = async (): Promise<void> => {
        if (!active.value?.productId || !view_activeId || orderQuantity.value <= 0 || orderSubmitting.value) return;
        setOrderSubmitting(true);
        setError('');
        try {
          const result = await sendMessage(view_activeId, '', 'ORDER_REQUEST', {
            businessId: active.value.productId,
            quantity: orderQuantity.value,
            unit: orderUnit.value,
            price: view_orderPrice ?? undefined
          });
          if (result.code !== 200 || !result.data) {
            setError(result.message || '采购需求发送失败');
            return;
          }
          setMessages(current => [...current, result.data]);
          setConversations(current => current.map(item => item.id === view_activeId ? {
            ...item,
            lastMessage: result.data.content,
            lastMessageTime: result.data.createTime
          } : item));
          setOrderOpen(false);
        } catch {
          setError('采购需求发送失败，请检查网络后重试');
        } finally {
          setOrderSubmitting(false);
        }
      };
      const buyerView = !((__props.inbox ?? false) && (__props.inboxRole ?? 'buyer') === 'seller');
      const dialog = <section class={`shop-chat-modal${__props.embedded ?? false ? ' shop-chat-embedded' : ''}`} role="dialog" aria-modal={!(__props.embedded ?? false)} aria-label={__props.inbox ?? false ? '洽谈消息' : '在线洽谈'}>
        <header class="shop-chat-modal-head">
          <div>
            <span><MessageOutlined /></span>
            <div>
              <strong>{__props.inbox ?? false ? '洽谈消息' : '在线洽谈'}</strong>
              <small>{(__props.inbox ?? false) && (__props.inboxRole ?? 'buyer') === 'seller' ? '处理采购方询价并回复价格、库存和交期' : '查看并继续与供应商沟通价格、规格与交期'}</small>
            </div>
          </div>
          {!(__props.embedded ?? false) && <button type="button" aria-label="关闭" onClick={__props.onClose}><CloseOutlined /></button>}
        </header>
        <div class="shop-chat-workspace">
          <aside class="shop-chat-list">
            <div class="shop-chat-search">
              <Input prefix={<SearchOutlined />} value={search.value} onChange={event => setSearch(event.target.value ?? '')} placeholder="搜索联系人..." />
            </div>
            <div class="shop-chat-conversations">
              {visibleConversations.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无洽谈记录" /> : visibleConversations.value.map(conversation => <button type="button" key={conversation.id} class={conversation.id === view_activeId ? 'active' : ''} onClick={() => void chooseConversation(conversation)}>
                  <span class="shop-chat-avatar">{conversation.peerName.slice(0, 1)}</span>
                  <span class="shop-chat-conversation-main">
                    <span><b>{conversation.peerName}</b><small>{timeText(conversation.lastMessageTime)}</small></span>
                    <span>{conversation.lastMessage || '开始沟通报价与采购需求'}</span>
                  </span>
                  {conversation.unread > 0 && <em>{conversation.unread > 99 ? '99+' : conversation.unread}</em>}
                </button>)}
            </div>
          </aside>

          <div class="shop-chat-room">
            {loading.value ? <div class="shop-chat-loading"><Spin /><span>正在进入洽谈室…</span></div> : active.value ? <>
                <header class="shop-chat-room-head">
                  <div>
                    <strong>{active.value.peerName}</strong>
                    <span><i />在线洽谈 · {active.value.role === 'SELLER' ? '供应商工作台' : '采购方'}</span>
                  </div>
                  {active.value.productName && <small><ShoppingOutlined />{active.value.productName}</small>}
                </header>
                <div class="shop-chat-messages" ref={listRef}>
                  <div class="shop-chat-date">开始与 {active.value.peerName} 洽谈</div>
                  {messages.value.length === 0 && <div class="shop-chat-empty">
                      <MessageOutlined />
                      <strong>还没有消息</strong>
                      <span>{(__props.inbox ?? false) && (__props.inboxRole ?? 'buyer') === 'seller' ? '采购方发来消息后会显示在这里。' : '可以发送采购数量、规格要求，或点击“快捷询价”。'}</span>
                    </div>}
                  {messages.value.map(message => <div key={message.id} class={`shop-chat-message ${message.mine ? 'mine' : 'peer'}`}>
                      {message.messageType === 'ORDER_REQUEST' ? <div class="shop-chat-order-card">
                          <small>采购需求</small>
                          <strong>{message.businessTitle || message.content}</strong>
                          <span>{message.businessQuantity} {message.businessUnit}
                            {message.businessPrice != null ? ` · 期望价 ¥${message.businessPrice}/${message.businessUnit}` : ' · 价格面议'}
                          </span>
                          <button type="button" onClick={() => {
                      window.location.href = buyerView ? message.businessUrl || `/order/create?productId=${message.businessId}&quantity=${message.businessQuantity}` : `/product/detail/${message.businessId}`;
                    }}>
                            {buyerView ? '去下单' : '查看货源'}
                          </button>
                        </div> : <div class={`shop-chat-bubble ${message.messageType === 'QUOTE' ? 'quote' : ''}`}>
                          {message.messageType === 'QUOTE' && <small>询价</small>}
                          <p>{message.content}</p>
                        </div>}
                      <span>{message.mine ? '我' : message.senderName} · {timeText(message.createTime)}</span>
                    </div>)}
                </div>
                {error.value && <div class="shop-chat-error">{error.value}</div>}
                <div class="shop-chat-compose">
                  {buyerView && active.value.productId && <button type="button" class="shop-chat-order-request" onClick={openOrderRequest}>
                      发布需求
                    </button>}
                  <button type="button" class="shop-chat-quote" onClick={quickQuote}>
                    {(__props.inbox ?? false) && (__props.inboxRole ?? 'buyer') === 'seller' ? '快捷回复' : '快捷询价'}
                  </button>
                  <Input.TextArea autoSize={{
                  minRows: 2,
                  maxRows: 4
                }} value={text.value} onChange={event => setText(event.target.value ?? '')} onPressEnter={event => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }} placeholder="输入消息，Enter 发送，Shift + Enter 换行" />
                  <button type="button" class="shop-chat-send" disabled={!text.value.trim() || sending.value} onClick={() => void send()}>
                    <SendOutlined />{sending.value ? '发送中' : '发送'}
                  </button>
                </div>
              </> : <div class="shop-chat-empty whole">
                <MessageOutlined /><strong>选择一个对话开始洽谈</strong>
              </div>}
          </div>
        </div>
      </section>;
      const orderDialog = <Modal title="在洽谈中发布采购需求" open={orderOpen.value} onCancel={() => setOrderOpen(false)} onOk={() => void submitOrderRequest()} okText={orderSubmitting.value ? '发送中…' : '发送需求'} cancelText="取消" confirmLoading={orderSubmitting.value}>
      <div class="shop-chat-order-form">
        <div><span>采购商品</span><strong>{active.value?.productName || '当前洽谈商品'}</strong></div>
        <label>
          <span>采购数量</span>
          <InputNumber min={0.001} value={orderQuantity.value} style={{
              width: '100%'
            }} onChange={value => setOrderQuantity(Number(value ?? 0))} />
        </label>
        <label>
          <span>计量单位</span>
          <Select value={orderUnit.value} onChange={setOrderUnit} options={[...new Set([productUnit.value, '件', '箱', '袋', '公斤', '吨'])].map(value => ({
              value,
              label: value
            }))} />
        </label>
        <label>
          <span>期望单价（选填）</span>
          <InputNumber min={0} precision={2} value={view_orderPrice} placeholder="留空表示价格面议" style={{
              width: '100%'
            }} onChange={value => setOrderPrice(value == null ? null : Number(value))} />
        </label>
        <p>发送后双方会看到采购需求卡，买家可点击卡片直接进入下单页。</p>
      </div>
    </Modal>;
      if (__props.embedded ?? false) {
        return <div class="shop-chat-embedded-shell">{dialog}{orderDialog}</div>;
      }
      return <div class="shop-chat-mask" onMousedown={event => {
        if (event.target === event.currentTarget) __props.onClose();
      }}>
      {dialog}
      {orderDialog}
    </div>;
    };
  }
});
