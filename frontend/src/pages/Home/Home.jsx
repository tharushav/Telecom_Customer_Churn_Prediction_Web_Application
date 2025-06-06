import React, { useEffect, useState, useCallback } from 'react';
import { Bar, Pie, Doughnut, PolarArea, Radar } from 'react-chartjs-2';
import { getAnalytics, getUsers } from '../../services/api';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import './Home.css';
import { MdAnalytics, MdTrendingUp, MdPerson, MdFilterAlt } from "react-icons/md";
import { FaMoneyCheckAlt, FaSync, FaFilter } from "react-icons/fa";
import { successToast, errorToast } from '../../toast-config.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Register the required chart components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  RadialLinearScale,
  PointElement,
  LineElement
);

// Apply global chart defaults for a dark theme
ChartJS.defaults.font.family = "'Poppins', 'Helvetica', 'Arial', sans-serif";
ChartJS.defaults.color = '#e0e0e0';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.1)';

const Home = () => {
  // Extract authentication state from useAuth
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [churnAnalytics, setChurnAnalytics] = useState(null);
  const [tenureGroupData, setTenureGroupData] = useState(null);
  const [userData, setUserData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [segmentStats, setSegmentStats] = useState({
    highValue: 0,
    longTerm: 0,
    new: 0
  });
  const [segmentChurnRates, setSegmentChurnRates] = useState({
    highValue: 0,
    longTerm: 0,
    new: 0,
    midTerm: 0,
    regular: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Add metric states that will update based on year filter
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalMonthlyRevenue, setTotalMonthlyRevenue] = useState(0);
  
  // Loading state tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState('Initializing dashboard...');
  
  // Year filter state
  const [selectedYear, setSelectedYear] = useState('all');
  
  // Get current year for dropdown options
  const currentYear = new Date().getFullYear();
  // Create an array of the last 5 years for the dropdown
  const yearOptions = [
    { value: 'all', label: 'All Years' },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: `${currentYear - i}`,
      label: `${currentYear - i}`
    }))
  ];

  // Process analytics data to update metrics
  const processAnalyticsData = useCallback((data) => {
    if (!data) return;

    
    // Update customer count based on analytics data
    setTotalCustomers(data.total_customers || 0);
    
    // Update revenue metrics
    setTotalRevenue(data.total_revenue ? parseFloat(data.total_revenue).toFixed(2) : '0.00');
    setTotalMonthlyRevenue(data.monthly_revenue ? parseFloat(data.monthly_revenue).toFixed(2) : '0.00');
    
  }, []);

  // Updated fetchData to use selectedYear
  const loadData = useCallback(async (forceRefresh = false) => {
    // Not attempt to load data until authentication is confirmed
    if (authLoading || !isAuthenticated) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setLoadingStep('Fetching analytics data...');
    setLoadingProgress(10);
    
    if (forceRefresh) {
      setIsRefreshing(true);
    }
    
    try {
      // Get year filtered analytics data
      const analyticsData = await getAnalytics(
        selectedYear !== 'all' ? selectedYear : null, 
        forceRefresh
      )
        .catch(() => {
          setLoadingProgress(40);
          setLoadingStep('Analytics failed. Continuing with customer data...');
          return null;
        });
      
      // Always get unfiltered tenure group data for consistent chart
      const unfilteredAnalytics = selectedYear !== 'all' ? 
        await getAnalytics(null, forceRefresh).catch(() => null) : null;
      
      if (analyticsData) {
        setChurnAnalytics(analyticsData);
        
        // Process analytics data to update metrics
        processAnalyticsData(analyticsData);
        
        // If we have filtered data, save the unfiltered tenure group data separately
        if (selectedYear !== 'all' && unfilteredAnalytics) {
          setTenureGroupData(unfilteredAnalytics.churn_by_tenure_group);
        } else {
          setTenureGroupData(null); // Reset if all years selected
        }
        
        setLoadingProgress(40);
      }
      
      // Get user data
      setLoadingStep('Loading customer data...');
      
      try {
        const params = {
          segment: null,
          page: 1,
          perPage: 'all',
          search: '',
          forceRefresh
        };
        
        // Add year parameter if a year is selected
        if (selectedYear !== 'all') {
          params.year = selectedYear;
        }
        
        // Pass parameters to getUsers
        const data = await getUsers(
          params.segment,
          params.page,
          params.perPage,
          params.search,
          params.forceRefresh,
          params.year
        );
        
        setUserData(data.users);
        setLoadingProgress(80);
        setLoadingStep('Processing customer segments...');
        
        // Process segments
        if (data.users && data.users.length > 0) {
          processCustomerSegments(data.users);
        }
        
        setLoadingProgress(100);
        setLoadingStep('Dashboard loaded!');
      } catch (error) {
        
        // More specific error message based on error type
        if (error.code === 'ECONNABORTED') {
          setError("Request timed out while loading customer data. The dataset might be large or the server is busy. Try again or refresh the page.");
        } else {
          setError("There was an error fetching the user data. Please try again.");
        }
        return [];
      }
      
      // Show success toast after successful refresh
      if (forceRefresh) {
        successToast('Dashboard data refreshed successfully');
      }
    } catch {
      setError("There was an error loading the dashboard. Please try again later.");
      
      // Show error toast when refresh fails
      if (forceRefresh) {
        errorToast('Failed to refresh data. Please try again.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYear, processAnalyticsData, isAuthenticated, authLoading]);

  // Separate memoized function for processing customer segments
  const processCustomerSegments = useCallback((users) => {
    const highValueCustomers = users.filter(user => parseFloat(user.MonthlyCharges) > 75);
    const longTermCustomers = users.filter(user => parseInt(user.tenure) > 24);
    const newCustomers = users.filter(user => parseInt(user.tenure) < 3);
    const midTermCustomers = users.filter(user => 
      parseInt(user.tenure) >= 3 && 
      parseInt(user.tenure) <= 24 && 
      parseFloat(user.MonthlyCharges) <= 75
    );
    
    const regularCustomers = users.filter(user => {
      const monthlyCharges = parseFloat(user.MonthlyCharges);
      const tenure = parseInt(user.tenure);
      return !(
        monthlyCharges > 75 || 
        tenure > 24 || 
        tenure < 3 || 
        (tenure >= 3 && tenure <= 24 && monthlyCharges <= 75)
      );
    });
    
    setSegmentStats({
      highValue: highValueCustomers.length,
      longTerm: longTermCustomers.length,
      new: newCustomers.length
    });
    
    const calculateChurnRate = (customers) => {
      if (customers.length === 0) return 0;
      const churnedCustomers = customers.filter(user => user.Churn === 'Yes');
      return (churnedCustomers.length / customers.length) * 100;
    };
    
    setSegmentChurnRates({
      highValue: calculateChurnRate(highValueCustomers),
      longTerm: calculateChurnRate(longTermCustomers),
      new: calculateChurnRate(newCustomers),
      midTerm: calculateChurnRate(midTermCustomers),
      regular: calculateChurnRate(regularCustomers)
    });
  }, []);

  useEffect(() => {
    // Only fetch data when authentication is ready and confirmed
    if (!authLoading && isAuthenticated) {
      loadData();
    }
  }, [loadData, isAuthenticated, authLoading]);

  // Loading spinner to show progress
  if (loading) {
    return <LoadingSpinner message={loadingStep} progress={loadingProgress} />;
  }

  // Error handling
  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button 
          className="retry-button" 
          onClick={() => loadData(true)}
        >
          <FaSync /> Retry
        </button>
      </div>
    );
  }

  if (!churnAnalytics || !userData.length) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  const colorPalette = {
    primary: ['rgba(79, 195, 247, 0.8)', 'rgba(79, 195, 247, 0.2)'],
    success: ['rgba(46, 204, 113, 0.8)', 'rgba(46, 204, 113, 0.2)'],
    warning: ['rgba(255, 159, 64, 0.8)', 'rgba(255, 159, 64, 0.2)'],
    danger: ['rgba(255, 99, 132, 0.8)', 'rgba(255, 99, 132, 0.2)'],
    info: ['rgba(153, 102, 255, 0.8)', 'rgba(153, 102, 255, 0.2)'],
    neutral: ['rgba(149, 165, 166, 0.8)', 'rgba(149, 165, 166, 0.2)'],
    segments: [
      'rgba(247, 37, 133, 0.8)',
      'rgba(67, 97, 238, 0.8)',
      'rgba(76, 201, 240, 0.8)',
      'rgba(142, 68, 173, 0.8)'
    ]
  };

  // Churn Distribution using Pie chart
  const churnDistributionData = {
    labels: ['Churned', 'Active'],
    datasets: [
      {
        label: 'Customer Count',
        data: churnAnalytics?.churn_distribution?.churned && [
          churnAnalytics.churn_distribution.churned, 
          churnAnalytics.churn_distribution.notChurned
        ],
        backgroundColor: [colorPalette.danger[0], colorPalette.success[0]],
        borderColor: ['rgba(255, 99, 132, 0.5)', 'rgba(46, 204, 113, 0.5)'],
        borderWidth: 1,
        hoverOffset: 15,
      },
    ],
  };

  // Churn by Payment Method using Pie chart
  const churnByPaymentMethodData = {
    labels: churnAnalytics?.churn_by_payment_method && Object.keys(churnAnalytics.churn_by_payment_method),
    datasets: [
      {
        label: 'Churn Rate (%)',
        data: churnAnalytics?.churn_by_payment_method && Object.values(churnAnalytics.churn_by_payment_method),
        backgroundColor: [
          'rgba(76, 201, 240, 0.8)',
          'rgba(67, 97, 238, 0.8)',
          'rgba(247, 37, 133, 0.8)',
          'rgba(255, 159, 64, 0.8)'
        ],
        borderColor: [
          'rgba(76, 201, 240, 0.5)',
          'rgba(67, 97, 238, 0.5)',
          'rgba(247, 37, 133, 0.5)',
          'rgba(255, 159, 64, 0.5)'
        ],
        borderWidth: 1,
        hoverOffset: 20,
      },
    ],
  };

  // Generate chart data with special handling for tenure group
  const churnByTenureGroupData = {
    labels: tenureGroupData ? Object.keys(tenureGroupData) : 
           (churnAnalytics?.churn_by_tenure_group && Object.keys(churnAnalytics.churn_by_tenure_group)),
    datasets: [
      {
        label: 'Churn Rate (%)',
        data: tenureGroupData ? Object.values(tenureGroupData) :
              (churnAnalytics?.churn_by_tenure_group && Object.values(churnAnalytics.churn_by_tenure_group)),
        backgroundColor: [
          'rgba(52, 152, 219, 0.8)',
          'rgba(155, 89, 182, 0.8)',
          'rgba(46, 204, 113, 0.8)',
          'rgba(241, 196, 15, 0.8)',
          'rgba(230, 126, 34, 0.8)'
        ],
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
        fill: true
      },
    ],
  };

  const churnByContractData = {
    labels: churnAnalytics?.churn_by_contract && Object.keys(churnAnalytics.churn_by_contract),
    datasets: [
      {
        label: 'Churn Rate by Contract',
        data: churnAnalytics?.churn_by_contract && Object.values(churnAnalytics.churn_by_contract),
        backgroundColor: [
          colorPalette.danger[0],
          colorPalette.warning[0],
          colorPalette.success[0]
        ],
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
        fill: true
      },
    ],
  };

  const segmentChurnData = {
    labels: ['High-Value', 'Long-Term', 'New', 'Mid-Term'],
    datasets: [
      {
        label: 'Churn Rate (%)',
        data: [
          segmentChurnRates.highValue.toFixed(1),
          segmentChurnRates.longTerm.toFixed(1),
          segmentChurnRates.new.toFixed(1),
          segmentChurnRates.midTerm.toFixed(1)
        ],
        backgroundColor: colorPalette.segments,
        borderWidth: 0,
        borderRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 15,
          padding: 15,
          font: {
            size: 12
          },
          color: '#e0e0e0'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(30,30,30,0.9)',
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        padding: 12,
        cornerRadius: 6,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.formattedValue}%`;
          }
        }
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold'
        },
        formatter: (value) => `${value}%`
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255,255,255,0.05)'
        },
        ticks: {
          color: '#a0a0a0'
        }
      },
      y: {
        grid: {
          color: 'rgba(255,255,255,0.05)'
        },
        ticks: {
          color: '#a0a0a0'
        }
      }
    }
  };

  const horizontalBarOptions = {
    ...chartOptions,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          callback: function(value) {
            return value + '%';
          }
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1><MdAnalytics /> Customer Churn Dashboard</h1>
          <div className="filter-container">
            {/* Year filter dropdown */}
            <div className="year-filter">
              <FaFilter className="filter-icon" />
              <select 
                className="year-selector"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {yearOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <button 
              className="refresh-button"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
            >
              <FaSync className={isRefreshing ? 'rotating' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {selectedYear !== 'all' && (
          <div className="filter-indicator">
            Showing data for year {selectedYear}
          </div>
        )}
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-icon customer-icon">
            <MdPerson />
          </div>
          <div className="card-content">
            <h3>Total Customers</h3>
            <p className="card-value">{totalCustomers.toLocaleString()}</p>
            {selectedYear !== 'all' && <p className="filter-note">in {selectedYear}</p>}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon revenue-icon">
            <MdTrendingUp />
          </div>
          <div className="card-content">
            <h3>Monthly Revenue</h3>
            <p className="card-value">${totalMonthlyRevenue}</p>
            {selectedYear !== 'all' && <p className="filter-note">in {selectedYear}</p>}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon total-icon">
            <FaMoneyCheckAlt />
          </div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">${totalRevenue}</p>
            {selectedYear !== 'all' && <p className="filter-note">in {selectedYear}</p>}
          </div>
        </div>
      </div>

      <div className="segment-analysis">
        <h2>Customer Segments</h2>
        <div className="segment-grid">
          <div className="segment-card high-value">
            <h3>High-Value Customers</h3>
            <p className="segment-count">{segmentStats.highValue}</p>
            <p className="segment-description">Spending over $75 monthly</p>
          </div>
          <div className="segment-card long-term">
            <h3>Long-Term Customers</h3>
            <p className="segment-count">{segmentStats.longTerm}</p>
            <p className="segment-description">With us for 2+ years</p>
          </div>
          <div className="segment-card new-customers">
            <h3>New Customers</h3>
            <p className="segment-count">{segmentStats.new}</p>
            <p className="segment-description">Joined in the last 3 months</p>
          </div>
        </div>
        
        <div className="segment-churn-container">
          <h3>Churn Rate by Customer Segment</h3>
          <div className="color-indicators">
            <div className="color-indicator">
              <div className="color-box" style={{backgroundColor: colorPalette.segments[0]}}></div>
              <span className="indicator-label">High-Value</span>
            </div>
            <div className="color-indicator">
              <div className="color-box" style={{backgroundColor: colorPalette.segments[1]}}></div>
              <span className="indicator-label">Long-Term</span>
            </div>
            <div className="color-indicator">
              <div className="color-box" style={{backgroundColor: colorPalette.segments[2]}}></div>
              <span className="indicator-label">New</span>
            </div>
            <div className="color-indicator">
              <div className="color-box" style={{backgroundColor: colorPalette.segments[3]}}></div>
              <span className="indicator-label">Mid-Term</span>
            </div>
          </div>
          <div className="segment-churn-chart">
            <Bar 
              data={segmentChurnData} 
              options={{
                ...horizontalBarOptions,
                indexAxis: 'y',
                plugins: {
                  ...horizontalBarOptions.plugins,
                  legend: {
                    display: false
                  },
                  datalabels: {
                    display: true,
                    color: '#fff',
                    font: {
                      weight: 'bold'
                    },
                    formatter: (value) => `${value}%`,
                    anchor: 'end',
                    align: 'start',
                    offset: 8
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card churn-distribution-chart">
          <h2>Churn Distribution</h2>
          <div className="chart-container pie-container">
            <Pie
              data={churnDistributionData} 
              options={{
                ...chartOptions,
                scales: {
                  x: { display: false },
                  y: { display: false }
                },
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    position: 'bottom',
                    display: true
                  },
                  datalabels: {
                    display: true,
                    formatter: (value) => `${value.toFixed(1)}%`,
                    font: {
                      weight: 'bold',
                      size: 12
                    },
                    color: '#fff'
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
          </div>
        </div>
        
        <div className="chart-card payment-method-chart">
          <h2>Churn by Payment Method</h2>
          <div className="chart-container pie-container payment-method-pie">
            <Pie
              data={churnByPaymentMethodData} 
              options={{
                ...chartOptions,
                scales: {
                  x: { display: false },
                  y: { display: false }
                },
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    position: 'bottom',
                    display: true
                  },
                  datalabels: {
                    display: true,
                    anchor: 'center',
                    align: 'center',
                    formatter: (value) => `${value.toFixed(1)}%`,
                    font: {
                      weight: 'bold',
                      size: 11
                    },
                    color: '#fff'
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
          </div>
        </div>
        
        <div className="chart-card contract-chart">
          <h2>Churn by Contract</h2>
          <div className="color-indicators">
            {churnAnalytics?.churn_by_contract && Object.keys(churnAnalytics.churn_by_contract).map((label, index) => (
              <div className="color-indicator" key={label}>
                <div 
                  className="color-box" 
                  style={{backgroundColor: index === 0 ? colorPalette.danger[0] : 
                                       index === 1 ? colorPalette.warning[0] : 
                                       colorPalette.success[0]}}
                ></div>
                <span className="indicator-label">{label}</span>
              </div>
            ))}
          </div>
          <div className="chart-container">
            <Bar 
              data={churnByContractData} 
              options={{
                ...horizontalBarOptions,
                maintainAspectRatio: false,
                barPercentage: 1.0,
                categoryPercentage: 0.9,
                layout: {
                  padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 10
                  }
                },
                plugins: {
                  ...horizontalBarOptions.plugins,
                  legend: {
                    display: false
                  }
                },
                scales: {
                  ...horizontalBarOptions.scales,
                  x: {
                    ...horizontalBarOptions.scales.x,
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>
        </div>
        
        <div className="chart-card tenure-chart">
          <h2>Churn by Tenure Group</h2>
          {selectedYear !== 'all' && (
            <p className="all-data-note">*This chart shows data across all years</p>
          )}
          <div className="color-indicators">
            {churnAnalytics?.churn_by_tenure_group && Object.keys(churnAnalytics.churn_by_tenure_group).map((label, index) => (
              <div className="color-indicator" key={label}>
                <div 
                  className="color-box" 
                  style={{
                    backgroundColor: [
                      'rgba(52, 152, 219, 0.8)',  
                      'rgba(155, 89, 182, 0.8)',  
                      'rgba(46, 204, 113, 0.8)',  
                      'rgba(241, 196, 15, 0.8)',  
                      'rgba(230, 126, 34, 0.8)'   
                    ][index % 5]
                  }}
                ></div>
                <span className="indicator-label">{label}</span>
              </div>
            ))}
          </div>
          <div className="chart-container">
            <Bar
              data={churnByTenureGroupData}
              options={{
                ...chartOptions,
                maintainAspectRatio: false,
                barPercentage: 1.0,
                categoryPercentage: 0.9,
                layout: {
                  padding: {
                    left: 10,
                    right: 10,
                    top: 10, 
                    bottom: 10
                  }
                },
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    display: false
                  },
                  datalabels: {
                    display: true,
                    font: {
                      weight: 'bold',
                      size: 11
                    },
                    formatter: (value) => `${value.toFixed(1)}%`,
                    color: '#fff',
                    anchor: 'center',
                    align: 'center'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      display: false
                    },
                    ticks: {
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    },
                    ticks: {
                      callback: function(value) {
                        return value + '%';
                      }
                    }
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;