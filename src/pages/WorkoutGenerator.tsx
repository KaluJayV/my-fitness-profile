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
import { ErrorDisplay, LoadingState } from '@/components/ui/error-display';
import { useSafeOperation } from '@/hooks/useSafeOperation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user, session, loading: authLoading } = useAuth();
  const { executeOperation, loadingState, retry } = useSafeOperation();
  
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
    const result = await executeOperation(
      async () => {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, name, primary_muscles, gif_url')
          .order('name');

        if (error) throw error;
        return data || [];
      },
      'Loading exercise library',
      {
        loadingMessage: 'Loading exercises...',
        retryable: true,
        onSuccess: (data) => setExercises(data),
        onError: (error) => toast({
          title: "Error",
          description: "Failed to load exercise library. Some features may be limited.",
          variant: "destructive",
        })
      }
    );
  }, [executeOperation, toast]);

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
    
    const result = await executeOperation(
      async () => {
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
        return data.workout;
      },
      'Revising workout plan',
      {
        loadingMessage: 'Updating your workout...',
        retryable: true,
        requireAuth: true,
        onSuccess: (updatedWorkout) => {
          setGeneratedWorkout(updatedWorkout);
          toast({
            title: "Success",
            description: "Workout plan updated!",
          });
        },
        onError: (error) => toast({
          title: "Error", 
          description: "Failed to update workout plan. Please try again.",
          variant: "destructive",
        })
      }
    );
  }, [generatedWorkout, exercises, executeOperation, toast]);



  const saveWorkout = useCallback(async (schedules: any[]) => {
    if (!generatedWorkout) return;
    
    // Check auth state before operation
    if (!user || !session) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save workouts",
        variant: "destructive"
      });
      return;
    }
    
    const result = await executeOperation(
      async () => {
        // Use WorkoutDataManager for validated saving
        const { WorkoutDataManager } = await import('@/utils/WorkoutDataManager');
        const saveResult = await WorkoutDataManager.saveWorkoutProgram(generatedWorkout, user.id);

        if (!saveResult.success) {
          throw new Error(saveResult.errors[0] || "Invalid workout data");
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
            throw new Error("Workout saved but scheduling failed. You can schedule it later.");
          }

          return { scheduleCount: schedules.length };
        }

        return { scheduleCount: 0 };
      },
      'Saving workout plan',
      {
        loadingMessage: 'Saving your workout...',
        retryable: true,
        requireAuth: true,
        userId: user.id,
        onSuccess: (result) => {
          if (result.scheduleCount > 0) {
            toast({
              title: "Success",
              description: `Workout plan saved with ${result.scheduleCount} scheduled workouts!`,
            });
          } else {
            toast({
              title: "Success", 
              description: "Workout plan saved successfully!",
            });
          }
        },
        onError: (error) => toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
      }
    );
  }, [generatedWorkout, executeOperation, toast, user, session]);


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
      <div className="border-4 border-foreground p-12 max-w-3xl mx-auto bg-background">
        <div className="mb-10 border-b-3 border-foreground pb-6">
          <h2 className="text-5xl font-display mb-4 flex items-center gap-4">
            <Dumbbell className="h-12 w-12" />
            TELL ME ABOUT YOUR FITNESS GOALS
          </h2>
          <p className="text-xl font-medium">
            Let's start with some basic preferences, then I'll ask a few questions to personalize your program
          </p>
        </div>
        <div>
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

            <button 
              type="submit" 
              className="w-full build-wars-button mt-8"
            >
              Start Conversation
              <MessageCircle className="inline-block ml-3 h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="AI Workout Coach" showBack={true} />
      
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="mb-16 border-b-4 border-foreground pb-8">
          <h1 className="text-7xl md:text-8xl font-display mb-6 leading-none">
            AI WORKOUT<br />COACH
          </h1>
          <p className="text-xl md:text-2xl font-medium max-w-3xl">
            Have a conversation with AI to create your perfect workout program
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
          <div className="grid grid-cols-2 gap-4 border-3 border-foreground">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-8 py-6 text-xl font-bold uppercase transition-all border-r-3 border-foreground ${
                activeTab === 'chat'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-muted'
              }`}
            >
              <MessageCircle className="inline-block h-6 w-6 mr-3" />
              Conversation
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              disabled={!generatedWorkout}
              className={`px-8 py-6 text-xl font-bold uppercase transition-all ${
                !generatedWorkout ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                activeTab === 'preview'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-muted'
              }`}
            >
              <Target className="inline-block h-6 w-6 mr-3" />
              Preview & Schedule
            </button>
          </div>

          <div className={activeTab === 'chat' ? 'block' : 'hidden'}>
            {loadingState.isLoading && (
              <div className="mb-6">
                <LoadingState 
                  isLoading={loadingState.isLoading}
                  message={loadingState.lastOperation || 'Loading...'}
                />
              </div>
            )}
            
            {loadingState.error && (
              <div className="mb-6">
                <ErrorDisplay
                  error={loadingState.error}
                  context="Workout Generation"
                  canRetry={loadingState.retryCount < 3}
                  onRetry={() => retry(fetchExercises, 'Loading exercise library')}
                />
              </div>
            )}
            
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="border-3 border-foreground p-8 hover:shadow-[8px_8px_0px_0px_hsl(var(--foreground))] transition-all">
                  <Target className="h-12 w-12 mb-6" />
                  <h3 className="text-2xl font-display mb-3">AI-POWERED ANALYSIS</h3>
                  <p className="text-base font-medium">
                    Uses your fitness data and analytics
                  </p>
                </div>
                <div className="border-3 border-foreground p-8 hover:shadow-[8px_8px_0px_0px_hsl(var(--foreground))] transition-all">
                  <Clock className="h-12 w-12 mb-6" />
                  <h3 className="text-2xl font-display mb-3">DYNAMIC QUESTIONS</h3>
                  <p className="text-base font-medium">
                    Personalized based on your history
                  </p>
                </div>
                <div className="border-3 border-foreground p-8 hover:shadow-[8px_8px_0px_0px_hsl(var(--foreground))] transition-all">
                  <Zap className="h-12 w-12 mb-6" />
                  <h3 className="text-2xl font-display mb-3">SMART RECOMMENDATIONS</h3>
                  <p className="text-base font-medium">
                    Leverages advanced AI reasoning
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={activeTab === 'preview' ? 'block' : 'hidden'}>
            {generatedWorkout && (
              <ModularWorkoutDisplay 
                workout={generatedWorkout}
                onRevision={handleRevision}
                onSave={saveWorkout}
                exercises={exercises}
              />
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default WorkoutGenerator;