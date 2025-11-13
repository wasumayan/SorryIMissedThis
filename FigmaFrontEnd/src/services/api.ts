// API service for connecting to the SIMT backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('simt_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('simt_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('simt_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    console.log(`[DEBUG] [${requestId}] API ${method} ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log(`[DEBUG] [${requestId}] Token present (length: ${this.token.length})`);
    } else {
      console.warn(`[WARN] [${requestId}] No token present`);
    }

    try {
      console.log(`[DEBUG] [${requestId}] Sending ${method} request...`);
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] [${requestId}] Response received: status=${response.status} (took ${elapsed}ms)`);
      const data = await response.json();
      console.log(`[DEBUG] [${requestId}] Response data:`, { 
        success: data.success, 
        hasData: !!data.data, 
        error: data.error,
        dataType: data.data ? (Array.isArray(data.data) ? `array[${data.data.length}]` : typeof data.data) : 'null'
      });

      if (!response.ok) {
        const totalTime = Date.now() - startTime;
        console.error(`[ERROR] [${requestId}] ❌ Request failed after ${totalTime}ms:`, { 
          status: response.status, 
          statusText: response.statusText,
          error: data.error || data.message,
          endpoint: endpoint
        });
        // Return error response with proper structure instead of throwing
        return {
          success: false,
          error: data.error || data.message || 'Request failed',
          data: null
        } as ApiResponse<T>;
      }

      const totalTime = Date.now() - startTime;
      console.log(`[DEBUG] [${requestId}] ✅ Request successful (total time: ${totalTime}ms)`);
      return data;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[ERROR] [${requestId}] ❌ Exception occurred after ${totalTime}ms:`, error);
      console.error(`[ERROR] [${requestId}] Error details:`, error instanceof Error ? {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      } : String(error));
      throw error;
    }
  }

  // Authentication
  async register(userData: { name: string; email: string; password: string }) {
    const response = await this.request<{
      user: User;
      token: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async login(credentials: { email: string; password: string }) {
    const response = await this.request<{
      user: User;
      token: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getCurrentUser() {
    return this.request<User>('/auth/me');
  }

  // Contacts
  async getContacts(userId: string, filters?: {
    category?: string;
    status?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    return this.request<{ contacts: Contact[]; total: number }>(`/contacts?${params.toString()}`);
  }

  async getContact(id: string) {
    return this.request<{ contact: Contact; insights: string[] }>(`/contacts/${id}`);
  }

  async createContact(contactData: {
    name: string;
    category: 'family' | 'friends' | 'work';
    phoneNumber?: string;
    email?: string;
    platforms?: Array<{ type: string; identifier: string; lastMessage?: Date }>;
    notes?: string;
  }) {
    return this.request<{ contact: Contact }>('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  async updateContact(id: string, updates: Partial<Contact>) {
    return this.request<{ contact: Contact }>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async updateConversationTone(conversationId: string, tone: 'formal' | 'friendly' | 'playful') {
    return this.request<{ success: boolean; conversation_id: string; tone: string }>(`/conversations/${conversationId}/tone`, {
      method: 'PUT',
      body: JSON.stringify({ tone }),
    });
  }

  async deleteContact(id: string) {
    return this.request(`/contacts/${id}`, { method: 'DELETE' });
  }

  async updateContactMetrics(id: string, metrics: {
    messageCount?: number;
    responseTime?: number;
  }) {
    return this.request<{ contact: Contact }>(`/contacts/${id}/update-metrics`, {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }

  async getContactStats() {
    return this.request<{ stats: ContactStats }>('/contacts/stats/summary');
  }

  // Conversations
  async getConversations(filters?: {
    contactId?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.contactId) params.append('contactId', filters.contactId);
    if (filters?.platform) params.append('platform', filters.platform);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/conversations?${queryString}` : '/conversations';
    
    return this.request<{
      conversations: Conversation[];
      total: number;
      hasMore: boolean;
    }>(endpoint);
  }

  async getConversation(id: string, userId?: string) {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<{ conversation: Conversation }>(`/conversations/${id}${params}`);
  }

  async getConversationSummary(id: string, userId?: string) {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<{ summary: ConversationSummary }>(`/conversations/${id}/summary${params}`);
  }

  async getConversationPrompts(conversationId: string, unusedOnly: boolean = true) {
    return this.request<{
      conversation_id: string;
      total: number;
      prompts: Array<{
        prompt_id: string;
        text: string;
        type: string;
        context: string;
        tone: string;
        confidence: number;
        used: boolean;
        created_at: string;
      }>;
    }>(`/conversations/${conversationId}/prompts?unused_only=${unusedOnly}`);
  }

  async generateNewPrompts(conversationId: string, options?: {
    num_prompts?: number;
    tone?: string;
  }) {
    return this.request<{
      prompts: Array<{
        prompt_id: string;
        text: string;
        type: string;
        context: string;
        tone: string;
        confidence: number;
      }>;
    }>(`/conversations/${conversationId}/prompts`, {
      method: 'POST',
      body: JSON.stringify({
        num_prompts: options?.num_prompts || 3,
        tone: options?.tone
      }),
    });
  }

  // AI Features
  async analyzeConversation(conversationId: string) {
    return this.request<{ analysis: ConversationAnalysis }>('/ai/analyze-conversation', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    });
  }

  async generatePrompts(contactId: string, options?: {
    context?: string;
    tone?: 'formal' | 'friendly' | 'playful';
  }) {
    return this.request<{ prompts: AIPrompt[] }>('/ai/generate-prompts', {
      method: 'POST',
      body: JSON.stringify({ contactId, ...options }),
    });
  }

  async analyzeRelationship(contactId: string) {
    return this.request<{ analysis: RelationshipAnalysis }>('/ai/analyze-relationship', {
      method: 'POST',
      body: JSON.stringify({ contactId }),
    });
  }

  async getDailySuggestions(userId: string) {
    return this.request<{ suggestions: DailySuggestion[] }>(`/ai/suggestions/daily?userId=${userId}`);
  }

  // Analytics
  async getAnalyticsOverview(userId: string, period?: string) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (period) params.append('period', period);
    return this.request<{ overview: AnalyticsOverview }>(`/analytics/overview?${params.toString()}`);
  }

  async getContactAnalytics(contactId: string, userId: string) {
    return this.request<{ analytics: ContactAnalytics }>(`/analytics/contacts/${contactId}?userId=${userId}`);
  }

  async getTrends(userId: string, period?: string) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (period) params.append('period', period);
    return this.request<{ trends: TrendsData }>(`/analytics/trends?${params.toString()}`);
  }

  // Schedule
  async getScheduledPrompts(userId: string, filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    return this.request<{ prompts: ScheduledPrompt[]; total: number }>(`/schedule/prompts?${params.toString()}`);
  }

  async getCatchUpSuggestions(userId: string, priority?: string) {
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (priority) params.append('priority', priority);
    return this.request<{ suggestions: CatchUpSuggestion[]; total: number }>(`/schedule/catch-up?${params.toString()}`);
  }

  async schedulePrompt(userId: string, promptData: {
    contactId: string;
    prompt: string;
    scheduledTime: string;
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
  }) {
    return this.request<{ scheduledPrompt: ScheduledPrompt }>('/schedule/prompts', {
      method: 'POST',
      body: JSON.stringify({ userId, ...promptData }),
    });
  }

  async getCalendarEvents(userId: string, start: string, end: string) {
    return this.request<{ events: CalendarEvent[] }>(`/schedule/calendar?userId=${userId}&start=${start}&end=${end}`);
  }

  // Upload
  async uploadTranscript(file: File, userId: string, userDisplayName?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    if (userDisplayName) {
      formData.append('user_display_name', userDisplayName);
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/upload/transcript`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return response.json();
  }

  // iMessage Integration
  async connectiMessage(userName?: string) {
    const response = await this.request<{
      success: boolean;
      message: string;
      data: {
        user: User;
        token: string;
        refreshToken: string;
        user_identity: {
          imessage_account?: string;
          icloud_account?: string;
          icloud_name?: string;
        };
      };
    }>('/imessage/connect', {
      method: 'POST',
      body: JSON.stringify({ userName }),
    });
    
    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async synciMessage(userId: string) {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        conversations_synced: number;
        conversation_ids: string[];
      };
    }>('/imessage/sync', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getiMessageStatus() {
    return this.request<{
      success: boolean;
      data: {
        enabled: boolean;
        connected: boolean;
        server_url: string | null;
      };
    }>('/imessage/status');
  }

  async getAvailableChats(limit: number = 200) {
    return this.request<{
      success: boolean;
      data: {
        chats: Array<{
          guid: string;
          displayName: string;
          participants: any[];
          isGroup: boolean;
          lastMessageDate?: number;
        }>;
        total: number;
      };
    }>(`/imessage/chats?limit=${limit}`);
  }

  // DEPRECATED: Use the method below instead (updateChatTrackingPreferences with chatTracking object)
  // This method is kept for backward compatibility but should not be used
  async updateChatTrackingPreferences_OLD(
    userId: string,
    mode: 'all' | 'recent' | 'selected',
    maxChats?: number,
    selectedChatGuids?: string[]
  ) {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        preferences: {
          mode: string;
          maxChats: number;
          selectedChatGuids: string[];
        };
      };
    }>('/imessage/preferences/chat-tracking', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        mode,
        maxChats,
        selectedChatGuids
      }),
    });
  }

  async sendiMessage(
    conversationId: string, 
    message?: string, 
    userId?: string,
    promptId?: string,
    originalPromptText?: string,
    wasEdited?: boolean,
    content?: {
      text?: string;
      images?: string[];
      files?: string[];
    }
  ) {
    const payload: any = {
      conversationId,
      userId,
      promptId,
      originalPromptText,
      wasEdited
    };

    // Support both legacy string format and new content object format
    if (content) {
      payload.content = content;
    } else if (message) {
      payload.message = message;
    } else {
      throw new Error('Either message or content must be provided');
    }

    return this.request<{
      success: boolean;
      message: string;
      data: any;
    }>('/imessage/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPromptUsageStats(userId?: string) {
    const url = userId 
      ? `/analytics/prompt-usage?userId=${userId}`
      : '/analytics/prompt-usage';
    return this.request<{
      success: boolean;
      data: {
        prompt_usage: {
          total_sent: number;
          total_edited: number;
          total_original: number;
          edit_rate: number;
        };
      };
    }>(url);
  }

  async getUserPreferences(userId: string) {
    return this.request<{
      success: boolean;
      data: {
        preferences: any;
      };
    }>(`/users/${userId}/preferences`);
  }

  async updateUserPreferences(userId: string, preferences: any) {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        preferences: any;
      };
    }>(`/users/${userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  }

  async updateChatTrackingPreferences(userId: string, chatTracking: {
    mode: 'all' | 'recent' | 'selected';
    maxChats?: number;
    selectedChatGuids?: string[];
  }) {
    // Standardize to selectedChatIds (SDK format) but support legacy selectedChatGuids
    const payload: any = {
      mode: chatTracking.mode,
      maxChats: chatTracking.maxChats,
    };
    
    // Use selectedChatIds if provided, otherwise fall back to selectedChatGuids
    if (chatTracking.selectedChatGuids && chatTracking.selectedChatGuids.length > 0) {
      payload.selectedChatIds = chatTracking.selectedChatGuids;
    }
    
    return this.request<{
      success: boolean;
      message: string;
      data: {
        chatTracking: any;
      };
    }>(`/users/${userId}/preferences/chat-tracking`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

// Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    privacy: {
      localOnly: boolean;
      cloudSync: boolean;
      dataRetention: number;
    };
    notifications: {
      email: boolean;
      push: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
    };
    ai: {
      promptStyle: 'formal' | 'friendly' | 'playful';
      autoAnalysis: boolean;
    };
    chatTracking?: {
      mode: 'all' | 'recent' | 'selected';
      maxChats?: number;
      selectedChatGuids?: string[];
    };
  };
  connectedPlatforms: {
    whatsapp: { connected: boolean; sessionId?: string; lastSync?: Date };
    telegram: { connected: boolean; userId?: string; lastSync?: Date };
  };
  lastActive: Date;
}

export interface Contact {
  id: string;
  name: string;
  category: 'family' | 'friends' | 'work';
  tone?: 'formal' | 'friendly' | 'playful';  // Conversation-specific tone
  status: 'healthy' | 'attention' | 'dormant' | 'wilted';
  size: number;
  closeness: number;
  recency: number;  // Normalized 0-1 (0 = recent, 1 = old)
  frequency?: number;  // Normalized 0-1 (0 = low, 1 = high) - avg messages/day past 50 days
  daysSinceContact?: number;  // Raw days since last contact
  lastContact?: string;  // Human readable "X days ago"
  phoneNumber?: string;
  email?: string;
  platforms: Array<{
    type: 'whatsapp' | 'telegram' | 'sms' | 'email';
    identifier: string;
    lastMessage?: Date;
  }>;
  metrics: {
    totalMessages: number;
    lastContact: Date | string;
    averageResponseTime: number;
    reciprocity: number;
    interactionFrequency?: number;  // Messages per day in past 50 days
  };
  aiAnalysis?: {
    personality?: string;
    communicationStyle?: string;
    preferredTopics?: string[];
    relationshipDynamics?: string;
    lastAnalyzed?: Date;
  };
  position?: {
    x: number;
    y: number;
    rotation: number;
  };
  tags?: string[];
  notes?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  platform: 'whatsapp' | 'telegram' | 'sms' | 'email';
  messages: Array<{
    id: string;
    sender: 'user' | 'contact';
    text: string;
    timestamp: Date;
    platform: string;
    metadata?: {
      isRead: boolean;
      isEdited: boolean;
      replyTo?: string;
      attachments?: Array<{
        type: string;
        url: string;
        filename: string;
        size: number;
      }>;
    };
  }>;
  aiAnalysis?: {
    summary: string;
    sentiment: {
      overall: 'positive' | 'neutral' | 'negative';
      userSentiment: 'positive' | 'neutral' | 'negative';
      contactSentiment: 'positive' | 'neutral' | 'negative';
    };
    topics: Array<{
      topic: string;
      confidence: number;
      mentions: number;
    }>;
    keyMoments: Array<{
      timestamp: Date;
      description: string;
      importance: 'low' | 'medium' | 'high';
    }>;
    followUpSuggestions: Array<{
      suggestion: string;
      reason: string;
      priority: 'low' | 'medium' | 'high';
      timing: 'immediate' | 'soon' | 'later';
    }>;
    lastAnalyzed: Date;
  };
  metrics: {
    totalMessages: number;
    userMessages: number;
    contactMessages: number;
    averageMessageLength: number;
    responseTime: {
      average: number;
      userAverage: number;
      contactAverage: number;
    };
    activityPattern: {
      mostActiveDay: string;
      mostActiveHour: number;
    };
  };
  startedAt: Date;
  lastMessageAt: Date;
}

export interface ConversationSummary {
  summary: string;
  sentiment: string;
  keyTopics: string[];
  followUpSuggestions: Array<{
    suggestion: string;
    reason: string;
    priority: string;
    timing: string;
  }>;
}

export interface ConversationAnalysis {
  summary: string;
  sentiment: {
    overall: string;
    userSentiment: string;
    contactSentiment: string;
  };
  topics: Array<{
    topic: string;
    confidence: number;
    mentions: number;
  }>;
  keyMoments: Array<{
    timestamp: Date;
    description: string;
    importance: string;
  }>;
  followUpSuggestions: Array<{
    suggestion: string;
    reason: string;
    priority: string;
    timing: string;
  }>;
  communicationPatterns: {
    userStyle: string;
    contactStyle: string;
    reciprocity: number;
  };
}

export interface AIPrompt {
  text: string;
  reason: string;
  tone: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RelationshipAnalysis {
  healthScore: number;
  currentStatus: string;
  insights: string[];
  communicationPatterns: {
    averageResponseTime: number;
    reciprocity: number;
    frequency: number;
  };
  recentTrends: {
    messageCount: number;
    sentimentTrend: string[];
    topicDiversity: string[];
  };
  recommendations: Array<{
    type: string;
    message: string;
    action: string;
  }>;
}

export interface DailySuggestion {
  contact: {
    id: string;
    name: string;
    status: string;
  };
  priority: 'high' | 'medium' | 'low';
  suggestion: {
    text: string;
    reason: string;
  };
  lastContact: Date;
}

export interface ContactStats {
  total: number;
  healthy: number;
  attention: number;
  dormant: number;
  wilted: number;
  family: number;
  friends: number;
  work: number;
}

export interface AnalyticsOverview {
  contacts: ContactStats;
  conversations: {
    totalMessages: number;
    totalConversations: number;
    avgMessagesPerConversation: number;
    avgResponseTime: number;
  };
  weeklyActivity: Array<{
    _id: { year: number; week: number };
    messages: number;
    conversations: number;
  }>;
  topicDiversity: Array<{
    _id: string;
    count: number;
    confidence: number;
  }>;
  healthTrends: Array<{
    _id: string;
    count: number;
    avgReciprocity: number;
    avgLastContact: number;
  }>;
  period: string;
}

export interface ContactAnalytics {
  contact: {
    id: string;
    name: string;
    status: string;
    metrics: any;
  };
  conversations: number;
  monthlyMetrics: Array<{
    _id: { year: number; month: number };
    messages: number;
    conversations: number;
    avgResponseTime: number;
  }>;
  sentimentTrends: Array<{
    _id: string;
    count: number;
  }>;
  communicationPatterns: {
    mostActiveDay: string;
    mostActiveHour: number;
    averageResponseTime: number;
    reciprocity: number;
    interactionFrequency: number;
  };
  insights: string[];
}

export interface TrendsData {
  healthTrends: Array<{
    _id: string;
    count: number;
    avgReciprocity: number;
  }>;
  communicationTrends: Array<{
    _id: { year: number; month: number };
    totalMessages: number;
    totalConversations: number;
    avgResponseTime: number;
  }>;
  revivedConnections: Array<{
    id: string;
    name: string;
    status: string;
    metrics: any;
  }>;
  period: string;
}

export interface ScheduledPrompt {
  id: string;
  contact: {
    id: string;
    name: string;
    status: string;
  };
  prompt: string;
  scheduledTime: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
}

export interface CatchUpSuggestion {
  contact: {
    id: string;
    name: string;
    status: string;
  };
  lastContact: string;
  unreadMessages: number;
  priority: 'high' | 'medium' | 'low';
  suggestedPrompt: string;
  context: {
    lastContact: string;
    relationshipHealth: string;
    reciprocity: number;
    interactionFrequency: number;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  contact: {
    id: string;
    name: string;
    status: string;
  };
  priority: 'high' | 'medium' | 'low';
}

// Create and export the API client instance
export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;

