// Used for date maniplulation and formatting

/**
 * Calculates the approximate join date based on tenure months
 * This function is primarily used as a fallback when join_date is not available
 * @param {number} tenureMonths - Number of months the customer has been with the company
 * @returns {Date} Calculated join date
 */
export const calculateJoinDate = (tenureMonths) => {
  const currentDate = new Date();
  // Create a new date by subtracting tenure months from current date
  const joinDate = new Date(currentDate);
  joinDate.setMonth(currentDate.getMonth() - tenureMonths);
  return joinDate;
};

/**
 * Calculate number of months between join date and current date
 * @param {string} joinDateStr - Join date string in YYYY-MM-DD format
 * @returns {number} Number of months since join date
 */
export const calculateTenureMonths = (joinDateStr) => {
  if (!joinDateStr) return 0;
  
  const joinDate = new Date(joinDateStr);
  const now = new Date();
  
  // Calculate difference in months
  const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + 
                 (now.getMonth() - joinDate.getMonth());
  
  return Math.max(0, months);
};

/**
 * Format a Date object to YYYY-MM-DD format for input fields
 * @param {Date|string} date - Date object or string to format
 * @returns {string} Formatted date string in YYYY-MM-DD format
 */
export const formatDateForInput = (date) => {
  // Ensure we're working with a Date object
  const dateObj = (date instanceof Date) ? date : new Date(date);
  
  // Extract year, month, and day
  const year = dateObj.getFullYear();
  // getMonth() returns 0-11, so add 1 for 1-12 and pad with leading zero if needed
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  // Pad day with leading zero if needed
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  // Return formatted date string
  return `${year}-${month}-${day}`;
};

/**
 * Format a Date object to a human readable format
 * @param {Date|string} date - Date object or string to format
 * @returns {string} Formatted date string (e.g., "June 15, 2023")
 */
export const formatDateForDisplay = (date) => {
  // Ensure we're working with a Date object
  const dateObj = (date instanceof Date) ? date : new Date(date);
  
  // Format the date using Intl.DateTimeFormat for formatting
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Provides join date from stored value or calculates it from tenure as fallback
 * @param {Object} customer - Customer object from API 
 * @returns {string} Join date string in YYYY-MM-DD format
 */
export const getJoinDate = (customer) => {
  // First try to use the stored join_date
  if (customer.join_date) {
    return customer.join_date;
  }
  // Then try joinDate
  if (customer.joinDate) {
    return customer.joinDate;
  }
  // Fall back to calculating from tenure
  if (customer.tenure) {
    const joinDate = calculateJoinDate(customer.tenure);
    return formatDateForInput(joinDate);
  }
  // If no data available
  return null;
};
