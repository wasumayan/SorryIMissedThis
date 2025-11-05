"""
Analytics routes for user insights and trends
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from app.services.azure_storage import storage

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/overview', methods=['GET'])
def get_analytics_overview():
    """
    Get analytics overview for a user

    Query Parameters:
        - userId: User ID (required)
        - period: Time period (7d, 30d, 90d, all) (default: 30d)

    Returns:
        Analytics overview with contact stats, conversation metrics, and trends
    """
    try:
        user_id = request.args.get('userId')
        period = request.args.get('period', '30d')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get all conversations for the user
        conversations = storage.get_user_conversations(user_id)

        # Calculate contact stats
        contact_stats = {
            'total': len(conversations),
            'healthy': 0,
            'attention': 0,
            'dormant': 0,
            'wilted': 0,
            'family': 0,
            'friends': 0,
            'work': 0
        }

        total_messages = 0
        total_response_time = 0
        response_time_count = 0

        for conv in conversations:
            # Count by status
            status = conv.get('status', 'healthy')
            if status in contact_stats:
                contact_stats[status] += 1

            # Count by category
            category = conv.get('category', 'friends')
            if category in contact_stats:
                contact_stats[category] += 1

            # Aggregate metrics
            total_messages += conv.get('messageCount', 0)
            avg_response_time = conv.get('avgResponseTime', 0) or 0
            if avg_response_time > 0:
                total_response_time += avg_response_time
                response_time_count += 1

        # Conversation metrics
        conversation_metrics = {
            'totalMessages': total_messages,
            'totalConversations': len(conversations),
            'avgMessagesPerConversation': round(total_messages / len(conversations), 1) if conversations else 0,
            'avgResponseTime': round(total_response_time / response_time_count, 1) if response_time_count > 0 else 0
        }

        # Weekly activity (simplified - you'd want to aggregate by actual dates)
        weekly_activity = []
        for i in range(4):
            weekly_activity.append({
                '_id': {'year': datetime.now().year, 'week': datetime.now().isocalendar()[1] - i},
                'messages': total_messages // 4,  # Simplified distribution
                'conversations': len(conversations) // 4
            })

        # Topic diversity (extract from conversation analysis)
        topic_diversity = []
        topic_counts = {}

        for conv in conversations:
            ai_analysis = conv.get('aiAnalysis', {})
            topics = ai_analysis.get('topics', [])
            for topic in topics:
                topic_name = topic.get('topic', 'General')
                topic_counts[topic_name] = topic_counts.get(topic_name, 0) + 1

        for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            topic_diversity.append({
                '_id': topic,
                'count': count,
                'confidence': 0.8  # Placeholder
            })

        # Health trends
        health_trends = [
            {
                '_id': status,
                'count': contact_stats[status],
                'avgReciprocity': 0.75,  # Placeholder
                'avgLastContact': 7  # Placeholder
            }
            for status in ['healthy', 'attention', 'dormant', 'wilted']
            if contact_stats[status] > 0
        ]

        return jsonify({
            'success': True,
            'data': {
                'overview': {
                    'contacts': contact_stats,
                    'conversations': conversation_metrics,
                    'weeklyActivity': weekly_activity,
                    'topicDiversity': topic_diversity,
                    'healthTrends': health_trends,
                    'period': period
                }
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting analytics overview: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@analytics_bp.route('/contacts/<contact_id>', methods=['GET'])
def get_contact_analytics(contact_id):
    """
    Get detailed analytics for a specific contact

    Query Parameters:
        - userId: User ID (required)

    Returns:
        Detailed contact analytics including conversation history and patterns
    """
    try:
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Get conversation (contact)
        conversation = storage.get_conversation(contact_id, user_id)

        if not conversation:
            return jsonify({'error': 'Contact not found'}), 404

        # Monthly metrics (simplified)
        monthly_metrics = []
        for i in range(6):
            month_date = datetime.now() - timedelta(days=30 * i)
            monthly_metrics.append({
                '_id': {'year': month_date.year, 'month': month_date.month},
                'messages': conversation.get('messageCount', 0) // 6,  # Simplified
                'conversations': 1,
                'avgResponseTime': conversation.get('avgResponseTime', 0)
            })

        # Sentiment trends
        sentiment_trends = [
            {'_id': 'positive', 'count': 12},
            {'_id': 'neutral', 'count': 8},
            {'_id': 'negative', 'count': 2}
        ]

        # Communication patterns
        communication_patterns = {
            'mostActiveDay': 'Wednesday',
            'mostActiveHour': 14,
            'averageResponseTime': conversation.get('avgResponseTime', 0),
            'reciprocity': conversation.get('reciprocity', 0.5),
            'interactionFrequency': conversation.get('interactionFrequency', 0)
        }

        # Generate insights
        insights = [
            f"You've exchanged {conversation.get('messageCount', 0)} messages",
            f"Reciprocity score: {int(conversation.get('reciprocity', 0.5) * 100)}%"
        ]

        days_since = conversation.get('daysSinceContact', 0) or 0
        if days_since > 7:
            insights.append(f"It's been {days_since} days since your last message")

        return jsonify({
            'success': True,
            'data': {
                'analytics': {
                    'contact': {
                        'id': conversation.get('id'),
                        'name': conversation.get('partnerName', 'Unknown'),
                        'status': conversation.get('status', 'healthy'),
                        'metrics': {
                            'totalMessages': conversation.get('messageCount', 0),
                            'lastContact': conversation.get('lastMessageAt'),
                            'averageResponseTime': conversation.get('avgResponseTime', 0),
                            'reciprocity': conversation.get('reciprocity', 0),
                            'interactionFrequency': conversation.get('interactionFrequency', 0)
                        }
                    },
                    'conversations': 1,
                    'monthlyMetrics': monthly_metrics,
                    'sentimentTrends': sentiment_trends,
                    'communicationPatterns': communication_patterns,
                    'insights': insights
                }
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contact analytics: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@analytics_bp.route('/trends', methods=['GET'])
def get_trends():
    """
    Get relationship trends over time

    Query Parameters:
        - userId: User ID (required)
        - period: Time period (30d, 90d, 180d, all) (default: 90d)

    Returns:
        Trend data including health trends, communication trends, and revived connections
    """
    try:
        user_id = request.args.get('userId')
        period = request.args.get('period', '90d')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get all conversations
        conversations = storage.get_user_conversations(user_id)

        # Health trends
        health_trends = []
        status_counts = {}

        for conv in conversations:
            status = conv.get('status', 'healthy')
            status_counts[status] = status_counts.get(status, 0) + 1

        for status, count in status_counts.items():
            health_trends.append({
                '_id': status,
                'count': count,
                'avgReciprocity': 0.75  # Placeholder - would calculate from actual data
            })

        # Communication trends (by month)
        communication_trends = []
        for i in range(6):
            month_date = datetime.now() - timedelta(days=30 * i)
            total_msgs = sum(conv.get('messageCount', 0) for conv in conversations) // 6
            communication_trends.append({
                '_id': {'year': month_date.year, 'month': month_date.month},
                'totalMessages': total_msgs,
                'totalConversations': len(conversations),
                'avgResponseTime': 2.5  # Placeholder
            })

        # Revived connections (contacts that were dormant but are now active)
        revived_connections = []
        for conv in conversations:
            if conv.get('status') == 'healthy' and conv.get('daysSinceContact', 0) < 7:
                # Check if was previously dormant (simplified logic)
                revived_connections.append({
                    'id': conv.get('id'),
                    'name': conv.get('partnerName', 'Unknown'),
                    'status': conv.get('status', 'healthy'),
                    'metrics': {
                        'totalMessages': conv.get('messageCount', 0),
                        'reciprocity': conv.get('reciprocity', 0)
                    }
                })

        return jsonify({
            'success': True,
            'data': {
                'trends': {
                    'healthTrends': health_trends,
                    'communicationTrends': communication_trends,
                    'revivedConnections': revived_connections[:5],  # Top 5
                    'period': period
                }
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting trends: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
