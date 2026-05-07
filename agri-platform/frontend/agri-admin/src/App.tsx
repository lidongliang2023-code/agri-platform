import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import Router from '@/router';

const App: React.FC = () => {
  const { token, checkAuth } = useAuthStore();

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, [token, checkAuth]);

  return <Router />;
};

export default App;
