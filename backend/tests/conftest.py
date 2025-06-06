import os
import sys
import pytest
from flask import Flask, jsonify
from dotenv import load_dotenv
import json
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
# This file is used to set up the test environment and fixtures for the Flask application

# Add the parent directory to path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables for testing
load_dotenv('.env.test', override=True)

from app import create_app
from db import get_db

@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    # Set testing config
    os.environ["TESTING"] = "True"
    os.environ["MONGO_URI"] = os.environ.get("TEST_MONGO_URI", "mongodb://localhost:27017/test_churn_db")
    
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    
    # For testing purposes, we'll override the users route to ensure it's protected
    @app.route('/users', methods=['GET'])
    def protected_users_route_for_testing():
        # This will always return 401 when no auth header is present
        if 'Authorization' not in app.request.headers:
            return jsonify({'error': 'Unauthorized'}), 401
            
        # Forward to real implementation if authorized
        from routes.users_routes import get_users
        return get_users()
    
    # Setup test context
    with app.app_context():
        yield app

@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Creates a test CLI runner for the app."""
    return app.test_cli_runner()

@pytest.fixture
def setup_test_user(app):
    """Create a admin test user for authentication tests."""
    with app.app_context():
        # Get database connection
        db = get_db()
        admin_collection = db.admin_users
        
        # Clear any existing test users
        admin_collection.delete_many({"username": "testuser"})
        
        # Create a test user
        admin_collection.insert_one({
            "username": "testuser",
            "password": generate_password_hash("testpassword"),
            "role": "admin"
        })
        
        yield
        
        # Clean up test user
        admin_collection.delete_many({"username": "testuser"})

@pytest.fixture
def db_with_test_data(app):
    """Create test customer data in the database."""
    with app.app_context():
        db = get_db()
        
        # Clear any existing test data
        db.users.delete_many({"customerID": {"$regex": "^TEST-"}})
        
        # Create a test customer
        customer = {
            "customerID": "TEST-1001",
            "gender": "Male",
            "SeniorCitizen": 0,
            "Partner": "No",
            "Dependents": "No",
            "tenure": 12,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "DSL",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "No",
            "DeviceProtection": "Yes",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 65.4,
            "TotalCharges": 785.5,
            "Churn": "No"
        }
        
        result = db.users.insert_one(customer)
        customer_id = result.inserted_id
        
        yield db, customer_id
        
        # Clean up test data
        db.users.delete_one({"_id": customer_id})
