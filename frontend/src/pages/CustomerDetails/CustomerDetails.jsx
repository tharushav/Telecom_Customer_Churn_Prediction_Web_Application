import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getUserDetails, deleteCustomer } from '../../services/api.js';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import './CustomerDetails.css';
import { formatDateForDisplay } from '../../utils/dateUtils.js';
import { successToast, errorToast } from '../../toast-config.js';
import { FaArrowLeft, FaExclamationTriangle, FaLock } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext.jsx';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [userDetails, setUserDetails] = useState(null);
  const [churnProbability, setChurnProbability] = useState(null);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [unauthorizedAction, setUnauthorizedAction] = useState('');
  const { hasRole } = useAuth();

  // Function to determine customer segments
  const getCustomerSegments = (details) => {
    if (!details) return [];
    
    const segments = [];
    
    // Ensure values are numeric
    const monthlyCharges = parseFloat(details.MonthlyCharges);
    const tenure = parseInt(details.tenure);
    
    // Check for high-value segment
    if (monthlyCharges > 75) {
      segments.push('high-value');
    }
    
    // Check for long-term segment
    if (tenure > 24) {
      segments.push('long-term');
    }
    
    // Check for new customer segment
    if (tenure < 3) {
      segments.push('new');
    }
    
    // Add a mid-term segment for customers with tenure between 3 and 24 months and total charges <= 75
    if (tenure >= 3 && tenure <= 24 && monthlyCharges <= 75) {
      segments.push('mid-term');
    }
    
    return segments;
  };

  useEffect(() => {
    if (!id) {
      setError('No customer ID provided');
      return;
    }
    
    // If coming back from edit page, force a refresh without using cache
    const forceRefresh = location.state?.dataChanged === true;
    
    getUserDetails(id, forceRefresh)
      .then((data) => {
        if (data.user) {
          setUserDetails(data.user);
          setChurnProbability(data.churn_probability);
        } else {
          setError('User not found');
        }
      })
      .catch((error) => {
        console.error('Error fetching user data:', error);
        setError('There was an error fetching the user data.');
      });
  }, [id, location.state?.dataChanged]);

  // Change the handler function name and navigation destination
  const handleBackToCustomers = () => {
    const shouldRefresh = location.state?.dataChanged === true;
    navigate('/users', { state: { refreshData: shouldRefresh } });
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (!userDetails) {
    return <LoadingSpinner message="Loading customer details..." />;
  }

  // Determine the churn probability class based on the value
  const churnClass = churnProbability < 30 ? 'low' : churnProbability < 70 ? 'medium' : 'high';
  
  // Get risk label based on churn probability
  const getRiskLabel = () => {
    if (churnProbability < 30) return 'Low Risk';
    if (churnProbability < 70) return 'Medium Risk';
    return 'High Risk';
  };

  // Get customer segments
  const customerSegments = getCustomerSegments(userDetails);

  // Navigate to the edit page with role check
  const handleEditClick = () => {
    if (hasRole(['admin', 'editor'])) {
      navigate(`/customer/${id}/edit`);
    } else {
      setUnauthorizedAction('edit');
      setShowUnauthorizedModal(true);
    }
  };

  // Show confirmation modal with role check
  const handleDeleteClick = () => {
    if (hasRole(['admin'])) {
      setShowConfirmation(true);
    } else {
      setUnauthorizedAction('delete');
      setShowUnauthorizedModal(true);
    }
  };

  // Close unauthorized modal
  const handleCloseUnauthorizedModal = () => {
    setShowUnauthorizedModal(false);
  };

  // Cancel deletion
  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  // Confirm deletion
  const handleConfirmDelete = async () => {
    if (!hasRole(['admin'])) {
      setUnauthorizedAction('delete');
      setShowUnauthorizedModal(true);
      setShowConfirmation(false);
      return;
    }
    
    try {
      await deleteCustomer(id);
      
      // Show success toast notification
      successToast(`Customer ${id} deleted successfully!`);
      
      navigate('/users'); // Redirect to users list after successful deletion
    } catch (error) {
      console.error('Error deleting customer:', error);
      setError('There was an error deleting the customer.');
      setShowConfirmation(false);
      
      // Show error toast notification
      errorToast('Failed to delete customer. Please try again.');
    }
  };

  return (
    <div className="customer-details">
      {/* Update the onClick handler and button text */}
      <button className="back-button" onClick={handleBackToCustomers}>
      <FaArrowLeft style={{marginRight: '8px'}} /> Back to Customers
      </button>
      
      <div className={`churn-probability ${churnClass}`}>
        <div className="churn-label">Churn Probability</div>
        <div className="churn-value">
          {churnProbability !== null ? `${churnProbability.toFixed(1)}%` : 'N/A'}
        </div>
        <div className="progress-container">
          <div 
            className="progress-bar" 
            style={{ '--progress-width': `${churnProbability}%` }}
          ></div>
        </div>
        <div className="risk-label">
          {getRiskLabel()}
        </div>
      </div>
      <div className="customer-header">
        <h1>Customer Details</h1>
        
        {/* Display segment badges if customer belongs to any segment */}
        {customerSegments.length > 0 && (
          <div className="segment-badges">
            {customerSegments.includes('high-value') && (
              <span className="segment-badge high-value">High-Value</span>
            )}
            {customerSegments.includes('long-term') && (
              <span className="segment-badge long-term">Long-Term</span>
            )}
            {customerSegments.includes('new') && (
              <span className="segment-badge new">New Customer</span>
            )}
            {customerSegments.includes('mid-term') && (
              <span className="segment-badge mid-term">Mid-Term Customer</span>
            )}
          </div>
        )}
        
        {/* Restore the styled churn status display */}
        <div className={`churn-status ${userDetails.Churn === 'Yes' ? 'churned' : 'active'}`}>
          Status: {userDetails.Churn === 'Yes' ? 'Inactive' : 'Active'}
        </div>
      </div>
      
      {/* Optional debugging section */}
      <div className="debug-info" style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
        Monthly Charges: ${parseFloat(userDetails.MonthlyCharges).toFixed(2)} | 
        Tenure: {userDetails.tenure} months
      </div>
      
      <div className="details-grid">
        <p><strong>Customer ID:</strong> {id}</p>
        <p><strong>Gender:</strong> {userDetails.gender}</p>
        <p><strong>Senior Citizen:</strong> {userDetails.SeniorCitizen === 1 || userDetails.SeniorCitizen === '1' ? 'Yes' : 'No'}</p>
        <p><strong>Partner:</strong> {userDetails.Partner}</p>
        <p><strong>Dependents:</strong> {userDetails.Dependents}</p>
        <p><strong>Tenure:</strong> {userDetails.tenure}</p>
        <p><strong>Join Date:</strong> {userDetails.joinDate ? formatDateForDisplay(userDetails.joinDate) : 'N/A'}</p>
        <p><strong>Phone Service:</strong> {userDetails.PhoneService}</p>
        <p><strong>Multiple Lines:</strong> {userDetails.MultipleLines}</p>
        <p><strong>Internet Service:</strong> {userDetails.InternetService}</p>
        <p><strong>Online Security:</strong> {userDetails.OnlineSecurity}</p>
        <p><strong>Online Backup:</strong> {userDetails.OnlineBackup}</p>
        <p><strong>Device Protection:</strong> {userDetails.DeviceProtection}</p>
        <p><strong>Tech Support:</strong> {userDetails.TechSupport}</p>
        <p><strong>Streaming TV:</strong> {userDetails.StreamingTV}</p>
        <p><strong>Streaming Movies:</strong> {userDetails.StreamingMovies}</p>
        <p><strong>Contract:</strong> {userDetails.Contract}</p>
        <p><strong>Paperless Billing:</strong> {userDetails.PaperlessBilling}</p>
        <p><strong>Payment Method:</strong> {userDetails.PaymentMethod}</p>
        <p><strong>Monthly Charges:</strong> {userDetails.MonthlyCharges}</p>
        <p><strong>Total Charges:</strong> {userDetails.TotalCharges}</p>
        <p className={`churn-field ${userDetails.Churn === 'Yes' ? 'churned' : 'active'}`}>
          <strong>Churn Status:</strong> {userDetails.Churn === 'Yes' ? 'Inactive' : 'Active'}
        </p>
      </div>
      
      {/* Only render buttons based on role permissions */}
      <div className="edit-button-container">
        {/* Edit button for admin and editor roles */}
        {hasRole(['admin', 'editor']) && (
          <button className="edit-button" onClick={handleEditClick}>Edit Customer</button>
        )}
        
        {/* Delete button only for admin role */}
        {hasRole(['admin']) && (
          <button className="delete-button" onClick={handleDeleteClick}>Delete Customer</button>
        )}
      </div>
      
      {/* Enhanced Delete Confirmation Modal */}
      {showConfirmation && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-modal">
            <div className="delete-icon-container">
              <FaExclamationTriangle className="delete-warning-icon" />
            </div>
            <h3>Delete Customer</h3>
            <p>Are you sure you want to delete the customer <span className="highlight-username">{id}</span>?</p>
            <p className="warning-text">This action cannot be undone and will permanently remove the customer record.</p>
            
            <div className="delete-confirmation-buttons">
              <button 
                className="cancel-delete-button"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-button"
                onClick={handleConfirmDelete}
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unauthorized Action Modal */}
      {showUnauthorizedModal && (
        <div className="unauthorized-modal-overlay">
          <div className="unauthorized-modal">
            <div className="unauthorized-icon-container">
              <FaLock className="unauthorized-warning-icon" />
            </div>
            <h3>Access Denied</h3>
            <p>You don't have permission to {unauthorizedAction} customer records.</p>
            <p className="warning-text">This action requires higher privileges.</p>
            
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

export default CustomerDetails;