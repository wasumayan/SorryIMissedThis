"""
Configuration management for Sorry I Missed This backend
Supports multiple environments: development, production, testing
"""

import os
from dotenv import load_dotenv
from datetime import timedelta

# Load environment variables
load_dotenv()


class Config:
    """Base configuration"""
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = False
    TESTING = False
    
    # Server
    HOST = '0.0.0.0'
    PORT = int(os.getenv('PORT', 5002))
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    
    # OpenAI
    # Check both OPENAI_API_KEY and AZURE_OPENAI_API_KEY for compatibility
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') or os.getenv('AZURE_OPENAI_API_KEY')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4')
    OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', 500))
    OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', 0.7))
    
    # Firebase/Firestore
    FIREBASE_CREDENTIALS_PATH = os.getenv(
        'FIREBASE_CREDENTIALS_PATH', 
        'credentials/firebase-key.json'
    )
    
    # File Upload
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'txt', 'zip'}
    
    # Analytics
    DORMANT_DAYS_THRESHOLD = int(os.getenv('DORMANT_DAYS_THRESHOLD', 14))
    CONTEXT_WINDOW_MESSAGES = int(os.getenv('CONTEXT_WINDOW_MESSAGES', 100))
    MAX_PROMPT_SUGGESTIONS = int(os.getenv('MAX_PROMPT_SUGGESTIONS', 3))
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Rate Limiting (for future implementation)
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'False').lower() == 'true'
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '100 per hour')
    
    @staticmethod
    def init_app(app):
        """Initialize application with configuration"""
        pass


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    ENV = 'development'
    
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)
        print('Starting in DEVELOPMENT mode')


class ProductionConfig(Config):
    """Production configuration"""
    ENV = 'production'
    DEBUG = False
    
    # Production-specific settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',')
    
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)
        
        # Validate critical configuration
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set in production")
        
        if not os.path.exists(cls.FIREBASE_CREDENTIALS_PATH):
            raise ValueError(f"Firebase credentials not found at {cls.FIREBASE_CREDENTIALS_PATH}")
        
        print('Starting in PRODUCTION mode')


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    ENV = 'testing'
    
    # Use test database/credentials
    FIREBASE_CREDENTIALS_PATH = 'credentials/firebase-test-key.json'
    
    @classmethod
    def init_app(cls, app):
        Config.init_app(app)
        print('Starting in TESTING mode')


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])