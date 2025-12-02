import { useState, useEffect } from "react";
import { Logo } from "./components/Logo";
import { Onboarding } from "./components/Onboarding";
import { GroveDashboard } from "./components/GroveDashboard";
import { ConversationView } from "./components/ConversationView";
import { Analytics } from "./components/Analytics";
import { Settings } from "./components/Settings";
import { Schedule } from "./components/Schedule";
import { StudyEnrollment } from "./components/StudyEnrollment";
import { PostConditionSurvey } from "./components/PostConditionSurvey";
import { NetworkGraphTest } from "./components/NetworkGraphTest";
import { Button } from "./components/ui/button";
import { Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { apiClient, User, Contact, StudyParticipant, StudyStatus } from "./services/api";
import { Toaster } from "./components/ui/sonner";

type View = "onboarding" | "study-enrollment" | "study-survey" | "grove" | "conversation" | "analytics" | "settings" | "schedule" | "network-test";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("onboarding");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [season, setSeason] = useState<"spring" | "summer" | "autumn" | "winter">("summer");
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Study state
  const [studyStatus, setStudyStatus] = useState<StudyStatus | null>(null);

  // Check for existing authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 🧪 TESTING MODE: Always force onboarding during development
        // Set to true to force onboarding flow for testing
        const FORCE_ONBOARDING_FOR_TESTING = false; // Changed to false for production use

        if (FORCE_ONBOARDING_FOR_TESTING) {
          console.log('[DEBUG] 🧪 TESTING MODE: Force onboarding enabled - clearing localStorage');
          localStorage.removeItem('simt_token');
          localStorage.removeItem('user');
          setCurrentView("onboarding");
          setIsLoading(false);
          return;
        }

        // FOR TESTING: Check for ?reset=true or ?onboarding=true in URL to force onboarding
        const urlParams = new URLSearchParams(window.location.search);
        const forceOnboarding = urlParams.get('reset') === 'true' || urlParams.get('onboarding') === 'true';
        
        if (forceOnboarding) {
          console.log('[DEBUG] Force onboarding mode - clearing localStorage');
          localStorage.removeItem('simt_token');
          localStorage.removeItem('user');
          setCurrentView("onboarding");
          setIsLoading(false);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        // Check if there's a token in localStorage
        const token = localStorage.getItem('simt_token');
        if (!token) {
          // No token, go to onboarding
          setCurrentView("onboarding");
          setIsLoading(false);
          return;
        }

        const response = await apiClient.getCurrentUser();
        if (response.success && response.data) {
          const userData = response.data as User;
          // Validate user has a reasonable name (not just "x" or single character)
          if (userData.name && userData.name.trim().length >= 2) {
            setUser(userData);
            setCurrentView("grove");
          } else {
            // User has invalid name, clear and re-onboard
            console.log('User has invalid name, clearing and re-onboarding');
            localStorage.removeItem('simt_token');
            localStorage.removeItem('user');
            setCurrentView("onboarding");
          }
        } else {
          // Invalid token, clear it and go to onboarding
          localStorage.removeItem('simt_token');
          localStorage.removeItem('user');
          setCurrentView("onboarding");
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid token on error
        localStorage.removeItem('simt_token');
        localStorage.removeItem('user');
        setCurrentView("onboarding");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Check study status when user is set
  useEffect(() => {
    const checkStudyStatus = async () => {
      if (!user) return;

      try {
        const response = await apiClient.getStudyStatus(user.id);
        if (response.success && response.data) {
          const status = response.data;
          setStudyStatus(status);

          // If user needs to complete survey, redirect to survey
          if (status.needsSurvey && status.participant) {
            setCurrentView("study-survey");
          }
        }
      } catch (error) {
        console.error("Failed to check study status:", error);
      }
    };

    checkStudyStatus();
  }, [user]);

  const handleOnboardingComplete = (userData?: User) => {
    if (userData) {
      setUser(userData);
      // After onboarding, offer study enrollment
      setCurrentView("study-enrollment");
    }
  };

  const handleStudyEnrolled = (participant: StudyParticipant) => {
    setStudyStatus({
      enrolled: true,
      participant,
      needsSurvey: false
    });
    setCurrentView("grove");
  };

  const handleSkipStudy = () => {
    setCurrentView("grove");
  };

  const handleSurveyComplete = async () => {
    // Refresh study status
    if (user) {
      const response = await apiClient.getStudyStatus(user.id);
      if (response.success && response.data) {
        const status = response.data;
        setStudyStatus(status);
      }
    }
    setCurrentView("grove");
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentView("conversation");
  };

  const handleBackToGrove = () => {
    setCurrentView("grove");
    setSelectedContact(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-accent/10 to-secondary/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your grove...</p>
        </div>
      </div>
    );
  }

  // Onboarding Flow
  if (currentView === "onboarding") {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Study Enrollment Flow
  if (currentView === "study-enrollment" && user) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <StudyEnrollment
          userId={user.id}
          onEnrolled={handleStudyEnrolled}
          onSkip={handleSkipStudy}
        />
      </>
    );
  }

  // Study Survey Flow
  if (currentView === "study-survey" && user && studyStatus?.participant) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <PostConditionSurvey
          userId={user.id}
          condition={studyStatus.participant.currentCondition}
          onComplete={handleSurveyComplete}
          onCancel={() => setCurrentView("grove")}
        />
      </>
    );
  }

  // Main App Views
  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="h-screen flex flex-col">
      {/* Top Navigation */}
      {currentView === "grove" && (
        <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
          <Logo showWordmark={false} />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView("settings")}
            >
              <SettingsIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

  {/* Main Content */}
  <div className="flex-1 min-h-0">
        {currentView === "grove" && user && (
          <GroveDashboard
            user={user}
            onContactSelect={handleContactSelect}
            onViewAnalytics={() => setCurrentView("analytics")}
            onViewSchedule={() => setCurrentView("schedule")}
            studyStatus={studyStatus?.participant || null}
            onStudyStatusUpdate={(participant) => {
              console.log('[App] Study participant updated:', {
                previousCondition: studyStatus?.participant?.currentCondition,
                newCondition: participant.currentCondition,
                previousIndex: studyStatus?.participant?.currentConditionIndex,
                newIndex: participant.currentConditionIndex,
                completed: participant.completedConditions
              });
              if (studyStatus) {
                const newStudyStatus = { ...studyStatus, participant };
                console.log('[App] Setting study status:', newStudyStatus);
                setStudyStatus(newStudyStatus);
              }
            }}
          />
        )}

        {currentView === "conversation" && selectedContact && user && (
          <ConversationView
            contactName={selectedContact.name}
            contactId={selectedContact.id}
            conversationId={selectedContact.id}
            userId={user.id}
            onBack={handleBackToGrove}
            studyCondition={studyStatus?.participant?.currentCondition}
          />
        )}

        {currentView === "analytics" && user && (
          <Analytics user={user} onBack={handleBackToGrove} />
        )}

        {currentView === "schedule" && user && (
          <Schedule user={user} onBack={handleBackToGrove} />
        )}

        {currentView === "settings" && user && (
          <Settings
            user={user}
            onBack={handleBackToGrove}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onPurgeComplete={() => {
              // Clear all state
              setUser(null);
              setStudyStatus(null);
              setSelectedContact(null);
              // Redirect to onboarding
              setCurrentView("onboarding");
            }}
          />
        )}

        {currentView === "network-test" && (
          <NetworkGraphTest />
        )}
      </div>
    </div>
    </>
  );
}