import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default message', () => {
    render(<LoadingSpinner />);
    // Check for any text in the loading message that would appear by default
    expect(screen.getByText(/loading/i, { exact: false })).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Custom loading message" />);
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('displays progress when provided', () => {
    render(<LoadingSpinner progress={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
