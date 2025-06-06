// Web Worker for survival prediction calculations

/**
 * Make API request to get survival prediction
 * @param {Object} data - Customer data for prediction
 * @return {Promise} - API response with prediction results
 */

// API-based prediction function
async function getSurvivalPrediction(data) {
  try {
    const apiUrl = 'http://localhost:5001/survival-prediction';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    // Fall back to simplified model
    return simplifiedPredictionModel(data);
  }
}

/**
 * Simple prediction model when API is not available
 * @param {Object} data - Customer data for prediction
 * @return {Object} - Prediction results
 */

// Fallback prediction model - a local simplified prediction algorithm
function simplifiedPredictionModel(data) {
  console.log('Using simplified prediction model with data:', data);
  
  // Base prediction based on contract type
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
  
  // Adjust for internet service
  if (data.internetService === 'Fiber optic') {
    adjustedTenure *= 0.85;
  } else if (data.internetService === 'No') {
    adjustedTenure *= 1.15;
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
}

// Handle incoming messages from main thread
self.onmessage = async (event) => {
  try {
    console.log('Worker received message:', event.data);
    const customerData = event.data;
    
    // First try the API for predictions
    let results;
    try {
      results = await getSurvivalPrediction(customerData);
    } catch {
      // If API call fails, use the simplified model
      console.log('Using simplified model due to API failure');
      results = simplifiedPredictionModel(customerData);
    }
    
    // Send result back to main thread
    self.postMessage(results);
  } catch (error) {
    // Handle errors
    console.error('Worker processing error:', error);
    self.postMessage({ error: error.message || 'Calculation failed' });
  }
};
