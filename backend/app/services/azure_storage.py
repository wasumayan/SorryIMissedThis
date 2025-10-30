"""
Azure Cosmos DB Storage Service
Handles all database interactions using Azure Cosmos DB
"""

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from typing import List, Dict, Optional
from datetime import datetime
import os


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

            if not cosmos_endpoint or not cosmos_key:
                print("WARNING: Cosmos DB credentials not configured")
                print("Set COSMOS_ENDPOINT and COSMOS_KEY in .env file")
                print("Running in mock mode - data will not be persisted")
                self.client = None
                self.database = None
                return

            # Initialize Cosmos DB client
            self.client = CosmosClient(cosmos_endpoint, cosmos_key)

            # Create database if it doesn't exist
            self.database = self.client.create_database_if_not_exists(id=database_name)

            # Create containers (collections)
            self._initialize_containers()

            print("Azure Cosmos DB connection established successfully")
            print(f"Database: {database_name}")

        except Exception as e:
            print(f"Error initializing Cosmos DB: {str(e)}")
            print("Running in mock mode - data will not be persisted")
            self.client = None
            self.database = None

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
            conversation_data['type'] = 'conversation'
            conversation_data['createdAt'] = datetime.utcnow().isoformat()
            conversation_data['updatedAt'] = datetime.utcnow().isoformat()

            result = self.conversations_container.create_item(body=conversation_data)
            return result['id']
        except Exception as e:
            print(f"Error creating conversation: {str(e)}")
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


# Create a singleton instance
_storage_service = AzureStorageService()

# Export the storage service instance
storage = _storage_service
