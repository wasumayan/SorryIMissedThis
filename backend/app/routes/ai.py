"""
AI-powered analysis routes for conversations and relationships
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.services.azure_storage import storage
from app.services.ai_service import AIService
from app.utils.helpers import get_user_id, get_conversation_id, get_partner_name

ai_bp = Blueprint('ai', __name__)
ai_service = AIService()


@ai_bp.route('/analyze-conversation', methods=['POST'])
def analyze_conversation():
    """
    Analyze a conversation using AI

    Expected JSON body:
    {
        "conversationId": "conversation-id",
        "userId": "user-id"
    }

    Returns:
        Detailed AI analysis of the conversation including sentiment, topics, and suggestions
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        conversation_id = get_conversation_id(data)
        user_id = get_user_id(data)

        if not conversation_id or not user_id:
            return jsonify({'error': 'conversationId and userId are required'}), 400

        # Get conversation
        conversation = storage.get_conversation(conversation_id, user_id)

        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404

        # Check if conversation has AI analysis already
        ai_analysis = conversation.get('aiAnalysis', {})

        # If no analysis or analysis is old, generate new one
        if not ai_analysis or not ai_analysis.get('lastAnalyzed'):
            # Generate analysis using AI service
            # For now, return structured placeholder data
            ai_analysis = {
                'summary': f"Regular conversation with {get_partner_name(conversation) or 'contact'} covering various topics",
                'sentiment': {
                    'overall': 'positive',
                    'userSentiment': 'positive',
                    'contactSentiment': 'positive'
                },
                'topics': [
                    {'topic': 'Work & Career', 'confidence': 0.85, 'mentions': 12},
                    {'topic': 'Family & Personal', 'confidence': 0.78, 'mentions': 8},
                    {'topic': 'Hobbies & Interests', 'confidence': 0.65, 'mentions': 5}
                ],
                'keyMoments': [
                    {
                        'timestamp': datetime.now().isoformat(),
                        'description': 'Discussed important life update',
                        'importance': 'high'
                    }
                ],
                'followUpSuggestions': [
                    {
                        'suggestion': 'Ask about the project mentioned last week',
                        'reason': 'They expressed excitement about it',
                        'priority': 'high',
                        'timing': 'soon'
                    },
                    {
                        'suggestion': 'Share updates about your own activities',
                        'reason': 'Maintain reciprocity in the relationship',
                        'priority': 'medium',
                        'timing': 'immediate'
                    }
                ],
                'communicationPatterns': {
                    'userStyle': 'conversational and engaged',
                    'contactStyle': 'responsive and friendly',
                    'reciprocity': conversation.get('reciprocity', 0.5)
                },
                'lastAnalyzed': datetime.now().isoformat()
            }

            # Update conversation with analysis
            storage.update_conversation(conversation_id, user_id, {'aiAnalysis': ai_analysis})

        return jsonify({
            'success': True,
            'data': {
                'analysis': ai_analysis
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error analyzing conversation: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@ai_bp.route('/generate-prompts', methods=['POST'])
def generate_prompts():
    """
    Generate AI-powered conversation prompts

    Expected JSON body:
    {
        "contactId": "contact-id",
        "userId": "user-id",
        "context": "optional context",
        "tone": "formal|friendly|playful"
    }

    Returns:
        List of suggested conversation prompts
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        contact_id = data.get('contactId')
        user_id = get_user_id(data)
        context = data.get('context', '')
        tone = data.get('tone', 'friendly')

        if not contact_id or not user_id:
            return jsonify({'error': 'contactId and userId are required'}), 400

        # Get conversation (contact)
        conversation = storage.get_conversation(contact_id, user_id)

        if not conversation:
            return jsonify({'error': 'Contact not found'}), 404

        # Generate prompts based on conversation history
        from app.utils.helpers import get_partner_name
        partner_name = get_partner_name(conversation) or 'your contact'
        days_since = conversation.get('daysSinceContact', 0)

        prompts = []

        # Prompt 1: Based on time since last contact
        if days_since > 14:
            prompts.append({
                'text': f"Hey {partner_name}! It's been a while - how have you been?",
                'reason': f"It's been {days_since} days since your last message",
                'tone': tone,
                'priority': 'high'
            })
        elif days_since > 7:
            prompts.append({
                'text': f"Thinking of you, {partner_name}. What's new?",
                'reason': 'Maintaining regular contact',
                'tone': tone,
                'priority': 'medium'
            })
        else:
            prompts.append({
                'text': f"Hey {partner_name}! How was your day?",
                'reason': 'Keeping the conversation flowing',
                'tone': tone,
                'priority': 'low'
            })

        # Prompt 2: Based on context or topics
        ai_analysis = conversation.get('aiAnalysis', {})
        topics = ai_analysis.get('topics', [])

        if topics:
            main_topic = topics[0].get('topic', 'things')
            prompts.append({
                'text': f"How's everything going with {main_topic.lower()}?",
                'reason': f'You often discuss {main_topic.lower()}',
                'tone': tone,
                'priority': 'medium'
            })

        # Prompt 3: Generic friendly prompt
        prompts.append({
            'text': f"Just wanted to check in and see how you're doing!",
            'reason': 'Showing you care',
            'tone': tone,
            'priority': 'low'
        })

        return jsonify({
            'success': True,
            'data': {
                'prompts': prompts
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error generating prompts: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@ai_bp.route('/analyze-relationship', methods=['POST'])
def analyze_relationship():
    """
    Analyze the health and dynamics of a relationship

    Expected JSON body:
    {
        "contactId": "contact-id",
        "userId": "user-id"
    }

    Returns:
        Relationship analysis with health score, insights, and recommendations
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        contact_id = data.get('contactId')
        user_id = get_user_id(data)

        if not contact_id or not user_id:
            return jsonify({'error': 'contactId and userId are required'}), 400

        # Get conversation (contact)
        conversation = storage.get_conversation(contact_id, user_id)

        if not conversation:
            return jsonify({'error': 'Contact not found'}), 404

        # Calculate health score
        reciprocity = conversation.get('reciprocity', 0.5)
        days_since = conversation.get('daysSinceContact', 0)
        message_count = conversation.get('messageCount', 0)

        # Health score algorithm (0-100)
        health_score = 0
        health_score += min(reciprocity * 40, 40)  # Max 40 points for reciprocity
        health_score += max(30 - days_since, 0)    # Max 30 points for recency
        health_score += min(message_count / 10, 30)  # Max 30 points for interaction volume

        health_score = min(int(health_score), 100)

        # Determine status
        if health_score >= 75:
            current_status = 'Thriving'
        elif health_score >= 50:
            current_status = 'Healthy'
        elif health_score >= 25:
            current_status = 'Needs Attention'
        else:
            current_status = 'At Risk'

        # Generate insights
        insights = []
        insights.append(f"Overall relationship health score: {health_score}/100")

        if reciprocity >= 0.7:
            insights.append("Great balance in conversation - both of you actively engage")
        elif reciprocity < 0.4:
            insights.append("Consider initiating more conversations to balance the dynamic")

        if days_since <= 3:
            insights.append("You're staying in regular contact - keep it up!")
        elif days_since > 14:
            insights.append(f"It's been {days_since} days since last contact - consider reaching out")

        # Communication patterns
        communication_patterns = {
            'averageResponseTime': conversation.get('avgResponseTime', 0),
            'reciprocity': reciprocity,
            'frequency': conversation.get('interactionFrequency', 0)
        }

        # Recent trends
        recent_trends = {
            'messageCount': message_count,
            'sentimentTrend': ['positive', 'positive', 'neutral'],  # Placeholder
            'topicDiversity': conversation.get('aiAnalysis', {}).get('topics', [])[:3]
        }

        # Recommendations
        recommendations = []

        if days_since > 7:
            recommendations.append({
                'type': 'outreach',
                'message': 'Consider reaching out soon',
                'action': 'Send a message asking how they\'re doing'
            })

        if reciprocity < 0.5:
            recommendations.append({
                'type': 'engagement',
                'message': 'Try to balance the conversation',
                'action': 'Initiate conversations more frequently'
            })

        if health_score >= 75:
            recommendations.append({
                'type': 'maintain',
                'message': 'Keep up the great communication!',
                'action': 'Continue your current interaction pattern'
            })

        return jsonify({
            'success': True,
            'data': {
                'analysis': {
                    'healthScore': health_score,
                    'currentStatus': current_status,
                    'insights': insights,
                    'communicationPatterns': communication_patterns,
                    'recentTrends': recent_trends,
                    'recommendations': recommendations
                }
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error analyzing relationship: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@ai_bp.route('/suggestions/daily', methods=['GET'])
def get_daily_suggestions():
    """
    Get AI-generated daily suggestions for outreach

    Query Parameters:
        - userId: User ID (required)
        - limit: Maximum number of suggestions (default: 5)

    Returns:
        List of daily suggestions prioritized by importance
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        limit = int(request.args.get('limit', 5))

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get all conversations
        conversations = storage.get_user_conversations(user_id)

        suggestions = []

        for conv in conversations:
            days_since = conv.get('daysSinceContact', 0)
            status = conv.get('status', 'healthy')
            reciprocity = conv.get('reciprocity', 0.5)

            # Prioritize based on days since contact and status
            priority = 'low'
            suggestion_text = ''
            suggestion_reason = ''

            partner_name = get_partner_name(conv) or 'contact'
            conversation_id = conv.get('id')
            
            # CONTEXT-AWARE: Get existing prompts or skip (let user generate via conversation view)
            # For daily suggestions, we'll use existing prompts if available, otherwise skip
            # This avoids expensive AI calls on every daily suggestions request
            try:
                existing_prompts = storage.get_conversation_prompts(conversation_id, unused_only=True)
                
                if existing_prompts and len(existing_prompts) > 0:
                    # Use existing prompt
                    prompt = existing_prompts[0]
                    suggestion_text = prompt.prompt_text
                    suggestion_reason = prompt.context or f'Last contact was {days_since} days ago'
                    priority = 'high' if days_since > 14 else ('medium' if days_since > 7 else 'low')
                else:
                    # No existing prompts - only suggest if it's been a while
                    # User can generate context-aware prompts when they click on the contact
                    if days_since > 7:
                        priority = 'high' if days_since > 14 else 'medium'
                        suggestion_text = f"Check in with {partner_name}"
                        suggestion_reason = f'Last contact was {days_since} days ago - click to generate personalized prompts'
                    elif reciprocity < 0.3:
                        priority = 'medium'
                        suggestion_text = f"Reach out to {partner_name}"
                        suggestion_reason = 'Low reciprocity - click to generate personalized prompts'
                    else:
                        # Skip - not urgent enough
                        continue
                    
            except Exception as e:
                current_app.logger.warning(f"Error getting prompts for {conversation_id}: {str(e)}")
                # Fallback to simple prompt only if urgent
                if days_since > 14:
                    priority = 'high' if status in ['dormant', 'wilted'] else 'medium'
                    suggestion_text = f"Check in with {partner_name}"
                    suggestion_reason = f'Last contact was {days_since} days ago'
                else:
                    continue

            if suggestion_text:
                suggestions.append({
                    'contact': {
                        'id': conversation_id,
                        'name': partner_name,
                        'status': status
                    },
                    'priority': priority,
                    'suggestion': {
                        'text': suggestion_text,
                        'reason': suggestion_reason or f'Last contact was {days_since} days ago'
                    },
                    'lastContact': conv.get('lastMessageAt')
                })

        # Sort by priority (high > medium > low) and days since contact
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        suggestions.sort(key=lambda x: (priority_order.get(x['priority'], 3),
                                       x.get('contact', {}).get('status') == 'wilted'))

        # Limit results
        suggestions = suggestions[:limit]

        return jsonify({
            'success': True,
            'data': {
                'suggestions': suggestions
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting daily suggestions: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
