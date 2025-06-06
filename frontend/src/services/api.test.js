import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getUsers, getAnalytics, clearCache } from './api';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
  
  // Return object with default export
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
    create: vi.fn(() => mockAxiosInstance),
    defaults: { headers: { common: {} } }
  };
});

describe('API Services', () => {
  const mockAxiosGet = axios.create().get;
  
  beforeEach(() => {
    // Clear mocks and cache before each test
    vi.resetAllMocks();
    clearCache();
  });

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  describe('getUsers', () => {
    it('fetches users successfully', async () => {
      const mockUsers = { users: [{ id: 1, name: 'Test User' }], total: 1 };
      mockAxiosGet.mockResolvedValueOnce({ data: mockUsers });

      const result = await getUsers();
      
      expect(mockAxiosGet).toHaveBeenCalledWith('/users', { params: { page: 1, per_page: 50 } });
      expect(result).toEqual(mockUsers);
    });

    it('uses cache for repeated calls', async () => {
      const mockUsers = { users: [{ id: 1, name: 'Test User' }], total: 1 };
      mockAxiosGet.mockResolvedValueOnce({ data: mockUsers });

      // First call should use axios
      await getUsers();
      // Second call should use cache
      await getUsers();
      
      // Axios should only be called once
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalytics', () => {
    it('fetches analytics data', async () => {
      const mockAnalytics = { churn_rate: 0.15 };
      mockAxiosGet.mockResolvedValueOnce({ data: mockAnalytics });

      const result = await getAnalytics();
      
      expect(mockAxiosGet).toHaveBeenCalledWith('/analytics', { params: {} });
      expect(result).toEqual(mockAnalytics);
    });
  });
});
