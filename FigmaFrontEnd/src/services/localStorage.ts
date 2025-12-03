/**
 * Local Storage Service for Messages
 * 
 * Stores actual message content locally for privacy.
 * Only metadata and analysis are stored in cloud.
 */

interface StoredMessage {
  message_id: string;
  conversation_id: string;
  timestamp: string;
  sender: string;
  content: string;
  chatGuid?: string;
}

interface ConversationMessages {
  conversation_id: string;
  chatGuid?: string;
  messages: StoredMessage[];
  last_updated: string;
}

class LocalMessageStorage {
  private readonly STORAGE_KEY_PREFIX = 'simt_messages_';
  private readonly INDEX_KEY = 'simt_message_index';

  /**
   * Get storage key for a conversation
   */
  private getConversationKey(conversationId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${conversationId}`;
  }

  /**
   * Get all conversation IDs that have stored messages
   */
  getConversationIds(): string[] {
    try {
      const index = localStorage.getItem(this.INDEX_KEY);
      if (!index) return [];
      return JSON.parse(index);
    } catch (error) {
      console.error('Error reading conversation index:', error);
      return [];
    }
  }

  /**
   * Store messages for a conversation
   */
  storeMessages(conversationId: string, messages: StoredMessage[], chatGuid?: string): void {
    try {
      const conversationData: ConversationMessages = {
        conversation_id: conversationId,
        chatGuid,
        messages,
        last_updated: new Date().toISOString()
      };

      const key = this.getConversationKey(conversationId);
      localStorage.setItem(key, JSON.stringify(conversationData));

      // Update index
      const index = this.getConversationIds();
      if (!index.includes(conversationId)) {
        index.push(conversationId);
        localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      }
    } catch (error) {
      console.error('Error storing messages locally:', error);
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded. Consider clearing old data.');
      }
    }
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string): StoredMessage[] {
    try {
      const key = this.getConversationKey(conversationId);
      const data = localStorage.getItem(key);
      if (!data) return [];

      const conversationData: ConversationMessages = JSON.parse(data);
      return conversationData.messages || [];
    } catch (error) {
      console.error('Error reading messages from local storage:', error);
      return [];
    }
  }

  /**
   * Add a single message to a conversation
   */
  addMessage(conversationId: string, message: StoredMessage): void {
    const messages = this.getMessages(conversationId);
    
    // Check if message already exists
    const exists = messages.some(m => m.message_id === message.message_id);
    if (exists) {
      // Update existing message
      const index = messages.findIndex(m => m.message_id === message.message_id);
      messages[index] = message;
    } else {
      // Add new message (sorted by timestamp)
      messages.push(message);
      messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    // Get chatGuid if available
    const key = this.getConversationKey(conversationId);
    const existingData = localStorage.getItem(key);
    let chatGuid: string | undefined;
    if (existingData) {
      try {
        const data: ConversationMessages = JSON.parse(existingData);
        chatGuid = data.chatGuid;
      } catch (e) {
        // Ignore
      }
    }

    this.storeMessages(conversationId, messages, chatGuid);
  }

  /**
   * Get chatGuid for a conversation
   */
  getChatGuid(conversationId: string): string | undefined {
    try {
      const key = this.getConversationKey(conversationId);
      const data = localStorage.getItem(key);
      if (!data) return undefined;

      const conversationData: ConversationMessages = JSON.parse(data);
      return conversationData.chatGuid;
    } catch (error) {
      console.error('Error reading chatGuid:', error);
      return undefined;
    }
  }

  /**
   * Set chatGuid for a conversation
   */
  setChatGuid(conversationId: string, chatGuid: string): void {
    const messages = this.getMessages(conversationId);
    this.storeMessages(conversationId, messages, chatGuid);
  }

  /**
   * Delete messages for a conversation
   */
  deleteConversation(conversationId: string): void {
    try {
      const key = this.getConversationKey(conversationId);
      localStorage.removeItem(key);

      // Update index
      const index = this.getConversationIds();
      const newIndex = index.filter(id => id !== conversationId);
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(newIndex));
    } catch (error) {
      console.error('Error deleting conversation from local storage:', error);
    }
  }

  /**
   * Clear all stored messages
   */
  clearAll(): void {
    try {
      const conversationIds = this.getConversationIds();
      conversationIds.forEach(id => {
        const key = this.getConversationKey(id);
        localStorage.removeItem(key);
      });
      localStorage.removeItem(this.INDEX_KEY);
    } catch (error) {
      console.error('Error clearing all messages:', error);
    }
  }

  /**
   * Get storage size estimate (in MB)
   */
  getStorageSize(): number {
    try {
      let total = 0;
      const conversationIds = this.getConversationIds();
      conversationIds.forEach(id => {
        const key = this.getConversationKey(id);
        const data = localStorage.getItem(key);
        if (data) {
          total += new Blob([data]).size;
        }
      });
      return total / (1024 * 1024); // Convert to MB
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  }

  /**
   * Find conversation by chatGuid
   */
  findConversationByChatGuid(chatGuid: string): string | undefined {
    const conversationIds = this.getConversationIds();
    for (const id of conversationIds) {
      const storedChatGuid = this.getChatGuid(id);
      if (storedChatGuid === chatGuid) {
        return id;
      }
    }
    return undefined;
  }
}

// Export singleton instance
export const localMessageStorage = new LocalMessageStorage();

