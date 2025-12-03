"""
Scheduling routes for managing prompts and catch-up sessions
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from app.services.azure_storage import storage
from app.utils.helpers import get_user_id, get_partner_name
import uuid

schedule_bp = Blueprint('schedule', __name__)


@schedule_bp.route('/prompts', methods=['GET'])
def get_scheduled_prompts():
    """
    Get scheduled prompts for a user

    Query Parameters:
        - userId: User ID (required)
        - status: Filter by status (pending, completed, cancelled) (optional)
        - limit: Maximum number of results (default: 50)
        - offset: Offset for pagination (default: 0)

    Returns:
        List of scheduled prompts
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        status_filter = request.args.get('status')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get scheduled prompts from storage
        all_prompts = storage.get_scheduled_prompts(user_id, status=status_filter, limit=limit + offset, offset=0)
        
        # Apply pagination (storage already filtered by status, but we need to paginate)
        total = len(all_prompts)
        prompts = all_prompts[offset:offset + limit]

        return jsonify({
            'success': True,
            'data': {
                'prompts': prompts,
                'total': total
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting scheduled prompts: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@schedule_bp.route('/prompts', methods=['POST'])
def schedule_prompt():
    """
    Schedule a new prompt

    Expected JSON body:
    {
        "userId": "user-id",
        "contactId": "contact-id",
        "prompt": "Prompt text",
        "scheduledTime": "ISO 8601 timestamp",
        "priority": "low|medium|high",
        "notes": "Optional notes"
    }

    Returns:
        Created scheduled prompt
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = get_user_id(data)
        contact_id = data.get('contactId')
        prompt = data.get('prompt')
        scheduled_time = data.get('scheduledTime')
        priority = data.get('priority', 'medium')
        notes = data.get('notes', '')

        if not all([user_id, contact_id, prompt, scheduled_time]):
            return jsonify({'error': 'userId, contactId, prompt, and scheduledTime are required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get contact
        contact = storage.get_conversation(contact_id, user_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        # Create scheduled prompt
        scheduled_prompt = {
            'id': str(uuid.uuid4()),
            'userId': user_id,
            'contactId': contact_id,
            'prompt': prompt,
            'scheduledTime': scheduled_time,
            'priority': priority,
            'status': 'pending',
            'notes': notes,
            'createdAt': datetime.now().isoformat()
        }

        # Save to storage
        prompt_id = storage.create_scheduled_prompt(scheduled_prompt)
        
        if not prompt_id:
            return jsonify({'error': 'Failed to create scheduled prompt'}), 500
        
        # Enrich with contact information for response
        scheduled_prompt['contact'] = {
            'id': contact.get('id'),
            'name': get_partner_name(contact) or 'Unknown',
            'status': contact.get('status', 'healthy')
        }

        return jsonify({
            'success': True,
            'data': {
                'scheduledPrompt': scheduled_prompt
            },
            'message': 'Prompt scheduled successfully'
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error scheduling prompt: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@schedule_bp.route('/prompts/<prompt_id>', methods=['PUT'])
def update_scheduled_prompt(prompt_id):
    """
    Update a scheduled prompt

    Expected JSON body: Partial prompt object with fields to update

    Returns:
        Updated scheduled prompt
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = get_user_id(data)
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400

        # Get existing prompt from storage
        prompts = storage.get_scheduled_prompts(user_id, limit=1000, offset=0)
        existing_prompt = next((p for p in prompts if p['id'] == prompt_id), None)
        
        if not existing_prompt:
            return jsonify({'error': 'Scheduled prompt not found'}), 404

        # Prepare updates (exclude userId and id from updates)
        updates = {k: v for k, v in data.items() if k not in ['userId', 'id']}
        
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        # Update in storage
        success = storage.update_scheduled_prompt(prompt_id, user_id, updates)
        
        if not success:
            return jsonify({'error': 'Failed to update scheduled prompt'}), 500

        # Get updated prompt
        updated_prompts = storage.get_scheduled_prompts(user_id, limit=1000, offset=0)
        updated_prompt = next((p for p in updated_prompts if p['id'] == prompt_id), None)

        return jsonify({
            'success': True,
            'data': {
                'scheduledPrompt': updated_prompt
            },
            'message': 'Prompt updated successfully'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error updating scheduled prompt: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@schedule_bp.route('/prompts/<prompt_id>', methods=['DELETE'])
def delete_scheduled_prompt(prompt_id):
    """
    Delete a scheduled prompt

    Query Parameters:
        - userId: User ID (required)

    Returns:
        Success message
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify prompt exists
        prompts = storage.get_scheduled_prompts(user_id, limit=1000, offset=0)
        existing_prompt = next((p for p in prompts if p['id'] == prompt_id), None)
        
        if not existing_prompt:
            return jsonify({'error': 'Scheduled prompt not found'}), 404

        # Delete from storage
        success = storage.delete_scheduled_prompt(prompt_id, user_id)
        
        if not success:
            return jsonify({'error': 'Failed to delete scheduled prompt'}), 500

        return jsonify({
            'success': True,
            'message': 'Prompt deleted successfully'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting scheduled prompt: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@schedule_bp.route('/catch-up', methods=['GET'])
def get_catch_up_suggestions():
    """
    Get catch-up suggestions for a user

    Query Parameters:
        - userId: User ID (required)
        - priority: Filter by priority (high, medium, low) (optional)
        - limit: Maximum number of results (default: 10)

    Returns:
        List of catch-up suggestions sorted by priority
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        priority_filter = request.args.get('priority')
        limit = int(request.args.get('limit', 10))

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

            # Calculate priority
            if days_since > 30 or status == 'wilted':
                priority = 'high'
            elif days_since > 14 or status == 'dormant':
                priority = 'medium'
            elif days_since > 7 or status == 'attention':
                priority = 'low'
            else:
                continue  # Skip recent conversations

            # Generate suggested prompt
            if days_since > 21:
                suggested_prompt = f"Hey! It's been a while - how have things been?"
            elif days_since > 14:
                suggested_prompt = f"Thinking of you! How's everything going?"
            else:
                suggested_prompt = f"Just wanted to check in and see how you're doing!"

            suggestion = {
                'contact': {
                    'id': conv.get('id'),
                    'name': get_partner_name(conv) or 'Unknown',
                    'status': status
                },
                'lastContact': conv.get('lastMessageAt'),
                'unreadMessages': 0,  # Placeholder
                'priority': priority,
                'suggestedPrompt': suggested_prompt,
                'context': {
                    'lastContact': f"{days_since} days ago",
                    'relationshipHealth': status,
                    'reciprocity': conv.get('reciprocity', 0.5),
                    'interactionFrequency': conv.get('interactionFrequency', 0)
                }
            }

            suggestions.append(suggestion)

        # Apply priority filter
        if priority_filter:
            suggestions = [s for s in suggestions if s['priority'] == priority_filter]

        # Sort by priority (high > medium > low) and days since contact
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        suggestions.sort(key=lambda x: (priority_order.get(x['priority'], 3),
                                       -int(x['context']['lastContact'].split()[0])))

        # Limit results
        suggestions = suggestions[:limit]
        total = len(suggestions)

        return jsonify({
            'success': True,
            'data': {
                'suggestions': suggestions,
                'total': total
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting catch-up suggestions: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@schedule_bp.route('/calendar', methods=['GET'])
def get_calendar_events():
    """
    Get calendar events for scheduled prompts

    Query Parameters:
        - userId: User ID (required)
        - start: Start date (ISO 8601)
        - end: End date (ISO 8601)

    Returns:
        List of calendar events
    """
    try:
        user_id = request.args.get('userId') or request.args.get('user_id')  # Support both formats
        start_date = request.args.get('start')
        end_date = request.args.get('end')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        if not start_date or not end_date:
            return jsonify({'error': 'start and end parameters are required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get scheduled prompts in date range
        all_prompts = storage.get_scheduled_prompts(user_id, limit=1000, offset=0)

        # Convert to calendar events
        events = []
        for prompt in all_prompts:
            scheduled_time = datetime.fromisoformat(prompt['scheduledTime'].replace('Z', '+00:00'))

            # Check if in date range
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

            if start <= scheduled_time <= end:
                event = {
                    'id': prompt['id'],
                    'title': f"Reach out to {prompt['contact']['name']}",
                    'start': prompt['scheduledTime'],
                    'end': (scheduled_time + timedelta(hours=1)).isoformat(),
                    'allDay': False,
                    'contact': prompt['contact'],
                    'priority': prompt['priority']
                }
                events.append(event)

        return jsonify({
            'success': True,
            'data': {
                'events': events
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting calendar events: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


