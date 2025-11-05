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
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
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

  async getConversation(id: string) {
    return this.request<{ conversation: Conversation }>(`/conversations/${id}`);
  }

  async getConversationSummary(id: string) {
    return this.request<{ summary: ConversationSummary }>(`/conversations/${id}/summary`);
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
  status: 'healthy' | 'attention' | 'dormant' | 'wilted';
  size: number;
  closeness: number;
  recency: number;
  phoneNumber?: string;
  email?: string;
  platforms: Array<{
    type: 'whatsapp' | 'telegram' | 'sms' | 'email';
    identifier: string;
    lastMessage?: Date;
  }>;
  metrics: {
    totalMessages: number;
    lastContact: Date;
    averageResponseTime: number;
    reciprocity: number;
    interactionFrequency: number;
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

