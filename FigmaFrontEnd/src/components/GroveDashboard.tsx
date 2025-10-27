import { useState } from "react";
import { GroveLeaf } from "./GroveLeaf";
import { RelationshipStatsModal } from "./RelationshipStatsModal";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Droplet, Search, Calendar, TrendingUp } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  category: "family" | "friends" | "work";
  status: "healthy" | "attention" | "dormant" | "wilted";
  size: number;
  lastContact: string;
  closeness?: number; // 0-1, affects branch thickness
  recency?: number; // 0-1, affects branch length (higher = more recent)
}

interface GroveDashboardProps {
  onContactSelect: (contact: Contact) => void;
  onViewAnalytics: () => void;
  onViewSchedule: () => void;
}

// Mock contact data with closeness and recency
const generateContacts = (): Contact[] => {
  const names = [
    { name: "Mom", category: "family" as const },
    { name: "Dad", category: "family" as const },
    { name: "Sarah", category: "friends" as const },
    { name: "Mike", category: "friends" as const },
    { name: "Jessica", category: "friends" as const },
    { name: "Alex Chen", category: "work" as const },
    { name: "Emma Wilson", category: "work" as const },
    { name: "Tom", category: "friends" as const },
    { name: "Lisa", category: "family" as const },
    { name: "David Park", category: "work" as const },
    { name: "Rachel", category: "friends" as const },
    { name: "Uncle John", category: "family" as const },
    { name: "Priya", category: "friends" as const },
    { name: "James Lee", category: "work" as const },
    { name: "Sophie", category: "friends" as const },
  ];

  const statuses: Array<"healthy" | "attention" | "dormant" | "wilted"> = [
    "healthy",
    "healthy",
    "healthy",
    "attention",
    "attention",
    "dormant",
    "wilted",
  ];

  return names.map((contact, i) => ({
    id: `contact-${i}`,
    ...contact,
    status: statuses[i % statuses.length],
    size: 0.3 + Math.random() * 0.7,
    lastContact: `${Math.floor(Math.random() * 30) + 1} days ago`,
    closeness: 0.3 + Math.random() * 0.7, // High = thick branch
    recency: Math.random(), // High = shorter branch (more recent)
  }));
};

export function GroveDashboard({ onContactSelect, onViewAnalytics, onViewSchedule }: GroveDashboardProps) {
  const [contacts] = useState<Contact[]>(generateContacts());
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const filters = ["All", "Family", "Friends", "Work", "Dormant", "Priority"];

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === "All") return true;
    if (activeFilter === "Dormant") return contact.status === "dormant" || contact.status === "wilted";
    if (activeFilter === "Priority") return contact.status === "attention" || contact.status === "wilted";
    return contact.category === activeFilter.toLowerCase();
  });

  // Layout contacts in a tree-like pattern with variable branch lengths
  const layoutContacts = (contacts: Contact[]) => {
    const centerX = 500;
    const centerY = 350;
    const categoryAngles = { 
      family: -70,
      friends: 0, 
      work: 70 
    };

    return contacts.map((contact, i) => {
      const baseAngle = categoryAngles[contact.category];
      const spread = 35;
      const angleOffset = (i % 5) * spread - spread * 2;
      const angle = ((baseAngle + angleOffset) * Math.PI) / 180;
      
      // Distance based on recency - more recent = shorter (closer)
      const baseDistance = 120;
      const maxDistance = 280;
      const distance = baseDistance + (1 - (contact.recency || 0.5)) * (maxDistance - baseDistance);

      return {
        ...contact,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        rotation: angle * (180 / Math.PI) + 90,
        branchLength: distance,
      };
    });
  };

  const layoutedContacts = layoutContacts(filteredContacts);
  const dormantCount = contacts.filter((c) => c.status === "dormant" || c.status === "wilted").length;
  const attentionCount = contacts.filter((c) => c.status === "attention").length;

  const handleLeafClick = (contact: Contact) => {
    setSelectedContact(contact);
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

  return (
    <>
      <div className="flex h-full bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        {/* Main Grove Visualization */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-primary">Your Grove</h2>
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
          <div className="flex-1 relative overflow-hidden">
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

            <svg className="w-full h-full" style={{ minHeight: '700px' }}>
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
              <circle cx="500" cy="350" r="60" fill="url(#water-glow)" />
              
              {/* Watering can illustration */}
              <g transform="translate(500, 350)">
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
                y="405" 
                textAnchor="middle" 
                fill="currentColor" 
                fontSize="13" 
                fontWeight="600"
                opacity="0.8"
              >
                You
              </text>

              {/* Branch + Leaf pairs - render together to ensure 1:1 correspondence */}
              {layoutedContacts.map((contact) => {
                // Branch properties based on relationship
                const thickness = 1 + (contact.closeness || 0.5) * 5; // 1-6px
                const opacity = 0.3 + (contact.closeness || 0.5) * 0.4; // 0.3-0.7 for better visibility
                
                // Calculate branch endpoint
                // Branch should extend all the way to the leaf's position
                const angle = Math.atan2(contact.y - 350, contact.x - 500);
                
                return (
                  <g key={contact.id}>
                    {/* Branch line from "You" to this contact's leaf */}
                    <line
                      x1="500"
                      y1="350"
                      x2={contact.x}
                      y2={contact.y}
                      stroke="#78350f"
                      strokeWidth={thickness}
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
                      onClick={() => handleLeafClick(contact)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Enhanced Legend */}
            <div className="absolute bottom-6 left-6">
              <Card className="p-4 space-y-3 bg-card/90 backdrop-blur-md shadow-xl">
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
                  <p>Branch thickness = closeness</p>
                  <p>Distance from center = recency</p>
                  <p>Leaf size = interaction frequency</p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Panel - Today's Prompts & Dormant Branches */}
        <div className="w-80 border-l bg-card/30 backdrop-blur-sm flex flex-col">
          <ScrollArea className="flex-1">
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
                  {attentionCount > 0 && (
                    <Card className="p-4 border-l-4 hover:shadow-md transition-shadow cursor-pointer" style={{ borderLeftColor: '#f59e0b' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#f59e0b' }} />
                        <div className="flex-1">
                          <p className="text-foreground" style={{ fontSize: '0.875rem' }}>
                            <strong>Sarah</strong> mentioned her job interview 2 weeks ago
                          </p>
                          <p className="text-muted-foreground mt-1" style={{ fontSize: '0.75rem' }}>
                            Ask how it went
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  <Card className="p-4 border-l-4 border-primary hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <p className="text-foreground" style={{ fontSize: '0.875rem' }}>
                          <strong>Mom's</strong> birthday is in 3 days
                        </p>
                        <p className="text-muted-foreground mt-1" style={{ fontSize: '0.75rem' }}>
                          Plan something special
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 border-l-4 hover:shadow-md transition-shadow cursor-pointer" style={{ borderLeftColor: '#10b981' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: '#10b981' }} />
                      <div className="flex-1">
                        <p className="text-foreground" style={{ fontSize: '0.875rem' }}>
                          <strong>Mike</strong> shared good news last week
                        </p>
                        <p className="text-muted-foreground mt-1" style={{ fontSize: '0.75rem' }}>
                          Follow up and celebrate
                        </p>
                      </div>
                    </div>
                  </Card>
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
          </ScrollArea>
        </div>
      </div>

      {/* Relationship Stats Modal */}
      <RelationshipStatsModal
        contact={selectedContact}
        onClose={handleCloseModal}
        onSendMessage={handleSendMessage}
      />
    </>
  );
}
