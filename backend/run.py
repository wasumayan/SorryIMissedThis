"""
Main application entry point
Run this file to start the Flask development server
"""

import os
from app import create_app

# Create application instance
app = create_app()

if __name__ == '__main__':
    # Get configuration from environment
    host = app.config.get('HOST', '0.0.0.0')
    port = app.config.get('PORT', 5002)
    debug = app.config.get('DEBUG', False)
    
    print("\n" + "="*60)
    print("Sorry I Missed This - Context-Aware Communication Assistant")
    print("="*60)
    print(f"Server starting on http://{host}:{port}")
    print(f"Environment: {app.config.get('ENV', 'development')}")
    print(f"Debug mode: {debug}")
    print(f"CORS origins: {app.config.get('CORS_ORIGINS', [])}")
    print("="*60)
    print("\nAvailable endpoints:")
    print("  - GET  /               : API information")
    print("  - GET  /health         : Health check")
    print("  - POST /api/upload/transcript : Upload chat transcripts")
    print("  - GET  /api/recommendations   : Get conversation prompts")
    print("  - GET  /api/conversations     : List all conversations")
    print("  - GET  /api/stats/<user_id>   : User statistics")
    print("="*60 + "\n")
    
    # Run the application
    app.run(
        host=host,
        port=port,
        debug=debug
    )