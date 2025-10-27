import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, MessageCircle, TrendingUp, Heart, Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

interface Contact {
  id: string;
  name: string;
  category: "family" | "friends" | "work";
  status: "healthy" | "attention" | "dormant" | "wilted";
  size: number;
  lastContact: string;
  messageCount?: number;
  reciprocityScore?: number;
  daysConnected?: number;
}

interface RelationshipStatsModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSendMessage: () => void;
  onWaterContact?: () => void;
}

export function RelationshipStatsModal({ 
  contact, 
  onClose, 
  onSendMessage,
  onWaterContact 
}: RelationshipStatsModalProps) {
  if (!contact) return null;

  // Generate mock stats
  const stats = {
    messageCount: contact.messageCount || Math.floor(Math.random() * 200) + 50,
    reciprocityScore: contact.reciprocityScore || Math.floor(Math.random() * 40) + 60,
    daysConnected: contact.daysConnected || Math.floor(Math.random() * 500) + 100,
    lastTopics: ["Weekend plans", "Work updates", "Family news"],
    responseTime: "Usually replies in 2-4 hours",
    connectionStrength: contact.status === "healthy" ? "Strong" : 
                        contact.status === "attention" ? "Good" :
                        contact.status === "dormant" ? "Fading" : "Weak",
  };

  // Generate contextual prompt
  const prompts = {
    healthy: [
      `Share a funny meme ${contact.name} would love`,
      `Ask about their weekend plans`,
      `Send appreciation for recent conversation`,
    ],
    attention: [
      `Follow up on what ${contact.name} mentioned last time`,
      `Check in on how things are going`,
      `Share something that reminded you of them`,
    ],
    dormant: [
      `Hey ${contact.name}! It's been a while - how have you been?`,
      `Saw something that made me think of you...`,
      `Would love to catch up soon!`,
    ],
    wilted: [
      `${contact.name}, I've been thinking about you. Hope all is well!`,
      `It's been too long! Coffee/call soon?`,
      `Missing our chats - let's reconnect!`,
    ],
  };

  const currentPrompts = prompts[contact.status];
  
  // Health-based colors instead of category colors
  const healthColors = {
    healthy: "#10b981",
    attention: "#f59e0b",
    dormant: "#ec4899",
    wilted: "#78350f",
  };
  
  const statusColor = healthColors[contact.status];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-2xl"
        >
          <Card className="overflow-hidden bg-card/95 backdrop-blur-xl shadow-2xl">
            {/* Header with plant illustration */}
            <div 
              className="relative p-6 pb-20"
              style={{
                background: `linear-gradient(135deg, ${statusColor}15 0%, ${statusColor}05 100%)`,
              }}
            >
              {/* Decorative plant elements */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 opacity-20">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.6 }}
                  >
                    <svg width="40" height="60" viewBox="0 0 40 60">
                      <path
                        d="M20 60 L20 20 Q20 10 25 5 Q20 10 20 0"
                        fill="none"
                        stroke={statusColor}
                        strokeWidth="2"
                      />
                      <ellipse
                        cx="25"
                        cy="15"
                        rx="8"
                        ry="12"
                        fill={statusColor}
                        opacity="0.6"
                      />
                    </svg>
                  </motion.div>
                ))}
              </div>

              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2>{contact.name}</h2>
                    <Badge 
                      variant="outline"
                      className="text-xs"
                    >
                      {contact.category}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Connection Strength: <strong>{stats.connectionStrength}</strong>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center border-2" style={{ borderColor: `${statusColor}30` }}>
                  <MessageCircle className="w-6 h-6 mx-auto mb-2" style={{ color: statusColor }} />
                  <div className="text-2xl font-semibold">{stats.messageCount}</div>
                  <div className="text-muted-foreground text-sm mt-1">Messages</div>
                </Card>

                <Card className="p-4 text-center border-2" style={{ borderColor: `${statusColor}30` }}>
                  <Heart className="w-6 h-6 mx-auto mb-2" style={{ color: statusColor }} />
                  <div className="text-2xl font-semibold">{stats.reciprocityScore}%</div>
                  <div className="text-muted-foreground text-sm mt-1">Reciprocity</div>
                </Card>

                <Card className="p-4 text-center border-2" style={{ borderColor: `${statusColor}30` }}>
                  <Calendar className="w-6 h-6 mx-auto mb-2" style={{ color: statusColor }} />
                  <div className="text-2xl font-semibold">{stats.daysConnected}</div>
                  <div className="text-muted-foreground text-sm mt-1">Days</div>
                </Card>
              </div>

              {/* Recent Topics */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <h4>Recent Topics</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.lastTopics.map((topic, i) => (
                    <Badge key={i} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Response Pattern */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Response Pattern</span>
                  <span className="text-sm">{stats.responseTime}</span>
                </div>
                <Progress value={stats.reciprocityScore} className="h-2" />
              </div>

              {/* AI Prompts */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4" style={{ color: statusColor }} />
                  <h4>Suggested Messages</h4>
                </div>
                <div className="space-y-2">
                  {currentPrompts.map((prompt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card 
                        className="p-3 hover:shadow-md transition-all cursor-pointer group"
                        onClick={onSendMessage}
                        style={{
                          borderLeft: `3px solid ${statusColor}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm flex-1">{prompt}</p>
                          <Send className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={onSendMessage} 
                  className="flex-1"
                  style={{
                    backgroundColor: statusColor,
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Open in WhatsApp
                </Button>
                {(contact.status === "dormant" || contact.status === "wilted" || contact.status === "attention") && onWaterContact && (
                  <Button 
                    onClick={() => {
                      onWaterContact();
                      onClose();
                    }}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Water
                  </Button>
                )}
                <Button variant="outline" onClick={onClose}>
                  Maybe Later
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
