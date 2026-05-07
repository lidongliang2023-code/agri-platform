export interface MenuVO {
  id: number;
  menuName: string;
  parentId: number;
  orderNum: number;
  path: string;
  component: string;
  menuType: string;
  menuTypeName: string;
  visible: number;
  status: number;
  perms: string;
  icon: string;
  children?: MenuVO[];
  tenantId: string;
  createBy: string;
  createTime: string;
  remark: string;
}

export interface MenuSaveDTO {
  menuName: string;
  parentId?: number;
  orderNum?: number;
  path?: string;
  component?: string;
  menuType?: string;
  visible?: number;
  perms?: string;
  icon?: string;
  status?: number;
}

export interface MenuUpdateDTO {
  menuName?: string;
  parentId?: number;
  orderNum?: number;
  path?: string;
  component?: string;
  menuType?: string;
  visible?: number;
  perms?: string;
  icon?: string;
  status?: number;
}
