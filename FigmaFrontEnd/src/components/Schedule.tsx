import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Calendar } from "./ui/calendar";
import { ArrowLeft, Calendar as CalendarIcon, Clock, User, Droplet } from "lucide-react";

interface ScheduleProps {
  onBack: () => void;
}

export function Schedule({ onBack }: ScheduleProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const scheduledPrompts = [
    {
      id: "1",
      contact: "Tom",
      time: "This Evening",
      prompt: "Check in about his new project",
      status: "pending" as const,
    },
    {
      id: "2",
      contact: "Priya",
      time: "Tomorrow, 10:00 AM",
      prompt: "Follow up on weekend plans",
      status: "pending" as const,
    },
    {
      id: "3",
      contact: "Uncle John",
      time: "Friday, 3:00 PM",
      prompt: "Birthday wishes and catch up",
      status: "pending" as const,
    },
  ];

  const catchUpSuggestions = [
    {
      contact: "Lisa",
      lastContact: "3 weeks ago",
      unreadMessages: 0,
      priority: "medium" as const,
    },
    {
      contact: "David Park",
      lastContact: "1 month ago",
      unreadMessages: 2,
      priority: "high" as const,
    },
    {
      contact: "Sophie",
      lastContact: "2 weeks ago",
      unreadMessages: 0,
      priority: "low" as const,
    },
  ];

  const priorityColors = {
    high: "#f87171",
    medium: "#fbbf24",
    low: "#94a3b8",
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-secondary/10 to-accent/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2>Schedule & Catch-Up</h2>
          <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
            Plan your outreach and review conversations
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Calendar & Scheduled */}
        <div className="flex-1 flex flex-col border-r">
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl space-y-6">
              {/* Calendar */}
              <Card className="p-6">
                <h3 className="mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Calendar
                </h3>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md"
                  />
                </div>
              </Card>

              {/* Scheduled Prompts */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Scheduled Prompts
                </h3>
                <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                  Reminders you've queued for later
                </p>

                <div className="space-y-3 mt-4">
                  {scheduledPrompts.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-primary" />
                            <span className="font-medium">{item.contact}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.time}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                            {item.prompt}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button size="sm" className="gap-1">
                            <Droplet className="w-3 h-3" />
                            Water Now
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {scheduledPrompts.length === 0 && (
                    <Card className="p-8 text-center">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No scheduled prompts</p>
                      <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                        Queue prompts from the Grove to schedule them
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right: Catch-Up Mode */}
        <div className="w-96 flex flex-col bg-card/30">
          <div className="border-b p-4">
            <h3>Catch-Up Mode</h3>
            <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
              Quick navigation through conversations
            </p>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                  Review conversations that need attention and catch up quickly with context-aware summaries
                </p>
              </div>

              <div className="space-y-3 mt-6">
                {catchUpSuggestions.map((item, index) => (
                  <Card
                    key={index}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4"
                    style={{ borderLeftColor: priorityColors[item.priority] }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.contact}</p>
                          <p className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                            Last contact: {item.lastContact}
                          </p>
                        </div>
                        {item.unreadMessages > 0 && (
                          <Badge variant="secondary">{item.unreadMessages} unread</Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          Skip
                        </Button>
                        <Button size="sm" className="flex-1 gap-1">
                          <Droplet className="w-3 h-3" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Session Info */}
              <Card className="p-4 bg-primary/5 border-primary/20 mt-6">
                <div className="space-y-2">
                  <p className="text-primary font-medium" style={{ fontSize: '0.875rem' }}>
                    Catch-Up Session
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    We'll guide you through {catchUpSuggestions.length} conversations that could use attention,
                    providing context and suggested prompts for each.
                  </p>
                  <Button className="w-full mt-3">
                    Start Session ({catchUpSuggestions.length} contacts)
                  </Button>
                </div>
              </Card>

              {/* Privacy Notice */}
              <div className="p-4 bg-secondary/30 rounded-lg mt-4">
                <p className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                  <strong>Privacy:</strong> Calendar sync is disabled by default. Enable in Settings
                  to sync reminders with your calendar app.
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
