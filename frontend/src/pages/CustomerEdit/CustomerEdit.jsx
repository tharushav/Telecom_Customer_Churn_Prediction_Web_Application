import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserDetails, updateCustomerDetails } from '../../services/api.js';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import './CustomerEdit.css';
import { successToast, errorToast } from '../../toast-config.js';
import { calculateTenureMonths, formatDateForInput } from '../../utils/dateUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { FaLock, FaUserEdit, FaExclamationTriangle } from 'react-icons/fa';

const CustomerEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [joinDate, setJoinDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showCorsError, setShowCorsError] = useState(false);
  const [validationErrors, setValidationErrors] = useState({}); 
  const { hasRole } = useAuth();

  useEffect(() => {
    if (!hasRole(['admin', 'editor'])) {
      setShowUnauthorizedModal(true);
      setLoading(false);
      return;
    }

    if (!id) {
      setError('No customer ID provided');
      setLoading(false);
      return;
    }

    // Fetch user details with retry logic
    const fetchUserData = async () => {
      try {
        const data = await getUserDetails(id);
        if (data.user) {
          setFormData(data.user);
          if (data.user.joinDate) {
            setJoinDate(formatDateForInput(data.user.joinDate));
          }
          setLoading(false);
        } else {
          throw new Error('User not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        
        // Check if it's a CORS error
        if (error.message && error.message.includes('Unable to connect to the server')) {
          if (retryCount < 3) {
            // Retry after a delay
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, 1000 * (retryCount + 1)); // Increase delay with each retry
          } else {
            setShowCorsError(true);
            setLoading(false);
            setError('Unable to connect to the server. There may be a CORS issue or the server might be down.');
          }
        } else {
          setLoading(false);
          setError('There was an error fetching the user data.');
        }
      }
    };
    
    fetchUserData();
  }, [id, hasRole, retryCount]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear validation error when field is edited
    setValidationErrors(prev => ({ ...prev, [name]: null }));
    
    if (name === 'joinDate') {
      setJoinDate(value);
      // When join date changes, update tenure too
      const calculatedTenure = calculateTenureMonths(value);
      setFormData(prevFormData => ({
        ...prevFormData,
        tenure: calculatedTenure
      }));
    } else if (name === 'SeniorCitizen') {
      setFormData(prevFormData => ({
        ...prevFormData,
        [name]: parseInt(value, 10)
      }));
    } else if (name === 'MonthlyCharges' || name === 'TotalCharges') {
      // Handle numeric values
      if (value === '') {
        setFormData(prevFormData => ({
          ...prevFormData,
          [name]: value
        }));
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          setFormData(prevFormData => ({
            ...prevFormData,
            [name]: numValue // Store as number, not string
          }));
        } else {
          // Invalid number input
          setValidationErrors(prev => ({
            ...prev, 
            [name]: 'Please enter a valid number'
          }));
        }
      }
    } else {
      setFormData(prevFormData => ({
        ...prevFormData,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    // Validate MonthlyCharges
    if (formData.MonthlyCharges === '' || formData.MonthlyCharges === undefined) {
      errors.MonthlyCharges = 'Monthly charges is required';
    } else if (isNaN(parseFloat(formData.MonthlyCharges))) {
      errors.MonthlyCharges = 'Please enter a valid number';
    }

    // Validate TotalCharges
    if (formData.TotalCharges === '' || formData.TotalCharges === undefined) {
      errors.TotalCharges = 'Total charges is required';
    } else if (isNaN(parseFloat(formData.TotalCharges))) {
      errors.TotalCharges = 'Please enter a valid number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0; // Return true if no errors
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasRole(['admin', 'editor'])) {
      setShowUnauthorizedModal(true);
      return;
    }
    
    // Validate form before submission
    if (!validateForm()) {
      errorToast('Please correct the errors in the form');
      return;
    }

    setLoading(true);
    try {
      // Ensure numeric fields are properly parsed as numbers
      const dataToSubmit = { 
        ...formData,
        joinDate: joinDate,
        MonthlyCharges: parseFloat(formData.MonthlyCharges),
        TotalCharges: parseFloat(formData.TotalCharges)
      };
      
      await updateCustomerDetails(id, dataToSubmit);
      setSuccess(true);
      
      successToast(`Customer ${id} updated successfully!`);
      
      // Navigate back to customer details with updated data in state
      navigate(`/customer/${id}`, { 
        state: { 
          dataChanged: true,
          // Pass the updated customer data to avoid additional fetch
          userData: {
            user: dataToSubmit,
            churn_probability: formData.churn_probability || 0
          }
        } 
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      setLoading(false);
      setError('There was an error updating the customer.');
      
      errorToast('Failed to update customer. Please try again.');
    }
  };

  const handleCancel = () => {
    navigate(`/customer/${id}`);
  };

  const handleCloseUnauthorizedModal = () => {
    navigate(`/customer/${id}`);
  };

  const handleRetryConnection = () => {
    setShowCorsError(false);
    setLoading(true);
    setRetryCount(0);
    setError(null);
  };

  if (loading) {
    return <LoadingSpinner message={`Loading customer data... ${retryCount > 0 ? `(Attempt ${retryCount + 1})` : ''}`} />;
  }

  if (showCorsError) {
    return (
      <div className="error-container">
        <div className="error-icon">
          <FaExclamationTriangle />
        </div>
        <h2>Connection Error</h2>
        <p>Unable to connect to the server due to CORS policy restrictions or server unavailability.</p>
        <div className="error-actions">
          <button className="retry-button" onClick={handleRetryConnection}>
            Try Again
          </button>
          <button className="cancel-button" onClick={handleCancel}>
            Back to Customer Details
          </button>
        </div>
      </div>
    );
  }

  if (error && !showCorsError) {
    return <div className="error-message">{error}</div>;
  }

  if (showUnauthorizedModal) {
    return (
      <div className="unauthorized-modal-overlay">
        <div className="unauthorized-modal">
          <div className="unauthorized-icon-container">
            <FaLock className="unauthorized-warning-icon" />
          </div>
          <h3>Access Denied</h3>
          <p>You don't have permission to edit customer records.</p>
          <p className="warning-text">This action requires admin or editor privileges.</p>
          
          <div className="unauthorized-buttons">
            <button 
              className="close-unauthorized-button"
              onClick={handleCloseUnauthorizedModal}
            >
              Back to Customer Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-edit">
      <h1><FaUserEdit /> Edit Customer Details</h1>
      
      {success && (
        <div className="success-message">
          Customer details updated successfully!
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="edit-form">
        <div className="form-group customer-id-field">
          <label>Customer ID:</label>
          <input type="text" value={id} disabled />
        </div>
        
        <div className="form-group">
          <label>Gender:</label>
          <select name="gender" value={formData.gender || ''} onChange={handleChange}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Senior Citizen:</label>
          <select 
            name="SeniorCitizen" 
            value={formData.SeniorCitizen !== undefined ? formData.SeniorCitizen.toString() : ''} 
            onChange={handleChange}
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Partner:</label>
          <select name="Partner" value={formData.Partner || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Dependents:</label>
          <select name="Dependents" value={formData.Dependents || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Phone Service:</label>
          <select name="PhoneService" value={formData.PhoneService || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Multiple Lines:</label>
          <select name="MultipleLines" value={formData.MultipleLines || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No phone service">No phone service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Internet Service:</label>
          <select name="InternetService" value={formData.InternetService || ''} onChange={handleChange}>
            <option value="DSL">DSL</option>
            <option value="Fiber optic">Fiber optic</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Online Security:</label>
          <select name="OnlineSecurity" value={formData.OnlineSecurity || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Online Backup:</label>
          <select name="OnlineBackup" value={formData.OnlineBackup || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service
            </option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Device Protection:</label>
          <select name="DeviceProtection" value={formData.DeviceProtection || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Tech Support:</label>
          <select name="TechSupport" value={formData.TechSupport || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Streaming TV:</label>
          <select name="StreamingTV" value={formData.StreamingTV || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Streaming Movies:</label>
          <select name="StreamingMovies" value={formData.StreamingMovies || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Contract:</label>
          <select name="Contract" value={formData.Contract || ''} onChange={handleChange}>
            <option value="Month-to-month">Month-to-month</option>
            <option value="One year">One year</option>
            <option value="Two year">Two year</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Paperless Billing:</label>
          <select name="PaperlessBilling" value={formData.PaperlessBilling || ''} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Payment Method:</label>
          <select name="PaymentMethod" value={formData.PaymentMethod || ''} onChange={handleChange}>
            <option value="Electronic check">Electronic check</option>
            <option value="Mailed check">Mailed check</option>
            <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
            <option value="Credit card (automatic)">Credit card (automatic)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Monthly Charges ($):</label>
          <input
            type="number"
            name="MonthlyCharges"
            value={formData.MonthlyCharges || ''}
            onChange={handleChange}
            step="0.01"
            min="0"
            placeholder="0.00"
          />
          {validationErrors.MonthlyCharges && (
            <div className="validation-error">{validationErrors.MonthlyCharges}</div>
          )}
        </div>
        
        <div className="form-group">
          <label>Total Charges ($):</label>
          <input
            type="number"
            name="TotalCharges"
            value={formData.TotalCharges || ''}
            onChange={handleChange}
            step="0.01"
            min="0"
            placeholder="0.00"
          />
          {validationErrors.TotalCharges && (
            <div className="validation-error">{validationErrors.TotalCharges}</div>
          )}
        </div>
        
        {/* show join date field and calculated tenure */}
        <div className="form-group">
          <label>Join Date:</label>
          <input
            type="date"
            name="joinDate"
            value={joinDate}
            onChange={handleChange}
            max={formatDateForInput(new Date())}
          />
          <small className="field-note">Calculated Tenure: {formData.tenure || 0} months</small>
        </div>
        
        <div className="form-group">
          <label>Customer Status:</label>
          <select name="Churn" value={formData.Churn || ''} onChange={handleChange}>
            <option value="No">Active</option>
            <option value="Yes">Inactive</option>
          </select>
        </div>
        
        <div className="form-buttons">
          <button type="button" className="cancel-button" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="save-button"
            disabled={Object.keys(validationErrors).some(key => validationErrors[key])}
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerEdit;
