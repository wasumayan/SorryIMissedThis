"""
AI Service for generating conversation prompts using OpenAI
"""

from openai import OpenAI
from typing import List, Dict, Optional
from datetime import datetime

from app.models import Message, Conversation, ConversationPrompt
from app.config import get_config


class AIService:
    """Service for AI-powered conversation prompt generation"""

    def __init__(self):
        """Initialize OpenAI client"""
        config = get_config()
        self.api_key = config.OPENAI_API_KEY
        self.model = config.OPENAI_MODEL
        self.max_tokens = config.OPENAI_MAX_TOKENS
        self.temperature = config.OPENAI_TEMPERATURE

        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
            print("WARNING: OpenAI API key not set. Using fallback prompts.")
    
    def generate_prompts(
        self, 
        conversation: Conversation,
        num_prompts: int = 3,
        user_tone_preference: str = "friendly"
    ) -> List[ConversationPrompt]:
        """
        Generate conversation prompts based on chat history
        
        Args:
            conversation: The conversation to generate prompts for
            num_prompts: Number of prompts to generate
            user_tone_preference: Preferred tone (formal, friendly, playful)
        
        Returns:
            List of ConversationPrompt objects
        """
        
        # If no API key, use fallback
        if not self.api_key:
            return self._generate_fallback_prompts(conversation, num_prompts)
        
        try:
            # Prepare conversation context
            context = self._prepare_context(conversation)
            
            # Generate prompts using OpenAI
            prompts = self._call_openai(
                context=context,
                partner_name=conversation.partner_name,
                num_prompts=num_prompts,
                tone=user_tone_preference,
                relationship_health=conversation.get_relationship_health()
            )
            
            # Create ConversationPrompt objects
            prompt_objects = []
            for prompt_data in prompts:
                prompt_obj = ConversationPrompt(
                    conversation_id=conversation.conversation_id or "",
                    prompt_text=prompt_data['text'],
                    prompt_type=prompt_data['type'],
                    context=prompt_data['context'],
                    tone=user_tone_preference,
                    confidence_score=prompt_data.get('confidence', 0.8)
                )
                prompt_objects.append(prompt_obj)
            
            return prompt_objects
        
        except Exception as e:
            print(f"Error generating prompts: {str(e)}")
            return self._generate_fallback_prompts(conversation, num_prompts)
    
    def _prepare_context(self, conversation: Conversation, max_messages: int = 20) -> str:
        """Prepare conversation context for AI"""
        
        # Get recent messages
        recent_messages = conversation.get_last_n_messages(max_messages)
        recent_messages.reverse()  # Chronological order
        
        # Format context
        context_parts = []
        
        # Add relationship metadata
        context_parts.append(f"Conversation with: {conversation.partner_name}")
        context_parts.append(f"Days since last contact: {conversation.metrics.days_since_contact}")
        context_parts.append(f"Total messages: {conversation.metrics.total_messages}")
        context_parts.append(f"Reciprocity: {conversation.metrics.reciprocity:.2f}")
        
        if conversation.metrics.common_topics:
            context_parts.append(f"Common topics: {', '.join(conversation.metrics.common_topics[:5])}")
        
        context_parts.append("\nRecent conversation:")
        
        # Add recent messages
        for msg in recent_messages:
            context_parts.append(f"{msg.sender}: {msg.content[:200]}")  # Limit message length
        
        return "\n".join(context_parts)
    
    def _call_openai(
        self,
        context: str,
        partner_name: str,
        num_prompts: int,
        tone: str,
        relationship_health: str
    ) -> List[Dict]:
        """Call OpenAI API to generate prompts"""
        
        # Determine prompt type based on relationship health
        if relationship_health == "at_risk":
            prompt_focus = "reconnection and showing genuine care"
        elif relationship_health == "dormant":
            prompt_focus = "gentle check-in and re-engagement"
        elif relationship_health == "attention":
            prompt_focus = "maintaining connection and showing interest"
        else:
            prompt_focus = "continuing the conversation naturally"
        
        # Create system message
        system_message = f"""You are a helpful assistant that generates natural, context-aware conversation prompts 
to help people stay connected with their friends and family. 

Your prompts should:
1. Be based on the actual conversation history
2. Feel authentic and personal (not generic)
3. Match a {tone} tone
4. Focus on {prompt_focus}
5. Reference specific topics or events mentioned
6. Be short (1-2 sentences)

Return {num_prompts} different prompts as a JSON array with this structure:
[
  {{
    "text": "the actual prompt text",
    "type": "follow_up" | "check_in" | "reconnect",
    "context": "brief explanation of what this prompt references",
    "confidence": 0.0 to 1.0
  }}
]
"""
        
        # Create user message
        user_message = f"""Based on this conversation with {partner_name}, generate {num_prompts} conversation prompts:

{context}

Generate prompts that would help naturally continue or restart this conversation."""
        
        try:
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={"type": "json_object"}  # Request JSON response
            )

            # Parse response
            import json
            prompts_json = response.choices[0].message.content
            prompts = json.loads(prompts_json)
            
            # Handle both array and object responses
            if isinstance(prompts, dict) and 'prompts' in prompts:
                prompts = prompts['prompts']
            
            return prompts[:num_prompts]  # Ensure we don't exceed requested number
        
        except Exception as e:
            print(f"OpenAI API error: {str(e)}")
            raise
    
    def _generate_fallback_prompts(
        self, 
        conversation: Conversation,
        num_prompts: int = 3
    ) -> List[ConversationPrompt]:
        """Generate fallback prompts when AI is unavailable"""
        
        partner = conversation.partner_name
        days = conversation.metrics.days_since_contact or 0
        topics = conversation.metrics.common_topics[:3] if conversation.metrics.common_topics else []
        
        # Template-based prompts
        templates = [
            {
                "text": f"Hey {partner}! It's been a while - how have you been?",
                "type": "check_in",
                "context": f"Reconnecting after {days} days"
            },
            {
                "text": f"Hi {partner}! Just wanted to check in and see what's new with you",
                "type": "check_in",
                "context": "General check-in"
            },
            {
                "text": f"Hey! I've been meaning to catch up - when's a good time for a quick call?",
                "type": "reconnect",
                "context": "Suggesting a call"
            }
        ]
        
        # Add topic-specific prompts if we have topics
        if topics:
            templates.append({
                "text": f"Hey {partner}! I was thinking about {topics[0]} - how's that going?",
                "type": "follow_up",
                "context": f"Following up on: {topics[0]}"
            })
        
        # Create ConversationPrompt objects
        prompts = []
        for i, template in enumerate(templates[:num_prompts]):
            prompt = ConversationPrompt(
                conversation_id=conversation.conversation_id or "",
                prompt_text=template['text'],
                prompt_type=template['type'],
                context=template['context'],
                tone="friendly",
                confidence_score=0.6  # Lower confidence for fallback
            )
            prompts.append(prompt)
        
        return prompts
    
    def analyze_message_sentiment(self, message: str) -> Dict[str, float]:
        """
        Analyze sentiment of a message (future enhancement)
        
        Returns:
            Dictionary with sentiment scores
        """
        # Placeholder for future implementation
        return {
            "positive": 0.5,
            "negative": 0.0,
            "neutral": 0.5
        }
    
    def suggest_response_timing(self, conversation: Conversation) -> Dict[str, any]:
        """
        Suggest optimal time to reach out (future enhancement)
        
        Returns:
            Dictionary with timing recommendations
        """
        # Placeholder for future implementation
        avg_response = conversation.metrics.avg_response_time or 24
        
        return {
            "recommended_time": "afternoon",
            "typical_response_hours": avg_response,
            "best_days": ["weekday"]
        }