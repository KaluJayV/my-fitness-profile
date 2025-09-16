import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Exercise, GeneratedWorkoutPlan } from '@/types/workout';

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
  phase: 'clarifying' | 'generating' | 'complete';
  questionCount: number;
  isProcessing: boolean;
}

interface ChatContainerProps {
  exercises: Exercise[];
  initialPreferences: InitialPreferences;
  onWorkoutGenerated: (workout: GeneratedWorkoutPlan) => void;
  onRevision?: (prompt: string) => Promise<void>;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
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
      content: "Great! Now let me ask you a few questions to personalize your workout even further.",
      timestamp: new Date()
    }
  ]);

  const [chatState, setChatState] = useState<ChatState>({
    phase: 'clarifying',
    questionCount: 0,
    isProcessing: false
  });

  const exerciseLibrary = useMemo(() => 
    exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      muscles: ex.primary_muscles
    })), [exercises]
  );

  const askClarifyingQuestion = useCallback(async () => {
    setChatState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const context = `User preferences: Goal: ${initialPreferences.goal}, Days per week: ${initialPreferences.daysPerWeek}, Session length: ${initialPreferences.sessionLength} minutes, Equipment: ${initialPreferences.equipment}, Experience: ${initialPreferences.experience}, Injuries: ${initialPreferences.injuries || 'none'}`;
      
      const conversationContext = chatMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n');
      
      const prompt = `You are an expert fitness coach having a conversation with a client. Based on their initial preferences and our conversation so far, ask ONE specific, open-ended clarifying question to better understand their needs for their workout program. 

${context}

Previous conversation:
${conversationContext}

Current question count: ${chatState.questionCount}/5

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
      setChatState(prev => ({ 
        ...prev, 
        questionCount: prev.questionCount + 1,
        isProcessing: false
      }));
      
    } catch (error) {
      console.error('Error generating question:', error);
      const fallbackMessage: ChatMessage = {
        type: 'assistant',
        content: "What specific muscle groups are you most interested in developing?",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, fallbackMessage]);
      setChatState(prev => ({ 
        ...prev, 
        questionCount: prev.questionCount + 1,
        isProcessing: false
      }));
    }
  }, [chatMessages, chatState.questionCount, initialPreferences]);

  const generateWorkoutPlan = useCallback(async () => {
    setChatState(prev => ({ ...prev, phase: 'generating', isProcessing: true }));
    
    try {
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
      setChatState(prev => ({ ...prev, phase: 'complete', isProcessing: false }));
      onWorkoutGenerated(data.workout);
      
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
      setChatState(prev => ({ ...prev, isProcessing: false }));
      
      toast({
        title: "Error",
        description: "Failed to generate workout plan",
        variant: "destructive",
      });
    }
  }, [chatMessages, initialPreferences, exerciseLibrary, onWorkoutGenerated, toast]);

  const handleChatResponse = useCallback(async (userResponse: string) => {
    const userMessage: ChatMessage = {
      type: 'user',
      content: userResponse,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);

    if (chatState.phase === 'clarifying') {
      if (chatState.questionCount >= 5) {
        await generateWorkoutPlan();
      } else {
        await askClarifyingQuestion();
      }
    } else if (chatState.phase === 'complete' && onRevision) {
      await onRevision(userResponse);
    }
  }, [chatState.phase, chatState.questionCount, askClarifyingQuestion, generateWorkoutPlan, onRevision]);

  // Start with first question
  React.useEffect(() => {
    if (chatState.questionCount === 0 && !chatState.isProcessing) {
      askClarifyingQuestion();
    }
  }, [askClarifyingQuestion, chatState.questionCount, chatState.isProcessing]);

  return (
    <div className="flex flex-col h-[600px]">
      <ChatMessageList 
        messages={chatMessages} 
        isProcessing={chatState.isProcessing}
      />
      <div className="border-t p-4">
        <ChatInput
          ref={textareaRef}
          onSend={handleChatResponse}
          placeholder={
            chatState.phase === 'clarifying' 
              ? "Type your answer..." 
              : chatState.phase === 'complete'
              ? "Ask for any changes to your workout..."
              : "Type your message..."
          }
          disabled={chatState.isProcessing}
          isProcessing={chatState.isProcessing}
        />
      </div>
    </div>
  );
};