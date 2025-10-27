import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { ArrowLeft, TrendingUp, Users, MessageSquare, Heart, Calendar } from "lucide-react";

interface AnalyticsProps {
  onBack: () => void;
}

export function Analytics({ onBack }: AnalyticsProps) {
  const weeks = [
    { week: "Week 1", messages: 45, reciprocity: 0.8, topics: 12 },
    { week: "Week 2", messages: 52, reciprocity: 0.85, topics: 14 },
    { week: "Week 3", messages: 38, reciprocity: 0.75, topics: 10 },
    { week: "Week 4", messages: 48, reciprocity: 0.9, topics: 13 },
  ];

  const maxMessages = Math.max(...weeks.map((w) => w.messages));

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-secondary/10 to-accent/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2>Growth Rings</h2>
          <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
            Your relationship health over time
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6 border-2 hover:shadow-lg transition-shadow" style={{ borderColor: '#06b6d420' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Total Messages
                  </p>
                  <h3 className="mt-1">183</h3>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 hover:shadow-lg transition-shadow" style={{ borderColor: '#10b98120' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10b981] to-[#10b981]/50 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Avg Reciprocity
                  </p>
                  <h3 className="mt-1">83%</h3>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 hover:shadow-lg transition-shadow" style={{ borderColor: '#8b5cf620' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#8b5cf6]/50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Active Contacts
                  </p>
                  <h3 className="mt-1">15</h3>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#fbbf24]" />
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    This Week
                  </p>
                  <h3 className="mt-1 text-[#10b981]">+12%</h3>
                </div>
              </div>
            </Card>
          </div>

          {/* Growth Rings Visualization */}
          <Card className="p-6">
            <h3 className="mb-6">Weekly Activity Rings</h3>
            <div className="flex items-center justify-center py-8">
              <svg width="400" height="400" viewBox="0 0 400 400">
                {/* Concentric circles representing weeks */}
                {weeks.map((week, index) => {
                  const radius = 60 + index * 40;
                  const circumference = 2 * Math.PI * radius;
                  const intensity = week.messages / maxMessages;
                  const strokeWidth = 25;
                  const offset = circumference * (1 - intensity);

                  return (
                    <g key={week.week}>
                      {/* Background ring */}
                      <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth={strokeWidth}
                        opacity="0.2"
                      />
                      {/* Activity ring */}
                      <circle
                        cx="200"
                        cy="200"
                        r={radius}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        transform="rotate(-90 200 200)"
                        opacity={0.7 + intensity * 0.3}
                      />
                      {/* Label */}
                      <text
                        x="200"
                        y={200 - radius - 20}
                        textAnchor="middle"
                        fill="var(--muted-foreground)"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {week.week}
                      </text>
                    </g>
                  );
                })}
                {/* Center */}
                <circle cx="200" cy="200" r="35" fill="var(--primary)" opacity="0.1" />
                <text x="200" y="200" textAnchor="middle" fill="var(--foreground)" fontSize="14" fontWeight="600" dy="5">
                  4 Weeks
                </text>
              </svg>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Ring intensity = message frequency</span>
              </div>
            </div>
          </Card>

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-l-4 border-[#10b981]">
              <h4 className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#10b981]" />
                Revived Connections
              </h4>
              <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                Relationships you've rekindled this month
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Uncle John</span>
                  <span className="text-[#10b981]" style={{ fontSize: '0.875rem' }}>
                    +8 messages
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Rachel</span>
                  <span className="text-[#10b981]" style={{ fontSize: '0.875rem' }}>
                    +5 messages
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-[#fbbf24]">
              <h4 className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#fbbf24]" />
                Needs Attention
              </h4>
              <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                Contacts that would benefit from outreach
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Tom</span>
                  <span className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    23 days
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Priya</span>
                  <span className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    18 days
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-primary">
              <h4 className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-primary" />
                Strong Bonds
              </h4>
              <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                Consistently nurtured relationships
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Mom</span>
                  <span className="text-primary" style={{ fontSize: '0.875rem' }}>
                    95% reciprocity
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.875rem' }}>Sarah</span>
                  <span className="text-primary" style={{ fontSize: '0.875rem' }}>
                    92% reciprocity
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Topic Diversity */}
          <Card className="p-6">
            <h3 className="mb-4">Conversation Topics</h3>
            <p className="text-muted-foreground mb-6" style={{ fontSize: '0.875rem' }}>
              Diversity of conversation themes this month
            </p>
            <div className="space-y-3">
              {[
                { topic: "Work & Career", count: 28, color: "#0d9488" },
                { topic: "Family & Personal", count: 35, color: "#10b981" },
                { topic: "Hobbies & Interests", count: 18, color: "#3b82f6" },
                { topic: "Planning & Events", count: 22, color: "#8b5cf6" },
                { topic: "Casual Check-ins", count: 41, color: "#06b6d4" },
              ].map((item) => (
                <div key={item.topic}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: '0.875rem' }}>{item.topic}</span>
                    <span className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      {item.count} conversations
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.count / 41) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
