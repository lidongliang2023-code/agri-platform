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

export const consumerApi = {
  login: (phone) => instance.get('/consumer/login', { params: { phone } }),
  register: (data) => instance.post('/consumer/register', data),
  getProducts: (params) => instance.get('/consumer/products', { params }),
  getProductDetail: (id) => instance.get(`/consumer/product/detail/${id}`),
  getCart: (consumerId) => instance.get('/consumer/cart', { params: { consumerId } }),
  addCart: (params) => instance.post('/consumer/cart/add', null, { params }),
  updateCart: (params) => instance.put('/consumer/cart/update', null, { params }),
  deleteCart: (id) => instance.delete(`/consumer/cart/delete/${id}`),
  createOrder: (data) => instance.post('/consumer/order/create', data),
  getOrders: (params) => instance.get('/consumer/orders', { params }),
  getOrderDetail: (id) => instance.get(`/consumer/order/detail/${id}`),
  payOrder: (id) => instance.put(`/consumer/order/pay/${id}`),
  receiveOrder: (id) => instance.put(`/consumer/order/receive/${id}`),
  getAddresses: (consumerId) => instance.get('/consumer/addresses', { params: { consumerId } }),
  addAddress: (data) => instance.post('/consumer/address/add', data),
  updateAddress: (data) => instance.put('/consumer/address/update', data),
  deleteAddress: (id) => instance.delete(`/consumer/address/delete/${id}`),
  getDetail: (id) => instance.get(`/consumer/detail/${id}`),
  updateInfo: (data) => instance.put('/consumer/update', data)
}

export default instance