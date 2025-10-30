import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Logo } from "./Logo";
import { Shield, MessageCircle, Lock, CheckCircle, Leaf, User as UserIcon, Mail, Key, Upload } from "lucide-react";
import { apiClient, type User } from "../services/api";

interface OnboardingProps {
  onComplete: (userData?: User) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<User | undefined>(undefined);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;

  const nextStep = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Final step - complete onboarding with user data
      onComplete(userData);
    }
  };

  const handleAuth = async () => {
    setIsLoading(true);
    setError('');

    try {
      let response;
      if (isLogin) {
        response = await apiClient.login({
          email: authData.email,
          password: authData.password,
        });
      } else {
        response = await apiClient.register({
          name: authData.name,
          email: authData.email,
          password: authData.password,
        });
      }

      if (response.success && response.data) {
        // Store user data and proceed to next onboarding step
        setUserData(response.data.user);
        nextStep();
      } else {
        setError(response.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Authentication failed. Please try again.');
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

    setUploadStatus('uploading');
    setUploadProgress(30);
    setError('');

    try {
      const response = await apiClient.uploadTranscript(
        uploadFile,
        userData.id,
        userData.name
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

        {/* Step 0: Authentication */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <Logo className="justify-center mb-6" />
              <h1 className="text-2xl font-bold mb-2">
                {isLogin ? 'Welcome Back' : 'Create Your Account'}
              </h1>
              <p className="text-muted-foreground">
                {isLogin ? 'Sign in to access your grove' : 'Join SIMT to nurture your relationships'}
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={authData.name}
                      onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={authData.email}
                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleAuth} 
                className="w-full" 
                size="lg"
                disabled={isLoading || !authData.email || !authData.password || (!isLogin && !authData.name)}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setAuthData({ name: '', email: '', password: '' });
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-6 text-center">
            <Logo className="justify-center" />
            <div className="space-y-3 mt-8">
              <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Welcome to Your Grove
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

        {/* Step 2: Privacy Pledge */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-primary" />
              <h2>Privacy First, Always</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <div className="flex gap-3 items-start bg-secondary/50 p-4 rounded-lg">
                <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-foreground mb-1">Local-Only by Default</h4>
                  <p style={{ fontSize: '0.875rem' }}>
                    Your messages, contacts, and analysis stay on your device. No cloud sync unless you opt in.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-secondary/50 p-4 rounded-lg">
                <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-foreground mb-1">Encrypted at Rest</h4>
                  <p style={{ fontSize: '0.875rem' }}>
                    All data is encrypted on your device. You control your data with one-click purge.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-secondary/50 p-4 rounded-lg">
                <MessageCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-foreground mb-1">No Message Sending</h4>
                  <p style={{ fontSize: '0.875rem' }}>
                    SIMT suggests prompts but never sends messages for you. You stay in control.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
              <Button onClick={nextStep} className="flex-1">
                I Understand
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Connect WhatsApp */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
              <h2>Connect WhatsApp</h2>
            </div>
            <p className="text-muted-foreground">
              Scan the QR code with WhatsApp on your phone to connect your account via WhatsApp Web protocol.
            </p>
            
            {!whatsappConnected ? (
              <div className="bg-muted/50 rounded-lg p-8 flex flex-col items-center gap-4">
                <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border-2 border-border">
                  <div className="text-center space-y-2">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg" />
                    <p className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>QR Code</p>
                  </div>
                </div>
                <Button onClick={() => setWhatsappConnected(true)} variant="outline">
                  Simulate Connection
                </Button>
              </div>
            ) : (
              <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 flex items-center gap-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <div>
                  <h4 className="text-foreground">WhatsApp Connected</h4>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Successfully connected to your WhatsApp account
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
              <Button onClick={nextStep} disabled={!whatsappConnected} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Connect Telegram */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
              <h2>Connect Telegram</h2>
            </div>
            <p className="text-muted-foreground">
              Connect your Telegram account to analyze those conversations too.
            </p>
            
            {!telegramConnected ? (
              <div className="bg-muted/50 rounded-lg p-8 flex flex-col items-center gap-4">
                <div className="w-full max-w-sm space-y-3">
                  <div className="bg-white rounded-lg p-4 border-2 border-border">
                    <p className="text-center text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                      Enter your phone number and verification code
                    </p>
                  </div>
                  <Button onClick={() => setTelegramConnected(true)} variant="outline" className="w-full">
                    Simulate Connection
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 flex items-center gap-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <div>
                  <h4 className="text-foreground">Telegram Connected</h4>
                  <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>
                    Successfully connected to your Telegram account
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
              <Button onClick={skipStep} variant="ghost" className="flex-1">
                Skip for Now
              </Button>
              <Button onClick={nextStep} disabled={!telegramConnected} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Upload Chat Transcripts */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="w-8 h-8 text-primary" />
              <h2>Upload Your Conversations</h2>
            </div>
            <p className="text-muted-foreground">
              Upload your WhatsApp or Telegram chat exports to populate your grove. We'll analyze your conversations to help you stay connected.
            </p>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-secondary/50 to-accent/30 rounded-lg p-8 space-y-4">
              {uploadStatus === 'idle' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground mb-2">Drop your chat export file here</p>
                    <p className="text-muted-foreground text-sm mb-4">Supports .txt or .zip files</p>
                    <Label htmlFor="file-upload">
                      <div className="inline-block">
                        <Button type="button" variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                          Choose File
                        </Button>
                      </div>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt,.zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  {uploadFile && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                      <p className="text-sm text-foreground">Selected: {uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(uploadFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle className="w-5 h-5" />
                      <span style={{ fontSize: '0.875rem' }}>
                        {uploadStatus === 'uploading' ? 'Uploading file...' : 'Processing conversations...'}
                      </span>
                    </div>
                    {uploadStatus === 'processing' && (
                      <>
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle className="w-5 h-5" />
                          <span style={{ fontSize: '0.875rem' }}>Analyzing interaction patterns...</span>
                        </div>
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle className="w-5 h-5" />
                          <span style={{ fontSize: '0.875rem' }}>Growing your relationship tree...</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="pt-4">
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                </div>
              )}

              {uploadStatus === 'complete' && (
                <div className="text-center space-y-4">
                  <CheckCircle className="w-16 h-16 mx-auto text-primary" />
                  <div>
                    <h4 className="text-foreground text-lg mb-2">Upload Complete!</h4>
                    <p className="text-muted-foreground text-sm">
                      Your conversations have been processed and your grove is ready.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={nextStep}
                className="flex-1"
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              >
                Skip for Now
              </Button>
              <Button
                onClick={handleUpload}
                className="flex-1"
                disabled={!uploadFile || uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'complete'}
              >
                {uploadStatus === 'uploading' || uploadStatus === 'processing' ? 'Processing...' : 'Upload'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
