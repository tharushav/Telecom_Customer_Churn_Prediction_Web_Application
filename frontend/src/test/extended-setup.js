import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
// This is the custom setup file for Vitest which is used to configure the testing environment

// Extend global async handling to deal with React act() warnings
window.originalFetch = window.fetch;
window.fetch = async (...args) => {
  const result = await act(async () => {
    return window.originalFetch(...args);
  });
  return result;
};

// Clean up after each test to prevent state leaks
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver which isn't available in jsdom
window.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Filter specific console errors that come from third party libraries
const originalConsoleError = console.error;
console.error = (...args) => {
  // Ignore specific act() warnings
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('inside a test was not wrapped in act') ||
       args[0].includes('React state updates should be wrapped'))) {
    return;
  }
  originalConsoleError(...args);
};
