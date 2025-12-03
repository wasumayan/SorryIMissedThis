/**
 * StudyEnrollment Component
 * Handles enrollment of users into the 3-condition research study
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { CheckCircle2, AlertCircle, Info, Clock } from "lucide-react";
import { apiClient, StudyParticipant } from "../services/api";
import { toast } from "sonner";

interface StudyEnrollmentProps {
  userId: string;
  onEnrolled: (participant: StudyParticipant) => void;
  onSkip?: () => void;
}

export function StudyEnrollment({ userId, onEnrolled, onSkip }: StudyEnrollmentProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    setError(null);

    try {
      const response = await apiClient.enrollInStudy(userId);

      if (response.success && response.data?.participant) {
        toast.success(response.data.message || "Successfully enrolled in study!");
        onEnrolled(response.data.participant);
      } else {
        const errorMsg = response.error || "Failed to enroll in study";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred during enrollment";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">
              Join Our Research Study
            </CardTitle>
            <CardDescription className="text-base">
              Help us understand how AI-powered conversation prompts affect relationship quality
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Study Overview */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This is a research study for COS436 at Princeton University investigating the impact
                of conversation prompts on maintaining relationships.
              </AlertDescription>
            </Alert>

            {/* Study Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                What to Expect
              </h3>

              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">3-Day Study Period</p>
                    <p className="text-sm text-muted-foreground">
                      Three 1-day conditions with different prompt types
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <div>
                    <p className="font-medium">Conditions</p>
                    <p className="text-sm text-muted-foreground">
                      No prompts, generic prompts, and context-aware prompts (counterbalanced order)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium">Brief Surveys</p>
                    <p className="text-sm text-muted-foreground">
                      Short survey after each condition (~5 minutes)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Information */}
            <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <h4 className="font-semibold text-sm">Privacy & Data Protection</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your messages are NOT sent to OpenAI</li>
                <li>Only metadata is collected (length, frequency, timing)</li>
                <li>You will be assigned a participant ID (e.g., P001)</li>
                <li>All data is anonymized for research analysis</li>
              </ul>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="flex-1"
                size="lg"
              >
                {isEnrolling ? "Enrolling..." : "Enroll in Study"}
              </Button>

              {onSkip && (
                <Button
                  onClick={onSkip}
                  variant="outline"
                  disabled={isEnrolling}
                  size="lg"
                >
                  Skip
                </Button>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By enrolling, you consent to participate in this research study.
              You can withdraw at any time.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
