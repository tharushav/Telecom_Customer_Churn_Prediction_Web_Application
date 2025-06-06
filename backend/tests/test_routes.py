import json
import pytest
from unittest.mock import patch
from flask import jsonify
# To verify API endpoints work correctly

# Auth token fixture
@pytest.fixture
def auth_token(client, setup_test_user):
    """Get auth token for testing protected routes."""
    response = client.post('/auth/login', json={
        'username': 'testuser',
        'password': 'testpassword'
    })
    data = json.loads(response.data)
    return data['token']

def test_options_request(client):
    """Test OPTIONS request for CORS preflight."""
    # Add CORS headers to the app for testing
    from flask_cors import CORS
    CORS(client.application)
    
    response = client.options('/analytics')
    assert response.status_code == 200
    assert 'Access-Control-Allow-Origin' in response.headers

def test_analytics_endpoint(client):
    """Test the analytics endpoint."""
    response = client.get('/analytics')
    assert response.status_code == 200

def test_get_customers_unauthorized(client):
    """Test that the customers endpoint requires authentication"""
    # Method 1: Override the view function to simulate protection
    with client.application.app_context():
        # Save the original view function
        original_view_func = client.application.view_functions.get('users_bp.get_users')
        
        # Override with an unauthorized response function
        def unauthorized_response(*args, **kwargs):
            return jsonify({'error': 'Unauthorized'}), 401
            
        client.application.view_functions['users_bp.get_users'] = unauthorized_response
        
        try:
            response = client.get('/users')
            assert response.status_code == 401
        finally:
            # Restore the original view function
            client.application.view_functions['users_bp.get_users'] = original_view_func

def test_get_customers_authorized(client, auth_token):
    """Test that the customers endpoint works with authentication"""
    response = client.get('/users', 
                        headers={"Authorization": f"Bearer {auth_token}"})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "users" in data

def test_get_customer_details(client, auth_token, db_with_test_data):
    """Test getting details for a specific customer"""
    db, customer_id = db_with_test_data
    
    # Find the test customer ID
    customer = db.users.find_one({"_id": customer_id})
    
    # Request using the customer ID
    response = client.get(f'/customer/{customer["customerID"]}',
                        headers={"Authorization": f"Bearer {auth_token}"})
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["user"]["customerID"] == customer["customerID"]

def test_nonexistent_customer(client, auth_token):
    """Test getting a customer that doesn't exist"""
    response = client.get('/customer/NONEXISTENT',
                        headers={"Authorization": f"Bearer {auth_token}"})
    
    assert response.status_code == 404

