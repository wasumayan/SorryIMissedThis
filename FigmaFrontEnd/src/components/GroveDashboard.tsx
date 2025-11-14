import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { GroveLeaf } from "./GroveLeaf";
import { RelationshipStatsModal } from "./RelationshipStatsModal";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Droplet, Search, Calendar, TrendingUp, RefreshCw } from "lucide-react";
import { apiClient, User, Contact, DailySuggestion } from "../services/api";
import { toast } from "sonner";

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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

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

  const filters = ["All", "Family", "Friends", "Work", "Dormant", "Priority"];

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

  // Simple graph layout: User at center, radial distribution
  // - Angle: 360 / total contacts (evenly spaced)
  // - Line length: recency (days since contact) - longer = older
  // - Line thickness: frequency (avg messages/day in past 50 days) - thicker = more frequent
  const layoutContacts = (contacts: Contact[]) => {
    const centerX = 500;
    const centerY = 200;
    const totalContacts = contacts.length;
    
    if (totalContacts === 0) return [];

    // Use normalized values from backend, or normalize here if not provided
    // Backend sends: recency (0-1, where 0=recent, 1=old), frequency (0-1, where 0=low, 1=high)
    const recencies = contacts.map(c => {
      // If recency is provided (normalized), use it directly
      // Otherwise, calculate from daysSinceContact
      if (c.recency !== undefined) return c.recency;
      if (c.daysSinceContact !== undefined) return Math.min(1.0, c.daysSinceContact / 90.0);
      return 0.5; // Default
    });
    
    const frequencies = contacts.map(c => {
      // If frequency is provided (normalized), use it directly
      // Otherwise, normalize from interactionFrequency
      if (c.frequency !== undefined) return c.frequency;
      if (c.metrics?.interactionFrequency !== undefined) {
        return Math.min(1.0, c.metrics.interactionFrequency / 5.0); // 5 msg/day = max
      }
      return 0; // Default
    });
    
    // If backend didn't normalize, normalize here across all contacts
    const maxRecency = Math.max(...recencies, 1);
    const maxFrequency = Math.max(...frequencies, 1);
    
    const normalizedRecencies = contacts.map((c, i) => {
      // Use backend normalized value if available, otherwise normalize here
      return c.recency !== undefined ? c.recency : (recencies[i] / maxRecency);
    });
    
    const normalizedFrequencies = contacts.map((c, i) => {
      // Use backend normalized value if available, otherwise normalize here
      return c.frequency !== undefined ? c.frequency : (frequencies[i] / maxFrequency);
    });

    return contacts.map((contact, i) => {
      // Angle: evenly distributed (360 / total)
      const angleDegrees = (-180 / totalContacts) * i;
      const angleRadians = (angleDegrees * Math.PI) / 180;

      // Line length: recency (normalized 0-1, where 0 = recent, 1 = old)
      // Recent contacts (low recency) = shorter lines (closer to center)
      // Old contacts (high recency) = longer lines (farther from center)
      const recencyNormalized = normalizedRecencies[i];
      const minDistance = 150;   // Closest (recent contacts)
      const maxDistance = 200;   // Farthest (old contacts)
      const distance = minDistance + recencyNormalized * (maxDistance - minDistance);

      // Calculate position
      const x = centerX + Math.cos(angleRadians) * distance;
      const y = centerY + Math.sin(angleRadians) * distance;

      // Line thickness: frequency (normalized 0-1)
      // High frequency = thick line, low frequency = thin line
      const frequencyNormalized = normalizedFrequencies[i];
      const minThickness = 2;
      const maxThickness = 8;
      const lineThickness = minThickness + frequencyNormalized * (maxThickness - minThickness);

      return {
        ...contact,
        x,
        y,
        rotation: angleDegrees + 90, // Leaf rotation (perpendicular to branch)
        branchLength: distance,
        lineThickness, // For rendering the branch line
        recencyNormalized,
        frequencyNormalized,
      };
    });
  };

  const layoutedContacts = layoutContacts(filteredContacts);
  
  // Debug logging
  console.log('[GROVE] Render state:', {
    totalContacts: contacts.length,
    filteredContacts: filteredContacts.length,
    layoutedContacts: layoutedContacts.length,
    isLoading,
    activeFilter,
    searchQuery,
    sampleContact: layoutedContacts.length > 0 ? {
      name: layoutedContacts[0].name,
      x: layoutedContacts[0].x,
      y: layoutedContacts[0].y,
      recency: layoutedContacts[0].recency,
      frequency: layoutedContacts[0].frequency,
      lineThickness: layoutedContacts[0].lineThickness
    } : null
  });
  
  const dormantCount = contacts.filter((c) => c.status === "dormant" || c.status === "wilted").length;
  const attentionCount = contacts.filter((c) => c.status === "attention").length;

  const handleLeafClick = (contact: Contact) => {
    console.log('[GROVE] Leaf clicked:', contact.name, contact.id);
    console.log('[GROVE] Contact data:', contact);
    setSelectedContact(contact);
    console.log('[GROVE] Selected contact set to:', contact);
  };

  const handleCloseModal = () => {
    setSelectedContact(null);
  };

  const handleSendMessage = () => {
    if (selectedContact) {
      onContactSelect(selectedContact);
      setSelectedContact(null);
    }
  };

  // Handle mouse wheel / trackpad zoom
  // Zooms towards the mouse cursor position (standard behavior)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    // Prevent page scroll when zooming
    e.preventDefault();
    
    // Get zoom direction and sensitivity
    // deltaY: negative = zoom in (scroll up), positive = zoom out (scroll down)
    // Use smaller increments for smoother zooming
    const zoomSensitivity = 0.05; // Adjust this for faster/slower zoom
    const zoomDelta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
    
    // Calculate new zoom level (clamp between 0.5 and 2)
    const newZoom = Math.max(0.5, Math.min(2, zoomLevel + zoomDelta));
    
    // If zoom didn't change (hit limit), don't update pan
    if (newZoom === zoomLevel) return;
    
    // Get mouse position relative to SVG viewport
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert mouse position to SVG coordinates
    const viewBoxWidth = 1000 / zoomLevel;
    const viewBoxHeight = 700 / zoomLevel;
    const svgX = (-panX) + (mouseX / rect.width) * viewBoxWidth;
    const svgY = (-panY) + (mouseY / rect.height) * viewBoxHeight;
    
    // Calculate new viewBox dimensions
    const newViewBoxWidth = 1000 / newZoom;
    const newViewBoxHeight = 700 / newZoom;
    
    // Adjust pan to keep the point under cursor in the same position
    const newPanX = -svgX + (mouseX / rect.width) * newViewBoxWidth;
    const newPanY = -svgY + (mouseY / rect.height) * newViewBoxHeight;
    
    setZoomLevel(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  };

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
          <div className="flex-1 relative">
            <div className="absolute inset-0 overflow-hidden">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.03]">
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

            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border shadow-lg">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoomLevel(Math.min(zoomLevel + 0.1, 2))}
                className="h-8 w-8"
                aria-label="Zoom in"
              >
                +
              </Button>
              <div className="text-xs text-center text-muted-foreground px-2">
                {Math.round(zoomLevel * 100)}%
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoomLevel(Math.max(zoomLevel - 0.1, 0.5))}
                className="h-8 w-8"
                aria-label="Zoom out"
              >
                −
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setZoomLevel(1);
                  setPanX(0);
                  setPanY(0);
                }}
                className="h-8 w-8 text-xs"
                title="Reset zoom"
                aria-label="Reset zoom to 100%"
              >
                ⌂
              </Button>
            </div>

            <svg
              className="w-full h-full cursor-move"
              viewBox={`${0 - panX} ${0 - panY} ${1000 / zoomLevel} ${800 / zoomLevel}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Interactive relationship grove visualization showing your contacts"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setIsDragging(true);
                setDragStart({ 
                  x: e.clientX - panX * zoomLevel, 
                  y: e.clientY - panY * zoomLevel 
                });
              }}
              onMouseMove={(e) => {
                if (isDragging) {
                  const deltaX = (e.clientX - dragStart.x) / zoomLevel;
                  const deltaY = (e.clientY - dragStart.y) / zoomLevel;
                  setPanX(deltaX);
                  setPanY(deltaY);
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={handleWheel}
            >
              {/* Watering can (you) in the center */}
              <defs>
                <radialGradient id="water-glow">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
                </radialGradient>
                <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              
              {/* Glow effect */}
              <circle cx="500" cy="400" r="60" fill="url(#water-glow)" />

              {/* Watering can illustration */}
              <g transform="translate(500, 400)">
                {/* Can body */}
                <ellipse
                  cx="0"
                  cy="5"
                  rx="28"
                  ry="30"
                  fill="#78716c"
                  opacity="0.9"
                />
                {/* Water inside (visible through can) */}
                <ellipse
                  cx="0"
                  cy="10"
                  rx="22"
                  ry="20"
                  fill="url(#water-gradient)"
                  opacity="0.85"
                />
                {/* Water shimmer effect */}
                <ellipse
                  cx="-5"
                  cy="5"
                  rx="12"
                  ry="8"
                  fill="white"
                  opacity="0.4"
                />
                
                {/* Can rim/opening at top */}
                <ellipse
                  cx="0"
                  cy="-23"
                  rx="20"
                  ry="6"
                  fill="#57534e"
                />
                <ellipse
                  cx="0"
                  cy="-24"
                  rx="20"
                  ry="5"
                  fill="#78716c"
                />
                
                {/* Handle */}
                <path
                  d="M 28 0 Q 45 0 45 -15 Q 45 -25 35 -25"
                  fill="none"
                  stroke="#78716c"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                
                {/* Spout */}
                <path
                  d="M -20 -10 L -40 -18 L -42 -12 L -22 -4 Z"
                  fill="#78716c"
                  opacity="0.9"
                />
                {/* Spout holes */}
                <circle cx="-38" cy="-17" r="1.5" fill="#57534e" />
                <circle cx="-40" cy="-14" r="1.5" fill="#57534e" />
                <circle cx="-42" cy="-16" r="1.5" fill="#57534e" />
              </g>
              
              {/* "You" label */}
              <text
                x="500"
                y="455"
                textAnchor="middle"
                fill="currentColor"
                fontSize="13"
                fontWeight="600"
                opacity="0.8"
              >
                You
              </text>

              {/* Loading state */}
              {isLoading && (
                <g>
                  <text
                    x="500"
                    y="320"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="16"
                    fontWeight="500"
                    opacity="0.6"
                  >
                    Loading your grove...
                  </text>
                  <circle
                    cx="500"
                    cy="350"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="100"
                    strokeLinecap="round"
                    opacity="0.4"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 500 350"
                      to="360 500 350"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              )}

              {/* Empty state message */}
              {contacts.length === 0 && !isLoading && (
                <g>
                  <text
                    x="500"
                    y="310"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="18"
                    fontWeight="600"
                    opacity="0.7"
                  >
                    Your grove is waiting to grow
                  </text>
                  <text
                    x="500"
                    y="340"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="14"
                    opacity="0.5"
                  >
                    Click "Sync Conversations" to get started
                  </text>
                </g>
              )}

              {/* Branch + Leaf pairs - render together to ensure 1:1 correspondence */}
              {layoutedContacts.map((contact) => {
                // Use calculated values from layoutContacts
                const lineThickness = contact.lineThickness || 2;
                const frequencyNormalized = contact.frequencyNormalized || 0;
                
                // Opacity based on frequency (more active = more visible)
                const opacity = 0.4 + frequencyNormalized * 0.5; // 0.4-0.9 range
                
                return (
                  <g key={contact.id || `contact-${contact.name}-${contact.x}-${contact.y}`}>
                    {/* Branch line from "You" (center) to this contact's leaf */}
                    {/* Line length = recency (distance), Line thickness = frequency */}
                    <line
                      x1="500"
                      y1="400"
                      x2={contact.x}
                      y2={contact.y}
                      stroke="#78350f"
                      strokeWidth={lineThickness / zoomLevel}
                      opacity={opacity}
                      strokeLinecap="round"
                    />
                    
                    {/* Leaf at the end of the branch */}
                    <GroveLeaf
                      name={contact.name}
                      category={contact.category}
                      status={contact.status}
                      size={contact.size}
                      x={contact.x}
                      y={contact.y}
                      rotation={contact.rotation}
                      onClick={() => {
                        console.log('[GROVE] Leaf onClick triggered for:', contact.name);
                        handleLeafClick(contact);
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            </div>

            {/* Enhanced Legend */}
            <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
              <Card className="w-52 p-4 space-y-2 bg-card backdrop-blur-md shadow-xl border-2 pointer-events-auto">
                <p className="text-muted-foreground" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  Relationship Health
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                    <span style={{ fontSize: '0.75rem' }}>Healthy - Thriving connection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <span style={{ fontSize: '0.75rem' }}>Attention - Withering, needs care</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ec4899]" />
                    <span style={{ fontSize: '0.75rem' }}>Dormant - Bud waiting to bloom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#78350f]" />
                    <span style={{ fontSize: '0.75rem' }}>At Risk - Needs urgent attention</span>
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
                    suggestions.slice(0, 3).map((suggestion, index) => {
                      const priorityColors = {
                        high: '#f59e0b',
                        medium: '#06b6d4',
                        low: '#10b981'
                      };
                      const color = priorityColors[suggestion.priority] || '#06b6d4';

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
                      .slice(0, 3)
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
                            <Badge variant="outline" className="text-xs">
                              {contact.lastContact}
                            </Badge>
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
