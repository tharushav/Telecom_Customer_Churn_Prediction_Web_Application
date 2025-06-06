import json
import pytest
import jwt
from werkzeug.security import generate_password_hash
from db import get_db
from datetime import datetime, timedelta
# This file tests authentication functionality of the application

@pytest.fixture
def setup_test_user(app):
    """Create a test user for authentication tests."""
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

def test_login_success(client, setup_test_user):
    """Test successful login with correct credentials."""
    response = client.post('/auth/login', json={
        "username": "testuser",
        "password": "testpassword"
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "token" in data
    assert "user" in data
    assert data["user"]["username"] == "testuser"

def test_login_failure_wrong_password(client, setup_test_user):
    """Test failed login with wrong password."""
    response = client.post('/auth/login', json={
        "username": "testuser",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    data = json.loads(response.data)
    assert "error" in data

def test_login_failure_nonexistent_user(client, setup_test_user):
    """Test failed login with nonexistent user."""
    response = client.post('/auth/login', json={
        "username": "nonexistentuser",
        "password": "testpassword"
    })
    assert response.status_code == 401
    data = json.loads(response.data)
    assert "error" in data

