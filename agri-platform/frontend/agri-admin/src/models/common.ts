export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  pages: number;
}

export interface PageVO {
  pageNum: number;
  pageSize: number;
  orderBy?: string;
  sortOrder?: string;
}
