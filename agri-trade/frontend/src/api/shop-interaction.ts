import axios from 'axios'

export interface FollowState {
  followed: boolean
  followers: number
}

export interface FollowingSeller {
  sellerId: number | string
  sellerName: string
  province: string | null
  city: string | null
  productCount: number
  minPrice: number | null
  categories: string | null
  followedAt: string
}

export interface FavoriteProduct {
  productId: number
  productName: string
  sellerId: number | null
  sellerName: string | null
  categoryName: string | null
  price: number | null
  unit: string | null
  publishStatus: string | null
  favoritedAt: string
}

export interface Conversation {
  id: number
  conversationNo: string
  peerName: string
  role: 'BUYER' | 'SELLER'
  productId: number | null
  productName: string | null
  lastMessage: string | null
  lastMessageTime: string | null
  unread: number
  sellerId: number | string
  sellerName: string
}

export interface ChatMessage {
  id: number
  mine: boolean
  senderRole: 'BUYER' | 'SELLER' | 'SYSTEM'
  senderName: string
  messageType: 'TEXT' | 'QUOTE' | 'ORDER_REQUEST' | 'SYSTEM'
  content: string
  attachmentUrl: string | null
  businessType: 'ORDER_REQUEST' | null
  businessId: number | null
  businessTitle: string | null
  businessUrl: string | null
  businessQuantity: number | null
  businessUnit: string | null
  businessPrice: number | null
  createTime: string
}

interface ApiBody<T> {
  code: number
  message?: string
  data: T
}

export async function getFollowState(sellerId: string): Promise<ApiBody<FollowState>> {
  const response = await axios.get<ApiBody<FollowState>>(
    `/api/trade/shop-interactions/follow/${encodeURIComponent(sellerId)}`,
    { headers: { 'X-Skip-Auth-Redirect': '1' } },
  )
  return response.data
}

export async function followSeller(sellerId: string): Promise<ApiBody<FollowState>> {
  const response = await axios.post<ApiBody<FollowState>>(
    `/api/trade/shop-interactions/follow/${encodeURIComponent(sellerId)}`,
  )
  return response.data
}

export async function getFollowingSellers(): Promise<ApiBody<FollowingSeller[]>> {
  const response = await axios.get<ApiBody<FollowingSeller[]>>('/api/trade/shop-interactions/following')
  return response.data
}

export async function getFavoriteProducts(): Promise<ApiBody<FavoriteProduct[]>> {
  const response = await axios.get<ApiBody<FavoriteProduct[]>>('/api/trade/shop-interactions/favorites/products')
  return response.data
}

export async function getProductFavoriteState(productId: number | string): Promise<ApiBody<{ favorited: boolean }>> {
  const response = await axios.get<ApiBody<{ favorited: boolean }>>(
    `/api/trade/shop-interactions/favorites/products/${encodeURIComponent(String(productId))}`,
    { headers: { 'X-Skip-Auth-Redirect': '1' } },
  )
  return response.data
}

export async function favoriteProduct(productId: number | string): Promise<ApiBody<{ favorited: boolean }>> {
  const response = await axios.post<ApiBody<{ favorited: boolean }>>(
    `/api/trade/shop-interactions/favorites/products/${encodeURIComponent(String(productId))}`,
  )
  return response.data
}

export async function unfavoriteProduct(productId: number | string): Promise<ApiBody<{ favorited: boolean }>> {
  const response = await axios.delete<ApiBody<{ favorited: boolean }>>(
    `/api/trade/shop-interactions/favorites/products/${encodeURIComponent(String(productId))}`,
  )
  return response.data
}

export async function unfollowSeller(sellerId: string): Promise<ApiBody<FollowState>> {
  const response = await axios.delete<ApiBody<FollowState>>(
    `/api/trade/shop-interactions/follow/${encodeURIComponent(sellerId)}`,
  )
  return response.data
}

export async function openNegotiation(sellerId: string, productId?: number | null): Promise<ApiBody<Conversation>> {
  const response = await axios.post<ApiBody<Conversation>>('/api/trade/shop-interactions/negotiations/open', {
    sellerId,
    productId: productId ?? null,
  })
  return response.data
}

export async function getConversations(): Promise<ApiBody<Conversation[]>> {
  const response = await axios.get<ApiBody<Conversation[]>>('/api/trade/shop-interactions/negotiations')
  return response.data
}

export async function getMessages(conversationId: number): Promise<ApiBody<ChatMessage[]>> {
  const response = await axios.get<ApiBody<ChatMessage[]>>(
    `/api/trade/shop-interactions/negotiations/${conversationId}/messages`,
  )
  return response.data
}

export async function sendMessage(
  conversationId: number,
  content: string,
  messageType: 'TEXT' | 'QUOTE' | 'ORDER_REQUEST' = 'TEXT',
  orderCard?: {
    businessId: number
    quantity: number
    unit?: string
    price?: number
  },
): Promise<ApiBody<ChatMessage>> {
  const response = await axios.post<ApiBody<ChatMessage>>(
    `/api/trade/shop-interactions/negotiations/${conversationId}/messages`,
    {
      content,
      messageType,
      businessId: orderCard?.businessId,
      quantity: orderCard?.quantity,
      unit: orderCard?.unit,
      price: orderCard?.price,
    },
  )
  return response.data
}
