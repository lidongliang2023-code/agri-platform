import request from '@/utils/request';
import { LoginDTO, LoginVO, ApiResponse } from '@/types/auth';

export const authApi = {
  login: async (data: LoginDTO): Promise<ApiResponse<LoginVO>> => {
    return request.post('/api/auth/login', data);
  },

  logout: async (): Promise<ApiResponse<void>> => {
    return request.post('/api/auth/logout');
  },

  refreshToken: async (): Promise<ApiResponse<LoginVO>> => {
    return request.post('/api/auth/refresh');
  },
};
