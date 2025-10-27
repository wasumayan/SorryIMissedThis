import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { 
  ArrowLeft, 
  Shield, 
  MessageCircle, 
  Bell, 
  Palette, 
  Trash2,
  CheckCircle,
  Moon,
  Sun
} from "lucide-react";

interface SettingsProps {
  onBack: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  season?: "spring" | "summer" | "autumn" | "winter";
  onSeasonChange?: (season: "spring" | "summer" | "autumn" | "winter") => void;
}

export function Settings({ 
  onBack, 
  darkMode, 
  onToggleDarkMode,
  season = "summer",
  onSeasonChange 
}: SettingsProps) {
  const [localOnly, setLocalOnly] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [weeklyReflection, setWeeklyReflection] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-secondary/10 to-accent/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2>Settings</h2>
          <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
            Manage your preferences and integrations
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Privacy Center */}
          <Card className="p-6 border-2 border-primary/20 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3>Privacy Center</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="local-only" className="cursor-pointer">
                    Local-Only Mode
                  </Label>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                    All data stays on your device. No cloud sync or external storage.
                  </p>
                </div>
                <Switch
                  id="local-only"
                  checked={localOnly}
                  onCheckedChange={setLocalOnly}
                />
              </div>

              <Separator />

              <div>
                <h4 className="mb-3">Data Encryption</h4>
                <div className="bg-secondary/30 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p style={{ fontSize: '0.875rem' }}>
                      Your messages and analysis are encrypted at rest using AES-256.
                    </p>
                    <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                      Encryption key is derived from your device and never leaves your system.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-3">Danger Zone</h4>
                <div className="border-2 border-destructive/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4>Purge All Data</h4>
                      <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                        Permanently delete all messages, contacts, and analysis from this device.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <Button variant="destructive" className="w-full">
                    Purge All Data
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Platform Integrations */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <MessageCircle className="w-6 h-6 text-primary" />
              <h3>Platform Integrations</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      Connected via Web protocol
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </Badge>
                  <Button variant="outline" size="sm">
                    Disconnect
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Telegram</p>
                    <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      Not connected
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">iMessage</p>
                    <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      macOS only - Coming soon
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-primary" />
              <h3>Notifications & Reminders</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="daily-digest" className="cursor-pointer">
                    Daily Digest
                  </Label>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                    Morning summary of suggested prompts and dormant connections
                  </p>
                </div>
                <Switch
                  id="daily-digest"
                  checked={dailyDigest}
                  onCheckedChange={setDailyDigest}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="weekly-reflection" className="cursor-pointer">
                    Weekly Reflection
                  </Label>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                    Sunday evening growth rings summary and insights
                  </p>
                </div>
                <Switch
                  id="weekly-reflection"
                  checked={weeklyReflection}
                  onCheckedChange={setWeeklyReflection}
                />
              </div>
            </div>
          </Card>

          {/* Appearance */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-6 h-6 text-primary" />
              <h3>Appearance</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="dark-mode" className="cursor-pointer flex items-center gap-2">
                    {darkMode ? (
                      <>
                        <Moon className="w-4 h-4" />
                        Dark Mode
                      </>
                    ) : (
                      <>
                        <Sun className="w-4 h-4" />
                        Light Mode
                      </>
                    )}
                  </Label>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                    Switch between light and dark theme
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={onToggleDarkMode}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="reduced-motion" className="cursor-pointer">
                    Reduced Motion
                  </Label>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: '0.875rem' }}>
                    Minimize animations and transitions
                  </p>
                </div>
                <Switch
                  id="reduced-motion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                />
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">Grove Season Theme</Label>
                <p className="text-muted-foreground mb-4" style={{ fontSize: '0.875rem' }}>
                  Change the visual appearance of your grove based on seasons
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "spring" as const, label: "Spring", emoji: "🌸", color: "#22c55e" },
                    { value: "summer" as const, label: "Summer", emoji: "☀️", color: "#10b981" },
                    { value: "autumn" as const, label: "Autumn", emoji: "🍂", color: "#eab308" },
                    { value: "winter" as const, label: "Winter", emoji: "❄️", color: "#059669" },
                  ].map((seasonOption) => (
                    <Button
                      key={seasonOption.value}
                      variant={season === seasonOption.value ? "default" : "outline"}
                      size="sm"
                      className="flex-col h-auto py-3"
                      onClick={() => onSeasonChange?.(seasonOption.value)}
                    >
                      <span style={{ fontSize: "1.5rem" }}>{seasonOption.emoji}</span>
                      <span style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                        {seasonOption.label}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="p-6">
            <h3 className="mb-4">About SIMT</h3>
            <div className="space-y-3 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
              <p>
                <strong>Sorry I Missed This</strong> is a privacy-first assistant designed to help you
                nurture relationships through gentle reminders and thoughtful prompts.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Version 1.0.0</Badge>
                <Badge variant="outline">Desktop Beta</Badge>
              </div>
              <p className="pt-3">
                Made with care for meaningful connections.
              </p>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
