"""
Recommendations routes for generating conversation prompts
"""

from flask import Blueprint, request, jsonify, current_app

from app.services.azure_storage import storage
from app.services.ai_service import AIService


recommendations_bp = Blueprint('recommendations', __name__)
ai_service = AIService()


@recommendations_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """
    Get conversation recommendations for a user
    
    Query Parameters:
        - user_id: User identifier (required)
        - category: Filter by category (optional: dormant, active, all)
        - regenerate: Force regenerate prompts (optional: true/false)
    
    Returns:
        JSON with conversation recommendations
    """
    
    try:
        # Get parameters
        user_id = request.args.get('user_id')
        category = request.args.get('category', 'all')
        regenerate = request.args.get('regenerate', 'false').lower() == 'true'
        
        if not user_id:
            return jsonify({'error': 'user_id parameter is required'}), 400
        
        # Check if user exists
        user = storage.get_user(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get conversations based on category
        if category == 'dormant':
            conversations = storage.get_dormant_conversations(user_id, days_threshold=14)
        elif category == 'active':
            all_conversations = storage.get_user_conversations(user_id)
            conversations = [c for c in all_conversations if c.get_relationship_health() == 'healthy']
        else:
            conversations = storage.get_user_conversations(user_id)
        
        if not conversations:
            return jsonify({
                'user_id': user_id,
                'conversations': [],
                'message': 'No conversations found. Please upload chat transcripts first.'
            }), 200
        
        # Prepare recommendations
        recommendations = []
        
        for conversation in conversations:
            # Get existing prompts or generate new ones
            if regenerate:
                prompts = ai_service.generate_prompts(conversation, num_prompts=3)
                for prompt in prompts:
                    prompt.conversation_id = conversation.conversation_id
                    storage.save_prompt(prompt)
            else:
                prompts = storage.get_conversation_prompts(conversation.conversation_id, unused_only=True)
                
                # Generate if no unused prompts available
                if not prompts:
                    prompts = ai_service.generate_prompts(conversation, num_prompts=3)
                    for prompt in prompts:
                        prompt.conversation_id = conversation.conversation_id
                        storage.save_prompt(prompt)
            
            # Format recommendation
            recommendation = {
                'conversation_id': conversation.conversation_id,
                'partner_name': conversation.partner_name,
                'relationship_health': conversation.get_relationship_health(),
                'metrics': {
                    'total_messages': conversation.metrics.total_messages,
                    'days_since_contact': conversation.metrics.days_since_contact,
                    'reciprocity': round(conversation.metrics.reciprocity, 2),
                    'common_topics': conversation.metrics.common_topics[:5]
                },
                'last_message_time': conversation.metrics.last_message_time.isoformat() if conversation.metrics.last_message_time else None,
                'prompts': [
                    {
                        'prompt_id': p.prompt_id,
                        'text': p.prompt_text,
                        'type': p.prompt_type,
                        'context': p.context,
                        'confidence': round(p.confidence_score, 2)
                    }
                    for p in prompts
                ]
            }
            
            recommendations.append(recommendation)
        
        # Sort by urgency (days since contact)
        recommendations.sort(
            key=lambda x: x['metrics']['days_since_contact'] or 0,
            reverse=True
        )
        
        return jsonify({
            'user_id': user_id,
            'category': category,
            'total_conversations': len(recommendations),
            'conversations': recommendations
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting recommendations: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Error generating recommendations',
            'message': str(e)
        }), 500


@recommendations_bp.route('/recommendations/<prompt_id>/use', methods=['POST'])
def mark_prompt_used(prompt_id):
    """
    Mark a prompt as used
    
    Body:
        - user_id: User identifier (for verification)
    
    Returns:
        Success message
    """
    
    try:
        data = request.get_json()
        user_id = data.get('user_id') if data else None
        
        if not user_id:
            return jsonify({'error': 'user_id is required in request body'}), 400
        
        # Mark prompt as used
        success = storage.mark_prompt_used(prompt_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Prompt marked as used',
                'prompt_id': prompt_id
            }), 200
        else:
            return jsonify({'error': 'Failed to mark prompt as used'}), 500
    
    except Exception as e:
        current_app.logger.error(f"Error marking prompt as used: {str(e)}")
        return jsonify({'error': 'Error updating prompt status'}), 500


@recommendations_bp.route('/stats/<user_id>', methods=['GET'])
def get_user_stats(user_id):
    """
    Get aggregate statistics for a user
    
    Returns:
        User statistics including conversation health breakdown
    """
    
    try:
        # Check if user exists
        user = storage.get_user(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get basic stats
        stats = storage.get_user_stats(user_id)
        
        # Get conversation health breakdown
        conversations = storage.get_user_conversations(user_id)
        
        health_breakdown = {
            'healthy': 0,
            'attention': 0,
            'dormant': 0,
            'at_risk': 0
        }
        
        for conv in conversations:
            health = conv.get_relationship_health()
            if health in health_breakdown:
                health_breakdown[health] += 1
        
        # Get category breakdown
        category_breakdown = {}
        for conv in conversations:
            category = conv.category
            category_breakdown[category] = category_breakdown.get(category, 0) + 1
        
        return jsonify({
            'user_id': user_id,
            'display_name': user.display_name,
            'overview': stats,
            'relationship_health': health_breakdown,
            'categories': category_breakdown,
            'last_updated': user.last_login.isoformat()
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({'error': 'Error retrieving statistics'}), 500