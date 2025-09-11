import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkoutScheduler } from '@/components/WorkoutScheduler';
import { 
  Save, 
  Edit3, 
  RefreshCw, 
  Clock, 
  Target, 
  Trophy,
  Calendar,
  ChevronRight,
  Flame,
  Dumbbell,
  Snowflake,
  Zap
} from 'lucide-react';
import { 
  Exercise, 
  GeneratedWorkoutPlan, 
  WorkoutModule, 
  WorkoutExercise,
  WorkoutModuleType 
} from '@/types/workout';

interface ModularWorkoutDisplayProps {
  workout: GeneratedWorkoutPlan;
  onRevision: (prompt: string) => void;
  onSave: (schedules: any[]) => void;
  exercises: Exercise[];
}

const getModuleIcon = (type: WorkoutModuleType) => {
  switch (type) {
    case 'warmup':
      return <Flame className="h-4 w-4 text-orange-500" />;
    case 'main':
      return <Dumbbell className="h-4 w-4 text-primary" />;
    case 'core':
      return <Target className="h-4 w-4 text-red-500" />;
    case 'cooldown':
      return <Snowflake className="h-4 w-4 text-blue-500" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
};

const getModuleColor = (type: WorkoutModuleType) => {
  switch (type) {
    case 'warmup':
      return 'border-orange-200 bg-orange-50';
    case 'main':
      return 'border-primary/20 bg-primary/5';
    case 'core':
      return 'border-red-200 bg-red-50';
    case 'cooldown':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
};

export const ModularWorkoutDisplay: React.FC<ModularWorkoutDisplayProps> = ({
  workout,
  onRevision,
  onSave,
  exercises
}) => {
  const [activeDay, setActiveDay] = useState(0);
  const [showScheduler, setShowScheduler] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState('');

  const handleRevisionSubmit = () => {
    if (revisionPrompt.trim()) {
      onRevision(revisionPrompt);
      setRevisionPrompt('');
    }
  };

  const currentWorkout = workout.workouts[activeDay];

  if (showScheduler) {
    return (
      <WorkoutScheduler
        workout={workout}
        onSave={onSave}
        onCancel={() => setShowScheduler(false)}
        isOpen={showScheduler}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Workout Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {workout.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {workout.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {workout.difficulty}
              </Badge>
              <Badge variant="outline">
                {workout.days_per_week} days/week
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {workout.duration_weeks} weeks
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {workout.goals.join(', ')}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Day Navigation */}
      <Tabs value={activeDay.toString()} onValueChange={(value) => setActiveDay(parseInt(value))}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {workout.workouts.map((day, index) => (
            <TabsTrigger key={index} value={index.toString()} className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {day.day}
            </TabsTrigger>
          ))}
        </TabsList>

        {workout.workouts.map((day, dayIndex) => (
          <TabsContent key={dayIndex} value={dayIndex.toString()} className="space-y-4">
            {/* Day Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{day.name}</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {day.total_duration_minutes} min
                  </Badge>
                </CardTitle>
                <CardDescription>{day.description}</CardDescription>
              </CardHeader>
            </Card>

            {/* Workout Modules */}
            <div className="space-y-4">
              {day.modules
                .sort((a, b) => a.order - b.order)
                .map((module, moduleIndex) => (
                  <Card key={moduleIndex} className={getModuleColor(module.type)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getModuleIcon(module.type)}
                          <CardTitle className="text-lg">{module.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {module.duration_minutes} min
                        </Badge>
                      </div>
                      <CardDescription>{module.description}</CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3">
                        {module.exercises.map((exercise, exerciseIndex) => (
                          <div key={exerciseIndex} className="flex items-center justify-between p-3 bg-white/50 rounded-lg border">
                            <div className="flex-1">
                              <h4 className="font-medium">{exercise.exercise_name}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span>{exercise.sets} sets</span>
                                <span>{exercise.reps} reps</span>
                                <span>{exercise.rest} rest</span>
                                {exercise.suggested_weight && (
                                  <span className="font-medium text-primary">
                                    {exercise.suggested_weight}
                                  </span>
                                )}
                              </div>
                              {exercise.notes && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  {exercise.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {exercise.primary_muscles.map((muscle, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {muscle}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => setShowScheduler(true)} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Schedule & Save Workout
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onRevision('Make this workout more challenging')}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Modify
          </Button>
        </div>
      </div>

      {/* Quick Revision */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Revision</CardTitle>
          <CardDescription>
            Ask for specific changes to this workout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Add more core work, reduce intensity, focus on upper body..."
              value={revisionPrompt}
              onChange={(e) => setRevisionPrompt(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md"
              onKeyPress={(e) => e.key === 'Enter' && handleRevisionSubmit()}
            />
            <Button onClick={handleRevisionSubmit} disabled={!revisionPrompt.trim()}>
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};