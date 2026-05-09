import request from '../utils/request'

export function getGroupList(params) {
  return request({
    url: '/iot/group/page',
    method: 'get',
    params
  })
}

export function getGroupDetail(id) {
  return request({
    url: `/iot/group/${id}`,
    method: 'get'
  })
}

export function createGroup(data) {
  return request({
    url: '/iot/group',
    method: 'post',
    data
  })
}

export function updateGroup(id, data) {
  return request({
    url: `/iot/group/${id}`,
    method: 'put',
    data
  })
}

export function deleteGroup(id) {
  return request({
    url: `/iot/group/${id}`,
    method: 'delete'
  })
}

export function addDevicesToGroup(groupId, data) {
  return request({
    url: `/iot/group/${groupId}/devices`,
    method: 'post',
    data
  })
}

export function removeDevicesFromGroup(groupId, data) {
  return request({
    url: `/iot/group/${groupId}/devices`,
    method: 'delete',
    data
  })
}

export function batchControlGroup(groupId, data) {
  return request({
    url: `/iot/group/${groupId}/control`,
    method: 'post',
    data
  })
}