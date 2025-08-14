import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";

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

export const TodayWorkouts = () => {
  const { user } = useAuth();
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayWorkouts = async () => {
      if (!user) return;

      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        
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
          .eq('workout_date', today);

        if (error) throw error;

        setTodayWorkouts(workouts || []);
      } catch (error) {
        console.error('Error fetching today workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayWorkouts();
  }, [user]);

  const formatWorkoutTitle = (workout: Workout) => {
    if (workout.json_plan?.exercises?.length) {
      const exerciseCount = workout.json_plan.exercises.length;
      return `${exerciseCount} Exercise${exerciseCount !== 1 ? 's' : ''}`;
    }
    return workout.program?.name || 'Workout';
  };

  const getWorkoutDetails = (workout: Workout) => {
    if (workout.json_plan?.exercises?.length) {
      return workout.json_plan.exercises.map((ex: any) => ({
        name: ex.name,
        sets: ex.sets || [],
        targetMuscles: ex.target_muscles || []
      }));
    }
    return [];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Workouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (todayWorkouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Workouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No workouts scheduled for today</p>
            <Button asChild className="mt-3" size="sm">
              <Link to="/generator">Generate Workout</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Today's Workouts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {todayWorkouts.map((workout) => (
            <div key={workout.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{formatWorkoutTitle(workout)}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {workout.program?.name}
                    </Badge>
                  </div>
                  {getWorkoutDetails(workout).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {getWorkoutDetails(workout).map((exercise, index) => (
                        <div key={index} className="bg-muted/30 rounded-md p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{exercise.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {exercise.sets.length > 0 
                                ? `${exercise.sets.length} set${exercise.sets.length !== 1 ? 's' : ''}`
                                : 'Sets TBD'
                              }
                            </span>
                          </div>
                          {exercise.sets.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {exercise.sets.map((set: any, setIndex: number) => (
                                <span key={setIndex} className="mr-2">
                                  {set.reps ? `${set.reps} reps` : 'Reps TBD'}
                                  {set.weight && ` @ ${set.weight}kg`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/workout/${workout.id}`}>
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};