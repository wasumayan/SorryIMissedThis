"""
Study routes for managing 3-condition research experiment
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from app.services.azure_storage import storage
from app.models.study import (
    StudyParticipant,
    StudyMetrics,
    SurveyResponse,
    get_counterbalanced_order
)
import uuid

study_bp = Blueprint('study', __name__)


@study_bp.route('/enroll', methods=['POST'])
def enroll_participant():
    """
    Enroll a user in the study

    Expected JSON body:
    {
        "userId": "user-id"
    }

    Returns:
        Study participant info with assigned condition order
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')

        if not user_id:
            return jsonify({'error': 'userId is required'}), 400

        # Check if already enrolled
        existing = storage.get_study_participant(user_id)
        if existing:
            return jsonify({
                'success': False,
                'error': 'User already enrolled in study',
                'data': existing
            }), 400

        # Get participant count for counterbalancing
        participant_count = storage.get_study_participant_count()

        # Create study participant
        participant = StudyParticipant(
            user_id=user_id,
            participant_id=f"P{participant_count + 1:03d}",  # P001, P002, etc.
            enrolled_date=datetime.now(),
            condition_order=get_counterbalanced_order(participant_count),
            current_condition_index=0,
            study_start_date=datetime.now(),
            study_end_date=datetime.now() + timedelta(days=3),
            completed_conditions=[],
            is_study_complete=False
        )

        # Save to storage
        success = storage.save_study_participant(participant)

        if not success:
            return jsonify({'error': 'Failed to enroll participant'}), 500

        return jsonify({
            'success': True,
            'data': {
                'participant': participant.to_dict(),
                'message': f'Enrolled as {participant.participant_id}'
            }
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error enrolling participant: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/status', methods=['GET'])
def get_study_status():
    """
    Get current study status for a user

    Query Parameters:
        - userId: User ID (required)

    Returns:
        Current condition, day, and progress
    """
    try:
        user_id = request.args.get('userId')

        if not user_id:
            return jsonify({'error': 'userId parameter is required'}), 400

        participant = storage.get_study_participant(user_id)

        if not participant:
            return jsonify({
                'success': True,
                'data': {
                    'enrolled': False,
                    'message': 'Not enrolled in study'
                }
            }), 200

        # Check if condition should auto-advance
        now = datetime.now()
        if now >= participant.current_condition_end and not participant.is_study_complete:
            # Time to advance to next condition
            # But only if survey is completed
            survey = storage.get_survey_response(user_id, participant.current_condition)
            if survey:
                participant.current_condition_index += 1
                participant.completed_conditions.append(participant.current_condition)

                if participant.current_condition_index >= len(participant.condition_order):
                    participant.is_study_complete = True

                storage.save_study_participant(participant)

        return jsonify({
            'success': True,
            'data': {
                'enrolled': True,
                'participant': participant.to_dict(),
                'needsSurvey': now >= participant.current_condition_end and
                               not storage.get_survey_response(user_id, participant.current_condition)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting study status: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/advance-condition', methods=['POST'])
def advance_condition():
    """
    Manually advance to next condition (no survey required)

    Expected JSON body:
    {
        "userId": "user-id"
    }

    Returns:
        Updated participant info
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')

        if not user_id:
            return jsonify({'error': 'userId is required'}), 400

        participant_dict = storage.get_study_participant(user_id)

        if not participant_dict:
            return jsonify({'error': 'Participant not found'}), 404

        current_condition = participant_dict.get('currentCondition')
        current_index = participant_dict.get('currentConditionIndex', 0)
        condition_order = participant_dict.get('conditionOrder', [])
        completed_conditions = participant_dict.get('completedConditions', [])

        # Advance condition (no survey check required)
        if current_condition not in completed_conditions:
            completed_conditions.append(current_condition)

        current_index += 1
        is_complete = current_index >= len(condition_order)

        # Update participant
        participant_dict['currentConditionIndex'] = current_index
        participant_dict['completedConditions'] = completed_conditions
        participant_dict['isStudyComplete'] = is_complete

        # Reconstruct StudyParticipant object for saving
        from app.models.study import StudyParticipant
        participant = StudyParticipant(
            user_id=participant_dict['userId'],
            participant_id=participant_dict['participantId'],
            enrolled_date=datetime.fromisoformat(participant_dict['enrolledDate']),
            condition_order=condition_order,
            current_condition_index=current_index,
            study_start_date=datetime.fromisoformat(participant_dict['studyStartDate']),
            study_end_date=datetime.fromisoformat(participant_dict['studyEndDate']),
            completed_conditions=completed_conditions,
            is_study_complete=is_complete
        )

        storage.save_study_participant(participant)

        return jsonify({
            'success': True,
            'data': {
                'participant': participant.to_dict(),
                'message': 'Advanced to next phase!' if not is_complete else 'Study complete!'
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error advancing condition: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/survey', methods=['POST'])
def submit_survey():
    """
    Submit post-condition survey

    Expected JSON body:
    {
        "userId": "user-id",
        "condition": "no_prompt" | "generic_prompt" | "context_aware",
        "responses": {
            "perceivedConnectedness": 1-5,
            "authenticity": 1-5,
            ...
        }
    }

    Returns:
        Success confirmation
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')
        condition = data.get('condition')
        responses = data.get('responses', {})

        if not user_id or not condition:
            return jsonify({'error': 'userId and condition are required'}), 400

        # Validate participant exists
        participant = storage.get_study_participant(user_id)
        if not participant:
            return jsonify({'error': 'Participant not found'}), 404

        # Create survey response
        survey = SurveyResponse(
            user_id=user_id,
            condition=condition,
            completed_at=datetime.now(),
            perceived_connectedness=responses.get('perceivedConnectedness', 3),
            authenticity=responses.get('authenticity', 3),
            enjoyment=responses.get('enjoyment', 3),
            ease_of_conversation=responses.get('easeOfConversation', 3),
            prompt_helpfulness=responses.get('promptHelpfulness'),
            prompt_relevance=responses.get('promptRelevance'),
            edit_reasons=responses.get('editReasons', ''),
            overall_quality_vs_typical=responses.get('overallQualityVsTypical', 3),
            communication_frequency=responses.get('communicationFrequency', ''),
            overall_satisfaction=responses.get('overallSatisfaction', 3),
            likes=responses.get('likes', ''),
            difficulties=responses.get('difficulties', ''),
            suggestions=responses.get('suggestions', '')
        )

        # Save survey
        success = storage.save_survey_response(survey)

        if not success:
            return jsonify({'error': 'Failed to save survey'}), 500

        return jsonify({
            'success': True,
            'data': {
                'message': 'Survey submitted successfully',
                'canAdvance': True
            }
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error submitting survey: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/metrics/log', methods=['POST'])
def log_metric():
    """
    Log a study metric event

    Expected JSON body:
    {
        "userId": "user-id",
        "action": "message_sent" | "prompt_shown" | "prompt_accepted" | "prompt_edited" | "prompt_dismissed",
        "data": { ... additional context ... }
    }

    Returns:
        Success confirmation
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')
        action = data.get('action')
        event_data = data.get('data', {})

        if not user_id or not action:
            return jsonify({'error': 'userId and action are required'}), 400

        # Get participant to determine current condition
        participant = storage.get_study_participant(user_id)
        if not participant:
            # Not in study, just log and return success
            current_app.logger.info(f"Metric logged for non-study user: {action}")
            return jsonify({'success': True}), 200

        # Log the metric
        metric_event = {
            'userId': user_id,
            'condition': participant.get('currentCondition'),
            'day': participant.get('daysInCurrentCondition', 1),
            'action': action,
            'timestamp': datetime.now().isoformat(),
            'data': event_data
        }

        success = storage.log_study_metric(metric_event)

        if not success:
            return jsonify({'error': 'Failed to log metric'}), 500

        return jsonify({'success': True}), 200

    except Exception as e:
        current_app.logger.error(f"Error logging metric: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/metrics/export', methods=['GET'])
def export_metrics():
    """
    Export all study metrics as CSV

    Query Parameters:
        - userId: User ID (optional, exports all if not provided)

    Returns:
        CSV file with all metrics
    """
    try:
        user_id = request.args.get('userId')

        # Get all metrics
        all_metrics = storage.get_all_study_metrics(user_id)

        # Group metrics by user
        metrics_by_user = {}
        for metric in all_metrics:
            uid = metric.get('userId')
            if uid not in metrics_by_user:
                metrics_by_user[uid] = []
            metrics_by_user[uid].append(metric)

        # Convert to CSV format
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'Participant ID', 'Condition',
            'Messages Sent', 'Prompts Shown', 'Prompts Accepted', 'Prompts Edited', 'Prompts Dismissed',
            'Total Events'
        ])

        # Data rows - one per user
        for uid, user_metrics in metrics_by_user.items():
            # Get participant data to fetch participantId
            participant = storage.get_study_participant(uid)
            if not participant:
                continue
                
            participant_id = participant.get('participantId', 'N/A')
            condition = participant.get('currentCondition', 'N/A')
            
            # Count metrics by action type (matching the stats/all endpoint logic)
            stats = {
                'messages_sent': sum(1 for m in user_metrics if m.get('action') == 'message_sent'),
                'prompts_shown': sum(1 for m in user_metrics if m.get('action') == 'prompt_shown'),
                'prompts_accepted': sum(1 for m in user_metrics if m.get('action') == 'prompt_accepted'),
                'prompts_edited': sum(1 for m in user_metrics if m.get('action') == 'prompt_edited'),
                'prompts_dismissed': sum(1 for m in user_metrics if m.get('action') == 'prompt_dismissed'),
            }
            
            writer.writerow([
                participant_id,
                condition,
                stats['messages_sent'],
                stats['prompts_shown'],
                stats['prompts_accepted'],
                stats['prompts_edited'],
                stats['prompts_dismissed'],
                len(user_metrics)
            ])

        output.seek(0)
        return output.getvalue(), 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename=study_metrics_{datetime.now().strftime("%Y%m%d")}.csv'
        }

    except Exception as e:
        current_app.logger.error(f"Error exporting metrics: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/stats/individual', methods=['GET'])
def get_individual_stats():
    """
    Get individual participant's study statistics

    Query Parameters:
        - userId: User ID (required)

    Returns:
        - participant: Participant info
        - metrics: Aggregated metrics by condition
        - surveys: Survey responses
    """
    try:
        user_id = request.args.get('userId')
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400

        # Get participant info
        participant = storage.get_study_participant(user_id)
        if not participant:
            return jsonify({
                'success': True,
                'data': {
                    'enrolled': False,
                    'message': 'Not enrolled in study'
                }
            }), 200

        # Get all metrics for this participant
        all_metrics = storage.get_all_study_metrics(user_id)

        # Aggregate metrics by condition
        metrics_by_condition = {}
        for metric in all_metrics:
            condition = metric.get('condition')
            if condition not in metrics_by_condition:
                metrics_by_condition[condition] = {
                    'messages_sent': 0,
                    'prompts_shown': 0,
                    'prompts_accepted': 0,
                    'prompts_edited': 0,
                    'prompts_dismissed': 0,
                    'total_events': 0
                }

            action = metric.get('action')
            metrics_by_condition[condition]['total_events'] += 1

            if action == 'message_sent':
                metrics_by_condition[condition]['messages_sent'] += 1
            elif action == 'prompt_shown':
                metrics_by_condition[condition]['prompts_shown'] += 1
            elif action == 'prompt_accepted':
                metrics_by_condition[condition]['prompts_accepted'] += 1
            elif action == 'prompt_edited':
                metrics_by_condition[condition]['prompts_edited'] += 1
            elif action == 'prompt_dismissed':
                metrics_by_condition[condition]['prompts_dismissed'] += 1

        # Get survey responses
        surveys = []
        condition_order = participant.get('conditionOrder', [])
        for condition in condition_order:
            survey = storage.get_survey_response(user_id, condition)
            if survey:
                surveys.append(survey)

        return jsonify({
            'success': True,
            'data': {
                'enrolled': True,
                'participant': participant,
                'metricsByCondition': metrics_by_condition,
                'surveys': surveys,
                'totalEvents': len(all_metrics)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting individual stats: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@study_bp.route('/stats/all', methods=['GET'])
def get_all_participants_stats():
    """
    Get statistics for all participants (team view)

    Query Parameters:
        - password: Admin password (required)
        - status: Filter by completion status (optional: 'active', 'completed', 'all')

    Returns:
        - participants: List of all participants with stats
        - aggregate: Aggregate metrics across all participants
    """
    try:
        # Simple password protection
        password = request.args.get('password')
        ADMIN_PASSWORD = "research2024"  # TODO: Move to environment variable

        if password != ADMIN_PASSWORD:
            return jsonify({'error': 'Invalid password'}), 401

        status_filter = request.args.get('status', 'all')

        # Get all participants
        # Note: This is a simplified version - in production, you'd query the database
        all_participants = []
        all_metrics = storage.get_all_study_metrics()  # Get all metrics

        # Group metrics by user
        metrics_by_user = {}
        for metric in all_metrics:
            user_id = metric.get('userId')
            if user_id not in metrics_by_user:
                metrics_by_user[user_id] = []
            metrics_by_user[user_id].append(metric)

        # Get participant info for each user
        participant_stats = []
        aggregate_stats = {
            'total_participants': 0,
            'active_participants': 0,
            'completed_participants': 0,
            'total_messages': 0,
            'total_prompts_shown': 0,
            'total_prompts_accepted': 0,
            'total_prompts_edited': 0,
            'total_prompts_dismissed': 0,
            'conditions_completed': 0
        }

        for user_id in metrics_by_user.keys():
            participant = storage.get_study_participant(user_id)
            if not participant:
                continue

            # Filter by status
            is_complete = participant.get('isStudyComplete', False)
            if status_filter == 'completed' and not is_complete:
                continue
            if status_filter == 'active' and is_complete:
                continue

            # Count metrics for this participant
            user_metrics = metrics_by_user[user_id]
            stats = {
                'messages_sent': sum(1 for m in user_metrics if m.get('action') == 'message_sent'),
                'prompts_shown': sum(1 for m in user_metrics if m.get('action') == 'prompt_shown'),
                'prompts_accepted': sum(1 for m in user_metrics if m.get('action') == 'prompt_accepted'),
                'prompts_edited': sum(1 for m in user_metrics if m.get('action') == 'prompt_edited'),
                'prompts_dismissed': sum(1 for m in user_metrics if m.get('action') == 'prompt_dismissed'),
            }

            participant_stats.append({
                'participant': participant,
                'metrics': stats,
                'totalEvents': len(user_metrics)
            })

            # Update aggregate stats
            aggregate_stats['total_participants'] += 1
            if is_complete:
                aggregate_stats['completed_participants'] += 1
            else:
                aggregate_stats['active_participants'] += 1

            aggregate_stats['total_messages'] += stats['messages_sent']
            aggregate_stats['total_prompts_shown'] += stats['prompts_shown']
            aggregate_stats['total_prompts_accepted'] += stats['prompts_accepted']
            aggregate_stats['total_prompts_edited'] += stats['prompts_edited']
            aggregate_stats['total_prompts_dismissed'] += stats['prompts_dismissed']
            aggregate_stats['conditions_completed'] += len(participant.get('completedConditions', []))

        return jsonify({
            'success': True,
            'data': {
                'participants': participant_stats,
                'aggregate': aggregate_stats,
                'filter': status_filter
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting all stats: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
