import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fast-track questions for new users
function generateNewUserQuestion(preferences: any, questionCount: number): string {
  const newUserQuestions = [
    `Hi! I see you're just getting started with us. Given your goal of ${preferences.goal}, what type of workouts do you enjoy most? For example, do you prefer strength training, cardio, bodyweight exercises, or a mix?`,
    
    `Thanks for that! Since you mentioned having ${preferences.equipment} equipment available, are there any specific exercises you've done before that you really enjoyed or would like to include in your program?`,
    
    `Perfect! One more question to help me create the best program for you - what's the most challenging part about sticking to a workout routine for you? Is it time, motivation, not knowing what to do, or something else?`,
    
    `Great insights! Finally, on a scale of 1-10, how would you rate your current fitness level, and are there any areas of your body you'd specifically like to focus on or avoid due to past injuries or preferences?`,
    
    `Excellent! I have enough information to create a personalized program that fits your ${preferences.goal} goal. Let me design something perfect for you!`
  ];
  
  return newUserQuestions[questionCount] || newUserQuestions[newUserQuestions.length - 1];
}

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
  sessionId?: string;
  isNewUser?: boolean;
}

interface UserAnalytics {
  workoutFrequency: any;
  exerciseHistory: any[];
  coreLifts: any[];
  progressData: any[];
}

interface ConversationSession {
  id: string;
  user_id: string;
  conversation_data: any;
  analytics_cache: any;
  insights: string[];
  created_at: string;
  updated_at: string;
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
      maxQuestions = 5,
      sessionId,
      isNewUser = false
    }: CoachRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load or create conversation session
    const session = await loadOrCreateSession(supabase, userId, sessionId);
    
    // Get cached analytics or fetch fresh if needed - fast-track new users
    const userAnalytics = isNewUser 
      ? await getMinimalAnalytics(userId)
      : await getCachedAnalytics(supabase, userId, session);

    console.log('Session loaded:', session.id, 'Analytics cached:', !!session.analytics_cache);

    if (action === 'generate_question') {
      const question = await generateOptimizedQuestion(
        OPENAI_API_KEY,
        userPreferences,
        userAnalytics,
        conversationHistory,
        currentQuestionCount,
        maxQuestions,
        session.insights,
        isNewUser
      );

      // Update session with new conversation data
      await updateSession(supabase, session.id, {
        conversation_data: conversationHistory,
        insights: session.insights
      });

      return new Response(
        JSON.stringify({ 
          question, 
          questionNumber: currentQuestionCount + 1,
          sessionId: session.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'analyze_response') {
      const analysis = await analyzeUserResponseOptimized(
        OPENAI_API_KEY,
        userPreferences,
        conversationHistory,
        session.insights
      );

      // Add insight to session
      const updatedInsights = [...session.insights, analysis];
      await updateSession(supabase, session.id, {
        conversation_data: conversationHistory,
        insights: updatedInsights
      });

      return new Response(
        JSON.stringify({ analysis, sessionId: session.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'build_master_prompt') {
      const masterPrompt = await buildOptimizedMasterPrompt(
        OPENAI_API_KEY,
        userPreferences,
        userAnalytics,
        conversationHistory,
        session.insights
      );

      await updateSession(supabase, session.id, {
        conversation_data: conversationHistory,
        insights: session.insights
      });

      return new Response(
        JSON.stringify({ masterPrompt, sessionId: session.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('Error in workout-coach-ai-optimized:', error);
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

async function loadOrCreateSession(supabase: any, userId: string, sessionId?: string): Promise<ConversationSession> {
  if (sessionId) {
    const { data: existing } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    
    if (existing) return existing;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('conversation_sessions')
    .insert({
      user_id: userId,
      conversation_data: [],
      analytics_cache: null,
      insights: []
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create conversation session');
  }

  return newSession;
}

async function getCachedAnalytics(supabase: any, userId: string, session: ConversationSession): Promise<UserAnalytics> {
  // Check if analytics are cached and still valid (4 hour TTL for better performance)
  if (session.analytics_cache) {
    const cacheAge = Date.now() - new Date(session.updated_at).getTime();
    if (cacheAge < 4 * 60 * 60 * 1000) { // 4 hours
      console.log('Using cached analytics');
      return session.analytics_cache;
    }
  }

  // Fetch fresh analytics with timeout
  console.log('Fetching fresh analytics');
  const analytics = await fetchUserAnalyticsWithTimeout(supabase, userId);
  
  // Update cache in background
  supabase
    .from('conversation_sessions')
    .update({ analytics_cache: analytics })
    .eq('id', session.id)
    .then(() => console.log('Analytics cache updated'))
    .catch((error: any) => console.error('Failed to update cache:', error));

  return analytics;
}

async function getMinimalAnalytics(userId: string): Promise<UserAnalytics> {
  // Return minimal analytics for new users to fast-track initialization
  console.log('Using minimal analytics for new user');
  return {
    workoutFrequency: null,
    exerciseHistory: [],
    coreLifts: [],
    progressData: []
  };
}

async function updateSession(supabase: any, sessionId: string, updates: any) {
  await supabase
    .from('conversation_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId);
}

async function fetchUserAnalyticsWithTimeout(supabase: any, userId: string): Promise<UserAnalytics> {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Analytics timeout')), 8000) // 8 second timeout
  );
  
  const analyticsPromise = fetchUserAnalytics(supabase, userId);
  
  try {
    return await Promise.race([analyticsPromise, timeout]);
  } catch (error) {
    console.error('Analytics fetch failed, using minimal data:', error);
    return getMinimalAnalytics(userId);
  }
}

async function fetchUserAnalytics(supabase: any, userId: string): Promise<UserAnalytics> {
  try {
    // Quick check if user has any data first
    const { data: hasWorkouts } = await supabase
      .from('workouts')
      .select('id')
      .eq('program_id', userId)
      .eq('completed', true)
      .limit(1);
    
    if (!hasWorkouts || hasWorkouts.length === 0) {
      console.log('No workout data found, returning minimal analytics');
      return getMinimalAnalytics(userId);
    }

    // Optimized parallel fetching with early returns
    const [workoutFreq, exerciseHist, coreLifts, progressData] = await Promise.all([
      supabase.rpc('get_workout_frequency_stats', { p_user_id: userId }),
      supabase.rpc('get_user_history', { p_user: userId }),
      supabase.rpc('get_current_core_lift_maxes', { p_user_id: userId }),
      supabase
        .from('v_progress')
        .select('*')
        .eq('user_id', userId)
        .order('workout_date', { ascending: false })
        .limit(15) // Further reduced for faster loading
    ]);

    return {
      workoutFrequency: workoutFreq.data?.[0] || null,
      exerciseHistory: exerciseHist.data || [],
      coreLifts: coreLifts.data || [],
      progressData: progressData.data || []
    };
  } catch (error) {
    console.error('Error in fetchUserAnalytics:', error);
    return getMinimalAnalytics(userId);
  }
}

async function generateOptimizedQuestion(
  apiKey: string,
  preferences: any,
  analytics: UserAnalytics,
  conversation: any[],
  questionCount: number,
  maxQuestions: number,
  existingInsights: string[],
  isNewUser: boolean = false
): Promise<string> {
  
  // Use faster model for new users
  const model = isNewUser ? 'gpt-4o-mini' : 'gpt-4o-mini';
  
  // Fast-track new users with basic questions
  if (isNewUser && questionCount === 0) {
    return generateNewUserQuestion(preferences, questionCount);
  }
  
  // Summarize conversation for token efficiency
  const conversationSummary = summarizeConversation(conversation);
  const dataProfile = buildDataDrivenProfile(analytics, preferences);
  
  const systemPrompt = `You are an expert AI fitness coach. Ask ONE strategic question based ONLY on available user data.

CRITICAL RULES:
- ONLY ask about things you can see in the data below
- NEVER assume lifestyle factors (stress, family, schedule) unless mentioned in their profile
- Focus on training-specific insights that can't be inferred from performance data
- Reference specific data points when asking questions

${dataProfile}

CONVERSATION HISTORY: ${conversationSummary}
EXISTING INSIGHTS: ${existingInsights.slice(-2).join(' ')}
QUESTION ${questionCount + 1}/${maxQuestions}

${getQuestionStrategy(analytics, preferences, questionCount)}

Ask ONE targeted question that builds on the available data to better understand their training preferences and help create a more personalized program.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate next question.' }
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, response.statusText, errorText);
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const completion = await response.json();
  console.log('OpenAI response:', JSON.stringify(completion, null, 2));
  
  if (!completion.choices || completion.choices.length === 0) {
    throw new Error('No response from OpenAI API');
  }
  
  const content = completion.choices[0].message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI API');
  }
  
  return content.trim();
}

async function analyzeUserResponseOptimized(
  apiKey: string,
  preferences: any,
  conversation: any[],
  existingInsights: string[]
): Promise<string> {
  
  const latestResponse = conversation[conversation.length - 1]?.content || '';
  const latestQuestion = conversation[conversation.length - 2]?.content || '';
  
  const systemPrompt = `Analyze this user response to extract actionable workout program insights:

QUESTION ASKED: "${latestQuestion}"
USER RESPONSE: "${latestResponse}"

USER PROFILE:
- Goal: ${preferences.goal}
- Equipment: ${preferences.equipment}
- Experience: ${preferences.experience}
${preferences.injuries ? `- Injuries: ${preferences.injuries}` : ''}

PREVIOUS INSIGHTS: ${existingInsights.slice(-2).join(' | ')}

Extract 1-2 specific, actionable insights that will influence:
- Exercise selection and progression
- Training structure and intensity
- Program periodization
- Recovery considerations

Focus on concrete preferences and constraints, not personality assumptions.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze response.' }
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, response.statusText, errorText);
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const completion = await response.json();
  console.log('OpenAI response:', JSON.stringify(completion, null, 2));
  
  if (!completion.choices || completion.choices.length === 0) {
    throw new Error('No response from OpenAI API');
  }
  
  const content = completion.choices[0].message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI API');
  }
  
  return content.trim();
}

async function buildOptimizedMasterPrompt(
  apiKey: string,
  preferences: any,
  analytics: UserAnalytics,
  conversation: any[],
  insights: string[]
): Promise<string> {
  
  const conversationSummary = summarizeConversation(conversation);
  const analyticsContext = buildCompactAnalyticsContext(analytics);
  
  const systemPrompt = `Create a comprehensive workout program prompt using this user data:

PREFERENCES: ${JSON.stringify(preferences)}
ANALYTICS: ${analyticsContext}
CONSULTATION: ${conversationSummary}
KEY INSIGHTS: ${insights.join(' | ')}

Synthesize into a detailed prompt for workout generation covering:
- User profile and goals
- Training history and performance
- Preferences from consultation
- Exercise selection criteria
- Progression strategy
- Recovery considerations

Be comprehensive but concise.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Create master prompt.' }
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, response.statusText, errorText);
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
  }

  const completion = await response.json();
  console.log('OpenAI response:', JSON.stringify(completion, null, 2));
  
  if (!completion.choices || completion.choices.length === 0) {
    throw new Error('No response from OpenAI API');
  }
  
  const content = completion.choices[0].message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI API');
  }
  
  return content.trim();
}

function summarizeConversation(conversation: any[]): string {
  const userMessages = conversation
    .filter(msg => msg.type === 'user')
    .slice(-3)
    .map(msg => msg.content)
    .join(' | ');
  
  return userMessages.length > 300 ? userMessages.substring(0, 300) + '...' : userMessages;
}

function buildCompactAnalyticsContext(analytics: UserAnalytics): string {
  let context = "";

  if (analytics.workoutFrequency) {
    const freq = analytics.workoutFrequency;
    context += `Frequency: ${freq.total_workouts} workouts, ${freq.avg_workouts_per_week}/week avg. `;
  }

  if (analytics.coreLifts.length > 0) {
    const lifts = analytics.coreLifts.slice(0, 3).map(lift => 
      `${lift.exercise_name}: ${lift.current_1rm?.toFixed(0)}kg`
    ).join(', ');
    context += `Strength: ${lifts}. `;
  }

  if (analytics.exerciseHistory.length > 0) {
    const topExercises = analytics.exerciseHistory.slice(0, 3).map(ex => 
      `${ex.exercise_name} (${ex.total_sets} sets)`
    ).join(', ');
    context += `Top exercises: ${topExercises}.`;
  }

  return context || "New user - no training history.";
}

function buildDataDrivenProfile(analytics: UserAnalytics, preferences: any): string {
  let profile = `USER PROFILE:\n`;
  profile += `- Goal: ${preferences.goal}\n`;
  profile += `- Schedule: ${preferences.daysPerWeek}x/week, ${preferences.sessionLength}min sessions\n`;
  profile += `- Equipment: ${preferences.equipment}\n`;
  profile += `- Experience: ${preferences.experience}\n`;
  if (preferences.injuries) {
    profile += `- Injuries: ${preferences.injuries}\n`;
  }

  profile += `\nWORKOUT DATA:\n`;
  if (analytics.workoutFrequency) {
    const freq = analytics.workoutFrequency;
    profile += `- Total workouts: ${freq.total_workouts}\n`;
    profile += `- Average frequency: ${freq.avg_workouts_per_week}/week\n`;
    profile += `- Current streak: ${freq.current_streak} days\n`;
    profile += `- Longest streak: ${freq.longest_streak} days\n`;
    if (freq.last_workout_date) {
      profile += `- Last workout: ${freq.last_workout_date}\n`;
    }
  } else {
    profile += `- New user with no workout history\n`;
  }

  if (analytics.coreLifts.length > 0) {
    profile += `\nSTRENGTH DATA:\n`;
    analytics.coreLifts.forEach(lift => {
      profile += `- ${lift.exercise_name}: ${lift.current_1rm?.toFixed(0)}kg`;
      if (lift.improvement_30d && lift.improvement_30d > 0) {
        profile += ` (+${lift.improvement_30d.toFixed(0)}kg in 30d)`;
      }
      profile += `\n`;
    });
  }

  if (analytics.exerciseHistory.length > 0) {
    profile += `\nEXERCISE PATTERNS:\n`;
    analytics.exerciseHistory.slice(0, 5).forEach(ex => {
      profile += `- ${ex.exercise_name}: ${ex.total_sets} sets, avg ${ex.avg_weight?.toFixed(0)}kg x ${ex.avg_reps?.toFixed(0)}\n`;
    });
  }

  return profile;
}

function getQuestionStrategy(analytics: UserAnalytics, preferences: any, questionCount: number): string {
  // Determine user type based on data
  const isNewUser = !analytics.workoutFrequency || analytics.workoutFrequency.total_workouts === 0;
  const isInconsistent = analytics.workoutFrequency && analytics.workoutFrequency.avg_workouts_per_week < 2;
  const hasStrongLifts = analytics.coreLifts.some(lift => lift.current_1rm && lift.current_1rm > 100);
  const hasImbalances = analytics.coreLifts.length > 1 && 
    Math.max(...analytics.coreLifts.map(l => l.current_1rm || 0)) / 
    Math.min(...analytics.coreLifts.filter(l => l.current_1rm).map(l => l.current_1rm)) > 1.5;

  if (questionCount === 0) {
    if (isNewUser) {
      return "STRATEGY: Validate their stated goal and understand their specific preferences since they have no training history.";
    } else if (isInconsistent) {
      return "STRATEGY: They have inconsistent training frequency. Ask about barriers to consistency or preferred workout structure.";
    } else if (hasImbalances) {
      return "STRATEGY: Their strength data shows imbalances. Ask about their awareness of this and preferences for addressing it.";
    } else {
      return "STRATEGY: They have solid training data. Ask about progression preferences or satisfaction with current approach.";
    }
  }

  if (questionCount === 1) {
    if (analytics.exerciseHistory.length > 0) {
      const favoriteTypes = analytics.exerciseHistory.slice(0, 3).map(ex => ex.exercise_name).join(', ');
      return `STRATEGY: They've done mostly: ${favoriteTypes}. Ask about variety preferences or specific exercise likes/dislikes.`;
    }
    return "STRATEGY: Dig deeper into their training philosophy or periodization preferences.";
  }

  if (questionCount === 2) {
    return "STRATEGY: Focus on program structure preferences - intensity vs volume, progression style, or recovery needs.";
  }

  if (questionCount === 3) {
    return "STRATEGY: Address any remaining gaps in understanding their specific training preferences or constraints.";
  }

  return "STRATEGY: Final clarification on any important program design factors.";
}