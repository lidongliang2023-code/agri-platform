import request from '@/utils/request';
import { RoleVO, RoleSaveDTO, RoleUpdateDTO, RolePageDTO } from '@/models/system/role';
import { ApiResponse, PageResult } from '@/models/common';

export const roleApi = {
  page: (params: RolePageDTO): Promise<ApiResponse<PageResult<RoleVO>>> =>
    request.get('/api/system/role/page', { params }),

  getById: (id: number): Promise<ApiResponse<RoleVO>> =>
    request.get(`/api/system/role/${id}`),

  create: (data: RoleSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/system/role', data),

  update: (id: number, data: RoleUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/system/role/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/system/role/${id}`),

  changeStatus: (id: number, status: number): Promise<ApiResponse<void>> =>
    request.put(`/api/system/role/${id}/status`, { params: { status } }),

  getMenus: (id: number): Promise<ApiResponse<number[]>> =>
    request.get(`/api/system/role/${id}/menus`),

  assignMenus: (id: number, menuIds: number[]): Promise<ApiResponse<void>> =>
    request.put(`/api/system/role/${id}/menus`, menuIds),

  list: (): Promise<ApiResponse<RoleVO[]>> =>
    request.get('/api/system/role/list'),
};
