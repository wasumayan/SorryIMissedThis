"""
Azure Cosmos DB Storage Service
Handles all database interactions using Azure Cosmos DB
"""

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from typing import List, Dict, Optional
from datetime import datetime
import os
import uuid


class AzureStorageService:
    """Service for Azure Cosmos DB operations"""

    _instance = None
    _initialized = False

    def __new__(cls):
        """Singleton pattern to ensure single Cosmos DB connection"""
        if cls._instance is None:
            cls._instance = super(AzureStorageService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize Cosmos DB connection"""
        # Default to non-mock; _initialize_cosmos_db will flip this to True if
        # credentials are missing or initialization fails.
        self.mock_mode = False

        if not self._initialized:
            self._initialize_cosmos_db()
            AzureStorageService._initialized = True

    def _initialize_cosmos_db(self):
        """Initialize Azure Cosmos DB client"""
        try:
            # Get configuration from environment
            cosmos_endpoint = os.getenv('COSMOS_ENDPOINT')
            cosmos_key = os.getenv('COSMOS_KEY')
            database_name = os.getenv('COSMOS_DATABASE', 'sorryimissedthis')
            # store chosen database name for later use (study methods expect this)
            self.database_name = database_name

            if not cosmos_endpoint or not cosmos_key:
                print("WARNING: Cosmos DB credentials not configured")
                print("Set COSMOS_ENDPOINT and COSMOS_KEY in .env file")
                print("Running in mock mode - data will not be persisted")
                self.client = None
                self.database = None
                # Mark mock mode explicitly so callers can use in-memory fallbacks
                self.mock_mode = True
                # ensure database_client attribute exists for code paths that use it
                self.database_client = None
                return

            # Initialize Cosmos DB client
            self.client = CosmosClient(cosmos_endpoint, cosmos_key)

            # Create database if it doesn't exist
            self.database = self.client.create_database_if_not_exists(id=database_name)

            # Create containers (collections)
            self._initialize_containers()

            # Provide database_client alias used elsewhere in the code
            # (CosmosClient provides get_database_client)
            self.database_client = self.client

            # Successfully initialized, ensure mock_mode is False
            self.mock_mode = False

            print("Azure Cosmos DB connection established successfully")
            print(f"Database: {database_name}")

        except Exception as e:
            print(f"Error initializing Cosmos DB: {str(e)}")
            print("Running in mock mode - data will not be persisted")
            self.client = None
            self.database = None
            # mark mock mode so higher-level code uses in-memory fallbacks
            self.mock_mode = True
            self.database_client = None

    def _initialize_containers(self):
        """Create containers if they don't exist"""
        try:
            # Users container (serverless mode - no throughput parameter)
            self.users_container = self.database.create_container_if_not_exists(
                id='users',
                partition_key=PartitionKey(path='/id')
            )

            # Sessions container
            self.sessions_container = self.database.create_container_if_not_exists(
                id='sessions',
                partition_key=PartitionKey(path='/userId')
            )

            # Conversations container
            self.conversations_container = self.database.create_container_if_not_exists(
                id='conversations',
                partition_key=PartitionKey(path='/userId')
            )

            # Prompts container
            self.prompts_container = self.database.create_container_if_not_exists(
                id='prompts',
                partition_key=PartitionKey(path='/conversationId')
            )

            # Analytics container for tracking prompt usage
            self.analytics_container = self.database.create_container_if_not_exists(
                id='analytics',
                partition_key=PartitionKey(path='/userId')
            )

            # Scheduled prompts container
            self.scheduled_prompts_container = self.database.create_container_if_not_exists(
                id='scheduled_prompts',
                partition_key=PartitionKey(path='/userId')
            )

            # Study related containers (participants, survey responses, metrics)
            # These are required by the study endpoints; create them if missing.
            try:
                self.study_participants_container = self.database.create_container_if_not_exists(
                    id='study_participants',
                    partition_key=PartitionKey(path='/userId')
                )

                self.survey_responses_container = self.database.create_container_if_not_exists(
                    id='survey_responses',
                    partition_key=PartitionKey(path='/userId')
                )

                self.study_metrics_container = self.database.create_container_if_not_exists(
                    id='study_metrics',
                    partition_key=PartitionKey(path='/userId')
                )
            except Exception as e:
                print(f"Warning: could not create study containers: {str(e)}")

            print("Cosmos DB containers initialized")

        except Exception as e:
            print(f"Error creating containers: {str(e)}")

    # ============= User Operations =============

    def create_user(self, user_data: dict) -> bool:
        """Create a new user"""
        if not self.database:
            return False

        try:
            user_data['type'] = 'user'
            user_data['createdAt'] = datetime.utcnow().isoformat()
            self.users_container.create_item(body=user_data)
            print(f"Created user: {user_data['id']}")
            return True
        except Exception as e:
            print(f"Error creating user: {str(e)}")
            return False

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID"""
        if not self.database:
            return None

        try:
            user = self.users_container.read_item(
                item=user_id,
                partition_key=user_id
            )
            return user
        except exceptions.CosmosResourceNotFoundError:
            return None
        except Exception as e:
            print(f"Error getting user: {str(e)}")
            return None

    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email"""
        if not self.database:
            return None

        try:
            query = f"SELECT * FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": email}]

            users = list(self.users_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            return users[0] if users else None
        except Exception as e:
            print(f"Error getting user by email: {str(e)}")
            return None

    def update_user(self, user_id: str, updates: dict) -> bool:
        """Update user data"""
        if not self.database:
            return False

        try:
            user = self.get_user_by_id(user_id)
            if not user:
                return False

            user.update(updates)
            user['updatedAt'] = datetime.utcnow().isoformat()

            self.users_container.replace_item(
                item=user_id,
                body=user
            )
            return True
        except Exception as e:
            print(f"Error updating user: {str(e)}")
            return False

    # ============= Session Operations =============

    def create_session(self, session_data: dict) -> bool:
        """Create a new session"""
        if not self.database:
            return False

        try:
            session_data['type'] = 'session'
            session_data['createdAt'] = datetime.utcnow().isoformat()
            self.sessions_container.create_item(body=session_data)
            print(f"Created session for user: {session_data['userId']}")
            return True
        except Exception as e:
            print(f"Error creating session: {str(e)}")
            return False

    def get_session(self, token: str, user_id: str) -> Optional[dict]:
        """Get session by token"""
        if not self.database:
            return None

        try:
            query = f"SELECT * FROM c WHERE c.token = @token"
            parameters = [{"name": "@token", "value": token}]

            sessions = list(self.sessions_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ))

            return sessions[0] if sessions else None
        except Exception as e:
            print(f"Error getting session: {str(e)}")
            return None

    def delete_session(self, token: str, user_id: str) -> bool:
        """Delete a session"""
        if not self.database:
            return False

        try:
            session = self.get_session(token, user_id)
            if not session:
                return False

            self.sessions_container.delete_item(
                item=session['id'],
                partition_key=user_id
            )
            return True
        except Exception as e:
            print(f"Error deleting session: {str(e)}")
            return False

    # ============= Conversation Operations =============

    def create_conversation(self, conversation_data: dict) -> Optional[str]:
        """Create a new conversation"""
        if not self.database:
            return "mock_conversation_id"

        try:
            # Ensure required fields are present
            if 'userId' not in conversation_data and 'user_id' not in conversation_data:
                print(f"ERROR: create_conversation: Missing userId/user_id in conversation_data. Keys: {list(conversation_data.keys())}")
                return None
            
            user_id = conversation_data.get('userId') or conversation_data.get('user_id')
            if not user_id:
                print(f"ERROR: create_conversation: userId/user_id is None or empty")
                return None
            
            conversation_data['type'] = 'conversation'
            conversation_data['userId'] = user_id  # Ensure userId is set (Cosmos DB partition key)
            conversation_data['createdAt'] = datetime.utcnow().isoformat()
            conversation_data['updatedAt'] = datetime.utcnow().isoformat()

            # Ensure id exists (Cosmos DB requirement)
            if 'id' not in conversation_data:
                import uuid
                conversation_data['id'] = str(uuid.uuid4())
            
            # Serialize datetime objects to ISO format strings (Cosmos DB requires JSON-serializable data)
            # This must happen BEFORE we add createdAt/updatedAt to ensure all nested datetimes are converted
            def serialize_datetimes(obj):
                """Recursively convert datetime objects to ISO format strings"""
                # Check for datetime.datetime (the actual class)
                if isinstance(obj, datetime):
                    return obj.isoformat()
                elif isinstance(obj, dict):
                    return {k: serialize_datetimes(v) for k, v in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [serialize_datetimes(item) for item in obj]
                elif hasattr(obj, '__dict__'):
                    # Handle objects with __dict__ (like dataclass instances that weren't converted)
                    return serialize_datetimes(obj.__dict__)
                return obj
            
            # Serialize all datetime objects in the conversation data
            # This will recursively process the entire dict, including nested metrics dict
            conversation_data = serialize_datetimes(conversation_data)
            
            # Check if conversation already exists (by chatId)
            chat_id = conversation_data.get('chatId')
            if chat_id:
                existing = self.find_conversation_by_chat_id(chat_id, user_id)
                if existing:
                    # Update existing conversation instead of creating a new one
                    conversation_data['id'] = existing['id']
                    conversation_data['createdAt'] = existing.get('createdAt', datetime.utcnow().isoformat())
                    conversation_data['updatedAt'] = datetime.utcnow().isoformat()
                    
                    # Use replace_item instead of create_item
                    result = self.conversations_container.replace_item(
                        item=existing['id'],
                        body=conversation_data
                    )
                    return result['id']
            
            # Now set createdAt/updatedAt (already strings, so no need to serialize)
            conversation_data['createdAt'] = datetime.utcnow().isoformat()
            conversation_data['updatedAt'] = datetime.utcnow().isoformat()

            # Create item - partition key is automatically extracted from body['userId'] 
            # based on container's partition key path (/userId)
            result = self.conversations_container.create_item(
                body=conversation_data
            )
            return result['id']
        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"ERROR creating conversation: {type(e).__name__}: {str(e)}")
            logger.error(f"ERROR traceback: {traceback.format_exc()}")
            logger.error(f"ERROR conversation_data keys: {list(conversation_data.keys()) if conversation_data else 'None'}")
            logger.error(f"ERROR conversation_data userId: {conversation_data.get('userId') if conversation_data else 'None'}")
            # Also print for immediate visibility
            print(f"ERROR creating conversation: {type(e).__name__}: {str(e)}")
            print(f"ERROR conversation_data keys: {list(conversation_data.keys()) if conversation_data else 'None'}")
            return None

    def get_conversation(self, conversation_id: str, user_id: str) -> Optional[dict]:
        """Get conversation by ID"""
        if not self.database:
            return None

        try:
            conversation = self.conversations_container.read_item(
                item=conversation_id,
                partition_key=user_id
            )
            return conversation
        except exceptions.CosmosResourceNotFoundError:
            return None
        except Exception as e:
            print(f"Error getting conversation: {str(e)}")
            return None

    def get_user_conversations(self, user_id: str, limit: int = 100) -> List[dict]:
        """Get all conversations for a user"""
        if not self.database:
            return []

        try:
            query = f"SELECT TOP @limit * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC"
            parameters = [
                {"name": "@userId", "value": user_id},
                {"name": "@limit", "value": limit}
            ]

            conversations = list(self.conversations_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ))

            return conversations
        except Exception as e:
            print(f"Error getting conversations: {str(e)}")
            return []

    def find_conversation_by_chat_id(self, chat_id: str, user_id: str) -> Optional[dict]:
        """Find conversation by chatId (SDK format)"""
        if not self.database:
            return None

        try:
            # Support legacy chatGuid/chat_guid fields for backward compatibility with existing data
            query = "SELECT * FROM c WHERE c.userId = @userId AND (c.chatId = @chatId OR c.chatGuid = @chatId OR c.chat_guid = @chatId)"
            parameters = [
                {"name": "@userId", "value": user_id},
                {"name": "@chatId", "value": chat_id}
            ]

            conversations = list(self.conversations_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ))

            return conversations[0] if conversations else None
        except Exception as e:
            print(f"Error finding conversation by chatId: {str(e)}")
            return None

    def add_message_to_conversation(self, conversation_id: str, user_id: str, message_data: dict) -> bool:
        """
        Update conversation metadata when a new message arrives.
        NOTE: Actual message content is stored locally on device for privacy.
        Only metadata (count, timestamps, metrics) are stored in cloud.
        """
        if not self.database:
            return False

        try:
            conversation = self.get_conversation(conversation_id, user_id)
            if not conversation:
                return False

            # Update message count (messages stored locally, not in cloud)
            message_count = conversation.get('messageCount', 0) + 1
            conversation['messageCount'] = message_count
            conversation['updatedAt'] = datetime.utcnow().isoformat()

            # Update last message time
            if message_data.get('timestamp'):
                conversation['metrics'] = conversation.get('metrics', {})
                conversation['metrics']['last_message_time'] = message_data['timestamp']

            # Note: We don't store actual message content in cloud for privacy
            # Messages are stored locally on the device
            # We only update metadata here

            # Save updated conversation (metadata only)
            self.conversations_container.replace_item(
                item=conversation_id,
                body=conversation
            )
            return True
        except Exception as e:
            print(f"Error updating conversation metadata: {str(e)}")
            return False

    def update_conversation(self, conversation_id: str, user_id: str, updates: dict) -> bool:
        """Update conversation data"""
        if not self.database:
            return False

        try:
            conversation = self.get_conversation(conversation_id, user_id)
            if not conversation:
                return False

            conversation.update(updates)
            conversation['updatedAt'] = datetime.utcnow().isoformat()

            self.conversations_container.replace_item(
                item=conversation_id,
                body=conversation
            )
            return True
        except Exception as e:
            print(f"Error updating conversation: {str(e)}")
            return False

    # ============= Analytics Operations =============

    def get_user_stats(self, user_id: str) -> Dict:
        """Get aggregate statistics for a user"""
        conversations = self.get_user_conversations(user_id)

        if not conversations:
            return {
                'total_conversations': 0,
                'total_messages': 0,
                'active_conversations': 0,
                'dormant_conversations': 0
            }

        total_messages = sum(c.get('messageCount', 0) for c in conversations)
        active = sum(1 for c in conversations if c.get('status') == 'active')
        dormant = sum(1 for c in conversations if c.get('status') == 'dormant')

        return {
            'total_conversations': len(conversations),
            'total_messages': total_messages,
            'active_conversations': active,
            'dormant_conversations': dormant
        }

    def track_prompt_usage(
        self,
        user_id: str,
        conversation_id: str,
        prompt_id: Optional[str],
        original_prompt_text: str,
        sent_message_text: str,
        was_edited: bool,
        edit_similarity: Optional[float] = None
    ) -> bool:
        """
        Track when a user sends a prompt (original or edited)
        
        Args:
            user_id: User who sent the prompt
            conversation_id: Conversation the prompt was sent in
            prompt_id: ID of the original prompt (if from AI)
            original_prompt_text: Original prompt text
            sent_message_text: Actual message text sent
            was_edited: Whether user edited the prompt
            edit_similarity: Similarity score between original and sent (0-1)
        """
        if not self.database:
            return False

        try:
            # For privacy, only store first 100 chars of sent message for analytics
            # Full message content remains in local storage only
            sent_message_preview = sent_message_text[:100] if sent_message_text else ''
            
            usage_data = {
                'id': str(uuid.uuid4()),
                'userId': user_id,
                'conversationId': conversation_id,
                'promptId': prompt_id,
                'originalPromptText': original_prompt_text,
                'sentMessageText': sent_message_preview,  # Truncated for privacy
                'sentMessageLength': len(sent_message_text) if sent_message_text else 0,
                'wasEdited': was_edited,
                'editSimilarity': edit_similarity,
                'timestamp': datetime.utcnow().isoformat(),
                'type': 'prompt_usage'
            }

            self.analytics_container.create_item(body=usage_data)
            return True
        except Exception as e:
            print(f"Error tracking prompt usage: {str(e)}")
            return False

    def get_prompt_usage_stats(self, user_id: Optional[str] = None) -> Dict:
        """
        Get aggregate prompt usage statistics
        
        Args:
            user_id: Optional user ID to filter by (if None, returns global stats)
        """
        if not self.database:
            return {
                'total_sent': 0,
                'total_edited': 0,
                'total_original': 0,
                'edit_rate': 0.0
            }

        try:
            if user_id:
                query = "SELECT * FROM c WHERE c.userId = @userId AND c.type = 'prompt_usage'"
                parameters = [{"name": "@userId", "value": user_id}]
                partition_key = user_id
            else:
                query = "SELECT * FROM c WHERE c.type = 'prompt_usage'"
                parameters = []
                partition_key = None

            usages = list(self.analytics_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=partition_key,
                enable_cross_partition_query=user_id is None
            ))

            total_sent = len(usages)
            total_edited = sum(1 for u in usages if u.get('wasEdited', False))
            total_original = total_sent - total_edited
            edit_rate = (total_edited / total_sent) if total_sent > 0 else 0.0

            return {
                'total_sent': total_sent,
                'total_edited': total_edited,
                'total_original': total_original,
                'edit_rate': round(edit_rate, 3)
            }
        except Exception as e:
            print(f"Error getting prompt usage stats: {str(e)}")
            return {
                'total_sent': 0,
                'total_edited': 0,
                'total_original': 0,
                'edit_rate': 0.0
            }

    # ============= Prompt Operations =============

    def save_prompt(self, prompt) -> Optional[str]:
        """
        Save a ConversationPrompt to the database
        
        Args:
            prompt: ConversationPrompt object or dict
            
        Returns:
            prompt_id if successful, None otherwise
        """
        if not self.database:
            return None

        try:
            # Convert prompt to dict if it's an object
            if hasattr(prompt, 'to_dict'):
                prompt_data = prompt.to_dict()
            elif isinstance(prompt, dict):
                prompt_data = prompt.copy()
            else:
                return None

            # Ensure required fields
            if 'conversationId' not in prompt_data and 'conversation_id' in prompt_data:
                prompt_data['conversationId'] = prompt_data['conversation_id']
            
            # Generate prompt_id if not present
            if 'prompt_id' not in prompt_data or not prompt_data.get('prompt_id'):
                prompt_data['prompt_id'] = str(uuid.uuid4())
            
            # Set required fields for Cosmos DB
            prompt_data['id'] = prompt_data['prompt_id']
            prompt_data['type'] = 'prompt'
            prompt_data['createdAt'] = prompt_data.get('created_at', datetime.utcnow().isoformat())
            if isinstance(prompt_data['createdAt'], datetime):
                prompt_data['createdAt'] = prompt_data['createdAt'].isoformat()
            prompt_data['updatedAt'] = datetime.utcnow().isoformat()

            # Map field names
            if 'prompt_text' in prompt_data:
                prompt_data['promptText'] = prompt_data.pop('prompt_text')
            if 'prompt_type' in prompt_data:
                prompt_data['promptType'] = prompt_data.pop('prompt_type')
            if 'confidence_score' in prompt_data:
                prompt_data['confidenceScore'] = prompt_data.pop('confidence_score')
            if 'created_at' in prompt_data:
                del prompt_data['created_at']

            # Use conversationId as partition key
            partition_key = prompt_data.get('conversationId', prompt_data.get('conversation_id', 'default'))
            
            result = self.prompts_container.create_item(body=prompt_data)
            return result.get('prompt_id') or result.get('id')
        except Exception as e:
            print(f"Error saving prompt: {str(e)}")
            return None

    def get_conversation_prompts(self, conversation_id: str, unused_only: bool = True) -> List:
        """
        Get prompts for a conversation
        
        Args:
            conversation_id: Conversation ID
            unused_only: Only return unused prompts
            
        Returns:
            List of ConversationPrompt objects
        """
        if not self.database:
            return []

        try:
            query = "SELECT * FROM c WHERE c.conversationId = @conversationId"
            if unused_only:
                query += " AND (c.used = false OR NOT IS_DEFINED(c.used))"
            query += " ORDER BY c.createdAt DESC"
            
            parameters = [{"name": "@conversationId", "value": conversation_id}]

            prompts = list(self.prompts_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=conversation_id
            ))

            # Convert to ConversationPrompt objects
            from app.models import ConversationPrompt
            result = []
            for p in prompts:
                # Map field names back
                prompt_dict = {
                    'conversation_id': p.get('conversationId', conversation_id),
                    'prompt_text': p.get('promptText', p.get('prompt_text', '')),
                    'prompt_type': p.get('promptType', p.get('prompt_type', 'follow_up')),
                    'context': p.get('context', ''),
                    'tone': p.get('tone', 'friendly'),
                    'confidence_score': p.get('confidenceScore', p.get('confidence_score', 0.8)),
                    'used': p.get('used', False),
                    'prompt_id': p.get('id') or p.get('prompt_id'),
                    'created_at': p.get('createdAt', p.get('created_at', datetime.utcnow().isoformat()))
                }
                try:
                    if isinstance(prompt_dict['created_at'], str):
                        prompt_dict['created_at'] = datetime.fromisoformat(prompt_dict['created_at'].replace('Z', '+00:00'))
                    result.append(ConversationPrompt.from_dict(prompt_dict))
                except Exception as e:
                    print(f"Error converting prompt: {str(e)}")
                    continue

            return result
        except Exception as e:
            print(f"Error getting conversation prompts: {str(e)}")
            return []

    def mark_prompt_used(self, prompt_id: str) -> bool:
        """
        Mark a prompt as used
        
        Args:
            prompt_id: Prompt ID to mark as used
            
        Returns:
            True if successful, False otherwise
        """
        if not self.database:
            return False

        try:
            # Find prompt by ID (need to search across partitions)
            # First try to find in prompts container
            query = "SELECT * FROM c WHERE c.id = @promptId OR c.prompt_id = @promptId"
            parameters = [{"name": "@promptId", "value": prompt_id}]

            prompts = list(self.prompts_container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))

            if not prompts:
                return False

            prompt = prompts[0]
            prompt['used'] = True
            prompt['updatedAt'] = datetime.utcnow().isoformat()

            partition_key = prompt.get('conversationId', prompt.get('conversation_id', 'default'))
            self.prompts_container.replace_item(
                item=prompt['id'],
                body=prompt,
                partition_key=partition_key
            )
            return True
        except Exception as e:
            print(f"Error marking prompt as used: {str(e)}")
            return False

    # ============= Scheduled Prompts Operations =============

    def create_scheduled_prompt(self, prompt_data: dict) -> Optional[str]:
        """Create a new scheduled prompt"""
        if not self.database:
            return "mock_scheduled_prompt_id"

        try:
            prompt_data['type'] = 'scheduled_prompt'
            prompt_data['createdAt'] = datetime.utcnow().isoformat()
            prompt_data['updatedAt'] = datetime.utcnow().isoformat()
            
            # Ensure id exists
            if 'id' not in prompt_data:
                prompt_data['id'] = str(uuid.uuid4())

            result = self.scheduled_prompts_container.create_item(body=prompt_data)
            return result['id']
        except Exception as e:
            print(f"Error creating scheduled prompt: {str(e)}")
            return None

    def get_scheduled_prompts(self, user_id: str, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[dict]:
        """Get scheduled prompts for a user"""
        if not self.database:
            return []

        try:
            query = "SELECT * FROM c WHERE c.userId = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            
            if status:
                query += " AND c.status = @status"
                parameters.append({"name": "@status", "value": status})
            
            query += " ORDER BY c.scheduledTime ASC"
            
            prompts = list(self.scheduled_prompts_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            ))
            
            # Apply pagination
            total = len(prompts)
            prompts = prompts[offset:offset + limit]
            
            # OPTIMIZATION: Batch contact lookups to avoid N+1 query problem
            # Collect all unique contact IDs first
            contact_ids = set()
            for prompt in prompts:
                contact_id = prompt.get('contactId') or (prompt.get('contact', {}) or {}).get('id')
                if contact_id:
                    contact_ids.add(contact_id)
            
            # Fetch all contacts in one batch (if Cosmos DB supports batch read)
            # For now, we'll still do individual reads but at least we're aware of the optimization
            # In production, consider using Cosmos DB batch operations or caching
            contacts_cache = {}
            for contact_id in contact_ids:
                try:
                    contact = self.get_conversation(contact_id, user_id)
                    if contact:
                        contacts_cache[contact_id] = {
                            'id': contact.get('id'),
                            'name': contact.get('partnerName') or contact.get('partner_name') or 'Unknown',
                            'status': contact.get('status', 'healthy')
                        }
                except Exception as e:
                    print(f"Error fetching contact {contact_id}: {str(e)}")
            
            # Enrich prompts with cached contact information
            for prompt in prompts:
                contact_id = prompt.get('contactId') or (prompt.get('contact', {}) or {}).get('id')
                if contact_id and contact_id in contacts_cache:
                    prompt['contact'] = contacts_cache[contact_id]
            
            return prompts
        except Exception as e:
            print(f"Error getting scheduled prompts: {str(e)}")
            return []

    def update_scheduled_prompt(self, prompt_id: str, user_id: str, updates: dict) -> bool:
        """Update a scheduled prompt"""
        if not self.database:
            return False

        try:
            prompt = self.scheduled_prompts_container.read_item(
                item=prompt_id,
                partition_key=user_id
            )
            
            # Apply updates
            prompt.update(updates)
            prompt['updatedAt'] = datetime.utcnow().isoformat()
            
            self.scheduled_prompts_container.replace_item(
                item=prompt_id,
                body=prompt,
                partition_key=user_id
            )
            return True
        except exceptions.CosmosResourceNotFoundError:
            return False
        except Exception as e:
            print(f"Error updating scheduled prompt: {str(e)}")
            return False

    def delete_scheduled_prompt(self, prompt_id: str, user_id: str) -> bool:
        """Delete a scheduled prompt"""
        if not self.database:
            return False

        try:
            self.scheduled_prompts_container.delete_item(
                item=prompt_id,
                partition_key=user_id
            )
            return True
        except exceptions.CosmosResourceNotFoundError:
            return False
        except Exception as e:
            print(f"Error deleting scheduled prompt: {str(e)}")
            return False

    # ===== Study Management Methods =====

    def get_study_participant_count(self):
        """Get total number of study participants (for counterbalancing)"""
        if self.mock_mode:
            return len(getattr(self, '_study_participants', {}))

        try:
            query = "SELECT VALUE COUNT(1) FROM c"
            result = list(self.database_client.get_database_client(self.database_name)
                         .get_container_client('study_participants')
                         .query_items(query=query, enable_cross_partition_query=True))
            return result[0] if result else 0
        except:
            return 0

    def save_study_participant(self, participant):
        """Save or update study participant"""
        if self.mock_mode:
            if not hasattr(self, '_study_participants'):
                self._study_participants = {}
            self._study_participants[participant.user_id] = participant.to_dict()
            return True

        try:
            container = self.database_client.get_database_client(self.database_name).get_container_client('study_participants')
            participant_dict = participant.to_dict()
            participant_dict['id'] = participant.user_id
            container.upsert_item(participant_dict)
            return True
        except Exception as e:
            print(f"Error saving study participant: {str(e)}")
            return False

    def get_study_participant(self, user_id):
        """Get study participant by user ID"""
        if self.mock_mode:
            if not hasattr(self, '_study_participants'):
                self._study_participants = {}
            return self._study_participants.get(user_id)

        try:
            container = self.database_client.get_database_client(self.database_name).get_container_client('study_participants')
            item = container.read_item(item=user_id, partition_key=user_id)
            return item
        except:
            return None

    def save_survey_response(self, survey):
        """Save post-condition survey response"""
        if self.mock_mode:
            if not hasattr(self, '_survey_responses'):
                self._survey_responses = {}
            key = f"{survey.user_id}_{survey.condition}"
            self._survey_responses[key] = survey.to_dict()
            return True

        try:
            container = self.database_client.get_database_client(self.database_name).get_container_client('survey_responses')
            survey_dict = survey.to_dict()
            survey_dict['id'] = f"{survey.user_id}_{survey.condition}"
            survey_dict['userId'] = survey.user_id  # Add partition key
            container.upsert_item(survey_dict)
            return True
        except Exception as e:
            print(f"Error saving survey response: {str(e)}")
            return False

    def get_survey_response(self, user_id, condition):
        """Get survey response for a user and condition"""
        if self.mock_mode:
            if not hasattr(self, '_survey_responses'):
                self._survey_responses = {}
            key = f"{user_id}_{condition}"
            return self._survey_responses.get(key)

        try:
            container = self.database_client.get_database_client(self.database_name).get_container_client('survey_responses')
            item_id = f"{user_id}_{condition}"
            item = container.read_item(item=item_id, partition_key=user_id)
            return item
        except:
            return None

    def log_study_metric(self, metric_event):
        """Log a study metric event"""
        if self.mock_mode:
            if not hasattr(self, '_study_metrics'):
                self._study_metrics = []
            self._study_metrics.append(metric_event)
            return True

        try:
            from datetime import datetime
            container = self.database_client.get_database_client(self.database_name).get_container_client('study_metrics')
            metric_event['id'] = f"{metric_event['userId']}_{metric_event['timestamp']}_{metric_event['action']}"
            container.create_item(metric_event)
            return True
        except Exception as e:
            print(f"Error logging study metric: {str(e)}")
            return False

    def get_all_study_metrics(self, user_id=None):
        """Get all study metrics, optionally filtered by user"""
        if self.mock_mode:
            if not hasattr(self, '_study_metrics'):
                self._study_metrics = []
            if user_id:
                return [m for m in self._study_metrics if m.get('userId') == user_id]
            return self._study_metrics

        try:
            container = self.database_client.get_database_client(self.database_name).get_container_client('study_metrics')
            if user_id:
                query = "SELECT * FROM c WHERE c.userId = @userId"
                parameters = [{"name": "@userId", "value": user_id}]
                return list(container.query_items(query=query, parameters=parameters, partition_key=user_id))
            else:
                query = "SELECT * FROM c"
                return list(container.query_items(query=query, enable_cross_partition_query=True))
        except Exception as e:
            print(f"Error getting study metrics: {str(e)}")
            return []


# Create a singleton instance
_storage_service = AzureStorageService()

# Export the storage service instance
storage = _storage_service
