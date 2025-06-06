from flask import Flask, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from routes.customer_routes import customer_bp
from routes.analytics_routes import analytics_bp
from routes.users_routes import users_bp
from routes.survival_routes import survival_bp
from routes.auth_routes import auth_bp
from routes.historical_analytics_routes import historical_analytics_bp
from db import close_db
from scheduler import setup_scheduler
import atexit
from create_indexes import create_indexes

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app,
         resources={r"/*": {"origins": ["https://churn-analytics-frontend.vercel.app", "http://localhost:5173"]}},
         supports_credentials=True,
         allow_headers=["Content-Type", "content-type", "Authorization", "authorization", 
                      "Accept", "accept", "X-Requested-With", "x-requested-with", 
                      "Access-Control-Allow-Credentials", "access-control-allow-credentials"],
         expose_headers=["Content-Type", "content-type", "Authorization", "authorization", "Access-Control-Allow-Origin", "access-control-allow-origin"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Add CORS headers for preflight requests
    @app.after_request
    def add_headers(response):
        # Get the origin from the request
        origin = request.headers.get('Origin')
        
        if origin:
            allowed_origins = ["https://churn-analytics-frontend.vercel.app", "http://localhost:5173"]
            
            if origin in allowed_origins:
                # Explicitly add CORS headers for allowed origins
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Headers', 
                                   'Content-Type, content-type, Authorization, authorization, Accept, X-Requested-With')
                response.headers.add('Access-Control-Allow-Methods',
                                   'GET, POST, PUT, DELETE, OPTIONS')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        # Content Security Policy
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
        
        # Prevent XSS attacks
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # Protect against clickjacking
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        
        # Force HTTPS
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # Control referrer information
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(customer_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(survival_bp)
    app.register_blueprint(historical_analytics_bp)
    
    # Register teardown function for database connections
    app.teardown_appcontext(close_db)
    
    # Handle OPTIONS requests explicitly
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        return '', 200
    
    return app

app = create_app()

# Initialize the scheduler when the app starts
scheduler = setup_scheduler(app)

# Make sure to shut down the scheduler when the app closes
atexit.register(lambda: scheduler.shutdown())

if __name__ == '__main__':
    # Create database indexes if they don't exist
    create_indexes()
    
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, host='0.0.0.0', port=port)