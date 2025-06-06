import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCustomer } from '../../services/api.js';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx'; // Re-added this import
import './CustomerAdd.css';
import { FaUserPlus } from 'react-icons/fa';
import { successToast, errorToast } from '../../toast-config.js';
import { formatDateForInput } from '../../utils/dateUtils.js';

const CustomerAdd = () => {
  const navigate = useNavigate();
  
  // Add new validationErrors state
  const [validationErrors, setValidationErrors] = useState({});
  
  const [formData, setFormData] = useState({
    customerID: '',
    gender: 'Male',
    SeniorCitizen: 0,
    Partner: 'No',
    Dependents: 'No',
    // tenure is removed from the form because it will be calculated from joinDate
    joinDate: formatDateForInput(new Date()), // Set current date as default
    PhoneService: 'Yes',
    MultipleLines: 'No',
    InternetService: 'DSL',
    OnlineSecurity: 'No',
    OnlineBackup: 'No',
    DeviceProtection: 'No',
    TechSupport: 'No',
    StreamingTV: 'No',
    StreamingMovies: 'No',
    Contract: 'Month-to-month',
    PaperlessBilling: 'Yes',
    PaymentMethod: 'Electronic check',
    MonthlyCharges: 0,
    TotalCharges: 0,
    Churn: 'No'  // Default is 'No' since new customers haven't churned
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [customerId, setCustomerId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear validation error when field is edited
    setValidationErrors(prev => ({ ...prev, [name]: null }));
    
    // Handle different input types
    if (name === 'MonthlyCharges' || name === 'TotalCharges') {
      // Allow empty string for charges to enable proper editing
      const numValue = value === '' ? '' : parseFloat(value);
      setFormData(prev => ({ ...prev, [name]: numValue }));
    }
    else if (name === 'SeniorCitizen') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) }));
    }
    else {
      // For other fields, just set the value directly
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Add validation function
  const validateForm = () => {
    const errors = {};

    // Validate customer ID
    if (!formData.customerID || formData.customerID.trim() === '') {
      errors.customerID = 'Customer ID is required';
    }

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
    setLoading(true);
    setError(null);
    
    // Validate form before submission
    if (!validateForm()) {
      errorToast('Please correct the errors in the form');
      setLoading(false);
      return;
    }
    
    try {
      const customerData = {
        ...formData,
        // Ensure numeric fields are numbers, not empty strings
        MonthlyCharges: formData.MonthlyCharges === '' ? 0 : formData.MonthlyCharges,
        TotalCharges: formData.TotalCharges === '' ? 0 : formData.TotalCharges,
        // Ensure Churn is set to 'No' for new customers
        Churn: 'No'
      };
      
      const response = await createCustomer(customerData);
      setCustomerId(response.customerID);
      setSuccess(true);
      
      // Updated toast call
      successToast(`Customer ${response.customerID} added successfully!`);
      
      // Redirect to customer details page after 2 seconds with state to trigger refresh
      setTimeout(() => {
        navigate(`/customer/${response.customerID}`, { 
          state: { dataChanged: true } 
        });
      }, 2000);
    } catch (error) {
      console.error('Error creating customer:', error);
      setError('Failed to create customer. Please try again.');
      // Updated toast call
      errorToast('Failed to create customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/users');
  };

  return (
    <div className="customer-add">
      {loading && <LoadingSpinner message="Adding customer..." />}
      
      <h1><FaUserPlus />Add New Customer</h1>
      
      {success && (
        <div className="success-message">
          Customer added successfully! Customer ID: {customerId}
          <br />
          Redirecting to customer details...
        </div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      <form onSubmit={handleSubmit} className="add-form">
        {/* Add Customer ID field at the top with full width */}
        <div className="form-group customer-id-field">
          <label>Customer ID: <span className="required">*</span></label>
          <input
            type="text"
            name="customerID"
            value={formData.customerID}
            onChange={handleChange}
            placeholder="Enter customer ID"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Gender:</label>
          <select name="gender" value={formData.gender} onChange={handleChange}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Senior Citizen:</label>
          <select 
            name="SeniorCitizen" 
            value={formData.SeniorCitizen} 
            onChange={(e) => handleChange({...e, target: {...e.target, value: parseInt(e.target.value)}})}
          >
            <option value={0}>No</option>
            <option value={1}>Yes</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Partner:</label>
          <select name="Partner" value={formData.Partner} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Dependents:</label>
          <select name="Dependents" value={formData.Dependents} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        {/* Replace tenure field with join date field */}
        <div className="form-group">
          <label>Join Date:</label>
          <input
            type="date"
            name="joinDate"
            value={formData.joinDate}
            onChange={handleChange}
            max={formatDateForInput(new Date())}
          />
        </div>
        
        <div className="form-group">
          <label>Phone Service:</label>
          <select name="PhoneService" value={formData.PhoneService} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Multiple Lines:</label>
          <select name="MultipleLines" value={formData.MultipleLines} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No phone service">No phone service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Internet Service:</label>
          <select name="InternetService" value={formData.InternetService} onChange={handleChange}>
            <option value="DSL">DSL</option>
            <option value="Fiber optic">Fiber optic</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Online Security:</label>
          <select name="OnlineSecurity" value={formData.OnlineSecurity} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Online Backup:</label>
          <select name="OnlineBackup" value={formData.OnlineBackup} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Device Protection:</label>
          <select name="DeviceProtection" value={formData.DeviceProtection} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Tech Support:</label>
          <select name="TechSupport" value={formData.TechSupport} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Streaming TV:</label>
          <select name="StreamingTV" value={formData.StreamingTV} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Streaming Movies:</label>
          <select name="StreamingMovies" value={formData.StreamingMovies} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="No internet service">No internet service</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Contract:</label>
          <select name="Contract" value={formData.Contract} onChange={handleChange}>
            <option value="Month-to-month">Month-to-month</option>
            <option value="One year">One year</option>
            <option value="Two year">Two year</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Paperless Billing:</label>
          <select name="PaperlessBilling" value={formData.PaperlessBilling} onChange={handleChange}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Payment Method:</label>
          <select name="PaymentMethod" value={formData.PaymentMethod} onChange={handleChange}>
            <option value="Electronic check">Electronic check</option>
            <option value="Mailed check">Mailed check</option>
            <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
            <option value="Credit card (automatic)">Credit card (automatic)</option>
          </select>
        </div>
        
        {/* Update MonthlyCharges field with validation error display */}
        <div className="form-group">
          <label>Monthly Charges:</label>
          <input
            type="number"
            name="MonthlyCharges"
            value={formData.MonthlyCharges}
            onChange={handleChange}
            step="0.01"
            min="0"
          />
          {validationErrors.MonthlyCharges && (
            <div className="validation-error">{validationErrors.MonthlyCharges}</div>
          )}
        </div>
        
        {/* Update TotalCharges field with validation error display */}
        <div className="form-group">
          <label>Total Charges:</label>
          <input
            type="number"
            name="TotalCharges"
            value={formData.TotalCharges}
            onChange={handleChange}
            step="0.01"
            min="0"
          />
          {validationErrors.TotalCharges && (
            <div className="validation-error">{validationErrors.TotalCharges}</div>
          )}
        </div>
        
        <div className="form-buttons">
          <button type="button" className="cancel-button" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" className="save-button" disabled={loading}>
            {loading ? 'Adding...' : 'Add Customer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerAdd;
