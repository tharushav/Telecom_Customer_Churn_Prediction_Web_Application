from flask import Blueprint, jsonify, request, Response
from db import get_db
from datetime import datetime, timedelta
import json
import csv
import io
from bson import json_util

historical_analytics_bp = Blueprint('historical_analytics_bp', __name__)

@historical_analytics_bp.route('/historical-analytics', methods=['GET'])
def get_historical_analytics():
    """ This endpoint reterieves paginated historical analytical data"""
    try:
        db_connection = get_db()
        historical_collection = db_connection.historical_analytics
        
        # Handle date range filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = {}
        if start_date and end_date:
            # Convert string dates to datetime objects
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            end = end + timedelta(days=1)  # Include end date
            
            query = {
                "timestamp": {
                    "$gte": start,
                    "$lt": end
                }
            }
        
        # Get paginated results
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        skip = (page - 1) * per_page
        
        # Get total count for pagination
        total_records = historical_collection.count_documents(query)
        
        # Get records with pagination
        records = list(historical_collection.find(query).sort("timestamp", -1).skip(skip).limit(per_page))
        
        # Parse MongoDB ObjectId to string for JSON serialization
        for record in records:
            record['_id'] = str(record['_id'])
            # Format timestamp for display
            record['date'] = record['timestamp'].strftime('%Y-%m-%d')
            record['time'] = record['timestamp'].strftime('%H:%M:%S')
        
        return jsonify({
            "records": records,
            "total": total_records,
            "page": page,
            "pages": (total_records + per_page - 1) // per_page
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@historical_analytics_bp.route('/historical-analytics/csv', methods=['GET'])
def download_historical_analytics_csv():
    """ This endpoint helps to export these historical analytics data as a csv file"""
    try:
        db_connection = get_db()
        historical_collection = db_connection.historical_analytics
        
        def format_number(value):
            try:
                # Check if it's a numeric value that needs formatting
                if isinstance(value, (int, float)):
                    # Format floats to 2 decimal places, leave integers as is
                    if isinstance(value, float):
                        return round(value, 2)
                return value
            except:
                return value
        
        # Handle date range filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = {}
        if start_date and end_date:
            # Convert string dates to datetime objects
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            end = end + timedelta(days=1)  # Include end date
            
            query = {
                "timestamp": {
                    "$gte": start,
                    "$lt": end
                }
            }
        
        # Get all records for the specified date range
        records = list(historical_collection.find(query).sort("timestamp", -1))
        
        if not records:
            return jsonify({"error": "No records found for the specified date range"}), 404
        
        # Create CSV file
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header row
        example_record = records[0]
        headers = ["Date", "Time"]
        
        # Add headers for churn distribution
        headers.extend(["Churn Percentage", "Active Percentage"])
        
        # Add headers for payment methods
        for method in example_record.get('data', {}).get('churn_by_payment_method', {}):
            headers.append(f"Payment Method - {method}")
        
        # Add headers for contracts
        for contract in example_record.get('data', {}).get('churn_by_contract', {}):
            headers.append(f"Contract - {contract}")
        
        # Add headers for tenure groups
        for group in example_record.get('data', {}).get('churn_by_tenure_group', {}):
            headers.append(f"Tenure Group - {group}")
            
        # Add customer segment headers
        headers.append("Total Customers")
        for segment in example_record.get('data', {}).get('customer_counts', {}).get('segments', {}):
            headers.append(f"Segment - {segment}")
            
        # Add revenue headers
        headers.append("Monthly Revenue")
        headers.append("Total Revenue")
        
        writer.writerow(headers)
        
        # Write data rows
        for record in records:
            row = [
                record['timestamp'].strftime('%Y-%m-%d'),
                record['timestamp'].strftime('%H:%M:%S')
            ]
            
            # Add churn distribution data
            churn_dist = record.get('data', {}).get('churn_distribution', {})
            row.extend([
                format_number(churn_dist.get('churned', 0)),
                format_number(churn_dist.get('notChurned', 0))
            ])
            
            # Add payment method data
            payment_methods = record.get('data', {}).get('churn_by_payment_method', {})
            for method in example_record.get('data', {}).get('churn_by_payment_method', {}):
                row.append(format_number(payment_methods.get(method, 0)))
            
            # Add contract data
            contracts = record.get('data', {}).get('churn_by_contract', {})
            for contract in example_record.get('data', {}).get('churn_by_contract', {}):
                row.append(format_number(contracts.get(contract, 0)))
            
            # Add tenure group data
            tenure_groups = record.get('data', {}).get('churn_by_tenure_group', {})
            for group in example_record.get('data', {}).get('churn_by_tenure_group', {}):
                row.append(format_number(tenure_groups.get(group, 0)))
                
            # Add customer counts data
            customer_counts = record.get('data', {}).get('customer_counts', {})
            row.append(customer_counts.get('total', 0))
            
            segments = customer_counts.get('segments', {})
            for segment in example_record.get('data', {}).get('customer_counts', {}).get('segments', {}):
                row.append(segments.get(segment, 0))
                
            # Add revenue data
            revenue = record.get('data', {}).get('revenue', {})
            row.append(format_number(revenue.get('monthly', 0)))
            row.append(format_number(revenue.get('total', 0)))
            
            writer.writerow(row)
        
        # Set up response headers for CSV download
        date_suffix = ""
        if start_date and end_date:
            date_suffix = f"_{start_date}_to_{end_date}"
        
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=churn_analytics{date_suffix}.csv"}
        )
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
