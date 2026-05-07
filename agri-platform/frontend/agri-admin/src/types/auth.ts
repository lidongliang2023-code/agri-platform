export interface LoginVO {
  token: string;
  expireTime: number;
  tokenType: string;
  userInfo: UserInfo;
}

export interface UserInfo {
  userId: number;
  username: string;
  nickname: string;
  avatar?: string;
  tenantId?: string;
  permissions?: string[];
  roles?: string[];
}

export interface LoginDTO {
  username: string;
  password: string;
  captcha?: string;
  captchaKey?: string;
}

export interface PageVO {
  pageNum: number;
  pageSize: number;
  orderBy?: string;
  sortOrder?: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  pages: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
