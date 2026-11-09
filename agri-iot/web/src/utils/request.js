import axios from 'axios'
import { redirectToSso } from '../../../shared-ui/sso'

const service = axios.create({
  baseURL: '/api',
  timeout: 10000
})

service.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code !== 200) {
      if (res.code === 401) {
        localStorage.removeItem('token')
        // 本应用已不再自建登录页，401 一律回到统一认证中心。
        void redirectToSso('iot', window.location.pathname + window.location.search)
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data
  },
  error => {
    return Promise.reject(error)
  }
)

export default service