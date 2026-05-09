import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 5000
})

request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => {
  return Promise.reject(error)
})

request.interceptors.response.use(response => {
  return response.data
}, error => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }
  return Promise.reject(error)
})

export const login = (data) => request.post('/auth/login', data)
export const logout = () => request.post('/auth/logout')

export const getDashboard = () => request.get('/admin/masterdata/dashboard')
export const getTenantList = (params) => request.get('/admin/masterdata/tenant', { params })
export const getTenantDetail = (id) => request.get(`/admin/masterdata/tenant/${id}`)
export const createTenant = (data) => request.post('/admin/masterdata/tenant', data)
export const updateTenant = (id, data) => request.put(`/admin/masterdata/tenant/${id}`, data)
export const deleteTenant = (id) => request.delete(`/admin/masterdata/tenant/${id}`)
export const updateTenantStatus = (id, status) => request.put(`/admin/masterdata/tenant/${id}/status`, { status })

export const getUserList = (params) => request.get('/admin/masterdata/user', { params })
export const getUserDetail = (id) => request.get(`/admin/masterdata/user/${id}`)
export const createUser = (data) => request.post('/admin/masterdata/user', data)
export const updateUser = (id, data) => request.put(`/admin/masterdata/user/${id}`, data)
export const deleteUser = (id) => request.delete(`/admin/masterdata/user/${id}`)
export const getUserAuditList = (params) => request.get('/admin/masterdata/user/audit', { params })
export const reviewUserCert = (id, data) => request.put(`/admin/masterdata/user/audit/${id}/review`, data)
export const changeStatus = (id, status) => request.put(`/admin/masterdata/user/${id}/status`, { status })

export const getOrgList = (params) => request.get('/admin/masterdata/org', { params })
export const getOrgTree = () => request.get('/admin/masterdata/org/tree')
export const getOrgDetail = (id) => request.get(`/admin/masterdata/org/${id}`)
export const createOrg = (data) => request.post('/admin/masterdata/org', data)
export const updateOrg = (id, data) => request.put(`/admin/masterdata/org/${id}`, data)
export const deleteOrg = (id) => request.delete(`/admin/masterdata/org/${id}`)
export const getOrgAuditList = (params) => request.get('/admin/masterdata/org/audit', { params })
export const reviewOrgCert = (id, data) => request.put(`/admin/masterdata/org/audit/${id}/review`, data)

export const getRoleList = (params) => request.get('/admin/masterdata/permission/role', { params })
export const getRoleDetail = (id) => request.get(`/admin/masterdata/permission/role/${id}`)
export const createRole = (data) => request.post('/admin/masterdata/permission/role', data)
export const updateRole = (id, data) => request.put(`/admin/masterdata/permission/role/${id}`, data)
export const deleteRole = (id) => request.delete(`/admin/masterdata/permission/role/${id}`)
export const getOperationLogs = (params) => request.get('/admin/masterdata/permission/logs', { params })

export const getDictList = (params) => request.get('/admin/masterdata/data-standard/dict', { params })
export const getDictDetail = (id) => request.get(`/admin/masterdata/data-standard/dict/${id}`)
export const createDict = (data) => request.post('/admin/masterdata/data-standard/dict', data)
export const updateDict = (id, data) => request.put(`/admin/masterdata/data-standard/dict/${id}`, data)
export const deleteDict = (id) => request.delete(`/admin/masterdata/data-standard/dict/${id}`)

export const getCodeRuleList = (params) => request.get('/admin/masterdata/data-standard/code-rule', { params })
export const getCodeRuleDetail = (id) => request.get(`/admin/masterdata/data-standard/code-rule/${id}`)
export const createCodeRule = (data) => request.post('/admin/masterdata/data-standard/code-rule', data)
export const updateCodeRule = (id, data) => request.put(`/admin/masterdata/data-standard/code-rule/${id}`, data)
export const deleteCodeRule = (id) => request.delete(`/admin/masterdata/data-standard/code-rule/${id}`)

export const getQualityList = (params) => request.get('/admin/masterdata/quality', { params })
export const getQualityDetail = (id) => request.get(`/admin/masterdata/quality/${id}`)
export const handleQualityIssue = (id, data) => request.put(`/admin/masterdata/quality/${id}/handle`, data)

export const getDistributionList = (params) => request.get('/admin/masterdata/distribution', { params })
export const getDistributionDetail = (id) => request.get(`/admin/masterdata/distribution/${id}`)
export const retryDistribution = (id) => request.post(`/admin/masterdata/distribution/${id}/retry`)

export const getProductList = (params) => request.get('/admin/masterdata/product', { params })
export const getProductDetail = (id) => request.get(`/admin/masterdata/product/${id}`)
export const createProduct = (data) => request.post('/admin/masterdata/product', data)
export const updateProduct = (id, data) => request.put(`/admin/masterdata/product/${id}`, data)
export const deleteProduct = (id) => request.delete(`/admin/masterdata/product/${id}`)

export const getCustomerList = (params) => request.get('/admin/masterdata/customer', { params })
export const getCustomerDetail = (id) => request.get(`/admin/masterdata/customer/${id}`)
export const createCustomer = (data) => request.post('/admin/masterdata/customer', data)
export const updateCustomer = (id, data) => request.put(`/admin/masterdata/customer/${id}`, data)
export const deleteCustomer = (id) => request.delete(`/admin/masterdata/customer/${id}`)

export const getSupplierList = (params) => request.get('/admin/masterdata/supplier', { params })
export const getSupplierDetail = (id) => request.get(`/admin/masterdata/supplier/${id}`)
export const createSupplier = (data) => request.post('/admin/masterdata/supplier', data)
export const updateSupplier = (id, data) => request.put(`/admin/masterdata/supplier/${id}`, data)
export const deleteSupplier = (id) => request.delete(`/admin/masterdata/supplier/${id}`)
