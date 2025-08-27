import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Analyzing progress for user:', user.id);

    // Fetch user's progress data
    const { data: progressData, error: progressError } = await supabaseClient
      .from('v_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('workout_date', { ascending: true });

    if (progressError) {
      console.error('Progress fetch error:', progressError);
      throw progressError;
    }

    // Fetch user's workout history - only completed workouts
    const { data: workoutsData, error: workoutsError } = await supabaseClient
      .from('workouts')
      .select(`
        *,
        programs!inner(name, user_id),
        workout_exercises(
          exercise_id,
          exercises(name)
        )
      `)
      .eq('programs.user_id', user.id)
      .eq('completed', true)
      .not('workout_date', 'is', null)
      .order('workout_date', { ascending: false })
      .limit(10);

    if (workoutsError) {
      console.error('Workouts fetch error:', workoutsError);
    }

    // Fetch recent sets data
    const { data: setsData, error: setsError } = await supabaseClient
      .from('sets')
      .select(`
        *,
        workout_exercises!inner(
          workout_id,
          exercises(name),
          workouts!inner(
            programs!inner(user_id)
          )
        )
      `)
      .eq('workout_exercises.workouts.programs.user_id', user.id)
      .order('performed_at', { ascending: false })
      .limit(50);

    if (setsError) {
      console.error('Sets fetch error:', setsError);
    }

    // Prepare data summary for AI analysis
    const progressSummary = progressData?.map(p => ({
      exercise: p.exercise_name,
      date: p.workout_date,
      weight: p.weight,
      reps: p.reps,
      estimated1RM: p.estimated_1rm
    })) || [];

    const recentWorkouts = workoutsData?.length || 0;
    const totalSets = setsData?.length || 0;
    
    // Calculate trends by exercise
    const exerciseProgress = {};
    progressData?.forEach(p => {
      if (!exerciseProgress[p.exercise_name]) {
        exerciseProgress[p.exercise_name] = [];
      }
      exerciseProgress[p.exercise_name].push({
        date: p.workout_date,
        weight: p.weight,
        reps: p.reps,
        estimated1RM: p.estimated_1rm
      });
    });

    const trends = Object.entries(exerciseProgress).map(([exercise, data]) => {
      const sortedData = data.sort((a, b) => new Date(a.date) - new Date(b.date));
      if (sortedData.length >= 2) {
        const first = sortedData[0];
        const last = sortedData[sortedData.length - 1];
        const weightChange = (last.weight || 0) - (first.weight || 0);
        const repsChange = (last.reps || 0) - (first.reps || 0);
        const est1rmChange = (last.estimated1RM || 0) - (first.estimated1RM || 0);
        return { exercise, weightChange, repsChange, est1rmChange, sessions: sortedData.length };
      }
      return null;
    }).filter(Boolean);

    const prompt = `You are a fitness coach analyzing a user's workout progress. Provide a concise, motivational analysis based on this data:

**Recent Activity:**
- Completed ${recentWorkouts} workouts recently
- Performed ${totalSets} sets total
- Tracking ${Object.keys(exerciseProgress).length} different exercises

**Progress Trends:**
${trends.map(t => `- ${t.exercise}: ${t.weightChange > 0 ? '+' : ''}${t.weightChange?.toFixed(1)}kg weight change, ${t.repsChange > 0 ? '+' : ''}${t.repsChange?.toFixed(1)} reps change, ${t.est1rmChange > 0 ? '+' : ''}${t.est1rmChange?.toFixed(1)}kg 1RM change over ${t.sessions} sessions`).join('\n')}

**Recent Progress Data:**
${progressSummary.slice(0, 10).map(p => `- ${p.exercise}: ${new Date(p.date).toLocaleDateString()}, ${p.weight || 0}kg × ${p.reps || 0} reps (Est 1RM: ${p.estimated1RM?.toFixed(1) || 0}kg)`).join('\n')}

Provide a markdown-formatted analysis covering:
1. **Overall Progress** - Key achievements and improvements
2. **Strengths** - What's going well
3. **Areas for Focus** - Specific recommendations for improvement
4. **Next Steps** - Actionable advice for continued progress

Keep it concise (max 300 words), encouraging, and data-driven. Use markdown formatting with headers, bullet points, and emphasis.`;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Calling OpenAI for progress analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert fitness coach and data analyst. Provide concise, actionable fitness insights based on workout data.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('Analysis generated successfully');

    return new Response(
      JSON.stringify({ 
        analysis,
        dataPoints: {
          totalWorkouts: recentWorkouts,
          totalSets,
          exercisesTracked: Object.keys(exerciseProgress).length,
          trendsCount: trends.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-progress function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        analysis: "## Progress Analysis Unavailable\n\nUnable to generate progress analysis at this time. Please ensure you have completed some workouts and try again."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});