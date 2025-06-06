from flask import Blueprint, jsonify, request
from db import get_db
import re
from datetime import datetime, timedelta
from routes.auth_routes import token_required

users_bp = Blueprint('users_bp', __name__)

# Helper function to calculate join date based on tenure months
def calculate_join_date(tenure_months):
    today = datetime.now()
    join_date = today - timedelta(days=tenure_months * 30)  # Approximate month as 30 days
    return join_date.strftime('%Y-%m-%d')

@users_bp.route('/users', methods=['GET'])
@token_required  # Add this decorator to protect the route
def get_users(current_user):
    """Get all users with optional segment filtering and pagination"""
    try:
        # Get MongoDB connection
        db_connection = get_db()
        users_collection = db_connection.users
        
        # Check if "all" is specified for per_page
        if request.args.get('per_page') == 'all':
            # Skip pagination and return all matching users
            # Build the query
            query = {}
            
            # Check if search query is provided
            search_query = request.args.get('search', '')
            if search_query:
                query["customerID"] = {"$regex": search_query, "$options": "i"}
            
            # Check if segment filter is specified
            segment = request.args.get('segment')
            if segment:
                if segment == 'high-value':
                    query["MonthlyCharges"] = {"$gt": 75}
                elif segment == 'long-term':
                    query["tenure"] = {"$gt": 24}
                elif segment == 'new':
                    query["tenure"] = {"$lt": 3}
                elif segment == 'active':
                    query["Churn"] = "No"
            
            # Get all users matching the query without pagination
            users = list(users_collection.find(query))
            total_count = len(users)
            
            # Remove MongoDB's _id field which isn't JSON serializable
            for user in users:
                user.pop('_id', None)
                
                # Calculate join date only when needed
                if 'tenure' in user and user['tenure'] is not None:
                    user['joinDate'] = calculate_join_date(user['tenure'])
                else:
                    user['joinDate'] = None
            
            return jsonify({
                "users": users,
                "pagination": {
                    "total": total_count,
                    "page": 1,
                    "per_page": total_count,
                    "pages": 1
                }
            })
            
        # Original pagination logic
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        skip = (page - 1) * per_page
        
        # Check if search query is provided
        search_query = request.args.get('search', '')
        
        # Build the query
        query = {}
        
        # Add search to query if provided
        if search_query:
            query["customerID"] = {"$regex": search_query, "$options": "i"}
        
        # Check if segment filter is specified
        segment = request.args.get('segment')
        
        # Apply segment filters if provided
        if segment:
            if segment == 'high-value':
                # Users with monthly charges > 75
                query["MonthlyCharges"] = {"$gt": 75}
            elif segment == 'long-term':
                # Users with tenure > 24 months
                query["tenure"] = {"$gt": 24}
            elif segment == 'new':
                # Users with tenure < 3 months
                query["tenure"] = {"$lt": 3}
            elif segment == 'active':
                # Active customers (not churned)
                query["Churn"] = "No"
        
        # Get total count for pagination info
        total_count = users_collection.count_documents(query)
        
        # Get paginated users matching the query
        users = list(users_collection.find(query).skip(skip).limit(per_page))
        
        # Remove MongoDB's _id field which isn't JSON serializable
        for user in users:
            user.pop('_id', None)
            
            # Calculate join date only when needed
            if 'tenure' in user and user['tenure'] is not None:
                user['joinDate'] = calculate_join_date(user['tenure'])
            else:
                user['joinDate'] = None
        
        return jsonify({
            "users": users,
            "pagination": {
                "total": total_count,
                "page": page,
                "per_page": per_page,
                "pages": (total_count + per_page - 1) // per_page
            }
        })
    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500
