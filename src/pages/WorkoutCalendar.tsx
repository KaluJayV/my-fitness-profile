import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { NavigationHeader } from "@/components/NavigationHeader";
import { ChevronLeft, ChevronRight, Play, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";

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
    if (workout.json_plan?.exercises?.length) {
      const exerciseCount = workout.json_plan.exercises.length;
      return `${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`;
    }
    return workout.program?.name || 'Workout';
  };

  const getExerciseNames = (workout: Workout) => {
    if (workout.json_plan?.exercises?.length) {
      return workout.json_plan.exercises.slice(0, 2).map((ex: any) => ex.name);
    }
    return [];
  };

  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  const hasWorkoutsOnDate = (date: Date) => {
    return getWorkoutsForDate(date).length > 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      <div className="container mx-auto p-6">
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
                <CardTitle>
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                </CardTitle>
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
                                {workout.json_plan?.exercises?.length > 2 && 
                                  ` +${workout.json_plan.exercises.length - 2} more`
                                }
                              </p>
                            )}
                          </div>
                        </div>
                        <Button asChild size="sm" className="w-full">
                          <Link to={`/workout/${workout.id}`}>
                            <Play className="h-4 w-4 mr-1" />
                            Start Workout
                          </Link>
                        </Button>
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