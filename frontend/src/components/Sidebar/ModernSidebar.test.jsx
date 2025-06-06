import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from './ModernSidebar';

// Mock the AuthContext
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { username: 'testuser', role: 'admin' },
    logout: vi.fn(),
    hasRole: vi.fn((roles) => roles.includes('admin'))
  }))
}));

// Mock the SidebarContext with a toggleSidebar mock we can access
const toggleSidebarMock = vi.fn();
vi.mock('../../context/SidebarContext', () => ({
  useSidebar: vi.fn(() => ({
    sidebarCollapsed: false,
    toggleSidebar: toggleSidebarMock,
    isMobile: false
  }))
}));

describe('Sidebar', () => {  
  const renderSidebar = () => {
    return render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    );
  };

  it('renders sidebar with navigation links', () => {
    renderSidebar();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Customers/i)).toBeInTheDocument();
    expect(screen.getByText(/Survival Analysis/i)).toBeInTheDocument();
  });

  it('displays user information', () => {
    renderSidebar();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('toggles sidebar collapse state on button click', () => {
    // Reset the mock before test
    toggleSidebarMock.mockReset();
    
    renderSidebar();
    
    const toggleButton = screen.getAllByRole('button')[0];
    fireEvent.click(toggleButton);
    
    // Verify the mock was called
    expect(toggleSidebarMock).toHaveBeenCalled();
  });
});