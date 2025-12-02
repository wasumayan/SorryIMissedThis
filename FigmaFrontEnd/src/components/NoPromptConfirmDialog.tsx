/**
 * NoPromptConfirmPopover Component
 * Confirmation popover for completing any study condition
 */

import { useState } from "react";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { CheckCircle2 } from "lucide-react";
import { apiClient, StudyParticipant } from "../services/api";
import { toast } from "sonner";

interface NoPromptConfirmPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onConfirm: (updatedParticipant: StudyParticipant) => void;
  children: React.ReactNode;
}

export function NoPromptConfirmPopover({
  open,
  onOpenChange,
  userId,
  onConfirm,
  children
}: NoPromptConfirmPopoverProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log('[NoPromptPopover] Rendered, open:', open, 'userId:', userId);

  // Handle Escape key to close popover
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        console.log('[NoPromptPopover] Escape key pressed, closing popover');
        onOpenChange(false);
      }
    };
    
    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, onOpenChange]);

  const handleConfirm = async () => {
    console.log('[NoPromptPopover] Confirm clicked for userId:', userId);
    setIsSubmitting(true);

    try {
      const response = await apiClient.advanceCondition(userId);
      console.log('[NoPromptPopover] API response:', response);

      if (response.success && response.data) {
        console.log('[NoPromptPopover] Success! Updated participant:', {
          condition: response.data.participant.currentCondition,
          index: response.data.participant.currentConditionIndex,
          completed: response.data.participant.completedConditions
        });
        toast.success(response.data.message || "Phase completed!");
        onConfirm(response.data.participant);
        onOpenChange(false);
      } else {
        console.error('[NoPromptPopover] API returned success:false', response);
        toast.error(response.error || "Failed to complete phase");
      }
    } catch (error) {
      console.error("[NoPromptPopover] Error completing phase:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white dark:bg-slate-900 border-2 border-primary p-4 z-50" align="end" side="bottom">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="text-base font-bold text-foreground">
              Complete This Phase
            </h3>
          </div>

          {/* Info Box */}
          <div className="bg-blue-100 dark:bg-blue-900 border border-blue-500 rounded-md p-3">
            <p className="text-sm text-foreground font-medium">
              By confirming, you'll advance to the next study phase
            </p>
          </div>

          {/* Confirmation Text */}
          <p className="text-sm text-foreground">
            Are you ready to complete this phase and move forward?
          </p>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                console.log('[NoPromptPopover] Cancel clicked');
                onOpenChange(false);
              }}
              disabled={isSubmitting}
              className="flex-1 text-sm py-2"
              size="sm"
            >
              Not Yet
            </Button>
            <Button
              onClick={(e) => {
                console.log('[NoPromptPopover] Yes button onClick fired');
                handleConfirm();
              }}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 font-semibold"
              size="sm"
            >
              {isSubmitting ? "Completing..." : "Yes, Ready"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
