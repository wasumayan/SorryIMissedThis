"""
iMessage Service for real-time message integration

This service communicates with the Photon iMessage Bridge Server (Node.js),
which uses @photon-ai/imessage-kit to directly access the local iMessage database.
The bridge server runs on macOS and provides an HTTP API for the Python backend.
"""

import os
import httpx
import asyncio
from typing import List, Dict, Optional, Callable
from datetime import datetime, timezone
import json
import logging

logger = logging.getLogger(__name__)


class iMessageService:
    """Service for real-time iMessage integration via Photon SDK"""

    def __init__(self):
        """Initialize iMessage service"""
        # Get Photon bridge server URL from environment
        # This is the local Node.js bridge server that accesses the iMessage database
        # Defaults to localhost:4000 where the bridge server runs
        self.server_url = os.getenv('PHOTON_SERVER_URL', 'http://localhost:4000')
        self.api_key = os.getenv('PHOTON_API_KEY', '')

        if not self.server_url:
            logger.warning("PHOTON_SERVER_URL not set. iMessage integration disabled.")
            self.enabled = False
        else:
            self.enabled = True
            # Ensure URL doesn't end with /
            self.server_url = self.server_url.rstrip('/')

        # Don't create AsyncClient here - it will be tied to a specific event loop
        # Instead, create it in _get_client() for each request
        self._client = None
        self._client_loop = None  # Track which event loop the client belongs to

        self.message_callbacks: List[Callable] = []
        self.is_listening = False

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create AsyncClient for the current event loop"""
        # Check if we need a new client (first time or event loop changed)
        try:
            # Try to get the current event loop
            loop = asyncio.get_event_loop()
            # If client exists, loop is still running, AND it's the same loop, reuse it
            if (self._client is not None and
                self._client_loop is loop and
                not loop.is_closed()):
                return self._client

            # If we have a client but loop changed, close the old client
            if self._client is not None and self._client_loop is not loop:
                try:
                    # Attempt to close old client synchronously (best effort)
                    if self._client_loop and not self._client_loop.is_closed():
                        self._client_loop.run_until_complete(self._client.aclose())
                except:
                    pass  # Ignore errors closing old client
                self._client = None
                self._client_loop = None
        except RuntimeError:
            # No event loop or it's closed, create new client
            loop = None

        # Create new client for current event loop
        self._client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}' if self.api_key else None
            } if self.api_key else {'Content-Type': 'application/json'}
        )
        try:
            self._client_loop = asyncio.get_event_loop()
        except RuntimeError:
            self._client_loop = None
        return self._client

    async def connect(self) -> Dict:
        """Connect to Photon server and get user identity
        
        Returns:
            Dict with 'connected' (bool) and 'user_identity' (dict with imessage_account, icloud_account, etc.)
        """
        import time
        start_time = time.time()
        request_id = f"conn_{int(time.time() * 1000)}_{id(self) % 10000}"
        logger.debug(f"[DEBUG] [{request_id}] connect: Called, enabled={self.enabled}, server_url={self.server_url}")
        
        if not self.enabled:
            logger.warning(f"[WARN] [{request_id}] connect: Service not enabled (PHOTON_SERVER_URL not configured), returning False")
            return {'connected': False, 'user_identity': None}
        
        try:
            url = f"{self.server_url}/api/server/info"
            logger.debug(f"[DEBUG] [{request_id}] connect: Requesting {url}")
            
            # Get server info which includes user's iMessage account
            client = self._get_client()
            response = await client.get(url)
            elapsed = (time.time() - start_time) * 1000
            logger.debug(f"[DEBUG] [{request_id}] connect: Response status={response.status_code} (took {elapsed:.2f}ms)")
            
            if response.status_code == 200:
                server_info = response.json()
                logger.debug(f"[DEBUG] [{request_id}] connect: Server info received: {server_info}")
                logger.info(f"[INFO] [{request_id}] ✅ Connected to Photon iMessage server")
                
                # Extract user identity from server info
                user_identity = {
                    'imessage_account': server_info.get('detected_imessage'),
                    'icloud_account': server_info.get('detected_icloud'),
                    'icloud_name': server_info.get('detected_icloud_name'),
                    'computer_id': server_info.get('computer_id')
                }
                logger.debug(f"[DEBUG] [{request_id}] connect: User identity extracted: imessage_account={user_identity.get('imessage_account')}, icloud_account={user_identity.get('icloud_account')}")
                
                total_time = (time.time() - start_time) * 1000
                logger.info(f"[INFO] [{request_id}] ✅ Connection successful (total time: {total_time:.2f}ms)")
                return {
                    'connected': True,
                    'user_identity': user_identity,
                    'server_info': server_info
                }
            else:
                elapsed = (time.time() - start_time) * 1000
                logger.error(f"[ERROR] [{request_id}] ❌ Failed to connect to Photon server: HTTP {response.status_code} (took {elapsed:.2f}ms)")
                logger.debug(f"[DEBUG] [{request_id}] connect: Response text: {response.text[:200]}")
                return {'connected': False, 'user_identity': None}
        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            logger.error(f"[ERROR] [{request_id}] ❌ Exception occurred after {elapsed:.2f}ms: {type(e).__name__}: {str(e)}")
            import traceback
            logger.debug(f"[DEBUG] [{request_id}] connect: Full traceback:\n{traceback.format_exc()}")
            return {'connected': False, 'user_identity': None}

    async def get_chats(self, limit: int = 100) -> List[Dict]:
        """Get all chats from iMessage"""
        logger.debug(f"[DEBUG] get_chats: Called with limit={limit}")
        
        if not self.enabled:
            logger.debug("[DEBUG] get_chats: Service not enabled, returning empty list")
            return []
        
        try:
            url = f"{self.server_url}/api/chats"
            params = {'limit': limit}
            logger.debug(f"[DEBUG] get_chats: Requesting {url} with params {params}")

            client = self._get_client()
            response = await client.get(url, params=params)
            logger.debug(f"[DEBUG] get_chats: Response status={response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                chats = data.get('chats', [])
                logger.debug(f"[DEBUG] get_chats: Received {len(chats)} chats")
                return chats
            else:
                logger.error(f"[ERROR] get_chats: Failed with status {response.status_code}")
                logger.debug(f"[DEBUG] get_chats: Response text: {response.text}")
                return []
        except Exception as e:
            logger.error(f"[ERROR] get_chats: Exception occurred: {str(e)}")
            logger.debug(f"[DEBUG] get_chats: Exception type: {type(e).__name__}")
            import traceback
            logger.debug(f"[DEBUG] get_chats: Traceback: {traceback.format_exc()}")
            return []

    async def get_messages(self, chat_id: str, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get messages from a specific chat"""
        if not self.enabled:
            return []
        
        try:
            client = self._get_client()
            response = await client.get(
                f"{self.server_url}/api/messages",
                params={
                    'chatGuid': chat_id,  # Photon server API uses chatGuid parameter name
                    'limit': limit,
                    'offset': offset
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get('messages', [])
            else:
                logger.error(f"Failed to get messages: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error getting messages: {str(e)}")
            return []

    async def send_message(
        self, 
        chat_id: str, 
        message: Optional[str] = None,
        content: Optional[Dict] = None
    ) -> Dict:
        """
        Send a message via iMessage
        
        Args:
            chat_id: The chat ID to send the message to (SDK format)
            message: Legacy string message (for backward compatibility)
            content: Content object with text, images, and/or files
                {
                    'text': str (optional),
                    'images': List[str] (optional),
                    'files': List[str] (optional)
                }
        
        Returns:
            Dictionary with success status and result
        """
        if not self.enabled:
            raise Exception("iMessage service is not enabled")
        
        if not message and not content:
            raise ValueError("Either message or content must be provided")
        
        try:
            payload = {'chatGuid': chat_id}  # Photon server still uses chatGuid param name
            
            # Support both legacy string format and new content object format
            if content:
                payload['content'] = content
            elif message:
                payload['message'] = message

            client = self._get_client()
            response = await client.post(
                f"{self.server_url}/api/messages/send",
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error sending message: {e.response.text}")
            raise Exception(f"Failed to send message: {e.response.text}")
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            raise

    def register_message_callback(self, callback: Callable):
        """Register a callback for new messages"""
        self.message_callbacks.append(callback)

    async def start_listening(self):
        """Start listening for new messages via WebSocket or polling"""
        if not self.enabled or self.is_listening:
            return
        
        self.is_listening = True
        logger.info("Starting iMessage listener...")
        
        # Poll for new messages every 5 seconds
        # In production, you'd use WebSocket if Photon supports it
        while self.is_listening:
            try:
                # Get recent messages from all chats
                chats = await self.get_chats(limit=50)
                for chat in chats:
                    chat_id = chat.get('chatId') or chat.get('guid')
                    messages = await self.get_messages(
                        chat_id,
                        limit=10  # Only get last 10 messages
                    )
                    
                    # Process new messages
                    for msg in messages:
                        # Check if message is recent (within last minute)
                        msg_time = msg.get('date')
                        if msg_time:
                            try:
                                # Handle ISO 8601 date strings (from Photon server)
                                if isinstance(msg_time, str):
                                    # Remove 'Z' and replace with '+00:00' for ISO parsing
                                    if msg_time.endswith('Z'):
                                        msg_dt = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
                                    else:
                                        msg_dt = datetime.fromisoformat(msg_time)
                                elif isinstance(msg_time, (int, float)):
                                    # Legacy timestamp format (milliseconds)
                                    msg_dt = datetime.fromtimestamp(msg_time / 1000, tz=timezone.utc)
                                else:
                                    msg_dt = datetime.now(timezone.utc)
                                
                                # Only process messages from last minute
                                if (datetime.now(msg_dt.tzinfo) - msg_dt).total_seconds() < 60:
                                    # Call all registered callbacks
                                    for callback in self.message_callbacks:
                                        try:
                                            await callback(msg, chat)
                                        except Exception as e:
                                            logger.error(f"Error in message callback: {str(e)}")
                            except Exception as e:
                                logger.error(f"Error parsing message time: {str(e)}")
                
                # Wait 5 seconds before next poll
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in message listener: {str(e)}")
                await asyncio.sleep(5)

    def stop_listening(self):
        """Stop listening for messages"""
        self.is_listening = False
        logger.info("Stopped iMessage listener")

    async def sync_conversations(self, user_id: str, tracking_mode: str = 'all', max_chats: int = 50, selected_chat_ids: Optional[List[str]] = None) -> List[Dict]:
        """
        Sync conversations from iMessage to our database
        Returns list of conversation data dictionaries
        
        Args:
            user_id: User ID
            tracking_mode: 'all', 'recent', or 'selected'
            max_chats: Maximum number of chats for 'recent' mode
            selected_chat_ids: List of chat IDs for 'selected' mode
        """
        import time
        start_time = time.time()
        sync_id = f"sync_{user_id[:8]}_{int(time.time() * 1000) % 100000}"
        logger.info(f"[SYNC] [{sync_id}] Starting sync for user_id={user_id}, tracking_mode={tracking_mode}, max_chats={max_chats}, selected_count={len(selected_chat_ids) if selected_chat_ids else 0}, enabled={self.enabled}")
        
        if not self.enabled:
            logger.warning(f"[WARN] [{sync_id}] sync_conversations: Service not enabled, returning empty list")
            return []
        
        if selected_chat_ids is None:
            selected_chat_ids = []
        
        try:
            logger.info(f"[SYNC] [{sync_id}] Fetching chats from iMessage (limit=200)...")
            chat_fetch_start = time.time()
            chats = await self.get_chats(limit=200)
            chat_fetch_time = (time.time() - chat_fetch_start) * 1000
            logger.info(f"[SYNC] [{sync_id}] ✅ Retrieved {len(chats)} chats from SDK (took {chat_fetch_time:.2f}ms)")
            
            if len(chats) == 0:
                elapsed = (time.time() - start_time) * 1000
                logger.warning(f"[WARN] [{sync_id}] ⚠️ No chats found after {elapsed:.2f}ms! This could mean:")
                logger.warning(f"[WARN] [{sync_id}] - No iMessage conversations exist")
                logger.warning(f"[WARN] [{sync_id}] - SDK connection issue (check PHOTON_SERVER_URL)")
                logger.warning(f"[WARN] [{sync_id}] - Permission issue accessing Messages database (check Full Disk Access)")
                return []
            
            # Filter chats BEFORE fetching messages (more efficient)
            chats_to_process = []
            if tracking_mode == 'all':
                chats_to_process = chats
            elif tracking_mode == 'recent':
                # Validate max_chats
                if max_chats < 1:
                    logger.warning(f"[SYNC] ⚠️ Invalid max_chats={max_chats}, using 1 instead")
                    max_chats = 1
                
                # Sort by last message date and take most recent
                sorted_chats = sorted(
                    chats,
                    key=lambda c: c.get('lastMessageDate') or c.get('lastMessage', {}).get('date') or '',
                    reverse=True
                )
                chats_to_process = sorted_chats[:max_chats]
                logger.info(f"[SYNC] [{sync_id}] Filtered to {len(chats_to_process)} most recent chats (from {len(chats)} total, max_chats={max_chats})")
            elif tracking_mode == 'selected':
                # Only process selected chats
                if not selected_chat_ids or len(selected_chat_ids) == 0:
                    elapsed = (time.time() - start_time) * 1000
                    logger.warning(f"[WARN] [{sync_id}] ⚠️ 'selected' mode but no selected_chat_ids provided! Returning empty list (took {elapsed:.2f}ms).")
                    return []
                
                chats_to_process = [
                    c for c in chats
                    if (c.get('chatId') or c.get('guid')) in selected_chat_ids
                ]
                logger.info(f"[SYNC] [{sync_id}] Filtered to {len(chats_to_process)} selected chats (from {len(chats)} total, {len(selected_chat_ids)} requested)")
                
                # Warn if some selected chats weren't found
                if len(chats_to_process) < len(selected_chat_ids):
                    missing = len(selected_chat_ids) - len(chats_to_process)
                    logger.warning(f"[WARN] [{sync_id}] ⚠️ {missing} selected chat(s) not found in current iMessage chats. Requested: {selected_chat_ids[:5]}{'...' if len(selected_chat_ids) > 5 else ''}")
            
            conversations = []
            
            processed_count = 0
            skipped_count = 0
            
            # OPTIMIZATION: Process chats in batches with parallel message fetching
            # This significantly speeds up sync when processing many chats
            batch_size = 5  # Process 5 chats in parallel
            for batch_start in range(0, len(chats_to_process), batch_size):
                batch = chats_to_process[batch_start:batch_start + batch_size]
                batch_num = (batch_start // batch_size) + 1
                total_batches = (len(chats_to_process) + batch_size - 1) // batch_size
                
                logger.info(f"[SYNC] [{sync_id}] Processing batch {batch_num}/{total_batches} ({len(batch)} chats)")
                
                # Fetch messages for all chats in batch in parallel
                async def process_chat(chat, idx):
                    """Process a single chat and return conversation dict or None"""
                    # Use chatId (SDK's authoritative format)
                    chat_id = chat.get('chatId') or chat.get('guid')  # Fallback to guid for backward compatibility
                    display_name = chat.get('displayName')
                    is_group = chat.get('isGroup', False) or (chat.get('style') == 43 if 'style' in chat else False)
                    
                    if not chat_id:
                        logger.warning(f"[WARN] [{sync_id}] Chat #{idx}/{len(chats_to_process)} missing chatId, skipping")
                        return None
                    
                    logger.info(f"[SYNC] [{sync_id}] Processing chat #{idx}/{len(chats_to_process)}: chatId={chat_id}, displayName={display_name or 'null'}, isGroup={is_group}")
                    
                    # Get messages for name inference and AI context
                    # Fetch more messages for AI analysis, but store fewer in DB to avoid size limits
                    msg_fetch_start = time.time()
                    all_messages = await self.get_messages(chat_id, limit=100, offset=0)
                    msg_fetch_time = (time.time() - msg_fetch_start) * 1000
                    
                    if not all_messages:
                        logger.warning(f"[WARN] [{sync_id}] ⚠️ No messages found for chat {chat_id} ({display_name or 'Unknown'}) after {msg_fetch_time:.2f}ms, skipping")
                        return None
                    
                    logger.debug(f"[DEBUG] [{sync_id}] Retrieved {len(all_messages)} messages for chat {chat_id} (took {msg_fetch_time:.2f}ms)")
                    
                    # Infer name if not saved in Contacts using AI (fail gracefully if API key is wrong)
                    from app.services.name_inference import get_name_inference_service
                    name_service = get_name_inference_service()
                    
                    # Extract phone number for context
                    contact_info = name_service.extract_contact_info_from_chat_id(chat_id)
                    phone_number = contact_info.get('phone_number')
                    
                    # Extract user's name from their own messages to exclude from inference
                    user_names = []
                    for msg in all_messages:
                        if msg.get('isFromMe', False):
                            sender_name = msg.get('senderName') or msg.get('sender')
                            if sender_name and sender_name not in user_names:
                                # Extract name parts (first name, full name variations)
                                name_parts = sender_name.split()
                                if len(name_parts) > 0:
                                    user_names.append(name_parts[0])  # First name
                                if len(name_parts) > 1:
                                    user_names.append(' '.join(name_parts))  # Full name
                                user_names.append(sender_name)  # Original name
                    
                    # Try AI name inference first (most reliable)
                    chat_name = None
                    try:
                        chat_name = name_service.infer_and_format_display_name(
                            chat_id=chat_id,
                            display_name=display_name,
                            messages=all_messages,
                            phone_number=phone_number,
                            user_names=user_names if user_names else None
                        )
                    except Exception as e:
                        # If name inference fails (e.g., 401 error), use fallback
                        logger.warning(f"[WARN] [{sync_id}] Name inference failed for chat {chat_id}: {type(e).__name__}: {str(e)}, using fallback")
                    
                    # Fallback to displayName if AI inference failed or returned just contact info
                    if not chat_name or name_service._is_just_contact_info(chat_name):
                        if display_name and not name_service._is_just_contact_info(display_name):
                            chat_name = display_name
                        else:
                            # Last resort: extract from chat_id
                            chat_name = contact_info.get('phone_number') or contact_info.get('email') or 'Unknown Contact'
                    
                    logger.info(f"[SYNC] [{sync_id}] Chat #{idx}: Using name '{chat_name}' ({len(all_messages)} messages, original displayName: {display_name or 'null'})")
                    
                    # PRIVACY: Process messages for metrics calculation ONLY - DO NOT store content
                    # Messages stay local only - we only calculate and store metadata
                    from app.models import Message
                    from app.services.chat_parser import ChatParser
                    
                    attachment_count = 0
                    image_count = 0
                    voice_message_count = 0
                    
                    # Process ALL messages for metrics calculation (content used locally only, never stored)
                    all_message_objects = []
                    for msg in all_messages:
                        try:
                            # Handle ISO 8601 date strings (from Photon server)
                            msg_time = msg.get('date')
                            try:
                                if isinstance(msg_time, str):
                                    # Remove 'Z' and replace with '+00:00' for ISO parsing
                                    if msg_time.endswith('Z'):
                                        msg_time = datetime.fromisoformat(msg_time.replace('Z', '+00:00'))
                                    else:
                                        msg_time = datetime.fromisoformat(msg_time)
                                elif isinstance(msg_time, (int, float)):
                                    # Legacy timestamp format (milliseconds)
                                    msg_time = datetime.fromtimestamp(msg_time / 1000, tz=timezone.utc)
                                elif msg_time is None:
                                    # No date provided, use current time
                                    msg_time = datetime.now(timezone.utc)
                                else:
                                    # Unknown format, use current time as fallback
                                    msg_time = datetime.now(timezone.utc)
                            except (ValueError, TypeError) as date_error:
                                # Invalid date format, use current time as fallback
                                logger.warning(f"Invalid date format for message: {msg_time}, using current time. Error: {str(date_error)}")
                                msg_time = datetime.now(timezone.utc)
                            
                            # Extract attachment metadata
                            attachments = msg.get('attachments', []) or []
                            if attachments and isinstance(attachments, list):
                                attachment_count += len(attachments)
                                for att in attachments:
                                    if not isinstance(att, dict):
                                        continue  # Skip malformed attachments
                                    mime_type = att.get('mimeType', '') or ''
                                    if mime_type.startswith('image/'):
                                        image_count += 1
                                    elif mime_type.startswith('audio/') or 'voice' in mime_type.lower():
                                        voice_message_count += 1
                            
                            # Determine sender
                            is_from_me = msg.get('isFromMe', False)
                            if is_from_me:
                                sender = 'user'  # User's messages for tone analysis
                            else:
                                sender = msg.get('handle', {}).get('name') or msg.get('sender', 'Unknown')
                            
                            # Get message text (can be None for attachment-only messages)
                            message_text = msg.get('text') or ''
                            
                            # For attachment-only messages, create a descriptive placeholder
                            # This allows us to track these messages in the conversation
                            if not message_text and attachments and isinstance(attachments, list):
                                # Create a descriptive placeholder based on attachment types
                                attachment_types = []
                                for att in attachments:
                                    if not isinstance(att, dict):
                                        continue  # Skip malformed attachments
                                    mime_type = att.get('mimeType', '') or ''
                                    if mime_type.startswith('image/'):
                                        attachment_types.append('image')
                                    elif mime_type.startswith('video/'):
                                        attachment_types.append('video')
                                    elif mime_type.startswith('audio/'):
                                        attachment_types.append('audio')
                                    else:
                                        attachment_types.append('file')
                                
                                # Create a descriptive placeholder (e.g., "[Image]", "[Video]", "[2 images]")
                                unique_types = list(set(attachment_types))
                                if len(unique_types) == 1:
                                    count = len(attachments)
                                    type_name = unique_types[0].capitalize()
                                    message_text = f"[{count} {type_name}{'s' if count > 1 else ''}]"
                                else:
                                    message_text = f"[{len(attachments)} attachments]"
                            
                            # Create Message object for metrics calculation (content used locally only, never stored)
                            all_message_objects.append(Message(
                                timestamp=msg_time,
                                sender=sender,
                                content=message_text,  # Used for metrics only, never stored in cloud
                                message_id=msg.get('guid')
                            ))
                        except Exception as e:
                            logger.error(f"Error processing message: {str(e)}")
                            continue
                    
                    # Skip if no messages found
                    if not all_message_objects:
                        logger.warning(f"[WARN] [{sync_id}] Chat #{idx}: No messages found for chat {chat_id}, skipping")
                        return None
                    
                    logger.debug(f"[DEBUG] [{sync_id}] Chat #{idx}: Processed {len(all_message_objects)} messages for metrics (attachments: {attachment_count}, images: {image_count}, voice: {voice_message_count})")
                    
                    # Calculate metrics from messages (content used locally only, never stored)
                    # Use ChatParser's metrics calculation (platform-agnostic)
                    from app.services.chat_parser import ChatParser
                    parser = ChatParser(user_id)
                    metrics = parser._calculate_metrics(
                        all_message_objects,
                        user_id
                    )
                    
                    # Create conversation WITHOUT message content (privacy: messages stay local only)
                    # Only store metadata: counts, timestamps, metrics
                    from app.models import Conversation
                    conversation = Conversation(
                        user_id=user_id,
                        partner_name=chat_name,
                        partner_id=f"{user_id}_{chat_id}",
                        messages=[],  # NO MESSAGE CONTENT - privacy: messages stay local only
                        metrics=metrics,
                        category='friends'  # Default, can be updated later
                    )
                    
                    # Store chatId in conversation dict for sending messages (SDK format)
                    conv_dict = conversation.to_dict()
                    conv_dict['chatId'] = chat_id  # Use chatId consistently (SDK format)
                    conv_dict['messageCount'] = len(all_message_objects)  # Total message count (metadata only)
                    # Remove messages array - privacy: never store message content in cloud
                    conv_dict['messages'] = []  # Empty - messages stay local only
                    
                    # Store attachment metadata (for analytics)
                    conv_dict['attachmentStats'] = {
                        'totalAttachments': attachment_count,
                        'imageCount': image_count,
                        'voiceMessageCount': voice_message_count
                    }
                    
                    return conv_dict
                
                # Process batch in parallel
                batch_results = await asyncio.gather(*[
                    process_chat(chat, batch_start + i + 1) 
                    for i, chat in enumerate(batch)
                ], return_exceptions=True)
                
                # Collect successful results
                for result in batch_results:
                    if isinstance(result, Exception):
                        logger.error(f"[ERROR] [{sync_id}] Error processing chat: {str(result)}")
                        skipped_count += 1
                    elif result is not None:
                        conversations.append(result)
                        processed_count += 1
                    else:
                        skipped_count += 1
            
            total_time = (time.time() - start_time) * 1000
            logger.info(f"[SYNC] [{sync_id}] ✅ Successfully processed {len(conversations)} conversations from {processed_count} chats (skipped: {skipped_count}, total time: {total_time:.2f}ms)")
            if len(conversations) == 0 and len(chats_to_process) > 0:
                logger.warning(f"[WARN] [{sync_id}] ⚠️ WARNING: Processed {len(chats_to_process)} chats but got 0 conversations!")
                logger.warning(f"[WARN] [{sync_id}] This likely means all chats had no messages or were filtered out")
            elif len(conversations) == 0 and len(chats_to_process) == 0:
                logger.warning(f"[WARN] [{sync_id}] ⚠️ WARNING: No chats to process after filtering!")
                logger.warning(f"[WARN] [{sync_id}] Mode: {tracking_mode}, max_chats: {max_chats}, selected_chat_ids count: {len(selected_chat_ids) if selected_chat_ids else 0}")
            return conversations
            
        except Exception as e:
            total_time = (time.time() - start_time) * 1000
            logger.error(f"[ERROR] [{sync_id}] ❌ Exception in sync_conversations after {total_time:.2f}ms: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"[ERROR] [{sync_id}] Full traceback:\n{traceback.format_exc()}")
            return []


    async def close(self):
        """Close the service and cleanup"""
        self.stop_listening()
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# Singleton instance
_imessage_service = None

def get_imessage_service() -> iMessageService:
    """Get singleton iMessage service instance"""
    global _imessage_service
    if _imessage_service is None:
        _imessage_service = iMessageService()
    return _imessage_service

