import axios from 'axios'

const service = axios.create({
  baseURL: '/api',
  timeout: 5000
})

service.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code !== 200) {
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return res.data
  },
  error => {
    console.error('Error:', error)
    return Promise.reject(error)
  }
)

export const dashboardAPI = {
  getOverview: () => service.get('/v1/v1/production/analytics/overview'),
  getTaskStats: () => service.get('/v1/v1/production/analytics/task-stats'),
  getHarvestStats: () => service.get('/v1/v1/production/analytics/harvest-stats'),
  getInputStats: () => service.get('/v1/v1/production/analytics/input-stats'),
  getDeviceStats: () => service.get('/v1/v1/production/analytics/device-stats')
}

export const farmAPI = {
  list: (params) => service.get('/v1/v1/production/farms', { params }),
  page: (params) => service.get('/v1/v1/production/farms', { params }),
  get: (id) => service.get(`/v1/v1/production/farms/${id}`),
  create: (data) => service.post('/v1/v1/production/farms', data),
  update: (id, data) => service.put(`/v1/v1/production/farms/${id}`, data),
  delete: (id) => service.delete(`/v1/v1/production/farms/${id}`)
}

export const plotAPI = {
  list: (params) => service.get('/v1/v1/production/plots', { params }),
  page: (params) => service.get('/v1/v1/production/plots', { params }),
  get: (id) => service.get(`/v1/v1/production/plots/${id}`),
  create: (data) => service.post('/v1/v1/production/plots', data),
  update: (id, data) => service.put(`/v1/v1/production/plots/${id}`, data),
  delete: (id) => service.delete(`/v1/v1/production/plots/${id}`)
}

export const taskAPI = {
  list: (params) => service.get('/v1/v1/production/tasks', { params }),
  page: (params) => service.get('/v1/v1/production/tasks', { params }),
  get: (id) => service.get(`/v1/v1/production/tasks/${id}`),
  create: (data) => service.post('/v1/v1/production/tasks', data),
  update: (id, data) => service.put(`/v1/v1/production/tasks/${id}`, data),
  delete: (id) => service.delete(`/v1/v1/production/tasks/${id}`),
  assign: (id, data) => service.post(`/v1/v1/production/tasks/${id}/assign`, data),
  complete: (id) => service.post(`/v1/v1/production/tasks/${id}/complete`),
  start: (id) => service.post(`/v1/v1/production/tasks/${id}/start`)
}

export const inputAPI = {
  list: (params) => service.get('/v1/v1/production/inputs', { params }),
  page: (params) => service.get('/v1/v1/production/inputs', { params }),
  get: (id) => service.get(`/v1/v1/production/inputs/${id}`),
  create: (data) => service.post('/v1/v1/production/inputs', data),
  update: (id, data) => service.put(`/v1/v1/production/inputs/${id}`, data),
  delete: (id) => service.delete(`/v1/v1/production/inputs/${id}`),
  inventory: (params) => service.get('/v1/v1/production/inputs/inventory', { params })
}

export const harvestAPI = {
  list: (params) => service.get('/v1/v1/production/harvests', { params }),
  page: (params) => service.get('/v1/v1/production/harvests', { params }),
  get: (id) => service.get(`/v1/v1/production/harvests/${id}`),
  create: (data) => service.post('/v1/v1/production/harvests', data),
  update: (id, data) => service.put(`/v1/v1/production/harvests/${id}`, data),
  delete: (id) => service.delete(`/v1/v1/production/harvests/${id}`),
  inventory: (params) => service.get('/v1/v1/production/harvests/inventory', { params })
}

export const traceAPI = {
  generate: (data) => service.post('/v1/v1/production/trace-codes/generate', data),
  query: (code) => service.get(`/v1/v1/production/trace-codes/query/${code}`),
  list: (params) => service.get('/v1/v1/production/trace-codes', { params }),
  page: (params) => service.get('/v1/v1/production/trace-codes', { params }),
  activate: (id) => service.post(`/v1/v1/production/trace-codes/${id}/activate`),
  deactivate: (id) => service.post(`/v1/v1/production/trace-codes/${id}/deactivate`)
}

export const alertAPI = {
  rules: {
    list: (params) => service.get('/v1/production/alert/rule/list', { params }),
    page: (params) => service.get('/v1/production/alert/rule/page', { params }),
    get: (id) => service.get(`/v1/production/alert/rule/${id}`),
    create: (data) => service.post('/v1/production/alert/rule', data),
    update: (id, data) => service.put(`/v1/production/alert/rule/${id}`, data),
    delete: (id) => service.delete(`/v1/production/alert/rule/${id}`),
    enable: (id) => service.post(`/v1/production/alert/rule/${id}/enable`),
    disable: (id) => service.post(`/v1/production/alert/rule/${id}/disable`)
  },
  records: {
    list: (params) => service.get('/v1/production/alert/record/list', { params }),
    page: (params) => service.get('/v1/production/alert/record/page', { params }),
    get: (id) => service.get(`/v1/production/alert/record/${id}`),
    handle: (id, data) => service.post(`/v1/production/alert/record/${id}/handle`, data)
  },
  plans: {
    list: (params) => service.get('/v1/production/emergency/list', { params }),
    page: (params) => service.get('/v1/production/emergency/page', { params }),
    get: (id) => service.get(`/v1/production/emergency/${id}`),
    create: (data) => service.post('/v1/production/emergency', data),
    update: (id, data) => service.put(`/v1/production/emergency/${id}`, data),
    delete: (id) => service.delete(`/v1/production/emergency/${id}`),
    execute: (id) => service.post(`/v1/production/emergency/${id}/execute`)
  }
}

export const iotAPI = {
  devices: {
    list: (params) => service.get('/v1/production/iot/device/list', { params }),
    page: (params) => service.get('/v1/production/iot/device/page', { params }),
    get: (id) => service.get(`/v1/production/iot/device/${id}`),
    create: (data) => service.post('/v1/production/iot/device', data),
    update: (id, data) => service.put(`/v1/production/iot/device/${id}`, data),
    delete: (id) => service.delete(`/v1/production/iot/device/${id}`),
    connect: (id) => service.post(`/v1/production/iot/device/${id}/connect`),
    disconnect: (id) => service.post(`/v1/production/iot/device/${id}/disconnect`)
  },
  data: {
    latest: (deviceId) => service.get(`/v1/production/iot/data/latest/${deviceId}`),
    history: (params) => service.get('/v1/production/iot/data/history', { params })
  }
}

export const qualityAPI = {
  inspections: {
    list: (params) => service.get('/v1/production/quality/list', { params }),
    page: (params) => service.get('/v1/production/quality/page', { params }),
    get: (id) => service.get(`/v1/production/quality/${id}`),
    create: (data) => service.post('/v1/production/quality', data),
    update: (id, data) => service.put(`/v1/production/quality/${id}`, data),
    delete: (id) => service.delete(`/v1/production/quality/${id}`),
    approve: (id, data) => service.post(`/v1/production/quality/${id}/approve`, data)
  },
  items: {
    list: (params) => service.get('/v1/production/quality/item/list', { params }),
    get: (id) => service.get(`/v1/production/quality/item/${id}`),
    create: (data) => service.post('/v1/production/quality/item', data),
    update: (id, data) => service.put(`/v1/production/quality/item/${id}`, data),
    delete: (id) => service.delete(`/v1/production/quality/item/${id}`)
  }
}

export const adminAPI = {
  overview: () => service.get('/v1/production/admin/overview'),
  statistics: () => service.get('/v1/production/admin/statistics'),
  farms: () => service.get('/v1/production/admin/farms/all'),
  getFarm: (id) => service.get(`/v1/production/admin/farms/${id}`),
  updateFarmStatus: (id, data) => service.put(`/v1/production/admin/farms/${id}/status`, data),
  alerts: () => service.get('/v1/production/admin/alerts/all'),
  handleAlert: (id) => service.put(`/v1/production/admin/alerts/${id}/handle`)
}

export const tenantAPI = {
  list: () => service.get('/v1/production/admin/tenants'),
  get: (id) => service.get(`/v1/production/admin/tenants/${id}`),
  create: (data) => service.post('/v1/production/admin/tenants', data),
  update: (id, data) => service.put(`/v1/production/admin/tenants/${id}`, data),
  delete: (id) => service.delete(`/v1/production/admin/tenants/${id}`),
  updateStatus: (id, data) => service.put(`/v1/production/admin/tenants/${id}/status`, data),
  audit: (id, data) => service.put(`/v1/production/admin/tenants/${id}/audit`, data),
  statistics: () => service.get('/v1/production/admin/tenants/statistics')
}

export const sopAPI = {
  templates: {
    list: (params) => service.get('/v1/production/sop/template/list', { params }),
    page: (params) => service.get('/v1/production/sop/template/page', { params }),
    get: (id) => service.get(`/v1/production/sop/template/${id}`),
    create: (data) => service.post('/v1/production/sop/template', data),
    update: (id, data) => service.put(`/v1/production/sop/template/${id}`, data),
    delete: (id) => service.delete(`/v1/production/sop/template/${id}`)
  },
  executions: {
    list: (params) => service.get('/v1/production/sop/execution/list', { params }),
    page: (params) => service.get('/v1/production/sop/execution/page', { params }),
    get: (id) => service.get(`/v1/production/sop/execution/${id}`),
    create: (data) => service.post('/v1/production/sop/execution', data),
    update: (id, data) => service.put(`/v1/production/sop/execution/${id}`, data),
    delete: (id) => service.delete(`/v1/production/sop/execution/${id}`),
    start: (id) => service.post(`/v1/production/sop/execution/${id}/start`),
    complete: (id) => service.post(`/v1/production/sop/execution/${id}/complete`),
    pause: (id) => service.post(`/v1/production/sop/execution/${id}/pause`)
  }
}

export const aiAPI = {
  diagnose: (data) => service.post('/v1/production/ai/diagnose', data),
  predictYield: (data) => service.post('/v1/production/ai/predict-yield', data),
  recommendInput: (data) => service.post('/v1/production/ai/recommend-input', data),
  analyzeSoil: (data) => service.post('/v1/production/ai/analyze-soil', data),
  generateTask: (data) => service.post('/v1/production/ai/generate-task', data)
}

export default service