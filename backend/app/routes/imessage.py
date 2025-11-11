"""
iMessage integration routes
Handles real-time iMessage synchronization
"""

from flask import Blueprint, request, jsonify, current_app
from app.utils.helpers import get_user_id, get_partner_name, safe_get, get_conversation_id
from app.services.imessage_service import get_imessage_service
from app.services.azure_storage import storage
import asyncio
import os
import secrets
import uuid

imessage_bp = Blueprint('imessage', __name__)


@imessage_bp.route('/connect', methods=['POST'])
def connect_imessage():
    """
    Connect to iMessage service and auto-identify/create user
    
    This endpoint:
    1. Connects to iMessage via Photon
    2. Gets the user's iMessage account (phone/email) from Photon
    3. Auto-creates or finds user based on iMessage account
    4. Returns user data and token
    
    Optional JSON body:
    {
        "userName": "User's name"  // User's preferred name
    }
    
    No login/password required - user is identified by their iMessage account.
    """
    import time
    request_id = f"conn_{int(time.time() * 1000)}_{id(request) % 10000}"
    start_time = time.time()
    current_app.logger.info(f"[DEBUG] [{request_id}] POST /imessage/connect: Request received")
    
    try:
        data = request.get_json() or {}
        user_name = data.get('userName')  # User's preferred name
        current_app.logger.debug(f"[DEBUG] [{request_id}] Request body: userName={user_name}")
        
        service = get_imessage_service()
        current_app.logger.debug(f"[DEBUG] [{request_id}] Service status: enabled={service.enabled}, server_url={service.server_url}")
        
        # Run async connect to get user identity
        current_app.logger.debug(f"[DEBUG] [{request_id}] Calling service.connect()...")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        connect_result = loop.run_until_complete(service.connect())
        loop.close()
        
        elapsed = (time.time() - start_time) * 1000
        current_app.logger.debug(f"[DEBUG] [{request_id}] Connect result: connected={connect_result.get('connected')} (took {elapsed:.2f}ms)")
        
        if not connect_result.get('connected'):
            current_app.logger.error(f"[ERROR] [{request_id}] ❌ Failed to connect to iMessage service after {elapsed:.2f}ms")
            return jsonify({
                'success': False,
                'error': 'Failed to connect to iMessage service. Check PHOTON_SERVER_URL configuration.'
            }), 503
        
        user_identity = connect_result.get('user_identity', {})
        imessage_account = user_identity.get('imessage_account') or user_identity.get('icloud_account')
        
        # If no iMessage account detected (simpler SDK doesn't provide this),
        # use a fallback identifier based on the user's name or generate one
        if not imessage_account:
            # Use userName if provided, otherwise generate a unique identifier
            if user_name:
                # Create a simple identifier from the name
                imessage_account = f"user_{user_name.lower().replace(' ', '_')}@local"
            else:
                # Generate a unique identifier
                imessage_account = f"user_{str(uuid.uuid4())[:8]}@local"
            
            current_app.logger.info(f"No iMessage account detected, using fallback: {imessage_account}")
        
        # Find or create user based on iMessage account
        # Use iMessage account as the unique identifier
        from app.services.azure_storage import storage
        from datetime import datetime
        import uuid
        import secrets
        
        # Try to find existing user by iMessage account
        # We'll store imessage_account in a custom field
        user = None
        try:
            # Query users by imessage_account (stored as a field)
            query = "SELECT * FROM c WHERE c.imessage_account = @account"
            parameters = [{"name": "@account", "value": imessage_account}]
            
            users = list(storage.users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
            if users:
                user = users[0]
        except Exception as e:
            current_app.logger.warning(f"Error querying users: {str(e)}")
        
        # Create user if doesn't exist
        if not user:
            user_id = str(uuid.uuid4())
            token = secrets.token_urlsafe(32)
            refresh_token = secrets.token_urlsafe(32)
            
            user_data = {
                'id': user_id,
                'name': user_name or user_identity.get('icloud_name', 'User'),  # Use provided name or fallback
                'email': imessage_account,  # Use iMessage account as email
                'imessage_account': imessage_account,  # Primary identifier
                'icloud_account': user_identity.get('icloud_account'),
                'password': None,  # No password needed
                'preferences': {
                    'privacy': {
                        'localOnly': False,
                        'cloudSync': True,
                        'dataRetention': 365
                    },
                    'notifications': {
                        'email': True,
                        'push': True,
                        'frequency': 'daily'
                    },
                    'ai': {
                        'promptStyle': 'friendly',
                        'autoAnalysis': True
                    },
                    'chatTracking': {
                        'mode': 'all',
                        'maxChats': 50,
                        'selectedChatIds': []
                    }
                },
                'connectedPlatforms': {
                    'imessage': {'connected': True},
                    'whatsapp': {'connected': False},
                    'telegram': {'connected': False}
                },
                'lastActive': datetime.utcnow().isoformat(),
                'createdAt': datetime.utcnow().isoformat(),
                'type': 'user'
            }
            
            # Create user
            if not storage.create_user(user_data):
                return jsonify({'error': 'Failed to create user'}), 500
            
            user = user_data
            
            # Create session
            session_data = {
                'id': token,
                'userId': user_id,
                'token': token,
                'refreshToken': refresh_token,
                'expiresAt': (datetime.utcnow().timestamp() + (30 * 24 * 60 * 60))  # 30 days
            }
            
            if not storage.create_session(session_data):
                return jsonify({'error': 'Failed to create session'}), 500
        else:
            # User exists - update name if provided and create new session
            if user_name:
                storage.update_user(user['id'], {
                    'name': user_name,
                    'lastActive': datetime.utcnow().isoformat()
                })
                user['name'] = user_name  # Update local user object
            else:
                storage.update_user(user['id'], {'lastActive': datetime.utcnow().isoformat()})
            
            token = secrets.token_urlsafe(32)
            refresh_token = secrets.token_urlsafe(32)
            
            session_data = {
                'id': token,
                'userId': user['id'],
                'token': token,
                'refreshToken': refresh_token,
                'expiresAt': (datetime.utcnow().timestamp() + (30 * 24 * 60 * 60))
            }
            
            if not storage.create_session(session_data):
                return jsonify({'error': 'Failed to create session'}), 500
        
        # Set user_id on bridge server for webhook forwarding
        try:
            import httpx
            bridge_url = os.getenv('PHOTON_SERVER_URL', 'http://localhost:4000')
            client = httpx.Client(timeout=5.0)
            client.post(
                f"{bridge_url}/api/connect",
                json={'userId': user['id']}
            )
            client.close()
        except Exception as e:
            current_app.logger.warning(f"Could not set user_id on bridge server: {str(e)}")
        
        # Remove password from response
        user_response = {k: v for k, v in user.items() if k != 'password'}
        
        return jsonify({
            'success': True,
            'message': 'Connected to iMessage and user identified',
            'data': {
                'user': user_response,
                'token': token,
                'refreshToken': refresh_token,
                'user_identity': user_identity
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error connecting to iMessage: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/sync', methods=['POST'])
def sync_imessage():
    """
    Sync all iMessage conversations to database
    
    Expected JSON body:
    {
        "userId": "user-id"
    }
    """
    try:
        data = request.get_json()
        user_id = get_user_id(data)
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400
        
        # Verify user exists
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user's chat tracking preferences
        preferences = user.get('preferences', {}) if isinstance(user, dict) else getattr(user, 'preferences', {})
        chat_tracking = preferences.get('chatTracking', {})
        tracking_mode = chat_tracking.get('mode', 'all')  # 'all', 'recent', 'selected'
        max_chats = chat_tracking.get('maxChats', 50)  # For 'recent' mode
        selected_chat_ids = chat_tracking.get('selectedChatIds', []) or chat_tracking.get('selectedChatGuids', [])  # Support legacy format
        
        service = get_imessage_service()
        
        # Set user_id on bridge server for webhook forwarding
        try:
            import httpx
            bridge_url = os.getenv('PHOTON_SERVER_URL', 'http://localhost:4000')
            # Use sync client for this simple request
            client = httpx.Client(timeout=5.0)
            client.post(
                f"{bridge_url}/api/connect",
                json={'userId': user_id}
            )
            client.close()
        except Exception as e:
            current_app.logger.warning(f"Could not set user_id on bridge server: {str(e)}")
        
        # Run async sync
        import time
        sync_request_id = f"sync_{user_id[:8]}_{int(time.time() * 1000) % 100000}"
        sync_start_time = time.time()
        current_app.logger.info(f"[DEBUG] [{sync_request_id}] POST /imessage/sync: Starting sync for user_id={user_id}, tracking_mode={tracking_mode}, max_chats={max_chats}, selected_count={len(selected_chat_ids) if selected_chat_ids else 0}")
        loop = None
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Create a new httpx client for this request to avoid event loop issues
            import httpx
            
            async def sync_with_new_client():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    # Temporarily replace the service's client
                    old_client = service.client
                    service.client = client
                    try:
                        # Pass tracking preferences to sync_conversations so it can filter BEFORE fetching messages
                        return await service.sync_conversations(
                            user_id,
                            tracking_mode=tracking_mode,
                            max_chats=max_chats,
                            selected_chat_ids=selected_chat_ids
                        )
                    finally:
                        service.client = old_client
            
            all_conversations = loop.run_until_complete(sync_with_new_client())
            sync_elapsed = (time.time() - sync_start_time) * 1000
            current_app.logger.info(f"[DEBUG] [{sync_request_id}] Sync completed: {len(all_conversations)} conversations (took {sync_elapsed:.2f}ms)")
        except Exception as e:
            sync_elapsed = (time.time() - sync_start_time) * 1000
            current_app.logger.error(f"[ERROR] [{sync_request_id}] ❌ Error in sync_conversations after {sync_elapsed:.2f}ms: {type(e).__name__}: {str(e)}")
            import traceback
            current_app.logger.error(f"[ERROR] [{sync_request_id}] Full traceback:\n{traceback.format_exc()}")
            all_conversations = []
        finally:
            # Clean up event loop
            if loop:
                try:
                    pending = asyncio.all_tasks(loop)
                    for task in pending:
                        task.cancel()
                    if pending:
                        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                except Exception:
                    pass
                finally:
                    loop.close()
        
        total_elapsed = (time.time() - sync_start_time) * 1000
        current_app.logger.info(f"[SYNC] [{sync_request_id}] Retrieved {len(all_conversations)} conversations from iMessage (already filtered by tracking preferences, total time: {total_elapsed:.2f}ms)")
        
        if len(all_conversations) == 0:
            current_app.logger.warning(f"[WARN] [{sync_request_id}] ⚠️ WARNING: No conversations retrieved after {total_elapsed:.2f}ms! This could mean:")
            current_app.logger.warning(f"[SYNC] - No chats found in iMessage")
            current_app.logger.warning(f"[SYNC] - All chats were filtered out by tracking preferences")
            current_app.logger.warning(f"[SYNC] - All chats were filtered out (no saved contacts)")
            current_app.logger.warning(f"[SYNC] - Error in sync_conversations (check logs above)")
        
        # Conversations are already filtered by sync_conversations, so use them directly
        conversations_to_save = all_conversations
        
        # Classify contacts using AI
        from app.services.ai_service import AIService
        ai_service = AIService()
        
        # Save conversations to database
        current_app.logger.info(f"[SYNC] Saving {len(conversations_to_save)} conversations to database (filtered from {len(all_conversations)} total)")
        conversation_ids = []
        saved_count = 0
        failed_count = 0
        for conv_data in conversations_to_save:
            # Use helper for consistent field access
            partner_name = get_partner_name(conv_data) or 'Unknown'
            partner_id = safe_get(conv_data, 'partnerId', 'partner_id', default='')
            
            current_app.logger.debug(f"[DEBUG] /imessage/sync: Saving conversation: {partner_name} (chatId: {conv_data.get('chatId', 'N/A')})")
            # Use AI to classify if category not set
            if not conv_data.get('category') or conv_data.get('category') == 'friends':
                # Convert to Conversation object for classification
                from app.models import Conversation, Message, ConversationMetrics
                try:
                    messages = [Message.from_dict(m) for m in conv_data.get('messages', [])]
                    metrics = ConversationMetrics.from_dict(conv_data.get('metrics', {}))
                    conv_obj = Conversation(
                        user_id=user_id,
                        partner_name=partner_name,
                        partner_id=partner_id,
                        messages=messages,
                        metrics=metrics,
                        category=conv_data.get('category', 'friends')
                    )
                    # Classify using AI
                    classified_category = ai_service.classify_contact_category(conv_obj)
                    conv_data['category'] = classified_category
                    current_app.logger.info(f"Classified {partner_name} as {classified_category}")
                except Exception as e:
                    current_app.logger.error(f"Error classifying conversation: {str(e)}")
            
            try:
                conv_id = storage.create_conversation(conv_data)
                if conv_id:
                    conversation_ids.append(conv_id)
                    saved_count += 1
                    current_app.logger.debug(f"[SYNC] ✅ Saved conversation: {partner_name} (id: {conv_id})")
                else:
                    failed_count += 1
                    current_app.logger.warning(f"[SYNC] ❌ Failed to save conversation: {partner_name} (storage.create_conversation returned None)")
            except Exception as e:
                failed_count += 1
                current_app.logger.error(f"[SYNC] ❌ Error saving conversation {partner_name}: {str(e)}")
                import traceback
                current_app.logger.error(f"[SYNC] Traceback: {traceback.format_exc()}")
        
        current_app.logger.info(f"[SYNC] Summary: {saved_count} saved, {failed_count} failed, {len(conversations_to_save)} total")
        
        return jsonify({
            'success': True,
            'message': f'Synced {len(conversations_to_save)} conversations (filtered from {len(all_conversations)} total)',
            'data': {
                'conversations_synced': len(conversations_to_save),
                'total_available': len(all_conversations),
                'tracking_mode': tracking_mode,
                'conversation_ids': conversation_ids
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error syncing iMessage: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/status', methods=['GET'])
def get_imessage_status():
    """
    Get iMessage service status
    """
    try:
        service = get_imessage_service()
        
        return jsonify({
            'success': True,
            'data': {
                'enabled': service.enabled,
                'connected': service.is_listening,
                'server_url': service.server_url if service.enabled else None
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting iMessage status: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/webhook', methods=['POST'])
def imessage_webhook():
    """
    Webhook endpoint for receiving real-time message events from bridge server
    
    Expected JSON body:
    {
        "type": "new-message" | "message-updated",
        "data": { message data from Photon SDK }
    }
    """
    try:
        data = request.get_json() or {}
        event_type = data.get('type')
        message_data = data.get('data', {}) if isinstance(data.get('data'), dict) else {}
        
        if event_type == 'new-message':
            # Process new incoming message
            chat_id = message_data.get('chatId') or message_data.get('chatGuid') or message_data.get('guid')  # Support legacy formats from Photon
            message_text = message_data.get('text', '')
            handle = message_data.get('handle', {})
            sender_address = handle.get('address', 'Unknown')
            sender_name = handle.get('name') or sender_address
            is_from_me = message_data.get('isFromMe', False)
            message_guid = message_data.get('guid')
            timestamp = message_data.get('date') or message_data.get('dateCreated')
            
            if not chat_id:
                return jsonify({'error': 'Missing chatId'}), 400
            
            current_app.logger.info(f"New message received: {message_text[:50]} from {sender_name}")
            
            # Get user_id from request or find from conversation
            request_data = request.get_json() or {}
            user_id = request.headers.get('X-User-Id') or get_user_id(request_data)
            
            if not user_id:
                current_app.logger.warning("No user_id provided in webhook. Message logged but not stored.")
                return jsonify({
                    'success': True,
                    'message': 'Message received but user_id required for storage',
                    'warning': 'Include user_id in webhook request'
                }), 200
            
            # Find conversation by chatId
            conversation = storage.find_conversation_by_chat_id(chat_id, user_id)
            
            if not conversation:
                current_app.logger.info(f"Conversation not found for chatId: {chat_id}. Message will be stored on next sync.")
                return jsonify({
                    'success': True,
                    'message': 'Conversation not found. Sync conversations first.',
                    'chatId': chat_id
                }), 200
            
            # Parse timestamp
            from datetime import datetime
            try:
                if isinstance(timestamp, str):
                    msg_timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                elif isinstance(timestamp, (int, float)):
                    msg_timestamp = datetime.fromtimestamp(timestamp / 1000)
                else:
                    msg_timestamp = datetime.utcnow()
            except Exception as e:
                current_app.logger.error(f"Error parsing timestamp: {str(e)}")
                msg_timestamp = datetime.utcnow()
            
            # Determine sender name
            if is_from_me:
                sender_name = user_id  # Or get actual user name
            else:
                sender_name = sender_name or sender_address
            
            # Create message metadata (content stored locally on device)
            message_dict = {
                'timestamp': msg_timestamp.isoformat(),
                'sender': sender_name,
                'content': message_text,  # Included for frontend to store locally
                'message_id': message_guid
            }
            
            # Update conversation metadata (not storing message content in cloud)
            conversation_id = get_conversation_id(conversation) or conversation.get('id')
            success = storage.add_message_to_conversation(conversation_id, user_id, message_dict)
            
            if success:
                current_app.logger.info(f"Conversation metadata updated: {conversation_id}")
                # Message content should be stored locally by frontend
                # TODO: Trigger prompt regeneration if needed
                # TODO: Update frontend via WebSocket if connected
            else:
                current_app.logger.error(f"Failed to update conversation metadata: {conversation_id}")
            
            # Return message data for frontend to store locally
            return jsonify({
                'success': True,
                'message': 'Message metadata updated. Store message locally.',
                'conversation_id': conversation_id,
                'message_data': message_dict  # For frontend local storage
            }), 200
        
        elif event_type == 'message-updated':
            # Handle message updates (read receipts, etc.)
            current_app.logger.info(f"Message updated: {message_data.get('guid')}")
            return jsonify({'success': True}), 200
        
        else:
            return jsonify({'error': f'Unknown event type: {event_type}'}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error processing webhook: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/listen/start', methods=['POST'])
def start_listening():
    """
    Start listening for real-time messages
    """
    try:
        service = get_imessage_service()
        
        if service.is_listening:
            return jsonify({
                'success': True,
                'message': 'Already listening'
            }), 200
        
        # Register callback to process new messages
        async def process_new_message(msg, chat):
            """Process new message and store in database"""
            try:
                chat_id = chat.get('chatId') or chat.get('guid')  # Fallback to guid for backward compatibility
                if not chat_id:
                    return  # Skip if no chat_id
                message_text = msg.get('text', '')
                sender = msg.get('handle', {}).get('address', 'Unknown')
                is_from_me = msg.get('isFromMe', False)
                
                current_app.logger.info(f"Processing new message: {message_text[:50]}")
                
                # Find or create conversation
                # This is a simplified version - you'd want to:
                # 1. Find conversation by chatId
                # 2. Add message to conversation
                # 3. Update metrics
                # 4. Trigger AI prompt regeneration if needed
                
            except Exception as e:
                current_app.logger.error(f"Error processing message: {str(e)}")
        
        service.register_message_callback(process_new_message)
        
        # Start listening in background
        import threading
        def run_listener():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(service.start_listening())
            loop.close()
        
        thread = threading.Thread(target=run_listener, daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Started listening for messages'
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error starting listener: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/chats', methods=['GET'])
def get_available_chats():
    """
    Get list of available iMessage chats for user to select from
    
    Query params:
    - limit: Maximum number of chats to return (default: 200)
    """
    try:
        limit = request.args.get('limit', 200, type=int)
        
        service = get_imessage_service()
        
        # Run async get_chats
        # Create new event loop for this request
        loop = None
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Create a new httpx client for this request to avoid event loop issues
            import httpx
            
            async def get_chats_with_new_client():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    # Temporarily replace the service's client
                    old_client = service.client
                    service.client = client
                    try:
                        return await service.get_chats(limit=limit)
                    finally:
                        service.client = old_client
            
            chats = loop.run_until_complete(get_chats_with_new_client())
        except Exception as e:
            current_app.logger.error(f"Error getting chats: {str(e)}")
            import traceback
            current_app.logger.debug(f"Traceback: {traceback.format_exc()}")
            chats = []
        finally:
            # Clean up event loop
            if loop:
                try:
                    pending = asyncio.all_tasks(loop)
                    for task in pending:
                        task.cancel()
                    if pending:
                        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                except Exception:
                    pass
                finally:
                    loop.close()
        
        # Format chats for frontend - include all chats, use chatId (SDK format)
        formatted_chats = []
        for chat in chats:
            # Use chatId (SDK's authoritative format)
            chat_id = chat.get('chatId') or chat.get('guid')  # Fallback to guid for backward compatibility
            display_name = chat.get('displayName')
            is_group = chat.get('isGroup', False) or (chat.get('style') == 43 if 'style' in chat else False)
            
            if not chat_id:
                continue
            
            # Get messages for name inference if needed
            # (We'll do this on-demand or cache it)
            from app.services.name_inference import get_name_inference_service
            name_service = get_name_inference_service()
            
            # Extract contact info for fallback display name
            contact_info = name_service.extract_contact_info_from_chat_id(chat_id)
            fallback_name = contact_info['phone_number'] or contact_info['email'] or 'Unknown Contact'
            
            # Use display name if available, otherwise use fallback
            final_display_name = display_name if display_name and not name_service._is_just_contact_info(display_name) else fallback_name
            
            formatted_chats.append({
                'chatId': chat_id,  # Use chatId consistently (SDK format)
                'guid': chat_id,  # Also include as 'guid' for backward compatibility with frontend
                'displayName': final_display_name,
                'participants': chat.get('participants', []),
                'isGroup': is_group,
                'lastMessageDate': chat.get('lastMessageDate') or chat.get('lastMessage', {}).get('date'),
                'originalDisplayName': display_name  # Keep original for reference
            })
        
        return jsonify({
            'success': True,
            'data': {
                'chats': formatted_chats,
                'total': len(formatted_chats)
            }
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting chats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/preferences/chat-tracking', methods=['POST'])
def update_chat_tracking_preferences():
    """
    Update user's chat tracking preferences
    
    Expected JSON body:
    {
        "userId": "user-id",
        "mode": "all" | "recent" | "selected",
        "maxChats": 50,  // For "recent" mode
        "selectedChatIds": ["chatId1", "chatId2"]  // For "selected" mode
    }
    """
    try:
        data = request.get_json()
        user_id = get_user_id(data)
        mode = data.get('mode', 'all')
        max_chats = data.get('maxChats', 50)
        selected_chat_ids = data.get('selectedChatIds', []) or data.get('selectedChatGuids', [])  # Support legacy format
        
        if not user_id:
            return jsonify({'error': 'userId is required'}), 400
        
        if mode not in ['all', 'recent', 'selected']:
            return jsonify({'error': 'Invalid mode. Must be "all", "recent", or "selected"'}), 400
        
        # Validate mode-specific requirements
        if mode == 'recent' and (not isinstance(max_chats, int) or max_chats < 1):
            return jsonify({'error': 'maxChats must be a positive integer for "recent" mode'}), 400
        
        if mode == 'selected' and (not selected_chat_ids or len(selected_chat_ids) == 0):
            return jsonify({'error': 'selectedChatIds is required and cannot be empty for "selected" mode'}), 400
        
        # Get user
        user = storage.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update preferences
        preferences = user.get('preferences', {}) if isinstance(user, dict) else getattr(user, 'preferences', {})
        preferences['chatTracking'] = {
            'mode': mode,
            'maxChats': max_chats if mode == 'recent' else 50,
            'selectedChatIds': selected_chat_ids if mode == 'selected' else []
        }
        
        # Update user
        success = storage.update_user(user_id, {'preferences': preferences})
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Chat tracking preferences updated',
                'data': {
                    'preferences': preferences['chatTracking']
                }
            }), 200
        else:
            return jsonify({'error': 'Failed to update preferences'}), 500
    
    except Exception as e:
        current_app.logger.error(f"Error updating chat tracking preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/listen/stop', methods=['POST'])
def stop_listening():
    """
    Stop listening for real-time messages
    """
    try:
        service = get_imessage_service()
        service.stop_listening()
        
        return jsonify({
            'success': True,
            'message': 'Stopped listening for messages'
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error stopping listener: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@imessage_bp.route('/send', methods=['POST'])
def send_message():
    """
    Send a message via iMessage
    
    Expected JSON body:
    {
        "conversationId": "conversation-id",
        "message": "message text" (legacy, for backward compatibility),
        "content": {
            "text": "message text" (optional),
            "images": ["/path/to/image.jpg"] (optional),
            "files": ["/path/to/file.pdf"] (optional)
        },
        "userId": "user-id" (optional, for verification)
        "promptId": "prompt-id" (optional, if sending an AI-generated prompt)
        "originalPromptText": "original text" (optional, if sending an AI-generated prompt)
        "wasEdited": true/false (optional, whether user edited the prompt)
    }
    """
    try:
        data = request.get_json()
        conversation_id = get_conversation_id(data)
        message = data.get('message')  # Legacy format
        content = data.get('content')  # New format
        user_id = get_user_id(data)
        
        if not conversation_id:
            return jsonify({'error': 'conversationId is required'}), 400
        
        if not message and not content:
            return jsonify({'error': 'Either message or content is required'}), 400
        
        # Extract text for prompt tracking (from message or content.text)
        message_text = message if message else (content.get('text') if content else '')
        
        # Get conversation to find chatId
        conversation = storage.get_conversation(conversation_id, user_id) if user_id else storage.get_conversation(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Extract chatId from conversation (use chatId consistently)
        chat_id = None
        if isinstance(conversation, dict):
            chat_id = safe_get(conversation, 'chatId', 'chatGuid', 'chat_guid')
        else:
            chat_id = getattr(conversation, 'chatId', None) or getattr(conversation, 'chatGuid', None)
        
        if not chat_id:
            # Try to extract from messages if available
            messages = conversation.get('messages', []) if isinstance(conversation, dict) else getattr(conversation, 'messages', [])
            if messages and isinstance(messages[0], dict):
                chat_id = safe_get(messages[0], 'chatId', 'chatGuid', 'chat_guid')
        
        if not chat_id:
            return jsonify({'error': 'Could not find chat ID for this conversation. Please sync conversations first.'}), 400
        
        service = get_imessage_service()
        
        # Run async send - support both legacy string and new content object
        # Use chatId (SDK format) for sending
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            if content:
                result = loop.run_until_complete(service.send_message(chat_id, content=content))
            else:
                result = loop.run_until_complete(service.send_message(chat_id, message=message))
            loop.close()
            
            # Track prompt usage if this was an AI-generated prompt
            prompt_id = data.get('promptId')
            original_prompt_text = data.get('originalPromptText')
            was_edited = data.get('wasEdited', False)
            
            if prompt_id and original_prompt_text and message_text:
                # Calculate edit similarity (simple character-based)
                if was_edited:
                    # Simple similarity: ratio of common characters
                    original_lower = original_prompt_text.lower().strip()
                    sent_lower = message_text.lower().strip()
                    common_chars = sum(1 for c in original_lower if c in sent_lower)
                    similarity = common_chars / max(len(original_lower), len(sent_lower), 1)
                else:
                    similarity = 1.0
                
                # Track usage
                if user_id:
                    storage.track_prompt_usage(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        prompt_id=prompt_id,
                        original_prompt_text=original_prompt_text,
                        sent_message_text=message_text,
                        was_edited=was_edited,
                        edit_similarity=similarity
                    )
            
            return jsonify({
                'success': True,
                'message': 'Message sent successfully',
                'data': result
            }), 200
        except Exception as send_error:
            loop.close()
            raise send_error
    
    except Exception as e:
        current_app.logger.error(f"Error sending iMessage: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

