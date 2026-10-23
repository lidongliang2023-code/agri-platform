import request from '@/utils/request'

export const authAPI = {
  login: (data: { username: string; password: string }) =>
    request.post('/auth/login', data),
  getUserInfo: () => request.get('/auth/user/info'),
}

export const deviceAPI = {
  list: (params: any) => request.get('/iot/device', { params }),
  get: (id: number) => request.get(`/iot/device/${id}`),
  create: (data: any) => request.post('/iot/device', data),
  update: (id: number, data: any) => request.put(`/iot/device/${id}`, data),
  delete: (id: number) => request.delete(`/iot/device/${id}`),
}

export const alertAPI = {
  list: (params: any) => request.get('/iot/alert', { params }),
  handle: (id: number, data: any) => request.put(`/iot/alert/${id}/handle`, data),
}

export const plotAPI = {
  list: (params: any) => request.get('/iot/plot', { params }),
  create: (data: any) => request.post('/iot/plot', data),
  update: (id: number, data: any) => request.put(`/iot/plot/${id}`, data),
  delete: (id: number) => request.delete(`/iot/plot/${id}`),
}

export const groupAPI = {
  list: () => request.get('/iot/group'),
  create: (data: any) => request.post('/iot/group', data),
  update: (id: number, data: any) => request.put(`/iot/group/${id}`, data),
  delete: (id: number) => request.delete(`/iot/group/${id}`),
}

export const reportAPI = {
  list: (params: any) => request.get('/iot/report', { params }),
}

export const ruleAPI = {
  list: () => request.get('/iot/rule'),
  create: (data: any) => request.post('/iot/rule', data),
  update: (id: number, data: any) => request.put(`/iot/rule/${id}`, data),
  delete: (id: number) => request.delete(`/iot/rule/${id}`),
}

export const pushAPI = {
  config: () => request.get('/iot/push/config'),
  saveConfig: (data: any) => request.post('/iot/push/config', data),
  messages: (params: any) => request.get('/iot/push/message', { params }),
}

export const dashboardAPI = {
  overview: () => request.get('/iot/dashboard/overview'),
}
