import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ message = "Loading...", progress = null, fullscreen = false }) => {
  // Convert progress to percentage string for display
  const progressText = progress !== null ? `${Math.round(progress)}%` : null;
  
  return (
    <div className={`loading-container ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="spinner-wrapper">
        <div className="spinner"></div>
        {progress !== null && (
          <div className="progress-percentage">{progressText}</div>
        )}
      </div>
      
      {message && (
        <div className="loading-message">
          {message}
        </div>
      )}
      
      {progress !== null && (
        <div 
          className="progress-bar-container"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Loading progress"
        >
          <div 
            className="progress-bar" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
