"""
Recommendations routes for generating conversation prompts
"""

from datetime import datetime
from typing import Any, Dict, List

from flask import Blueprint, request, jsonify, current_app

from app.services.azure_storage import storage
from app.services.ai_service import AIService
from app.models import Message as SimtMessage, Conversation as SimtConversation, ConversationMetrics as SimtConversationMetrics


recommendations_bp = Blueprint('recommendations', __name__)
ai_service = AIService()


def _storage_has_persistence() -> bool:
    return getattr(storage, 'database', None) is not None


def _get_user_record(user_id: str) -> Any:
    getter = getattr(storage, 'get_user', None)
    if callable(getter):
        return getter(user_id)

    getter = getattr(storage, 'get_user_by_id', None)
    if callable(getter):
        return getter(user_id)

    return None


def _build_mock_recommendations(user_id: str, category: str, regenerate: bool = False) -> Dict[str, Any]:
    now = datetime.utcnow()
    mock_prompts = [
        {
            'prompt_id': 'mock-1',
            'text': "Hey Jane! Did you end up registering for COS 324 yet?",
            'type': 'follow_up',
            'context': 'Checking on Jane’s course selection',
            'confidence': 0.83,
        },
        {
            'prompt_id': 'mock-2',
            'text': "I just grabbed a spot in COS 324—want to sync our schedules?",
            'type': 'check_in',
            'context': 'Coordinating class schedules',
            'confidence': 0.79,
        },
        {
            'prompt_id': 'mock-3',
            'text': "Let’s plan a study group once the first COS 324 project drops!",
            'type': 'reconnect',
            'context': 'Planning to meet about class work',
            'confidence': 0.81,
        },
    ]

    mock_messages: List[Dict[str, Any]] = [
        {
            'timestamp': (now.replace(minute=5, second=0, microsecond=0)).isoformat(),
            'sender': 'Bob',
            'content': "Hey Jane, did you decide which COS classes you're taking next semester?",
        },
        {
            'timestamp': (now.replace(minute=6, second=0, microsecond=0)).isoformat(),
            'sender': 'Jane',
            'content': "Still deciding! I’m leaning toward COS 324 if I can handle the workload.",
        },
        {
            'timestamp': (now.replace(minute=7, second=0, microsecond=0)).isoformat(),
            'sender': 'Bob',
            'content': "You should! I loved the projects last year—lots of hands-on ML.",
        },
        {
            'timestamp': (now.replace(minute=9, second=30, microsecond=0)).isoformat(),
            'sender': 'Jane',
            'content': "That’s super helpful, thanks. Did you also take COS 326?",
        },
        {
            'timestamp': (now.replace(minute=10, second=15, microsecond=0)).isoformat(),
            'sender': 'Bob',
            'content': "Not yet, but I’m planning on it after COS 324. Want to pair up for the first assignment?",
        },
    ]

    # Optionally generate prompts via AI using the synthetic conversation
    generated_prompts: List[Dict[str, Any]] = []
    if regenerate:
        print("PRINT 4.7: _build_mock_recommendations called with regenerate=True, calling ai_service.generate_prompts", flush=True)
        current_app.logger.info(
            "PRINT 4.7: _build_mock_recommendations called with regenerate=True, calling ai_service.generate_prompts")
        try:
            simt_messages = [
                SimtMessage(
                    timestamp=datetime.fromisoformat(m['timestamp']),
                    sender=m['sender'],
                    content=m['content'],
                ) for m in mock_messages
            ]
            metrics = SimtConversationMetrics(
                total_messages=len(simt_messages),
                user_messages=sum(
                    1 for m in simt_messages if m.sender == 'Bob'),
                partner_messages=sum(
                    1 for m in simt_messages if m.sender == 'Jane'),
                reciprocity=0.5,
                avg_response_time=None,
                last_message_time=datetime.fromisoformat(
                    mock_messages[-1]['timestamp']),
                days_since_contact=9,
                common_topics=['COS 324', 'Schedules', 'Projects']
            )
            conv = SimtConversation(
                user_id=user_id,
                partner_name='Jane',
                partner_id=f"{user_id}_jane",
                messages=simt_messages,
                metrics=metrics,
                category='attention'
            )
            ai_prompts = ai_service.generate_prompts(conv, num_prompts=3)
            for p in ai_prompts:
                generated_prompts.append({
                    'prompt_id': getattr(p, 'prompt_id', None),
                    'text': getattr(p, 'prompt_text', ''),
                    'type': getattr(p, 'prompt_type', ''),
                    'context': getattr(p, 'context', ''),
                    'confidence': getattr(p, 'confidence_score', 0.8),
                })
        except Exception as gen_err:  # noqa: BLE001
            current_app.logger.warning(
                "Mock AI generation failed: %s", gen_err)

    prompts_out = generated_prompts if generated_prompts else mock_prompts

    mock_conversation = {
        'conversation_id': 'mock-conversation',
        'partner_name': 'Jane',
        'relationship_health': 'attention',
        'metrics': {
            'total_messages': len(mock_messages),
            'days_since_contact': 9,
            'reciprocity': 0.5,
            'common_topics': ['COS 324', 'Schedules', 'Projects'],
            'last_message_time': now.isoformat(),
        },
        'messages': mock_messages,
        'last_message_time': now.isoformat(),
        'prompts': prompts_out,
    }

    return {
        'user_id': user_id,
        'category': category,
        'total_conversations': 1,
        'conversations': [mock_conversation],
        'mock': True,
    }


def _extract_value(item: Any, key: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _extract_metrics(conversation: Any) -> Dict[str, Any]:
    metrics = _extract_value(conversation, 'metrics', {}) or {}

    if not isinstance(metrics, dict):
        metrics = {
            'total_messages': _extract_value(metrics, 'total_messages'),
            'days_since_contact': _extract_value(metrics, 'days_since_contact'),
            'reciprocity': _extract_value(metrics, 'reciprocity'),
            'common_topics': _extract_value(metrics, 'common_topics') or [],
            'last_message_time': _extract_value(metrics, 'last_message_time'),
        }

    return metrics


def _relationship_health(conversation: Any) -> str:
    if hasattr(conversation, 'get_relationship_health'):
        try:
            return conversation.get_relationship_health()
        except Exception:  # noqa: BLE001
            pass

    return _extract_value(conversation, 'relationship_health', 'unknown')


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
    print("PRINT 3: get_recommendations() called", flush=True)
    current_app.logger.info("PRINT 3: get_recommendations() called")
    try:
        # Get parameters
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        category = request.args.get('category', 'all')
        regenerate = request.args.get('regenerate', 'false').lower() == 'true'
        print(
            f"PRINT 4: Parameters - user_id={user_id}, category={category}, regenerate={regenerate}", flush=True)
        current_app.logger.info(
            f"PRINT 4: Parameters - user_id={user_id}, category={category}, regenerate={regenerate}")

        if not user_id:
            return jsonify({'error': 'user_id parameter is required'}), 400

        # Check if user exists
        try:
            user = _get_user_record(user_id)
        except Exception as lookup_error:  # noqa: BLE001
            current_app.logger.warning(
                "User lookup failed for %s: %s", user_id, lookup_error
            )
            user = None

        if not user:
            if not _storage_has_persistence():
                print(
                    "PRINT 4.5: No user found, no persistence - using mock recommendations", flush=True)
                current_app.logger.info(
                    "PRINT 4.5: No user found, no persistence - using mock recommendations")
                return jsonify(_build_mock_recommendations(user_id, category, regenerate)), 200
            return jsonify({'error': 'User not found'}), 404

        # Get conversations based on category
        if category == 'dormant':
            conversations = storage.get_dormant_conversations(
                user_id, days_threshold=14)
        elif category == 'active':
            all_conversations = storage.get_user_conversations(user_id)
            conversations = [
                c for c in all_conversations if _relationship_health(c) == 'healthy']
        else:
            conversations = storage.get_user_conversations(user_id)

        if not conversations:
            if not _storage_has_persistence():
                print(
                    "PRINT 4.6: No conversations found, no persistence - using mock recommendations", flush=True)
                current_app.logger.info(
                    "PRINT 4.6: No conversations found, no persistence - using mock recommendations")
                return jsonify(_build_mock_recommendations(user_id, category, regenerate)), 200

            return jsonify({
                'user_id': user_id,
                'conversations': [],
                'message': 'No conversations found. Please upload chat transcripts first.'
            }), 200

        # Prepare recommendations
        recommendations: List[Dict[str, Any]] = []

        for conversation in conversations:
            conversation_id = _extract_value(
                conversation, 'conversation_id', _extract_value(conversation, 'id'))

            # Get conversation-specific tone
            # First check if conversation has explicit tone setting
            conversation_tone = _extract_value(conversation, 'tone')
            
            # If no explicit tone, determine from category
            if not conversation_tone:
                category = _extract_value(conversation, 'category', 'friends')
                # Default tones based on category
                category_tone_map = {
                    'work': 'formal',
                    'family': 'friendly',
                    'friends': 'friendly'
                }
                conversation_tone = category_tone_map.get(category, 'friendly')
            
            print(f"PRINT 4.8: Using conversation-specific tone for {_extract_value(conversation, 'partner_name', 'Unknown')}: {conversation_tone}", flush=True)
            current_app.logger.info(f"Using conversation-specific tone: {conversation_tone}")

            # Get existing prompts or generate new ones
            if regenerate:
                print(
                    f"PRINT 5: About to call ai_service.generate_prompts() for conversation {conversation_id} with tone {conversation_tone}", flush=True)
                current_app.logger.info(
                    f"PRINT 5: About to call ai_service.generate_prompts() for conversation {conversation_id} with tone {conversation_tone}")
                prompts = ai_service.generate_prompts(
                    conversation, num_prompts=3, user_tone_preference=conversation_tone)
                print(
                    f"PRINT 6: Returned from ai_service.generate_prompts(), got {len(prompts)} prompts", flush=True)
                current_app.logger.info(
                    f"PRINT 6: Returned from ai_service.generate_prompts(), got {len(prompts)} prompts")
                for prompt in prompts:
                    prompt.conversation_id = conversation_id
                    storage.save_prompt(prompt)
            else:
                prompts = storage.get_conversation_prompts(
                    conversation_id, unused_only=True)

                # Generate if no unused prompts available
                if not prompts:
                    print(
                        f"PRINT 5: About to call ai_service.generate_prompts() for conversation {conversation_id} (no unused prompts) with tone {conversation_tone}", flush=True)
                    current_app.logger.info(
                        f"PRINT 5: About to call ai_service.generate_prompts() for conversation {conversation_id} (no unused prompts) with tone {conversation_tone}")
                    prompts = ai_service.generate_prompts(
                        conversation, num_prompts=3, user_tone_preference=conversation_tone)
                    print(
                        f"PRINT 6: Returned from ai_service.generate_prompts(), got {len(prompts)} prompts", flush=True)
                    current_app.logger.info(
                        f"PRINT 6: Returned from ai_service.generate_prompts(), got {len(prompts)} prompts")
                    for prompt in prompts:
                        prompt.conversation_id = conversation_id
                        storage.save_prompt(prompt)

            metrics = _extract_metrics(conversation)
            last_message = metrics.get('last_message_time')
            if hasattr(last_message, 'isoformat'):
                last_message_time = last_message.isoformat()  # datetime
            else:
                last_message_time = last_message

            # Format recommendation
            recommendation = {
                'conversation_id': conversation_id,
                'partner_name': _extract_value(conversation, 'partner_name', 'Unknown'),
                'relationship_health': _relationship_health(conversation),
                'metrics': {
                    'total_messages': metrics.get('total_messages'),
                    'days_since_contact': metrics.get('days_since_contact'),
                    'reciprocity': round(metrics.get('reciprocity', 0.0), 2)
                    if metrics.get('reciprocity') is not None else None,
                    'common_topics': (metrics.get('common_topics') or [])[:5]
                },
                'last_message_time': last_message_time,
                'prompts': [
                    {
                        'prompt_id': _extract_value(p, 'prompt_id'),
                        'text': _extract_value(p, 'prompt_text'),
                        'type': _extract_value(p, 'prompt_type'),
                        'context': _extract_value(p, 'context'),
                        'confidence': round(_extract_value(p, 'confidence_score', 0.0), 2),
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

        print("PRINT 22: Returning recommendations response", flush=True)
        current_app.logger.info("PRINT 22: Returning recommendations response")
        return jsonify({
            'user_id': user_id,
            'category': category,
            'total_conversations': len(recommendations),
            'conversations': recommendations
        }), 200

    except Exception as e:
        current_app.logger.error(
            f"Error getting recommendations: {str(e)}", exc_info=True)
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
        user_id = (data.get('userId') or data.get('user_id')) if data else None  # Support both formats

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
        user = _get_user_record(user_id)
        if not user:
            if not _storage_has_persistence():
                mock_response = _build_mock_recommendations(user_id, 'all')
                return jsonify({
                    'user_id': user_id,
                    'display_name': 'Mock User',
                    'overview': {
                        'total_conversations': mock_response['total_conversations'],
                        'total_messages': mock_response['conversations'][0]['metrics']['total_messages'],
                        'active_conversations': 0,
                        'dormant_conversations': 1,
                    },
                    'relationship_health': {
                        'healthy': 0,
                        'attention': 1,
                        'dormant': 0,
                        'at_risk': 0,
                    },
                    'categories': {
                        'friends': 1
                    },
                    'last_updated': datetime.utcnow().isoformat()
                }), 200
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
            health = _relationship_health(conv)
            if health in health_breakdown:
                health_breakdown[health] += 1

        # Get category breakdown
        category_breakdown = {}
        for conv in conversations:
            category = _extract_value(conv, 'category', 'general')
            category_breakdown[category] = category_breakdown.get(
                category, 0) + 1

        display_name = _extract_value(user, 'display_name', 'User')
        last_login = _extract_value(user, 'last_login')
        if hasattr(last_login, 'isoformat'):
            last_login_iso = last_login.isoformat()
        else:
            last_login_iso = last_login or datetime.utcnow().isoformat()

        return jsonify({
            'user_id': user_id,
            'display_name': display_name,
            'overview': stats,
            'relationship_health': health_breakdown,
            'categories': category_breakdown,
            'last_updated': last_login_iso
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({'error': 'Error retrieving statistics'}), 500
