"""
AI Service for generating conversation prompts using Azure OpenAI
"""

import json
import os
from typing import List, Dict, Optional
from datetime import datetime

from app.models import Message, Conversation, ConversationPrompt
from app.utils.azure_openai import generate_chat_completion


class AIService:
    """Service for AI-powered conversation prompt generation"""

    def __init__(self):
        """Initialize Azure OpenAI service"""
        # Check for Azure OpenAI API key
        self.api_key = os.getenv("AZURE_OPENAI_API_KEY")
        self.deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
        self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", 500))
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", 0.7))

        print(
            f"DEBUG: Azure OpenAI API key loaded: {bool(self.api_key)} (length: {len(self.api_key) if self.api_key else 0})", flush=True)
        if not self.api_key:
            print(
                "WARNING: AZURE_OPENAI_API_KEY not set. Using fallback prompts.", flush=True)

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

        print("PRINT 7: ai_service.generate_prompts() called", flush=True)
        print(
            f"PRINT 8: Azure OpenAI API key exists: {bool(self.api_key)}", flush=True)
        # If no API key, use fallback
        if not self.api_key:
            print("PRINT 9: No Azure OpenAI API key, using fallback prompts", flush=True)
            return self._generate_fallback_prompts(conversation, num_prompts)

        try:
            print("PRINT 10: About to prepare context", flush=True)
            # Prepare conversation context
            context = self._prepare_context(conversation)
            print("PRINT 11: Context prepared, about to call Azure OpenAI", flush=True)

            # Generate prompts using Azure OpenAI
            prompts = self._call_azure_openai(
                context=context,
                partner_name=conversation.partner_name,
                num_prompts=num_prompts,
                tone=user_tone_preference,
                relationship_health=conversation.get_relationship_health()
            )
            print("PRINT 12: Azure OpenAI returned, creating prompt objects", flush=True)

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

            print(
                f"PRINT 13: Created {len(prompt_objects)} prompt objects, returning from generate_prompts", flush=True)
            return prompt_objects

        except Exception as e:
            print(
                f"PRINT 14: Exception caught in generate_prompts: {str(e)}", flush=True)
            print(f"Error generating prompts: {str(e)}", flush=True)
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
        context_parts.append(
            f"Days since last contact: {conversation.metrics.days_since_contact}")
        context_parts.append(
            f"Total messages: {conversation.metrics.total_messages}")
        context_parts.append(
            f"Reciprocity: {conversation.metrics.reciprocity:.2f}")

        if conversation.metrics.common_topics:
            context_parts.append(
                f"Common topics: {', '.join(conversation.metrics.common_topics[:5])}")

        context_parts.append("\nRecent conversation:")

        # Add recent messages
        for msg in recent_messages:
            # Limit message length
            context_parts.append(f"{msg.sender}: {msg.content[:200]}")

        return "\n".join(context_parts)

    def _call_azure_openai(
        self,
        context: str,
        partner_name: str,
        num_prompts: int,
        tone: str,
        relationship_health: str
    ) -> List[Dict]:
        """Call Azure OpenAI API to generate prompts"""
        print("PRINT 15: _call_azure_openai() called", flush=True)

        # Determine prompt type based on relationship health
        if relationship_health == "at_risk":
            prompt_focus = "reconnection and showing genuine care"
        elif relationship_health == "dormant":
            prompt_focus = "gentle check-in and re-engagement"
        elif relationship_health == "attention":
            prompt_focus = "maintaining connection and showing interest"
        else:
            prompt_focus = "continuing the conversation naturally"
        print(f"PRINT 16: Prompt focus determined: {prompt_focus}", flush=True)

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

IMPORTANT: Return ONLY valid JSON, no other text before or after the JSON array.
"""

        # Create user message
        user_message = f"""Based on this conversation with {partner_name}, generate {num_prompts} conversation prompts:

{context}

Generate prompts that would help naturally continue or restart this conversation."""

        print("PRINT 17: About to call Azure OpenAI API", flush=True)
        response_content = None
        try:
            # Call Azure OpenAI using the utility function
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]

            response_content = generate_chat_completion(
                messages=messages,
                deployment=self.deployment,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            print("PRINT 18: Azure OpenAI API call completed", flush=True)
            print(
                f"PRINT 18.5: Raw response: {response_content[:200] if response_content else 'None'}...", flush=True)

            # Parse JSON response
            # The response might be wrapped in markdown code blocks or be plain JSON
            response_content = response_content.strip()
            if response_content.startswith("```"):
                # Remove markdown code blocks if present
                lines = response_content.split("\n")
                response_content = "\n".join(
                    lines[1:-1]) if len(lines) > 2 else response_content

            prompts = json.loads(response_content)
            print("PRINT 19: Parsed JSON response from Azure OpenAI", flush=True)

            # Handle both array and object responses
            if isinstance(prompts, dict):
                if 'prompts' in prompts:
                    prompts = prompts['prompts']
                elif 'prompt' in prompts:
                    prompts = [prompts['prompt']]
                else:
                    # If it's a dict but not the expected format, try to extract values
                    prompts = list(prompts.values()) if prompts else []

            # Ensure it's a list
            if not isinstance(prompts, list):
                prompts = [prompts]

            # Ensure we don't exceed requested number
            result = prompts[:num_prompts]
            print(
                f"PRINT 20: Returning {len(result)} prompts from _call_azure_openai", flush=True)
            return result

        except json.JSONDecodeError as e:
            print(f"PRINT 21: JSON decode error: {str(e)}", flush=True)
            if response_content:
                print(
                    f"PRINT 21.5: Response that failed to parse: {response_content[:500]}", flush=True)
            raise
        except Exception as e:
            print(f"PRINT 21: Azure OpenAI API error: {str(e)}", flush=True)
            raise

    def _generate_fallback_prompts(
        self,
        conversation: Conversation,
        num_prompts: int = 3
    ) -> List[ConversationPrompt]:
        """Generate fallback prompts when AI is unavailable"""

        partner = conversation.partner_name
        days = conversation.metrics.days_since_contact or 0
        topics = conversation.metrics.common_topics[:3] if conversation.metrics.common_topics else [
        ]

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
