import pymongo
import os
from dotenv import load_dotenv
import time
# This script optimizes database performance by creating mongoDB indexes (7 different indexes)
# Improve query performance for frequently accessed fields

# Load environment variables
load_dotenv()

# Get MongoDB connection string
mongo_uri = os.environ.get("MONGO_URI")
if not mongo_uri:
    raise ValueError("No MONGO_URI found in environment variables")

def create_indexes():
    print("Creating database indexes...")
    start_time = time.time()
    
    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client.churn_database
    users_collection = db.users
    
    # Create indexes for frequently queried fields
    index_results = []
    
    # Primary key index
    index_results.append(
        users_collection.create_index([("customerID", pymongo.ASCENDING)], unique=True)
    )
    
    # Churn status index - frequently used for filtering
    index_results.append(
        users_collection.create_index([("Churn", pymongo.ASCENDING)])
    )
    
    # MonthlyCharges index - used for high value customer segmentation
    index_results.append(
        users_collection.create_index([("MonthlyCharges", pymongo.ASCENDING)])
    )
    
    # Tenure index - used for customer tenure segmentation
    index_results.append(
        users_collection.create_index([("tenure", pymongo.ASCENDING)])
    )
    
    # Index for mid term segment queries (both tenure and MonthlyCharges)
    index_results.append(
        users_collection.create_index([
            ("tenure", pymongo.ASCENDING),
            ("MonthlyCharges", pymongo.ASCENDING)
        ])
    )
    
    # Index for payment method queries
    index_results.append(
        users_collection.create_index([("PaymentMethod", pymongo.ASCENDING)])
    )
    
    # Index for contract type queries
    index_results.append(
        users_collection.create_index([("Contract", pymongo.ASCENDING)])
    )
    
    print(f"Created {len(index_results)} indexes in {time.time() - start_time:.2f} seconds")
    
    # List all indexes to check if they were created
    print("\nCurrent indexes:")
    for index in users_collection.list_indexes():
        print(f"  - {index['name']}: {index['key']}")
    
    client.close()

if __name__ == "__main__":
    create_indexes()
