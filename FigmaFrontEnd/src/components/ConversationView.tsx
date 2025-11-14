import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Slider } from "./ui/slider";
import { ScrollArea } from "./ui/scroll-area";
import {
  ArrowLeft,
  MessageCircle,
  Sparkles,
  Info,
  Send,
  CheckCircle,
  Loader2,
  X,
  RefreshCw,
  Edit3
} from "lucide-react";
import { apiClient } from "../services/api";
import { localMessageStorage } from "../services/localStorage";
import { toast } from "sonner";

interface Message {
  id: string;
  sender: "user" | "contact";
  text: string;
  timestamp: string;
  platform: "imessage";
}

interface ConversationViewProps {
  contactName: string;
  contactId?: string;
  conversationId?: string;
  userId?: string;
  onBack: () => void;
}

interface Prompt {
  id?: string;
  prompt_id?: string;
  text: string;
  reason: string;
  type?: string;
  context?: string;
  confidence?: number;
}

export function ConversationView({ contactName, contactId, conversationId, userId, onBack }: ConversationViewProps) {
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [tone, setTone] = useState([50]); // 0-100 scale
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [conversationSummary, setConversationSummary] = useState<string>("");
  const [daysSinceContact, setDaysSinceContact] = useState<number>(0);
  const [reciprocity, setReciprocity] = useState<number>(0.5);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationData, setConversationData] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);

  // Fetch conversation data, messages, and prompts
  useEffect(() => {
    const fetchConversationData = async () => {
      if (!conversationId && !contactId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const convId = conversationId || contactId;

        // OPTIMIZATION: Fetch all data in parallel instead of sequentially
        const [convResponse, promptsResponse, summaryResponse] = await Promise.allSettled([
          apiClient.getConversation(convId || '', userId),
          apiClient.getConversationPrompts(convId || ''),
          apiClient.getConversationSummary(convId || '', userId).catch(() => ({ success: false, data: null })) // Summary is optional
        ]);

        // Process conversation details
        if (convResponse.status === 'fulfilled' && convResponse.value.success && convResponse.value.data) {
          const conv = convResponse.value.data.conversation;
          setConversationData(conv);
          
          // Extract metrics
          const daysSince = conv.metrics?.days_since_contact || conv.daysSinceContact || 0;
          const recip = conv.metrics?.reciprocity || conv.reciprocity || 0.5;
          setDaysSinceContact(daysSince);
          setReciprocity(recip);
        }

        // Fetch messages from local storage (synchronous, no need to await)
        const localMessages = localMessageStorage.getMessages(convId || '');
        const formattedMessages: Message[] = localMessages.map((msg) => ({
          id: msg.message_id || `msg-${Math.random()}`,
          sender: msg.sender === userId || msg.sender.toLowerCase() === 'user' ? 'user' : 'contact',
          text: msg.content,
          timestamp: formatTimestamp(msg.timestamp),
          platform: 'imessage'
        }));
        setMessages(formattedMessages);

        // Process prompts
        if (promptsResponse.status === 'fulfilled' && promptsResponse.value.success && promptsResponse.value.data) {
          const apiPrompts: Prompt[] = promptsResponse.value.data.prompts.map((p: any) => ({
            id: p.prompt_id,
            text: p.text,
            reason: p.context || p.type || 'AI-generated prompt',
            type: p.type,
            context: p.context,
            confidence: p.confidence
          }));
          
          if (apiPrompts.length > 0) {
            setPrompts(apiPrompts);
            setCustomPrompt(apiPrompts[0].text);
          } else {
            // Generate new prompts if none exist
            await generateNewPrompts(convId || '');
          }
        } else {
          // Generate new prompts if fetch failed
          await generateNewPrompts(convId || '');
        }

        // Process summary (optional)
        if (summaryResponse.status === 'fulfilled' && summaryResponse.value.success && summaryResponse.value.data) {
          // Extract the summary text from the nested structure
          const summaryData = summaryResponse.value.data.summary;
          const summaryText = typeof summaryData === 'string' ? summaryData : summaryData?.summary || '';
          setConversationSummary(summaryText);
        }

      } catch (error) {
        console.error('Error fetching conversation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversationData();
  }, [conversationId, contactId, userId]);

  const generateNewPrompts = async (convId: string) => {
    try {
      const response = await apiClient.generateNewPrompts(convId, { num_prompts: 3 });
      if (response.success && response.data) {
        const newPrompts: Prompt[] = response.data.prompts.map((p: any) => ({
          id: p.prompt_id,
          text: p.text,
          reason: p.context || p.type || 'AI-generated prompt',
          type: p.type,
          context: p.context,
          confidence: p.confidence
        }));
        setPrompts(newPrompts);
        setDismissedPrompts(new Set()); // Reset dismissed prompts
        if (newPrompts.length > 0) {
          setCustomPrompt(newPrompts[0].text);
          setSelectedPrompt(0);
        }

        // Log prompts shown for study metrics
        if (userId && newPrompts.length > 0) {
          for (const prompt of newPrompts) {
            apiClient.logStudyMetric({
              userId,
              action: 'prompt_shown',
              data: {
                promptId: prompt.id,
                conversationId: convId,
                promptType: prompt.type,
                promptText: prompt.text
              }
            }).catch(err => console.error('Failed to log prompt_shown metric:', err));
          }
        }
      }
    } catch (error) {
      console.error('Error generating prompts:', error);
      toast.error('Failed to generate prompts', {
        description: 'Please try again later.',
      });
    }
  };

  const handleDismissPrompt = (index: number) => {
    const newDismissed = new Set(dismissedPrompts);
    newDismissed.add(index);
    setDismissedPrompts(newDismissed);

    // Log dismiss action for study metrics
    if (userId) {
      apiClient.logStudyMetric({
        userId,
        action: 'prompt_dismissed',
        data: {
          promptId: prompts[index].id,
          promptText: prompts[index].text,
          conversationId: conversationId || contactId,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('Failed to log prompt_dismissed metric:', err));
    }

    toast.info('Prompt dismissed', {
      description: 'This prompt will not be shown again.',
    });

    // Auto-select next non-dismissed prompt
    const remainingPrompts = prompts.filter((_, i) => !newDismissed.has(i));
    if (remainingPrompts.length > 0) {
      const nextIndex = prompts.findIndex((_, i) => !newDismissed.has(i));
      if (nextIndex !== -1) {
        setSelectedPrompt(nextIndex);
        setCustomPrompt(prompts[nextIndex].text);
      }
    }
  };

  const handleRegeneratePrompts = async () => {
    setIsRegenerating(true);
    toast.info('Regenerating prompts...', {
      description: 'Creating new suggestions based on your conversation.',
    });

    try {
      await generateNewPrompts(conversationId || contactId || '');
      toast.success('New prompts generated!', {
        description: 'Fresh suggestions are ready.',
      });
    } catch (error) {
      console.error('Error regenerating prompts:', error);
      toast.error('Failed to regenerate', {
        description: 'Please try again.',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return timestamp;
    }
  };

  const formatDaysAgo = (days: number): string => {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const getToneName = (value: number) => {
    if (value < 33) return "Formal";
    if (value < 66) return "Friendly";
    return "Playful";
  };

  const handleSendMessage = async () => {
    if (!conversationId && !contactId) {
      toast.error('Cannot send message', {
        description: 'Conversation ID not available. Please try syncing conversations first.',
      });
      return;
    }

    if (prompts.length === 0 || !prompts[selectedPrompt]) {
      toast.error('No prompts available', {
        description: 'Please generate prompts first using the button above.',
      });
      return;
    }

    const originalPrompt = prompts[selectedPrompt];
    if (!originalPrompt || !originalPrompt.text) {
      toast.error('Invalid prompt', {
        description: 'Please select a valid prompt from the list.',
      });
      return;
    }

    const messageToSend = customPrompt || originalPrompt.text;
    if (!messageToSend.trim()) {
      toast.error('Empty message', {
        description: 'Please enter a message to send.',
      });
      return;
    }

    // Determine if message was edited
    const wasEdited = customPrompt.trim() !== '' && customPrompt.trim() !== originalPrompt.text.trim();

    setSending(true);
    try {
      const { apiClient } = await import('../services/api');
      const result = await apiClient.sendiMessage(
        conversationId || contactId || '',
        messageToSend,
        userId, // userId
        originalPrompt.id || originalPrompt.prompt_id || undefined, // promptId (may be undefined)
        originalPrompt.text, // originalPromptText
        wasEdited // wasEdited
      );

      if (result.success) {
        setSent(true);
        toast.success('Message sent!', {
          description: 'Your message has been sent via iMessage.',
        });

        // Log study metrics for message sent
        if (userId) {
          // Log message sent
          apiClient.logStudyMetric({
            userId,
            action: 'message_sent',
            data: {
              conversationId: conversationId || contactId,
              messageLength: messageToSend.length,
              wasEdited,
              editDistance: wasEdited ? Math.abs(messageToSend.length - originalPrompt.text.length) : 0
            }
          }).catch(err => console.error('Failed to log message_sent metric:', err));

          // Log prompt accepted or edited
          if (wasEdited) {
            apiClient.logStudyMetric({
              userId,
              action: 'prompt_edited',
              data: {
                promptId: originalPrompt.id || originalPrompt.prompt_id,
                conversationId: conversationId || contactId,
                originalText: originalPrompt.text,
                editedText: messageToSend,
                editDistance: Math.abs(messageToSend.length - originalPrompt.text.length)
              }
            }).catch(err => console.error('Failed to log prompt_edited metric:', err));
          } else {
            apiClient.logStudyMetric({
              userId,
              action: 'prompt_accepted',
              data: {
                promptId: originalPrompt.id || originalPrompt.prompt_id,
                conversationId: conversationId || contactId
              }
            }).catch(err => console.error('Failed to log prompt_accepted metric:', err));
          }
        }

        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        toast.error('Failed to send message', {
          description: result.error || 'Unknown error occurred. Please try again.',
        });
        setSending(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message', {
        description: 'Please check your connection and try again.',
      });
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 sm:px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="truncate">{contactName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              Last contact: {formatDaysAgo(daysSinceContact)}
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              iMessage
            </Badge>
          </div>
        </div>
      </div>

      {/* Main content area - using explicit height */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
        {/* Left: Conversation Thread */}
        <div className="flex-1 lg:flex-[1] flex flex-col lg:border-r overflow-hidden min-h-0">
          {/* AI Summary */}
          {conversationSummary && (
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/20 border-b p-4 shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="mb-2">Conversation Summary</h4>
                <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    {conversationSummary}
                </p>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">Reciprocity:</div>
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`w-2 h-4 rounded-sm ${
                              i <= Math.round(reciprocity * 5)
                                ? 'bg-gradient-to-t from-primary to-primary/70'
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">
                        {Math.round(reciprocity * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages - scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-3xl">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p style={{ fontSize: '0.9375rem' }}>{message.text}</p>
                    <p
                      className={`mt-1 ${
                        message.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {message.timestamp}
                    </p>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Prompt Composer */}
        <div className="w-full lg:w-[480px] flex flex-col bg-card/30 lg:border-t-0 border-t overflow-hidden min-h-0">
          <div className="border-b p-4 flex-shrink-0">
            <h3>Compose Message</h3>
            <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
              AI-suggested prompts tailored to your conversation
            </p>
          </div>

          {/* Prompts - scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-6">
              {/* Suggested Prompts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                <label>Suggested Prompts</label>
                  <div className="flex gap-2">
                    {prompts.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegeneratePrompts}
                        disabled={isRegenerating}
                        className="gap-1"
                      >
                        {isRegenerating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Regenerate
                      </Button>
                    )}
                    {prompts.length === 0 && !isLoading && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => generateNewPrompts(conversationId || contactId || '')}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Generate
                      </Button>
                    )}
                  </div>
                </div>
                {isLoading && prompts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : prompts.filter((_, i) => !dismissedPrompts.has(i)).length === 0 && prompts.length > 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm space-y-3">
                    <p>All prompts dismissed.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegeneratePrompts}
                      disabled={isRegenerating}
                      className="gap-1"
                    >
                      {isRegenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Generate New Prompts
                    </Button>
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>No prompts available. Click "Generate" to create AI prompts.</p>
                  </div>
                ) : (
                  prompts.map((prompt, index) =>
                    !dismissedPrompts.has(index) && (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-all border-2 relative group ${
                      selectedPrompt === index
                        ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg"
                        : "border-transparent hover:border-primary/30 hover:shadow-md"
                    }`}
                  >
                    <div
                      className="p-4 pr-12"
                      onClick={() => {
                        setSelectedPrompt(index);
                        setCustomPrompt(prompt.text);
                      }}
                    >
                      <p style={{ fontSize: '0.9375rem' }}>{prompt.text}</p>
                      <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                        <Info className="w-3 h-3" />
                        <span style={{ fontSize: '0.75rem' }}>{prompt.reason}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-8 w-8 p-0 opacity-60 hover:opacity-100 transition-opacity"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleDismissPrompt(index);
                      }}
                      aria-label="Dismiss prompt"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                    </Button>
                  </Card>
                  ))
                )}
              </div>

              {/* Custom Edit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                    Edit Your Message
                    {customPrompt && prompts[selectedPrompt] && customPrompt.trim() !== prompts[selectedPrompt].text.trim() && (
                      <Edit3 className="w-3 h-3 text-primary" />
                    )}
                  </label>
                  {customPrompt && prompts[selectedPrompt] && customPrompt.trim() !== prompts[selectedPrompt].text.trim() && (
                    <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/30">
                      Customized
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={customPrompt || (prompts[selectedPrompt]?.text || '')}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setIsEditing(true);
                  }}
                  onFocus={() => setIsEditing(true)}
                  onBlur={() => setIsEditing(false)}
                  rows={4}
                  placeholder="Click a prompt above, then edit it here to customize your message..."
                  className={`resize-none transition-all ${
                    customPrompt && prompts[selectedPrompt] && customPrompt.trim() !== prompts[selectedPrompt].text.trim()
                      ? 'border-primary/50 ring-1 ring-primary/20'
                      : ''
                  }`}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {customPrompt && prompts[selectedPrompt] && customPrompt.trim() !== prompts[selectedPrompt].text.trim()
                      ? "✓ Your message has been customized"
                      : "You can edit the selected prompt above to personalize it"}
                  </p>
                  {customPrompt && prompts[selectedPrompt] && customPrompt.trim() !== prompts[selectedPrompt].text.trim() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setCustomPrompt(prompts[selectedPrompt].text)}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Tone Dial */}
              <div className="space-y-3">
                <label>Message Tone</label>
                <div className="space-y-2">
                  <Slider
                    value={tone}
                    onValueChange={setTone}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                    <span>Formal</span>
                    <span className="text-foreground font-medium">{getToneName(tone[0])}</span>
                    <span>Playful</span>
                  </div>
                </div>
              </div>

              {/* Why this prompt? */}
              {prompts.length > 0 && prompts[selectedPrompt] && (
              <Card className="p-4 bg-gradient-to-br from-accent/20 to-secondary/30 border-2 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="mb-2">Why this prompt?</h4>
                    <div className="space-y-2 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                        {daysSinceContact > 0 && (
                      <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                              {formatDaysAgo(daysSinceContact)}
                            </Badge>
                            <span>since last contact</span>
                      </div>
                        )}
                        {prompts[selectedPrompt].context && (
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-accent/30 text-foreground border-accent/50">Context</Badge>
                            <span>{prompts[selectedPrompt].context}</span>
                      </div>
                        )}
                        {prompts[selectedPrompt].type && (
                      <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-secondary text-foreground border-secondary">
                              {prompts[selectedPrompt].type}
                            </Badge>
                            <span>AI-generated suggestion</span>
                      </div>
                        )}
                    </div>
                  </div>
                </div>
              </Card>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t p-4 space-y-2 bg-card flex-shrink-0">
            {sent ? (
              <div className="flex items-center justify-center gap-2 py-3 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span>Message sent via iMessage!</span>
              </div>
            ) : (
              <>
                <Button 
                  onClick={handleSendMessage} 
                  className="w-full gap-2" 
                  size="lg"
                  disabled={sending || !conversationId && !contactId}
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send via iMessage'}
                </Button>
                <p className="text-center text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                  {conversationId || contactId 
                    ? 'Your message will be sent directly via iMessage'
                    : 'Conversation ID not available. Please sync conversations first.'}
                </p>
              </>
            )}
          </div>
        </div>
        </ScrollArea>
      </div>

    </div>

  );
}
