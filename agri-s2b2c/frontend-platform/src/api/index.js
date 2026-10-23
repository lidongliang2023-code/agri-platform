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

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getSuppliers: (params) => instance.get('/platform/suppliers', { params }),
  getSupplierDetail: (id) => instance.get(`/platform/supplier/detail/${id}`),
  auditSupplier: (params) => instance.put('/platform/supplier/audit', null, { params }),
  getChannelPartners: (params) => instance.get('/platform/channel-partners', { params }),
  getChannelPartnerDetail: (id) => instance.get(`/platform/channel-partner/detail/${id}`),
  auditChannelPartner: (params) => instance.put('/platform/channel-partner/audit', null, { params }),
  getProducts: (params) => instance.get('/platform/products', { params }),
  getProductDetail: (id) => instance.get(`/platform/product/detail/${id}`),
  auditProduct: (params) => instance.put('/platform/product/audit', null, { params }),
  getOrders: (params) => instance.get('/platform/orders', { params }),
  getOrderDetail: (id) => instance.get(`/platform/order/detail/${id}`),
  getCategories: () => instance.get('/platform/categories'),
  addCategory: (data) => instance.post('/platform/category/add', data),
  updateCategory: (data) => instance.put('/platform/category/update', data),
  deleteCategory: (id) => instance.delete(`/platform/category/delete/${id}`)
}

export default instance