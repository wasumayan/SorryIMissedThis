import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  ArrowLeft,
  Shield,
  MessageCircle,
  Bell,
  Palette,
  Trash2,
  CheckCircle,
  Moon,
  Sun,
  Upload,
  FileText,
  Database,
  Settings as SettingsIcon
} from "lucide-react";
import { apiClient, User } from "../services/api";

interface SettingsProps {
  user: User;
  onBack: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  season?: "spring" | "summer" | "autumn" | "winter";
  onSeasonChange?: (season: "spring" | "summer" | "autumn" | "winter") => void;
}

export function Settings({
  user,
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
  
  // Chat tracking preferences
  const [chatTrackingMode, setChatTrackingMode] = useState<'all' | 'recent' | 'selected'>(
    user.preferences?.chatTracking?.mode || 'all'
  );
  const [maxChats, setMaxChats] = useState<number>(
    user.preferences?.chatTracking?.maxChats || 50
  );
  const [savingChatTracking, setSavingChatTracking] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [chatDisplayName, setChatDisplayName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadStatus('idle');
      setUploadError('');
    }
  };

  const handleChatTrackingSave = async () => {
    setSavingChatTracking(true);
    try {
      // Build chatTracking object, only including relevant fields
      const chatTracking: {
        mode: 'all' | 'recent' | 'selected';
        maxChats?: number;
        selectedChatGuids?: string[];
      } = {
        mode: chatTrackingMode
      };
      
      if (chatTrackingMode === 'recent' && maxChats !== undefined) {
        chatTracking.maxChats = maxChats;
      }
      
      if (chatTrackingMode === 'selected') {
        // For 'selected' mode, we need selectedChatGuids
        // If not set, use empty array (user needs to select chats)
        chatTracking.selectedChatGuids = []; // TODO: Add UI to select chats in Settings
      }
      
      await apiClient.updateChatTrackingPreferences(user.id, chatTracking);
      // Show success message
      setTimeout(() => setSavingChatTracking(false), 1000);
    } catch (error) {
      console.error('Error saving chat tracking preferences:', error);
      setSavingChatTracking(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    if (!chatDisplayName.trim()) {
      setUploadError('Please enter your name as it appears in the chat');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(50);
    setUploadError('');

    try {
      const response = await apiClient.uploadTranscript(
        uploadFile,
        user.id,
        chatDisplayName.trim()
      );

      if (response.success) {
        setUploadStatus('success');
        setUploadProgress(100);

        // Reset form after 2 seconds
        setTimeout(() => {
          setUploadFile(null);
          setChatDisplayName('');
          setUploadProgress(0);
          setUploadStatus('idle');
        }, 2000);
      } else {
        setUploadStatus('error');
        setUploadError(response.error || 'Upload failed. Please try again.');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadError('Upload failed. Please check your connection and try again.');
      console.error('Upload error:', err);
    }
  };

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

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
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
                    All message content stays on your device. Only analysis and metadata are synced to cloud.
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

          {/* Chat Tracking Preferences */}
          <Card className="p-6 border-2 border-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-6 h-6 text-primary" />
              <div>
                <h3>iMessage Chat Tracking</h3>
                <p className="text-muted-foreground text-sm">
                  Control which conversations are tracked to save compute and storage
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Tracking Mode</Label>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary/30"
                    onClick={() => setChatTrackingMode('all')}>
                    <input
                      type="radio"
                      name="tracking-mode"
                      checked={chatTrackingMode === 'all'}
                      onChange={() => setChatTrackingMode('all')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Track All Chats</Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        Keep track of all iMessage conversations. Uses more storage and compute.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary/30"
                    onClick={() => setChatTrackingMode('recent')}>
                    <input
                      type="radio"
                      name="tracking-mode"
                      checked={chatTrackingMode === 'recent'}
                      onChange={() => setChatTrackingMode('recent')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Track Most Recent</Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        Only track the most recent conversations to save resources.
                      </p>
                      {chatTrackingMode === 'recent' && (
                        <div className="mt-3">
                          <Label htmlFor="max-chats" className="text-sm">Number of chats to track:</Label>
                          <Input
                            id="max-chats"
                            type="number"
                            min="1"
                            max="200"
                            value={maxChats}
                            onChange={(e) => setMaxChats(parseInt(e.target.value) || 50)}
                            className="mt-1 w-32"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary/30"
                    onClick={() => setChatTrackingMode('selected')}>
                    <input
                      type="radio"
                      name="tracking-mode"
                      checked={chatTrackingMode === 'selected'}
                      onChange={() => setChatTrackingMode('selected')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">Track Selected Chats Only</Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        Manually select which conversations to track. Most efficient option.
                      </p>
                      {chatTrackingMode === 'selected' && (
                        <p className="text-muted-foreground text-xs mt-2">
                          You can select chats during sync or from the Grove view.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleChatTrackingSave}
                disabled={savingChatTracking}
                className="w-full"
              >
                {savingChatTracking ? 'Saving...' : 'Save Chat Tracking Preferences'}
              </Button>
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
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">iMessage</p>
                    <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      Connected via Photon SDK
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
            </div>
          </Card>

          {/* iMessage Sync */}
          <Card className="p-6 border-2 border-accent/30">
            <div className="flex items-center gap-3 mb-6">
              <MessageCircle className="w-6 h-6 text-primary" />
              <div>
                <h3>Sync iMessage Conversations</h3>
                <p className="text-muted-foreground text-sm">
                  Sync your iMessage conversations to expand your grove
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {uploadError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-destructive text-sm">{uploadError}</p>
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <p className="text-primary text-sm">Upload successful! Your grove has been updated.</p>
                </div>
              )}

              {uploadStatus === 'idle' || uploadStatus === 'error' ? (
                <>
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center">
                    <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-foreground mb-2">Sync iMessage Conversations</p>
                    <p className="text-muted-foreground text-sm mb-4">
                      Connect to iMessage and sync your conversations. Messages are stored locally on your device for privacy.
                    </p>
                      <Button
                        type="button"
                      variant="default"
                      onClick={async () => {
                        try {
                          setUploadStatus('uploading');
                          setUploadProgress(50);
                          // Connect to iMessage
                          await apiClient.connectiMessage();
                          // Sync conversations
                          const syncResult = await apiClient.synciMessage(user.id);
                          if (syncResult.success) {
                            setUploadStatus('success');
                            setUploadProgress(100);
                            setTimeout(() => {
                              setUploadProgress(0);
                              setUploadStatus('idle');
                            }, 2000);
                          } else {
                            setUploadStatus('error');
                            setUploadError(syncResult.error || 'Failed to sync conversations');
                          }
                        } catch (error) {
                          setUploadStatus('error');
                          setUploadError('Failed to sync. Please check your iMessage connection.');
                          console.error('Sync error:', error);
                        }
                      }}
                      >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Sync iMessage
                      </Button>
                  </div>

                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Processing your chat...</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
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
    </div>
  );
}
