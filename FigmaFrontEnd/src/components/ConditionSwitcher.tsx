/**
 * ConditionSwitcher Component
 * Allows participants to manually switch between study conditions
 */

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Ban
} from "lucide-react";
import { StudyParticipant, apiClient } from "../services/api";
import { toast } from "sonner";

interface ConditionSwitcherProps {
  participant: StudyParticipant;
  onConditionComplete: (updatedParticipant: StudyParticipant) => void;
}

const CONDITION_INFO = {
  no_prompt: {
    title: "No Prompts",
    description: "Message naturally without any AI suggestions",
    icon: Ban,
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-200 dark:border-gray-800"
  },
  generic_prompt: {
    title: "Generic Prompts",
    description: "Receive general conversation suggestions",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800"
  },
  context_aware: {
    title: "Context-Aware Prompts",
    description: "Get personalized suggestions based on your conversation history",
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800"
  }
};

export function ConditionSwitcher({ participant, onConditionComplete }: ConditionSwitcherProps) {
  const [isLoading, setIsLoading] = useState(false);

  const currentCondition = participant.currentCondition;
  const currentInfo = CONDITION_INFO[currentCondition as keyof typeof CONDITION_INFO];
  const Icon = currentInfo?.icon || AlertCircle;

  // Progress based on completed conditions (not current index)
  const progress = (participant.completedConditions.length / participant.conditionOrder.length) * 100;
  const isCurrentConditionCompleted = participant.completedConditions.includes(currentCondition);

  console.log('[ConditionSwitcher] Rendering with participant:', {
    currentCondition,
    currentConditionIndex: participant.currentConditionIndex,
    completed: participant.completedConditions,
    isCurrentConditionCompleted,
    buttonShouldShow: !isCurrentConditionCompleted
  });

  const handleCompleteCondition = async () => {
    console.log('[ConditionSwitcher] Complete button clicked, condition:', currentCondition);
    setIsLoading(true);

    try {
      const response = await apiClient.advanceCondition(participant.userId);
      console.log('[ConditionSwitcher] API response:', response);

      if (response.success && response.data) {
        console.log('[ConditionSwitcher] Successfully advanced! Updated participant:', {
          newCondition: response.data.participant.currentCondition,
          newIndex: response.data.participant.currentConditionIndex,
          completed: response.data.participant.completedConditions
        });
        toast.success(response.data.message || "Phase completed!");
        onConditionComplete(response.data.participant);
      } else {
        console.error('[ConditionSwitcher] API returned success:false', response);
        toast.error(response.error || "Failed to complete phase");
      }
    } catch (error) {
      console.error("[ConditionSwitcher] Error completing phase:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentInfo) {
    return null;
  }

  return (
    <>
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${currentInfo.bgColor} border ${currentInfo.borderColor}`}>
                <Icon className={`h-4 w-4 ${currentInfo.color}`} />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Current Condition</CardTitle>
                <CardDescription className="text-xs">Phase {participant.currentConditionIndex + 1} of {participant.conditionOrder.length}</CardDescription>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-secondary rounded-full h-1.5 mb-2">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{Math.round(progress)}% Complete</p>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <div className={`p-3 rounded-lg ${currentInfo.bgColor} border ${currentInfo.borderColor}`}>
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm font-semibold ${currentInfo.color}`}>{currentInfo.title}</h4>
              {participant.completedConditions.includes(currentCondition) && (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{currentInfo.description}</p>
          </div>

          {/* Condition Progress Icons */}
          <div className="flex items-center justify-center gap-1.5">
            {participant.conditionOrder.map((condition, index) => {
              const info = CONDITION_INFO[condition as keyof typeof CONDITION_INFO];
              const CondIcon = info?.icon || AlertCircle;
              const isCompleted = participant.completedConditions.includes(condition);
              const isCurrent = index === participant.currentConditionIndex;

              return (
                <div key={condition} className="flex items-center gap-1.5">
                  <div className={`
                    relative p-1.5 rounded-md border
                    ${isCurrent ? `${info.bgColor} ${info.borderColor}` : 'bg-secondary/50 border-secondary'}
                    ${isCompleted ? 'opacity-60' : ''}
                  `}>
                    <CondIcon className={`h-3 w-3 ${isCurrent ? info.color : 'text-muted-foreground'}`} />
                    {isCompleted && (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-600 absolute -top-0.5 -right-0.5 bg-background rounded-full" />
                    )}
                  </div>
                  {index < participant.conditionOrder.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Complete Condition Button (for all conditions) */}
          {!isCurrentConditionCompleted ? (
            <Button
              onClick={handleCompleteCondition}
              className="w-full h-8 text-xs"
              size="sm"
              disabled={isLoading}
            >
              {isLoading ? "Completing..." : "Complete This Phase"}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <div className="w-full h-8 flex items-center justify-center text-xs text-green-600 font-medium">
              ✓ Phase Complete
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
