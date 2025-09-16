import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoachRequest {
  userId: string;
  userPreferences: {
    goal: string;
    daysPerWeek: number;
    sessionLength: number;
    equipment: string;
    injuries: string;
    experience: string;
  };
  conversationHistory: Array<{
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  action: 'generate_question' | 'analyze_response' | 'build_master_prompt';
  currentQuestionCount?: number;
  maxQuestions?: number;
}

interface UserAnalytics {
  workoutFrequency: any;
  exerciseHistory: any[];
  coreLifts: any[];
  progressData: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      userId,
      userPreferences,
      conversationHistory,
      action,
      currentQuestionCount = 0,
      maxQuestions = 5
    }: CoachRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch comprehensive user analytics
    const userAnalytics: UserAnalytics = await fetchUserAnalytics(supabase, userId);

    console.log('User analytics fetched:', {
      hasWorkoutFrequency: !!userAnalytics.workoutFrequency,
      exerciseHistoryCount: userAnalytics.exerciseHistory.length,
      coreLiftsCount: userAnalytics.coreLifts.length,
      progressDataCount: userAnalytics.progressData.length
    });

    if (action === 'generate_question') {
      const question = await generateDynamicQuestion(
        OPENAI_API_KEY,
        userPreferences,
        userAnalytics,
        conversationHistory,
        currentQuestionCount,
        maxQuestions
      );

      return new Response(
        JSON.stringify({ question, questionNumber: currentQuestionCount + 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'analyze_response') {
      const analysis = await analyzeUserResponse(
        OPENAI_API_KEY,
        userPreferences,
        userAnalytics,
        conversationHistory
      );

      return new Response(
        JSON.stringify({ analysis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'build_master_prompt') {
      const masterPrompt = await buildMasterPrompt(
        OPENAI_API_KEY,
        userPreferences,
        userAnalytics,
        conversationHistory
      );

      return new Response(
        JSON.stringify({ masterPrompt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('Error in workout-coach-ai:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check the function logs for more information'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function fetchUserAnalytics(supabase: any, userId: string): Promise<UserAnalytics> {
  try {
    console.log('Fetching analytics for user:', userId);

    // Get workout frequency stats
    const { data: workoutFrequency, error: freqError } = await supabase
      .rpc('get_workout_frequency_stats', { p_user_id: userId });
    
    if (freqError) console.error('Error fetching workout frequency:', freqError);

    // Get user exercise history (top 20 exercises)
    const { data: exerciseHistory, error: histError } = await supabase
      .rpc('get_user_history', { p_user: userId });
    
    if (histError) console.error('Error fetching exercise history:', histError);

    // Get core lift progression
    const { data: coreLifts, error: coreError } = await supabase
      .rpc('get_current_core_lift_maxes', { p_user_id: userId });
    
    if (coreError) console.error('Error fetching core lifts:', coreError);

    // Get recent progress data from v_progress view
    const { data: progressData, error: progressError } = await supabase
      .from('v_progress')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .limit(50);
    
    if (progressError) console.error('Error fetching progress data:', progressError);

    return {
      workoutFrequency: workoutFrequency?.[0] || null,
      exerciseHistory: exerciseHistory || [],
      coreLifts: coreLifts || [],
      progressData: progressData || []
    };
  } catch (error) {
    console.error('Error in fetchUserAnalytics:', error);
    return {
      workoutFrequency: null,
      exerciseHistory: [],
      coreLifts: [],
      progressData: []
    };
  }
}

async function generateDynamicQuestion(
  apiKey: string,
  preferences: any,
  analytics: UserAnalytics,
  conversation: any[],
  questionCount: number,
  maxQuestions: number
): Promise<string> {
  
  const analyticsContext = buildAnalyticsContext(analytics);
  const conversationContext = conversation
    .map(msg => `${msg.type}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an expert AI fitness coach conducting a personalized consultation. Your goal is to ask ONE highly targeted question that will help create the perfect workout program.

USER'S INITIAL PREFERENCES:
- Goal: ${preferences.goal}
- Days per week: ${preferences.daysPerWeek}
- Session length: ${preferences.sessionLength} minutes
- Equipment: ${preferences.equipment}
- Experience: ${preferences.experience}
- Injuries: ${preferences.injuries || 'None'}

USER'S ANALYTICS & HISTORY:
${analyticsContext}

CONVERSATION SO FAR:
${conversationContext}

QUESTION PROGRESS: ${questionCount}/${maxQuestions}

INSTRUCTIONS:
1. Ask ONE specific, insightful question that leverages their analytics data
2. Make it personal based on their workout history and current performance
3. Focus on areas that will significantly impact their program design
4. If they have training history, reference specific exercises or performance patterns
5. If they're a beginner, focus on preferences and lifestyle factors
6. Avoid generic questions - be specific and analytical
7. Keep it conversational and encouraging

QUESTION FOCUS AREAS (choose the most relevant):
- Training preferences based on past performance
- Weak points identified in their progression data
- Recovery and frequency optimization
- Exercise selection based on their strongest lifts
- Periodization preferences based on their goals
- Program structure preferences

Generate a single, specific question that a professional coach would ask based on this person's unique situation.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the next personalized question for this user.' }
      ],
      max_completion_tokens: 300,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}

async function analyzeUserResponse(
  apiKey: string,
  preferences: any,
  analytics: UserAnalytics,
  conversation: any[]
): Promise<string> {
  
  const analyticsContext = buildAnalyticsContext(analytics);
  const conversationContext = conversation
    .map(msg => `${msg.type}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an expert AI fitness coach analyzing a user's response to extract key insights for program design.

USER'S PREFERENCES & ANALYTICS:
${JSON.stringify(preferences, null, 2)}

${analyticsContext}

FULL CONVERSATION:
${conversationContext}

Analyze the user's latest response and extract key insights that will inform their workout program. Focus on:
1. Training preferences and constraints
2. Specific goals and priorities
3. Recovery needs and lifestyle factors
4. Exercise preferences or limitations
5. Program structure preferences

Provide a concise analysis that highlights the most important factors for program design.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze the conversation and provide key insights.' }
      ],
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}

async function buildMasterPrompt(
  apiKey: string,
  preferences: any,
  analytics: UserAnalytics,
  conversation: any[]
): Promise<string> {
  
  const analyticsContext = buildAnalyticsContext(analytics);
  const conversationContext = conversation
    .filter(msg => msg.type !== 'system')
    .map(msg => `${msg.type}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an expert AI fitness coach creating a comprehensive master prompt for workout program generation.

USER'S INITIAL PREFERENCES:
${JSON.stringify(preferences, null, 2)}

USER'S ANALYTICS & PERFORMANCE DATA:
${analyticsContext}

COMPLETE CONSULTATION CONVERSATION:
${conversationContext}

Your task is to synthesize ALL of this information into a detailed, comprehensive master prompt that will be used to generate the perfect workout program for this user.

The master prompt should include:
1. Complete user profile and goals
2. Training history and current performance levels
3. Specific preferences discovered in conversation
4. Constraints and limitations
5. Progression strategies based on their data
6. Exercise selection criteria
7. Periodization preferences
8. Recovery considerations
9. Motivation factors and adherence strategies

Create a detailed master prompt that captures every important detail about this user's needs, preferences, and situation. This will be used to generate their optimal workout program.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'o3-2025-04-16',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Create the comprehensive master prompt for this user.' }
      ],
      max_completion_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}

function buildAnalyticsContext(analytics: UserAnalytics): string {
  let context = "USER'S WORKOUT ANALYTICS:\n";

  // Workout frequency stats
  if (analytics.workoutFrequency) {
    const freq = analytics.workoutFrequency;
    context += `\nWorkout Frequency:
- Total workouts completed: ${freq.total_workouts}
- Average workouts per week: ${freq.avg_workouts_per_week}
- Current streak: ${freq.current_streak} workouts
- Longest streak: ${freq.longest_streak} workouts
- Last workout: ${freq.last_workout_date || 'N/A'}`;
  }

  // Exercise history
  if (analytics.exerciseHistory.length > 0) {
    context += `\n\nTop Exercises by Volume:`;
    analytics.exerciseHistory.slice(0, 10).forEach((exercise, index) => {
      context += `\n${index + 1}. ${exercise.exercise_name}: ${exercise.total_sets} sets, avg ${exercise.avg_weight?.toFixed(1)}kg x ${exercise.avg_reps?.toFixed(1)} reps`;
    });
  }

  // Core lifts progression
  if (analytics.coreLifts.length > 0) {
    context += `\n\nCurrent Strength Levels (Estimated 1RM):`;
    analytics.coreLifts.forEach(lift => {
      const improvement = lift.improvement_30d > 0 ? `(+${lift.improvement_30d.toFixed(1)}kg in 30 days)` : '';
      context += `\n- ${lift.exercise_name}: ${lift.current_1rm?.toFixed(1)}kg ${improvement}`;
    });
  }

  // Recent training patterns
  if (analytics.progressData.length > 0) {
    context += `\n\nRecent Training Pattern:`;
    const recentWorkouts = analytics.progressData
      .reduce((acc, curr) => {
        const date = curr.workout_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(curr);
        return acc;
      }, {});
    
    const dates = Object.keys(recentWorkouts).slice(0, 5);
    dates.forEach(date => {
      const exercises = recentWorkouts[date];
      context += `\n${date}: ${exercises.length} exercises, ${exercises.reduce((sum, e) => sum + (e.volume || 0), 0).toFixed(0)}kg total volume`;
    });
  }

  if (analytics.exerciseHistory.length === 0 && analytics.coreLifts.length === 0) {
    context += `\nNo previous workout history found - this appears to be a new user.`;
  }

  return context;
}