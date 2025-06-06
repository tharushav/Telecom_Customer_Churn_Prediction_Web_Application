import React from 'react';
import { Link } from 'react-router-dom';
import { FaExclamationTriangle, FaHome } from 'react-icons/fa';
import './Unauthorized.css';

const Unauthorized = () => {
  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <FaExclamationTriangle className="unauthorized-icon" />
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <Link to="/" className="home-button">
          <FaHome /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
