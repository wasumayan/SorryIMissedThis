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
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        category = request.args.get('category')
        limit = int(request.args.get('limit', 100))
        
        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400
        
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


@conversations_bp.route('/<conversation_id>/summary', methods=['GET'])
def get_conversation_summary(conversation_id):
    """
    Get conversation summary (AI-generated)
    
    Query Parameters:
        - userId: User ID (required)
    
    Returns:
        Conversation summary with sentiment, topics, and suggestions
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400
        
        conversation = storage.get_conversation(conversation_id, user_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Use AI service to generate summary
        from app.services.ai_service import AIService
        from app.models import Conversation, Message, ConversationMetrics
        
        ai_service = AIService()
        
        # Convert to Conversation object
        messages = [Message.from_dict(m) for m in conversation.get('messages', [])]
        metrics = ConversationMetrics.from_dict(conversation.get('metrics', {}))
        conv_obj = Conversation(
            user_id=user_id,
            partner_name=conversation.get('partnerName') or conversation.get('partner_name', 'Unknown'),
            partner_id=conversation.get('partnerId') or conversation.get('partner_id', ''),
            messages=messages,
            metrics=metrics,
            category=conversation.get('category', 'friends')
        )
        
        # Generate summary
        analysis = ai_service.analyze_conversation(conv_obj)
        
        return jsonify({
            'success': True,
            'data': {
                'summary': {
                    'summary': analysis.get('summary', ''),
                    'sentiment': analysis.get('sentiment', {}).get('overall', 'neutral'),
                    'keyTopics': [t.get('topic', '') for t in analysis.get('topics', [])],
                    'followUpSuggestions': analysis.get('followUpSuggestions', [])
                }
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting conversation summary: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


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
        # Allow override, but default to conversation-specific tone
        tone_override = data.get('tone')
        
        # Get conversation
        conversation = storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Determine tone: use override if provided, otherwise check user preferences, then conversation-specific tone
        if tone_override:
            tone = tone_override
        else:
            # Try to get tone from user preferences first (as per AI_PROMPT_GENERATION.md)
            user_id = conversation.get('userId') if isinstance(conversation, dict) else getattr(conversation, 'user_id', None)
            user_tone = None
            if user_id:
                try:
                    user = storage.get_user_by_id(user_id)
                    if user and isinstance(user, dict):
                        user_tone = user.get('preferences', {}).get('ai', {}).get('promptStyle')
                    elif user and hasattr(user, 'preferences'):
                        user_tone = getattr(user.preferences, 'ai', {}).get('promptStyle') if hasattr(user.preferences, 'ai') else None
                except Exception:
                    pass  # Continue to fallback
            
            if user_tone:
                tone = user_tone
            else:
                # Get conversation-specific tone (from conversation.tone or category-based default)
                if isinstance(conversation, dict):
                    tone = conversation.get('tone')
                    if not tone:
                        category = conversation.get('category', 'friends')
                        category_tone_map = {'work': 'formal', 'family': 'friendly', 'friends': 'friendly'}
                        tone = category_tone_map.get(category, 'friendly')
                elif hasattr(conversation, 'get_tone'):
                    tone = conversation.get_tone()
                elif hasattr(conversation, 'tone') and conversation.tone:
                    tone = conversation.tone
                else:
                    # Fallback to category-based default
                    category = getattr(conversation, 'category', 'friends')
                    category_tone_map = {'work': 'formal', 'family': 'friendly', 'friends': 'friendly'}
                    tone = category_tone_map.get(category, 'friendly')
        
        # CONTEXT-AWARE: Fetch recent messages from iMessage service for AI analysis
        # Messages are fetched fresh from iMessage (not stored in DB for privacy)
        # but needed for context-aware prompt generation
        from app.services.imessage_service import get_imessage_service
        from app.models import Message, Conversation
        from datetime import datetime, timezone
        import asyncio
        
        # Get chatId from conversation
        chat_id = None
        if isinstance(conversation, dict):
            chat_id = conversation.get('chatId') or conversation.get('chatGuid')
        else:
            chat_id = getattr(conversation, 'chatId', None) or getattr(conversation, 'chatGuid', None)
        
        # Fetch last 100 messages from iMessage for context
        messages_for_ai = []
        if chat_id:
            try:
                imessage_service = get_imessage_service()
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    # Fetch messages from iMessage service
                    raw_messages = loop.run_until_complete(
                        imessage_service.get_messages(chat_id, limit=100, offset=0)
                    )
                    
                    # Convert to Message objects for AI analysis
                    user_id = conversation.get('userId') if isinstance(conversation, dict) else getattr(conversation, 'user_id', '')
                    for msg in raw_messages:
                        try:
                            msg_time = msg.get('date')
                            if isinstance(msg_time, str):
                                if msg_time.endswith('Z'):
                                    msg_time = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
                                else:
                                    msg_time = datetime.fromisoformat(msg_time)
                            elif isinstance(msg_time, (int, float)):
                                msg_time = datetime.fromtimestamp(msg_time / 1000, tz=timezone.utc)
                            else:
                                msg_time = datetime.now(timezone.utc)
                            
                            is_from_me = msg.get('isFromMe', False)
                            sender = user_id if is_from_me else (msg.get('handle', {}).get('name') or msg.get('sender', 'Unknown'))
                            content = msg.get('text') or ''
                            
                            if content:  # Only include messages with text for AI analysis
                                messages_for_ai.append(Message(
                                    message_id=msg.get('guid', ''),
                                    conversation_id=conversation_id,
                                    sender=sender,
                                    content=content,
                                    timestamp=msg_time,
                                    platform='imessage'
                                ))
                        except Exception as e:
                            current_app.logger.warning(f"Error converting message for AI: {str(e)}")
                            continue
                finally:
                    loop.close()
            except Exception as e:
                current_app.logger.warning(f"Could not fetch messages from iMessage for context: {str(e)}")
                # Continue without messages - AI will use metadata only
        
        # Convert conversation dict to Conversation object if needed
        if isinstance(conversation, dict):
            from app.models import ConversationMetrics
            metrics = ConversationMetrics(
                total_messages=conversation.get('messageCount', 0),
                user_messages=0,  # Will be calculated from messages
                partner_messages=0,  # Will be calculated from messages
                reciprocity=conversation.get('reciprocity', 0.5),
                avg_response_time=conversation.get('avgResponseTime'),
                last_message_time=None,
                days_since_contact=conversation.get('daysSinceContact'),
                common_topics=[]
            )
            
            conversation_obj = Conversation(
                user_id=conversation.get('userId', ''),
                partner_name=conversation.get('partnerName') or conversation.get('partner_name', 'Unknown'),
                partner_id=conversation.get('partnerId') or conversation.get('partner_id', ''),
                messages=messages_for_ai,  # Use fetched messages for AI context
                metrics=metrics,
                category=conversation.get('category', 'friends'),
                conversation_id=conversation_id
            )
        else:
            # Update existing Conversation object with fetched messages
            conversation.messages = messages_for_ai
        
        # Generate prompts with context from fetched messages
        prompts = ai_service.generate_prompts(
            conversation_obj if isinstance(conversation, dict) else conversation,
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


@conversations_bp.route('/<conversation_id>/tone', methods=['PUT'])
def update_conversation_tone(conversation_id):
    """
    Update conversation-specific tone preference
    
    Body:
        - tone: New tone (formal, friendly, playful)
    
    Returns:
        Updated conversation
    """
    
    try:
        data = request.get_json()
        
        if not data or 'tone' not in data:
            return jsonify({'error': 'tone is required in request body'}), 400
        
        new_tone = data['tone']
        
        if new_tone not in ['formal', 'friendly', 'playful']:
            return jsonify({'error': 'tone must be one of: formal, friendly, playful'}), 400
        
        # Get user_id from query params or request body
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats or request.get_json().get('userId') if request.get_json() else None
        
        # Try to get conversation to extract user_id if not provided
        if not user_id:
            # Try a cross-partition query to find the conversation
            try:
                # Query conversations container to find this conversation
                query = "SELECT * FROM c WHERE c.id = @id"
                parameters = [{"name": "@id", "value": conversation_id}]
                conversations = list(storage.conversations_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ))
                if conversations:
                    user_id = conversations[0].get('userId') or conversations[0].get('user_id')
            except Exception as e:
                current_app.logger.error(f"Error finding conversation: {str(e)}")
        
        if not user_id:
            return jsonify({'error': 'user_id is required. Provide as query param: ?user_id=...'}), 400
        
        # Get conversation
        conversation = storage.get_conversation(conversation_id, user_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Update tone using update_conversation method
        success = storage.update_conversation(conversation_id, user_id, {'tone': new_tone})
        
        if not success:
            return jsonify({'error': 'Failed to update conversation tone'}), 500
        
        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'tone': new_tone
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error updating conversation tone: {str(e)}")
        return jsonify({'error': 'Error updating tone'}), 500


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
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        
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
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
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