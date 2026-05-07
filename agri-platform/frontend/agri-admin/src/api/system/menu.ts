import request from '@/utils/request';
import { MenuVO, MenuSaveDTO, MenuUpdateDTO } from '@/models/system/menu';
import { ApiResponse } from '@/models/common';

export const menuApi = {
  getTree: (): Promise<ApiResponse<MenuVO[]>> =>
    request.get('/api/system/menu/tree'),

  getPermissions: (): Promise<ApiResponse<string[]>> =>
    request.get('/api/system/menu/perms'),

  create: (data: MenuSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/system/menu', data),

  update: (id: number, data: MenuUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/system/menu/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/system/menu/${id}`),
};
