"""
This file contains the MongoDB model interfaces for this application.
And collections and helper functions to interact with the database.
This works as the data acess layer
"""
from bson.objectid import ObjectId
from db import get_db

# User collection wrapper classes (Clean resusable methods)
# All the essential CRUD operations for user data are defined here
class UserCollection:
    @staticmethod
    def get_collection():
        # Get users collection from the database
        db = get_db()
        return db.users

    @staticmethod
    def find_all(query=None, limit=None):
        """Get all users with optional filtering"""
        collection = UserCollection.get_collection()
        if query is None:
            query = {}
        cursor = collection.find(query)
        if limit:
            cursor = cursor.limit(limit)
        return list(cursor)

    @staticmethod
    def find_one(query):
        """Find a single user by query"""
        collection = UserCollection.get_collection()
        return collection.find_one(query)

    @staticmethod
    def find_by_id(customer_id):
        """Find user by customer ID"""
        collection = UserCollection.get_collection()
        return collection.find_one({"customerID": customer_id})

    @staticmethod
    def insert(user_data):
        """Insert a new user"""
        collection = UserCollection.get_collection()
        result = collection.insert_one(user_data)
        return result.inserted_id

    @staticmethod
    def update(customer_id, update_data):
        """Update an existing user"""
        collection = UserCollection.get_collection()
        result = collection.update_one(
            {"customerID": customer_id}, 
            {"$set": update_data}
        )
        return result.modified_count > 0

    @staticmethod
    def delete(customer_id):
        """Delete a user"""
        collection = UserCollection.get_collection()
        result = collection.delete_one({"customerID": customer_id})
        return result.deleted_count > 0
        
    @staticmethod
    def count(query=None):
        """Count documents in the collection"""
        collection = UserCollection.get_collection()
        if query is None:
            query = {}
        return collection.count_documents(query)
    
    
# Provide ORM style interface (For more intutive queries)- when using SQLite
class User:
    # Collection reference
    collection = UserCollection
    
    @classmethod
    def query(cls):
        return QueryWrapper(cls)

class QueryWrapper:
    def __init__(self, cls):
        self.cls = cls
        self.filters = {}
        
    def filter(self, condition):
        if hasattr(condition, 'left') and hasattr(condition, 'right'):
            field = condition.left.key
            value = condition.right.value
            
            self.filters[field] = value
        return self
        
    def first(self):
        # Find the first matching document
        result = UserCollection.find_one(self.filters)
        if not result:
            return None
        return result
        
    def all(self):
        # Find all matching documents
        return UserCollection.find_all(self.filters)
        
    def count(self):
        # Count matching documents
        return UserCollection.count(self.filters)

# Mock db object for compatibility (Used with SQLalchemy)
class MockDB:
    def init_app(self, app):
        pass
        
    def create_all(self):
        pass
        
    def session(self):
        return MockSession()

class MockSession:
    def add(self, obj):
        pass
        
    def delete(self, obj):
        pass
        
    def commit(self):
        pass
        
    def rollback(self):
        pass
        
    def query(self, cls):
        return QueryWrapper(cls)

# Create a mock db object for compatibility
db = MockDB()
