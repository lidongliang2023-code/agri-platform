import axios from 'axios'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

instance.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)
    return Promise.reject(err)
  }
)

export const channelApi = {
  apply: (data) => instance.post('/channel/apply', data),
  getDetail: (id) => instance.get(`/channel/detail/${id}`),
  getProducts: (params) => instance.get('/channel/products', { params }),
  getProductPool: (params) => instance.get('/channel/product-pool', { params }),
  selectProduct: (params) => instance.post('/channel/select-product', null, { params }),
  getCommissions: (params) => instance.get('/channel/commissions', { params }),
  getTotalCommission: (channelId) => instance.get('/channel/total-commission', { params: { channelId } }),
  updateInfo: (data) => instance.put('/channel/update', data)
}

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getOrders: (params) => instance.get('/platform/orders', { params })
}

export default instance