import request from '@/utils/request';
import { DeviceVO, DeviceSaveDTO, DeviceUpdateDTO, DevicePageDTO } from '@/models/iot/device';
import { ApiResponse, PageResult } from '@/models/common';

export const deviceApi = {
  page: (params: DevicePageDTO): Promise<ApiResponse<PageResult<DeviceVO>>> =>
    request.get('/api/iot/device/page', { params }),

  getById: (id: number): Promise<ApiResponse<DeviceVO>> =>
    request.get(`/api/iot/device/${id}`),

  create: (data: DeviceSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/iot/device', data),

  update: (id: number, data: DeviceUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/iot/device/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/iot/device/${id}`),
};
