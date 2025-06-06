import pytest
from unittest.mock import patch, MagicMock
import pymongo
from bson.objectid import ObjectId
# This file tests database connectivity and operations

def test_get_db_connection(app):
    """Test that database connection can be established."""
    with app.app_context():
        from db import get_db
        db = get_db()
        assert db is not None

@patch('pymongo.MongoClient')
def test_get_db_mock(mock_client, app):
    """Test database connection using mocks."""
    mock_db = MagicMock()
    mock_client.return_value.churn_database = mock_db
    
    with app.app_context():
        from db import get_db
        db = get_db()
        assert db is mock_db

@pytest.fixture
def db_with_test_data(app):
    """Fixture to set up and tear down test data"""
    with app.app_context():
        from db import get_db
        db = get_db()
        
        # Create test customer
        customer = {
            "CustomerID": "TEST-1001",
            "gender": "Male",
            "SeniorCitizen": 0,
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 12,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "DSL",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "No",
            "DeviceProtection": "Yes",
            "TechSupport": "No",
            "StreamingTV": "Yes",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 65.4,
            "TotalCharges": 784.8,
            "Churn": "No",
            "joinDate": "2022-01-01"
        }
        
        # Clear existing test data
        db.customers.delete_many({"CustomerID": "TEST-1001"})
        
        # Insert test data
        result = db.customers.insert_one(customer)
        customer_id = result.inserted_id
        
        yield db, customer_id
        
        # Cleanup
        db.customers.delete_many({"CustomerID": "TEST-1001"})

def test_customer_create_read(db_with_test_data):
    """Test creating and reading a customer record"""
    db, customer_id = db_with_test_data
    
    # Read the customer
    customer = db.customers.find_one({"_id": customer_id})
    
    assert customer is not None
    assert customer["CustomerID"] == "TEST-1001"
    assert customer["gender"] == "Male"
    assert customer["tenure"] == 12
    assert customer["MonthlyCharges"] == 65.4

def test_customer_update(db_with_test_data):
    """Test updating a customer record"""
    db, customer_id = db_with_test_data
    
    # Update the customer
    db.customers.update_one(
        {"_id": customer_id},
        {"$set": {"MonthlyCharges": 70.5, "Churn": "Yes"}}
    )
    
    # Read the customer back
    customer = db.customers.find_one({"_id": customer_id})
    
    assert customer["MonthlyCharges"] == 70.5
    assert customer["Churn"] == "Yes"

def test_customer_delete(db_with_test_data):
    """Test deleting a customer record"""
    db, customer_id = db_with_test_data
    
    # Delete the customer
    db.customers.delete_one({"_id": customer_id})
    
    # Try to read the customer back
    customer = db.customers.find_one({"_id": customer_id})
    assert customer is None

def test_db_query_filter(db_with_test_data):
    """Test database query filtering capabilities"""
    db, _ = db_with_test_data
    
    # Find customers with DSL internet service
    dsl_customers = list(db.customers.find({"InternetService": "DSL"}))
    assert len(dsl_customers) >= 1
    
    # Find customers with no tech support
    no_tech_support = list(db.customers.find({"TechSupport": "No"}))
    assert len(no_tech_support) >= 1
    
    # Find non-existent customers
    non_existent = list(db.customers.find({"CustomerID": "NON-EXISTENT"}))
    assert len(non_existent) == 0

@pytest.mark.parametrize(
    "customer_data,expected_error", [
        ({"CustomerID": "TEST-1002"}, None),  
        ({"CustomerID": None}, pymongo.errors.WriteError),  
    ]
)
def test_data_validation(app, customer_data, expected_error):
    """Test data validation when inserting documents"""
    with app.app_context():
        from db import get_db
        db = get_db()
        
        # Setup schema validation for this test
        try:
            # Create or update the collection with schema validation
            db.command({
                "collMod": "customers",
                "validator": {
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["CustomerID"],
                        "properties": {
                            "CustomerID": {
                                "bsonType": "string",
                                "description": "must be a string and is required"
                            }
                        }
                    }
                },
                "validationLevel": "strict"
            })
        except pymongo.errors.OperationFailure:
            # If collection doesn't exist yet, create it with validation
            db.create_collection(
                "customers", 
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["CustomerID"],
                        "properties": {
                            "CustomerID": {
                                "bsonType": "string",
                                "description": "must be a string and is required"
                            }
                        }
                    }
                }
            )
        
        # Clean up any existing test data
        if "CustomerID" in customer_data and customer_data["CustomerID"]:
            db.customers.delete_many({"CustomerID": customer_data["CustomerID"]})
        
        # Test inserting the data
        if expected_error:
            with pytest.raises(expected_error):
                db.customers.insert_one(customer_data)
        else:
            result = db.customers.insert_one(customer_data)
            assert result.inserted_id is not None
            
            # Clean up
            db.customers.delete_one({"_id": result.inserted_id})
