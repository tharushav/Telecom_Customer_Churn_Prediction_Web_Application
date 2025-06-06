from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db
import jwt
import datetime
import os
from functools import wraps

auth_bp = Blueprint('auth_bp', __name__)
# This file implements authentication and user management functionality
# Token required decorator for protected routes
def token_required(f):
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
            
            # Get user from database
            db_connection = get_db()
            admin_collection = db_connection.admin_users
            current_user = admin_collection.find_one({"username": data['username']})
            
            if not current_user:
                return jsonify({'error': 'Invalid token. User not found'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired. Please login again'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token. Please login again'}), 401
            
        # Add current user to kwargs
        kwargs['current_user'] = current_user
        return f(*args, **kwargs)
            
    return decorated

@auth_bp.route('/register', methods=['POST'])
@token_required
def register(current_user):
    """Register a new user to the system (protected for admin users only)"""
    # Check if user has admin role
    if current_user['role'] != 'admin':
        return jsonify({'error': 'Only administrators can register new users'}), 403
        
    data = request.json
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
        
    # Get MongoDB connection
    db_connection = get_db()
    admin_collection = db_connection.admin_users
    
    # Check if user already exists
    if admin_collection.find_one({"username": data['username']}):
        return jsonify({'error': 'User already exists'}), 409
        
    # Hash password
    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    
    # Create new user
    new_user = {
        "username": data['username'],
        "password": hashed_password,
        "role": data.get('role', 'viewer'),  # Default to viewer role
        "email": data.get('email', ''), # Optional
        "created_at": datetime.datetime.now()
    }
    
    # Insert user into database
    admin_collection.insert_one(new_user)
    
    return jsonify({'message': 'User created successfully'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate a user and return JWT token(User login)"""
    auth = request.json
    
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
        
    # Get MongoDB connection
    db_connection = get_db()
    admin_collection = db_connection.admin_users
    
    # Find user
    user = admin_collection.find_one({"username": auth['username']})
    
    if not user or not check_password_hash(user['password'], auth['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    # Generate JWT token
    token_payload = {
        'username': user['username'],
        'role': user['role'],
        'exp': datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=24) # Expire in 24 hours
    }
    
    token = jwt.encode(token_payload, os.environ.get('JWT_SECRET_KEY'), algorithm="HS256")
    
    # Remove password before returning user
    user_data = {k: v for k, v in user.items() if k != 'password' and k != '_id'}
    
    return jsonify({
        'token': token,
        'user': user_data
    })

@auth_bp.route('/verify-token', methods=['GET'])
@token_required
def verify_token(current_user):
    """Verify token and return user info"""
    # Remove _id from current_user before sending
    user_data = {k: v for k, v in current_user.items() if k != 'password' and k != '_id'}
    return jsonify({'valid': True, 'user': user_data})

@auth_bp.route('/users', methods=['GET'])
@token_required
def get_all_users(current_user):
    """Get all users in the system (accessible for admin role only)"""
    # Check if user has admin role
    if current_user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized access'}), 403
        
    # Get MongoDB connection
    db_connection = get_db()
    admin_collection = db_connection.admin_users
    
    users = []
    for user in admin_collection.find():
        user_data = {
            'username': user['username'],
            'role': user['role'],
            'email': user.get('email', ''),
            'created_at': user.get('created_at')
        }
        users.append(user_data)
        
    return jsonify({'users': users})

@auth_bp.route('/users/<username>', methods=['PUT'])
@token_required
def update_user(current_user, username):
    """Update an existing user in the system (admin role only)"""
    # Check if user has admin role
    if current_user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized access'}), 403
        
    data = request.json
    
    # Get MongoDB connection
    db_connection = get_db()
    admin_collection = db_connection.admin_users
    
    # Find user
    user = admin_collection.find_one({"username": username})
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Prepare update data
    update_data = {}
    
    if 'email' in data:
        update_data['email'] = data['email']
        
    if 'role' in data:
        # Check if trying to update the last admin and avoid that
        if user['role'] == 'admin' and data['role'] != 'admin':
            admin_count = admin_collection.count_documents({"role": "admin"})
            if admin_count <= 1:
                return jsonify({'error': 'Cannot change role of the last admin user'}), 400
        update_data['role'] = data['role']
        
    if 'password' in data and data['password']:
        update_data['password'] = generate_password_hash(data['password'], method='pbkdf2:sha256')
    
    # Update user if there are changes
    if update_data:
        admin_collection.update_one({"username": username}, {"$set": update_data})
    
    return jsonify({'message': 'User updated successfully'})

@auth_bp.route('/users/<username>', methods=['DELETE'])
@token_required
def delete_user(current_user, username):
    """Delete an user from the system (admin role only)"""
    # Check if user has admin role
    if current_user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized access'}), 403
        
    # Prevent self deletion
    if current_user['username'] == username:
        return jsonify({'error': 'Cannot delete your own account'}), 400
        
    # Get MongoDB connection
    db_connection = get_db()
    admin_collection = db_connection.admin_users
    
    # Find user
    user = admin_collection.find_one({"username": username})
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Check if trying to delete the last admin and avoid that
    if user['role'] == 'admin':
        admin_count = admin_collection.count_documents({"role": "admin"})
        if admin_count <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400
    
    # Delete user
    admin_collection.delete_one({"username": username})
    
    return jsonify({'message': 'User deleted successfully'})
