import { useState, useEffect } from "react";
import { Logo } from "./components/Logo";
import { Onboarding } from "./components/Onboarding";
import { GroveDashboard } from "./components/GroveDashboard";
import { ConversationView } from "./components/ConversationView";
import { Analytics } from "./components/Analytics";
import { Settings } from "./components/Settings";
import { Schedule } from "./components/Schedule";
import { Button } from "./components/ui/button";
import { Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { apiClient, User, Contact } from "./services/api";

type View = "onboarding" | "grove" | "conversation" | "analytics" | "settings" | "schedule";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("onboarding");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [season, setSeason] = useState<"spring" | "summer" | "autumn" | "winter">("summer");
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 🧪 TESTING MODE: Always force onboarding during development
        // TODO: Remove this hardcoded flag before production
        const FORCE_ONBOARDING_FOR_TESTING = true; // Set to false to restore normal auth flow
        
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

  const handleOnboardingComplete = (userData?: User) => {
    if (userData) {
      setUser(userData);
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

  // Main App Views
  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
      <div className="flex-1 overflow-hidden">
        {currentView === "grove" && user && (
          <GroveDashboard
            user={user}
            onContactSelect={handleContactSelect}
            onViewAnalytics={() => setCurrentView("analytics")}
            onViewSchedule={() => setCurrentView("schedule")}
          />
        )}

        {currentView === "conversation" && selectedContact && user && (
          <ConversationView
            contactName={selectedContact.name}
            contactId={selectedContact.id}
            conversationId={selectedContact.id}
            userId={user.id}
            onBack={handleBackToGrove}
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
          />
        )}
      </div>
    </div>
  );
}