import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, ArrowLeft, Timer, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExerciseSetTable } from "@/components/ExerciseSetTable";
import { WorkoutVoiceInput } from "@/components/WorkoutVoiceInput";
import { WorkoutAssistant } from "@/components/WorkoutAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkoutDataManager } from "@/utils/WorkoutDataManager";
import { ErrorDisplay, LoadingState } from "@/components/ui/error-display";
import { useSafeOperation } from "@/hooks/useSafeOperation";

interface Set {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
}

interface Exercise {
  id: number;
  name: string;
  primary_muscles: string[];
  workout_exercise_id?: string;
  sets: Set[];
  planData?: {
    sets: number;
    reps: string;
    rest: string;
    suggested_weight: string;
    notes: string;
    primary_muscles: string[];
  };
}

interface Workout {
  id: string;
  json_plan: any;
  program: {
    name: string;
  };
}

const SessionTracker = () => {
  const { id: workoutId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { executeOperation, loadingState, retry } = useSafeOperation();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<Array<{
    id: number;
    name: string;
    primary_muscles: string[];
  }>>([]);
  const [sessionStartTime] = useState(new Date());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);

  useEffect(() => {
    if (workoutId) {
      fetchWorkout();
      fetchExerciseLibrary();
    }
  }, [workoutId]);

  const fetchExerciseLibrary = useCallback(async () => {
    await executeOperation(
      async () => {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, name, primary_muscles')
          .order('name');

        if (error) throw error;
        return data || [];
      },
      'Loading exercise library',
      {
        retryable: true,
        onSuccess: (data) => setExerciseLibrary(data),
        onError: (error) => console.error('Failed to load exercise library:', error)
      }
    );
  }, [executeOperation]);

  const fetchWorkout = useCallback(async () => {
    await executeOperation(
      async () => {
        // Use WorkoutDataManager for validated loading
        const { workout: workoutData, isModular, errors } = await WorkoutDataManager.loadWorkout(workoutId!);

        if (!workoutData) {
          throw new Error(errors[0] || 'Workout not found');
        }

        if (errors.length > 0) {
          console.warn('Workout validation warnings:', errors);
        }

        setWorkout(workoutData);
        await setupExercises(workoutData, isModular);
        return workoutData;
      },
      'Loading workout',
      {
        requireAuth: true,
        retryable: true,
        loadingMessage: 'Loading your workout...',
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to load workout",
            variant: "destructive"
          });
          navigate('/');
        }
      }
    );
  }, [workoutId, executeOperation, toast, navigate]);

  const setupExercises = async (workoutData: Workout, isModular?: boolean) => {
    if (!workoutData.json_plan) return;

    try {
      let allExercises: any[] = [];

      // Handle both modular and legacy formats safely
      if (isModular || workoutData.json_plan.modules) {
        // Modular format - use WorkoutDataManager for safe conversion
        const { workout: modularWorkout, errors } = WorkoutDataManager.safeConvertToModular({ 
          workouts: [workoutData.json_plan] 
        });
        
        if (!modularWorkout) {
          console.error('Failed to convert to modular format:', errors);
          toast({
            title: "Warning",
            description: "Workout format may be incompatible. Some features may not work correctly.",
            variant: "destructive"
          });
          return;
        }

        const workoutDay = modularWorkout.workouts[0];
        allExercises = workoutDay.modules?.flatMap(module => module.exercises) || [];
      } else {
        // Legacy format
        allExercises = workoutData.json_plan.exercises || [];
      }

      if (allExercises.length === 0) {
        toast({
          title: "Warning", 
          description: "No exercises found in this workout",
          variant: "destructive"
        });
        return;
      }

      // Get or create workout_exercises for this workout
      const exercisePromises = allExercises.map(async (planExercise: any, index: number) => {
        // Handle different exercise ID formats
        const exerciseId = planExercise.exercise_id || planExercise.id;
        const exerciseName = planExercise.exercise_name || planExercise.name || `Exercise ${index + 1}`;

        if (!exerciseId) {
          console.warn(`Exercise at index ${index} missing ID:`, planExercise);
          return null;
        }

        // Check if workout_exercise already exists
        let { data: workoutExercise, error } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workoutData.id)
          .eq('exercise_id', exerciseId)
          .eq('position', index)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking workout_exercise:', error);
        }

        // Create if doesn't exist
        if (!workoutExercise) {
          const { data: newWorkoutExercise, error: insertError } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutData.id,
              exercise_id: exerciseId,
              position: index
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Error creating workout_exercise:', insertError);
            return null;
          }
          workoutExercise = newWorkoutExercise;
        }

        // Create initial empty sets based on the plan
        const initialSets: Set[] = Array.from({ length: planExercise.sets || 3 }, () => ({
          id: crypto.randomUUID(),
          weight: null,
          reps: null,
          rir: null
        }));

        return {
          id: exerciseId,
          name: exerciseName,
          primary_muscles: planExercise.primary_muscles || [],
          workout_exercise_id: workoutExercise.id,
          sets: initialSets,
          planData: {
            sets: planExercise.sets || 3,
            reps: planExercise.reps || '',
            rest: planExercise.rest || '',
            suggested_weight: planExercise.suggested_weight || '',
            notes: planExercise.notes || '',
            primary_muscles: planExercise.primary_muscles || []
          }
        };
      });

      const exercisesWithIds = (await Promise.all(exercisePromises)).filter(Boolean);
      setExercises(exercisesWithIds);

      if (exercisesWithIds.length === 0) {
        toast({
          title: "Error",
          description: "Failed to load any exercises. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error setting up exercises:', error);
      toast({
        title: "Error",
        description: "Failed to setup exercises. Workout may be corrupted.",
        variant: "destructive"
      });
    }
  };

  const addSet = (exerciseIndex: number) => {
    const newSet: Set = {
      id: crypto.randomUUID(),
      weight: null,
      reps: null,
      rir: null
    };

    setExercises(prev => prev.map((exercise, index) => 
      index === exerciseIndex 
        ? { ...exercise, sets: [...exercise.sets, newSet] }
        : exercise
    ));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof Set, value: number | null) => {
    setExercises(prev => prev.map((exercise, exIndex) => 
      exIndex === exerciseIndex 
        ? {
            ...exercise,
            sets: exercise.sets.map((set, sIndex) => 
              sIndex === setIndex 
                ? { ...set, [field]: value }
                : set
            )
          }
        : exercise
    ));
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises(prev => prev.map((exercise, index) => 
      index === exerciseIndex 
        ? { ...exercise, sets: exercise.sets.filter((_, sIndex) => sIndex !== setIndex) }
        : exercise
    ));
  };

  const handleVoiceData = (data: { 
    exerciseId: number; 
    setIndex: number; 
    weight: number | null; 
    reps: number | null; 
    rir: number | null;
  }) => {
    if (data.exerciseId && data.setIndex !== null) {
      // Find exercise by id
      const exerciseIndex = exercises.findIndex(ex => 
        ex.id === data.exerciseId
      );
      
      if (exerciseIndex !== -1 && exercises[exerciseIndex].sets[data.setIndex]) {
        if (data.weight !== null) {
          updateSet(exerciseIndex, data.setIndex, 'weight', data.weight);
        }
        if (data.reps !== null) {
          updateSet(exerciseIndex, data.setIndex, 'reps', data.reps);
        }
        if (data.rir !== null) {
          updateSet(exerciseIndex, data.setIndex, 'rir', data.rir);
        }
      }
    }
  };

  const exerciseList = exercises.map(ex => ({
    id: ex.id,
    name: ex.name
  }));

  const finishSession = useCallback(async () => {
    await executeOperation(
      async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Collect all sets to insert
        const setsToInsert = exercises.flatMap(exercise => 
          exercise.sets
            .filter(set => set.weight !== null || set.reps !== null)
            .map(set => ({
              workout_exercise_id: exercise.workout_exercise_id,
              weight: set.weight,
              reps: set.reps,
              rir: set.rir,
              performed_at: new Date().toISOString()
            }))
        );

        if (setsToInsert.length === 0) {
          throw new Error('Please add at least one set before finishing');
        }

        // Batch insert all sets
        const { error } = await supabase
          .from('sets')
          .insert(setsToInsert);

        if (error) throw error;

        // Mark the workout as completed
        const { error: workoutError } = await supabase
          .from('workouts')
          .update({ completed: true })
          .eq('id', workoutId);

        if (workoutError) {
          console.error('Error marking workout as completed:', workoutError);
          // Don't fail the whole operation for this
        }

        return { setCount: setsToInsert.length, exerciseCount: exercises.length };
      },
      'Saving workout session',
      {
        requireAuth: true,
        loadingMessage: 'Saving your session...',
        timeout: 60000, // Longer timeout for data saving
        onSuccess: (result) => {
          toast({
            title: "Session completed!",
            description: `Recorded ${result.setCount} sets across ${result.exerciseCount} exercises`
          });
          // Navigate to analytics dashboard
          navigate('/analytics');
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error,
            variant: "destructive"
          });
        }
      }
    );
  }, [exercises, workoutId, executeOperation, toast, navigate]);

  const getSessionDuration = () => {
    const now = new Date();
    const diffMs = now.getTime() - sessionStartTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleExerciseSubstitution = async (
    newExercise: { id: number; name: string; primary_muscles: string[] },
    reason: string
  ) => {
    if (selectedExerciseIndex === null) return;
    
    try {
      const originalExercise = exercises[selectedExerciseIndex];
      
      // Create a new workout_exercise entry for the substituted exercise
      const { data: newWorkoutExercise, error } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: workout!.id,
          exercise_id: newExercise.id,
          position: originalExercise.workout_exercise_id ? 
            exercises.length + selectedExerciseIndex : // Use a new position if substituting
            selectedExerciseIndex
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update the exercise in the local state with the new exercise details
      setExercises(prev => prev.map((exercise, index) => 
        index === selectedExerciseIndex 
          ? { 
              ...exercise,
              id: newExercise.id,
              name: newExercise.name,
              workout_exercise_id: newWorkoutExercise.id,
              planData: {
                ...exercise.planData!,
                primary_muscles: newExercise.primary_muscles
              }
            }
          : exercise
      ));

      toast({
        title: "Exercise substituted",
        description: `Switched from ${originalExercise.name} to ${newExercise.name}`,
      });

    } catch (error) {
      console.error('Error substituting exercise:', error);
      toast({
        title: "Error",
        description: "Failed to substitute exercise. Please try again.",
        variant: "destructive"
      });
    }
  };

  const openAssistant = (exerciseIndex: number) => {
    setSelectedExerciseIndex(exerciseIndex);
    setAssistantOpen(true);
  };

  // Show loading state
  if (loadingState.isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <LoadingState 
            isLoading={true} 
            message={loadingState.lastOperation || 'Loading workout...'}
          />
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (loadingState.error && !workout) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <ErrorDisplay
            error={loadingState.error}
            context="Loading Workout"
            canRetry={true}
            onRetry={() => retry(fetchWorkout, 'Loading workout')}
          />
          <Button onClick={() => navigate('/')} variant="outline" className="w-full mt-4">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-20' : 'pb-24'}`}>
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-40">
        <div className={`mx-auto ${isMobile ? 'px-3 py-3' : 'max-w-2xl p-4'}`}>
          <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'} justify-between`}>
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
              <Button
                variant="ghost"
                size={isMobile ? "sm" : "sm"}
                onClick={() => navigate('/')}
                className={isMobile ? "h-8 w-8 p-0" : ""}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {isMobile ? 'Session' : 'Workout Session'}
                </h1>
                <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {workout.program?.name}
                </p>
              </div>
            </div>
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
              {!isMobile && (
                <WorkoutVoiceInput 
                  exercises={exerciseList}
                  onDataReceived={handleVoiceData}
                />
              )}
              <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                <Timer className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                {getSessionDuration()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className={`mx-auto ${isMobile ? 'px-3 py-4 space-y-4' : 'max-w-2xl p-4 space-y-6'}`}>
        {exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.id} className={isMobile ? 'shadow-sm' : ''}>
            <CardHeader className={isMobile ? 'pb-2 px-4 pt-4' : 'pb-3'}>
              <div className="flex items-center justify-between">
                <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>
                  {exercise.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openAssistant(exerciseIndex)}
                    className={isMobile ? "h-8 px-2" : ""}
                  >
                    <MessageCircle className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                    {!isMobile && 'Modify'}
                  </Button>
                  <Badge variant="outline" className={isMobile ? 'text-xs' : ''}>
                    {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              {exercise.planData && (
                <div className={`space-y-1 text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  <div className={`flex flex-wrap ${isMobile ? 'gap-2' : 'gap-4'}`}>
                    <span><strong>Sets:</strong> {exercise.planData.sets}</span>
                    <span><strong>Reps:</strong> {exercise.planData.reps}</span>
                    <span><strong>Rest:</strong> {exercise.planData.rest}</span>
                  </div>
                  {exercise.planData.suggested_weight && (
                    <div><strong>Weight:</strong> {exercise.planData.suggested_weight}</div>
                  )}
                  {exercise.planData.notes && !isMobile && (
                    <div><strong>Notes:</strong> {exercise.planData.notes}</div>
                  )}
                  {(exercise.planData.primary_muscles || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {exercise.planData.primary_muscles.map((muscle, i) => (
                        <Badge key={i} variant="secondary" className={isMobile ? 'text-xs h-5' : 'text-xs'}>
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className={isMobile ? 'px-4 pb-4' : ''}>
              <ExerciseSetTable
                sets={exercise.sets}
                onUpdateSet={(setIndex, field, value) => updateSet(exerciseIndex, setIndex, field, value)}
                onRemoveSet={(setIndex) => removeSet(exerciseIndex, setIndex)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addSet(exerciseIndex)}
                className={`mt-3 w-full ${isMobile ? 'h-8 text-xs' : ''}`}
              >
                <Plus className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                Add Set
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating Finish Button */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t ${isMobile ? 'pb-6' : ''}`}>
        <div className={`mx-auto ${isMobile ? '' : 'max-w-2xl'}`}>
          <Button 
            onClick={finishSession}
            disabled={loadingState.isLoading}
            size={isMobile ? "default" : "lg"}
            className="w-full"
          >
            {loadingState.isLoading ? (
              <>
                <div className={`animate-spin rounded-full border-2 border-white border-t-transparent ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-2`}></div>
                {loadingState.lastOperation || 'Saving...'}
              </>
            ) : (
              <>
                <Check className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                Finish Session
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Voice Input */}
      {isMobile && (
        <div className="fixed bottom-20 right-4">
          <WorkoutVoiceInput 
            exercises={exerciseList}
            onDataReceived={handleVoiceData}
          />
        </div>
      )}

      {/* Workout Assistant */}
      {assistantOpen && selectedExerciseIndex !== null && (
        <WorkoutAssistant
          open={assistantOpen}
          onOpenChange={(open) => {
            setAssistantOpen(open);
            if (!open) setSelectedExerciseIndex(null);
          }}
          currentExercise={exercises[selectedExerciseIndex]}
          exerciseLibrary={exerciseLibrary}
          onExerciseSubstitute={handleExerciseSubstitution}
        />
      )}
    </div>
  );
};

export default SessionTracker;