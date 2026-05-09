import request from '../utils/request'

export function getReportList(params) {
  return request({
    url: '/iot/report/page',
    method: 'get',
    params
  })
}

export function getReportDetail(id) {
  return request({
    url: `/iot/report/${id}`,
    method: 'get'
  })
}

export function createReport(data) {
  return request({
    url: '/iot/report',
    method: 'post',
    data
  })
}

export function updateReport(id, data) {
  return request({
    url: `/iot/report/${id}`,
    method: 'put',
    data
  })
}

export function deleteReport(id) {
  return request({
    url: `/iot/report/${id}`,
    method: 'delete'
  })
}

export function generateReport(id) {
  return request({
    url: `/iot/report/${id}/generate`,
    method: 'post'
  })
}

export function exportReport(id) {
  return request({
    url: `/iot/report/${id}/export`,
    method: 'get',
    responseType: 'blob'
  })
}