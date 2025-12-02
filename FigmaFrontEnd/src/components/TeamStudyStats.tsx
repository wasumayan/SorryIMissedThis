/**
 * TeamStudyStats Component
 * Password-protected view for researchers to see all participants' data
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  ArrowLeft,
  Lock,
  Users,
  BarChart3,
  Download,
  Filter,
  TrendingUp,
  MessageSquare,
  Eye,
  CheckCircle2,
  Edit3,
  XCircle
} from "lucide-react";
import { apiClient } from "../services/api";
import { toast } from "sonner";

interface TeamStudyStatsProps {
  onBack: () => void;
}

export function TeamStudyStats({ onBack }: TeamStudyStatsProps) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [error, setError] = useState<string | null>(null);

  const handleAuthenticate = async () => {
    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getAllStudyStats(password, statusFilter);

      if (response.success && response.data) {
        setStats(response.data);
        setIsAuthenticated(true);
        toast.success("Access granted");
      } else {
        setError(response.error || "Invalid password");
        toast.error("Invalid password");
      }
    } catch (err) {
      setError("An error occurred");
      toast.error("An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (newFilter: 'all' | 'active' | 'completed') => {
    setStatusFilter(newFilter);
    if (isAuthenticated && password) {
      setLoading(true);
      try {
        const response = await apiClient.getAllStudyStats(password, newFilter);
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (err) {
        toast.error("Failed to apply filter");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      const response = await fetch(`${apiUrl}/study/metrics/export`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `study_metrics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch (err) {
      console.error("CSV export error:", err);
      toast.error("Failed to export CSV");
    } finally {
      setLoading(false);
    }
  };

  // Password prompt screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Team Access Required</CardTitle>
            <CardDescription>
              Enter the password to view all participants' study data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
                placeholder="Enter admin password"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAuthenticate}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Verifying..." : "Access Data"}
              </Button>
              <Button
                onClick={onBack}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              This view is restricted to research team members only
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { participants, aggregate } = stats;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="h-8 w-8" />
                All Participants Data
              </h1>
              <p className="text-muted-foreground">Research team view - Aggregate statistics</p>
            </div>
          </div>

          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('all')}
                disabled={loading}
              >
                All ({aggregate.total_participants})
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('active')}
                disabled={loading}
              >
                Active ({aggregate.active_participants})
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('completed')}
                disabled={loading}
              >
                Completed ({aggregate.completed_participants})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Aggregate Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Aggregate Statistics
            </CardTitle>
            <CardDescription>
              Combined metrics across {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Total Messages</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">{aggregate.total_messages}</p>
              </div>

              <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Prompts Shown</span>
                </div>
                <p className="text-3xl font-bold text-purple-600">{aggregate.total_prompts_shown}</p>
              </div>

              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-muted-foreground">Accepted</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{aggregate.total_prompts_accepted}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aggregate.total_prompts_shown > 0
                    ? Math.round((aggregate.total_prompts_accepted / aggregate.total_prompts_shown) * 100)
                    : 0}% acceptance rate
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Edit3 className="h-5 w-5 text-orange-600" />
                  <span className="text-sm text-muted-foreground">Edited</span>
                </div>
                <p className="text-3xl font-bold text-orange-600">{aggregate.total_prompts_edited}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aggregate.total_prompts_shown > 0
                    ? Math.round((aggregate.total_prompts_edited / aggregate.total_prompts_shown) * 100)
                    : 0}% edit rate
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{aggregate.total_participants}</p>
                <p className="text-sm text-muted-foreground">Total Participants</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{aggregate.conditions_completed}</p>
                <p className="text-sm text-muted-foreground">Conditions Completed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{aggregate.total_prompts_dismissed}</p>
                <p className="text-sm text-muted-foreground">Prompts Dismissed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Individual Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Individual Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {participants.map((p: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {p.participant.participantId}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {p.participant.currentCondition?.replace('_', ' ')}
                      </span>
                      {p.participant.isStudyComplete && (
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {p.totalEvents} events
                    </span>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Messages:</span>
                      <span className="ml-2 font-medium">{p.metrics.messages_sent}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Shown:</span>
                      <span className="ml-2 font-medium">{p.metrics.prompts_shown}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Accepted:</span>
                      <span className="ml-2 font-medium">{p.metrics.prompts_accepted}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Edited:</span>
                      <span className="ml-2 font-medium">{p.metrics.prompts_edited}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dismissed:</span>
                      <span className="ml-2 font-medium">{p.metrics.prompts_dismissed}</span>
                    </div>
                  </div>
                </div>
              ))}

              {participants.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No participants found matching the selected filter
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
