import axios from 'axios'
import { redirectToSso } from '../../../shared-ui/sso'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // 本应用已不再自建登录页，401 一律回到统一认证中心。
      void redirectToSso('iot', window.location.pathname + window.location.search)
    }
    return Promise.reject(error)
  },
)

export default request
