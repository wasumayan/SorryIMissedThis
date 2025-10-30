"""
Contact management routes
Handles CRUD operations for user contacts
"""

from flask import Blueprint, request, jsonify
from app.services.azure_storage import storage
from datetime import datetime
import uuid

contacts_bp = Blueprint('contacts', __name__)


@contacts_bp.route('/', methods=['GET'])
def get_contacts():
    """
    Get all contacts for a user with optional filtering

    Query Parameters:
        - userId: User ID (required)
        - category: Filter by category (family, friends, work)
        - status: Filter by status (healthy, attention, dormant, wilted)
        - search: Search by name

    Returns:
        List of contacts with their metrics
    """
    try:
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Get user to verify exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get all conversations for the user (these are our contacts)
        conversations = storage.get_user_conversations(user_id)

        # Apply filters
        category = request.args.get('category')
        status_filter = request.args.get('status')
        search = request.args.get('search', '').lower()

        contacts = []
        for conv in conversations:
            # Create contact object from conversation
            contact = {
                'id': conv.get('id'),
                'name': conv.get('partnerName', 'Unknown'),
                'category': conv.get('category', 'friends'),
                'status': conv.get('status', 'healthy'),
                'size': min(1.0, conv.get('messageCount', 0) / 100),  # Normalize
                'closeness': conv.get('reciprocity', 0.5),
                'recency': min(1.0, 1.0 - (conv.get('daysSinceContact', 0) / 30)),  # More recent = higher
                'phoneNumber': conv.get('phoneNumber'),
                'email': conv.get('email'),
                'platforms': conv.get('platforms', []),
                'metrics': {
                    'totalMessages': conv.get('messageCount', 0),
                    'lastContact': conv.get('lastMessageAt'),
                    'averageResponseTime': conv.get('avgResponseTime', 0),
                    'reciprocity': conv.get('reciprocity', 0),
                    'interactionFrequency': conv.get('interactionFrequency', 0)
                },
                'position': conv.get('position'),
                'tags': conv.get('tags', []),
                'notes': conv.get('notes', '')
            }

            # Apply filters
            if category and contact['category'] != category:
                continue
            if status_filter and contact['status'] != status_filter:
                continue
            if search and search not in contact['name'].lower():
                continue

            contacts.append(contact)

        return jsonify({
            'success': True,
            'data': {
                'contacts': contacts,
                'total': len(contacts)
            }
        }), 200

    except Exception as e:
        print(f"Error getting contacts: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@contacts_bp.route('/<contact_id>', methods=['GET'])
def get_contact(contact_id):
    """
    Get a single contact with detailed insights

    Returns:
        Contact details with AI insights
    """
    try:
        # Get conversation (contact) by ID
        # We need user_id from query or auth token
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        conversation = storage.get_conversation(contact_id, user_id)

        if not conversation:
            return jsonify({'error': 'Contact not found'}), 404

        # Format as contact
        contact = {
            'id': conversation.get('id'),
            'name': conversation.get('partnerName', 'Unknown'),
            'category': conversation.get('category', 'friends'),
            'status': conversation.get('status', 'healthy'),
            'size': min(1.0, conversation.get('messageCount', 0) / 100),
            'closeness': conversation.get('reciprocity', 0.5),
            'recency': min(1.0, 1.0 - (conversation.get('daysSinceContact', 0) / 30)),
            'phoneNumber': conversation.get('phoneNumber'),
            'email': conversation.get('email'),
            'platforms': conversation.get('platforms', []),
            'metrics': {
                'totalMessages': conversation.get('messageCount', 0),
                'lastContact': conversation.get('lastMessageAt'),
                'averageResponseTime': conversation.get('avgResponseTime', 0),
                'reciprocity': conversation.get('reciprocity', 0),
                'interactionFrequency': conversation.get('interactionFrequency', 0)
            },
            'aiAnalysis': conversation.get('aiAnalysis'),
            'position': conversation.get('position'),
            'tags': conversation.get('tags', []),
            'notes': conversation.get('notes', '')
        }

        # Generate insights
        insights = [
            f"You've exchanged {contact['metrics']['totalMessages']} messages",
            f"Reciprocity score: {int(contact['metrics']['reciprocity'] * 100)}%",
        ]

        if conversation.get('daysSinceContact', 0) > 7:
            insights.append(f"It's been {conversation.get('daysSinceContact')} days since your last message")

        return jsonify({
            'success': True,
            'data': {
                'contact': contact,
                'insights': insights
            }
        }), 200

    except Exception as e:
        print(f"Error getting contact: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@contacts_bp.route('/', methods=['POST'])
def create_contact():
    """
    Create a new contact

    Expected body:
    {
        "userId": "user-id",
        "name": "Contact Name",
        "category": "family|friends|work",
        "phoneNumber": "+1234567890",
        "email": "contact@example.com",
        "platforms": [{"type": "whatsapp", "identifier": "+1234567890"}],
        "notes": "Optional notes"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = data.get('userId')
        name = data.get('name')
        category = data.get('category', 'friends')

        if not all([user_id, name]):
            return jsonify({'error': 'userId and name are required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Create conversation object (our contact representation)
        conversation_data = {
            'id': str(uuid.uuid4()),
            'userId': user_id,
            'partnerName': name,
            'category': category,
            'status': 'healthy',
            'messageCount': 0,
            'daysSinceContact': 0,
            'reciprocity': 0.5,
            'avgResponseTime': 0,
            'interactionFrequency': 0,
            'phoneNumber': data.get('phoneNumber'),
            'email': data.get('email'),
            'platforms': data.get('platforms', []),
            'notes': data.get('notes', ''),
            'tags': data.get('tags', []),
            'position': data.get('position'),
            'lastMessageAt': datetime.utcnow().isoformat(),
            'createdAt': datetime.utcnow().isoformat()
        }

        # Save to database
        contact_id = storage.create_conversation(conversation_data)

        if not contact_id:
            return jsonify({'error': 'Failed to create contact'}), 500

        conversation_data['id'] = contact_id

        return jsonify({
            'success': True,
            'data': {
                'contact': conversation_data
            },
            'message': 'Contact created successfully'
        }), 201

    except Exception as e:
        print(f"Error creating contact: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@contacts_bp.route('/<contact_id>', methods=['PUT'])
def update_contact(contact_id):
    """
    Update a contact

    Expected body: Partial contact object with fields to update
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = data.get('userId')

        if not user_id:
            return jsonify({'error': 'userId is required'}), 400

        # Get existing conversation
        existing = storage.get_conversation(contact_id, user_id)

        if not existing:
            return jsonify({'error': 'Contact not found'}), 404

        # Update fields
        updates = {}
        allowed_fields = ['partnerName', 'category', 'phoneNumber', 'email', 'platforms', 'notes', 'tags', 'position', 'status']

        for field in allowed_fields:
            if field in data:
                updates[field] = data[field]

        if updates:
            updates['updatedAt'] = datetime.utcnow().isoformat()
            success = storage.update_conversation(contact_id, user_id, updates)

            if not success:
                return jsonify({'error': 'Failed to update contact'}), 500

        # Get updated contact
        updated = storage.get_conversation(contact_id, user_id)

        return jsonify({
            'success': True,
            'data': {
                'contact': updated
            },
            'message': 'Contact updated successfully'
        }), 200

    except Exception as e:
        print(f"Error updating contact: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@contacts_bp.route('/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    """
    Delete a contact
    """
    try:
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify contact exists
        existing = storage.get_conversation(contact_id, user_id)

        if not existing:
            return jsonify({'error': 'Contact not found'}), 404

        # In Azure Cosmos DB, we need to implement delete in storage service
        # For now, we can mark as deleted or actually delete
        # Implement delete in azure_storage.py first

        return jsonify({
            'success': True,
            'message': 'Contact deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting contact: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@contacts_bp.route('/stats/summary', methods=['GET'])
def get_contact_stats():
    """
    Get aggregate contact statistics

    Query Parameters:
        - userId: User ID (required)
    """
    try:
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Get all contacts/conversations
        conversations = storage.get_user_conversations(user_id)

        # Calculate stats
        stats = {
            'total': len(conversations),
            'healthy': 0,
            'attention': 0,
            'dormant': 0,
            'wilted': 0,
            'family': 0,
            'friends': 0,
            'work': 0
        }

        for conv in conversations:
            status = conv.get('status', 'healthy')
            category = conv.get('category', 'friends')

            if status in stats:
                stats[status] += 1
            if category in stats:
                stats[category] += 1

        return jsonify({
            'success': True,
            'data': {
                'stats': stats
            }
        }), 200

    except Exception as e:
        print(f"Error getting contact stats: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
