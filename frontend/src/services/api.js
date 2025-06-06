import axios from 'axios';
// Serves as the central communication layer between frontend and backend
// Central service for all API calls (handles API requests, authenitcation, caching, and error handling)

// Get the base API URL from environment variables or use default
const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Standard API instance with 10s timeout
const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create a new instance with a longer timeout for resource intensive operations
const longRunningApi = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000, // 60 seconds timeout for analytics and other heavy operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token to outgoing requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Also add the same interceptor to the long running API instance
longRunningApi.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// error handling for both API instances
const handleApiError = (error) => {
  // error logging for network issues
  if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
    console.error('Network error - possible CORS issue:', error);
    
    // Create a more user friendly error object with helpful information
    const enhancedError = new Error('Unable to connect to the server. Please verify the backend is running.');
    enhancedError.originalError = error;
    enhancedError.isConnectionError = true;
    return Promise.reject(enhancedError);
  }
  
  if (error.response && error.response.status === 401) {
    // Only log 401 errors that aren't from the verify token endpoint
    if (!error.config.url.includes('verify-token')) {
      console.warn('Authentication error - token may be invalid or expired');
    }
    
    // If the request isn't a login or token verification request, we might want to redirect to login or refresh the token
    if (!error.config.url.includes('login') && !error.config.url.includes('verify-token')) {
      // Check if we need to redirect/refresh token
    }
  }
  
  return Promise.reject(error);
};

// Apply the enhanced error handler to both API instances
api.interceptors.response.use(response => response, handleApiError);
longRunningApi.interceptors.response.use(response => response, handleApiError);

// Enhanced cache management
const apiCache = {
  data: {},
  
  // Get cached data with optional expiration check
  get: (key, maxAgeMs = 600000) => { // Default 10 min cache validity
    const cached = apiCache.data[key];
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > maxAgeMs) {
      delete apiCache.data[key];
      return null;
    }
    
    return cached.data;
  },
  
  // Add has method to check if a key exists in the cache
  has: (key, maxAgeMs = 600000) => {
    const cached = apiCache.data[key];
    if (!cached) return false;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > maxAgeMs) {
      delete apiCache.data[key];
      return false;
    }
    
    return true;
  },
  
  // Set data in cache
  set: (key, data) => {
    apiCache.data[key] = {
      data,
      timestamp: Date.now()
    };
    return data;
  },
  
  // Clear specific cache entry or all cache
  clear: (key = null) => {
    if (key === null) {
      apiCache.data = {};
    } else {
      delete apiCache.data[key];
    }
  }
};

// API functions for users/customers (Customer data management)
export const getUsers = async (segment = null, page = 1, perPage = 50, search = '', forceRefresh = false, year = null) => {
  const cacheKey = `users_${segment || 'all'}_${page}_${perPage}_${search}_${year || 'all'}`;
  
  // If forcing refresh, clear the cache for this key first
  if (forceRefresh) {
    apiCache.clear(cacheKey);
  }
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh) {
    const cached = apiCache.get(cacheKey, 300000); // 5 minute cache
    if (cached) return cached;
  }
  
  try {
    const params = { page };
    
    // Handle special case for 'all'
    if (perPage === 'all') {
      params.per_page = 'all';
    } else {
      params.per_page = perPage;
    }
    
    if (segment) {
      params.segment = segment;
    }
    
    if (search) {
      params.search = search;
    }
    
    // Add year parameter if provided
    if (year) {
      params.year = year;
    }
    
    // Add cache busting parameter for forced refreshes
    if (forceRefresh) {
      params._t = Date.now();
    }
    
    // Use longRunningApi for 'all' data which might be larger
    const apiClient = perPage === 'all' ? longRunningApi : api;
    
    // Implement retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        const response = await apiClient.get('/users', { params });
        // Cache successful response
        return apiCache.set(cacheKey, response.data);
      } catch (error) {
        lastError = error;
        attempts++;
        
        // Only retry on timeout or network errors
        if (error.code === 'ECONNABORTED' || !error.response) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError; // All retries failed
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Get specific user details
export const getUserDetails = async (id, forceRefresh = false) => {
  const cacheKey = `user-${id}`;
  
  const cached = forceRefresh ? null : apiCache.get(cacheKey, 300000); // 5 minute cache for user details
  if (cached) return cached;
  
  try {
    const response = await api.get(`/customer/${id}`);
    return apiCache.set(cacheKey, response.data);
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    throw error;
  }
};

// Api function for create a new customer
export const createCustomer = async (customerData) => {
  try {
    const response = await api.post('/customer', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

// Api function for update customer details
export const updateCustomerDetails = async (id, customerData) => {
  try {
    const response = await api.put(`/customer/${id}`, customerData);
    return response.data;
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    throw error;
  }
};

// Api function for delete a customer
export const deleteCustomer = async (id) => {
  try {
    const response = await api.delete(`/customer/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting customer ${id}:`, error);
    throw error;
  }
};

// API function for analytics with retry and caching
export const getAnalytics = async (year = null, forceRefresh = false) => {
  try {
    const cacheKey = `analytics${year ? `-${year}` : ''}`;
    
    // Check if we have cached data and forceRefresh is false
    if (!forceRefresh && apiCache.has(cacheKey)) {
      return apiCache.get(cacheKey);
    }
    
    // Build params object
    const params = {};
    if (year) {
      params.year = year;
    }
    
    // Use longRunningApi instead of regular api for analytics requests
    const response = await longRunningApi.get('/analytics', { params });
    
    // Cache the result
    apiCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw error;
  }
};

// Improved survival analysis API functions with caching
export const getSurvivalCurves = async (forceRefresh = false) => {
  const cacheKey = 'survival_curves';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh) {
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;
  }
  
  try {
    // Implement retry with timeout adjustment
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        // Increase timeout for subsequent attempts
        const timeout = 60000 + (attempts * 30000); // 60s, then 90s
        const customApi = axios.create({
          baseURL: apiBaseURL,
          timeout: timeout,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        const response = await customApi.get('/survival-curve');
        return apiCache.set(cacheKey, response.data);
      } catch (error) {
        attempts++;
        if (error.code === 'ECONNABORTED' && attempts < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error fetching survival curves:', error);
    throw error;
  }
};

export const getRiskFactors = async (forceRefresh = false) => {
  const cacheKey = 'risk_factors';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh) {
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;
  }
  
  try {
    const response = await longRunningApi.get('/risk-factors');
    return apiCache.set(cacheKey, response.data);
  } catch (error) {
    console.error('Error fetching risk factors:', error);
    throw error;
  }
};

// Fumction to predict customer survival
export const predictCustomerSurvival = async (customerData) => {
  try {
    const response = await longRunningApi.post('/survival-prediction', customerData);
    return response.data;
  } catch (error) {
    console.error('Error predicting customer survival:', error);
    throw error;
  }
};

// Function to clear cache when data changes
export const clearCache = (key = null) => {
  apiCache.clear(key);
};

// Export the cache for component access
export { apiCache };

// Historical Analytics API function
export const getHistoricalAnalytics = async (startDate, endDate, page = 1, perPage = 10) => {
  try {
    const params = { page, per_page: perPage };
    
    // Add date filters
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await api.get('/historical-analytics', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching historical analytics:', error);
    throw error;
  }
};

// Function to download historical analytics as CSV file
export const downloadHistoricalAnalyticsCSV = async (startDate, endDate) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    // Get the base URL from the API instance
    const baseURL = api.defaults.baseURL || '';
    
    // Construct the full URL
    const url = `${baseURL}/historical-analytics/csv?${params.toString()}`;
    
    // Create a hidden anchor element to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `churn_analytics_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error downloading CSV:', error);
    throw error;
  }
};

export default api;