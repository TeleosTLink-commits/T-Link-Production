import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();

  const getAuthState = () => {
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (!token) return { token: null, role: null };

    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      const exp = payload?.exp ? payload.exp * 1000 : 0;

      if (!exp || Date.now() > exp) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        return { token: null, role: null };
      }

      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      return { token, role: parsedUser?.role ?? null };
    } catch (err) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      return { token: null, role: null };
    }
  };

  const { token, role } = getAuthState();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Keep manufacturers inside the manufacturer portal only
  if (role === 'manufacturer' && !location.pathname.startsWith('/manufacturer')) {
    return <Navigate to="/manufacturer/dashboard" replace />;
  }

  // Keep internal users out of manufacturer-only routes
  if (role !== 'manufacturer' && location.pathname.startsWith('/manufacturer')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
