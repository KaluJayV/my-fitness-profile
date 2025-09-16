import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { AIInsightPanel } from './AIInsightPanel';
import { ConversationQualityDisplay } from './ConversationQualityDisplay';
import { PerformanceMonitor } from './PerformanceMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Exercise, GeneratedWorkoutPlan } from '@/types/workout';
import { Brain, Target, TrendingUp, MessageCircle, Sparkles, BarChart3 } from 'lucide-react';

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

interface ChatState {
  phase: 'analyzing' | 'questioning' | 'generating' | 'complete';
  questionCount: number;
  maxQuestions: number;
  isProcessing: boolean;
  insights: string[];
  conversationQuality: any;
  availableInsights: any;
}

interface IntelligentChatContainerProps {
  exercises: Exercise[];
  initialPreferences: InitialPreferences;
  onWorkoutGenerated: (workout: GeneratedWorkoutPlan) => void;
  onRevision?: (prompt: string) => Promise<void>;
}

export const IntelligentChatContainer: React.FC<IntelligentChatContainerProps> = ({
  exercises,
  initialPreferences,
  onWorkoutGenerated,
  onRevision
}) => {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      type: 'system',
      content: "Hi! I'm your AI fitness coach. I'm analyzing your goals and fitness history to create the perfect workout program for you. Let me ask you a few personalized questions...",
      timestamp: new Date()
    }
  ]);

  const [chatState, setChatState] = useState<ChatState>({
    phase: 'analyzing',
    questionCount: 0,
    maxQuestions: 5,
    isProcessing: false,
    insights: [],
    conversationQuality: null,
    availableInsights: null
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const exerciseLibrary = useMemo(() => 
    exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      muscles: ex.primary_muscles
    })), [exercises]
  );

  // Generate intelligent question based on user data and analytics
  const generateIntelligentQuestion = useCallback(async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to use the AI coach",
        variant: "destructive",
      });
      return;
    }

    setChatState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('workout-coach-ai-optimized', {
        body: {
          userId,
          userPreferences: initialPreferences,
          conversationHistory: chatMessages.map(msg => ({
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          })),
          action: 'generate_question',
          currentQuestionCount: chatState.questionCount,
          maxQuestions: chatState.maxQuestions,
          sessionId
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function call failed: ${error.message}`);
      }

      if (!data || !data.question) {
        console.error('Empty response from function:', data);
        throw new Error('Received empty response from AI service');
      }

      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: data.question,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      setChatState(prev => ({ 
        ...prev, 
        phase: 'questioning',
        questionCount: data.questionNumber,
        isProcessing: false
      }));
      setSessionId(data.sessionId);
      
    } catch (error: any) {
      console.error('Error generating question:', error);
      
      // Show detailed error message to help with debugging
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({
        title: "AI Coach Error",
        description: `Failed to generate question: ${errorMessage}`,
        variant: "destructive",
      });
      
      // Fallback to basic question with error context
      const fallbackMessage: ChatMessage = {
        type: 'assistant',
        content: "I'm having trouble connecting to the AI service right now. Let me ask you a basic question: What specific muscle groups are you most interested in developing, and are there any exercises you particularly enjoy or want to avoid?",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, fallbackMessage]);
      setChatState(prev => ({ 
        ...prev, 
        phase: 'questioning',
        questionCount: prev.questionCount + 1,
        isProcessing: false
      }));
    }
  }, [userId, initialPreferences, chatMessages, chatState.questionCount, chatState.maxQuestions, toast]);

  // Analyze user response for insights
  const analyzeUserResponse = useCallback(async (userResponse: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke('workout-coach-ai-optimized', {
        body: {
          userId,
          userPreferences: initialPreferences,
          conversationHistory: [...chatMessages, {
            type: 'user',
            content: userResponse,
            timestamp: new Date().toISOString()
          }],
          action: 'analyze_response',
          sessionId
        }
      });

      if (error) throw error;

      // Add insights to state
      setChatState(prev => ({
        ...prev,
        insights: [...prev.insights, data.analysis]
      }));

    } catch (error: any) {
      console.error('Error analyzing response:', error);
      toast({
        title: "Analysis Warning",
        description: "Failed to analyze your response, but we'll continue with the conversation.",
        variant: "default",
      });
    }
  }, [userId, initialPreferences, chatMessages, sessionId]);

  // Assess conversation quality
  const assessConversationQuality = useCallback(async () => {
    if (!userId || !sessionId) return;

    try {
      const { data, error } = await supabase.functions.invoke('adaptive-coach-engine', {
        body: {
          userId,
          sessionId,
          userPreferences: initialPreferences,
          conversationHistory: chatMessages.map(msg => ({
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          })),
          action: 'quality_score',
          context: {
            questionCount: chatState.questionCount,
            maxQuestions: chatState.maxQuestions,
            phase: chatState.phase
          }
        }
      });

      if (!error && data) {
        setChatState(prev => ({ 
          ...prev, 
          conversationQuality: data.quality
        }));
      }
    } catch (error: any) {
      console.error('Error assessing conversation quality:', error);
      // Continue without quality assessment - not critical
    }
  }, [userId, sessionId, initialPreferences, chatMessages, chatState.questionCount, chatState.maxQuestions, chatState.phase]);

  // Generate comprehensive master prompt and create workout
  const generateWorkoutWithMasterPrompt = useCallback(async () => {
    if (!userId) return;

    setChatState(prev => ({ ...prev, phase: 'generating', isProcessing: true }));
    
    try {
      // First, build the master prompt using AI
      const { data: masterData, error: masterError } = await supabase.functions.invoke('workout-coach-ai-optimized', {
        body: {
          userId,
          userPreferences: initialPreferences,
          conversationHistory: chatMessages.map(msg => ({
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          })),
          action: 'build_master_prompt',
          sessionId
        }
      });

      if (masterError) {
        console.error('Master prompt error:', masterError);
        throw new Error(`Failed to build master prompt: ${masterError.message}`);
      }

      if (!masterData || !masterData.masterPrompt) {
        console.error('Empty master prompt response:', masterData);
        throw new Error('Received empty master prompt from AI service');
      }

      const generatingMessage: ChatMessage = {
        type: 'assistant',
        content: "Perfect! I've analyzed all your responses and fitness data. Let me create your personalized workout program using advanced AI analysis...",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, generatingMessage]);

      // Use the master prompt to generate the workout
      const { data: workoutData, error: workoutError } = await supabase.functions.invoke('generate-smart-workout', {
        body: {
          prompt: masterData.masterPrompt,
          exercises: exerciseLibrary,
          userId: userId
        }
      });

      if (workoutError) {
        console.error('Workout generation error:', workoutError);
        throw new Error(`Failed to generate workout: ${workoutError.message}`);
      }

      if (!workoutData || !workoutData.workout) {
        console.error('Empty workout response:', workoutData);
        throw new Error('Received empty workout plan from AI service');
      }

      // Validate workout data before proceeding
      const workoutPlan = workoutData.workout;
      if (!workoutPlan.workouts || workoutPlan.workouts.length === 0) {
        throw new Error('Generated workout plan contains no workout days');
      }

      // Check for proper data structure
      const hasValidStructure = workoutPlan.workouts.every((day: any) => 
        (day.modules && Array.isArray(day.modules)) || (day.exercises && Array.isArray(day.exercises))
      );

      if (!hasValidStructure) {
        throw new Error('Generated workout plan has invalid structure');
      }

      const completionMessage: ChatMessage = {
        type: 'assistant',
        content: "🎯 Your personalized workout program is ready! I've analyzed your fitness goals, training history, and preferences to create a program that's perfectly tailored to you. Check out the preview tab to see your custom plan!",
        timestamp: new Date(),
        workout: workoutData.workout
      };
      
      setChatMessages(prev => [...prev, completionMessage]);
      setChatState(prev => ({ ...prev, phase: 'complete', isProcessing: false }));
      onWorkoutGenerated(workoutData.workout);
      
      toast({
        title: "🎉 AI-Powered Program Created!",
        description: "Your personalized workout plan has been generated using advanced AI analysis",
      });

    } catch (error: any) {
      console.error('Error generating workout:', error);
      
      const errorDetails = error?.message || 'Unknown error occurred';
      const errorMessage: ChatMessage = {
        type: 'assistant',
        content: `I apologize, but I encountered an issue creating your workout plan: ${errorDetails}. Please try again or contact support if the problem persists.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      setChatState(prev => ({ ...prev, phase: 'questioning', isProcessing: false }));
      
      toast({
        title: "Workout Generation Failed",
        description: `Error: ${errorDetails}`,
        variant: "destructive",
      });
    }
  }, [userId, initialPreferences, chatMessages, exerciseLibrary, onWorkoutGenerated, toast]);

  const handleChatResponse = useCallback(async (userResponse: string) => {
    const userMessage: ChatMessage = {
      type: 'user',
      content: userResponse,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);

    // Analyze the response for insights
    await analyzeUserResponse(userResponse);

    // Assess conversation quality
    if (chatState.questionCount >= 2) {
      setTimeout(() => assessConversationQuality(), 1000);
    }

    if (chatState.phase === 'questioning') {
      // Check if we should continue based on quality score or question count
      const shouldContinue = !chatState.conversationQuality?.shouldContinue && 
                           chatState.questionCount < chatState.maxQuestions;
      
      if (shouldContinue) {
        await generateIntelligentQuestion();
      } else {
        await generateWorkoutWithMasterPrompt();
      }
    } else if (chatState.phase === 'complete' && onRevision) {
      await onRevision(userResponse);
    }
  }, [chatState.phase, chatState.questionCount, chatState.maxQuestions, chatState.conversationQuality, analyzeUserResponse, assessConversationQuality, generateIntelligentQuestion, generateWorkoutWithMasterPrompt, onRevision]);

  // Start with first intelligent question
  useEffect(() => {
    if (userId && chatState.questionCount === 0 && !chatState.isProcessing && chatState.phase === 'analyzing') {
      generateIntelligentQuestion();
    }
  }, [userId, generateIntelligentQuestion, chatState.questionCount, chatState.isProcessing, chatState.phase]);

  // Handle insights from AIInsightPanel
  const handleInsightsGenerated = useCallback((insights: any) => {
    setChatState(prev => ({ 
      ...prev, 
      availableInsights: { ...prev.availableInsights, ...insights }
    }));
  }, []);

  const getPhaseDescription = () => {
    switch (chatState.phase) {
      case 'analyzing':
        return "Analyzing your fitness goals and history...";
      case 'questioning':
        return `Personalized consultation - Question ${chatState.questionCount}/${chatState.maxQuestions}`;
      case 'generating':
        return "Creating your AI-powered workout program...";
      case 'complete':
        return "Your workout plan is ready! You can request modifications anytime.";
      default:
        return "";
    }
  };

  const progressPercentage = chatState.phase === 'complete' ? 100 : 
    chatState.phase === 'generating' ? 90 :
    (chatState.questionCount / chatState.maxQuestions) * 80;

  return (
    <div className="space-y-4">
      {/* Performance Monitor */}
      {userId && sessionId && (
        <PerformanceMonitor 
          userId={userId}
          sessionId={sessionId}
          isVisible={chatState.phase === 'questioning' && chatState.questionCount >= 1}
          onMetricTracked={(metric, value) => {
            console.log('Metric tracked:', metric, value);
          }}
        />
      )}

      {/* AI Insights Panel */}
      {userId && chatState.phase === 'questioning' && (
        <AIInsightPanel 
          userId={userId} 
          isVisible={chatState.questionCount >= 2}
          onInsightsGenerated={handleInsightsGenerated}
        />
      )}

      {/* Conversation Quality Display */}
      <ConversationQualityDisplay 
        quality={chatState.conversationQuality}
        isVisible={chatState.phase === 'questioning' && chatState.questionCount >= 3}
      />

      {/* Progress Header with enhanced animations */}
      <Card className="border-primary/20 animate-fade-in hover:shadow-lg transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Fitness Coach</CardTitle>
              {chatState.phase === 'complete' && (
                <Badge variant="secondary" className="ml-2 animate-pulse-glow">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
            
            {chatState.phase !== 'complete' && (
              <div className="text-right animate-fade-in">
                <div className="text-sm font-medium">{Math.round(progressPercentage)}%</div>
                <Progress value={progressPercentage} className="w-20 h-2 transition-all duration-500" />
              </div>
            )}
          </div>
          
          <CardDescription className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {getPhaseDescription()}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Insights Panel */}
      {chatState.insights.length > 0 && (
        <Card className="border-secondary/20 bg-secondary/5 animate-scale-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {chatState.insights.slice(-2).map((insight, index) => (
                <div key={index} className="text-sm text-muted-foreground p-2 bg-background rounded-md border animate-fade-in hover:bg-muted/50 transition-colors duration-200">
                  {insight}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Interface */}
      <Card className="flex flex-col animate-fade-in shadow-lg max-h-[70vh] overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overscroll-contain">
            <ChatMessageList 
              messages={chatMessages} 
              isProcessing={chatState.isProcessing}
            />
          </div>
          <div className="border-t p-4 bg-muted/30 flex-shrink-0">
            <ChatInput
              ref={textareaRef}
              onSend={handleChatResponse}
              placeholder={
                chatState.phase === 'questioning' 
                  ? "Share your thoughts and preferences..." 
                  : chatState.phase === 'complete'
                  ? "Ask for any changes to your workout..."
                  : "Please wait while I analyze your data..."
              }
              disabled={chatState.isProcessing || chatState.phase === 'analyzing'}
              isProcessing={chatState.isProcessing}
            />
            
            {/* Quick Actions */}
            {chatState.phase === 'questioning' && chatState.questionCount > 2 && (
              <div className="mt-3 flex justify-between items-center animate-fade-in">
                <div className="text-xs text-muted-foreground">
                  {chatState.questionCount}/{chatState.maxQuestions} questions completed
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWorkoutWithMasterPrompt}
                  disabled={chatState.isProcessing}
                  className="text-xs hover:scale-105 transition-transform duration-200"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Generate Program Now
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};