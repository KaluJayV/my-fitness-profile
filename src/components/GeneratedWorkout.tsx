import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Minus,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface Exercise {
  id: number;
  name: string;
  primary_muscles: string[];
  gif_url?: string;
}

interface WorkoutExercise {
  exercise_id: number;
  exercise_name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  primary_muscles: string[];
}

interface WorkoutDay {
  day: string;
  name: string;
  description: string;
  exercises: WorkoutExercise[];
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

interface GeneratedWorkoutProps {
  workout: GeneratedWorkoutPlan;
  onRevision: (prompt: string) => void;
  onSave: (schedules: any[]) => void;
  exercises: Exercise[];
}

export const GeneratedWorkout: React.FC<GeneratedWorkoutProps> = ({
  workout,
  onRevision,
  onSave,
  exercises
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWorkout, setEditedWorkout] = useState<GeneratedWorkoutPlan>(workout);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [showScheduler, setShowScheduler] = useState(false);

  const handleRevisionSubmit = () => {
    if (revisionPrompt.trim()) {
      onRevision(revisionPrompt);
      setRevisionPrompt('');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, field: string, value: any) => {
    const updated = { ...editedWorkout };
    updated.workouts[dayIndex].exercises[exerciseIndex] = {
      ...updated.workouts[dayIndex].exercises[exerciseIndex],
      [field]: value
    };
    setEditedWorkout(updated);
  };

  const addExercise = (dayIndex: number) => {
    const updated = { ...editedWorkout };
    const newExercise: WorkoutExercise = {
      exercise_id: 0,
      exercise_name: 'Select Exercise',
      sets: 3,
      reps: '8-12',
      rest: '60s',
      notes: '',
      primary_muscles: []
    };
    updated.workouts[dayIndex].exercises.push(newExercise);
    setEditedWorkout(updated);
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updated = { ...editedWorkout };
    updated.workouts[dayIndex].exercises.splice(exerciseIndex, 1);
    setEditedWorkout(updated);
  };

  const getExerciseDetails = (exerciseId: number) => {
    return exercises.find(ex => ex.id === exerciseId);
  };

  return (
    <div className="space-y-6">
      {/* Workout Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                {workout.name}
              </CardTitle>
              <CardDescription className="text-base">
                {workout.description}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditing ? 'View Mode' : 'Edit Mode'}
              </Button>
              <Button onClick={() => setShowScheduler(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule & Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold">{workout.duration_weeks} Weeks</p>
              <p className="text-sm text-muted-foreground">Duration</p>
            </div>
            <div className="text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold">{workout.days_per_week} Days/Week</p>
              <p className="text-sm text-muted-foreground">Frequency</p>
            </div>
            <div className="text-center">
              <Target className="h-8 w-8 text-primary mx-auto mb-2" />
              <Badge className={getDifficultyColor(workout.difficulty)}>
                {workout.difficulty}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">Difficulty</p>
            </div>
            <div className="text-center">
              <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold">{workout.workouts.length} Workouts</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Goals</h4>
            <div className="flex flex-wrap gap-2">
              {workout.goals.map((goal, index) => (
                <Badge key={index} variant="secondary">
                  {goal}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Workout Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeDay.toString()} onValueChange={(value) => setActiveDay(parseInt(value))}>
            <TabsList className="grid grid-cols-1 md:grid-cols-4 h-auto gap-2 bg-transparent">
              {workout.workouts.map((day, index) => (
                <TabsTrigger 
                  key={index} 
                  value={index.toString()}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground p-4 h-auto flex-col"
                >
                  <div className="font-semibold">{day.day}</div>
                  <div className="text-xs opacity-80">{day.name}</div>
                </TabsTrigger>
              ))}
            </TabsList>

            {workout.workouts.map((day, dayIndex) => (
              <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{day.name}</span>
                      {isEditing && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => addExercise(dayIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Exercise
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription>{day.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {day.exercises.map((exercise, exerciseIndex) => {
                        const exerciseDetails = getExerciseDetails(exercise.exercise_id);
                        
                        return (
                          <Card key={exerciseIndex} className="border-l-4 border-l-primary">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-lg">
                                    {exerciseIndex + 1}. {exercise.exercise_name}
                                  </h4>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {exercise.primary_muscles.map((muscle, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {muscle}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                {isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExercise(dayIndex, exerciseIndex)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Sets:</span>
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      value={exercise.sets}
                                      onChange={(e) => updateExercise(dayIndex, exerciseIndex, 'sets', parseInt(e.target.value))}
                                      className="mt-1"
                                    />
                                  ) : (
                                    <p className="mt-1">{exercise.sets}</p>
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium">Reps:</span>
                                  {isEditing ? (
                                    <Input
                                      value={exercise.reps}
                                      onChange={(e) => updateExercise(dayIndex, exerciseIndex, 'reps', e.target.value)}
                                      className="mt-1"
                                    />
                                  ) : (
                                    <p className="mt-1">{exercise.reps}</p>
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium">Rest:</span>
                                  {isEditing ? (
                                    <Input
                                      value={exercise.rest}
                                      onChange={(e) => updateExercise(dayIndex, exerciseIndex, 'rest', e.target.value)}
                                      className="mt-1"
                                    />
                                  ) : (
                                    <p className="mt-1">{exercise.rest}</p>
                                  )}
                                </div>
                              </div>

                              {exercise.notes && (
                                <div className="mt-3 p-3 bg-muted rounded-md">
                                  <p className="text-sm">{exercise.notes}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Revision Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <CardDescription>
            Ask the AI to modify or improve your workout plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Example: Make Monday's workout focus more on strength with lower reps, or add some cardio finishers to each day"
              value={revisionPrompt}
              onChange={(e) => setRevisionPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button onClick={handleRevisionSubmit} disabled={!revisionPrompt.trim()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Revise Workout
              </Button>
              <Button variant="outline" onClick={() => setRevisionPrompt('')}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout Scheduler */}
      <WorkoutScheduler
        workout={workout}
        isOpen={showScheduler}
        onSave={(schedules) => {
          onSave(schedules);
          setShowScheduler(false);
        }}
        onCancel={() => setShowScheduler(false)}
      />
    </div>
  );
};