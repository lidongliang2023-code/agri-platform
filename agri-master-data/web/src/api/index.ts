import request from '@/utils/request'

export const authAPI = {
  login: (data: { username: string; password: string }) =>
    request.post('/auth/login', data),
  getUserInfo: () => request.get('/auth/user/info'),
}

export const dashboardAPI = {
  overview: () => request.get('/admin/masterdata/dashboard'),
}

export const tenantAPI = {
  list: (params: any) => request.get('/admin/masterdata/tenant', { params }),
  get: (id: number | string) => request.get(`/admin/masterdata/tenant/${id}`),
  create: (data: any) => request.post('/admin/masterdata/tenant', data),
  update: (id: number | string, data: any) => request.put(`/admin/masterdata/tenant/${id}`, data),
  delete: (id: number | string) => request.delete(`/admin/masterdata/tenant/${id}`),
  updateStatus: (id: number | string, status: number) =>
    request.put(`/admin/masterdata/tenant/${id}/status`, { status }),
}

export const userAPI = {
  list: (params: any) => request.get('/admin/masterdata/user', { params }),
  get: (id: number) => request.get(`/admin/masterdata/user/${id}`),
  create: (data: any) => request.post('/admin/masterdata/user', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/user/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/user/${id}`),
  audit: (params: any) => request.get('/admin/masterdata/user/audit', { params }),
  review: (id: number, data: any) => request.put(`/admin/masterdata/user/audit/${id}/review`, data),
}

export const orgAPI = {
  list: (params: any) => request.get('/admin/masterdata/org', { params }),
  tree: () => request.get('/admin/masterdata/org/tree'),
  get: (id: number) => request.get(`/admin/masterdata/org/${id}`),
  create: (data: any) => request.post('/admin/masterdata/org', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/org/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/org/${id}`),
}

export const roleAPI = {
  list: (params: any) => request.get('/admin/masterdata/permission/role', { params }),
  get: (id: number) => request.get(`/admin/masterdata/permission/role/${id}`),
  create: (data: any) => request.post('/admin/masterdata/permission/role', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/permission/role/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/permission/role/${id}`),
}

export const productAPI = {
  list: (params: any) => request.get('/admin/masterdata/product', { params }),
  get: (id: number) => request.get(`/admin/masterdata/product/${id}`),
  create: (data: any) => request.post('/admin/masterdata/product', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/product/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/product/${id}`),
}

export const customerAPI = {
  list: (params: any) => request.get('/admin/masterdata/customer', { params }),
  get: (id: number) => request.get(`/admin/masterdata/customer/${id}`),
  create: (data: any) => request.post('/admin/masterdata/customer', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/customer/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/customer/${id}`),
}

export const supplierAPI = {
  list: (params: any) => request.get('/admin/masterdata/supplier', { params }),
  get: (id: number) => request.get(`/admin/masterdata/supplier/${id}`),
  create: (data: any) => request.post('/admin/masterdata/supplier', data),
  update: (id: number, data: any) => request.put(`/admin/masterdata/supplier/${id}`, data),
  delete: (id: number) => request.delete(`/admin/masterdata/supplier/${id}`),
}
