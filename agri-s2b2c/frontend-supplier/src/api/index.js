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

export const supplierApi = {
  apply: (data) => instance.post('/supplier/apply', data),
  getDetail: (id) => instance.get(`/supplier/detail/${id}`),
  getProducts: (params) => instance.get('/supplier/products', { params }),
  createProduct: (data) => instance.post('/supplier/product/create', data),
  updateProduct: (data) => instance.put('/supplier/product/update', data),
  updateInfo: (data) => instance.put('/supplier/update', data)
}

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getProducts: (params) => instance.get('/platform/products', { params }),
  getProductDetail: (id) => instance.get(`/platform/product/detail/${id}`),
  getOrders: (params) => instance.get('/platform/orders', { params }),
  getOrderDetail: (id) => instance.get(`/platform/order/detail/${id}`)
}

export default instance