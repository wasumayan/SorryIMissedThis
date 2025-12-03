"""
Helper utilities for consistent data access
"""

from typing import Any, Optional, Dict


def get_user_id(data: Dict, query_params: Optional[Dict] = None) -> Optional[str]:
    """
    Get user_id from data dict or query params with consistent field name handling
    
    Supports both camelCase (userId) and snake_case (user_id) for backward compatibility
    """
    if data and isinstance(data, dict):
        return data.get('userId') or data.get('user_id')
    if query_params:
        return query_params.get('userId') or query_params.get('user_id')
    return None


def get_conversation_id(data: Dict) -> Optional[str]:
    """
    Get conversation_id from data dict with consistent field name handling
    
    Supports both camelCase (conversationId) and snake_case (conversation_id)
    """
    if not data or not isinstance(data, dict):
        return None
    return data.get('conversationId') or data.get('conversation_id')


def get_partner_name(data: Dict) -> Optional[str]:
    """
    Get partner_name from data dict with consistent field name handling
    
    Supports both camelCase (partnerName) and snake_case (partner_name)
    """
    if not data or not isinstance(data, dict):
        return None
    return data.get('partnerName') or data.get('partner_name')


def safe_get(data: Dict, *keys: str, default: Any = None) -> Any:
    """
    Safely get value from dict trying multiple key formats
    
    Args:
        data: Dictionary to search
        keys: Multiple key names to try (e.g., 'userId', 'user_id')
        default: Default value if none found
    
    Returns:
        First found value or default
    """
    if not data or not isinstance(data, dict):
        return default
    
    for key in keys:
        if key in data:
            return data[key]
    
    return default




