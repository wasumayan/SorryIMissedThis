#!/bin/bash
# Azure App Service startup script for Flask application

echo "Starting Sorry I Missed This API on Azure..."

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start the application with Gunicorn
echo "Starting Gunicorn server..."
gunicorn --bind=0.0.0.0:8000 --timeout 600 --workers 4 run:app
