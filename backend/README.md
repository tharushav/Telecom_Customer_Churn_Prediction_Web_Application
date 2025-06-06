# Customer Churn Prediction - Backend

This is the Python backend server for the Customer Churn Prediction project. The system uses machine learning models to predict customer churn based on various factors and provides a RESTful API for the frontend application.

1. Binary classification models to predict churn
2. Survival analysis to estimate customer lifetime
3. Data visualization endpoints for frontend display

## Technology Stack

- **Language**: Python 3.8+
- **Framework**: Flask
- **Database**: MongoDB
- **ML Libraries**: scikit-learn, lifelines
- **Authentication**: JWT (JSON Web Tokens)

## Setup Instructions

1. **Create a virtual environment**

```bash
cd backend
python -m venv venv
```

2. **Activate the virtual environment**

On Windows:
```bash
venv\Scripts\activate
```

On macOS/Linux:
```bash
source venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Start the server**

```bash
python app.py
```

The API will be available at `http://localhost:5001`.

## Deployed web application

Link - https://churn-analytics-frontend.vercel.app

Test users - 

admin user - username - admin1 
             password - admin123

editor user - username - editor1
              password - editor123

viewer user - username - viewer1
              password - viewer123

## Machine Learning Pipeline

The project uses a complete scikit-learn pipeline that handles:

1. **Data Preprocessing**:
   - Numeric features: Imputation (median) and StandardScaler
   - Categorical features: Imputation and OneHotEncoder

2. **Class Imbalance**: SMOTE for oversampling the minority class

3. **Stacking Classifier**:
   - Base learners: RandomForest, DecisionTree, LightGBM, XGBoost
   - Meta-model: Logistic Regression

This pipeline approach simplifies deployment by eliminating the need for separate preprocessing steps in the API code.

## API Documentation

### Authentication Endpoints

- `POST /auth/login` - Authenticate user and get JWT token
- `GET /auth/verify-token` - Verify JWT token validity
- `POST /auth/register` - Create new admin user (admin only)

### Customer Data Endpoints

- `GET /customer/<id>` - Get customer details
- `PUT /customer/<id>` - Update customer information
- `DELETE /customer/<id>` - Delete customer
- `POST /customer` - Create new customer

### Analytics Endpoints

- `GET /analytics` - Get churn analytics data
- `GET /cohort-data` - Get cohort analysis data
- `GET /cohort-forecast` - Get forecast based on cohort patterns
- `GET /survival-curve` - Get Kaplan-Meier survival curves
- `GET /risk-factors` - Get churn risk factors from Cox model
- `POST /survival-prediction` - Predict survival probability for a customer

## Testing

Run the test suite using pytest:

```bash
python -m pytest
```

## Author

Name -       Heenagama N Udagira
Student ID - 10898926
University of Plymouth

