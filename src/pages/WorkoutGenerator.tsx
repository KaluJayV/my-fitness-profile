import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppHeader } from '@/components/AppHeader';
import { ModularWorkoutDisplay } from '@/components/ModularWorkoutDisplay';
import { IntelligentChatContainer } from '@/components/IntelligentChatContainer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  Target,
  Clock,
  Dumbbell,
  MessageCircle,
  Zap
} from 'lucide-react';
import { 
  Exercise, 
  GeneratedWorkoutPlan
} from '@/types/workout';


interface InitialPreferences {
  goal: string;
  daysPerWeek: number;
  sessionLength: number;
  equipment: string;
  injuries: string;
  experience: string;
}

const WorkoutGenerator = () => {
  const { toast } = useToast();
  
  // Core state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkoutPlan | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [initialPreferences, setInitialPreferences] = useState<InitialPreferences | null>(null);
  const [showPreferencesForm, setShowPreferencesForm] = useState(true);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, primary_muscles, gif_url')
        .order('name');

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      toast({
        title: "Error",
        description: "Failed to load exercise library",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleInitialPreferences = useCallback((preferences: InitialPreferences) => {
    setInitialPreferences(preferences);
    setShowPreferencesForm(false);
  }, []);

  const handleWorkoutGenerated = useCallback((workout: GeneratedWorkoutPlan) => {
    setGeneratedWorkout(workout);
    setActiveTab('preview');
  }, []);

  const handleRevision = useCallback(async (revisionPrompt: string) => {
    if (!generatedWorkout || !exercises) return;
    
    try {
      const exerciseLibrary = exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscles: ex.primary_muscles
      }));

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('generate-smart-workout', {
        body: {
          prompt: revisionPrompt,
          exercises: exerciseLibrary,
          currentWorkout: generatedWorkout,
          userId: user?.id
        }
      });

      if (error) throw error;

      setGeneratedWorkout(data.workout);
      
      toast({
        title: "Success",
        description: "Workout plan updated!",
      });

    } catch (error: any) {
      console.error('Error revising workout:', error);
      toast({
        title: "Error",
        description: "Failed to update workout plan",
        variant: "destructive",
      });
    }
  }, [generatedWorkout, exercises, toast]);



  const saveWorkout = useCallback(async (schedules: any[]) => {
    if (!generatedWorkout) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save workouts",
          variant: "destructive",
        });
        return;
      }

      // Use WorkoutDataManager for validated saving
      const { WorkoutDataManager } = await import('@/utils/WorkoutDataManager');
      const saveResult = await WorkoutDataManager.saveWorkoutProgram(generatedWorkout, user.id);

      if (!saveResult.success) {
        console.error('Save validation errors:', saveResult.errors);
        toast({
          title: "Validation Error",
          description: saveResult.errors[0] || "Invalid workout data",
          variant: "destructive",
        });
        return;
      }

      // Create scheduled workouts if schedules provided
      if (schedules && schedules.length > 0 && saveResult.programId) {
        const workoutEntries = schedules.map(schedule => ({
          program_id: saveResult.programId,
          workout_date: schedule.date.toISOString().split('T')[0],
          json_plan: {
            ...generatedWorkout.workouts[schedule.workoutIndex],
            workout_type: 'modular',
            enabled_modules: generatedWorkout.enabled_modules,
            difficulty: generatedWorkout.difficulty,
            goals: generatedWorkout.goals,
            format_version: '2.0'
          } as any
        }));

        const { error: scheduledError } = await supabase
          .from('workouts')
          .insert(workoutEntries);

        if (scheduledError) {
          console.error('Error saving scheduled workouts:', scheduledError);
          toast({
            title: "Partial Success",
            description: "Workout saved but scheduling failed. You can schedule it later.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: `Workout plan saved with ${schedules.length} scheduled workouts!`,
        });
      } else {
        toast({
          title: "Success", 
          description: "Workout plan saved successfully!",
        });
      }
    } catch (error) {
      console.error('Error saving workout:', error);
      toast({
        title: "Error",
        description: "Failed to save workout",
        variant: "destructive",
      });
    }
  }, [generatedWorkout, toast]);


  const PreferencesForm = () => {
    const [formData, setFormData] = useState<InitialPreferences>({
      goal: '',
      daysPerWeek: 3,
      sessionLength: 60,
      equipment: '',
      injuries: '',
      experience: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.goal || !formData.equipment || !formData.experience) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      handleInitialPreferences(formData);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Tell me about your fitness goals
          </CardTitle>
          <CardDescription>
            Let's start with some basic preferences, then I'll ask a few questions to personalize your program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Goal *</label>
              <Textarea
                placeholder="Describe your fitness goals in detail... e.g., 'I want to build lean muscle while losing body fat, focusing on upper body strength and improving my overall conditioning for basketball'"
                value={formData.goal}
                onChange={(e) => setFormData(prev => ({ ...prev, goal: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what you want to achieve - the more detail, the better your program will be
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Days per week</label>
                <Select value={formData.daysPerWeek.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, daysPerWeek: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="4">4 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="6">6 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Session length</label>
                <Select value={formData.sessionLength.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, sessionLength: parseInt(value) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment Access *</label>
              <Select value={formData.equipment} onValueChange={(value) => setFormData(prev => ({ ...prev, equipment: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="What equipment do you have access to?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_gym">Full Gym</SelectItem>
                  <SelectItem value="home_gym">Home Gym (Weights & Machines)</SelectItem>
                  <SelectItem value="basic_weights">Basic Weights (Dumbbells/Barbells)</SelectItem>
                  <SelectItem value="bodyweight">Bodyweight Only</SelectItem>
                  <SelectItem value="resistance_bands">Resistance Bands</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Experience Level *</label>
              <Select value={formData.experience} onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="How would you describe your experience?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner (0-6 months)</SelectItem>
                  <SelectItem value="intermediate">Intermediate (6 months - 2 years)</SelectItem>
                  <SelectItem value="advanced">Advanced (2+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Injuries or Limitations</label>
              <Input
                placeholder="e.g., lower back issues, knee problems (optional)"
                value={formData.injuries}
                onChange={(e) => setFormData(prev => ({ ...prev, injuries: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full">
              Start Conversation
              <MessageCircle className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="AI Workout Coach" showBack={true} />
      
      <div className="container mx-auto p-4 lg:p-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Workout Coach
          </h1>
          <p className="text-xl text-muted-foreground">
            Have a conversation with AI to create your perfect workout program
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Conversation
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!generatedWorkout} className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Preview & Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-6">
            {showPreferencesForm ? (
              <PreferencesForm />
            ) : initialPreferences ? (
              <IntelligentChatContainer
                exercises={exercises}
                initialPreferences={initialPreferences}
                onWorkoutGenerated={handleWorkoutGenerated}
                onRevision={handleRevision}
              />
            ) : null}
            
            {!showPreferencesForm && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-dashed border-primary/30">
                  <CardContent className="pt-6 text-center">
                    <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">AI-Powered Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      Uses your fitness data and analytics
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-dashed border-primary/30">
                  <CardContent className="pt-6 text-center">
                    <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Dynamic Questions</p>
                    <p className="text-sm text-muted-foreground">
                      Personalized based on your history
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-dashed border-primary/30">
                  <CardContent className="pt-6 text-center">
                    <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Smart Recommendations</p>
                    <p className="text-sm text-muted-foreground">
                      Leverages advanced AI reasoning
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            {generatedWorkout && (
              <ModularWorkoutDisplay 
                workout={generatedWorkout}
                onRevision={handleRevision}
                onSave={saveWorkout}
                exercises={exercises}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorkoutGenerator;