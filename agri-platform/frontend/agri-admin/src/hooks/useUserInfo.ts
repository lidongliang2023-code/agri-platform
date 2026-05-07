import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { userApi } from '@/api/system/user';

export const useUserInfo = () => {
  const { userInfo, setUserInfo } = useAuthStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);
      try {
        const response = await userApi.getInfo();
        setUserInfo(response.data);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [setUserInfo]);

  return { userInfo, loading };
};
