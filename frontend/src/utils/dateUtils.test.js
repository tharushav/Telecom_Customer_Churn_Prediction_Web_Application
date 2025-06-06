import { describe, it, expect } from 'vitest';
import { formatDateForInput, formatDateForDisplay } from './dateUtils';

// A test suite for dste utility function
describe('Date Utils', () => {
  describe('formatDateForInput', () => {
    it('formats date object to YYYY-MM-DD format', () => {
      const testDate = new Date(2023, 5, 15); // June 15, 2023
      expect(formatDateForInput(testDate)).toBe('2023-06-15');
    });

    it('handles single digit month and day properly', () => {
      const testDate = new Date(2023, 0, 5); // January 5, 2023
      expect(formatDateForInput(testDate)).toBe('2023-01-05');
    });

    it('handles string dates', () => {
      const dateString = '2023-07-20';
      expect(formatDateForInput(new Date(dateString))).toBe('2023-07-20');
    });
  });

  describe('formatDateForDisplay', () => {
    it('formats date to readable format', () => {
      const testDate = new Date(2023, 5, 15); // June 15, 2023
      const formatted = formatDateForDisplay(testDate);
      expect(formatted).toContain('June');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2023');
    });

    it('handles string date input', () => {
      const dateString = '2023-07-20';
      const formatted = formatDateForDisplay(dateString);
      expect(formatted).toContain('July');
      expect(formatted).toContain('20');
      expect(formatted).toContain('2023');
    });
  });
});
