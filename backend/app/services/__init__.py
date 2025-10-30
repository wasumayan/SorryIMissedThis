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
        """Convert to dictionary for Firestore"""
        data = asdict(self)
        if self.last_message_time:
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
    category: str = "general"  # family, friends, work, dormant, priority
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for Firestore"""
        return {
            'user_id': self.user_id,
            'partner_name': self.partner_name,
            'partner_id': self.partner_id,
            'messages': [msg.to_dict() for msg in self.messages],
            'metrics': self.metrics.to_dict(),
            'conversation_id': self.conversation_id,
            'category': self.category,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
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
            return "unknown"
        
        if self.metrics.days_since_contact > 30:
            return "at_risk"
        elif self.metrics.days_since_contact > 14:
            return "dormant"
        elif self.metrics.days_since_contact > 7:
            return "attention"
        else:
            return "healthy"
    
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