"""
Conversations routes for managing individual conversations
"""

from flask import Blueprint, request, jsonify, current_app

from app.services.azure_storage import storage
from app.services.ai_service import AIService


conversations_bp = Blueprint('conversations', __name__)
ai_service = AIService()


@conversations_bp.route('', methods=['GET'])
def get_conversations():
    """
    Get all conversations for a user
    
    Query Parameters:
        - user_id: User identifier (required)
        - category: Filter by category (optional)
        - limit: Maximum number of results (default: 100)
    
    Returns:
        List of conversations
    """
    
    try:
        user_id = request.args.get('user_id')
        category = request.args.get('category')
        limit = int(request.args.get('limit', 100))
        
        if not user_id:
            return jsonify({'error': 'user_id parameter is required'}), 400
        
        conversations = storage.get_user_conversations(user_id, category=category, limit=limit)
        
        # Format conversations
        formatted_conversations = [
            {
                'conversation_id': c.conversation_id,
                'partner_name': c.partner_name,
                'category': c.category,
                'relationship_health': c.get_relationship_health(),
                'metrics': {
                    'total_messages': c.metrics.total_messages,
                    'user_messages': c.metrics.user_messages,
                    'partner_messages': c.metrics.partner_messages,
                    'reciprocity': round(c.metrics.reciprocity, 2),
                    'days_since_contact': c.metrics.days_since_contact,
                    'avg_response_time': round(c.metrics.avg_response_time, 2) if c.metrics.avg_response_time else None,
                    'common_topics': c.metrics.common_topics
                },
                'last_message_time': c.metrics.last_message_time.isoformat() if c.metrics.last_message_time else None,
                'created_at': c.created_at.isoformat(),
                'updated_at': c.updated_at.isoformat()
            }
            for c in conversations
        ]
        
        return jsonify({
            'user_id': user_id,
            'total': len(formatted_conversations),
            'conversations': formatted_conversations
        }), 200
    
    except ValueError:
        return jsonify({'error': 'Invalid limit parameter'}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error getting conversations: {str(e)}")
        return jsonify({'error': 'Error retrieving conversations'}), 500


@conversations_bp.route('/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """
    Get detailed information about a specific conversation
    
    Query Parameters:
        - include_messages: Include full message history (default: false)
        - message_limit: Limit number of messages (default: 50)
    
    Returns:
        Detailed conversation information
    """
    
    try:
        include_messages = request.args.get('include_messages', 'false').lower() == 'true'
        message_limit = int(request.args.get('message_limit', 50))
        
        conversation = storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Format conversation
        response = {
            'conversation_id': conversation.conversation_id,
            'partner_name': conversation.partner_name,
            'category': conversation.category,
            'relationship_health': conversation.get_relationship_health(),
            'metrics': {
                'total_messages': conversation.metrics.total_messages,
                'user_messages': conversation.metrics.user_messages,
                'partner_messages': conversation.metrics.partner_messages,
                'reciprocity': round(conversation.metrics.reciprocity, 2),
                'days_since_contact': conversation.metrics.days_since_contact,
                'avg_response_time': round(conversation.metrics.avg_response_time, 2) if conversation.metrics.avg_response_time else None,
                'common_topics': conversation.metrics.common_topics
            },
            'last_message_time': conversation.metrics.last_message_time.isoformat() if conversation.metrics.last_message_time else None,
            'created_at': conversation.created_at.isoformat(),
            'updated_at': conversation.updated_at.isoformat()
        }
        
        # Include messages if requested
        if include_messages:
            recent_messages = conversation.get_last_n_messages(message_limit)
            response['messages'] = [
                {
                    'timestamp': msg.timestamp.isoformat(),
                    'sender': msg.sender,
                    'content': msg.content
                }
                for msg in reversed(recent_messages)  # Chronological order
            ]
        
        return jsonify(response), 200
    
    except ValueError:
        return jsonify({'error': 'Invalid message_limit parameter'}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error getting conversation: {str(e)}")
        return jsonify({'error': 'Error retrieving conversation details'}), 500


@conversations_bp.route('/<conversation_id>/prompts', methods=['GET'])
def get_conversation_prompts(conversation_id):
    """
    Get prompts for a specific conversation
    
    Query Parameters:
        - unused_only: Only return unused prompts (default: true)
    
    Returns:
        List of prompts for the conversation
    """
    
    try:
        unused_only = request.args.get('unused_only', 'true').lower() == 'true'
        
        prompts = storage.get_conversation_prompts(conversation_id, unused_only=unused_only)
        
        formatted_prompts = [
            {
                'prompt_id': p.prompt_id,
                'text': p.prompt_text,
                'type': p.prompt_type,
                'context': p.context,
                'tone': p.tone,
                'confidence': round(p.confidence_score, 2),
                'used': p.used,
                'created_at': p.created_at.isoformat()
            }
            for p in prompts
        ]
        
        return jsonify({
            'conversation_id': conversation_id,
            'total': len(formatted_prompts),
            'prompts': formatted_prompts
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting conversation prompts: {str(e)}")
        return jsonify({'error': 'Error retrieving prompts'}), 500


@conversations_bp.route('/<conversation_id>/prompts', methods=['POST'])
def generate_new_prompts(conversation_id):
    """
    Generate new prompts for a conversation
    
    Body:
        - num_prompts: Number of prompts to generate (default: 3)
        - tone: Preferred tone (default: friendly)
    
    Returns:
        Newly generated prompts
    """
    
    try:
        data = request.get_json() or {}
        num_prompts = data.get('num_prompts', 3)
        tone = data.get('tone', 'friendly')
        
        # Get conversation
        conversation = storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Generate prompts
        prompts = ai_service.generate_prompts(
            conversation,
            num_prompts=num_prompts,
            user_tone_preference=tone
        )
        
        # Save prompts
        saved_prompts = []
        for prompt in prompts:
            prompt.conversation_id = conversation_id
            prompt_id = storage.save_prompt(prompt)
            prompt.prompt_id = prompt_id
            saved_prompts.append({
                'prompt_id': prompt.prompt_id,
                'text': prompt.prompt_text,
                'type': prompt.prompt_type,
                'context': prompt.context,
                'tone': prompt.tone,
                'confidence': round(prompt.confidence_score, 2)
            })
        
        return jsonify({
            'conversation_id': conversation_id,
            'prompts_generated': len(saved_prompts),
            'prompts': saved_prompts
        }), 201
    
    except Exception as e:
        current_app.logger.error(f"Error generating new prompts: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error generating prompts'}), 500


@conversations_bp.route('/<conversation_id>/category', methods=['PUT'])
def update_conversation_category(conversation_id):
    """
    Update conversation category
    
    Body:
        - category: New category (family, friends, work, etc.)
    
    Returns:
        Updated conversation
    """
    
    try:
        data = request.get_json()
        
        if not data or 'category' not in data:
            return jsonify({'error': 'category is required in request body'}), 400
        
        new_category = data['category']
        
        # Get conversation
        conversation = storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Update category
        conversation.category = new_category
        storage.save_conversation(conversation)
        
        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'category': new_category
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error updating conversation category: {str(e)}")
        return jsonify({'error': 'Error updating category'}), 500


@conversations_bp.route('/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """
    Delete a conversation
    
    Query Parameters:
        - user_id: User identifier (for verification)
    
    Returns:
        Success message
    """
    
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id parameter is required'}), 400
        
        # Verify conversation exists and belongs to user
        conversation = storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        if conversation.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Delete conversation
        success = storage.delete_conversation(conversation_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Conversation deleted successfully',
                'conversation_id': conversation_id
            }), 200
        else:
            return jsonify({'error': 'Failed to delete conversation'}), 500
    
    except Exception as e:
        current_app.logger.error(f"Error deleting conversation: {str(e)}")
        return jsonify({'error': 'Error deleting conversation'}), 500


@conversations_bp.route('/dormant', methods=['GET'])
def get_dormant_conversations():
    """
    Get dormant conversations that need attention
    
    Query Parameters:
        - user_id: User identifier (required)
        - days_threshold: Days since last contact to consider dormant (default: 14)
    
    Returns:
        List of dormant conversations
    """
    
    try:
        user_id = request.args.get('user_id')
        days_threshold = int(request.args.get('days_threshold', 14))
        
        if not user_id:
            return jsonify({'error': 'user_id parameter is required'}), 400
        
        conversations = storage.get_dormant_conversations(user_id, days_threshold)
        
        formatted_conversations = [
            {
                'conversation_id': c.conversation_id,
                'partner_name': c.partner_name,
                'days_since_contact': c.metrics.days_since_contact,
                'total_messages': c.metrics.total_messages,
                'relationship_health': c.get_relationship_health(),
                'common_topics': c.metrics.common_topics[:3]
            }
            for c in conversations
        ]
        
        return jsonify({
            'user_id': user_id,
            'days_threshold': days_threshold,
            'dormant_count': len(formatted_conversations),
            'conversations': formatted_conversations
        }), 200
    
    except ValueError:
        return jsonify({'error': 'Invalid days_threshold parameter'}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error getting dormant conversations: {str(e)}")
        return jsonify({'error': 'Error retrieving dormant conversations'}), 500