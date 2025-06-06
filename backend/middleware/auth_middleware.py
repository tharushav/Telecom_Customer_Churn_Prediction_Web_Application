from functools import wraps
from flask import jsonify, request
import jwt
import os
from db import get_db

# Implement Role based access control as middleware
def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            
            # Get token from header
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    
            if not token:
                return jsonify({'error': 'Authorization token is missing'}), 401
                
            try:
                # Decode token
                data = jwt.decode(token, os.environ.get('JWT_SECRET_KEY'), algorithms=["HS256"])
                
                # Check if user has required role
                if data['role'] not in allowed_roles:
                    return jsonify({'error': 'Insufficient permissions'}), 403
                    
                # Get user from database
                db_connection = get_db()
                admin_collection = db_connection.admin_users
                current_user = admin_collection.find_one({"username": data['username']})
                
                if not current_user:
                    return jsonify({'error': 'User not found'}), 401
                    
                # Double check role in database
                if current_user['role'] not in allowed_roles:
                    return jsonify({'error': 'Insufficient permissions'}), 403
                    
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401
                
            # Add current user to kwargs
            kwargs['current_user'] = current_user
            return f(*args, **kwargs)
                
        return decorated
    return decorator

# Example usage:
# role_required - ['admin']  Only admin can access
# role_required - ['admin', 'editor']  Admin and editor can access
# role_required - ['admin', 'editor', 'viewer']  All roles can access
