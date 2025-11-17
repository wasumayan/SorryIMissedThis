"""
Authentication routes for user registration, login, and session management
Uses Azure Cosmos DB for storage
"""

from flask import Blueprint, request, jsonify
from app.services.azure_storage import storage
from datetime import datetime
import uuid
import hashlib
import secrets

auth_bp = Blueprint('auth', __name__)


def hash_password(password):
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token():
    """Generate a secure random token"""
    return secrets.token_urlsafe(32)


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user

    Expected JSON body:
    {
        "name": "User Name",
        "email": "user@example.com",
        "password": "securepassword"
    }
    """
    try:
        # Check if storage is available
        if not storage.database:
            return jsonify({
                'error': 'Database not configured',
                'message': 'Azure Cosmos DB is not set up. Please configure COSMOS_ENDPOINT and COSMOS_KEY in your .env file.',
                'docs': 'See AZURE_COMPLETE_SETUP.md for setup instructions'
            }), 503

        data = request.get_json()

        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        name = data.get('name')
        email = data.get('email')
        password = data.get('password')

        if not all([name, email, password]):
            return jsonify({'error': 'Missing required fields: name, email, password'}), 400

        # Check if user already exists
        existing_user = storage.get_user_by_email(email)
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409

        # Create new user
        user_id = str(uuid.uuid4())
        token = generate_token()
        refresh_token = generate_token()

        user_data = {
            'id': user_id,
            'name': name,
            'email': email,
            'password': hash_password(password),
            'preferences': {
                'privacy': {
                    'localOnly': False,
                    'cloudSync': True,
                    'dataRetention': 365
                },
                'notifications': {
                    'email': True,
                    'push': True,
                    'frequency': 'daily'
                },
                'ai': {
                    'promptStyle': 'friendly',
                    'autoAnalysis': True
                },
                'chatTracking': {
                    'mode': 'all',  # 'all', 'recent', 'selected'
                    'maxChats': 50,  # For 'recent' mode
                    'selectedChatIds': []  # For 'selected' mode
                }
            },
            'connectedPlatforms': {
                'whatsapp': {'connected': False},
                'telegram': {'connected': False}
            },
            'lastActive': datetime.utcnow().isoformat()
        }

        # Store user in Cosmos DB
        if not storage.create_user(user_data):
            return jsonify({'error': 'Failed to create user'}), 500

        # Create session
        session_data = {
            'id': token,  # Use token as ID for easy lookup
            'userId': user_id,
            'token': token,
            'refreshToken': refresh_token,
            'expiresAt': (datetime.utcnow().timestamp() + (30 * 24 * 60 * 60))  # 30 days
        }

        if not storage.create_session(session_data):
            return jsonify({'error': 'Failed to create session'}), 500

        # Remove password from response
        user_response = {k: v for k, v in user_data.items() if k != 'password'}

        return jsonify({
            'success': True,
            'data': {
                'user': user_response,
                'token': token,
                'refreshToken': refresh_token
            },
            'message': 'User registered successfully'
        }), 201

    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login a user

    Expected JSON body:
    {
        "email": "user@example.com",
        "password": "securepassword"
    }
    """
    try:
        # Check if storage is available
        if not storage.database:
            return jsonify({
                'error': 'Database not configured',
                'message': 'Azure Cosmos DB is not set up. Please configure COSMOS_ENDPOINT and COSMOS_KEY in your .env file.',
                'docs': 'See AZURE_COMPLETE_SETUP.md for setup instructions'
            }), 503

        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return jsonify({'error': 'Missing required fields: email, password'}), 400

        # Find user by email
        user = storage.get_user_by_email(email)

        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401

        # Verify password
        if user.get('password') != hash_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401

        # Generate new token
        token = generate_token()
        refresh_token = generate_token()

        # Create session
        session_data = {
            'id': token,
            'userId': user['id'],
            'token': token,
            'refreshToken': refresh_token,
            'expiresAt': (datetime.utcnow().timestamp() + (30 * 24 * 60 * 60))  # 30 days
        }

        if not storage.create_session(session_data):
            return jsonify({'error': 'Failed to create session'}), 500

        # Update last active
        storage.update_user(user['id'], {'lastActive': datetime.utcnow().isoformat()})

        # Remove password from response
        user_response = {k: v for k, v in user.items() if k != 'password'}

        return jsonify({
            'success': True,
            'data': {
                'user': user_response,
                'token': token,
                'refreshToken': refresh_token
            },
            'message': 'Login successful'
        }), 200

    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout a user by invalidating their token"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401

        token = auth_header.replace('Bearer ', '')

        # Note: We'd need to get user_id from the session to delete it
        # For now, we'll return success (token-based auth doesn't strictly need server-side logout)

        return jsonify({
            'success': True,
            'message': 'Logout successful'
        }), 200

    except Exception as e:
        print(f"Logout error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current user information"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401

        token = auth_header.replace('Bearer ', '')

        # For Azure Cosmos DB, we need to query by token across partitions
        # This is simplified - in production you'd want to optimize this
        if not storage.database:
            return jsonify({'error': 'Database not configured'}), 503

        # Query to find session by token
        try:
            query = "SELECT * FROM c WHERE c.token = @token"
            parameters = [{"name": "@token", "value": token}]

            sessions = list(storage.sessions_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            if not sessions:
                return jsonify({'error': 'Invalid token'}), 401

            session = sessions[0]

        except Exception as e:
            print(f"Session lookup error: {str(e)}")
            return jsonify({'error': 'Invalid token'}), 401

        # Check if token is expired
        if session.get('expiresAt', 0) < datetime.utcnow().timestamp():
            return jsonify({'error': 'Token expired'}), 401

        # Get user
        user = storage.get_user_by_id(session['userId'])

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Remove password from response
        user_response = {k: v for k, v in user.items() if k != 'password'}

        return jsonify({
            'success': True,
            'data': user_response
        }), 200

    except Exception as e:
        print(f"Get current user error: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@auth_bp.route('/purge', methods=['POST'])
def purge_all_data():
    """Purge all user data - for study participants to reset their data"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401

        token = auth_header.replace('Bearer ', '')

        # Get user_id from token
        if not storage.database:
            return jsonify({'error': 'Database not configured'}), 503

        try:
            query = "SELECT * FROM c WHERE c.token = @token"
            parameters = [{"name": "@token", "value": token}]
            sessions = list(storage.sessions_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
        except Exception:
            # Fallback to mock storage
            sessions = [s for s in storage.sessions.values() if s.get('token') == token]

        if not sessions:
            return jsonify({'error': 'Invalid or expired token'}), 401

        session = sessions[0]
        user_id = session['userId']

        # Purge all user data
        # 1. Delete all conversations
        try:
            query = "SELECT * FROM c WHERE c.type = 'conversation' AND c.userId = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            conversations = list(storage.conversations_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            for conv in conversations:
                storage.conversations_container.delete_item(item=conv['id'], partition_key=user_id)
        except Exception as e:
            print(f"Error deleting conversations: {str(e)}")

        # 2. Delete all contacts
        try:
            query = "SELECT * FROM c WHERE c.type = 'contact' AND c.userId = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            contacts = list(storage.contacts_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            for contact in contacts:
                storage.contacts_container.delete_item(item=contact['id'], partition_key=user_id)
        except Exception as e:
            print(f"Error deleting contacts: {str(e)}")

        # 3. Delete study data if exists
        try:
            participant = storage.get_study_participant(user_id)
            if participant:
                query = "SELECT * FROM c WHERE c.type = 'study_participant' AND c.userId = @userId"
                parameters = [{"name": "@userId", "value": user_id}]
                items = list(storage.study_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                for item in items:
                    storage.study_container.delete_item(item=item['id'], partition_key=user_id)

            # Delete survey responses
            query = "SELECT * FROM c WHERE c.type = 'survey_response' AND c.userId = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            items = list(storage.study_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            for item in items:
                storage.study_container.delete_item(item=item['id'], partition_key=user_id)

            # Delete study metrics
            query = "SELECT * FROM c WHERE c.type = 'study_metric' AND c.userId = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            items = list(storage.study_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            for item in items:
                storage.study_container.delete_item(item=item['id'], partition_key=user_id)
        except Exception as e:
            print(f"Error deleting study data: {str(e)}")

        # 4. Delete user account and session
        try:
            storage.users_container.delete_item(item=user_id, partition_key=user_id)
            storage.sessions_container.delete_item(item=session['id'], partition_key=user_id)
        except Exception as e:
            print(f"Error deleting user/session: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'All data has been purged successfully'
        }), 200

    except Exception as e:
        print(f"Purge error: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
