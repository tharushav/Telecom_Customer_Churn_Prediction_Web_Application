import json
import pytest
from datetime import datetime
# This file tests complete workflow across multiple API calls

@pytest.fixture
def authenticated_client(client, setup_test_user):
    """Fixture providing an authenticated client."""
    response = client.post('/auth/login', json={
        "username": "testuser",
        "password": "testpassword"
    })
    data = json.loads(response.data)
    token = data["token"]
    
    # Return tuple of client and token
    return client, token

def test_create_and_retrieve_customer(authenticated_client, app):
    """Test the full flow of creating and retrieving a customer."""
    client, token = authenticated_client
    
    # Create a new customer
    new_customer = {
        "customerID": f"TEST-{datetime.now().timestamp()}",
        "gender": "Female",
        "SeniorCitizen": 0, 
        "Partner": "No",
        "Dependents": "No",
        "tenure": 6,
        "PhoneService": "Yes",
        "MultipleLines": "No",
        "InternetService": "Fiber optic",
        "OnlineSecurity": "No",
        "OnlineBackup": "Yes",
        "DeviceProtection": "No",
        "TechSupport": "No",
        "StreamingTV": "Yes",
        "StreamingMovies": "Yes",
        "Contract": "Month-to-month",
        "PaperlessBilling": "Yes",
        "PaymentMethod": "Electronic check",
        "MonthlyCharges": 85.45,
        "TotalCharges": 512.7,
        "Churn": "No"
    }
    
    # Create the customer
    response = client.post(
        '/customer',
        json=new_customer,
        headers={"Authorization": f"Bearer {token}"}
    )
    # Check if customer creation was sucessful
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "message" in data or "success" in data or "customerID" in data
    
    # Now retrieve the customer
    customer_id = new_customer["customerID"]
    response = client.get(
        f'/customer/{customer_id}',
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "user" in data
    assert data["user"]["customerID"] == customer_id
    assert data["user"]["gender"] == "Female"
    assert data["user"]["tenure"] == 6
    
    # Clean up
    with app.app_context():
        from db import get_db
        db = get_db()
        db.users.delete_one({"customerID": customer_id})

def test_update_and_delete_customer(authenticated_client, app):
    """Test the full flow of updating and then deleting a customer."""
    client, token = authenticated_client
    
    # First create a customer to work with - Add all required fields
    customer_id = f"TEST-UPDATE-{datetime.now().timestamp()}"
    
    with app.app_context():
        from db import get_db
        db = get_db()
        db.users.insert_one({
            "customerID": customer_id,
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
            "DeviceProtection": "No",   
            "TechSupport": "No",        
            "StreamingTV": "No",        
            "StreamingMovies": "No",    
            "Contract": "Month-to-month", 
            "PaperlessBilling": "Yes",  
            "PaymentMethod": "Electronic check", 
            "MonthlyCharges": 50.00,
            "TotalCharges": 600.00,     
            "Churn": "No"
        })
    
    # Update the customer
    update_data = {
        "MonthlyCharges": 60.00,
        "Churn": "Yes"
    }
    
    response = client.put(
        f'/customer/{customer_id}',
        json=update_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    
    # Verify the update
    response = client.get(
        f'/customer/{customer_id}',
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["user"]["MonthlyCharges"] == 60.00
    assert data["user"]["Churn"] == "Yes"
    
    # Delete the customer
    response = client.delete(
        f'/customer/{customer_id}',
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    
    # Verify deletion
    response = client.get(
        f'/customer/{customer_id}',
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 404

