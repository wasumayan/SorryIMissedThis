import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Logo } from "./Logo";
import { Shield, MessageCircle, Lock, CheckCircle, Leaf, User as UserIcon } from "lucide-react";
import { apiClient, type User } from "../services/api";

interface OnboardingProps {
  onComplete: (userData?: User) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [imessageConnected, setImessageConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<User | undefined>(undefined);
  const [chatTrackingMode, setChatTrackingMode] = useState<'all' | 'recent' | 'selected'>('all');
  const [maxChats, setMaxChats] = useState(50);
  const [availableChats, setAvailableChats] = useState<Array<{chatId: string; guid?: string; displayName: string; isGroup: boolean}>>([]);
  const [selectedChatGuids, setSelectedChatGuids] = useState<string[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  const totalSteps = 4; // Step 0: Name, Step 1: Connect, Step 2: Chat Selection, Step 3: Welcome
  const progress = ((step + 1) / totalSteps) * 100;

  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Final step - complete onboarding with user data
      onComplete(userData);
    }
  };

  const handleConnectiMessage = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Connect to iMessage - this auto-identifies/creates the user
      // Pass the user's name so we can store it
      const response = await apiClient.connectiMessage(userName);

      if (response.success && response.data) {
        // Store user data and token
        setUserData(response.data.user);
        if (response.data.token) {
          apiClient.setToken(response.data.token);
        }
        setImessageConnected(true);
        
        // Load available chats for selection
        await loadAvailableChats();
        
        nextStep(); // Move to next step
      } else {
        setError(response.error || 'Failed to connect to iMessage. Please ensure the Photon server is running.');
      }
    } catch (error) {
      console.error('iMessage connection error:', error);
      setError('Failed to connect to iMessage. Please ensure the Photon server is running on your Mac.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableChats = async () => {
    setIsLoadingChats(true);
    setError(''); // Clear any previous errors
    try {
      console.log('[DEBUG] Loading available chats...');
      const response = await apiClient.getAvailableChats(200);
      console.log('[DEBUG] getAvailableChats response:', response);
      
      if (response.success && response.data) {
        const chats = response.data.chats || [];
        console.log('[DEBUG] Loaded', chats.length, 'chats');
        setAvailableChats(chats);
        
        if (chats.length === 0) {
          setError('No chats found. Make sure you have iMessage conversations.');
        }
      } else {
        console.error('[ERROR] Failed to load chats:', response.error);
        setError(response.error || 'Failed to load chats. Please try again.');
      }
    } catch (error) {
      console.error('[ERROR] Error loading chats:', error);
      setError('Failed to load chats. Please ensure the Photon server is running.');
    } finally {
      setIsLoadingChats(false);
    }
  };

  const handleSaveChatPreferences = async () => {
    if (!userData) return;
    
    setIsLoading(true);
    setError('');

    try {
      // First, save the chat tracking preferences
      // Build the chatTracking object, filtering out undefined values
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
      
      if (chatTrackingMode === 'selected' && selectedChatGuids !== undefined) {
        chatTracking.selectedChatGuids = selectedChatGuids;
      }
      
      console.log('[DEBUG] Saving chat tracking preferences:', chatTracking);
      
      const response = await apiClient.updateChatTrackingPreferences(
        userData.id,
        chatTracking
      );

      if (!response.success) {
        setError(response.error || 'Failed to save preferences');
        return;
      }

      // Then, sync conversations from iMessage
      console.log('[ONBOARDING] Syncing iMessage conversations...');
      const syncResponse = await apiClient.synciMessage(userData.id);
      
      if (syncResponse.success) {
        console.log('[ONBOARDING] Sync successful:', syncResponse.data);
        console.log('[ONBOARDING] Sync details:', {
          conversations_synced: syncResponse.data?.conversations_synced || 0,
          total_available: syncResponse.data?.total_available || 0,
          tracking_mode: syncResponse.data?.tracking_mode,
          conversation_ids: syncResponse.data?.conversation_ids?.length || 0
        });
        
        if ((syncResponse.data?.conversations_synced || 0) === 0) {
          console.warn('[ONBOARDING] ⚠️ WARNING: Sync returned 0 conversations!');
          console.warn('[ONBOARDING] This could mean:');
          console.warn('[ONBOARDING] - No chats found in iMessage');
          console.warn('[ONBOARDING] - All chats were filtered out');
          console.warn('[ONBOARDING] - Error during sync (check backend logs)');
        }
        nextStep();
      } else {
        // Even if sync fails, continue to next step (user can sync later)
        console.warn('[ONBOARDING] Sync failed, but continuing:', syncResponse.error);
        nextStep();
      }
    } catch (error) {
      console.error('Error saving preferences or syncing:', error);
      // Continue to next step even if there's an error
      setError('Preferences saved, but sync failed. You can sync conversations later from the dashboard.');
      setTimeout(() => {
        nextStep();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const skipStep = () => {
    nextStep();
  };

  const handleFileSelect = (event: any) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadStatus('idle');
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !userData) {
      setError('Please select a file to upload');
      return;
    }

    if (!chatDisplayName.trim()) {
      setError('Please enter your name as it appears in the chat');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(30);
    setError('');

    try {
      const response = await apiClient.uploadTranscript(
        uploadFile,
        userData.id,
        chatDisplayName.trim()
      );

      if (response.success) {
        setUploadStatus('processing');
        setUploadProgress(60);

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500));

        setUploadStatus('complete');
        setUploadProgress(100);

        // Auto-advance after successful upload
        setTimeout(() => {
          nextStep();
        }, 1000);
      } else {
        setUploadStatus('error');
        setError(response.error || 'Upload failed. Please try again.');
      }
    } catch (err) {
      setUploadStatus('error');
      setError('Upload failed. Please check your connection and try again.');
      console.error('Upload error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/10 to-secondary/20 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl p-8 md:p-12 shadow-2xl border-2 border-primary/10">
        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-muted-foreground" style={{ fontSize: '0.875rem' }}>
            Step {step + 1} of {totalSteps}
          </p>
        </div>

        {/* Step 0: Get User's Name */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <Logo className="justify-center mb-6" />
              <h1 className="text-2xl font-bold mb-2">What's your name?</h1>
              <p className="text-muted-foreground">
                We'd like to personalize your experience
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Your Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="user-name"
                    type="text"
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && userName.trim()) {
                        nextStep();
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={nextStep} 
                className="w-full" 
                size="lg"
                disabled={!userName.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Connect to iMessage (Auto-identifies user) */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <Logo className="justify-center mb-6" />
              <h1 className="text-2xl font-bold mb-2">Connect to iMessage</h1>
              <p className="text-muted-foreground">
                We'll automatically identify you from your iMessage account. No password needed!
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {imessageConnected && userData ? (
              <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 flex items-center gap-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <div>
                  <h4 className="text-foreground">Connected as {userData.name || userData.email}</h4>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    iMessage account: {(userData as any).imessage_account || userData.email}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-secondary/50 to-accent/30 rounded-lg p-8 space-y-4">
                <div className="text-center space-y-4">
                  <MessageCircle className="w-16 h-16 mx-auto text-primary" />
                  <div>
                    <h3 className="text-foreground mb-2">Ready to Connect</h3>
                    <p className="text-muted-foreground text-sm">
                      Click below to connect to your iMessage. We'll identify you automatically from your Mac's iMessage account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={handleConnectiMessage} 
                className="w-full" 
                size="lg"
                disabled={isLoading || imessageConnected}
              >
                {isLoading ? (
                  <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : imessageConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Connected
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Connect to iMessage
                  </>
                )}
              </Button>

              {imessageConnected && (
                <Button onClick={nextStep} className="w-full" size="lg">
                  Continue
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Chats to Track */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
              <h2>Select Chats to Track</h2>
            </div>
            <p className="text-muted-foreground">
              Choose which iMessage conversations you'd like SIMT to track and analyze.
            </p>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

                <div className="space-y-4">
              {/* Option 1: All Chats */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  chatTrackingMode === 'all' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setChatTrackingMode('all')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    chatTrackingMode === 'all' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {chatTrackingMode === 'all' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                  <div className="flex-1">
                    <h4 className="text-foreground font-medium">Track All Chats</h4>
                    <p className="text-muted-foreground text-sm">Monitor all your iMessage conversations</p>
                  </div>
                </div>
                      </div>

              {/* Option 2: Recent X Chats */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  chatTrackingMode === 'recent' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setChatTrackingMode('recent')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    chatTrackingMode === 'recent' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {chatTrackingMode === 'recent' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <h4 className="text-foreground font-medium">Track Most Recent Chats</h4>
                        <p className="text-muted-foreground text-sm">Monitor your most active conversations</p>
                      </div>
                      {chatTrackingMode === 'recent' && (
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            max="200"
                            value={maxChats}
                            onChange={(e) => setMaxChats(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                            className="h-8"
                            onClick={(e) => e.stopPropagation()}
                          />
                </div>
              )}
                    </div>
                  </div>
                        </div>
                        </div>

              {/* Option 3: Select Manually */}
              <div 
                className={`border-2 rounded-lg p-4 transition-colors ${
                  chatTrackingMode === 'selected' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={async () => {
                    setChatTrackingMode('selected');
                    // Load chats when user selects this option (if not already loaded)
                    if (availableChats.length === 0 && !isLoadingChats) {
                      await loadAvailableChats();
                    }
                  }}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    chatTrackingMode === 'selected' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {chatTrackingMode === 'selected' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-foreground font-medium">Select Chats Manually</h4>
                    <p className="text-muted-foreground text-sm">Choose specific conversations to track</p>
                  </div>
                </div>

                {chatTrackingMode === 'selected' && (
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-2 border-t pt-4">
                    {isLoadingChats ? (
                      <p className="text-muted-foreground text-sm text-center py-4">Loading chats...</p>
                    ) : availableChats.length > 0 ? (
                      availableChats.map((chat, index) => {
                        const chatId = chat.chatId || chat.guid || `chat-${index}`;
                        return (
                        <div
                          key={chatId}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                            selectedChatGuids.includes(chatId)
                              ? 'bg-primary/20 border border-primary'
                              : 'hover:bg-secondary/50 border border-transparent'
                          }`}
                          onClick={() => {
                            if (selectedChatGuids.includes(chatId)) {
                              setSelectedChatGuids(selectedChatGuids.filter(g => g !== chatId));
                            } else {
                              setSelectedChatGuids([...selectedChatGuids, chatId]);
                            }
                          }}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedChatGuids.includes(chatId)
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}>
                            {selectedChatGuids.includes(chatId) && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-foreground text-sm font-medium">
                              {chat.displayName || 'Unknown Contact'}
                            </p>
                            {chat.isGroup ? (
                              <p className="text-muted-foreground text-xs">Group chat</p>
                            ) : (
                              <p className="text-muted-foreground text-xs">Direct message</p>
                            )}
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground text-sm mb-2">No chats available</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadAvailableChats}
                          disabled={isLoadingChats}
                        >
                          {isLoadingChats ? 'Loading...' : 'Reload Chats'}
                        </Button>
                        {error && (
                          <p className="text-destructive text-xs mt-2">{error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </div>
            </div>

            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSaveChatPreferences} 
                className="flex-1"
                disabled={isLoading || (chatTrackingMode === 'selected' && selectedChatGuids.length === 0)}
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Welcome */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <Logo className="justify-center" />
            <div className="space-y-3 mt-8">
              <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Welcome to Your Grove, {userName || 'there'}!
              </h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                SIMT helps you nurture relationships by gently reminding you when connections need attention,
                and suggesting thoughtful ways to reach out.
              </p>
            </div>
            
            {/* Decorative leaves animation */}
            <div className="relative h-32 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center gap-8">
                <div className="w-16 h-16 rounded-full opacity-20 animate-pulse" style={{ 
                  background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)',
                  animationDelay: '0s'
                }} />
                <div className="w-20 h-20 rounded-full opacity-20 animate-pulse" style={{ 
                  background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
                  animationDelay: '0.5s'
                }} />
                <div className="w-16 h-16 rounded-full opacity-20 animate-pulse" style={{ 
                  background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
                  animationDelay: '1s'
                }} />
              </div>
            </div>
            
            <div className="flex justify-center pt-6">
              <Button onClick={nextStep} size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
                Get Started
                <Leaf className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
