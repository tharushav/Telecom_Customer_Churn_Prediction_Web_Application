import React, { useState, useEffect } from 'react';
import { FaHistory, FaCalendarAlt, FaDownload, FaSearch, FaChevronLeft, FaChevronRight, FaLock } from 'react-icons/fa';
import { getHistoricalAnalytics, downloadHistoricalAnalyticsCSV } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './HistoricalAnalytics.css';
import { successToast, errorToast } from '../../toast-config';
import { useAuth } from '../../context/AuthContext.jsx';

const HistoricalAnalytics = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('churn');

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90); // Extend to 90 days to ensure we catch historical data by default
    
    setEndDate(formatDateForInput(end));
    setStartDate(formatDateForInput(start));
  }, []);

  // Helper to format dates for input element
  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Load historical data
  const loadHistoricalData = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getHistoricalAnalytics(startDate, endDate, page);
      setHistoricalData(response.records);
      setPagination({
        page: response.page,
        pages: response.pages,
        total: response.total
      });
    } catch {
      setError('Failed to load historical analytics data. Please try again.');
      errorToast('Error loading historical data');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (startDate && endDate) {
      loadHistoricalData();
    }
  }, [startDate, endDate]);

  // Handle date filter changes
  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'startDate') {
      setStartDate(value);
    } else if (name === 'endDate') {
      setEndDate(value);
    }
  };

  // Apply date filters
  const applyDateFilters = () => {
    setIsFiltering(true);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    loadHistoricalData(1);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    loadHistoricalData(newPage);
  };

  // Download CSV data
  const handleDownloadCSV = async () => {
    // Check if user has permission to download
    if (!hasRole(['admin', 'editor'])) {
      setShowUnauthorizedModal(true);
      return;
    }
    
    setIsDownloading(true);
    try {
      await downloadHistoricalAnalyticsCSV(startDate, endDate);
      successToast('CSV file downloaded successfully');
    } catch {
      errorToast('Failed to download CSV file');
    } finally {
      setIsDownloading(false);
    }
  };

  // Close unauthorized modal
  const handleCloseUnauthorizedModal = () => {
    setShowUnauthorizedModal(false);
  };

  // Helper to extract and format metrics for display
  const formatMetric = (record, metricPath) => {
    try {
      const parts = metricPath.split('.');
      let value = record.data;
      
      // Protection against null or undefined data object
      if (!value) return 'N/A';
      
      for (const part of parts) {
        value = value[part];
        // Early return if we encounter undefined at any level
        if (value === undefined) return 'N/A';
      }
      
      // Format as percentage with 1 decimal place for churn metrics
      if (metricPath.includes('churn_') || (typeof value === 'number' && metricPath.includes('churned'))) {
        return typeof value === 'number' ? `${value.toFixed(1)}%` : 'N/A';
      } 
      // Format as currency for revenue
      else if (metricPath.includes('revenue')) {
        return typeof value === 'number' ? `$${value.toFixed(2)}` : 'N/A';
      }
      // Return as is for counts
      else {
        return value !== undefined ? value : 'N/A';
      }
    } catch {
      return 'N/A';
    }
  };

  // Render churn metrics table
  const renderChurnTable = () => (
    <table className="historical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Churn Rate</th>
          <th>Month-to-Month Churn</th>
          <th>One Year Churn</th>
          <th>Two Year Churn</th>
          <th>Electronic Check Churn</th>
          <th>Mailed Check Churn</th>
          <th>Bank Transfer Churn</th>
          <th>Credit Card Churn</th>
        </tr>
      </thead>
      <tbody>
        {historicalData.length > 0 ? (
          historicalData.map(record => (
            <tr key={`churn-${record._id}`}>
              <td data-label="Date">{record.date} {record.time}</td>
              <td data-label="Churn Rate">{formatMetric(record, 'churn_distribution.churned')}</td>
              <td data-label="Month-to-Month Churn">{formatMetric(record, 'churn_by_contract.Month-to-month')}</td>
              <td data-label="One Year Churn">{formatMetric(record, 'churn_by_contract.One year')}</td>
              <td data-label="Two Year Churn">{formatMetric(record, 'churn_by_contract.Two year')}</td>
              <td data-label="Electronic Check Churn">{formatMetric(record, 'churn_by_payment_method.Electronic check')}</td>
              <td data-label="Mailed Check Churn">{formatMetric(record, 'churn_by_payment_method.Mailed check')}</td>
              <td data-label="Bank Transfer Churn">{formatMetric(record, 'churn_by_payment_method.Bank transfer (automatic)')}</td>
              <td data-label="Credit Card Churn">{formatMetric(record, 'churn_by_payment_method.Credit card (automatic)')}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="9" className="no-results">
              No historical data found for the selected date range
            </td>
          </tr>
        )}
        {isFiltering && (
          <tr>
            <td colSpan="9" className="loading-row">Loading...</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  // Render customer segments table
  const renderCustomerTable = () => (
    <table className="historical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Total Customers</th>
          <th>High Value</th>
          <th>Long Term</th>
          <th>New</th>
          <th>Mid Term</th>
        </tr>
      </thead>
      <tbody>
        {historicalData.length > 0 ? (
          historicalData.map(record => (
            <tr key={`customer-${record._id}`}>
              <td data-label="Date">{record.date} {record.time}</td>
              <td data-label="Total Customers">{formatMetric(record, 'customer_counts.total')}</td>
              <td data-label="High Value">{formatMetric(record, 'customer_counts.segments.high_value')}</td>
              <td data-label="Long Term">{formatMetric(record, 'customer_counts.segments.long_term')}</td>
              <td data-label="New">{formatMetric(record, 'customer_counts.segments.new')}</td>
              <td data-label="Mid Term">{formatMetric(record, 'customer_counts.segments.mid_term')}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="6" className="no-results">
              No historical data found for the selected date range
            </td>
          </tr>
        )}
        {isFiltering && (
          <tr>
            <td colSpan="6" className="loading-row">Loading...</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  // Render revenue table
  const renderRevenueTable = () => (
    <table className="historical-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Monthly Revenue</th>
          <th>Total Revenue</th>
          <th>Avg. Revenue Per Customer</th>
        </tr>
      </thead>
      <tbody>
        {historicalData.length > 0 ? (
          historicalData.map(record => {
            // Calculate average revenue per customer
            const totalCustomers = formatMetric(record, 'customer_counts.total');
            const monthlyRevenue = parseFloat(formatMetric(record, 'revenue.monthly').replace('$', ''));
            const avgRevenuePerCustomer = !isNaN(monthlyRevenue) && totalCustomers !== 'N/A' 
              ? `$${(monthlyRevenue / totalCustomers).toFixed(2)}`
              : 'N/A';
              
            return (
              <tr key={`revenue-${record._id}`}>
                <td data-label="Date">{record.date} {record.time}</td>
                <td data-label="Monthly Revenue">{formatMetric(record, 'revenue.monthly')}</td>
                <td data-label="Total Revenue">{formatMetric(record, 'revenue.total')}</td>
                <td data-label="Avg. Revenue Per Customer">{avgRevenuePerCustomer}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan="4" className="no-results">
              No historical data found for the selected date range
            </td>
          </tr>
        )}
        {isFiltering && (
          <tr>
            <td colSpan="4" className="loading-row">Loading...</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  if (loading && !isFiltering) {
    return <LoadingSpinner message="Loading historical analytics..." />;
  }

  return (
    <div className="historical-analytics-container">
      <div className="historical-header">
        <h1><FaHistory /> Historical Analytics</h1>
        <div className="date-filter-controls">
          <div className="date-inputs">
            <div className="date-input-group">
              <label><FaCalendarAlt /> From:</label>
              <input 
                type="date" 
                name="startDate"
                value={startDate}
                onChange={handleDateFilterChange}
              />
            </div>
            <div className="date-input-group">
              <label><FaCalendarAlt /> To:</label>
              <input 
                type="date" 
                name="endDate"
                value={endDate}
                onChange={handleDateFilterChange}
              />
            </div>
          </div>
          <div className="filter-buttons">
            <button 
              className="apply-filter-button" 
              onClick={applyDateFilters}
              disabled={isFiltering}
            >
              <FaSearch /> {isFiltering ? 'Filtering...' : 'Apply Filter'}
            </button>
            <button 
              className="download-csv-button" 
              onClick={handleDownloadCSV}
              disabled={isDownloading || historicalData.length === 0 || !hasRole(['admin', 'editor'])}
              title={!hasRole(['admin', 'editor']) ? "You need admin or editor privileges to download data" : ""}
            >
              {hasRole(['admin', 'editor']) ? <FaDownload /> : <FaLock />} {isDownloading ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tab navigation */}
      <div className="analytics-tabs">
        <button 
          className={`tab-button ${activeTab === 'churn' ? 'active' : ''}`}
          onClick={() => setActiveTab('churn')}
        >
          Churn Metrics
        </button>
        <button 
          className={`tab-button ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customer Segments
        </button>
        <button 
          className={`tab-button ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          Revenue
        </button>
      </div>

      <div className="table-container">
        {activeTab === 'churn' && renderChurnTable()}
        {activeTab === 'customers' && renderCustomerTable()}
        {activeTab === 'revenue' && renderRevenueTable()}
      </div>

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="pagination-controls">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="pagination-button"
          >
            <FaChevronLeft /> Previous
          </button>
          
          <div className="pagination-info">
            Page {pagination.page} of {pagination.pages} 
            <span className="total-records"> ({pagination.total} records)</span>
          </div>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className="pagination-button"
          >
            Next <FaChevronRight />
          </button>
        </div>
      )}

      <div className="historical-description">
        <h3>About Historical Analytics</h3>
        <p>
          This page displays historical snapshots of the dashboard analytics data, 
          captured daily at midnight. Each record provides a point-in-time view of
          key metrics, enabling trend analysis over time.
        </p>
        <p>
          Use the date filters to narrow down the time range and the download button
          to export the data as a CSV file for further analysis in spreadsheet software.
        </p>
      </div>

      {/* Unauthorized Modal */}
      {showUnauthorizedModal && (
        <div className="unauthorized-modal-overlay">
          <div className="unauthorized-modal">
            <div className="unauthorized-icon-container">
              <FaLock className="unauthorized-warning-icon" />
            </div>
            <h3>Access Denied</h3>
            <p>You don't have permission to download analytics data.</p>
            <p className="warning-text">This action requires admin or editor privileges.</p>
            
            <div className="unauthorized-buttons">
              <button 
                className="close-unauthorized-button"
                onClick={handleCloseUnauthorizedModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalAnalytics;
