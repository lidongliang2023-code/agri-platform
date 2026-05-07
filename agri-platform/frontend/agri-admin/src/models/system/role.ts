import { PageVO } from '@/models/common';

export interface RoleVO {
  id: number;
  roleCode: string;
  roleName: string;
  roleKey: string;
  roleSort: number;
  dataScope: number;
  dataScopeName: string;
  status: number;
  menuIds: number[];
  tenantId: string;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  remark: string;
}

export interface RoleSaveDTO {
  roleCode: string;
  roleName: string;
  roleKey: string;
  roleSort?: number;
  dataScope?: number;
  status?: number;
  remark?: string;
}

export interface RoleUpdateDTO {
  roleName?: string;
  roleKey?: string;
  roleSort?: number;
  dataScope?: number;
  status?: number;
  remark?: string;
}

export interface RolePageDTO extends PageVO {
  roleName?: string;
  roleKey?: string;
  status?: number;
}
