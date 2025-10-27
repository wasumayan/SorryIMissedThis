import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Slider } from "./ui/slider";
import { 
  ArrowLeft, 
  MessageCircle, 
  ExternalLink, 
  Sparkles, 
  Info,
  Send,
  CheckCircle
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "contact";
  text: string;
  timestamp: string;
  platform: "whatsapp" | "telegram";
}

interface ConversationViewProps {
  contactName: string;
  onBack: () => void;
}

const mockMessages: Message[] = [
  {
    id: "1",
    sender: "contact",
    text: "Hey! How are you doing?",
    timestamp: "2 weeks ago",
    platform: "whatsapp",
  },
  {
    id: "2",
    sender: "user",
    text: "Hey! I'm good, just been super busy with work. How about you?",
    timestamp: "2 weeks ago",
    platform: "whatsapp",
  },
  {
    id: "3",
    sender: "contact",
    text: "Same here! Actually, I have my big job interview next week. Pretty nervous about it.",
    timestamp: "2 weeks ago",
    platform: "whatsapp",
  },
  {
    id: "4",
    sender: "user",
    text: "Oh wow, that's exciting! You'll do great. Which company is it?",
    timestamp: "2 weeks ago",
    platform: "whatsapp",
  },
  {
    id: "5",
    sender: "contact",
    text: "It's with TechCorp! Dream job honestly. Fingers crossed 🤞",
    timestamp: "2 weeks ago",
    platform: "whatsapp",
  },
];

export function ConversationView({ contactName, onBack }: ConversationViewProps) {
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [tone, setTone] = useState([50]); // 0-100 scale
  const [sent, setSent] = useState(false);

  const prompts = [
    {
      text: "Hey Sarah! I've been thinking about you – how did the TechCorp interview go? I hope it went well! 🤞",
      reason: "Follow up on interview mentioned 2 weeks ago",
    },
    {
      text: "Hi! Just wanted to check in – how have you been? Any updates on the job front?",
      reason: "Gentle check-in with context",
    },
    {
      text: "Hey! Hope you're doing well. Been meaning to catch up – free for a call this week?",
      reason: "Suggest reconnection",
    },
  ];

  const getToneName = (value: number) => {
    if (value < 33) return "Formal";
    if (value < 66) return "Friendly";
    return "Playful";
  };

  const handleOpenInPlatform = () => {
    setSent(true);
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2>{contactName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              Last contact: 2 weeks ago
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation Thread */}
        <div className="flex-1 flex flex-col border-r">
          {/* AI Summary */}
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/20 border-b p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="mb-2">Conversation Summary</h4>
                <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                  Last spoke <strong>2 weeks ago</strong>. Sarah mentioned she had an important{" "}
                  <strong>job interview at TechCorp</strong>. She seemed nervous but excited about it.
                  This would be a good time to follow up and show support.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">Reciprocity:</div>
                    <div className="flex gap-0.5">
                      <div className="w-2 h-4 bg-gradient-to-t from-primary to-primary/70 rounded-sm" />
                      <div className="w-2 h-4 bg-gradient-to-t from-primary to-primary/70 rounded-sm" />
                      <div className="w-2 h-4 bg-gradient-to-t from-primary to-primary/70 rounded-sm" />
                      <div className="w-2 h-4 bg-muted rounded-sm" />
                      <div className="w-2 h-4 bg-muted rounded-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 max-w-3xl">
              {mockMessages.map((message) => (
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
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Prompt Composer */}
        <div className="w-[480px] flex flex-col bg-card/30">
          <div className="border-b p-4">
            <h3>Compose Message</h3>
            <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
              AI-suggested prompts tailored to your conversation
            </p>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {/* Suggested Prompts */}
              <div className="space-y-3">
                <label>Suggested Prompts</label>
                {prompts.map((prompt, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-all border-2 ${
                      selectedPrompt === index
                        ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg"
                        : "border-transparent hover:border-primary/30 hover:shadow-md"
                    }`}
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
                  </Card>
                ))}
              </div>

              {/* Custom Edit */}
              <div className="space-y-2">
                <label>Edit Your Message</label>
                <Textarea
                  value={customPrompt || prompts[selectedPrompt].text}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                  placeholder="Customize your message..."
                  className="resize-none"
                />
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
              <Card className="p-4 bg-gradient-to-br from-accent/20 to-secondary/30 border-2 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="mb-2">Why this prompt?</h4>
                    <div className="space-y-2 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">2 weeks</Badge>
                        <span>since last reply</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-accent/30 text-foreground border-accent/50">Context</Badge>
                        <span>Interview mentioned in conversation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-secondary text-foreground border-secondary">Timing</Badge>
                        <span>Natural follow-up window</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="border-t p-4 space-y-2 bg-card">
            {sent ? (
              <div className="flex items-center justify-center gap-2 py-3 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span>Message ready in WhatsApp!</span>
              </div>
            ) : (
              <>
                <Button onClick={handleOpenInPlatform} className="w-full gap-2" size="lg">
                  <ExternalLink className="w-4 h-4" />
                  Open in WhatsApp
                </Button>
                <p className="text-center text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                  Your message will be pre-filled in WhatsApp
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
