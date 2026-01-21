import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = localStorage.getItem('auth_token');
  const location = useLocation();
  const storedUser = localStorage.getItem('user');
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const role = parsedUser?.role;
  
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
