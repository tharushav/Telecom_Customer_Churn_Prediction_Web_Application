import os
import pymongo
from dotenv import load_dotenv
from flask import g
# This file managaes database connectivity using mongoDB

# Load environment variables
load_dotenv()

# Get MongoDB connection string from environment variables
mongo_uri = os.environ.get("MONGO_URI")

if not mongo_uri:
    raise ValueError("No MONGO_URI environment variable set.")

# Function to get the MongoDB connection
def get_db():
    if 'db' not in g:
        client = pymongo.MongoClient(mongo_uri)
        g.db = client.churn_database 
    return g.db

# Function to close the MongoDB connection
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        pass
