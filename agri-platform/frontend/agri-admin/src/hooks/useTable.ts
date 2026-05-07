import { useState, useCallback } from 'react';
import { message } from 'antd';
import { PageResult, ApiResponse } from '@/models/common';

interface UseTableOptions<T, P> {
  fetchData: (params: P) => Promise<ApiResponse<PageResult<T>>>;
  initialParams?: P;
}

export const useTable = <T, P>(options: UseTableOptions<T, P>) => {
  const { fetchData, initialParams } = options;
  const [data, setData] = useState<PageResult<T>>({
    list: [],
    total: 0,
    pageNum: 1,
    pageSize: 10,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<P>(initialParams as P);

  const fetch = useCallback(async (newParams?: P) => {
    setLoading(true);
    try {
      const currentParams = newParams || params;
      setParams(currentParams as P);
      const response = await fetchData(currentParams as P);
      if (response.code === 200) {
        setData(response.data);
      } else {
        message.error(response.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [fetchData, params]);

  const refresh = useCallback(() => {
    fetch();
  }, [fetch]);

  const changePage = useCallback((pageNum: number, pageSize: number) => {
    if (params && typeof params === 'object') {
      const newParams = { ...params, pageNum, pageSize };
      fetch(newParams as P);
    }
  }, [fetch, params]);

  return {
    data,
    loading,
    params,
    setParams,
    fetch,
    refresh,
    changePage,
  };
};
