import { PageVO } from '@/models/common';

export interface UserVO {
  id: number;
  username: string;
  realName: string;
  phone: string;
  email: string;
  avatar: string;
  orgId: number;
  orgName: string;
  status: number;
  roleIds: number[];
  roleNames: string[];
  tenantId: string;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  remark: string;
}

export interface UserSaveDTO {
  username: string;
  password: string;
  realName?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  orgId?: number;
  status?: number;
  remark?: string;
}

export interface UserUpdateDTO {
  realName?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  orgId?: number;
  status?: number;
  remark?: string;
}

export interface UserPageDTO extends PageVO {
  username?: string;
  realName?: string;
  phone?: string;
  orgId?: number;
  status?: number;
}

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
