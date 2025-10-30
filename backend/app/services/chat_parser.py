"""
Chat Parser Service
Handles parsing of WhatsApp chat exports and conversation analysis
"""

import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import Counter

from app.models import Message, Conversation, ConversationMetrics


class ChatParser:
    """Parses WhatsApp chat exports"""
    
    # WhatsApp message format: [MM/DD/YY, HH:MM:SS AM/PM] Sender: Message
    WHATSAPP_PATTERN = r'\[([^\]]+)\]\s+([^:]+):\s+(.+)'
    
    # Alternative formats to support
    ALTERNATIVE_PATTERNS = [
        r'(\d{1,2}/\d{1,2}/\d{2,4},\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s+-\s+([^:]+):\s+(.+)',
        r'(\d{1,2}/\d{1,2}/\d{2,4},\s+\d{1,2}:\d{2})\s+-\s+([^:]+):\s+(.+)',
    ]
    
    DATE_FORMATS = [
        '%m/%d/%y, %I:%M:%S %p',  # 9/4/24, 5:02:44 PM
        '%m/%d/%Y, %I:%M:%S %p',  # 9/4/2024, 5:02:44 PM
        '%d/%m/%y, %H:%M:%S',      # European format
        '%d/%m/%Y, %H:%M:%S',
        '%m/%d/%y, %H:%M',         # Without seconds
        '%m/%d/%Y, %H:%M',
    ]
    
    def __init__(self, user_id: str):
        """Initialize parser with user ID"""
        self.user_id = user_id
    
    def parse_chat_file(self, file_content: str, user_display_name: str) -> List[Message]:
        """
        Parse a WhatsApp chat file and extract messages
        
        Args:
            file_content: Raw text content of the chat file
            user_display_name: The display name of the user in the chat
        
        Returns:
            List of Message objects
        """
        messages = []
        lines = file_content.split('\n')
        
        current_message = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Try to match a new message
            match = self._match_message_line(line)
            
            if match:
                # Save previous message if exists
                if current_message:
                    messages.append(current_message)
                
                # Start new message
                timestamp_str, sender, content = match
                timestamp = self._parse_timestamp(timestamp_str)
                
                if timestamp:
                    current_message = Message(
                        timestamp=timestamp,
                        sender=sender.strip(),
                        content=content.strip()
                    )
                else:
                    current_message = None
            
            elif current_message:
                # Continuation of previous message (multiline)
                current_message.content += '\n' + line
        
        # Don't forget the last message
        if current_message:
            messages.append(current_message)
        
        return messages
    
    def _match_message_line(self, line: str) -> Optional[Tuple[str, str, str]]:
        """Try to match a line against WhatsApp message patterns"""
        
        # Try primary pattern
        match = re.match(self.WHATSAPP_PATTERN, line)
        if match:
            return match.groups()
        
        # Try alternative patterns
        for pattern in self.ALTERNATIVE_PATTERNS:
            match = re.match(pattern, line)
            if match:
                return match.groups()
        
        return None
    
    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Parse timestamp string into datetime object"""
        
        for date_format in self.DATE_FORMATS:
            try:
                return datetime.strptime(timestamp_str, date_format)
            except ValueError:
                continue
        
        # If all formats fail, return None
        print(f"⚠️ Could not parse timestamp: {timestamp_str}")
        return None
    
    def create_conversation(
        self, 
        messages: List[Message], 
        user_display_name: str,
        partner_name: Optional[str] = None
    ) -> Conversation:
        """
        Create a Conversation object from parsed messages
        
        Args:
            messages: List of parsed messages
            user_display_name: The user's display name in the chat
            partner_name: Optional override for partner's name
        
        Returns:
            Conversation object with metrics
        """
        
        # Identify conversation partner
        if not partner_name:
            senders = set(msg.sender for msg in messages)
            senders.discard(user_display_name)
            partner_name = list(senders)[0] if senders else "Unknown"
        
        # Calculate metrics
        metrics = self._calculate_metrics(messages, user_display_name)
        
        # Create conversation
        conversation = Conversation(
            user_id=self.user_id,
            partner_name=partner_name,
            partner_id=self._generate_partner_id(partner_name),
            messages=messages,
            metrics=metrics,
            category=self._categorize_conversation(metrics)
        )
        
        return conversation
    
    def _calculate_metrics(
        self, 
        messages: List[Message], 
        user_display_name: str
    ) -> ConversationMetrics:
        """Calculate conversation metrics"""
        
        total_messages = len(messages)
        user_messages = sum(1 for msg in messages if msg.sender == user_display_name)
        partner_messages = total_messages - user_messages
        
        # Calculate reciprocity (balance of conversation)
        if total_messages > 0:
            reciprocity = min(user_messages, partner_messages) / (total_messages / 2)
        else:
            reciprocity = 0.0
        
        # Get last message time and calculate days since contact
        if messages:
            sorted_messages = sorted(messages, key=lambda m: m.timestamp)
            last_message_time = sorted_messages[-1].timestamp
            days_since_contact = (datetime.now() - last_message_time).days
        else:
            last_message_time = None
            days_since_contact = None
        
        # Calculate average response time (simplified)
        avg_response_time = self._calculate_avg_response_time(
            messages, user_display_name
        )
        
        # Extract common topics
        common_topics = self._extract_common_topics(messages)
        
        return ConversationMetrics(
            total_messages=total_messages,
            user_messages=user_messages,
            partner_messages=partner_messages,
            reciprocity=min(reciprocity, 1.0),  # Cap at 1.0
            avg_response_time=avg_response_time,
            last_message_time=last_message_time,
            days_since_contact=days_since_contact,
            common_topics=common_topics
        )
    
    def _calculate_avg_response_time(
        self, 
        messages: List[Message], 
        user_display_name: str
    ) -> Optional[float]:
        """Calculate average response time in hours"""
        
        if len(messages) < 2:
            return None
        
        response_times = []
        sorted_messages = sorted(messages, key=lambda m: m.timestamp)
        
        for i in range(1, len(sorted_messages)):
            prev_msg = sorted_messages[i-1]
            curr_msg = sorted_messages[i]
            
            # Check if this is a response (different sender)
            if prev_msg.sender != curr_msg.sender:
                time_diff = (curr_msg.timestamp - prev_msg.timestamp).total_seconds() / 3600
                # Only count reasonable response times (< 24 hours)
                if time_diff < 24:
                    response_times.append(time_diff)
        
        if response_times:
            return sum(response_times) / len(response_times)
        
        return None
    
    def _extract_common_topics(self, messages: List[Message], top_n: int = 5) -> List[str]:
        """Extract common topics/keywords from messages"""
        
        # Simple keyword extraction (in production, use NLP)
        all_words = []
        
        # Common stop words to filter out
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
            'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
            'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
            'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
        }
        
        for msg in messages:
            words = re.findall(r'\b[a-zA-Z]{4,}\b', msg.content.lower())
            words = [w for w in words if w not in stop_words]
            all_words.extend(words)
        
        # Get most common words
        if all_words:
            common = Counter(all_words).most_common(top_n)
            return [word for word, count in common]
        
        return []
    
    def _categorize_conversation(self, metrics: ConversationMetrics) -> str:
        """Categorize conversation based on metrics"""
        
        if metrics.days_since_contact is None:
            return "general"
        
        if metrics.days_since_contact > 30:
            return "dormant"
        elif metrics.days_since_contact > 14:
            return "attention"
        else:
            return "active"
    
    def _generate_partner_id(self, partner_name: str) -> str:
        """Generate a unique ID for a conversation partner"""
        # Simple implementation - in production, use proper hashing
        return f"{self.user_id}_{partner_name.lower().replace(' ', '_')}"
    
    def filter_pii(self, text: str) -> str:
        """Remove personally identifiable information from text"""
        
        # Remove phone numbers
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', text)
        
        # Remove email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
        
        # Remove credit card numbers
        text = re.sub(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '[CARD]', text)
        
        # Remove addresses (simplified - catches patterns like "123 Main St")
        text = re.sub(r'\b\d{1,5}\s+[\w\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b', '[ADDRESS]', text, flags=re.IGNORECASE)
        
        return text