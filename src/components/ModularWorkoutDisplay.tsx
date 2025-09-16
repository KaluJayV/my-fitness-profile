import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Zap,
  AlertTriangle,
  BarChart,
  Activity
} from 'lucide-react';
import { 
  Exercise, 
  GeneratedWorkoutPlan, 
  WorkoutModule, 
  WorkoutExercise,
  WorkoutModuleType 
} from '@/types/workout';
import { validateWorkoutData, calculateWorkoutStats, validateExercises } from '@/utils/workoutDataUtils';

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
  workout: rawWorkout,
  onRevision,
  onSave,
  exercises
}) => {
  const [activeDay, setActiveDay] = useState(0);
  const [showScheduler, setShowScheduler] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState('');

  // Validate and convert workout data
  const validatedWorkout = useMemo(() => {
    const validated = validateWorkoutData(rawWorkout);
    if (!validated) {
      console.error('Invalid workout data:', rawWorkout);
      return null;
    }
    return validateExercises(validated, exercises);
  }, [rawWorkout, exercises]);

  // Calculate workout statistics
  const workoutStats = useMemo(() => {
    if (!validatedWorkout) return null;
    return calculateWorkoutStats(validatedWorkout);
  }, [validatedWorkout]);

  const handleRevisionSubmit = () => {
    if (revisionPrompt.trim()) {
      onRevision(revisionPrompt);
      setRevisionPrompt('');
    }
  };

  // Handle invalid workout data
  if (!validatedWorkout) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to display workout plan. The data format is invalid or corrupted. Please try generating a new workout.
        </AlertDescription>
      </Alert>
    );
  }

  const currentWorkout = validatedWorkout.workouts[activeDay];

  if (showScheduler) {
    return (
      <WorkoutScheduler
        workout={validatedWorkout}
        onSave={onSave}
        onCancel={() => setShowScheduler(false)}
        isOpen={showScheduler}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Workout Header with Statistics */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {validatedWorkout.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {validatedWorkout.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {validatedWorkout.difficulty}
              </Badge>
              <Badge variant="outline">
                {validatedWorkout.days_per_week} days/week
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {validatedWorkout.duration_weeks} weeks
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {validatedWorkout.goals.join(', ')}
              </span>
            </div>
            {workoutStats && (
              <>
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {workoutStats.totalExercises} exercises
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {workoutStats.uniqueMuscleGroups} muscle groups
                  </span>
                </div>
              </>
            )}
          </div>
          
          {/* Quick Stats Summary */}
          {workoutStats && (
            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{workoutStats.totalExercises}</div>
                  <div className="text-xs text-muted-foreground">Total Exercises</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{workoutStats.totalModules}</div>
                  <div className="text-xs text-muted-foreground">Workout Modules</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{workoutStats.averageDuration}m</div>
                  <div className="text-xs text-muted-foreground">Avg Duration</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{workoutStats.uniqueMuscleGroups}</div>
                  <div className="text-xs text-muted-foreground">Muscle Groups</div>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Day Navigation */}
      <Tabs value={activeDay.toString()} onValueChange={(value) => setActiveDay(parseInt(value))}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {validatedWorkout.workouts.map((day, index) => (
            <TabsTrigger key={index} value={index.toString()} className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {day.day}
            </TabsTrigger>
          ))}
        </TabsList>

        {validatedWorkout.workouts.map((day, dayIndex) => (
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
            <div className="space-y-6">
              {/* Quick Exercise Overview */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    Exercise Overview for {day.day}
                  </CardTitle>
                  <CardDescription>
                    {(day.modules || []).reduce((total, module) => total + module.exercises.length, 0)} exercises across {(day.modules || []).length} modules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(day.modules || [])
                      .sort((a, b) => a.order - b.order)
                      .flatMap(module => module.exercises)
                      .map((exercise, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg border border-primary/10">
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm">{exercise.exercise_name}</h5>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="font-medium">{exercise.sets}×{exercise.reps}</span>
                              <span>{exercise.rest}</span>
                              {exercise.suggested_weight && (
                                <span className="text-primary font-medium">
                                  {exercise.suggested_weight}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {(exercise.primary_muscles || []).slice(0, 2).map((muscle, i) => (
                                <Badge key={i} variant="outline" className="text-xs h-5">
                                  {muscle}
                                </Badge>
                              ))}
                              {(exercise.primary_muscles || []).length > 2 && (
                                <Badge variant="outline" className="text-xs h-5">
                                  +{(exercise.primary_muscles || []).length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Modules */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Detailed Workout Modules
                </h3>
                {(day.modules || [])
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
                            <div key={exerciseIndex} className="flex items-start justify-between p-4 bg-white/50 rounded-lg border">
                              <div className="flex-1">
                                <h4 className="font-semibold text-base">{exercise.exercise_name}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-muted-foreground">Sets:</span>
                                    <span className="font-semibold">{exercise.sets}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-muted-foreground">Reps:</span>
                                    <span className="font-semibold">{exercise.reps}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-muted-foreground">Rest:</span>
                                    <span className="font-semibold">{exercise.rest}</span>
                                  </div>
                                  {exercise.suggested_weight && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-muted-foreground">Weight:</span>
                                      <span className="font-semibold text-primary">
                                        {exercise.suggested_weight}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {exercise.notes && (
                                  <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                                    <span className="font-medium">Notes:</span> {exercise.notes}
                                  </div>
                                )}
                              </div>
                              <div className="ml-4 flex flex-col gap-1">
                                <span className="text-xs font-medium text-muted-foreground">Target Muscles:</span>
                                <div className="flex flex-wrap gap-1">
                                  {(exercise.primary_muscles || []).map((muscle, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {muscle}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
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