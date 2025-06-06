from flask import Blueprint, jsonify, request
from db import get_db
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import pickle

customer_bp = Blueprint('customer_bp', __name__)

# Load the trained pipeline model for churn prediction
try:
    pipeline = pickle.load(open("stacking_pipeline_model.pkl", "rb"))
    print("Pipeline model loaded successfully")
except Exception as e:
    print(f"Error loading pipeline model: {e}")
    # Fallback to older model if pipeline model isn't available
    try:
        pipeline = pickle.load(open("stacking_classifier_model.pkl", "rb"))
        print("Fallback to classifier model")
    except:
        pipeline = None
        print("No prediction model available")

# Keep the function for backward compatibility
def calculate_join_date(tenure_months):
    today = datetime.now()
    join_date = today - timedelta(days=tenure_months * 30)  # Assume approximate month as 30 days
    return join_date.strftime('%Y-%m-%d')

@customer_bp.route('/customer/<customer_id>', methods=['GET'])
def get_customer_details(customer_id):
    """Fetches details of a specific customer by customer ID"""
    # Get MongoDB connection
    db_connection = get_db()
    users_collection = db_connection.users
    
    # Find the user by customer ID - select only needed fields
    user = users_collection.find_one(
        {"customerID": customer_id},
        projection={
            "customerID": 1,
            "gender": 1,
            "SeniorCitizen": 1,
            "Partner": 1,
            "Dependents": 1,
            "tenure": 1,
            "PhoneService": 1,
            "MultipleLines": 1,
            "InternetService": 1,
            "OnlineSecurity": 1,
            "OnlineBackup": 1,
            "DeviceProtection": 1,
            "TechSupport": 1,
            "StreamingTV": 1,
            "StreamingMovies": 1,
            "Contract": 1,
            "PaperlessBilling": 1,
            "PaymentMethod": 1,
            "MonthlyCharges": 1,
            "TotalCharges": 1,
            "Churn": 1,
            "_id": 0  # Explicitly exclude _id
        }
    )
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Make sure tenure exists, use 0 as default if missing
    if 'tenure' not in user:
        user['tenure'] = 0

    # Add joinDate field for UI
    if 'join_date' not in user or not user['join_date']:
        user["joinDate"] = calculate_join_date(user['tenure'])
    else:
        user["joinDate"] = user['join_date']

    # Calculate churn probability using the pipeline model
    if pipeline:
        try:
            # Create a DataFrame with just the features needed for prediction
            features_for_model = [
                "gender", "SeniorCitizen", "Partner", "Dependents", "tenure",
                "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity",
                "OnlineBackup", "DeviceProtection", "TechSupport", "StreamingTV",
                "StreamingMovies", "Contract", "PaperlessBilling", "PaymentMethod",
                "MonthlyCharges", "TotalCharges"
            ]
            
            # Create a DataFrame with feature names
            model_features_df = pd.DataFrame([{k: user.get(k, 0) for k in features_for_model}])
            
            # Use the pipeline to predict - it handles all preprocessing steps
            churn_probability = pipeline.predict_proba(model_features_df)[0][1]
        except Exception as e:
            print(f"Error predicting churn: {e}")
            churn_probability = 0.0
    else:
        churn_probability = 0.0

    # Return user details with churn probability
    return jsonify({"user": user, "churn_probability": float(churn_probability*100)})

@customer_bp.route('/customer/<customer_id>', methods=['PUT'])
def update_customer_details(customer_id):
    """Update details of a specific customer"""
    # Get MongoDB connection
    db_connection = get_db()
    users_collection = db_connection.users
    
    # Find the user by customer ID
    user = users_collection.find_one({"customerID": customer_id})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Get the request data
    data = request.get_json()
    print(f"Received update data for customer {customer_id}: {data}")
    
    # If joinDate is provided in the request, use that
    if 'joinDate' in data:
        data['join_date'] = data['joinDate']
    # If tenure is updated but no joinDate provided, recalculate join_date
    elif 'tenure' in data:
        data['join_date'] = calculate_join_date(data['tenure'])
    
    # Update the user in MongoDB
    try:
        result = users_collection.update_one(
            {"customerID": customer_id},
            {"$set": data}
        )
        
        if result.modified_count == 0:
            return jsonify({"message": "No changes made to the user"}), 200
            
        # Get the updated user
        updated_user = users_collection.find_one({"customerID": customer_id})
        if updated_user:
            # Remove MongoDB's _id field
            updated_user.pop('_id', None)
            
            # Calculate join date for response
            join_date = calculate_join_date(updated_user['tenure'])
            updated_user['joinDate'] = join_date
            
            return jsonify({
                "message": "User updated successfully",
                "user": updated_user
            })
        else:
            return jsonify({"error": "Failed to retrieve updated user"}), 500
            
    except Exception as e:
        print(f"Error updating user in MongoDB: {e}")
        return jsonify({"error": str(e)}), 500

@customer_bp.route('/customer/<customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    """Delete a specific customer"""
    # Get MongoDB connection
    db_connection = get_db()
    users_collection = db_connection.users
    
    # Find the user by customer ID
    user = users_collection.find_one({"customerID": customer_id})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    try:
        # Delete the user from MongoDB
        result = users_collection.delete_one({"customerID": customer_id})
        
        if result.deleted_count > 0:
            return jsonify({
                "message": "User deleted successfully",
                "customer_id": customer_id
            })
        else:
            return jsonify({"error": "Failed to delete user"}), 500
            
    except Exception as e:
        print(f"Error deleting user from MongoDB: {e}")
        return jsonify({"error": str(e)}), 500

@customer_bp.route('/customer', methods=['POST'])
def create_customer():
    """Creates a new customer record"""
    data = request.get_json()
    
    if 'joinDate' in data:
        data['join_date'] = data['joinDate']  # Store in database field
        
        # Calculate and add tenure based on joinDate
        try:
            join_date = datetime.strptime(data['joinDate'], '%Y-%m-%d')
            today = datetime.now()
            # Calculate months between join date and today
            tenure = (today.year - join_date.year) * 12 + (today.month - join_date.month)
            data['tenure'] = tenure
        except Exception as e:
            print(f"Error calculating tenure from joinDate: {e}")
            # Provide a default tenure if calculation fails
            data['tenure'] = 0
    
    # Get MongoDB connection
    db_connection = get_db()
    users_collection = db_connection.users
    
    # Check if customer ID already exists
    if 'customerID' in data:
        existing_customer = users_collection.find_one({"customerID": data['customerID']})
        if existing_customer:
            return jsonify({"error": "Customer ID already exists"}), 400
    
    try:
        # Insert the new customer into the database
        result = users_collection.insert_one(data)
        
        if result.inserted_id:
            # Return the customerID in the response
            return jsonify({
                "message": "Customer created successfully",
                "customerID": data['customerID']
            })
        else:
            return jsonify({"error": "Failed to create customer"}), 500
    except Exception as e:
        print(f"Error creating customer in MongoDB: {e}")
        return jsonify({"error": str(e)}), 500