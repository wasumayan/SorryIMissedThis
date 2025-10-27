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
        const response = await apiClient.getCurrentUser();
        if (response.success && response.data) {
          setUser(response.data.user);
          setCurrentView("grove");
        } else {
          setCurrentView("onboarding");
        }
      } catch (error) {
        console.error('Auth check failed:', error);
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
        {currentView === "grove" && (
          <GroveDashboard
            onContactSelect={handleContactSelect}
            onViewAnalytics={() => setCurrentView("analytics")}
            onViewSchedule={() => setCurrentView("schedule")}
          />
        )}

        {currentView === "conversation" && selectedContact && (
          <ConversationView
            contactName={selectedContact.name}
            onBack={handleBackToGrove}
          />
        )}

        {currentView === "analytics" && (
          <Analytics onBack={handleBackToGrove} />
        )}

        {currentView === "schedule" && (
          <Schedule onBack={handleBackToGrove} />
        )}

        {currentView === "settings" && (
          <Settings
            onBack={handleBackToGrove}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
          />
        )}
      </div>
    </div>
  );
}