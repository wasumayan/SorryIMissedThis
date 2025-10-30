"""
Flask Application Factory
Creates and configures the Flask application
"""

from flask import Flask, jsonify
from flask_cors import CORS
import logging
import os

from app.config import get_config


def create_app(config_name=None):
    """
    Application factory pattern
    
    Args:
        config_name: Configuration to use (development, production, testing)
    
    Returns:
        Configured Flask application
    """
    
    # Create Flask app
    app = Flask(__name__)
    
    # Load configuration
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    config_class = get_config()
    app.config.from_object(config_class)
    config_class.init_app(app)
    
    # Initialize extensions
    _initialize_extensions(app)
    
    # Register blueprints
    _register_blueprints(app)
    
    # Register error handlers
    _register_error_handlers(app)
    
    # Setup logging
    _setup_logging(app)
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring"""
        return jsonify({
            'status': 'healthy',
            'message': 'Sorry I Missed This API is running',
            'environment': app.config['ENV']
        }), 200
    
    @app.route('/', methods=['GET'])
    def root():
        """Root endpoint"""
        return jsonify({
            'name': 'Sorry I Missed This API',
            'version': '1.0.0',
            'description': 'Context-aware conversation prompts API',
            'endpoints': {
                'health': '/health',
                'upload': '/api/upload/transcript',
                'recommendations': '/api/recommendations',
                'conversations': '/api/conversations',
                'stats': '/api/stats'
            }
        }), 200
    
    print("Flask application created successfully")
    print(f"Environment: {app.config['ENV']}")
    print(f"Debug mode: {app.config['DEBUG']}")
    
    return app


def _initialize_extensions(app):
    """Initialize Flask extensions"""
    
    # CORS configuration
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    print("CORS configured")
    print(f"   Allowed origins: {app.config['CORS_ORIGINS']}")


def _register_blueprints(app):
    """Register application blueprints"""

    from app.routes.auth import auth_bp
    from app.routes.upload import upload_bp
    from app.routes.recommendations import recommendations_bp
    from app.routes.conversations import conversations_bp

    # Register with /api prefix
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(recommendations_bp, url_prefix='/api')
    app.register_blueprint(conversations_bp, url_prefix='/api/conversations')

    print("Blueprints registered")


def _register_error_handlers(app):
    """Register global error handlers"""
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request"""
        return jsonify({
            'error': 'Bad Request',
            'message': str(error)
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found"""
        return jsonify({
            'error': 'Not Found',
            'message': 'The requested resource was not found'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server Error"""
        app.logger.error(f'Internal error: {str(error)}')
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500
    
    @app.errorhandler(Exception)
    def unhandled_exception(error):
        """Handle any unhandled exceptions"""
        app.logger.error(f'Unhandled exception: {str(error)}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500
    
    print("Error handlers registered")


def _setup_logging(app):
    """Configure application logging"""
    
    log_level = app.config['LOG_LEVEL']
    log_format = app.config['LOG_FORMAT']
    
    # Set log level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Configure root logger
    logging.basicConfig(
        level=numeric_level,
        format=log_format
    )
    
    # Configure Flask app logger
    app.logger.setLevel(numeric_level)
    
    # Log startup
    app.logger.info(f"Logging configured at {log_level} level")
    
    print(f"Logging configured at {log_level} level")