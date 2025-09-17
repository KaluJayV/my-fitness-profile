import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { AppHeader } from "@/components/AppHeader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Play, Dumbbell, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ensureModularFormat } from "@/utils/workoutSerializer";

interface Program {
  id: string;
  name: string;
}

interface Workout {
  id: string;
  workout_date: string | null;
  json_plan: any;
  program: Program;
}

const WorkoutCalendar = () => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchWorkouts();
  }, [user, currentMonth]);

  const fetchWorkouts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          workout_date,
          json_plan,
          program:programs(
            id,
            name
          )
        `)
        .gte('workout_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('workout_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('workout_date', { ascending: true });

      if (error) throw error;

      setWorkouts(workouts || []);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(workout => 
      workout.workout_date && isSameDay(new Date(workout.workout_date), date)
    );
  };

  const formatWorkoutTitle = (workout: Workout) => {
    // Ensure we have modular format for consistent display
    const modularWorkout = ensureModularFormat({ workouts: [workout.json_plan] });
    const workoutDay = modularWorkout.workouts[0];
    
    if (workoutDay?.modules) {
      const exerciseCount = workoutDay.modules.reduce((total, module) => total + module.exercises.length, 0);
      return `${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`;
    }
    return workout.program?.name || 'Workout';
  };

  const getExerciseNames = (workout: Workout) => {
    // Ensure we have modular format for consistent display
    const modularWorkout = ensureModularFormat({ workouts: [workout.json_plan] });
    const workoutDay = modularWorkout.workouts[0];
    
    if (workoutDay?.modules) {
      const exercises = workoutDay.modules.flatMap(module => module.exercises);
      return exercises.slice(0, 2).map((ex: any) => ex.exercise_name);
    }
    return [];
  };

  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  const hasWorkoutsOnDate = (date: Date) => {
    return getWorkoutsForDate(date).length > 0;
  };

  const deleteWorkout = async (workoutId: string) => {
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId);

      if (error) throw error;

      toast.success('Workout deleted successfully');
      fetchWorkouts(); // Refresh the list
    } catch (error) {
      console.error('Error deleting workout:', error);
      toast.error('Failed to delete workout');
    }
  };

  const deleteProgramWorkouts = async (programId: string) => {
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('program_id', programId);

      if (error) throw error;

      toast.success('All program workouts deleted successfully');
      fetchWorkouts(); // Refresh the list
    } catch (error) {
      console.error('Error deleting program workouts:', error);
      toast.error('Failed to delete program workouts');
    }
  };

  // Get unique programs from selected date workouts
  const getUniqueProgramsForDate = (date: Date) => {
    const dayWorkouts = getWorkoutsForDate(date);
    const programs = new Map();
    
    dayWorkouts.forEach(workout => {
      if (workout.program) {
        programs.set(workout.program.id, workout.program);
      }
    });
    
    return Array.from(programs.values());
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Workout Calendar" showBack={true} />
      
      <div className="container mx-auto p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Workout Calendar</h1>
          <p className="text-muted-foreground">View and manage your scheduled workouts</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-md border"
                  modifiers={{
                    hasWorkout: (date) => hasWorkoutsOnDate(date)
                  }}
                  modifiersStyles={{
                    hasWorkout: {
                      backgroundColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      fontWeight: 'bold'
                    }
                  }}
                />
                <div className="mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary"></div>
                    <span>Days with workouts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Workouts */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                  </CardTitle>
                  {selectedDate && selectedDateWorkouts.length > 0 && (
                    <div className="flex gap-2">
                      {getUniqueProgramsForDate(selectedDate).map((program) => (
                        <AlertDialog key={program.id}>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Delete {program.name}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Program Workouts</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete all workouts from the "{program.name}" program? This will remove all scheduled workouts for this program across all dates. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProgramWorkouts(program.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete All
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : selectedDateWorkouts.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateWorkouts.map((workout) => (
                      <div key={workout.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{formatWorkoutTitle(workout)}</h4>
                            </div>
                            <Badge variant="secondary" className="text-xs mb-2">
                              {workout.program?.name}
                            </Badge>
                            {getExerciseNames(workout).length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {getExerciseNames(workout).join(', ')}
                                {(() => {
                                  const modularWorkout = ensureModularFormat({ workouts: [workout.json_plan] });
                                  const exerciseCount = modularWorkout.workouts[0]?.modules?.reduce((total, module) => total + module.exercises.length, 0) || 0;
                                  return exerciseCount > 2 ? ` +${exerciseCount - 2} more` : '';
                                })()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm" className="flex-1 h-9">
                            <Link to={`/session-tracker/${workout.id}`}>
                              <Play className="h-4 w-4 mr-1" />
                              Start Workout
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="h-9">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Workout</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this workout? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteWorkout(workout.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No workouts scheduled</p>
                    <Button asChild className="mt-3" size="sm">
                      <Link to="/generator">Generate Workout</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutCalendar;