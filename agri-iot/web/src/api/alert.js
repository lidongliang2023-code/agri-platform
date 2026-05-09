import request from '../utils/request'

export function getAlertList(params) {
  return request({
    url: '/iot/alert/page',
    method: 'get',
    params
  })
}

export function getAlertRuleList(params) {
  return request({
    url: '/iot/alert/rule/page',
    method: 'get',
    params
  })
}

export function createAlertRule(data) {
  return request({
    url: '/iot/alert/rule',
    method: 'post',
    data
  })
}

export function updateAlertRule(id, data) {
  return request({
    url: `/iot/alert/rule/${id}`,
    method: 'put',
    data
  })
}

export function deleteAlertRule(id) {
  return request({
    url: `/iot/alert/rule/${id}`,
    method: 'delete'
  })
}

export function handleAlert(id, data) {
  return request({
    url: `/iot/alert/${id}/handle`,
    method: 'post',
    data
  })
}