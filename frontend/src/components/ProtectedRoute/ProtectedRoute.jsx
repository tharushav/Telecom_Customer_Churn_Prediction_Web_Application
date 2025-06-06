import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner.jsx';
// This component is used to protect routes that require authentication and authorization

const ProtectedRoute = ({ allowedRoles }) => {
  const auth = useAuth();
  
  // If auth context is not available, show loading
  if (!auth) {
    return <LoadingSpinner message="Initializing auth..." fullscreen={true} />;
  }
  
  const { isAuthenticated, isLoading, user } = auth;
  
  // Show fullscreen loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." fullscreen={true} />;
  }
  
  // If not authenticated, redirect to login (Authentication check)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // check if user has allowed role (Role based authorization)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      // Redirect to unauthorized page or dashboard
      return <Navigate to="/unauthorized" replace />;
    }
  }
  
  // If authenticated and authorized, show the route
  return <Outlet />;
};

export default ProtectedRoute;
