import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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
      return exerciseCount === 1 ? "1 Ex" : `${exerciseCount} Ex`;
    }
    return workout.program?.name || 'Workout';
  };

  const getWorkoutDetails = (workout: Workout) => {
    if (workout.json_plan?.exercises?.length) {
      return workout.json_plan.exercises.map((ex: any) => {
        // Handle different possible data structures
        const exerciseName = ex.name || ex.exercise_name || ex.exercise?.name || 'Unknown Exercise';
        const shortName = exerciseName.length > 15 ? exerciseName.substring(0, 12) + "..." : exerciseName;
        const sets = ex.sets || ex.planned_sets || ex.target_sets || 3;
        const reps = ex.reps || ex.planned_reps || ex.target_reps || ex.rep_range || "8-12";
        const weight = ex.weight || ex.planned_weight || ex.target_weight;
        
        return {
          name: shortName,
          sets: sets,
          reps: reps,
          weight: weight,
          targetMuscles: ex.target_muscles || ex.primary_muscles || []
        };
      });
    }
    return [];
  };

  const formatSetsReps = (sets: any, reps: any) => {
    const setsCount = typeof sets === 'number' ? sets : (Array.isArray(sets) ? sets.length : 3);
    const repsDisplay = typeof reps === 'string' ? reps : 
                       typeof reps === 'number' ? reps.toString() :
                       Array.isArray(reps) ? `${Math.min(...reps)}-${Math.max(...reps)}` : "8-12";
    return `${setsCount}×${repsDisplay}`;
  };

  const getWorkoutTimeEstimate = (workout: Workout) => {
    // Check for time estimate in various possible locations
    const timeEstimate = workout.json_plan?.estimated_duration || 
                        workout.json_plan?.duration || 
                        workout.json_plan?.time_estimate;
    
    if (timeEstimate) {
      return typeof timeEstimate === 'number' ? `${timeEstimate}min` : timeEstimate;
    }
    
    // Calculate estimate based on exercises (rough estimate: 3-4 min per set + rest)
    const exercises = getWorkoutDetails(workout);
    if (exercises.length > 0) {
      const totalSets = exercises.reduce((total, ex) => {
        const sets = typeof ex.sets === 'number' ? ex.sets : 3;
        return total + sets;
      }, 0);
      const estimatedMinutes = Math.round(totalSets * 3.5); // 3.5 min per set average
      return `~${estimatedMinutes}min`;
    }
    
    return "30-45min";
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
      <CardHeader className={isMobile ? "p-3" : ""}>
        <CardTitle className={`flex items-center gap-2 ${isMobile ? "text-lg" : ""}`}>
          <Calendar className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
          Today's Workouts
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "p-3 pt-0" : ""}>
        <div className={isMobile ? "space-y-2" : "space-y-3"}>
          {todayWorkouts.map((workout) => (
            <div key={workout.id} className={`border rounded-lg ${isMobile ? "p-3" : "p-4"} hover:bg-muted/50 transition-colors`}>
              <div className={`flex items-center gap-2 ${isMobile ? "mb-2" : "mb-3"}`}>
                <h4 className={`font-medium ${isMobile ? "text-sm" : ""}`}>{formatWorkoutTitle(workout)}</h4>
                <Badge variant="secondary" className="text-xs">
                  {workout.program?.name}
                </Badge>
                <Badge variant="outline" className="text-xs ml-auto">
                  {getWorkoutTimeEstimate(workout)}
                </Badge>
              </div>
              
              {getWorkoutDetails(workout).length > 0 && (
                <div className={`${isMobile ? "space-y-1 mb-3" : "space-y-2 mb-4"}`}>
                  {getWorkoutDetails(workout).map((exercise, index) => (
                    <div key={index} className={`bg-muted/30 rounded-md ${isMobile ? "p-1.5" : "p-2"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{exercise.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatSetsReps(exercise.sets, exercise.reps)}
                        </Badge>
                      </div>
                      {exercise.weight && (
                        <div className={`mt-1 text-muted-foreground ${isMobile ? "text-xs" : "text-xs"}`}>
                          {exercise.weight}kg
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <Button asChild size={isMobile ? "sm" : "sm"} className="w-full">
                <Link to={`/workout/${workout.id}`}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Workout
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};