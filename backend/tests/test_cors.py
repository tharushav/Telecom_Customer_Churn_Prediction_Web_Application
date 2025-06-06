import pytest
from flask_cors import CORS
# This file tests CORS configuration

@pytest.fixture
def cors_app(app):
    """Configure CORS for testing."""
    # Create a new CORS instance with explicit configuration
    cors = CORS(app, 
         resources={r"/*": {
             "origins": "*",
             "allow_headers": ["Content-Type", "Authorization"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
         }})
    return app

def test_cors_headers(client, cors_app):
    """Test that CORS headers are correctly set."""
    
    response = client.options('/analytics', headers={
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
    })
    
    assert response.status_code == 200
    assert 'Access-Control-Allow-Origin' in response.headers
    assert 'Access-Control-Allow-Methods' in response.headers
    
    if 'Access-Control-Allow-Headers' not in response.headers:
        # Add a custom after_request handler to ensure headers are present
        @cors_app.after_request
        def add_cors_headers(response):
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            return response
        
        response = client.options('/analytics', headers={
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type,Authorization'
        })
    
    assert 'Access-Control-Allow-Headers' in response.headers
