import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '@/store/auth';
import { message } from 'antd';
import { ApiResponse } from '@/types/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class HttpClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        const { code, message: msg } = response.data;

        if (code === 200) {
          return response.data as any;
        }

        if (code === 401) {
          useAuthStore.getState().logout();
          message.error(msg || '登录已过期，请重新登录');
          window.location.href = '/login';
          return Promise.reject(new Error(msg));
        }

        if (code === 403) {
          message.error(msg || '没有访问权限');
          return Promise.reject(new Error(msg));
        }

        message.error(msg || '请求失败');
        return Promise.reject(new Error(msg));
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;

          switch (status) {
            case 401:
              useAuthStore.getState().logout();
              message.error('登录已过期，请重新登录');
              window.location.href = '/login';
              break;
            case 403:
              message.error('没有访问权限');
              break;
            case 404:
              message.error('请求的资源不存在');
              break;
            case 500:
              message.error('服务器异常');
              break;
            default:
              message.error(data?.message || '请求失败');
          }
        } else {
          message.error('网络异常，请检查网络连接');
        }

        return Promise.reject(error);
      }
    );
  }

  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, config);
  }

  public post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, data, config);
  }

  public put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.put(url, data, config);
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.delete(url, config);
  }

  public patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.patch(url, data, config);
  }
}

export const httpClient = new HttpClient();
export default httpClient;
