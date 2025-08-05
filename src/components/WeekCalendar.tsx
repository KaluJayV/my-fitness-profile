import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Play } from "lucide-react";

interface Program {
  id: string;
  name: string;
  color?: string;
}

interface Workout {
  id: string;
  program_id: string;
  workout_date: string | null;
  json_plan: any;
  program: Program;
}

interface WeekCalendarProps {
  currentWeek: Date;
  workouts: Workout[];
  onWorkoutSchedule: (workoutId: string, date: Date | null) => void;
}

export const WeekCalendar = ({ currentWeek, workouts, onWorkoutSchedule }: WeekCalendarProps) => {
  const navigate = useNavigate();
  const weekDays = useMemo(() => {
    const start = new Date(currentWeek);
    const day = start.getDay();
    const diff = start.getDate() - day;
    const weekStart = new Date(start.setDate(diff));
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  }, [currentWeek]);

  const getWorkoutsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return workouts.filter(w => w.workout_date === dateStr);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const workoutId = e.dataTransfer.getData('workoutId');
    if (workoutId) {
      onWorkoutSchedule(workoutId, date);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeWorkout = (workoutId: string) => {
    onWorkoutSchedule(workoutId, null);
  };

  const formatWorkoutTitle = (workout: Workout) => {
    if (workout.json_plan?.exercises) {
      const exerciseCount = workout.json_plan.exercises.length;
      return `${exerciseCount} exercises`;
    }
    return workout.program?.name || 'Workout';
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((date, index) => {
        const dayWorkouts = getWorkoutsForDate(date);
        const isToday = date.toDateString() === new Date().toDateString();
        
        return (
          <div key={index} className="min-h-32">
            <div className={`text-center p-2 text-sm font-medium ${
              isToday ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}>
              <div className="text-xs">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg ${isToday ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                {date.getDate()}
              </div>
            </div>
            
            <div
              className={`min-h-24 p-2 border-2 border-dashed rounded-lg transition-colors ${
                dayWorkouts.length > 0 ? 'border-transparent' : 'border-muted hover:border-primary/50'
              }`}
              onDrop={(e) => handleDrop(e, date)}
              onDragOver={handleDragOver}
            >
              <div className="space-y-1">
                {dayWorkouts.map((workout) => (
                    <Card 
                      key={workout.id} 
                      className="p-2 relative group cursor-pointer"
                      style={{ borderLeft: `3px solid ${workout.program?.color}` }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('workoutId', workout.id);
                      }}
                      onClick={() => navigate(`/workout/${workout.id}`)}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <Badge 
                              variant="secondary" 
                              className="text-xs mb-1 block w-fit"
                              style={{ backgroundColor: `${workout.program?.color}20` }}
                            >
                              {workout.program?.name}
                            </Badge>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatWorkoutTitle(workout)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/workout/${workout.id}`);
                              }}
                            >
                              <Play className="h-3 w-3 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeWorkout(workout.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};