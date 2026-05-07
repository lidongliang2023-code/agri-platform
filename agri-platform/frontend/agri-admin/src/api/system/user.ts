import request from '@/utils/request';
import { UserVO, UserSaveDTO, UserUpdateDTO, UserPageDTO, LoginVO } from '@/models/system/user';
import { ApiResponse, PageResult } from '@/models/common';

export interface LoginDTO {
  username: string;
  password: string;
  captcha?: string;
  captchaKey?: string;
}

export interface ChangePasswordDTO {
  oldPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (data: LoginDTO): Promise<ApiResponse<LoginVO>> =>
    request.post('/api/auth/login', data),

  logout: (): Promise<ApiResponse<void>> =>
    request.get('/api/auth/logout'),

  check: (): Promise<ApiResponse<void>> =>
    request.get('/api/auth/check'),
};

export const userApi = {
  page: (params: UserPageDTO): Promise<ApiResponse<PageResult<UserVO>>> =>
    request.get('/api/system/user/page', { params }),

  getById: (id: number): Promise<ApiResponse<UserVO>> =>
    request.get(`/api/system/user/${id}`),

  create: (data: UserSaveDTO): Promise<ApiResponse<void>> =>
    request.post('/api/system/user', data),

  update: (id: number, data: UserUpdateDTO): Promise<ApiResponse<void>> =>
    request.put(`/api/system/user/${id}`, data),

  delete: (id: number): Promise<ApiResponse<void>> =>
    request.delete(`/api/system/user/${id}`),

  resetPassword: (id: number): Promise<ApiResponse<void>> =>
    request.put(`/api/system/user/${id}/resetPassword`),

  changePassword: (data: ChangePasswordDTO): Promise<ApiResponse<void>> =>
    request.put('/api/system/user/changePassword', data),

  changeStatus: (id: number, status: number): Promise<ApiResponse<void>> =>
    request.put(`/api/system/user/${id}/status`, { params: { status } }),

  assignRoles: (id: number, roleIds: number[]): Promise<ApiResponse<void>> =>
    request.put(`/api/system/user/${id}/roles`, roleIds),

  getInfo: (): Promise<ApiResponse<UserVO>> =>
    request.get('/api/system/user/info'),
};
