/**
 * IndividualStudyStats Component
 * Shows participant their own study statistics
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import {
  ArrowLeft,
  User,
  BarChart3,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit3,
  Eye,
  Calendar
} from "lucide-react";
import { apiClient } from "../services/api";

interface IndividualStudyStatsProps {
  userId: string;
  onBack: () => void;
}

export function IndividualStudyStats({ userId, onBack }: IndividualStudyStatsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getIndividualStudyStats(userId);

        if (response.success && response.data) {
          setStats(response.data);
        } else {
          setError(response.error || "Failed to load statistics");
        }
      } catch (err) {
        setError("An error occurred while loading your statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={onBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats?.enrolled) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Not Enrolled</CardTitle>
            <CardDescription>
              You are not currently enrolled in the study
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { participant, metricsByCondition, surveys, totalEvents } = stats;
  const progress = ((participant.currentConditionIndex) / participant.conditionOrder.length) * 100;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Your Study Statistics</h1>
            <p className="text-muted-foreground">View your participation data and progress</p>
          </div>
        </div>

        {/* Participant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Participant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Participant ID</p>
              <p className="text-2xl font-bold">{participant.participantId}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Study Status</p>
              <Badge variant={participant.isStudyComplete ? "default" : "secondary"} className="text-sm">
                {participant.isStudyComplete ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </>
                ) : (
                  <>
                    <Calendar className="h-3 w-3 mr-1" />
                    In Progress
                  </>
                )}
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Condition</p>
              <p className="font-medium">{participant.currentCondition?.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Progress</p>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Condition {participant.currentConditionIndex + 1} of {participant.conditionOrder.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics by Condition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Metrics by Condition
            </CardTitle>
            <CardDescription>
              Your interaction data for each study condition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {participant.conditionOrder.map((condition: string, idx: number) => {
              const metrics = metricsByCondition?.[condition] || {
                messages_sent: 0,
                prompts_shown: 0,
                prompts_accepted: 0,
                prompts_edited: 0,
                prompts_dismissed: 0,
                total_events: 0
              };
              const isCompleted = participant.completedConditions.includes(condition);

              return (
                <div key={condition} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      {condition.replace('_', ' ').toUpperCase()}
                      {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </h3>
                    <Badge variant="outline">
                      {metrics.total_events} events
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-muted-foreground">Messages</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{metrics.messages_sent}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-purple-600" />
                        <span className="text-xs text-muted-foreground">Shown</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">{metrics.prompts_shown}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">Accepted</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{metrics.prompts_accepted}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Edit3 className="h-4 w-4 text-orange-600" />
                        <span className="text-xs text-muted-foreground">Edited</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{metrics.prompts_edited}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-muted-foreground">Dismissed</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">{metrics.prompts_dismissed}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Survey Responses */}
        {surveys && surveys.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Survey Responses
              </CardTitle>
              <CardDescription>
                Your feedback from completed conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {surveys.map((survey: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-3">
                    {survey.condition?.replace('_', ' ').toUpperCase()}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Connectedness:</span>
                      <span className="ml-2 font-medium">{survey.perceivedConnectedness}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Authenticity:</span>
                      <span className="ml-2 font-medium">{survey.authenticity}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Enjoyment:</span>
                      <span className="ml-2 font-medium">{survey.enjoyment}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Satisfaction:</span>
                      <span className="ml-2 font-medium">{survey.overallSatisfaction}/5</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <p className="text-3xl font-bold text-primary">{totalEvents || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Events Logged</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <p className="text-3xl font-bold text-primary">{participant.completedConditions.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Conditions Completed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <p className="text-3xl font-bold text-primary">{surveys?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Surveys Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
