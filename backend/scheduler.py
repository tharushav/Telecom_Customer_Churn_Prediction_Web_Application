from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from db import get_db
import requests
import json
import os
import logging
import flask

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

flask_app = None

def capture_daily_analytics():
    """
    Captures the current analytics data and stores it in the historical_analytics collection.
    """
    try:
        logger.info("Starting daily analytics capture...")
        
        # Create an application context
        if not flask_app:
            logger.error("Flask app not initialized in scheduler")
            return
            
        with flask_app.app_context():
            # Get MongoDB connection
            db_connection = get_db()
            historical_collection = db_connection.historical_analytics
            users_collection = db_connection.users
            
            # Get the same analytics data that the dashboard endpoint would return
            total_users = users_collection.count_documents({})
            churned_users = users_collection.count_documents({"Churn": "Yes"})
            
            # Calculate the percentage of churned users
            churn_percentage = (churned_users / total_users) if total_users > 0 else 0
            not_churned_percentage = 1 - churn_percentage
            
            # Churn rate by payment method
            payment_methods = users_collection.distinct("PaymentMethod")
            churn_by_payment_method = {}
            for method in payment_methods:
                total_by_method = users_collection.count_documents({"PaymentMethod": method})
                churned_by_method = users_collection.count_documents({"PaymentMethod": method, "Churn": "Yes"})
                churn_by_payment_method[method] = (churned_by_method / total_by_method * 100) if total_by_method > 0 else 0
            
            # Churn rate by contract
            contracts = users_collection.distinct("Contract")
            churn_by_contract = {}
            for contract in contracts:
                total_by_contract = users_collection.count_documents({"Contract": contract})
                churned_by_contract = users_collection.count_documents({"Contract": contract, "Churn": "Yes"})
                churn_by_contract[contract] = (churned_by_contract / total_by_contract * 100) if total_by_contract > 0 else 0
            
            # Churn rate by tenure group
            tenure_groups = {
                '0-12': {"$gte": 0, "$lte": 12},
                '13-24': {"$gt": 12, "$lte": 24},
                '25-36': {"$gt": 24, "$lte": 36},
                '37-48': {"$gt": 36, "$lte": 48},
                '49+': {"$gt": 48}
            }
            churn_by_tenure_group = {}
            for group, tenure_range in tenure_groups.items():
                total_by_group = users_collection.count_documents({"tenure": tenure_range})
                churned_by_group = users_collection.count_documents({"tenure": tenure_range, "Churn": "Yes"})
                churn_by_tenure_group[group] = (churned_by_group / total_by_group * 100) if total_by_group > 0 else 0
            
            # Capture customer segments
            high_value_customers = users_collection.count_documents({"MonthlyCharges": {"$gt": 75}})
            long_term_customers = users_collection.count_documents({"tenure": {"$gt": 24}})
            new_customers = users_collection.count_documents({"tenure": {"$lt": 3}})
            
            # Mid term customers (tenure between 3-24 AND MonthlyCharges <= 75)
            mid_term_customers = users_collection.count_documents({
                "tenure": {"$gte": 3, "$lte": 24},
                "MonthlyCharges": {"$lte": 75}
            })
            
            # Calculate revenue metrics
            all_users = users_collection.find({}, {"MonthlyCharges": 1, "TotalCharges": 1})
            
            # Calculate total monthly revenue
            monthly_revenue = 0
            total_revenue = 0
            for user in all_users:
                try:
                    # Handle monthly charges
                    if "MonthlyCharges" in user and user["MonthlyCharges"]:
                        monthly_charge = float(user["MonthlyCharges"])
                        monthly_revenue += monthly_charge
                    
                    # Handle total charges
                    if "TotalCharges" in user and user["TotalCharges"]:
                        total_charge_str = user["TotalCharges"]
                        if isinstance(total_charge_str, str) and total_charge_str.strip():
                            total_revenue += float(total_charge_str)
                        elif not isinstance(total_charge_str, str):
                            total_revenue += float(total_charge_str)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error processing charges: {e}")
            
            # Prepare data for storage
            analytics_data = {
                "churn_distribution": {
                    "churned": churn_percentage * 100,
                    "notChurned": not_churned_percentage * 100
                },
                "churn_by_payment_method": churn_by_payment_method,
                "churn_by_contract": churn_by_contract,
                "churn_by_tenure_group": churn_by_tenure_group,
                "customer_counts": {
                    "total": total_users,
                    "segments": {
                        "high_value": high_value_customers,
                        "long_term": long_term_customers,
                        "new": new_customers,
                        "mid_term": mid_term_customers
                    }
                },
                # Add revenue metrics
                "revenue": {
                    "monthly": monthly_revenue,
                    "total": total_revenue
                }
            }
            
            # Create a record with timestamp - capture midnight of current day
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            record = {
                "timestamp": today_start,
                "data": analytics_data
            }
            
            # Check if we already have a record for today to avoid duplicates
            today_end = today_start + timedelta(days=1)
            
            existing_record = historical_collection.find_one({
                "timestamp": {
                    "$gte": today_start,
                    "$lt": today_end
                }
            })
            
            if existing_record:
                # Update existing record
                historical_collection.update_one(
                    {"_id": existing_record["_id"]},
                    {"$set": record}
                )
                logger.info(f"Updated analytics record for {today_start.strftime('%Y-%m-%d')}")
            else:
                # Insert new record
                historical_collection.insert_one(record)
                logger.info(f"Created new analytics record for {today_start.strftime('%Y-%m-%d')}")
            
            # Clean up old records after 90 days
            cutoff_date = datetime.now() - timedelta(days=90)
            delete_result = historical_collection.delete_many({"timestamp": {"$lt": cutoff_date}})
            if delete_result.deleted_count > 0:
                logger.info(f"Cleaned up {delete_result.deleted_count} old records")
                
            logger.info("Daily analytics capture completed successfully")
        
    except Exception as e:
        logger.error(f"Error in daily analytics capture: {e}")

def setup_scheduler(app=None):
    """
    Sets up the APScheduler to run the capture_daily_analytics function daily at midnight
    """
    # Store the Flask app reference globally
    global flask_app
    flask_app = app
    
    scheduler = BackgroundScheduler()
    
    # Run at midnight every day
    scheduler.add_job(
        capture_daily_analytics,
        trigger=CronTrigger(hour=0, minute=0),
        id='daily_analytics_capture',
        name='Capture daily analytics data',
        replace_existing=True
    )
    
    # Also run it immediately at startup to ensure we have today's data
    scheduler.add_job(
        capture_daily_analytics,
        id='startup_analytics_capture',
        name='Initial analytics capture at startup'
    )
    
    # Start the scheduler
    scheduler.start()
    
    logger.info("Scheduler started: Daily analytics capture scheduled at midnight")
    
    return scheduler
