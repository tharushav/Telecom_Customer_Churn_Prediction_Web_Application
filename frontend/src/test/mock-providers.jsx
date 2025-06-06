import React from 'react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { render, fireEvent, screen, waitFor, within, act, cleanup } from '@testing-library/react';
// Provides a mock implementation of the AuthContext for teting purposes

// Mock Auth Context
export const MockAuthContext = React.createContext({
  user: null,
  login: () => {},
  logout: () => {},
  hasRole: () => false,
  isLoading: false,
  error: null
});

export const MockAuthProvider = ({ user = null, hasRole = () => false, children }) => {
  const mockValue = {
    user,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole,
    isLoading: false,
    error: null
  };

  return (
    <MockAuthContext.Provider value={mockValue}>
      {children}
    </MockAuthContext.Provider>
  );
};

// Full app provider wrapper for component testing
export const TestProviders = ({ user, children }) => {
  return (
    <MockAuthProvider user={user} hasRole={() => true}>
      <BrowserRouter>
        {children}
        <ToastContainer />
      </BrowserRouter>
    </MockAuthProvider>
  );
};

// Simple provider function
export function renderWithProviders(ui, options = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <BrowserRouter>
        {children}
        <ToastContainer />
      </BrowserRouter>
    ),
    ...options,
  });
}

// Helper function for rendering with all providers (including auth)
export function renderWithAllProviders(ui, { user = { username: 'testuser', role: 'admin' }, ...options } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders user={user}>
        {children}
      </TestProviders>
    ),
    ...options,
  });
}

// Reexport testing library functions
export { 
  fireEvent, 
  screen, 
  waitFor, 
  act,
  within,
  cleanup
};

export { renderWithProviders as render };
