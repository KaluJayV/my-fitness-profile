import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar as CalendarIcon, Clock, MapPin, Save, RefreshCw } from 'lucide-react';
import { GeneratedWorkoutPlan } from '@/types/workout';
import { format, addDays, startOfWeek } from 'date-fns';

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
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [generatedSchedule, setGeneratedSchedule] = useState<WorkoutSchedule[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Initialize with default days based on workout plan
    const defaultDays = [];
    for (let i = 1; i <= workout.days_per_week && i <= 7; i++) {
      defaultDays.push(i); // Start with Monday (1), Tuesday (2), etc.
    }
    setSelectedDays(defaultDays);
  }, [workout.days_per_week]);

  const generateSchedule = () => {
    if (selectedDays.length === 0) {
      toast({
        title: "No days selected",
        description: "Please select at least one day of the week",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    const schedule: WorkoutSchedule[] = [];
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 }); // Start week on Sunday
    
    // Generate schedule for the specified duration
    const totalWeeks = workout.duration_weeks;
    const workoutTypes = workout.workouts;
    let workoutIndex = 0;

    for (let week = 0; week < totalWeeks; week++) {
      selectedDays.forEach(dayOfWeek => {
        const date = addDays(weekStart, week * 7 + dayOfWeek);
        
        schedule.push({
          workoutIndex: workoutIndex % workoutTypes.length,
          date,
          dayOfWeek
        });
        
        workoutIndex++;
      });
    }

    setGeneratedSchedule(schedule);
    setIsGenerating(false);
  };

  const handleSave = async () => {
    if (generatedSchedule.length === 0) {
      toast({
        title: "No schedule generated",
        description: "Please generate a schedule first",
        variant: "destructive"
      });
      return;
    }

    try {
      onSave(generatedSchedule);
      toast({
        title: "Success",
        description: `Scheduled ${generatedSchedule.length} workouts!`,
      });
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save schedule",
        variant: "destructive"
      });
    }
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Workout Plan
          </DialogTitle>
          <DialogDescription>
            Plan your {workout.name} schedule for the next {workout.duration_weeks} weeks
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 p-1">
            {/* Workout Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{workout.name}</CardTitle>
                <CardDescription>{workout.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{workout.duration_weeks}</p>
                    <p className="text-sm text-muted-foreground">Weeks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{workout.days_per_week}</p>
                    <p className="text-sm text-muted-foreground">Days/Week</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{workout.workouts.length}</p>
                    <p className="text-sm text-muted-foreground">Workout Types</p>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {workout.difficulty}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Day Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Workout Days</CardTitle>
                <CardDescription>
                  Choose {workout.days_per_week} days per week for your workouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <Button
                      key={index}
                      variant={selectedDays.includes(index) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(index)}
                      className="flex flex-col h-12"
                    >
                      <span className="text-xs">{day.slice(0, 3)}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedDays.length} days ({selectedDays.map(d => DAYS_OF_WEEK[d]).join(', ')})
                </p>
              </CardContent>
            </Card>

            {/* Start Date Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Start Date</CardTitle>
                <CardDescription>When do you want to begin this program?</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="date"
                  value={format(startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="w-full p-2 border rounded-md"
                />
              </CardContent>
            </Card>

            {/* Generate Schedule */}
            <div className="flex gap-2">
              <Button 
                onClick={generateSchedule} 
                disabled={isGenerating || selectedDays.length === 0}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Generate Schedule
                  </>
                )}
              </Button>
            </div>

            {/* Generated Schedule Preview */}
            <div className="space-y-4">
              {generatedSchedule.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Generated Schedule</span>
                      <Badge variant="secondary">
                        {generatedSchedule.length} workouts
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Preview of your workout schedule for the next {workout.duration_weeks} weeks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};