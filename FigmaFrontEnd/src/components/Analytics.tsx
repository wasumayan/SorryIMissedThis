import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { ArrowLeft, TrendingUp, Users, MessageSquare, Heart } from "lucide-react";
import { apiClient, User, AnalyticsOverview, TrendsData } from "../services/api";

interface AnalyticsProps {
  user: User;
  onBack: () => void;
}

export function Analytics({ user, onBack }: AnalyticsProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);

        // Fetch overview
        const overviewResponse = await apiClient.getAnalyticsOverview(user.id, period);
        if (overviewResponse.success && overviewResponse.data) {
          setOverview(overviewResponse.data.overview);
        }

        // Fetch trends
        const trendsResponse = await apiClient.getTrends(user.id, period);
        if (trendsResponse.success && trendsResponse.data) {
          setTrends(trendsResponse.data.trends);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [user.id, period]);

  const weeks = overview?.weeklyActivity || [];
  const maxMessages = Math.max(...weeks.map((w) => w.messages), 1);

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

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Stats Cards */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          ) : overview ? (
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
                    <h3 className="mt-1">{overview.conversations.totalMessages}</h3>
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
                      Avg Response Time
                    </p>
                    <h3 className="mt-1">{overview.conversations.avgResponseTime}h</h3>
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
                    <h3 className="mt-1">{overview.contacts.total}</h3>
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
                      Conversations
                    </p>
                    <h3 className="mt-1 text-[#10b981]">{overview.conversations.totalConversations}</h3>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {/* Growth Rings Visualization */}
          <Card className="p-6">
            <h3 className="mb-6">Weekly Activity Rings</h3>
            {weeks.length > 0 ? (
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
                    <g key={week._id.week}>
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
                        Week {week._id.week}
                      </text>
                    </g>
                  );
                })}
                {/* Center */}
                <circle cx="200" cy="200" r="35" fill="var(--primary)" opacity="0.1" />
                <text x="200" y="200" textAnchor="middle" fill="var(--foreground)" fontSize="14" fontWeight="600" dy="5">
                  {weeks.length} {weeks.length === 1 ? 'Week' : 'Weeks'}
                </text>
              </svg>
            </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No activity data yet. Upload more conversations to see your growth rings!</p>
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Ring intensity = message frequency</span>
              </div>
            </div>
          </Card>

          {/* Highlights */}
          {trends && (
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
                  {trends.revivedConnections.slice(0, 2).map((contact, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span style={{ fontSize: '0.875rem' }}>{contact.name}</span>
                      <span className="text-[#10b981]" style={{ fontSize: '0.875rem' }}>
                        {contact.metrics.totalMessages} msgs
                      </span>
                    </div>
                  ))}
                  {trends.revivedConnections.length === 0 && (
                    <p className="text-muted-foreground text-sm">No revived connections yet</p>
                  )}
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-[#fbbf24]">
                <h4 className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-[#fbbf24]" />
                  Health Breakdown
                </h4>
                <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                  Relationship health distribution
                </p>
                <div className="space-y-2">
                  {trends.healthTrends.slice(0, 2).map((trend, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span style={{ fontSize: '0.875rem' }} className="capitalize">{trend._id}</span>
                      <span className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                        {trend.count} contacts
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-primary">
                <h4 className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-primary" />
                  Communication Trends
                </h4>
                <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                  Recent communication patterns
                </p>
                <div className="space-y-2">
                  {trends.communicationTrends.slice(0, 2).map((trend, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span style={{ fontSize: '0.875rem' }}>
                        {new Date(trend._id.year, trend._id.month - 1).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-primary" style={{ fontSize: '0.875rem' }}>
                        {trend.totalMessages} msgs
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

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
    </div>
  );
}
