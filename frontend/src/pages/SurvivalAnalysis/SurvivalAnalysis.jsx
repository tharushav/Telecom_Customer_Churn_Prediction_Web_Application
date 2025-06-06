import React, { useEffect, useState, useCallback } from 'react';
import { getSurvivalCurves, getRiskFactors} from '../../services/api.js';
import { Line } from 'react-chartjs-2';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import { FaChartLine, FaInfoCircle, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import './SurvivalAnalysis.css';

// Import Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler
} from 'chart.js';

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

const SurvivalAnalysis = () => {
  const [survivalCurves, setSurvivalCurves] = useState(null);
  const [riskFactors, setRiskFactors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading survival analysis...');
  const [retries, setRetries] = useState(0);
  // Add missing state variables
  const [selectedSegment, setSelectedSegment] = useState('overall');
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(false);
  
  const maxRetries = 2;

  // Fix the dependency issue by using useRef for retries
  const retriesRef = React.useRef(retries);
  // Update the ref whenever retries changes
  useEffect(() => {
    retriesRef.current = retries;
  }, [retries]);

  // Memoize the data loading function to prevent unnecessary recreation
  const loadSurvivalData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadingMessage("Preparing survival analysis...");
    setLoadingProgress(10);
    
    // Use separate promises to catch individual failures
    const fetchSurvivalCurves = getSurvivalCurves(forceRefresh)
      .then(response => {
        setSurvivalCurves(response.curves);
        setLoadingProgress(prev => prev + 40);
        return response;
      })
      .catch(err => {
        console.error('Error fetching survival curves:', err);
        setLoadingProgress(prev => prev + 20);
        return Promise.reject(err);
      });
    
    const fetchRiskFactors = getRiskFactors(forceRefresh)
      .then(response => {
        setRiskFactors(response);
        setLoadingProgress(prev => prev + 40);
        return response;
      })
      .catch(err => {
        console.error('Error fetching risk factors:', err);
        setLoadingProgress(prev => prev + 20);
        return Promise.reject(err);
      });
    
    // Update loading message to show progress
    setLoadingProgress(20);
    setLoadingMessage("Loading survival curves and risk factors...");
    
    // Try to load the data even if one request fails
    Promise.allSettled([fetchSurvivalCurves, fetchRiskFactors])
      .then(results => {
        const anySuccess = results.some(result => result.status === 'fulfilled');
        
        if (!anySuccess) {
          // All requests failed, try again or show error
          if (retriesRef.current < maxRetries) {
            setRetries(prev => prev + 1);
            setLoadingMessage(`Retrying (${retriesRef.current + 1}/${maxRetries})...`);
            setTimeout(() => loadSurvivalData(true), 2000); // Wait 2 seconds before retrying
            return;
          }
          
          // When max retries reached, show error
          setError('Failed to load survival analysis data. The survival analysis calculations may be too intensive for the current server configuration. Please try again later.');
        }
        
        setLoading(false);
      });
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadSurvivalData();
  }, [loadSurvivalData]);

  // Memoize the refresh handler to prevent unnecessary rerenders
  const handleRefresh = useCallback(() => {
    setRetries(0);
    setLoadingProgress(0);
    loadSurvivalData(true);
  }, [loadSurvivalData]);

  // Map internal segment names to display names
  const segmentLabels = {
    'overall': 'All Customers',
    'Contract_Monthly': 'Month-to-Month Contract',
    'Contract_OneYear': 'One Year Contract',
    'Contract_TwoYear': 'Two Year Contract',
    'InternetService_DSL': 'DSL Internet',
    'InternetService_Fiber': 'Fiber Optic Internet',
    'InternetService_No': 'No Internet Service'
  };

  // Available segments for dropdown
  const availableSegments = survivalCurves ? Object.keys(survivalCurves).map(key => ({
    id: key,
    name: segmentLabels[key] || key
  })) : [];

  // Generate chart data for selected curve
  const getChartData = () => {
    if (!survivalCurves || !survivalCurves[selectedSegment]) {
      return null;
    }

    const selectedCurve = survivalCurves[selectedSegment];
    
    // Ensure all required data points exist
    if (!selectedCurve.timeline || !selectedCurve.survival_prob) {
      return null;
    }
    
    const datasets = [
      {
        label: 'Survival Probability',
        data: selectedCurve.survival_prob,
        borderColor: '#4cc9f0',
        backgroundColor: 'rgba(76, 201, 240, 0.1)',
        fill: true,
        tension: 0.1,
        borderWidth: 3,
        pointRadius: 2,
        pointBackgroundColor: '#4cc9f0'
      }
    ];

    // Add confidence intervals
    if (showConfidenceIntervals && 
        selectedCurve.lower_bound && 
        selectedCurve.upper_bound) {
      datasets.push(
        {
          label: 'Upper Bound',
          data: selectedCurve.upper_bound,
          borderColor: 'rgba(76, 201, 240, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0.1
        },
        {
          label: 'Lower Bound',
          data: selectedCurve.lower_bound,
          borderColor: 'rgba(76, 201, 240, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(76, 201, 240, 0.05)',
          tension: 0.1
        }
      );
    }

    return {
      labels: selectedCurve.timeline,
      datasets: datasets
    };
  };

  // Chart options for survival curves
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          filter: (item) => item.text === 'Survival Probability'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label === 'Survival Probability') {
              return `${label}: ${(value * 100).toFixed(1)}%`;
            }
            return `${label}: ${(value * 100).toFixed(1)}%`;
          },
          title: function(context) {
            return `Month ${context[0].label}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Months'
        },
        grid: {
          display: false
        }
      },
      y: {
        min: 0,
        max: 1,
        title: {
          display: true,
          text: 'Survival Probability'
        },
        ticks: {
          callback: function(value) {
            return `${(value * 100).toFixed(0)}%`;
          }
        }
      }
    }
  };

  // Handle segment selection
  const handleSegmentChange = useCallback((event) => {
    setSelectedSegment(event.target.value);
  }, []);

  // Create hazard ratio chart data
  const getHazardRatioData = () => {
    if (!riskFactors || !riskFactors.risk_factors) {
      return [];
    }
    
    // Sort factors by hazard ratio to highlight most important factors
    return riskFactors.risk_factors
      .sort((a, b) => b.hazard_ratio - a.hazard_ratio)
      .map(factor => ({
        name: factor.feature.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
        hazardRatio: parseFloat(factor.hazard_ratio).toFixed(2),
        isSignificant: factor.is_significant,
        coefficient: factor.coefficient,
        pValue: factor.p_value,
        lowerCI: factor.lower_ci,
        upperCI: factor.upper_ci
      }));
  };

  // Custom tooltip for hazard ratio chart
  const HazardRatioTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) {
      return null;
    }
    
    const data = payload[0].payload;
    
    return (
      <div className="hazard-tooltip">
        <p className="tooltip-label">{data.name}</p>
        <p className="tooltip-value">Hazard Ratio: {data.hazardRatio}</p>
        <p className="tooltip-ci">95% CI: [{data.lowerCI.toFixed(2)}, {data.upperCI.toFixed(2)}]</p>
        <p className="tooltip-value">p-value: {data.pValue < 0.001 ? '< 0.001' : data.pValue.toFixed(3)}</p>
        <p className="tooltip-impact">
          {data.hazardRatio > 1 
            ? `${Math.round((data.hazardRatio - 1) * 100)}% higher risk of churn` 
            : `${Math.round((1 - data.hazardRatio) * 100)}% lower risk of churn`}
        </p>
      </div>
    );
  };

  // Add a function to determine chart margins based on screen width
  const getChartMargins = () => {
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    
    return isMobile 
      ? { top: 20, right: 20, left: 10, bottom: 5 }
      : { top: 20, right: 30, left: 120, bottom: 5 };
  };

  // Customer lifetime prediction component
  const CustomerLifetimePrediction = () => {
    const [prediction, setPrediction] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [predictionError, setPredictionError] = useState(null);
    const [formData, setFormData] = useState({
      contract: 'Month-to-month',
      monthlyCharges: 65,
      internetService: 'Fiber optic'
    });
    
    // Use direct calculation approach if worker isn't working
    const calculatePrediction = (data) => {
      
      // Simple calculation logic - similar to worker but in main thread
      const basePrediction = {
        'Month-to-month': 14,
        'One year': 32,
        'Two year': 60
      }[data.contract] || 14;
      
      // Adjust for monthly charges
      let adjustedTenure = basePrediction;
      const monthlyCharges = parseFloat(data.monthlyCharges);
      
      if (monthlyCharges > 100) {
        adjustedTenure *= 0.9;
      } else if (monthlyCharges > 70) {
        adjustedTenure *= 0.95;
      } else if (monthlyCharges < 35) {
        adjustedTenure *= 1.1;
      }
      
      // Calculate churn probabilities
      let sixMonthChurnProb = 0.25;
      let oneYearChurnProb = 0.5;
      
      if (data.contract === 'One year') {
        sixMonthChurnProb = 0.1;
        oneYearChurnProb = 0.2;
      } else if (data.contract === 'Two year') {
        sixMonthChurnProb = 0.05;
        oneYearChurnProb = 0.12;
      }
      
      const lifetimeValue = Math.round(adjustedTenure * monthlyCharges);
      
      return {
        medianSurvival: Math.round(adjustedTenure),
        lifetimeValue: lifetimeValue,
        churnRisk: {
          sixMonth: sixMonthChurnProb,
          oneYear: oneYearChurnProb
        }
      };
    };
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      setCalculating(true);
      setPredictionError(null);
      
      // Direct calculation approach - no worker
      try {
        const result = calculatePrediction(formData);
        setTimeout(() => {
          setPrediction(result);
          setCalculating(false);
        }, 500);
      } catch (error) {
        setPredictionError(error.message || "Failed to calculate prediction");
        setCalculating(false);
      }
    };
    
    return (
      <div className="lifetime-prediction-container">
        <form onSubmit={handleSubmit} className="prediction-inputs">
          <div className="input-group">
            <label>Contract Type</label>
            <select 
              name="contract" 
              value={formData.contract} 
              onChange={handleChange}
            >
              <option value="Month-to-month">Month-to-month</option>
              <option value="One year">One year</option>
              <option value="Two year">Two year</option>
            </select>
          </div>
          
          <div className="input-group">
            <label>Internet Service</label>
            <select 
              name="internetService" 
              value={formData.internetService} 
              onChange={handleChange}
            >
              <option value="DSL">DSL</option>
              <option value="Fiber optic">Fiber optic</option>
              <option value="No">None</option>
            </select>
          </div>
          
          <div className="input-group">
            <label>Monthly Charges ($)</label>
            <input 
              type="number" 
              name="monthlyCharges" 
              value={formData.monthlyCharges} 
              onChange={handleChange}
              min="0"
              step="0.01"
            />
          </div>
          
          <button type="submit" className="predict-button" disabled={calculating}>
            {calculating ? 'Calculating...' : 'Predict'}
          </button>
        </form>
        
        {calculating && (
          <div className="prediction-loading-message">
            Calculating customer lifetime prediction...
          </div>
        )}
        
        {predictionError && (
          <div className="prediction-error">
            Error: {predictionError}
          </div>
        )}
        
        {prediction && !calculating && (
          <div className="prediction-results">
            <div className="prediction-metric">
              <div className="metric-label">Expected Tenure</div>
              <div className="metric-value">{prediction.medianSurvival} months</div>
            </div>
            
            <div className="prediction-metric">
              <div className="metric-label">Lifetime Value</div>
              <div className="metric-value">${prediction.lifetimeValue}</div>
            </div>
            
            <div className="prediction-metric">
              <div className="metric-label">6-Month Churn Probability</div>
              <div className="metric-value">{Math.round((prediction.churnRisk?.sixMonth || 0) * 100)}%</div>
            </div>
            
            <div className="prediction-metric">
              <div className="metric-label">1-Year Churn Probability</div>
              <div className="metric-value">{Math.round((prediction.churnRisk?.oneYear || 0) * 100)}%</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message={loadingMessage} progress={loadingProgress} />;
  }
  
  if (error) {
    return (
      <div className="survival-analysis-container">
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <h2>Error Loading Survival Analysis</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="survival-analysis-container">
      <div className="analysis-header">
        <h1><FaChartLine /> Survival Analysis</h1>
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          title="Refresh data"
        >
          <FaSync /> Refresh
        </button>
      </div>
      
      <div className="analysis-explanation">
        <h3><FaInfoCircle /> About Survival Analysis</h3>
        <p>
          Survival analysis measures how long customers stay before churning. 
          The Kaplan-Meier survival curves show the probability that a customer will still be active
          after a certain number of months. The hazard ratios indicate which factors most strongly
          influence churn risk over time.
        </p>
      </div>
      
      <div className="survival-curves-section">
        <h2>Survival Curves by Customer Segment</h2>
        
        <div className="curve-controls">
          <div className="control-group">
            <label>Customer Segment</label>
            <select onChange={handleSegmentChange} value={selectedSegment}>
              {availableSegments.map(segment => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="control-group checkbox">
            <input
              type="checkbox"
              id="show-ci"
              checked={showConfidenceIntervals}
              onChange={(e) => setShowConfidenceIntervals(e.target.checked)}
            />
            <label htmlFor="show-ci">Show Confidence Intervals</label>
          </div>
        </div>
        
        <div className="curve-chart-container">
          {getChartData() ? (
            <Line data={getChartData()} options={chartOptions} />
          ) : (
            <div className="no-data-message">No data available for selected segment</div>
          )}
        </div>
        
        <div className="chart-explanation">
          <p>
            <strong>Interpretation:</strong> The survival curve shows the probability of a customer 
            remaining active over time. A steeper decline indicates a higher churn rate in that period. 
            {showConfidenceIntervals && " The shaded area shows the 95% confidence interval."}
          </p>
        </div>
      </div>
      
      <div className="risk-factors-section">
        <h2>Churn Risk Factors</h2>
        <p className="section-description">
          Hazard ratios greater than 1.0 indicate factors that increase churn risk, 
          while ratios less than 1.0 indicate factors that reduce churn risk.
        </p>
        
        <div className="hazard-ratio-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={getHazardRatioData()}
              layout="vertical"
              margin={getChartMargins()}
            >
              <XAxis type="number" domain={[0, 'auto']} />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={window.innerWidth <= 768 ? 80 : 120}
                tick={{ fontSize: window.innerWidth <= 768 ? 10 : 12 }}
              />
              <Tooltip content={<HazardRatioTooltip />} />
              <Legend />
              <Bar dataKey="hazardRatio" fill="#4cc9f0" name="Hazard Ratio">
                {getHazardRatioData().map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isSignificant 
                      ? (entry.hazardRatio > 1 ? '#e74c3c' : '#2ecc71')
                      : '#95a5a6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {riskFactors && riskFactors.model_metrics && (
          <div className="model-metrics">
            <h3>Model Performance</h3>
            <div className="metrics-container">
              <div className="metric-card">
                <div className="metric-label">Concordance Index</div>
                <div className="metric-value">{riskFactors.model_metrics.concordance_index}</div>
                <div className="metric-description">Higher values (closer to 1.0) indicate better predictive ability</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Number of Observations</div>
                <div className="metric-value">{riskFactors.model_summary?.number_of_observations || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="lifetime-section">
        <h2>Customer Lifetime Prediction</h2>
        <CustomerLifetimePrediction />
      </div>
      
      {riskFactors && riskFactors.model_summary && (
        <div className="statistical-insights">
          <h3>Statistical Insights</h3>
          <p>
            The survival analysis model is statistically significant 
            (p-value: {riskFactors.model_summary.p_value.toExponential(2)}).
            Key findings include:
          </p>
          <ul>
            {riskFactors.risk_factors
              .filter(factor => factor.is_significant)
              .slice(0, 3)
              .map((factor, index) => (
                <li key={index}>
                  {factor.feature.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()} 
                  {factor.coefficient > 0 
                    ? ` increases churn risk by ${Math.round((factor.hazard_ratio - 1) * 100)}%` 
                    : ` decreases churn risk by ${Math.round((1 - factor.hazard_ratio) * 100)}%`}
                </li>
              ))}
          </ul>
          
          <h3>Risk Factor Summary</h3>
          <p>
            Out of {riskFactors.risk_factors.length} analyzed factors,&nbsp; 
            {riskFactors.risk_factors.filter(f => f.is_significant).length} were statistically significant (p &lt; 0.05).
            &nbsp;{riskFactors.risk_factors.filter(f => f.is_significant && f.coefficient > 0).length} factors increase churn risk, while&nbsp;
            {riskFactors.risk_factors.filter(f => f.is_significant && f.coefficient < 0).length} factors decrease churn risk.
          </p>
          
          <h3>Interpretation Guide</h3>
          <p>
            <strong>Hazard Ratios:</strong> A hazard ratio of 1.0 means no effect on churn risk. Values greater than 1.0 indicate increased risk, 
            while values less than 1.0 indicate decreased risk. For example, a hazard ratio of 2.0 means twice the risk, while 0.5 means half the risk.
          </p>
          <p>
            <strong>Concordance Index:</strong> {riskFactors.model_metrics?.concordance_index || 'N/A'} - This measures the model's ability to correctly 
            rank customers by their risk of churning. Values closer to 1.0 indicate better predictive performance.
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(SurvivalAnalysis);  // Memoize the entire component to prevent unnecessary rerenders
