import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, ArrowLeft, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExerciseSetTable } from "@/components/ExerciseSetTable";
import { WorkoutVoiceInput } from "@/components/WorkoutVoiceInput";
import { useIsMobile } from "@/hooks/use-mobile";

interface Set {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
}

interface Exercise {
  id: number;
  name: string;
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
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (workoutId) {
      fetchWorkout();
    }
  }, [workoutId]);

  const fetchWorkout = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          programs (
            name
          )
        `)
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Workout not found');

      const workoutWithProgram = {
        ...data,
        program: data.programs
      };

      setWorkout(workoutWithProgram);
      await setupExercises(workoutWithProgram);
    } catch (error) {
      console.error('Error fetching workout:', error);
      toast({
        title: "Error",
        description: "Failed to load workout",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const setupExercises = async (workoutData: Workout) => {
    if (!workoutData.json_plan?.exercises) return;

    try {
      // Get or create workout_exercises for this workout
      const exercisePromises = workoutData.json_plan.exercises.map(async (planExercise: any, index: number) => {
        // Check if workout_exercise already exists
        let { data: workoutExercise, error } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workoutData.id)
          .eq('exercise_id', planExercise.exercise_id || planExercise.id)
          .eq('position', index)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        // Create if doesn't exist
        if (!workoutExercise) {
          const { data: newWorkoutExercise, error: insertError } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutData.id,
              exercise_id: planExercise.exercise_id || planExercise.id,
              position: index
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
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
          id: planExercise.exercise_id || planExercise.id,
          name: planExercise.exercise_name || planExercise.name || planExercise.exercise?.name || `Exercise ${index + 1}`,
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

      const exercisesWithIds = await Promise.all(exercisePromises);
      setExercises(exercisesWithIds);
    } catch (error) {
      console.error('Error setting up exercises:', error);
      toast({
        title: "Error",
        description: "Failed to setup exercises",
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

  const finishSession = async () => {
    setSaving(true);
    try {
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
        toast({
          title: "No sets recorded",
          description: "Please add at least one set before finishing",
          variant: "destructive"
        });
        return;
      }

      // Batch insert all sets
      const { error } = await supabase
        .from('sets')
        .insert(setsToInsert);

      if (error) throw error;

      toast({
        title: "Session completed!",
        description: `Recorded ${setsToInsert.length} sets across ${exercises.length} exercises`
      });

      // Navigate to analytics dashboard
      navigate('/analytics');
    } catch (error) {
      console.error('Error saving session:', error);
      toast({
        title: "Error",
        description: "Failed to save workout session",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getSessionDuration = () => {
    const now = new Date();
    const diffMs = now.getTime() - sessionStartTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Workout not found</h2>
          <Button onClick={() => navigate('/')}>
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
                <Badge variant="outline" className={isMobile ? 'text-xs' : ''}>
                  {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                </Badge>
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
                  {exercise.planData.primary_muscles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <strong>Muscles:</strong>
                      {exercise.planData.primary_muscles.slice(0, isMobile ? 2 : 4).map((muscle, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {muscle}
                        </Badge>
                      ))}
                      {isMobile && exercise.planData.primary_muscles.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{exercise.planData.primary_muscles.length - 2}
                        </Badge>
                      )}
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
                className={`w-full ${isMobile ? 'mt-2 h-9 text-sm' : 'mt-3'}`}
                onClick={() => addSet(exerciseIndex)}
              >
                <Plus className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
                Add Set
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Voice Input for Mobile */}
      {isMobile && (
        <div className="fixed bottom-16 right-4 z-40">
          <WorkoutVoiceInput 
            exercises={exerciseList}
            onDataReceived={handleVoiceData}
          />
        </div>
      )}

      {/* Floating Finish Button */}
      <div className={`fixed ${isMobile ? 'bottom-4 left-4 right-4' : 'bottom-6 left-1/2 transform -translate-x-1/2'} z-50`}>
        <Button
          size={isMobile ? "default" : "lg"}
          onClick={finishSession}
          disabled={saving || exercises.every(ex => ex.sets.length === 0)}
          className={`${isMobile ? 'w-full h-12 text-base' : 'px-8 py-3'} shadow-lg`}
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Check className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
              Finish Workout
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SessionTracker;