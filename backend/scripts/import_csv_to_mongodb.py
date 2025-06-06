import pandas as pd
import pymongo
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get MongoDB connection string
mongo_uri = os.environ.get("MONGO_URI")
if not mongo_uri:
    raise ValueError("No MONGO_URI found in environment variables")

# Connect to MongoDB
client = pymongo.MongoClient(mongo_uri)
db = client.churn_database
users_collection = db.users

# Read CSV file
csv_path = 'WA_Fn-UseC_-Telco-Customer-Churn 2.csv'
data = pd.read_csv(csv_path)

# Handle any NaN or missing values
data = data.fillna(0)

# Convert decimal fields to proper numeric types
data['MonthlyCharges'] = pd.to_numeric(data['MonthlyCharges'], errors='coerce')
data['TotalCharges'] = pd.to_numeric(data['TotalCharges'], errors='coerce')

# Replace any NaN after conversion with 0
data = data.fillna(0)

# Convert to list of dictionaries for MongoDB insert
records = data.to_dict('records')

# Insert into MongoDB
if records:
    try:
        result = users_collection.insert_many(records)
        print(f"Successfully inserted {len(result.inserted_ids)} records into MongoDB")
    except Exception as e:
        print(f"Error inserting records: {e}")
else:
    print("No records to insert")

# Verify the data was inserted
count = users_collection.count_documents({})
print(f"Total documents in collection: {count}")

# Print a sample record
if count > 0:
    print("\nSample record:")
    print(users_collection.find_one())
