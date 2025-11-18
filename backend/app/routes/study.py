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
            study_end_date=datetime.now() + timedelta(days=3),  # 3 days total (1 day per condition)
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
    Manually advance to next condition (after survey completion)

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

        participant = storage.get_study_participant(user_id)

        if not participant:
            return jsonify({'error': 'Participant not found'}), 404

        # Check if survey is completed for current condition
        survey = storage.get_survey_response(user_id, participant.current_condition)
        if not survey:
            return jsonify({
                'error': 'Must complete survey before advancing',
                'currentCondition': participant.current_condition
            }), 400

        # Advance condition
        participant.completed_conditions.append(participant.current_condition)
        participant.current_condition_index += 1

        if participant.current_condition_index >= len(participant.condition_order):
            participant.is_study_complete = True

        storage.save_study_participant(participant)

        return jsonify({
            'success': True,
            'data': {
                'participant': participant.to_dict(),
                'message': 'Advanced to next condition' if not participant.is_study_complete else 'Study complete!'
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
            'condition': participant.current_condition,
            'day': participant.days_in_current_condition,
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
        metrics = storage.get_all_study_metrics(user_id)

        # Convert to CSV format
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'User ID', 'Participant ID', 'Condition', 'Day', 'Date',
            'Messages Sent', 'Conversations Initiated',
            'Prompts Shown', 'Prompts Accepted', 'Prompts Edited', 'Prompts Dismissed',
            'Avg Message Length', 'Avg Response Time', 'Edit Rate'
        ])

        # Data rows
        for metric in metrics:
            writer.writerow([
                metric.get('userId'),
                metric.get('participantId'),
                metric.get('condition'),
                metric.get('day'),
                metric.get('date'),
                metric.get('metrics', {}).get('messagesSent', 0),
                metric.get('metrics', {}).get('conversationsInitiated', 0),
                metric.get('metrics', {}).get('promptsShown', 0),
                metric.get('metrics', {}).get('promptsAccepted', 0),
                metric.get('metrics', {}).get('promptsEdited', 0),
                metric.get('metrics', {}).get('promptsDismissed', 0),
                metric.get('metrics', {}).get('avgMessageLength', 0),
                metric.get('metrics', {}).get('avgResponseTime', 0),
                metric.get('metrics', {}).get('editRate', 0),
            ])

        output.seek(0)
        return output.getvalue(), 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename=study_metrics_{datetime.now().strftime("%Y%m%d")}.csv'
        }

    except Exception as e:
        current_app.logger.error(f"Error exporting metrics: {str(e)}")
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500
