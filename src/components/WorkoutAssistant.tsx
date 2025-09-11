import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Lightbulb, Loader2, Send, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Exercise {
  id: number;
  name: string;
  primary_muscles: string[];
  planData?: {
    sets: number;
    reps: string;
    rest: string;
    suggested_weight: string;
    notes: string;
  };
}

interface ExerciseSuggestion {
  exercise_id: number;
  exercise_name: string;
  reason: string;
  muscle_match: 'primary' | 'secondary' | 'partial';
  difficulty_adjustment: 'easier' | 'similar' | 'harder';
  weight_recommendation: string;
}

interface AssistantResponse {
  suggestions: ExerciseSuggestion[];
  general_advice: string;
  original_exercise: {
    id: number;
    name: string;
    primary_muscles: string[];
  };
}

interface WorkoutAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentExercise: Exercise;
  exerciseLibrary: Array<{
    id: number;
    name: string;
    primary_muscles: string[];
  }>;
  onExerciseSubstitute: (newExercise: {
    id: number;
    name: string;
    primary_muscles: string[];
  }, reason: string) => void;
}

export const WorkoutAssistant = ({
  open,
  onOpenChange,
  currentExercise,
  exerciseLibrary,
  onExerciseSubstitute
}: WorkoutAssistantProps) => {
  const [userRequest, setUserRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const { toast } = useToast();

  // Quick action buttons for common requests
  const quickActions = [
    { label: 'Joint hurts, need easier alternative', request: 'My joint is hurting, I need an easier alternative that won\'t aggravate the pain' },
    { label: 'Don\'t have equipment', request: 'I don\'t have the equipment for this exercise, suggest alternatives' },
    { label: 'Too tired, need easier variation', request: 'I\'m feeling too tired for this exercise, suggest an easier variation' },
    { label: 'Want more challenge', request: 'This feels too easy, I want a more challenging exercise' },
    { label: 'Different muscle focus', request: 'I want to target different muscles while staying close to the original' }
  ];

  const getMuscleMatchColor = (match: string) => {
    switch (match) {
      case 'primary': return 'bg-green-100 text-green-800';
      case 'secondary': return 'bg-yellow-100 text-yellow-800';
      case 'partial': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easier': return '📉';
      case 'harder': return '📈';
      case 'similar': return '➡️';
      default: return '➡️';
    }
  };

  const handleQuickAction = (request: string) => {
    setUserRequest(request);
  };

  const handleGetSuggestions = async () => {
    if (!userRequest.trim()) {
      toast({
        title: "Request required",
        description: "Please describe what you need or use a quick action",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get user profile for better suggestions
      const { data: { user } } = await supabase.auth.getUser();
      let userProfile = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('equipment, injuries, goal')
          .eq('id', user.id)
          .maybeSingle();
        userProfile = profile;
      }

      const requestData = {
        currentExercise: {
          id: currentExercise.id,
          name: currentExercise.name,
          primary_muscles: currentExercise.primary_muscles
        },
        userRequest: userRequest,
        availableEquipment: userProfile?.equipment || [],
        userGoals: userProfile?.goal ? [userProfile.goal] : [],
        injuries: userProfile?.injuries || [],
        exerciseLibrary: exerciseLibrary
      };

      const { data, error } = await supabase.functions.invoke('workout-assistant', {
        body: requestData
      });

      if (error) throw error;

      setResponse(data);
      
      if (data.suggestions.length === 0) {
        toast({
          title: "No suggestions found",
          description: "Try rephrasing your request or continue with the current exercise",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Error getting exercise suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to get exercise suggestions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubstitute = (suggestion: ExerciseSuggestion) => {
    const exerciseDetails = exerciseLibrary.find(ex => ex.id === suggestion.exercise_id);
    if (exerciseDetails) {
      onExerciseSubstitute(exerciseDetails, suggestion.reason);
      setResponse(null);
      setUserRequest('');
      onOpenChange(false);
      
      toast({
        title: "Exercise substituted",
        description: `Switched to ${suggestion.exercise_name}`,
      });
    }
  };

  const resetForm = () => {
    setUserRequest('');
    setResponse(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Workout Assistant
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Need to modify <strong>{currentExercise.name}</strong>? I can suggest alternatives based on your needs.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h3 className="font-medium mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.request)}
                  className="justify-start text-left h-auto py-2 px-3"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Request */}
          <div>
            <h3 className="font-medium mb-3">Describe Your Need</h3>
            <Textarea
              placeholder="Example: My shoulder is bothering me, I need a chest exercise that doesn't involve overhead movement..."
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              className="min-h-[100px]"
              disabled={loading}
            />
            
            <div className="flex gap-2 mt-3">
              <Button 
                onClick={handleGetSuggestions} 
                disabled={loading || !userRequest.trim()}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Getting suggestions...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Get Suggestions
                  </>
                )}
              </Button>
              
              {response && (
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Analyzing your request...</p>
                    <p className="text-sm text-muted-foreground">
                      Finding the best exercise alternatives for you
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Suggestions */}
          {response && !loading && (
            <div className="space-y-4">
              {/* General Advice */}
              {response.general_advice && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">{response.general_advice}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Exercise Suggestions */}
              <div>
                <h3 className="font-medium mb-3">Suggested Alternatives</h3>
                
                {response.suggestions.length === 0 ? (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-yellow-800 font-medium">No suitable alternatives found</p>
                          <p className="text-xs text-yellow-700 mt-1">
                            Try rephrasing your request or continue with the current exercise if possible.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {response.suggestions.map((suggestion, index) => (
                      <Card key={suggestion.exercise_id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{suggestion.exercise_name}</CardTitle>
                              <CardDescription className="mt-1">
                                {suggestion.reason}
                              </CardDescription>
                            </div>
                            <Button
                              onClick={() => handleSubstitute(suggestion)}
                              className="ml-4"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Use This
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={getMuscleMatchColor(suggestion.muscle_match)}>
                              {suggestion.muscle_match === 'primary' && '🎯 Perfect Match'}
                              {suggestion.muscle_match === 'secondary' && '✅ Good Match'}
                              {suggestion.muscle_match === 'partial' && '⚠️ Partial Match'}
                            </Badge>
                            <Badge variant="outline">
                              {getDifficultyIcon(suggestion.difficulty_adjustment)} {suggestion.difficulty_adjustment}
                            </Badge>
                          </div>
                          
                          {suggestion.weight_recommendation && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                              <p className="text-sm">
                                <strong>Weight guidance:</strong> {suggestion.weight_recommendation}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};