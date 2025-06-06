from flask import Blueprint, jsonify, request
from datetime import datetime
from db import get_db

analytics_bp = Blueprint('analytics_bp', __name__)

@analytics_bp.route('/analytics', methods=['GET'])
def get_churn_analytics():
    """This endpoint returns churn analytics data, optional year filter"""
    try:
        # Get MongoDB connection
        db_connection = get_db()
        users_collection = db_connection.users
        
        # Get the year parameter from the request
        year = request.args.get('year')
        
        # Create base filter
        filter_query = {}
        
        # Add year filter if specified
        if year:
            try:
                # Validate year is a valid integer
                year_int = int(year)
                year_start = f"{year_int}-01-01"
                year_end = f"{year_int}-12-31"
                
                # Filter users based on join date
                filter_query = {
                    "$or": [
                        # For users with join_date field
                        {
                            "join_date": {
                                "$gte": year_start,
                                "$lte": year_end
                            }
                        },
                        # For users with joinDate field
                        {
                            "joinDate": {
                                "$gte": year_start,
                                "$lte": year_end
                            }
                        }
                    ]
                }
            except ValueError:
                return jsonify({"error": f"Invalid year format: {year}"}), 400
        
        # Count the total number of users with filter
        total_users = users_collection.count_documents(filter_query)
        
        # If no users match the filter, return with zeros
        if total_users == 0:
            return jsonify({
                "total_customers": 0,
                "monthly_revenue": 0,
                "total_revenue": 0,
                "churn_distribution": {"churned": 0, "notChurned": 100},
                "churn_by_payment_method": {},
                "churn_by_contract": {},
                "churn_by_tenure_group": {},
                "filtered_year": year if year else "All"
            })
        
        # Count the number of churned users
        churn_query = filter_query.copy()
        churn_query["Churn"] = "Yes"
        churned_users = users_collection.count_documents(churn_query)
        
        # Calculate the percentage of churned users
        churn_percentage = (churned_users / total_users) if total_users > 0 else 0
        
        # Calculate the percentage of non-churned users
        not_churned_percentage = 1 - churn_percentage
        
        # Find churn rate by payment method
        payment_methods = users_collection.distinct("PaymentMethod")
        churn_by_payment_method = {}
        for method in payment_methods:
            method_query = filter_query.copy()
            method_query["PaymentMethod"] = method
            total_by_method = users_collection.count_documents(method_query)
            
            method_churn_query = method_query.copy()
            method_churn_query["Churn"] = "Yes"
            churned_by_method = users_collection.count_documents(method_churn_query)
            
            churn_by_payment_method[method] = (churned_by_method / total_by_method * 100) if total_by_method > 0 else 0
        
        # Find churn rate by contract
        contracts = users_collection.distinct("Contract")
        churn_by_contract = {}
        for contract in contracts:
            contract_query = filter_query.copy()
            contract_query["Contract"] = contract
            total_by_contract = users_collection.count_documents(contract_query)
            
            contract_churn_query = contract_query.copy()
            contract_churn_query["Churn"] = "Yes"
            churned_by_contract = users_collection.count_documents(contract_churn_query)
            
            churn_by_contract[contract] = (churned_by_contract / total_by_contract * 100) if total_by_contract > 0 else 0
        
        # Find churn rate by tenure group
        tenure_groups = {
            '0-12': {"$gte": 0, "$lte": 12},
            '13-24': {"$gt": 12, "$lte": 24},
            '25-36': {"$gt": 24, "$lte": 36},
            '37-48': {"$gt": 36, "$lte": 48},
            '49+': {"$gt": 48}
        }
        churn_by_tenure_group = {}
        for group, tenure_range in tenure_groups.items():
            tenure_query = filter_query.copy()
            tenure_query["tenure"] = tenure_range
            total_by_group = users_collection.count_documents(tenure_query)
            
            tenure_churn_query = tenure_query.copy()
            tenure_churn_query["Churn"] = "Yes"
            churned_by_group = users_collection.count_documents(tenure_churn_query)
            
            churn_by_tenure_group[group] = (churned_by_group / total_by_group * 100) if total_by_group > 0 else 0
            
        # Calculate revenue metrics based on the filtered users
        # Use the filter_query to get only users matching the year filter
        filtered_users = users_collection.find(filter_query, {"MonthlyCharges": 1, "TotalCharges": 1})
        
        # Calculate revenue metrics
        monthly_revenue = 0
        total_revenue = 0
        
        for user in filtered_users:
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
                print(f"Error processing charges: {e}")
        
        # Prepare data for the frontend
        analytics_data = {
            "total_customers": total_users,
            "monthly_revenue": monthly_revenue,
            "total_revenue": total_revenue,
            "churn_distribution": {
                "churned": churn_percentage * 100,  
                "notChurned": not_churned_percentage * 100  
            },
            "churn_by_payment_method": churn_by_payment_method,
            "churn_by_contract": churn_by_contract,
            "churn_by_tenure_group": churn_by_tenure_group,
            "filtered_year": year if year else "All"
        }
        
        return jsonify(analytics_data)
    except Exception as e:
        print(f"Error generating analytics: {e}")
        return jsonify({"error": str(e)}), 500