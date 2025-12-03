"""
Name Inference Service

Infers contact names from message history when contact is not saved in Contacts app.
Uses AI service to extract names from conversation context.
"""

import re
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


class NameInferenceService:
    """Service to infer contact names from message history using AI"""

    def __init__(self):
        """Initialize name inference service"""
        from app.services.ai_service import AIService
        self.ai_service = AIService()

    def infer_name_from_messages(self, messages: List[Dict], phone_number: Optional[str] = None, user_names: Optional[List[str]] = None) -> Optional[str]:
        """
        Infer contact name from message history using AI
        
        Args:
            messages: List of message dictionaries with 'text', 'sender', 'isFromMe' fields
            phone_number: Optional phone number for context
            user_names: Optional list of user's name variations to exclude
            
        Returns:
            Inferred name or None if not found
        """
        if not messages:
            return None
        
        try:
            # Use AI service to infer name (fail gracefully if API key is wrong)
            # Pass user_names to prevent returning user's own name
            inferred_name = self.ai_service.infer_contact_name(messages, phone_number, user_names)
            
            if inferred_name:
                logger.info(f"AI inferred name: {inferred_name}")
                return inferred_name
        except Exception as e:
            # If AI inference fails (e.g., 401 error), log and return None
            logger.warning(f"Name inference failed: {str(e)}, skipping AI inference")
        
        return None

    def extract_contact_info_from_chat_id(self, chat_id: str) -> Dict[str, Optional[str]]:
        """
        Extract phone number or email from chatId
        
        Args:
            chat_id: Chat identifier (e.g., "iMessage;+1234567890" or "chat123...")
            
        Returns:
            Dictionary with 'phone_number', 'email', and 'service' keys
        """
        result = {
            'phone_number': None,
            'email': None,
            'service': None
        }
        
        if not chat_id:
            return result
        
        # Check if it's a service-prefixed format (DM)
        if ';' in chat_id:
            parts = chat_id.split(';')
            if len(parts) >= 2:
                result['service'] = parts[0]  # e.g., "iMessage", "SMS"
                identifier = parts[-1]  # Last part is the identifier
                
                # Check if it's an email
                if '@' in identifier and '.' in identifier.split('@')[1]:
                    result['email'] = identifier
                # Check if it's a phone number
                elif re.match(r'^\+?[\d\s\-()]+$', identifier):
                    # Clean phone number
                    cleaned = re.sub(r'[\s\-()]', '', identifier)
                    if cleaned.startswith('+'):
                        result['phone_number'] = cleaned
                    elif len(cleaned) >= 10:
                        result['phone_number'] = '+' + cleaned if not cleaned.startswith('+') else cleaned
        
        return result

    def infer_and_format_display_name(
        self,
        chat_id: str,
        display_name: Optional[str],
        messages: Optional[List[Dict]] = None,
        phone_number: Optional[str] = None,
        user_names: Optional[List[str]] = None
    ) -> str:
        """
        Get display name with inference fallback
        
        Args:
            chat_id: Chat identifier
            display_name: Display name from Contacts (may be None)
            messages: Optional message history for inference
            
        Returns:
            Display name (from Contacts, inferred, or extracted from chatId)
        """
        # If we have a saved contact name, use it
        if display_name and not self._is_just_contact_info(display_name):
            return display_name
        
        # Try to infer from messages using AI
        if messages:
            inferred = self.infer_name_from_messages(messages, phone_number, user_names)
            if inferred:
                # If AI returned contact info (phone/email), try again with more messages
                if self._is_just_contact_info(inferred):
                    logger.info(f"AI returned contact info '{inferred}', trying with more context (last 50 messages)")
                    # Try again with more messages for better context
                    inferred = self.infer_name_from_messages(messages[-50:] if len(messages) > 50 else messages, phone_number, user_names)
                    if inferred and not self._is_just_contact_info(inferred):
                        logger.info(f"AI inferred name '{inferred}' for chat {chat_id} (with more context)")
                        return inferred
                    # If still contact info, don't use it - fall through to next tier
                else:
                    logger.info(f"AI inferred name '{inferred}' for chat {chat_id}")
                    return inferred
        
        # Fallback: extract phone/email from chatId
        contact_info = self.extract_contact_info_from_chat_id(chat_id)
        if contact_info.get('phone_number'):
            return contact_info['phone_number']
        elif contact_info.get('email'):
            return contact_info['email']
        
        # Last resort
        return 'Unknown Contact'

    def _is_just_contact_info(self, name: str) -> bool:
        """Check if name is just a phone number or email (no saved contact)"""
        if not name:
            return True
        
        # If name has any letters (not just digits/symbols), it's probably a real name
        # This prevents false positives like "123 Main St" or "John@work" from being filtered
        if any(c.isalpha() for c in name):
            # Has letters - check if it's still just an email (has @ and .)
            if '@' in name and '.' in name.split('@')[1]:
                # Check if it's JUST an email (no other text)
                parts = name.split('@')
                if len(parts) == 2 and not any(c.isalpha() for c in parts[0].replace('.', '').replace('_', '').replace('-', '')):
                    return True
            else:
                # Has letters and not just an email - probably a real name
                return False
        
        cleaned = name.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        
        # Phone number patterns (only if no letters)
        if cleaned.startswith('+') and cleaned[1:].isdigit():
            return True
        if cleaned.isdigit() and len(cleaned) >= 10:
            return True
        
        # Email pattern (only if no letters before @)
        if '@' in name and '.' in name.split('@')[1]:
            # Check if it's just an email address (no name prefix)
            email_part = name.split('@')[0]
            if not any(c.isalpha() for c in email_part.replace('.', '').replace('_', '').replace('-', '')):
                return True
        
        return False


# Singleton instance
_name_inference_service = None

def get_name_inference_service() -> NameInferenceService:
    """Get singleton name inference service instance"""
    global _name_inference_service
    if _name_inference_service is None:
        _name_inference_service = NameInferenceService()
    return _name_inference_service

