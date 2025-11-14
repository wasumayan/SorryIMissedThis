/**
 * PostConditionSurvey Component
 * Survey form based on Pilot Study Report (Appendix A)
 * Collects feedback after each 3-day condition
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";
import { apiClient, StudyCondition } from "../services/api";
import { toast } from "sonner";

interface PostConditionSurveyProps {
  userId: string;
  condition: StudyCondition;
  onComplete: () => void;
  onCancel?: () => void;
}

const CONDITION_LABELS: Record<StudyCondition, string> = {
  no_prompt: "No Prompts",
  generic_prompt: "Generic Prompts",
  context_aware: "Context-Aware Prompts"
};

interface LikertQuestionProps {
  question: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}

function LikertQuestion({
  question,
  name,
  value,
  onChange,
  lowLabel,
  highLabel
}: LikertQuestionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">{question}</Label>
      <RadioGroup
        value={value.toString()}
        onValueChange={(v) => onChange(parseInt(v))}
        className="flex items-center justify-between gap-2"
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <div key={rating} className="flex flex-col items-center gap-2">
            <RadioGroupItem
              value={rating.toString()}
              id={`${name}-${rating}`}
              className="h-6 w-6"
            />
            <Label
              htmlFor={`${name}-${rating}`}
              className="text-xs text-muted-foreground cursor-pointer"
            >
              {rating}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <div className="flex justify-between text-xs text-muted-foreground pt-1">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function PostConditionSurvey({
  userId,
  condition,
  onComplete,
  onCancel
}: PostConditionSurveyProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Survey responses (based on Pilot Study Report Appendix A)
  const [responses, setResponses] = useState({
    perceivedConnectedness: 3,
    authenticity: 3,
    enjoyment: 3,
    easeOfConversation: 3,
    promptHelpfulness: 3,
    promptRelevance: 3,
    editReasons: "",
    overallQualityVsTypical: 3,
    communicationFrequency: "",
    overallSatisfaction: 3,
    likes: "",
    difficulties: "",
    suggestions: ""
  });

  const hasPrompts = condition !== "no_prompt";
  const totalPages = hasPrompts ? 3 : 2; // Skip prompt questions for no_prompt condition

  const updateResponse = (field: string, value: number | string) => {
    setResponses((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const surveyData = {
        userId,
        condition,
        responses: {
          ...responses,
          // Only include prompt-specific questions if applicable
          ...(hasPrompts ? {} : {
            promptHelpfulness: undefined,
            promptRelevance: undefined
          })
        }
      };

      const response = await apiClient.submitSurvey(surveyData);

      if (response.success) {
        toast.success("Survey submitted successfully!");
        onComplete();
      } else {
        const errorMsg = response.error || "Failed to submit survey";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const progress = (currentPage / totalPages) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">Post-Condition Survey</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Page {currentPage} of {totalPages}</span>
              </div>
            </div>
            <CardDescription>
              Condition: <span className="font-semibold">{CONDITION_LABELS[condition]}</span>
            </CardDescription>
            <Progress value={progress} className="mt-4" />
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Page 1: Core Experience Questions */}
            {currentPage === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="font-semibold text-lg">Your Experience</h3>

                <LikertQuestion
                  question="How connected did you feel to the people you messaged?"
                  name="perceivedConnectedness"
                  value={responses.perceivedConnectedness}
                  onChange={(v) => updateResponse("perceivedConnectedness", v)}
                  lowLabel="Not connected at all"
                  highLabel="Very connected"
                />

                <LikertQuestion
                  question="How authentic did your conversations feel?"
                  name="authenticity"
                  value={responses.authenticity}
                  onChange={(v) => updateResponse("authenticity", v)}
                  lowLabel="Not authentic"
                  highLabel="Very authentic"
                />

                <LikertQuestion
                  question="How much did you enjoy the conversations?"
                  name="enjoyment"
                  value={responses.enjoyment}
                  onChange={(v) => updateResponse("enjoyment", v)}
                  lowLabel="Did not enjoy"
                  highLabel="Greatly enjoyed"
                />

                <LikertQuestion
                  question="How easy was it to have conversations?"
                  name="easeOfConversation"
                  value={responses.easeOfConversation}
                  onChange={(v) => updateResponse("easeOfConversation", v)}
                  lowLabel="Very difficult"
                  highLabel="Very easy"
                />
              </motion.div>
            )}

            {/* Page 2: Prompt-Specific Questions (only for generic_prompt & context_aware) */}
            {currentPage === 2 && hasPrompts && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="font-semibold text-lg">About the Prompts</h3>

                <LikertQuestion
                  question="How helpful were the conversation prompts?"
                  name="promptHelpfulness"
                  value={responses.promptHelpfulness}
                  onChange={(v) => updateResponse("promptHelpfulness", v)}
                  lowLabel="Not helpful"
                  highLabel="Very helpful"
                />

                <LikertQuestion
                  question="How relevant were the prompts to your relationships?"
                  name="promptRelevance"
                  value={responses.promptRelevance}
                  onChange={(v) => updateResponse("promptRelevance", v)}
                  lowLabel="Not relevant"
                  highLabel="Very relevant"
                />

                <div className="space-y-2">
                  <Label htmlFor="editReasons">
                    If you edited any prompts, why did you make changes? (Optional)
                  </Label>
                  <Textarea
                    id="editReasons"
                    value={responses.editReasons}
                    onChange={(e) => updateResponse("editReasons", e.target.value)}
                    placeholder="E.g., Changed tone, made it more specific, added personal touch..."
                    rows={3}
                  />
                </div>
              </motion.div>
            )}

            {/* Page 3 (or 2 for no_prompt): Overall Assessment */}
            {currentPage === totalPages && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="font-semibold text-lg">Overall Assessment</h3>

                <LikertQuestion
                  question="Compared to how you typically communicate, how was the quality of your conversations?"
                  name="overallQualityVsTypical"
                  value={responses.overallQualityVsTypical}
                  onChange={(v) => updateResponse("overallQualityVsTypical", v)}
                  lowLabel="Much worse"
                  highLabel="Much better"
                />

                <div className="space-y-2">
                  <Label htmlFor="communicationFrequency">
                    How often did you communicate during this condition?
                  </Label>
                  <Textarea
                    id="communicationFrequency"
                    value={responses.communicationFrequency}
                    onChange={(e) => updateResponse("communicationFrequency", e.target.value)}
                    placeholder="E.g., Daily, few times a week, only when necessary..."
                    rows={2}
                  />
                </div>

                <LikertQuestion
                  question="Overall, how satisfied were you with this experience?"
                  name="overallSatisfaction"
                  value={responses.overallSatisfaction}
                  onChange={(v) => updateResponse("overallSatisfaction", v)}
                  lowLabel="Very dissatisfied"
                  highLabel="Very satisfied"
                />

                <div className="space-y-2">
                  <Label htmlFor="likes">
                    What did you like about this condition? (Optional)
                  </Label>
                  <Textarea
                    id="likes"
                    value={responses.likes}
                    onChange={(e) => updateResponse("likes", e.target.value)}
                    placeholder="Share what worked well for you..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulties">
                    What difficulties did you encounter? (Optional)
                  </Label>
                  <Textarea
                    id="difficulties"
                    value={responses.difficulties}
                    onChange={(e) => updateResponse("difficulties", e.target.value)}
                    placeholder="Share any challenges or frustrations..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suggestions">
                    Any suggestions for improvement? (Optional)
                  </Label>
                  <Textarea
                    id="suggestions"
                    value={responses.suggestions}
                    onChange={(e) => updateResponse("suggestions", e.target.value)}
                    placeholder="How could we make this better?"
                    rows={3}
                  />
                </div>
              </motion.div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button
                    onClick={prevPage}
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                )}
                {onCancel && currentPage === 1 && (
                  <Button
                    onClick={onCancel}
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {currentPage < totalPages && (
                  <Button onClick={nextPage}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentPage === totalPages && (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="min-w-[120px]"
                  >
                    {isSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Submit
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Your responses help us understand how different approaches affect conversation quality
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
