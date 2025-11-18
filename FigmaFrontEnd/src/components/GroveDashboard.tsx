import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { GroveSVG } from "./GroveSVG";
import { RelationshipStatsModal } from "./RelationshipStatsModal";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Droplet, Search, Calendar, TrendingUp, RefreshCw } from "lucide-react";
import { apiClient, User, Contact, DailySuggestion } from "../services/api";
import { toast } from "sonner";
import { GROVE_CONSTANTS } from "../constants/grove";

interface GroveDashboardProps {
  user: User;
  onContactSelect: (contact: Contact) => void;
  onViewAnalytics: () => void;
  onViewSchedule: () => void;
}

export function GroveDashboard({ user, onContactSelect, onViewAnalytics, onViewSchedule }: GroveDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [suggestions, setSuggestions] = useState<DailySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 1000, height: 800 });

  // Update graph dimensions only when container size changes
  useEffect(() => {
    if (!graphContainerRef.current) return;

    const updateDimensions = () => {
      if (graphContainerRef.current) {
        const rect = graphContainerRef.current.getBoundingClientRect();
        setGraphDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial size
    updateDimensions();

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(graphContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Fetch contacts and suggestions on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch contacts
        console.log('[GROVE] Fetching contacts for user:', user.id);
        const contactsResponse = await apiClient.getContacts(user.id);
        console.log('[GROVE] Contacts response:', {
          success: contactsResponse.success,
          hasData: !!contactsResponse.data,
          contactsCount: contactsResponse.data?.contacts?.length || 0,
          error: contactsResponse.error
        });

        if (contactsResponse.success && contactsResponse.data) {
          const contactsList = contactsResponse.data.contacts || [];
          console.log('[GROVE] Setting contacts:', contactsList.length, 'contacts');
          setContacts(contactsList);
        } else {
          console.error('[GROVE] Failed to get contacts:', contactsResponse);
          setContacts([]); // Ensure empty array on error
        }

        // Fetch daily suggestions
        try {
          const suggestionsResponse = await apiClient.getDailySuggestions(user.id);
          console.log('[GROVE] Suggestions response:', {
            success: suggestionsResponse.success,
            hasData: !!suggestionsResponse.data,
            suggestionsCount: suggestionsResponse.data?.suggestions?.length || 0,
            error: suggestionsResponse.error
          });

          if (suggestionsResponse.success && suggestionsResponse.data) {
            setSuggestions(suggestionsResponse.data.suggestions || []);
          } else {
            console.warn('[GROVE] Failed to get suggestions:', suggestionsResponse.error);
            setSuggestions([]);
          }
        } catch (error) {
          console.error('[GROVE] Error fetching suggestions:', error);
          setSuggestions([]);
        }
      } catch (error) {
        console.error('[GROVE] Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  const filters = [...GROVE_CONSTANTS.FILTERS];

  // OPTIMIZATION: Use useMemo to avoid recalculating filtered contacts on every render
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === "All") return true;
      if (activeFilter === "Dormant") return contact.status === "dormant" || contact.status === "wilted";
      if (activeFilter === "Priority") return contact.status === "attention" || contact.status === "wilted";
      return contact.category === activeFilter.toLowerCase();
    });
  }, [contacts, searchQuery, activeFilter]);

  // Graph data calculation moved to GroveSVG component
  
  const dormantCount = contacts.filter((c) => c.status === "dormant" || c.status === "wilted").length;

  const handleCloseModal = () => {
    setSelectedContact(null);
  };

  const handleSendMessage = () => {
    if (selectedContact) {
      onContactSelect(selectedContact);
      setSelectedContact(null);
    }
  };

  const handleLeafClick = useCallback((contact: Contact) => {
    console.log('[GROVE] Leaf clicked:', contact.name, contact.id);
    console.log('[GROVE] Contact data:', contact);
    // Directly navigate to conversation view
    onContactSelect(contact);
  }, [onContactSelect]);

  // Rendering functions moved to GroveSVG component (pure SVG with D3.js)

  // Update graph dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.querySelector('.grove-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        setGraphDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleSyncConversations = async () => {
    setIsSyncing(true);
    try {
      console.log('[GROVE] Syncing iMessage conversations...');
      const syncResponse = await apiClient.synciMessage(user.id);

      if (syncResponse.success) {
        console.log('[GROVE] Sync successful:', syncResponse.data);

        // Refresh contacts and suggestions after sync
        const contactsResponse = await apiClient.getContacts(user.id);
        if (contactsResponse.success && contactsResponse.data) {
          setContacts(contactsResponse.data.contacts);
        }

        const suggestionsResponse = await apiClient.getDailySuggestions(user.id);
        if (suggestionsResponse.success && suggestionsResponse.data) {
          setSuggestions(suggestionsResponse.data.suggestions);
        }

        const conversationCount = syncResponse.data?.data?.conversations_synced || 0;
        toast.success(`Successfully synced ${conversationCount} conversation${conversationCount !== 1 ? 's' : ''}!`, {
          description: 'Your grove has been updated with the latest data.',
        });
      } else {
        console.error('[GROVE] Sync failed:', syncResponse.error);
        toast.error('Sync failed', {
          description: syncResponse.error || 'Unknown error occurred. Please try again.',
        });
      }
    } catch (error) {
      console.error('[GROVE] Error syncing:', error);
      toast.error('Error syncing conversations', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="flex h-full bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        {/* Main Grove Visualization */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Welcome, {user.name || 'there'}!
              </h2>
              <div className="flex gap-2">
                {filters.map((filter) => (
                  <Button
                    key={filter}
                    variant={activeFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(filter)}
                    className="text-sm"
                  >
                    {filter}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncConversations}
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Conversations'}
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          {/* Grove Canvas */}
          <div className="flex-1 relative grove-container">
            <div className="absolute inset-0 overflow-hidden">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.03] z-0">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="leaf-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                    <path
                      d="M60 30C60 30 50 40 50 50C50 56 54 60 60 60C66 60 70 56 70 50C70 40 60 30 60 30Z"
                      fill="currentColor"
                      opacity="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
              </svg>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-lg font-medium opacity-60 mb-4">Loading your grove...</div>
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              </div>
              )}

              {/* Empty state message */}
              {contacts.length === 0 && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-xl font-semibold opacity-70 mb-2">Your grove is waiting to grow</div>
                  <div className="text-sm opacity-50">Click "Sync Conversations" to get started</div>
                </div>
              </div>
            )}

            {/* Pure SVG Graph Visualization with D3.js - Everything synced */}
            {!isLoading && filteredContacts.length > 0 && (
              <div 
                ref={graphContainerRef}
                className="absolute inset-0 z-0"
              >
                <GroveSVG
                  contacts={filteredContacts}
                  onContactClick={handleLeafClick}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                />
              </div>
            )}

            </div>

            {/* Enhanced Legend */}
            <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
              <Card className="w-52 p-4 space-y-2 bg-card backdrop-blur-md shadow-xl border-2 pointer-events-auto">
                <p className="text-muted-foreground" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  Relationship Health
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GROVE_CONSTANTS.COLORS.HEALTHY }} />
                    <span className="text-xs">Healthy - Thriving connection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GROVE_CONSTANTS.COLORS.ATTENTION }} />
                    <span className="text-xs">Attention - Withering, needs care</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GROVE_CONSTANTS.COLORS.DORMANT }} />
                    <span className="text-xs">Dormant - Bud waiting to bloom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GROVE_CONSTANTS.COLORS.WILTED }} />
                    <span className="text-xs">At Risk - Needs urgent attention</span>
                  </div>
                </div>
                <div className="pt-2 border-t text-muted-foreground" style={{ fontSize: '0.7rem' }}>
                  <p>Line length = recency (recent = closer to center)</p>
                  <p>Line thickness = frequency (avg messages/day, past 50 days)</p>
                  <p>Health = function of frequency + recency</p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Panel - Today's Prompts & Dormant Branches */}
        <div className="w-80 border-l bg-card/30 backdrop-blur-sm flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-6">
              {/* Today's Prompts */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-primary" />
                  <h3>Today's Prompts</h3>
                </div>
                <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                  Gentle suggestions to nurture connections
                </p>

                <div className="space-y-3 mt-4">
                  {isLoading ? (
                    <Card className="p-4">
                      <p className="text-muted-foreground text-sm">Loading suggestions...</p>
                    </Card>
                  ) : suggestions.length > 0 ? (
                    suggestions.slice(0, GROVE_CONSTANTS.MAX_SUGGESTIONS_DISPLAYED).map((suggestion, index) => {
                      const priorityColors = {
                        high: GROVE_CONSTANTS.COLORS.PRIORITY_HIGH,
                        medium: GROVE_CONSTANTS.COLORS.PRIORITY_MEDIUM,
                        low: GROVE_CONSTANTS.COLORS.PRIORITY_LOW
                      };
                      const color = priorityColors[suggestion.priority] || GROVE_CONSTANTS.COLORS.PRIORITY_MEDIUM;

                      return (
                        <Card
                          key={index}
                          className="p-4 border-l-4 hover:shadow-md transition-shadow cursor-pointer"
                          style={{ borderLeftColor: color }}
                          onClick={() => {
                            console.log('[GROVE] Prompt clicked for contact:', suggestion.contact.name);
                            // Find the contact and open their modal
                            const contact = contacts.find(c => c.id === suggestion.contact.id || c.name === suggestion.contact.name);
                            if (contact) {
                              handleLeafClick(contact);
                            } else {
                              console.warn('[GROVE] Contact not found for prompt:', suggestion.contact);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: color }} />
                            <div className="flex-1">
                              <p className="text-foreground" style={{ fontSize: '0.875rem' }}>
                                <strong>{suggestion.contact.name}</strong>: {suggestion.suggestion.text}
                              </p>
                              <p className="text-muted-foreground mt-1" style={{ fontSize: '0.75rem' }}>
                                {suggestion.suggestion.reason}
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <Card className="p-4">
                      <p className="text-muted-foreground text-sm">No suggestions for today - you're all caught up!</p>
                    </Card>
                  )}
                </div>
              </div>

              {/* Dormant Branches */}
              {dormantCount > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <span style={{ fontSize: '0.75rem' }}>{dormantCount}</span>
                    </div>
                    <h3>Dormant Branches</h3>
                  </div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Connections that could use some care
                  </p>

                  <div className="space-y-2 mt-4">
                    {contacts
                      .filter((c) => c.status === "dormant" || c.status === "wilted")
                      .slice(0, GROVE_CONSTANTS.MAX_DORMANT_DISPLAYED)
                      .map((contact) => (
                        <Card
                          key={contact.id}
                          className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleLeafClick(contact)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: contact.status === "wilted" ? "#ef4444" : "#64748b",
                                }}
                              />
                              <span style={{ fontSize: '0.875rem' }}>{contact.name}</span>
                            </div>
                            {contact.lastContact && (
                            <Badge variant="outline" className="text-xs">
                              {contact.lastContact}
                            </Badge>
                            )}
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2 pt-4 border-t">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={onViewSchedule}>
                  <Calendar className="w-4 h-4" />
                  Schedule & Catch-Up
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={onViewAnalytics}>
                  <TrendingUp className="w-4 h-4" />
                  Growth Rings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relationship Stats Modal */}
      <AnimatePresence>
        {selectedContact && (
          <RelationshipStatsModal
            contact={selectedContact}
            onClose={handleCloseModal}
            onSendMessage={handleSendMessage}
          />
        )}
      </AnimatePresence>
    </>
  );
}
