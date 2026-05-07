import request from '@/utils/request';
import { DeviceVO, DeviceSaveDTO, DeviceUpdateDTO, DevicePageDTO, DeviceTypeVO, DeviceTypeSaveDTO, DeviceTypeUpdateDTO, DeviceTypePageDTO, DeviceDataVO, RealtimeDataVO, AlertRuleVO, AlertRuleSaveDTO, AlertRuleUpdateDTO, AlertRulePageDTO, AlertRecordVO, AlertRecordPageDTO, AlertHandleDTO, SceneVO, SceneSaveDTO, SceneActivateDTO, AutomationRuleVO, AutomationRuleSaveDTO, ControlCommandDTO } from '@/models/iot/device';
import { ApiResponse, PageResult } from '@/models/common';

export const deviceApi = {
  page: (params: DevicePageDTO): Promise<ApiResponse<PageResult<DeviceVO>>> =>
    request.post('/api/iot/device/page', params),

  getById: (id: number): Promise<ApiResponse<DeviceVO>> =>
    request.get(`/api/iot/device/${id}`),

  create: (data: DeviceSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/device', data),

  update: (id: number, data: DeviceUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/device/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/device/${id}`),
};

export const deviceTypeApi = {
  page: (params: DeviceTypePageDTO): Promise<ApiResponse<PageResult<DeviceTypeVO>>> =>
    request.post('/api/iot/device-type/page', params),

  getById: (id: number): Promise<ApiResponse<DeviceTypeVO>> =>
    request.get(`/api/iot/device-type/${id}`),

  create: (data: DeviceTypeSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/device-type', data),

  update: (id: number, data: DeviceTypeUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/device-type/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/device-type/${id}`),

  list: (): Promise<ApiResponse<DeviceTypeVO[]>> =>
    request.get('/api/iot/device-type/list'),
};

export const dataApi = {
  history: (deviceId: number, params: { startTime?: string; endTime?: string; pageNum?: number; pageSize?: number }): Promise<ApiResponse<PageResult<DeviceDataVO>>> =>
    request.get(`/api/iot/data/history/${deviceId}`, { params }),

  realtime: (deviceId: number): Promise<ApiResponse<RealtimeDataVO>> =>
    request.get(`/api/iot/data/realtime/${deviceId}`),

  plotRealtime: (plotId: number): Promise<ApiResponse<RealtimeDataVO[]>> =>
    request.get(`/api/iot/data/realtime/plot/${plotId}`),
};

export const alertRuleApi = {
  page: (params: AlertRulePageDTO): Promise<ApiResponse<PageResult<AlertRuleVO>>> =>
    request.post('/api/iot/alert-rule/page', params),

  getById: (id: number): Promise<ApiResponse<AlertRuleVO>> =>
    request.get(`/api/iot/alert-rule/${id}`),

  create: (data: AlertRuleSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/alert-rule', data),

  update: (id: number, data: AlertRuleUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/alert-rule/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/alert-rule/${id}`),

  changeStatus: (id: number, status: number): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/alert-rule/${id}/status`, { status }),

  options: (): Promise<ApiResponse<AlertRuleVO[]>> =>
    request.get('/api/iot/alert-rule/options'),
};

export const alertRecordApi = {
  page: (params: AlertRecordPageDTO): Promise<ApiResponse<PageResult<AlertRecordVO>>> =>
    request.post('/api/iot/alert/page', params),

  getById: (id: number): Promise<ApiResponse<AlertRecordVO>> =>
    request.get(`/api/iot/alert/${id}`),

  handle: (id: number, data: AlertHandleDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/alert/${id}/handle`, data),

  batchHandle: (ids: number[], result: string): Promise<ApiResponse<void>> =>
    request.put('/api/iot/alert/batch/handle', { ids, result }),

  unhandledCount: (): Promise<ApiResponse<number>> =>
    request.get('/api/iot/alert/unhandled/count'),

  recent: (limit?: number): Promise<ApiResponse<AlertRecordVO[]>> =>
    request.get('/api/iot/alert/recent', { params: { limit } }),
};

export const sceneApi = {
  page: (params: { pageNum: number; pageSize: number }): Promise<ApiResponse<PageResult<SceneVO>>> =>
    request.post('/api/iot/scene/page', params),

  create: (data: SceneSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/scene', data),

  update: (id: number, data: SceneSaveDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/scene/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/scene/${id}`),

  activate: (id: number, data: SceneActivateDTO): Promise<ApiResponse<void>> =>
    request.post(`/api/iot/scene/${id}/activate`, data),
};

export const automationApi = {
  page: (params: { pageNum: number; pageSize: number }): Promise<ApiResponse<PageResult<AutomationRuleVO>>> =>
    request.post('/api/iot/automation/page', params),

  create: (data: AutomationRuleSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/automation', data),

  update: (id: number, data: AutomationRuleSaveDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/automation/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/automation/${id}`),
};

export const controlApi = {
  send: (deviceId: number, data: ControlCommandDTO): Promise<ApiResponse<void>> =>
    request.post(`/api/iot/control/${deviceId}`, data),

  history: (deviceId: number, params?: { pageNum?: number; pageSize?: number }): Promise<ApiResponse<PageResult<unknown>>> =>
    request.get(`/api/iot/control/history/${deviceId}`, { params }),
};
