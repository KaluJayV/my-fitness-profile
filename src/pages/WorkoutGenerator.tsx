import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppHeader } from '@/components/AppHeader';
import { ModularWorkoutDisplay } from '@/components/ModularWorkoutDisplay';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Target,
  Clock,
  Dumbbell,
  MessageCircle,
  User,
  Bot,
  Play,
  Zap
} from 'lucide-react';
import { 
  Exercise, 
  GeneratedWorkoutPlan
} from '@/types/workout';

interface ChatMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  workout?: GeneratedWorkoutPlan;
}

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
  
  // Chat flow state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<'initial' | 'clarifying' | 'generating' | 'complete'>('initial');
  const [questionCount, setQuestionCount] = useState(0);
  const [initialPreferences, setInitialPreferences] = useState<InitialPreferences | null>(null);
  const [showPreferencesForm, setShowPreferencesForm] = useState(true);
  
  // Voice input
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchExercises();
    // Initialize chat with welcome message
    setChatMessages([{
      type: 'system',
      content: "Hi! I'm your AI fitness coach. Let's create a personalized workout program together. First, I'll need some basic preferences, then I'll ask a few clarifying questions to make sure your program is perfect for you.",
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of chat
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const handleInitialPreferences = async (preferences: InitialPreferences) => {
    setInitialPreferences(preferences);
    setShowPreferencesForm(false);
    setConversationPhase('clarifying');
    
    // Add user's preferences to chat
    const userMessage: ChatMessage = {
      type: 'user',
      content: `My preferences: ${preferences.goal}, ${preferences.daysPerWeek} days/week, ${preferences.sessionLength} min sessions, ${preferences.equipment} equipment, ${preferences.experience} experience level${preferences.injuries ? `, injuries: ${preferences.injuries}` : ''}`,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);

    // Generate first clarifying question
    await askClarifyingQuestion(preferences);
  };

  const askClarifyingQuestion = async (preferences: InitialPreferences) => {
    setIsProcessing(true);
    
    try {
      const context = `User preferences: Goal: ${preferences.goal}, Days per week: ${preferences.daysPerWeek}, Session length: ${preferences.sessionLength} minutes, Equipment: ${preferences.equipment}, Experience: ${preferences.experience}, Injuries: ${preferences.injuries || 'none'}`;
      
      const conversationContext = chatMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n');
      
      const prompt = `You are an expert fitness coach having a conversation with a client. Based on their initial preferences and our conversation so far, ask ONE specific, open-ended clarifying question to better understand their needs for their workout program. 

${context}

Previous conversation:
${conversationContext}

Current question count: ${questionCount}/5

Ask a thoughtful question that will help you create a better workout program. Keep it conversational and focused. Examples of good questions:
- "What specific muscle groups are you most interested in developing?"
- "Do you prefer longer rest periods for strength or shorter for conditioning?"
- "Are there any movements you particularly enjoy or want to avoid?"
- "What time of day do you usually prefer to work out?"

Respond with ONLY the question, no extra text.`;

      const { data, error } = await supabase.functions.invoke('generate-smart-workout', {
        body: {
          prompt,
          exercises: [],
          conversationHistory: [],
          isQuestion: true
        }
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: data.question || "What specific aspects of your fitness are most important to you right now?",
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      setQuestionCount(prev => prev + 1);
      
    } catch (error) {
      console.error('Error generating question:', error);
      // Fallback question
      const fallbackMessage: ChatMessage = {
        type: 'assistant',
        content: "What specific muscle groups are you most interested in developing?",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, fallbackMessage]);
      setQuestionCount(prev => prev + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatResponse = async (userResponse: string) => {
    if (!userResponse.trim() || isProcessing) return;

    // Add user message
    const userMessage: ChatMessage = {
      type: 'user',
      content: userResponse,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    setCurrentInput('');

    if (conversationPhase === 'clarifying') {
      if (questionCount >= 5) {
        // Ready to generate
        await generateWorkoutPlan();
      } else {
        // Ask another question
        await askClarifyingQuestion(initialPreferences!);
      }
    }
  };

  const generateWorkoutPlan = async () => {
    if (!initialPreferences) return;
    
    setConversationPhase('generating');
    setIsProcessing(true);
    
    try {
      // Add generating message
      const generatingMessage: ChatMessage = {
        type: 'assistant',
        content: "Perfect! I have all the information I need. Let me create your personalized workout program...",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, generatingMessage]);

      const conversationContext = chatMessages
        .filter(msg => msg.type !== 'system')
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');

      const fullPrompt = `Based on our conversation, create a comprehensive workout program.

User's initial preferences:
- Goal: ${initialPreferences.goal}
- Days per week: ${initialPreferences.daysPerWeek}
- Session length: ${initialPreferences.sessionLength} minutes
- Equipment: ${initialPreferences.equipment}
- Experience: ${initialPreferences.experience}
- Injuries: ${initialPreferences.injuries || 'none'}

Our conversation:
${conversationContext}

Create a detailed workout program that addresses all their needs and preferences.`;

      const exerciseLibrary = exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscles: ex.primary_muscles
      }));

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('generate-smart-workout', {
        body: {
          prompt: fullPrompt,
          exercises: exerciseLibrary,
          userId: user?.id
        }
      });

      if (error) throw error;

      const completionMessage: ChatMessage = {
        type: 'assistant',
        content: "Your personalized workout program is ready! Check out the preview tab to see your plan.",
        timestamp: new Date(),
        workout: data.workout
      };
      
      setChatMessages(prev => [...prev, completionMessage]);
      setGeneratedWorkout(data.workout);
      setConversationPhase('complete');
      setActiveTab('preview');
      
      toast({
        title: "Success",
        description: "Your workout plan has been generated!",
      });

    } catch (error: any) {
      console.error('Error generating workout:', error);
      const errorMessage: ChatMessage = {
        type: 'assistant',
        content: "I'm sorry, there was an error generating your workout plan. Please try again.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to generate workout plan",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevision = async (revisionPrompt: string) => {
    if (!generatedWorkout) return;
    
    setIsProcessing(true);
    
    try {
      const userMessage: ChatMessage = {
        type: 'user',
        content: revisionPrompt,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, userMessage]);

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

      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: "I've updated your workout plan based on your feedback!",
        timestamp: new Date(),
        workout: data.workout
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const saveWorkout = async (schedules: any[]) => {
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

  // Voice recording functions
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
        setCurrentInput(transcribedText);
        
        toast({
          title: "Voice Transcribed",
          description: "Your voice input is ready to send",
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
              <Select value={formData.goal} onValueChange={(value) => setFormData(prev => ({ ...prev, goal: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your main fitness goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muscle_gain">Build Muscle</SelectItem>
                  <SelectItem value="fat_loss">Lose Fat</SelectItem>
                  <SelectItem value="strength">Build Strength</SelectItem>
                  <SelectItem value="muscle_gain_fat_loss">Build Muscle & Lose Fat</SelectItem>
                  <SelectItem value="endurance">Improve Endurance</SelectItem>
                  <SelectItem value="general_fitness">General Fitness</SelectItem>
                  <SelectItem value="athletic_performance">Athletic Performance</SelectItem>
                </SelectContent>
              </Select>
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

  const ChatInterface = () => (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Workout Planning Conversation
        </CardTitle>
        <CardDescription>
          {conversationPhase === 'clarifying' && `Question ${questionCount}/5 - I'll ask a few questions to personalize your program`}
          {conversationPhase === 'generating' && "Generating your personalized workout plan..."}
          {conversationPhase === 'complete' && "Your workout plan is ready! You can ask for revisions anytime."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {chatMessages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' ? 'bg-primary text-primary-foreground' : 
                    message.type === 'system' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'
                  }`}>
                    {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    {message.workout && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <p className="text-xs opacity-75">Workout plan generated ✓</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {conversationPhase !== 'initial' && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder={
                    conversationPhase === 'clarifying' 
                      ? "Type your answer..." 
                      : conversationPhase === 'complete'
                      ? "Ask for any changes to your workout plan..."
                      : "Please wait..."
                  }
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  className="resize-none pr-20"
                  rows={2}
                  disabled={isProcessing || conversationPhase === 'generating'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (conversationPhase === 'complete') {
                        handleRevision(currentInput);
                      } else {
                        handleChatResponse(currentInput);
                      }
                    }
                  }}
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={isListening ? stopVoiceRecording : startVoiceRecording}
                    disabled={isProcessing}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (conversationPhase === 'complete') {
                        handleRevision(currentInput);
                      } else {
                        handleChatResponse(currentInput);
                      }
                    }}
                    disabled={!currentInput.trim() || isProcessing}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {conversationPhase === 'clarifying' && questionCount > 0 && (
              <div className="mt-2 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {questionCount}/5 questions completed
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWorkoutPlan}
                  disabled={isProcessing}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Generate Now
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

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
            {showPreferencesForm ? <PreferencesForm /> : <ChatInterface />}
            
            {!showPreferencesForm && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center">
                    <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Personalized</p>
                    <p className="text-sm text-muted-foreground">
                      Tailored through our conversation
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center">
                    <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Efficient</p>
                    <p className="text-sm text-muted-foreground">
                      Quick 5-question clarification
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center">
                    <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="font-medium">Adaptive</p>
                    <p className="text-sm text-muted-foreground">
                      Easy revisions through chat
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