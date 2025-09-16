import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightRequest {
  userId: string;
  analysisType: 'strength_profile' | 'training_patterns' | 'progression_gaps' | 'personalization_factors';
  timeframe?: 'week' | 'month' | 'quarter' | 'all';
}

interface UserInsights {
  strengthProfile: {
    dominantMovements: string[];
    weakPoints: string[];
    asymmetries: string[];
  };
  trainingPatterns: {
    preferredVolume: string;
    recoveryNeeds: string;
    consistencyScore: number;
  };
  progressionGaps: {
    stalledExercises: string[];
    fastProgressors: string[];
    recommendations: string[];
  };
  personalizationFactors: {
    motivationTriggers: string[];
    adherencePredictors: string[];
    adaptationStyle: string;
  };
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

    const { userId, analysisType, timeframe = 'month' }: InsightRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating insights for user:', userId, 'Type:', analysisType);

    const insights = await generateUserInsights(supabase, OPENAI_API_KEY, userId, analysisType, timeframe);

    return new Response(
      JSON.stringify({ insights, analysisType, timeframe }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in workout-insights-engine:', error);
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

async function generateUserInsights(
  supabase: any, 
  apiKey: string, 
  userId: string, 
  analysisType: string, 
  timeframe: string
): Promise<any> {
  
  // Fetch comprehensive user data
  const userData = await fetchUserDataForInsights(supabase, userId, timeframe);
  
  if (analysisType === 'strength_profile') {
    return await analyzeStrengthProfile(apiKey, userData);
  } else if (analysisType === 'training_patterns') {
    return await analyzeTrainingPatterns(apiKey, userData);
  } else if (analysisType === 'progression_gaps') {
    return await analyzeProgressionGaps(apiKey, userData);
  } else if (analysisType === 'personalization_factors') {
    return await analyzePersonalizationFactors(apiKey, userData);
  }
  
  throw new Error('Invalid analysis type');
}

async function fetchUserDataForInsights(supabase: any, userId: string, timeframe: string) {
  const timeframeDays = {
    week: 7,
    month: 30,
    quarter: 90,
    all: 365
  };
  
  const days = timeframeDays[timeframe] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      workoutFreq,
      exerciseStats,
      coreLifts,
      progressData,
      userProfile
    ] = await Promise.all([
      supabase.rpc('get_workout_frequency_stats', { p_user_id: userId }),
      supabase.rpc('get_user_history', { p_user: userId }),
      supabase.rpc('get_current_core_lift_maxes', { p_user_id: userId }),
      supabase
        .from('v_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('workout_date', since.split('T')[0])
        .order('workout_date', { ascending: false }),
      supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
    ]);

    return {
      workoutFrequency: workoutFreq.data?.[0],
      exerciseStats: exerciseStats.data || [],
      coreLifts: coreLifts.data || [],
      progressData: progressData.data || [],
      userProfile: userProfile.data,
      timeframe,
      daysCovered: days
    };
  } catch (error) {
    console.error('Error fetching user data for insights:', error);
    return null;
  }
}

async function analyzeStrengthProfile(apiKey: string, userData: any) {
  const prompt = `Analyze this user's strength profile and identify patterns:

CORE LIFTS DATA:
${JSON.stringify(userData.coreLifts, null, 2)}

EXERCISE PERFORMANCE:
${userData.exerciseStats.slice(0, 15).map(ex => 
  `${ex.exercise_name}: ${ex.total_sets} sets, avg ${ex.avg_weight}kg x ${ex.avg_reps} reps`
).join('\n')}

RECENT PROGRESS:
${userData.progressData.slice(0, 20).map(p => 
  `${p.exercise_name}: ${p.weight}kg x ${p.reps}r (${p.workout_date})`
).join('\n')}

Analyze and return JSON with:
{
  "dominantMovements": ["movement patterns they excel at"],
  "weakPoints": ["areas needing development"],
  "asymmetries": ["imbalances or gaps"],
  "strengthLevel": "beginner/intermediate/advanced",
  "recommendations": ["specific targeted advice"]
}`;

  return await callOpenAI(apiKey, prompt, 'gpt-5-mini-2025-08-07');
}

async function analyzeTrainingPatterns(apiKey: string, userData: any) {
  const prompt = `Analyze this user's training patterns and preferences:

WORKOUT FREQUENCY:
- Total workouts: ${userData.workoutFrequency?.total_workouts || 0}
- Avg per week: ${userData.workoutFrequency?.avg_workouts_per_week || 0}
- Current streak: ${userData.workoutFrequency?.current_streak || 0}
- Longest streak: ${userData.workoutFrequency?.longest_streak || 0}

EXERCISE PREFERENCES:
${userData.exerciseStats.slice(0, 10).map(ex => 
  `${ex.exercise_name}: ${ex.total_sets} sets performed`
).join('\n')}

USER PROFILE:
${JSON.stringify(userData.userProfile, null, 2)}

Analyze and return JSON with:
{
  "preferredVolume": "low/moderate/high description",
  "recoveryNeeds": "recovery pattern analysis",
  "consistencyScore": 1-10,
  "exercisePreferences": ["preferred exercise types"],
  "adherenceFactors": ["what keeps them consistent"],
  "optimizationTips": ["how to improve their routine"]
}`;

  return await callOpenAI(apiKey, prompt, 'gpt-5-mini-2025-08-07');
}

async function analyzeProgressionGaps(apiKey: string, userData: any) {
  const prompt = `Identify progression gaps and stalled exercises:

EXERCISE PERFORMANCE OVER TIME:
${userData.progressData.slice(0, 30).map(p => 
  `${p.exercise_name}: ${p.weight}kg x ${p.reps}r (${p.workout_date}) - Vol: ${p.volume}`
).join('\n')}

CORE LIFT PROGRESSION:
${userData.coreLifts.map(lift => 
  `${lift.exercise_name}: ${lift.current_1rm}kg (${lift.improvement_30d > 0 ? '+' : ''}${lift.improvement_30d}kg in 30d)`
).join('\n')}

TIME PERIOD: ${userData.timeframe} (${userData.daysCovered} days)

Analyze and return JSON with:
{
  "stalledExercises": ["exercises showing no progress"],
  "fastProgressors": ["exercises with good progress"],
  "plateauReasons": ["likely causes of stalls"],
  "progressionStrategies": ["specific recommendations to break plateaus"],
  "volumeAdjustments": ["how to modify training volume"],
  "techniqueIssues": ["potential form/technique concerns"]
}`;

  return await callOpenAI(apiKey, prompt, 'gpt-5-mini-2025-08-07');
}

async function analyzePersonalizationFactors(apiKey: string, userData: any) {
  const prompt = `Identify personalization factors for this user:

USER PROFILE & GOALS:
${JSON.stringify(userData.userProfile, null, 2)}

TRAINING CONSISTENCY:
- Current streak: ${userData.workoutFrequency?.current_streak || 0} workouts
- Longest streak: ${userData.workoutFrequency?.longest_streak || 0} workouts
- Average frequency: ${userData.workoutFrequency?.avg_workouts_per_week || 0}/week

EXERCISE ENGAGEMENT:
${userData.exerciseStats.slice(0, 8).map(ex => 
  `${ex.exercise_name}: ${ex.total_sets} sets (${ex.last_performed?.split('T')[0]})`
).join('\n')}

Analyze and return JSON with:
{
  "motivationTriggers": ["what likely motivates them"],
  "adherencePredictors": ["factors that improve consistency"],
  "adaptationStyle": "how they respond to training",
  "communicationPreferences": ["how to best coach them"],
  "programStructure": ["optimal program layout for them"],
  "goalAlignment": ["how well current training matches goals"]
}`;

  return await callOpenAI(apiKey, prompt, 'gpt-5-mini-2025-08-07');
}

async function callOpenAI(apiKey: string, prompt: string, model: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a fitness analytics expert. Always return valid JSON responses with the exact structure requested.' 
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  const content = completion.choices[0].message.content.trim();
  
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse JSON response:', content);
    throw new Error('Invalid JSON response from AI');
  }
}