"""
Data models for Sorry I Missed This
These represent the structure of data stored in Firestore
"""

from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict, field


@dataclass
class Message:
    """Individual message in a conversation"""
    timestamp: datetime
    sender: str
    content: str
    message_id: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Message':
        """Create from Firestore dictionary"""
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)


@dataclass
class ConversationMetrics:
    """Analytics metrics for a conversation"""
    total_messages: int
    user_messages: int
    partner_messages: int
    reciprocity: float  # 0-1, balance of messages
    avg_response_time: Optional[float] = None  # in hours
    last_message_time: Optional[datetime] = None
    days_since_contact: Optional[int] = None
    common_topics: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore/Cosmos DB"""
        data = asdict(self)
        # ALWAYS convert datetime to ISO format string (required for JSON serialization)
        # Check both the instance attribute and the dict value to be safe
        if 'last_message_time' in data:
            if isinstance(data['last_message_time'], datetime):
                data['last_message_time'] = data['last_message_time'].isoformat()
            elif data['last_message_time'] is None:
                # Keep None as None (valid JSON value)
                pass
        # Also check the instance attribute directly (in case asdict didn't include it)
        if self.last_message_time and isinstance(self.last_message_time, datetime):
            data['last_message_time'] = self.last_message_time.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ConversationMetrics':
        """Create from Firestore dictionary"""
        if 'last_message_time' in data and data['last_message_time']:
            data['last_message_time'] = datetime.fromisoformat(data['last_message_time'])
        return cls(**data)


@dataclass
class Conversation:
    """A conversation between the user and another person"""
    user_id: str
    partner_name: str
    partner_id: str
    messages: List[Message]
    metrics: ConversationMetrics
    conversation_id: Optional[str] = None
    category: str = "friends"  # family, friends, work - relationship categories
    tone: Optional[str] = None  # formal, friendly, playful - conversation-specific tone
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_tone(self) -> str:
        """Get tone for this conversation, with smart defaults based on category"""
        if self.tone:
            return self.tone
        
        # Default tones based on category
        category_tone_map = {
            'work': 'formal',
            'family': 'friendly',
            'friends': 'friendly'
        }
        
        return category_tone_map.get(self.category, 'friendly')
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore/Cosmos DB"""
        metrics_dict = self.metrics.to_dict()

        # Calculate interaction frequency (messages per day since first message)
        days_active = max(1, (datetime.now() - self.created_at).days)
        interaction_frequency = len(self.messages) / days_active if days_active > 0 else 0

        return {
            'id': self.conversation_id or self.partner_id,  # Azure Cosmos DB requires 'id' field
            'user_id': self.user_id,
            'userId': self.user_id,  # camelCase for frontend
            'partner_name': self.partner_name,  # Keep snake_case for backend
            'partnerName': self.partner_name,  # camelCase for frontend
            'partner_id': self.partner_id,
            'partnerId': self.partner_id,  # camelCase for frontend
            'messages': [],  # PRIVACY: Never store message content in cloud - messages stay local only
            'messageCount': len(self.messages),  # Metadata: count only, no content
            'metrics': metrics_dict,
            'conversation_id': self.conversation_id,
            'conversationId': self.conversation_id,  # camelCase for frontend
            'category': self.category,
            'tone': self.get_tone(),  # Conversation-specific tone
            'status': self.get_relationship_health(),
            'reciprocity': metrics_dict.get('reciprocity', 0.5),  # For frontend access
            'daysSinceContact': metrics_dict.get('days_since_contact', 0),  # camelCase
            'avgResponseTime': metrics_dict.get('avg_response_time', 0),  # camelCase
            'lastMessageAt': metrics_dict.get('last_message_time'),  # camelCase - should already be ISO string from metrics.to_dict()
            'interactionFrequency': round(interaction_frequency, 2),  # Messages per day
            'created_at': self.created_at.isoformat(),
            'createdAt': self.created_at.isoformat(),  # camelCase for frontend
            'updated_at': self.updated_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),  # camelCase for frontend
            'type': 'conversation'  # Add type field for Cosmos DB filtering
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Conversation':
        """Create from Firestore dictionary"""
        data['messages'] = [Message.from_dict(msg) for msg in data['messages']]
        data['metrics'] = ConversationMetrics.from_dict(data['metrics'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)
    
    def get_relationship_health(self) -> str:
        """Determine relationship health status"""
        if self.metrics.days_since_contact is None:
            return "healthy"

        # Map to frontend status values: healthy, attention, dormant, wilted
        if self.metrics.days_since_contact > 60:
            return "wilted"  # Very dormant - needs urgent attention
        elif self.metrics.days_since_contact > 30:
            return "dormant"  # Dormant - not communicated in over a month
        elif self.metrics.days_since_contact > 14:
            return "attention"  # Needs attention - getting stale
        else:
            return "healthy"  # Active and healthy
    
    def get_last_n_messages(self, n: int = 10) -> List[Message]:
        """Get the last N messages for context"""
        return sorted(self.messages, key=lambda m: m.timestamp, reverse=True)[:n]


@dataclass
class ConversationPrompt:
    """AI-generated conversation prompt"""
    conversation_id: str
    prompt_text: str
    prompt_type: str  # "follow_up", "check_in", "reconnect"
    context: str  # What the prompt is based on
    tone: str  # "formal", "friendly", "playful"
    confidence_score: float  # 0-1, how confident the AI is
    created_at: datetime = field(default_factory=datetime.now)
    used: bool = False
    prompt_id: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore"""
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ConversationPrompt':
        """Create from Firestore dictionary"""
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)


@dataclass
class User:
    """User profile"""
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    preferences: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_login: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore"""
        return {
            'user_id': self.user_id,
            'email': self.email,
            'display_name': self.display_name,
            'preferences': self.preferences,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'User':
        """Create from Firestore dictionary"""
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        data['last_login'] = datetime.fromisoformat(data['last_login'])
        return cls(**data)