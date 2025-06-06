from flask import Blueprint, jsonify, request
from db import get_db
from lifelines import KaplanMeierFitter, CoxPHFitter
from lifelines.statistics import logrank_test
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

survival_bp = Blueprint('survival_bp', __name__)

def prepare_survival_data():
    """
    Prepare data for survival analysis.
    Transforms user data from MongoDB into a format suitable for KaplanMeierFitter and CoxPHFitter.
    """
    # Get MongoDB connection
    db_connection = get_db()
    users_collection = db_connection.users
    
    # Get all users from MongoDB
    users = list(users_collection.find())
    
    # Convert to pandas DataFrame
    data = []
    for user in users:
        # MongoDB documents are already dictionaries
        user_dict = {k: v for k, v in user.items() if k != '_id'}  # Exclude _id field
        data.append(user_dict)
    
    df = pd.DataFrame(data)
    
    # Create event indicator (1 for churned, 0 for not churned)
    df['event'] = (df['Churn'] == 'Yes').astype(int)
    
    # Encode categorical variables to dummy variables
    # Encode gender (1 for Male, 0 for Female)
    df['gender'] = (df['gender'] == 'Male').astype(int)
    
    # Encode yes/no variables
    for col in ['Partner', 'Dependents', 'PhoneService', 'PaperlessBilling']:
        df[col] = (df[col] == 'Yes').astype(int)
    
    # Create dummy variables for contract
    df['Contract_Monthly'] = (df['Contract'] == 'Month-to-month').astype(int)
    df['Contract_OneYear'] = (df['Contract'] == 'One year').astype(int)
    df['Contract_TwoYear'] = (df['Contract'] == 'Two year').astype(int)
    
    # Create dummy variables for internet service
    df['InternetService_DSL'] = (df['InternetService'] == 'DSL').astype(int)
    df['InternetService_Fiber'] = (df['InternetService'] == 'Fiber optic').astype(int)
    df['InternetService_No'] = (df['InternetService'] == 'No').astype(int)
    
    # Create dummy variables for payment method
    df['PaymentMethod_Electronic'] = (df['PaymentMethod'] == 'Electronic check').astype(int)
    df['PaymentMethod_Mailed'] = (df['PaymentMethod'] == 'Mailed check').astype(int)
    df['PaymentMethod_BankTransfer'] = (df['PaymentMethod'] == 'Bank transfer (automatic)').astype(int)
    df['PaymentMethod_CreditCard'] = (df['PaymentMethod'] == 'Credit card (automatic)').astype(int)
    
    # Replace missing values if any
    df = df.fillna(0)
    
    # Make sure tenure is at least 1 for survival analysis
    if 'tenure' in df.columns:
        df['tenure'] = pd.to_numeric(df['tenure'], errors='coerce').fillna(1).clip(lower=1)
    else:
        df['tenure'] = 1  # Default value if tenure is missing
    
    # Convert numeric columns to appropriate types
    if 'MonthlyCharges' in df.columns:
        df['MonthlyCharges'] = pd.to_numeric(df['MonthlyCharges'], errors='coerce').fillna(0)
    
    if 'TotalCharges' in df.columns:
        df['TotalCharges'] = pd.to_numeric(df['TotalCharges'], errors='coerce').fillna(0)
    
    return df

@survival_bp.route('/survival-curve', methods=['GET'])
def get_survival_curve():
    """Generate Kaplan Meier survival curves for different customer segments"""
    try:
        # Prepare data for survival analysis
        df = prepare_survival_data()
        
        # Fit Kaplan Meier model on the entire dataset
        kmf = KaplanMeierFitter()
        kmf.fit(df['tenure'], df['event'], label='Overall')
        
        # Extract survival function timeline and probabilities
        timeline = kmf.timeline.tolist()
        survival_prob = kmf.survival_function_.values.flatten().tolist()
        
        # Handle confidence intervals
        try:
            # Check the structure of confidence interval DataFrame to get correct column names
            ci_columns = list(kmf.confidence_interval_.columns)
            lower_ci_col = [col for col in ci_columns if 'lower' in col.lower()][0]
            upper_ci_col = [col for col in ci_columns if 'upper' in col.lower()][0]
            
            lower_bound = kmf.confidence_interval_[lower_ci_col].values.tolist()
            upper_bound = kmf.confidence_interval_[upper_ci_col].values.tolist()
        except (KeyError, IndexError, AttributeError) as e:
            print(f"Error extracting confidence intervals: {e}")
            print(f"Available columns: {ci_columns if 'ci_columns' in locals() else 'unknown'}")
            # Fallback values if confidence intervals cannot be extracted
            lower_bound = [max(0, p*0.9) for p in survival_prob]
            upper_bound = [min(1, p*1.1) for p in survival_prob]
        
        # Get survival curves for different segments
        curves = {
            'overall': {
                'timeline': timeline,
                'survival_prob': survival_prob,
                'lower_bound': lower_bound,
                'upper_bound': upper_bound
            }
        }
        
        # Add segment specific curves - Contract Type
        contract_types = ['Contract_Monthly', 'Contract_OneYear', 'Contract_TwoYear']
        for contract in contract_types:
            subset = df[df[contract] == 1]
            if len(subset) > 0:
                kmf = KaplanMeierFitter()
                kmf.fit(subset['tenure'], subset['event'], label=contract)
                
                # Extract basic curve data
                contract_timeline = kmf.timeline.tolist()
                contract_survival = kmf.survival_function_.values.flatten().tolist()
                
                # Extract confidence intervals with error handling
                try:
                    ci_columns = list(kmf.confidence_interval_.columns)
                    lower_ci_col = [col for col in ci_columns if 'lower' in col.lower()][0]
                    upper_ci_col = [col for col in ci_columns if 'upper' in col.lower()][0]
                    
                    contract_lower = kmf.confidence_interval_[lower_ci_col].values.tolist()
                    contract_upper = kmf.confidence_interval_[upper_ci_col].values.tolist()
                except (KeyError, IndexError, AttributeError) as e:
                    print(f"Error extracting confidence intervals for {contract}: {e}")
                    # Fallback values
                    contract_lower = [max(0, p*0.9) for p in contract_survival]
                    contract_upper = [min(1, p*1.1) for p in contract_survival]
                
                curves[contract] = {
                    'timeline': contract_timeline,
                    'survival_prob': contract_survival,
                    'lower_bound': contract_lower,
                    'upper_bound': contract_upper
                }
        
        # Add segment specific curves - Internet Service
        internet_types = ['InternetService_DSL', 'InternetService_Fiber', 'InternetService_No']
        for internet in internet_types:
            subset = df[df[internet] == 1]
            if len(subset) > 0:
                kmf = KaplanMeierFitter()
                kmf.fit(subset['tenure'], subset['event'], label=internet)
                
                # Extract basic curve data
                internet_timeline = kmf.timeline.tolist()
                internet_survival = kmf.survival_function_.values.flatten().tolist()
                
                # Extract confidence intervals with error handling
                try:
                    ci_columns = list(kmf.confidence_interval_.columns)
                    lower_ci_col = [col for col in ci_columns if 'lower' in col.lower()][0]
                    upper_ci_col = [col for col in ci_columns if 'upper' in col.lower()][0]
                    
                    internet_lower = kmf.confidence_interval_[lower_ci_col].values.tolist()
                    internet_upper = kmf.confidence_interval_[upper_ci_col].values.tolist()
                except (KeyError, IndexError, AttributeError) as e:
                    print(f"Error extracting confidence intervals for {internet}: {e}")
                    # Fallback values
                    internet_lower = [max(0, p*0.9) for p in internet_survival]
                    internet_upper = [min(1, p*1.1) for p in internet_survival]
                
                curves[internet] = {
                    'timeline': internet_timeline,
                    'survival_prob': internet_survival,
                    'lower_bound': internet_lower,
                    'upper_bound': internet_upper
                }
        
        # Perform log rank test between month to month and two year contracts
        monthly_subset = df[df['Contract_Monthly'] == 1]
        twoyear_subset = df[df['Contract_TwoYear'] == 1]
        
        if len(monthly_subset) > 0 and len(twoyear_subset) > 0:
            logrank_result = logrank_test(
                monthly_subset['tenure'], 
                twoyear_subset['tenure'], 
                monthly_subset['event'], 
                twoyear_subset['event']
            )
            
            statistical_insights = {
                'test_name': 'Log rank test between month-to-month and two-year contracts',
                'p_value': logrank_result.p_value,
                'test_statistic': logrank_result.test_statistic,
                'interpretation': 'Significant difference in survival patterns' if logrank_result.p_value < 0.05 else 'No significant difference in survival patterns'
            }
        else:
            statistical_insights = {
                'test_name': 'Log-rank test',
                'p_value': None,
                'interpretation': 'Not enough data to perform statistical test'
            }
        
        return jsonify({
            'curves': curves,
            'statistical_insights': statistical_insights
        })
    
    except Exception as e:
        print(f"Error generating survival curves: {str(e)}")
        return jsonify({"error": str(e)}), 500

@survival_bp.route('/risk-factors', methods=['GET'])
def get_risk_factors():
    """Generate Cox Proportional Hazards model to identify risk factors for churn"""
    try:
        # Prepare data for factor analysis
        df = prepare_survival_data()
        
        # Select features for the Cox model
        features = [
            'gender', 'SeniorCitizen', 'Partner', 'Dependents', 'MonthlyCharges',
            'Contract_Monthly', 'Contract_OneYear', 'PaperlessBilling',
            'PaymentMethod_Electronic', 'PaymentMethod_Mailed', 'InternetService_DSL', 
            'InternetService_Fiber'
        ]
        
        # Check that all features exist in the df
        features = [f for f in features if f in df.columns]
        
        if len(features) < 2:
            return jsonify({"error": "Not enough valid features for risk factor analysis"}), 400
        
        # Fit Cox Proportional Hazards model with error handling
        cph = CoxPHFitter()
        try:
            cph.fit(df[features + ['tenure', 'event']], duration_col='tenure', event_col='event')
            
            # Extract coefficients and hazard ratios
            summary = cph.summary
            
            # Convert to format suitable for frontend
            risk_factors = []
            for feature in features:
                try:
                    coef = float(summary.loc[feature, 'coef'])
                    hazard_ratio = float(summary.loc[feature, 'exp(coef)'])
                    p_value = float(summary.loc[feature, 'p'])
                    
                    # Get confidence intervals
                    try:
                        lower_ci = float(summary.loc[feature, 'exp(coef) lower 95%'])
                        upper_ci = float(summary.loc[feature, 'exp(coef) upper 95%'])
                    except KeyError:
                        # Alternative column names
                        ci_columns = [col for col in summary.columns if 'lower' in col.lower()]
                        if ci_columns:
                            lower_ci = float(summary.loc[feature, ci_columns[0]])
                            upper_ci_cols = [col for col in summary.columns if 'upper' in col.lower()]
                            upper_ci = float(summary.loc[feature, upper_ci_cols[0]]) if upper_ci_cols else lower_ci * 1.5
                        else:
                            lower_ci = hazard_ratio * 0.8
                            upper_ci = hazard_ratio * 1.2
                    
                    risk_factors.append({
                        'feature': feature,
                        'coefficient': coef,
                        'hazard_ratio': hazard_ratio,
                        'p_value': p_value,
                        'is_significant': p_value < 0.05,
                        'lower_ci': lower_ci,
                        'upper_ci': upper_ci
                    })
                except Exception as e:
                    print(f"Error processing feature {feature}: {str(e)}")
                    continue
            
            # Sort by significance
            risk_factors.sort(key=lambda x: (not x['is_significant'], -abs(x['hazard_ratio'] - 1)))
            
            # Get model performance metrics
            try:
                concordance_index = round(float(cph.concordance_index_), 3)
            except:
                concordance_index = 0.5
                
            try:
                log_likelihood = round(float(cph.log_likelihood_), 2)
            except:
                log_likelihood = 0.0
                
            model_metrics = {
                'concordance_index': concordance_index,
            }
            
            # Get summary statistics
            n_observations = int(summary['n'].iloc[0]) if 'n' in summary.columns else int(len(df))
            n_events = int(summary['n_events'].iloc[0]) if 'n_events' in summary.columns else int(df['event'].sum())
            
            try:
                log_likelihood_ratio = float(summary['log_likelihood_ratio_test'].iloc[0])
                p_value = float(np.exp(-log_likelihood_ratio / 2))
            except:
                log_likelihood_ratio = 0.0
                p_value = 1.0
            
            # Convert any potential numpy types to python native types
            risk_factors = [
                {k: int(v) if isinstance(v, np.integer) else float(v) if isinstance(v, np.floating) else v 
                 for k, v in factor.items()}
                for factor in risk_factors
            ]
            
            return jsonify({
                'risk_factors': risk_factors,
                'model_metrics': model_metrics,
                'model_summary': {
                    'number_of_observations': int(n_observations),
                    'number_of_events': int(n_events),
                    'log_likelihood_ratio_test': float(log_likelihood_ratio),
                    'p_value': float(p_value)
                }
            })
        
        except Exception as e:
            print(f"Error fitting Cox model: {str(e)}")
            return jsonify({
                "error": "Failed to fit Cox model with the provided data",
                "details": str(e)
            }), 500
    
    except Exception as e:
        print(f"Error generating risk factors: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
@survival_bp.route('/survival-prediction', methods=['POST'])
def predict_survival():
    """Predict survival probability for a given customer over time"""
    try:
        # Get customer data from request
        customer_data = request.json
        
        # Prepare data for survival analysis
        df = prepare_survival_data()
        
        # Select features for the model
        features = [
            'gender', 'SeniorCitizen', 'Partner', 'Dependents', 'MonthlyCharges',
            'Contract_Monthly', 'Contract_OneYear', 'PaperlessBilling',
            'PaymentMethod_Electronic', 'PaymentMethod_Mailed', 'InternetService_DSL', 
            'InternetService_Fiber'
        ]
        
        # Fit Cox Proportional Hazards model
        cph = CoxPHFitter()
        cph.fit(df[features + ['tenure', 'event']], duration_col='tenure', event_col='event')
        
        # Prepare customer data in the required format
        customer_features = {
            'gender': 1 if customer_data.get('gender') == 'Male' else 0,
            'SeniorCitizen': int(customer_data.get('SeniorCitizen', 0)),
            'Partner': 1 if customer_data.get('Partner') == 'Yes' else 0,
            'Dependents': 1 if customer_data.get('Dependents') == 'Yes' else 0,
            'MonthlyCharges': float(customer_data.get('MonthlyCharges', 0)),
            'Contract_Monthly': 1 if customer_data.get('Contract') == 'Month-to-month' else 0,
            'Contract_OneYear': 1 if customer_data.get('Contract') == 'One year' else 0,
            'PaperlessBilling': 1 if customer_data.get('PaperlessBilling') == 'Yes' else 0,
            'PaymentMethod_Electronic': 1 if customer_data.get('PaymentMethod') == 'Electronic check' else 0,
            'PaymentMethod_Mailed': 1 if customer_data.get('PaymentMethod') == 'Mailed check' else 0,
            'InternetService_DSL': 1 if customer_data.get('InternetService') == 'DSL' else 0,
            'InternetService_Fiber': 1 if customer_data.get('InternetService') == 'Fiber optic' else 0
        }
        
        # Create a dataframe for the customer
        customer_df = pd.DataFrame([customer_features])
        
        # Predict survival function
        survival_func = cph.predict_survival_function(customer_df)
        
        # Get median survival time (50% survival probability)
        try:
            median_survival = cph.predict_median(customer_df)[0]
        except ValueError:
            # If median survival is not reached within the data timeframe
            median_survival = None
        
        # Convert survival function to list format for the frontend
        timeline = survival_func.index.tolist()
        survival_probs = survival_func.values[0].tolist()
        
        # Calculate churn probabilities (1 - survival)
        churn_probs = [1 - prob for prob in survival_probs]
        
        # Calculate expected customer lifetime value if monthly charges are provided
        clv = None
        if 'MonthlyCharges' in customer_data and median_survival:
            monthly_charges = float(customer_data.get('MonthlyCharges', 0))
            clv = monthly_charges * median_survival
        
        return jsonify({
            'timeline': timeline,
            'survival_probabilities': survival_probs,
            'churn_probabilities': churn_probs,
            'median_survival_time': median_survival,
            'customer_lifetime_value': clv,
            'risk_percentile': None 
        })
        
    except Exception as e:
        print(f"Error predicting survival: {str(e)}")
        return jsonify({"error": str(e)}), 500