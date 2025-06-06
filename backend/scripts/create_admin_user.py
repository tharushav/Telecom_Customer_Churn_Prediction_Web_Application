import pymongo
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import datetime
import getpass
import sys

# Load environment variables
load_dotenv()

# Get MongoDB connection string
mongo_uri = os.environ.get("MONGO_URI")
if not mongo_uri:
    print("ERROR: No MONGO_URI found in environment variables")
    sys.exit(1)

print("Admin User Creation Script")
print("-----------------------")

# Connect to MongoDB
try:
    client = pymongo.MongoClient(mongo_uri)
    db = client.churn_database
    admin_collection = db.admin_users
except Exception as e:
    print(f"ERROR: Could not connect to MongoDB: {e}")
    sys.exit(1)

# Check if admin users collection exists
if 'admin_users' in db.list_collection_names():
    existing_count = admin_collection.count_documents({})
    print(f"Found {existing_count} existing admin users")

# Get admin details
username = input("Enter admin username: ")

# Check if username already exists
if admin_collection.find_one({"username": username}):
    print(f"ERROR: User '{username}' already exists")
    sys.exit(1)

# Get and confirm password
while True:
    password = getpass.getpass("Enter admin password: ")
    confirm_password = getpass.getpass("Confirm password: ")
    
    if password == confirm_password:
        break
    else:
        print("Passwords don't match. Please try again.")

email = input("Enter admin email (optional): ")

# Hash the password
hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

# Create admin user document
admin_user = {
    "username": username,
    "password": hashed_password,
    "role": "admin",
    "email": email,
    "created_at": datetime.datetime.now()
}

# Insert into database
try:
    result = admin_collection.insert_one(admin_user)
    print(f"Admin user '{username}' created successfully with role 'admin'")
except Exception as e:
    print(f"ERROR: Failed to create admin user: {e}")
    sys.exit(1)
