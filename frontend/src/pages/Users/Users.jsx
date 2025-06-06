import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsers } from '../../services/api.js';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import { FaUsers } from "react-icons/fa";
import { FaChevronLeft, FaChevronRight, FaSync, FaSearch } from 'react-icons/fa';
import './Users.css';

const Users = () => {
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState(null);
  
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
    pages: 0
  });

  const segments = [
    { id: null, name: 'All Customers' },
    { id: 'active', name: 'Active Customers' },
    { id: 'high-value', name: 'High-Value (>$75/month)' },
    { id: 'long-term', name: 'Long-Term (>2 years)' },
    { id: 'new', name: 'New (<3 months)' }
  ];

  const loadUsers = useCallback(async (segment = null, page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const data = await getUsers(segment, page, pagination.perPage, searchTerm);
      
      if (data.users) {
        // Update filteredUsers directly
        setFilteredUsers(data.users);
        
        if (data.pagination) {
          setPagination({
            page: data.pagination.page,
            perPage: data.pagination.per_page,
            total: data.pagination.total,
            pages: data.pagination.pages
          });
        }
      } else {
        setError("Failed to load users");
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError("There was an error fetching the user data.");
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [pagination.perPage]);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Still clear search if the query is empty
    if (!query) {
      loadUsers(activeSegment, 1);
    }
  };

  // Add new function to handle search button click
  const handleSearchClick = () => {
    setIsSearching(true);
    loadUsers(activeSegment, 1, searchQuery);
  };

  // Add handleKeyPress for Enter key search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchQuery) {
      handleSearchClick();
    }
  };

  const handleSegmentChange = (segment) => {
    setActiveSegment(segment);
    setSearchQuery('');
    loadUsers(segment, 1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      loadUsers(activeSegment, newPage, searchQuery);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      loadUsers(activeSegment, pagination.page);
    }
  }, [activeSegment, loadUsers, pagination.page, searchQuery]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (loading) {
    return <LoadingSpinner message="Loading customers..." />;
  }

  return (
    <div className="users-container">
      <h1><FaUsers />Customer List</h1>
      
      <div className="segment-selector">
        {segments.map(segment => (
          <button
            key={segment.id || 'all'}
            className={`segment-button ${activeSegment === segment.id ? 'active' : ''}`}
            onClick={() => handleSegmentChange(segment.id)}
          >
            {segment.name}
          </button>
        ))}
      </div>
      
      <div className="customer-count">
        {isSearching ? (
          <span>Searching...</span>
        ) : (
          <span>
            Showing {filteredUsers.length} of {pagination.total} customers
            {activeSegment && ` in ${segments.find(s => s.id === activeSegment).name}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
        <button 
          className="refresh-button" 
          onClick={() => {
            setSearchQuery('');
            loadUsers(activeSegment, 1);
          }}
          title="Refresh data"
        >
          <FaSync />
        </button>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search by Customer ID"
          value={searchQuery}
          onChange={handleSearch}
          onKeyPress={handleKeyPress}
          className="search-bar"
        />
        <button 
          className="search-button"
          onClick={handleSearchClick}
          disabled={!searchQuery}
        >
          <FaSearch /> Search
        </button>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Customer ID</th>
            <th>Gender</th>
            <th>Tenure</th>
            <th>Monthly Charges</th>
            <th>Churn Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <tr key={user.customerID}>
                <td data-label="Customer ID">
                  <Link to={`/customer/${user.customerID}`}>{user.customerID}</Link>
                </td>
                <td data-label="Gender">{user.gender}</td>
                <td data-label="Tenure">{user.tenure} months</td>
                <td data-label="Monthly Charges">${parseFloat(user.MonthlyCharges).toFixed(2)}</td>
                <td data-label="Status" className={user.Churn === 'Yes' ? 'churn-yes' : 'churn-no'}>
                  {user.Churn === 'Yes' ? 'Inactive' : 'Active'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="no-results">No customers found</td>
            </tr>
          )}
        </tbody>
      </table>
      
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
    </div>
  );
};

export default Users;