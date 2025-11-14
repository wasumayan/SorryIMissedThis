/**
 * StudyStatusBanner Component
 * Displays current study condition, progress, and prompts for surveys
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  MessageSquare,
  Sparkles,
  X
} from "lucide-react";
import { StudyParticipant, StudyCondition } from "../services/api";

interface StudyStatusBannerProps {
  participant: StudyParticipant;
  needsSurvey?: boolean;
  onTakeSurvey?: () => void;
  onDismiss?: () => void;
}

const CONDITION_INFO: Record<StudyCondition, {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = {
  no_prompt: {
    label: "No Prompts",
    description: "Baseline - no conversation prompts",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "bg-slate-500"
  },
  generic_prompt: {
    label: "Generic Prompts",
    description: "Style-matched conversation starters",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-blue-500"
  },
  context_aware: {
    label: "Context-Aware Prompts",
    description: "Personalized conversation suggestions",
    icon: <Sparkles className="h-4 w-4" />,
    color: "bg-primary"
  }
};

export function StudyStatusBanner({
  participant,
  needsSurvey = false,
  onTakeSurvey,
  onDismiss
}: StudyStatusBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [progress, setProgress] = useState(0);

  const conditionInfo = CONDITION_INFO[participant.currentCondition];
  const currentDay = participant.daysInCurrentCondition;
  const totalDays = 3;
  const conditionNumber = participant.currentConditionIndex + 1;
  const totalConditions = participant.conditionOrder.length;

  useEffect(() => {
    // Animate progress bar
    const targetProgress = (currentDay / totalDays) * 100;
    const timer = setTimeout(() => setProgress(targetProgress), 100);
    return () => clearTimeout(timer);
  }, [currentDay, totalDays]);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  // Survey prompt variant
  if (needsSurvey) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="sticky top-0 z-50 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Condition Complete!</p>
              <p className="text-sm text-muted-foreground">
                Please take a brief survey about your experience with{" "}
                <span className="font-medium">{conditionInfo.label}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onTakeSurvey} size="sm">
              Take Survey (5 min)
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Study complete variant
  if (participant.isStudyComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 p-4 bg-gradient-to-r from-green-500/10 via-green-500/5 to-background border-b shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                Study Complete - Thank You!
              </p>
              <p className="text-sm text-muted-foreground">
                You've completed all 3 conditions ({participant.participantId})
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Regular status banner
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="sticky top-0 z-50 p-3 bg-background/95 backdrop-blur border-b shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Condition Info */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${conditionInfo.color} text-white`}>
                {conditionInfo.icon}
              </div>

              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">
                      {conditionInfo.label}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Condition {conditionNumber}/{totalConditions}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {conditionInfo.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Center: Progress */}
            <div className="flex-1 max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Day {currentDay} of {totalDays}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Right: Participant ID & Dismiss */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {participant.participantId}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
