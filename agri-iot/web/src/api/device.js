import request from '../utils/request'

export function getDeviceList(params) {
  return request({
    url: '/iot/device/page',
    method: 'get',
    params
  })
}

export function getDeviceDetail(id) {
  return request({
    url: `/iot/device/${id}`,
    method: 'get'
  })
}

export function createDevice(data) {
  return request({
    url: '/iot/device',
    method: 'post',
    data
  })
}

export function updateDevice(id, data) {
  return request({
    url: `/iot/device/${id}`,
    method: 'put',
    data
  })
}

export function deleteDevice(id) {
  return request({
    url: `/iot/device/${id}`,
    method: 'delete'
  })
}

export function controlDevice(id, data) {
  return request({
    url: `/iot/device/${id}/control`,
    method: 'post',
    data
  })
}

export function getRealtimeData(deviceId) {
  return request({
    url: `/iot/data/realtime/${deviceId}`,
    method: 'get'
  })
}

export function getDeviceHistory(deviceId, params) {
  return request({
    url: `/iot/data/history/${deviceId}`,
    method: 'get',
    params
  })
}