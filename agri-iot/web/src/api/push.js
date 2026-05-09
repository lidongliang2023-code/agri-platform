import request from '../utils/request'

export function getPushConfig() {
  return request({
    url: '/iot/push/config',
    method: 'get'
  })
}

export function updatePushConfig(data) {
  return request({
    url: '/iot/push/config',
    method: 'put',
    data
  })
}

export function getNotificationList(params) {
  return request({
    url: '/iot/push/notification/page',
    method: 'get',
    params
  })
}

export function sendNotification(data) {
  return request({
    url: '/iot/push/send',
    method: 'post',
    data
  })
}