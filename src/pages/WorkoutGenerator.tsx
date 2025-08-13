import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NavigationHeader } from '@/components/NavigationHeader';
import { VoiceInterface } from '@/components/VoiceInterface';
import { GeneratedWorkout } from '@/components/GeneratedWorkout';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Edit3, 
  Save,
  RefreshCw,
  Target,
  Clock,
  Dumbbell,
  Calendar
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

interface GeneratedWorkoutPlan {
  id?: string;
  name: string;
  description: string;
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  workouts: Array<{
    day: string;
    name: string;
    description: string;
    exercises: WorkoutExercise[];
  }>;
}

const WorkoutGenerator = () => {
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkoutPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    workout?: GeneratedWorkoutPlan;
  }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
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
  };

  const generateWorkout = async (userPrompt: string, isRevision = false) => {
    setIsGenerating(true);
    
    try {
      // Add user message to conversation
      const userMessage = {
        type: 'user' as const,
        content: userPrompt,
        timestamp: new Date()
      };
      setConversationHistory(prev => [...prev, userMessage]);

      // Prepare context for LLM
      const exerciseLibrary = exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscles: ex.primary_muscles
      }));

      const requestData = {
        prompt: userPrompt,
        exercises: exerciseLibrary,
        currentWorkout: isRevision ? generatedWorkout : null,
        conversationHistory: conversationHistory.slice(-6) // Last 6 messages for context
      };

      const { data, error } = await supabase.functions.invoke('generate-smart-workout', {
        body: requestData
      });

      if (error) throw error;

      const assistantMessage = {
        type: 'assistant' as const,
        content: `Generated ${isRevision ? 'revised' : 'new'} workout plan`,
        timestamp: new Date(),
        workout: data.workout
      };
      setConversationHistory(prev => [...prev, assistantMessage]);

      setGeneratedWorkout(data.workout);
      setActiveTab('preview');
      
      toast({
        title: "Success",
        description: isRevision ? "Workout plan updated!" : "Workout plan generated!",
      });

    } catch (error) {
      console.error('Error generating workout:', error);
      toast({
        title: "Error",
        description: "Failed to generate workout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    
    await generateWorkout(prompt);
    setPrompt('');
  };

  const handleRevision = async (revisionPrompt: string) => {
    await generateWorkout(revisionPrompt, true);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting voice recording:', error);
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        const transcribedText = data.text;
        setPrompt(transcribedText);
        
        toast({
          title: "Voice Transcribed",
          description: "Ready to generate workout from your voice input",
        });
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast({
        title: "Error",
        description: "Failed to process voice input",
        variant: "destructive",
      });
    }
  };

  const saveWorkout = async (schedules: any[]) => {
    if (!generatedWorkout) return;
    
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save workouts",
          variant: "destructive",
        });
        return;
      }

      // First, create the program
      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert({
          name: generatedWorkout.name,
          days_per_week: generatedWorkout.days_per_week,
          generator_source: 'ai_generated',
          user_id: user.id
        })
        .select()
        .single();

      if (programError) throw programError;

      // Then create individual workout entries for each scheduled date
      const workoutEntries = schedules.map(schedule => ({
        program_id: program.id,
        workout_date: schedule.date.toISOString().split('T')[0],
        json_plan: generatedWorkout.workouts[schedule.workoutIndex] as any
      }));

      const { error: workoutsError } = await supabase
        .from('workouts')
        .insert(workoutEntries);

      if (workoutsError) throw workoutsError;

      toast({
        title: "Success",
        description: `Workout plan saved with ${schedules.length} scheduled workouts!`,
      });
    } catch (error) {
      console.error('Error saving workout:', error);
      toast({
        title: "Error",
        description: "Failed to save workout",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Workout Generator
          </h1>
          <p className="text-xl text-muted-foreground">
            Create personalized workout plans with AI assistance
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!generatedWorkout} className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Chat History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5" />
                  Describe Your Ideal Workout
                </CardTitle>
                <CardDescription>
                  Tell me about your fitness goals, preferred exercises, available time, and any specific requirements.
                  You can type or use voice input.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Example: I want a 4-day upper/lower split for strength and muscle building. I have access to a full gym and can train for 60-90 minutes per session. Focus on compound movements with some isolation work."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[120px] pr-20 resize-none"
                      disabled={isGenerating}
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isListening ? "destructive" : "outline"}
                        onClick={isListening ? stopVoiceRecording : startVoiceRecording}
                        disabled={isGenerating}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!prompt.trim() || isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </form>

                {isGenerating && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="font-medium">Generating your workout...</p>
                          <p className="text-sm text-muted-foreground">
                            Analyzing your requirements and selecting optimal exercises
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center">
                      <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="font-medium">Goal-Focused</p>
                      <p className="text-sm text-muted-foreground">
                        Workouts tailored to your specific fitness objectives
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center">
                      <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="font-medium">Time-Efficient</p>
                      <p className="text-sm text-muted-foreground">
                        Optimized for your available training time
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center">
                      <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="font-medium">Adaptive</p>
                      <p className="text-sm text-muted-foreground">
                        Adjusts to your experience and equipment
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            {generatedWorkout && (
              <GeneratedWorkout 
                workout={generatedWorkout}
                onRevision={handleRevision}
                onSave={saveWorkout}
                exercises={exercises}
              />
            )}
          </TabsContent>

          <TabsContent value="conversation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Conversation History
                </CardTitle>
                <CardDescription>
                  Review your workout generation conversation and make adjustments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full">
                  <div className="space-y-4">
                    {conversationHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No conversation history yet</p>
                        <p className="text-sm">Generate a workout to start the conversation</p>
                      </div>
                    ) : (
                      conversationHistory.map((message, index) => (
                        <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            message.type === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            
                            {/* Show workout details for assistant messages */}
                            {message.type === 'assistant' && message.workout && (
                              <div className="mt-3 space-y-2">
                                <div className="border-t pt-2">
                                  <h4 className="font-semibold text-base">{message.workout.name}</h4>
                                  <p className="text-xs opacity-80 mt-1">{message.workout.description}</p>
                                  
                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    <Badge className="text-xs" variant="secondary">
                                      {message.workout.duration_weeks} weeks
                                    </Badge>
                                    <Badge className="text-xs" variant="secondary">
                                      {message.workout.days_per_week} days/week
                                    </Badge>
                                    <Badge className="text-xs" variant="secondary">
                                      {message.workout.difficulty}
                                    </Badge>
                                  </div>
                                  
                                  <div className="mt-2">
                                    <p className="text-xs font-medium">Goals:</p>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {message.workout.goals.map((goal, goalIndex) => (
                                        <Badge key={goalIndex} variant="outline" className="text-xs">
                                          {goal}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="mt-2">
                                    <p className="text-xs font-medium">Workouts:</p>
                                    <div className="space-y-1 mt-1">
                                      {message.workout.workouts.map((workout, workoutIndex) => (
                                        <div key={workoutIndex} className="text-xs">
                                          <span className="font-medium">{workout.day}:</span> {workout.name} 
                                          <span className="opacity-70"> ({workout.exercises.length} exercises)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {message.workout.id && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 text-xs h-7"
                                      onClick={() => {
                                        setGeneratedWorkout(message.workout!);
                                        setActiveTab('preview');
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <p className="text-xs opacity-70 mt-1">
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorkoutGenerator;