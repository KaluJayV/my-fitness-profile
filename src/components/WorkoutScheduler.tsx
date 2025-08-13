import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, addDays, addWeeks, startOfWeek, eachDayOfInterval } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, Save, RefreshCw } from 'lucide-react';

interface WorkoutDay {
  day: string;
  name: string;
  description: string;
  exercises: any[];
}

interface GeneratedWorkoutPlan {
  id?: string;
  name: string;
  description: string;
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  workouts: WorkoutDay[];
}

interface WorkoutSchedule {
  workoutIndex: number;
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
}

interface WorkoutSchedulerProps {
  workout: GeneratedWorkoutPlan;
  onSave: (schedules: WorkoutSchedule[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const WorkoutScheduler: React.FC<WorkoutSchedulerProps> = ({
  workout,
  onSave,
  onCancel,
  isOpen
}) => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [workoutDayMappings, setWorkoutDayMappings] = useState<{ [key: number]: number }>({});
  const [generatedSchedule, setGeneratedSchedule] = useState<WorkoutSchedule[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize default mappings based on workout day names
  const initializeDefaultMappings = () => {
    const mappings: { [key: number]: number } = {};
    workout.workouts.forEach((workoutDay, index) => {
      const dayName = workoutDay.day.toLowerCase();
      const dayIndex = DAYS_OF_WEEK.findIndex(d => d.toLowerCase().includes(dayName));
      if (dayIndex !== -1) {
        mappings[index] = dayIndex;
      }
    });
    setWorkoutDayMappings(mappings);
  };

  React.useEffect(() => {
    initializeDefaultMappings();
  }, [workout]);

  const generateSchedule = () => {
    const schedules: WorkoutSchedule[] = [];
    const weekStart = startOfWeek(startDate);

    for (let week = 0; week < workout.duration_weeks; week++) {
      const weekStartDate = addWeeks(weekStart, week);
      
      workout.workouts.forEach((workoutDay, workoutIndex) => {
        const assignedDayOfWeek = workoutDayMappings[workoutIndex];
        if (assignedDayOfWeek !== undefined) {
          const workoutDate = addDays(weekStartDate, assignedDayOfWeek);
          schedules.push({
            workoutIndex,
            date: workoutDate,
            dayOfWeek: assignedDayOfWeek
          });
        }
      });
    }

    setGeneratedSchedule(schedules);
    setShowPreview(true);
  };

  const updateWorkoutDayMapping = (workoutIndex: number, dayOfWeek: number) => {
    setWorkoutDayMappings(prev => ({
      ...prev,
      [workoutIndex]: dayOfWeek
    }));
  };

  const handleSave = () => {
    onSave(generatedSchedule);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Your Workout Plan
          </DialogTitle>
          <DialogDescription>
            Choose when to start and which days to perform each workout
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="max-h-[calc(90vh-160px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Left Side - Workout Plan Overview */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{workout.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={getDifficultyColor(workout.difficulty)}>
                        {workout.difficulty}
                      </Badge>
                      <Badge variant="outline">
                        {workout.duration_weeks} weeks
                      </Badge>
                      <Badge variant="outline">
                        {workout.days_per_week} days/week
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Start Date</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Side - Day Mapping */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Assign Workout Days</CardTitle>
                    <CardDescription>
                      Map each workout to a day of the week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {workout.workouts.map((workoutDay, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{workoutDay.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {workoutDay.exercises.length} exercises
                            </p>
                          </div>
                          <Select
                            value={workoutDayMappings[index]?.toString() || ''}
                            onValueChange={(value) => updateWorkoutDayMapping(index, parseInt(value))}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Day" />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, dayIndex) => (
                                <SelectItem key={dayIndex} value={dayIndex.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Button onClick={generateSchedule} className="flex-1">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Generate Schedule
                      </Button>
                      <Button variant="outline" onClick={initializeDefaultMappings}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule Preview */}
                {showPreview && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Schedule Preview</CardTitle>
                      <CardDescription>
                        {generatedSchedule.length} workouts over {workout.duration_weeks} weeks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {generatedSchedule.slice(0, 14).map((schedule, index) => (
                            <div key={index} className="flex justify-between items-center p-2 border rounded text-sm">
                              <span className="font-medium">
                                {workout.workouts[schedule.workoutIndex].name}
                              </span>
                              <span className="text-muted-foreground">
                                {format(schedule.date, 'MMM d, yyyy')} ({DAYS_OF_WEEK[schedule.dayOfWeek]})
                              </span>
                            </div>
                          ))}
                          {generatedSchedule.length > 14 && (
                            <div className="text-center text-sm text-muted-foreground py-2">
                              ... and {generatedSchedule.length - 14} more workouts
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSave} className="flex-1">
                          <Save className="h-4 w-4 mr-2" />
                          Save to Calendar
                        </Button>
                        <Button variant="outline" onClick={onCancel}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};