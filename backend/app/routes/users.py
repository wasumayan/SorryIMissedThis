"""
User routes for managing user preferences and settings
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.azure_storage import storage

users_bp = Blueprint('users', __name__)


@users_bp.route('/<user_id>/preferences', methods=['GET'])
def get_user_preferences(user_id):
    """
    Get user preferences
    """
    try:
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        preferences = user.get('preferences', {}) if isinstance(user, dict) else getattr(user, 'preferences', {})
        
        return jsonify({
            'success': True,
            'data': {
                'preferences': preferences
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting user preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@users_bp.route('/<user_id>/preferences', methods=['PUT'])
def update_user_preferences(user_id):
    """
    Update user preferences
    
    Expected JSON body:
    {
        "preferences": {
            "chatTracking": {
                "mode": "all" | "recent" | "selected",
                "maxChats": 50,  // For "recent" mode
                "selectedChatIds": []  // For "selected" mode
            },
            "ai": {
                "promptStyle": "friendly",
                "autoAnalysis": true
            },
            ...
        }
    }
    """
    try:
        data = request.get_json()
        if not data or 'preferences' not in data:
            return jsonify({'error': 'preferences are required in request body'}), 400
        
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update preferences
        if isinstance(user, dict):
            current_prefs = user.get('preferences', {})
        else:
            current_prefs = getattr(user, 'preferences', {})
        
        # Merge new preferences with existing
        new_prefs = data['preferences']
        updated_prefs = {**current_prefs, **new_prefs}
        
        # Update user
        if isinstance(user, dict):
            user['preferences'] = updated_prefs
            storage.update_user(user_id, {'preferences': updated_prefs})
        else:
            user.preferences = updated_prefs
            storage.update_user(user_id, {'preferences': updated_prefs})
        
        return jsonify({
            'success': True,
            'message': 'Preferences updated successfully',
            'data': {
                'preferences': updated_prefs
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error updating user preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@users_bp.route('/<user_id>/preferences/chat-tracking', methods=['PUT'])
def update_chat_tracking_preferences(user_id):
    """
    Update chat tracking preferences specifically
    
    Expected JSON body:
    {
        "mode": "all" | "recent" | "selected",
        "maxChats": 50,  // For "recent" mode
        "selectedChatGuids": []  // For "selected" mode
    }
    """
    try:
        data = request.get_json()
        if not data or 'mode' not in data:
            return jsonify({'error': 'mode is required'}), 400
        
        mode = data['mode']
        if mode not in ['all', 'recent', 'selected']:
            return jsonify({'error': 'mode must be one of: all, recent, selected'}), 400
        
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get current preferences
        if isinstance(user, dict):
            preferences = user.get('preferences', {})
        else:
            preferences = getattr(user, 'preferences', {})
        
        # Update chat tracking preferences
        chat_tracking = {
            'mode': mode,
            'maxChats': data.get('maxChats', 50),
            'selectedChatIds': data.get('selectedChatIds', []) or data.get('selectedChatGuids', [])  # Support legacy format
        }
        
        preferences['chatTracking'] = chat_tracking
        
        # Update user
        storage.update_user(user_id, {'preferences': preferences})
        
        return jsonify({
            'success': True,
            'message': 'Chat tracking preferences updated',
            'data': {
                'chatTracking': chat_tracking
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error updating chat tracking preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

