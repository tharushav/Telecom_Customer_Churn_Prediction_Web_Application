import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
// This is a custom hook for managing authentication state of the application

// Create context
const AuthContext = createContext(null);

// Hook for using the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // Memoize the logout function with useCallback
  const handleLogout = useCallback(() => {
    // Clear token from local storage and state
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    
    // Remove auth header
    delete api.defaults.headers.common['Authorization'];
    
    // Redirect to login page
    navigate('/login');
  }, [navigate]);
  
  useEffect(() => {
    const verifyToken = async () => {
      setIsLoading(true);
      
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Set authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Verify token with backend
        const response = await api.get('/auth/verify-token');
        
        if (response.data && response.data.valid) {
          setUser(response.data.user);
        } else {
          // Invalid token
          handleLogout();
        }
      } catch (error) {
        console.error('Token verification failed', error);
        // Clear invalid token
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyToken();
  }, [token, handleLogout]);
  
  // Login function with improved error handling
  const login = async (username, password) => {
    setError(null);
    try {
      const response = await api.post('/auth/login', 
        { username, password },
        { 
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          withCredentials: false
        }
      );
      
      if (response.data && response.data.token) {
        // Set token in local storage and state
        localStorage.setItem('authToken', response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        
        // Set default auth header
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        
        return true;
      }
      return false;
    } catch (error) {
      
      
      // Special handling for network/CORS errors
      if (error.isConnectionError) {
        setError('Connection error: Unable to reach the server. Please check your internet connection.');
        return false;
      }
      
      // More detailed error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        
        setError(error.response.data?.error || 'Login failed. Please check your credentials.');
      } else if (error.request) {
        // The request was made but no response was received
        
        setError('Network error: Cannot connect to the server. Please check your internet connection.');
      } else {
        // Something happened in setting up the request
        
        setError('Login failed. Please try again.');
      }
      
      return false;
    }
  };
  
  // Check if user has a specific role
  const hasRole = (roles) => {
    if (!user) return false;
    
    // If roles is string, convert to array
    const roleArray = Array.isArray(roles) ? roles : [roles];
    
    return roleArray.includes(user.role);
  };
  
  // Context value
  const contextValue = {
    user,
    token,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    logout: handleLogout,
    hasRole
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
