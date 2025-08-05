import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

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

interface WorkoutListProps {
  workouts: Workout[];
  onWorkoutSchedule: (workoutId: string, date: Date | null) => void;
}

export const WorkoutList = ({ workouts, onWorkoutSchedule }: WorkoutListProps) => {
  const formatWorkoutTitle = (workout: Workout) => {
    if (workout.json_plan?.exercises) {
      const exerciseCount = workout.json_plan.exercises.length;
      return `${exerciseCount} exercises`;
    }
    return 'Workout';
  };

  const formatWorkoutDescription = (workout: Workout) => {
    if (workout.json_plan?.exercises) {
      const exercises = workout.json_plan.exercises.slice(0, 3);
      const exerciseNames = exercises.map((ex: any) => ex.name || ex.exercise?.name).filter(Boolean);
      const display = exerciseNames.join(', ');
      const remaining = workout.json_plan.exercises.length - 3;
      return remaining > 0 ? `${display}... +${remaining} more` : display;
    }
    return 'No exercises defined';
  };

  if (workouts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No unscheduled workouts available</p>
        <p className="text-sm mt-1">Generate a week or create new workouts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((workout) => (
        <Card
          key={workout.id}
          className="cursor-move hover:shadow-md transition-shadow group"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('workoutId', workout.id);
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge 
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${workout.program?.color}20` }}
                  >
                    {workout.program?.name}
                  </Badge>
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: workout.program?.color }}
                  />
                </div>
                
                <h4 className="font-medium text-sm mb-1">
                  {formatWorkoutTitle(workout)}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {formatWorkoutDescription(workout)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
        Drag workouts to calendar to schedule
      </div>
    </div>
  );
};