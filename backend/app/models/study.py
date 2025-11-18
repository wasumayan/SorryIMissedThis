"""
Study models for 3-condition research experiment
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field


@dataclass
class StudyCondition:
    """Represents one of the three study conditions"""
    condition_type: str  # 'no_prompt', 'generic_prompt', 'context_aware'
    start_date: datetime
    end_date: datetime
    day_in_condition: int  # Always 1 (1 day per condition)
    is_complete: bool = False
    survey_completed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'conditionType': self.condition_type,
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'dayInCondition': self.day_in_condition,
            'isComplete': self.is_complete,
            'surveyCompleted': self.survey_completed
        }


@dataclass
class StudyParticipant:
    """Represents a participant in the study"""
    user_id: str
    participant_id: str
    enrolled_date: datetime
    condition_order: List[str]  # e.g., ['no_prompt', 'generic_prompt', 'context_aware']
    current_condition_index: int  # 0, 1, or 2
    study_start_date: datetime
    study_end_date: datetime  # study_start_date + 3 days (1 day per condition)
    completed_conditions: List[str] = field(default_factory=list)
    is_study_complete: bool = False

    @property
    def current_condition(self) -> Optional[str]:
        """Get the current active condition"""
        if 0 <= self.current_condition_index < len(self.condition_order):
            return self.condition_order[self.current_condition_index]
        return None

    @property
    def current_condition_start(self) -> datetime:
        """Get start date of current condition (1-day cycles)"""
        return self.study_start_date + timedelta(days=self.current_condition_index)

    @property
    def current_condition_end(self) -> datetime:
        """Get end date of current condition (24 hours)"""
        return self.current_condition_start + timedelta(days=1)

    @property
    def days_in_current_condition(self) -> int:
        """Calculate which day participant is in current condition (always 1)"""
        return 1  # Each condition is only 1 day

    def to_dict(self) -> Dict[str, Any]:
        return {
            'userId': self.user_id,
            'participantId': self.participant_id,
            'enrolledDate': self.enrolled_date.isoformat(),
            'conditionOrder': self.condition_order,
            'currentConditionIndex': self.current_condition_index,
            'currentCondition': self.current_condition,
            'studyStartDate': self.study_start_date.isoformat(),
            'studyEndDate': self.study_end_date.isoformat(),
            'currentConditionStart': self.current_condition_start.isoformat(),
            'currentConditionEnd': self.current_condition_end.isoformat(),
            'daysInCurrentCondition': self.days_in_current_condition,
            'completedConditions': self.completed_conditions,
            'isStudyComplete': self.is_study_complete
        }


@dataclass
class StudyMetrics:
    """Metrics collected during study conditions"""
    user_id: str
    condition: str
    day: int  # Always 1 (1 day per condition)
    date: datetime

    # Message metrics
    messages_sent: int = 0
    conversations_initiated: int = 0

    # Prompt metrics
    prompts_shown: int = 0
    prompts_accepted: int = 0  # Sent without editing
    prompts_edited: int = 0    # Edited before sending
    prompts_dismissed: int = 0

    # Message quality metrics
    avg_message_length: float = 0.0  # characters
    avg_response_time: float = 0.0   # seconds

    # Edit metrics
    edit_rate: float = 0.0  # prompts_edited / prompts_sent

    def to_dict(self) -> Dict[str, Any]:
        return {
            'userId': self.user_id,
            'condition': self.condition,
            'day': self.day,
            'date': self.date.isoformat(),
            'metrics': {
                'messagesSent': self.messages_sent,
                'conversationsInitiated': self.conversations_initiated,
                'promptsShown': self.prompts_shown,
                'promptsAccepted': self.prompts_accepted,
                'promptsEdited': self.prompts_edited,
                'promptsDismissed': self.prompts_dismissed,
                'avgMessageLength': self.avg_message_length,
                'avgResponseTime': self.avg_response_time,
                'editRate': self.edit_rate
            }
        }


@dataclass
class SurveyResponse:
    """Post-condition survey responses"""
    user_id: str
    condition: str
    completed_at: datetime

    # Likert scale responses (1-5)
    perceived_connectedness: int  # "I felt connected to the person"
    authenticity: int             # "Conversations felt natural"
    enjoyment: int                # "I enjoyed the experience"
    ease_of_conversation: int     # "Easy to keep conversation going"

    # Prompt-specific (null for no_prompt condition)
    prompt_helpfulness: Optional[int] = None
    prompt_relevance: Optional[int] = None

    # Open-ended responses
    edit_reasons: str = ""  # Why did you edit prompts?
    overall_quality_vs_typical: int = 3  # 1-5 (much worse to much better)
    communication_frequency: str = ""  # e.g., "~20 messages per day"
    overall_satisfaction: int = 3  # 1-5

    # Free text
    likes: str = ""
    difficulties: str = ""
    suggestions: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            'userId': self.user_id,
            'condition': self.condition,
            'completedAt': self.completed_at.isoformat(),
            'responses': {
                'perceivedConnectedness': self.perceived_connectedness,
                'authenticity': self.authenticity,
                'enjoyment': self.enjoyment,
                'easeOfConversation': self.ease_of_conversation,
                'promptHelpfulness': self.prompt_helpfulness,
                'promptRelevance': self.prompt_relevance,
                'editReasons': self.edit_reasons,
                'overallQualityVsTypical': self.overall_quality_vs_typical,
                'communicationFrequency': self.communication_frequency,
                'overallSatisfaction': self.overall_satisfaction,
                'likes': self.likes,
                'difficulties': self.difficulties,
                'suggestions': self.suggestions
            }
        }


# Counterbalancing: All 6 possible orderings of 3 conditions
CONDITION_ORDERS = [
    ['no_prompt', 'generic_prompt', 'context_aware'],
    ['no_prompt', 'context_aware', 'generic_prompt'],
    ['generic_prompt', 'no_prompt', 'context_aware'],
    ['generic_prompt', 'context_aware', 'no_prompt'],
    ['context_aware', 'no_prompt', 'generic_prompt'],
    ['context_aware', 'generic_prompt', 'no_prompt'],
]


def get_counterbalanced_order(participant_number: int) -> List[str]:
    """
    Get counterbalanced condition order for a participant

    Args:
        participant_number: Sequential participant number (0-indexed)

    Returns:
        List of condition names in order
    """
    return CONDITION_ORDERS[participant_number % len(CONDITION_ORDERS)]
