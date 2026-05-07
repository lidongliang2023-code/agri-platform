import request from '@/utils/request';

export interface GatewayVO {
  id?: number;
  gatewayCode?: string;
  gatewayName?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  port?: number;
  protocol?: string;
  plotId?: number;
  plotName?: string;
  onlineStatus?: number;
  heartInterval?: number;
  location?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface GatewayPageDTO {
  pageNum: number;
  pageSize: number;
  gatewayCode?: string;
  gatewayName?: string;
  plotId?: number;
  onlineStatus?: number;
}

export interface GatewaySaveDTO {
  gatewayCode?: string;
  gatewayName?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  port?: number;
  protocol?: string;
  plotId?: number;
  heartInterval?: number;
  location?: string;
  remark?: string;
}

export interface FirmwareVO {
  id?: number;
  firmwareCode?: string;
  firmwareName?: string;
  deviceType?: string;
  version?: string;
  manufacturer?: string;
  filePath?: string;
  fileSize?: string;
  checkSum?: string;
  fileVersion?: number;
  upgradeDesc?: string;
  isForce?: number;
  isActive?: number;
  downloadCount?: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface FirmwarePageDTO {
  pageNum: number;
  pageSize: number;
  firmwareCode?: string;
  firmwareName?: string;
  deviceType?: string;
  isActive?: number;
}

export interface FirmwareSaveDTO {
  firmwareCode?: string;
  firmwareName?: string;
  deviceType?: string;
  version?: string;
  manufacturer?: string;
  filePath?: string;
  fileSize?: string;
  checkSum?: string;
  fileVersion?: number;
  upgradeDesc?: string;
  isForce?: number;
  isActive?: number;
  remark?: string;
}

export interface OtaTaskVO {
  id?: number;
  taskCode?: string;
  taskName?: string;
  firmwareId?: number;
  firmwareName?: string;
  firmwareVersion?: string;
  taskType?: number;
  targetDevices?: string;
  taskStatus?: number;
  totalDevices?: number;
  successDevices?: number;
  failDevices?: number;
  scheduleTime?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
  creator?: string;
}

export interface OtaTaskPageDTO {
  pageNum: number;
  pageSize: number;
  taskCode?: string;
  taskName?: string;
  taskType?: number;
  taskStatus?: number;
}

export interface OtaTaskSaveDTO {
  taskName?: string;
  firmwareId?: number;
  taskType?: number;
  targetDevices?: string;
  scheduleTime?: string;
  remark?: string;
}

export interface PlotVO {
  id?: number;
  plotCode?: string;
  plotName?: string;
  area?: number;
  cropType?: string;
  status?: number;
  location?: string;
  longitude?: number;
  latitude?: number;
  soilType?: string;
  irrigationType?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
  deviceCount?: number;
  onlineDeviceCount?: number;
}

export interface PlotPageDTO {
  pageNum: number;
  pageSize: number;
  plotCode?: string;
  plotName?: string;
  cropType?: string;
  status?: number;
}

export interface PlotSaveDTO {
  plotCode?: string;
  plotName?: string;
  area?: number;
  cropType?: string;
  status?: number;
  location?: string;
  longitude?: number;
  latitude?: number;
  soilType?: string;
  irrigationType?: string;
  remark?: string;
}

export const gatewayApi = {
  page: (params: GatewayPageDTO) => 
    request.post('/api/iot/gateway/page', params).then(res => res.data),
  detail: (id: number) => 
    request.get(`/api/iot/gateway/${id}`).then(res => res.data),
  save: (data: GatewaySaveDTO) => 
    request.post('/api/iot/gateway', data).then(res => res.data),
  update: (id: number, data: GatewaySaveDTO) => 
    request.put(`/api/iot/gateway/${id}`, data).then(res => res.data),
  delete: (id: number) => 
    request.delete(`/api/iot/gateway/${id}`).then(res => res.data),
  heartbeat: (id: number) => 
    request.post(`/api/iot/gateway/${id}/heartbeat`).then(res => res.data),
};

export const firmwareApi = {
  page: (params: FirmwarePageDTO) => 
    request.post('/api/iot/firmware/page', params).then(res => res.data),
  detail: (id: number) => 
    request.get(`/api/iot/firmware/${id}`).then(res => res.data),
  save: (data: FirmwareSaveDTO) => 
    request.post('/api/iot/firmware', data).then(res => res.data),
  update: (id: number, data: FirmwareSaveDTO) => 
    request.put(`/api/iot/firmware/${id}`, data).then(res => res.data),
  delete: (id: number) => 
    request.delete(`/api/iot/firmware/${id}`).then(res => res.data),
  activate: (id: number) => 
    request.post(`/api/iot/firmware/${id}/activate`).then(res => res.data),
};

export const otaApi = {
  page: (params: OtaTaskPageDTO) => 
    request.post('/api/iot/ota/page', params).then(res => res.data),
  detail: (id: number) => 
    request.get(`/api/iot/ota/${id}`).then(res => res.data),
  save: (data: OtaTaskSaveDTO) => 
    request.post('/api/iot/ota', data).then(res => res.data),
  update: (id: number, data: OtaTaskSaveDTO) => 
    request.put(`/api/iot/ota/${id}`, data).then(res => res.data),
  delete: (id: number) => 
    request.delete(`/api/iot/ota/${id}`).then(res => res.data),
  execute: (id: number) => 
    request.post(`/api/iot/ota/${id}/execute`).then(res => res.data),
  cancel: (id: number) => 
    request.post(`/api/iot/ota/${id}/cancel`).then(res => res.data),
};

export const plotApi = {
  page: (params: PlotPageDTO) => 
    request.post('/api/iot/plot/page', params).then(res => res.data),
  list: () => 
    request.get('/api/iot/plot/list').then(res => res.data),
  detail: (id: number) => 
    request.get(`/api/iot/plot/${id}`).then(res => res.data),
  save: (data: PlotSaveDTO) => 
    request.post('/api/iot/plot', data).then(res => res.data),
  update: (id: number, data: PlotSaveDTO) => 
    request.put(`/api/iot/plot/${id}`, data).then(res => res.data),
  delete: (id: number) => 
    request.delete(`/api/iot/plot/${id}`).then(res => res.data),
};
