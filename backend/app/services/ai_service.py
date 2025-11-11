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
        # Check for OpenAI API key (supports both OPENAI_API_KEY and AZURE_OPENAI_API_KEY for compatibility)
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
        self.deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
        self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", 500))
        self.temperature = float(os.getenv("OPENAI_TEMPERATURE", 0.7))

        print(
            f"DEBUG: Azure OpenAI API key loaded: {bool(self.api_key)} (length: {len(self.api_key) if self.api_key else 0})", flush=True)
        if not self.api_key:
            print(
                "WARNING: OPENAI_API_KEY not set. Using fallback prompts.", flush=True)

    def infer_contact_name(self, messages: List[Dict], phone_number: Optional[str] = None) -> Optional[str]:
        """
        Infer contact name from message history using AI
        
        Args:
            messages: List of message dictionaries with 'text', 'sender', 'isFromMe' fields
            phone_number: Optional phone number for context
            
        Returns:
            Inferred name or None if not found
        """
        if not messages or not self.api_key:
            return None
        
        # Filter to only messages from the contact (not from me)
        contact_messages = [
            msg for msg in messages 
            if not msg.get('isFromMe', False) and msg.get('text')
        ]
        
        if not contact_messages:
            return None
        
        # Get recent messages (last 20 for context)
        recent_messages = contact_messages[-20:]
        message_texts = [msg.get('text', '') for msg in recent_messages if msg.get('text')]
        
        if not message_texts:
            return None
        
        # Prepare context for AI
        context = "\n".join([f"Message: {text}" for text in message_texts[-10:]])  # Last 10 messages
        
        prompt = f"""Analyze the following messages from a contact and extract their name if mentioned.

Messages:
{context}

{f"Phone number: {phone_number}" if phone_number else ""}

Instructions:
1. Look for the contact's name in introductions, signatures, or when they refer to themselves
2. Common patterns: "Hi, this is [Name]", "It's [Name]", "- [Name]", "From: [Name]", "Sent from [Name]'s iPhone"
3. Return ONLY the name (first name or full name), nothing else
4. If no name can be determined, return "null"
5. Return a single name, not multiple names

Name:"""

        try:
            response = generate_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                deployment=self.deployment,
                max_tokens=50,
                temperature=0.3  # Lower temperature for more deterministic name extraction
            )
            
            if response and response.strip().lower() not in ['null', 'none', 'n/a', '']:
                name = response.strip()
                # Clean up the response (remove quotes, extra text)
                name = name.strip('"\'')
                # Take first line only
                name = name.split('\n')[0].strip()
                # Validate it looks like a name
                if len(name) >= 2 and len(name) <= 50 and name.replace(' ', '').replace('-', '').isalpha():
                    return name
        except Exception as e:
            print(f"Error inferring name with AI: {str(e)}", flush=True)
        
        return None

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
            print("PRINT 9: No OpenAI API key, using fallback prompts", flush=True)
            return self._generate_fallback_prompts(conversation, num_prompts)

        try:
            print("PRINT 10: About to prepare context", flush=True)
            # Prepare conversation context
            context = self._prepare_context(conversation)
            
            # Analyze user's texting style from their messages
            user_style = self._analyze_user_texting_style(conversation)
            print(f"PRINT 10.5: User texting style: {user_style['style_description']}", flush=True)
            
            print("PRINT 11: Context prepared, about to call Azure OpenAI", flush=True)

            # Generate prompts using Azure OpenAI
            prompts = self._call_azure_openai(
                context=context,
                partner_name=conversation.partner_name,
                num_prompts=num_prompts,
                tone=user_tone_preference,
                relationship_health=conversation.get_relationship_health(),
                user_texting_style=user_style
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

    def _analyze_user_texting_style(self, conversation: Conversation, max_messages: int = 100) -> Dict[str, any]:
        """
        Analyze the user's texting style from their messages in this conversation
        
        Returns a dictionary describing the user's texting patterns
        """
        # Get last max_messages messages for tone analysis
        recent_messages = conversation.get_last_n_messages(max_messages)
        
        # Get user messages (assuming user_id or 'user' is the sender)
        user_messages = [msg for msg in recent_messages 
                        if msg.sender == conversation.user_id or msg.sender.lower() == 'user']
        
        if not user_messages:
            # Fallback: try to identify user messages by comparing with partner
            # If we have partner_name, messages not from partner are from user
            user_messages = [msg for msg in recent_messages 
                           if msg.sender.lower() != conversation.partner_name.lower()]
        
        if len(user_messages) < 3:
            # Not enough messages to analyze style
            return {
                'style_description': 'neutral',
                'emoji_usage': 'occasional',
                'punctuation_style': 'standard',
                'sentence_length': 'medium',
                'formality': 'neutral'
            }
        
        # Analyze patterns
        all_text = ' '.join([msg.content for msg in user_messages if msg.content])
        
        # Emoji usage
        import re
        emoji_count = len(re.findall(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251]+', all_text))
        emoji_ratio = emoji_count / len(user_messages) if user_messages else 0
        if emoji_ratio > 0.5:
            emoji_usage = 'frequent'
        elif emoji_ratio > 0.2:
            emoji_usage = 'moderate'
        else:
            emoji_usage = 'occasional'
        
        # Punctuation style
        exclamation_count = all_text.count('!')
        question_count = all_text.count('?')
        ellipsis_count = all_text.count('...') + all_text.count('…')
        total_chars = len(all_text)
        
        if exclamation_count / max(total_chars, 1) > 0.02:
            punctuation_style = 'enthusiastic'
        elif ellipsis_count > len(user_messages) * 0.1:
            punctuation_style = 'casual'
        elif question_count / max(total_chars, 1) > 0.03:
            punctuation_style = 'inquisitive'
        else:
            punctuation_style = 'standard'
        
        # Sentence length
        messages_with_content = [msg for msg in user_messages if msg.content]
        avg_length = sum(len(msg.content.split()) for msg in messages_with_content) / len(messages_with_content) if messages_with_content else 0
        if avg_length > 20:
            sentence_length = 'long'
        elif avg_length < 5:
            sentence_length = 'short'
        else:
            sentence_length = 'medium'
        
        # Formality indicators
        formal_words = ['please', 'thank you', 'would', 'could', 'should']
        casual_words = ['hey', 'yo', 'lol', 'haha', 'omg', 'btw']
        formal_count = sum(1 for word in formal_words if word in all_text.lower())
        casual_count = sum(1 for word in casual_words if word in all_text.lower())
        
        if formal_count > casual_count * 2:
            formality = 'formal'
        elif casual_count > formal_count * 2:
            formality = 'casual'
        else:
            formality = 'neutral'
        
        # Capitalization style
        messages_with_content = [msg for msg in user_messages if msg.content]
        all_caps_ratio = sum(1 for msg in messages_with_content if msg.content.isupper() and len(msg.content) > 3) / len(messages_with_content) if messages_with_content else 0
        if all_caps_ratio > 0.1:
            capitalization = 'expressive'
        else:
            capitalization = 'standard'
        
        # Build style description
        style_parts = []
        if emoji_usage != 'occasional':
            style_parts.append(f"uses emojis {emoji_usage}ly")
        if punctuation_style != 'standard':
            style_parts.append(f"{punctuation_style} punctuation")
        if sentence_length != 'medium':
            style_parts.append(f"{sentence_length} sentences")
        if formality != 'neutral':
            style_parts.append(f"{formality} language")
        if capitalization == 'expressive':
            style_parts.append("sometimes uses all caps for emphasis")
        
        style_description = ', '.join(style_parts) if style_parts else 'neutral, standard texting style'
        
        return {
            'style_description': style_description,
            'emoji_usage': emoji_usage,
            'punctuation_style': punctuation_style,
            'sentence_length': sentence_length,
            'formality': formality,
            'capitalization': capitalization,
            'example_messages': [msg.content[:100] for msg in user_messages[-3:] if msg.content]  # Last 3 user messages as examples
        }

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
            # Skip messages with no content
            if not msg.content:
                continue
            # Limit message length
            context_parts.append(f"{msg.sender}: {msg.content[:200]}")

        return "\n".join(context_parts)

    def _call_azure_openai(
        self,
        context: str,
        partner_name: str,
        num_prompts: int,
        tone: str,
        relationship_health: str,
        user_texting_style: Dict = None
    ) -> List[Dict]:
        """Call Azure OpenAI API to generate prompts"""

        # Determine prompt type based on relationship health
        if relationship_health == "at_risk":
            prompt_focus = "reconnection and showing genuine care"
        elif relationship_health == "dormant":
            prompt_focus = "gentle check-in and re-engagement"
        elif relationship_health == "attention":
            prompt_focus = "maintaining connection and showing interest"
        else:
            prompt_focus = "continuing the conversation naturally"

        print("PRINT 15: _call_azure_openai() called", flush=True)
        print(f"PRINT 16: Prompt focus determined: {prompt_focus}", flush=True)

        # Build user style description
        style_instruction = ""
        if user_texting_style:
            style_desc = user_texting_style.get('style_description', 'standard')
            style_instruction = f"""
6. MOST IMPORTANTLY: Match the user's actual texting style. The user's texting style is: {style_desc}
   - Emoji usage: {user_texting_style.get('emoji_usage', 'occasional')}
   - Punctuation: {user_texting_style.get('punctuation_style', 'standard')}
   - Sentence length: {user_texting_style.get('sentence_length', 'medium')}
   - Formality: {user_texting_style.get('formality', 'neutral')}
   
   Example of user's messages:
   {chr(10).join(user_texting_style.get('example_messages', [])[:3])}
   
   Your prompts should sound like the user wrote them, matching their exact style, vocabulary, and patterns.
"""

        # Create system message
        system_message = f"""You are a helpful assistant that generates natural, context-aware conversation prompts 
to help people stay connected with their friends and family. 

Your prompts should:
1. Be based on the actual conversation history
2. Feel authentic and personal (not generic)
3. Match a {tone} tone
4. Focus on {prompt_focus}
5. Reference specific topics or events mentioned
6. Be short (1-2 sentences){style_instruction}

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

    def classify_contact_category(self, conversation: Conversation) -> str:
        """
        Classify a contact into category (family, friends, work) using AI
        
        Args:
            conversation: The conversation to classify
            
        Returns:
            Category string: 'family', 'friends', or 'work'
        """
        if not self.api_key:
            # Fallback to default
            return 'friends'
        
        try:
            # Get conversation context
            recent_messages = conversation.get_last_n_messages(20)
            context = "\n".join([f"{msg.sender}: {msg.content[:100]}" for msg in recent_messages[:10] if msg.content])
            
            # Create classification prompt
            system_message = """You are a helpful assistant that classifies relationships based on conversation content.

Analyze the conversation and classify the relationship into one of these categories:
- "family": Family members (parents, siblings, relatives)
- "friends": Close friends, casual friends, social connections
- "work": Professional contacts, colleagues, business relationships

Return ONLY the category name (family, friends, or work), nothing else."""

            user_message = f"""Classify this conversation with {conversation.partner_name}:

{context}

What category best describes this relationship?"""

            response = generate_chat_completion(
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                deployment=self.deployment,
                temperature=0.3,  # Lower temperature for classification
                max_tokens=10
            )
            
            # Parse response
            category = response.strip().lower()
            if category in ['family', 'friends', 'work']:
                return category
            else:
                # Default fallback
                return 'friends'
                
        except Exception as e:
            print(f"Error classifying contact: {str(e)}")
            return 'friends'  # Default fallback
