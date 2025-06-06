import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home';
import { getAnalytics, getUsers } from '../../services/api';

// Mock the Chart.js components
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
  Pie: () => <div data-testid="mock-pie-chart">Pie Chart</div>,
  Doughnut: () => <div data-testid="mock-doughnut-chart">Doughnut Chart</div>,
  PolarArea: () => <div data-testid="mock-polar-chart">Polar Area Chart</div>,
  Radar: () => <div data-testid="mock-radar-chart">Radar Chart</div>,
}));

// Mock the API service
vi.mock('../../services/api', () => ({
  getAnalytics: vi.fn(),
  getUsers: vi.fn(),
  clearCache: vi.fn()
}));

// Mock the authentication context with necessary properties
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    hasRole: () => true,
    user: { username: 'testuser', role: 'admin' }
  }))
}));

describe('Home Component', () => {
  beforeEach(() => {
    // Setup default mock responses
    getAnalytics.mockResolvedValue({
      total_customers: 100,
      total_revenue: '10000.00',
      monthly_revenue: '1000.00',
      churn_distribution: {
        churned: 25,
        notChurned: 75
      },
      churn_by_contract: {
        'Month-to-month': 40,
        'One year': 15,
        'Two year': 5
      },
      churn_by_payment_method: {
        'Electronic check': 45,
        'Mailed check': 20,
        'Bank transfer (automatic)': 10,
        'Credit card (automatic)': 8
      },
      churn_by_tenure_group: {
        '0-12 months': 35,
        '12-24 months': 20,
        '24-36 months': 15,
        '36-48 months': 10,
        '48+ months': 5
      }
    });
    
    getUsers.mockResolvedValue({
      users: [
        { CustomerID: '1234', gender: 'Female', tenure: 24, MonthlyCharges: 65.3, Churn: 'No' },
        { CustomerID: '5678', gender: 'Male', tenure: 12, MonthlyCharges: 85.2, Churn: 'Yes' }
      ],
      total: 2
    });
  });

  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    // Update to match the actual text displayed in the loading spinner
    expect(screen.getByText(/Fetching analytics data/i)).toBeInTheDocument();
  });

  it('renders dashboard content after data loads', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.queryByText(/Fetching analytics data/i)).not.toBeInTheDocument();
    });
    
    // Check if key dashboard elements are present
    await waitFor(() => {
      expect(screen.getByText(/Customer Churn Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Customers/i)).toBeInTheDocument();
      expect(screen.getByText(/Monthly Revenue/i)).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.queryByText(/Fetching analytics data/i)).not.toBeInTheDocument();
    });
    
    // Find and click the refresh button
    const refreshButton = screen.getByText(/Refresh/i);
    fireEvent.click(refreshButton);
    
    // Verify that getAnalytics was called with forceRefresh=true
    expect(getAnalytics).toHaveBeenCalledWith(null, true);
  });
});
